import ClipperLib from 'clipper-lib'
import type { ClipperPaths } from 'clipper-lib'
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
  const { offsetMm, roundRadiusMm, includeHoles = false } = opts
  if (contoursMm.length === 0) return []

  let paths = union(toClipper(contoursMm))

  const grow = (offsetMm + roundRadiusMm) * SCALE
  if (grow > 0) {
    paths = inflate(paths, grow)
  }
  if (roundRadiusMm > 0) {
    paths = inflate(paths, -roundRadiusMm * SCALE)
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
