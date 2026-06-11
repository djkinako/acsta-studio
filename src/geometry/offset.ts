import ClipperLib from 'clipper-lib'
import type { ClipperPaths } from 'clipper-lib'
import { simplifyClosed } from './simplify'
import { smoothClosedCurve } from './smoothcurve'
import type { Polygons, Ring } from './types'

/**
 * ポリゴン演算エンジン: clipper-lib（Clipper 6.4.2 の実績ある純JSポート）。
 * 当初候補の clipper2-js 1.2.4 は Round オフセットで角の円弧が壊れるバグが
 * あったため不採用（2026-06-11 検証。test/geometry.test.ts で再現可能）。
 */

/** mm → Clipper整数座標のスケール（1単位 = 0.001mm） */
const SCALE = 1000
/** 円弧近似の許容誤差（Clipper単位 = 0.005mm） */
const ARC_TOLERANCE = 5

function toClipper(polys: Polygons): ClipperPaths {
  return polys.map((ring) =>
    ring.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })),
  )
}

function fromClipper(paths: ClipperPaths): Polygons {
  return paths.map((path) => path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE })))
}

function union(paths: ClipperPaths): ClipperPaths {
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true)
  const solution: ClipperPaths = []
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  )
  return solution
}

function inflate(paths: ClipperPaths, deltaUnits: number): ClipperPaths {
  const co = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE)
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const solution: ClipperPaths = []
  co.Execute(solution, deltaUnits)
  return solution
}

export interface CutlineOptions {
  /** カットラインオフセット（mm）。SPEC 5: デフォルト 0.5 */
  offsetMm: number
  /** 角丸め半径（mm）。クロージング（+r → −r）で凹部をスムージング。SPEC 5: デフォルト 0.5 */
  roundRadiusMm: number
  /**
   * なめらか補正（mm）。オープニング（−s → +s）で凸側のガタつき
   * （写真切り抜きのフチノイズ等）を削ぎ落とす。
   * 角丸め（凹を埋める）と対になる処理。0 = 無効
   */
  smoothMm?: number
  /** 輪郭の穴の扱い。false = 外周のみ（デフォルト） */
  includeHoles?: boolean
}

/**
 * 輪郭（mm座標）からカットラインを生成する。
 *
 * パイプライン（SPEC 6.1-3〜4）:
 *  1. union で重なり整理
 *  2. +（offset + 角丸め半径）を Round ジョインで膨張 → 凸角は自動で円弧化
 *  3. −角丸め半径 で収縮（クロージング）→ 凹部もスムージング
 *  4. 穴の除外（設定時）
 *
 * 円板によるミンコフスキー和は加法的なので、+offset → +r の2回膨張は
 * +(offset+r) の1回膨張と等価。パス数を1回分節約している。
 */
export function generateCutline(contoursMm: Polygons, opts: CutlineOptions): Polygons {
  const { offsetMm, roundRadiusMm, smoothMm = 0, includeHoles = false } = opts
  if (contoursMm.length === 0) return []

  const base = union(toClipper(contoursMm))
  let paths = base

  const grow = (offsetMm + roundRadiusMm) * SCALE
  if (grow > 0) {
    paths = inflate(paths, grow)
  }
  if (roundRadiusMm > 0) {
    paths = inflate(paths, -roundRadiusMm * SCALE)
  }

  if (smoothMm > 0) {
    // 1) オープニング: 鋭いトゲ状の出っ張り（幅 ~2×smoothMm まで）を除去
    paths = inflate(paths, -smoothMm * SCALE)
    paths = inflate(paths, smoothMm * SCALE)
    // 2) ガウシアン曲線平滑化: モルフォロジーが素通しする中波長の
    //    「うねり」（写真切り抜きのフチノイズ由来）を直接減衰させる
    const smoothed = fromClipper(paths).map((ring) =>
      simplifyClosed(smoothClosedCurve(ring, smoothMm), 0.02),
    )
    paths = toClipper(smoothed)
    // 3) 安全フロア（二重）: 平滑化は曲線を内側に縮めることがあるため、
    //    a. ノイズ除去後のシルエット + offset/2 — なめらかな主フロア。
    //       フロアを生の輪郭にするとノイズの歯まで保護して補正が
    //       無効化されるため、フロア側も同じ平滑化を通す
    //    b. 生の輪郭 + offset×0.2 — 絶対防衛ライン。どんな補正強度でも
    //       不透明画素に offset の2割未満まで近づくことはない
    //       （角の強い平滑化で絵に食い込む事故の構造的防止）
    let floorBase = inflate(base, -smoothMm * SCALE)
    floorBase = inflate(floorBase, smoothMm * SCALE)
    const floorSmoothed = fromClipper(floorBase).map((ring) =>
      simplifyClosed(smoothClosedCurve(ring, smoothMm), 0.02),
    )
    const floorA = inflate(toClipper(floorSmoothed), offsetMm * 0.5 * SCALE)
    const floorB = inflate(base, offsetMm * 0.2 * SCALE)
    paths = union([...paths, ...floorA, ...floorB])
  }

  if (!includeHoles && paths.length > 1) {
    // 最大面積のリングと同じ回転方向のもの＝外周だけを残す
    let outerSign = 0
    let maxAbs = -1
    for (const p of paths) {
      const a = ClipperLib.Clipper.Area(p)
      if (Math.abs(a) > maxAbs) {
        maxAbs = Math.abs(a)
        outerSign = Math.sign(a)
      }
    }
    paths = paths.filter((p) => Math.sign(ClipperLib.Clipper.Area(p)) === outerSign)
  }

  return fromClipper(paths)
}

/**
 * 間隔チェック用の膨張ポリゴン（SPEC 6.3: カットラインを 最小間隔÷2 膨らませる）
 */
export function inflateForGapCheck(cutlineMm: Polygons, minGapMm: number): Polygons {
  if (cutlineMm.length === 0) return []
  return fromClipper(inflate(toClipper(cutlineMm), (minGapMm / 2) * SCALE))
}

/** 2つのポリゴン群が交差するか（間隔違反判定） */
export function polygonsIntersect(a: Polygons, b: Polygons): boolean {
  if (a.length === 0 || b.length === 0) return false
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(toClipper(a), ClipperLib.PolyType.ptSubject, true)
  clipper.AddPaths(toClipper(b), ClipperLib.PolyType.ptClip, true)
  const solution: ClipperPaths = []
  clipper.Execute(
    ClipperLib.ClipType.ctIntersection,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  )
  return solution.length > 0
}

/** カットライン同士のブーリアン結合（タブ合体用） */
export function unionPolygons(a: Polygons, b: Polygons): Polygons {
  return fromClipper(union(toClipper([...a, ...b])))
}

/**
 * 凹の角だけを丸める（クロージング: +r → −r）。
 * タブ接合部の約90°の角の丸めに使う。凸側・穴の寸法はほぼ不変
 * （円弧近似誤差 0.005mm 程度）。
 */
export function closeCorners(polys: Polygons, radiusMm: number): Polygons {
  if (radiusMm <= 0 || polys.length === 0) return polys
  let paths = inflate(toClipper(polys), radiusMm * SCALE)
  paths = inflate(paths, -radiusMm * SCALE)
  return fromClipper(paths)
}

/** リングをSVGパス文字列へ（mm座標のまま） */
export function ringsToSvgPath(polys: Polygons, precision = 3): string {
  let d = ''
  for (const ring of polys) {
    if (ring.length < 3) continue
    d += `M ${ring[0].x.toFixed(precision)} ${ring[0].y.toFixed(precision)} `
    for (let i = 1; i < ring.length; i++) {
      d += `L ${ring[i].x.toFixed(precision)} ${ring[i].y.toFixed(precision)} `
    }
    d += 'Z '
  }
  return d.trim()
}

export type { Ring }
