import type { Point, Ring } from '../geometry/types'

/**
 * スタンドパーツ定義（SPEC 6.4）。
 *
 * ⚠ 寸法はすべてUIモック由来の【仮値】。きなこの入稿先テンプレSVGが
 * 届いたらこのファイルの数値（またはパスデータ）を差し替えるだけで
 * 全機能がそのまま動く構造にしてある。
 */

export type PartSize = 'S' | 'M' | 'L'

export interface TabDef {
  size: PartSize
  label: string
  /** タブの幅（mm） */
  widthMm: number
  /** 本体輪郭から下に突き出す長さ（mm） */
  heightMm: number
}

export interface StandDef {
  size: PartSize
  label: string
  widthMm: number
  heightMm: number
  /** 差し込み穴のサイズ（mm）。対応するタブ幅+遊び × 板厚+遊び */
  holeWmm: number
  holeHmm: number
}

export const TAB_DEFS: Record<PartSize, TabDef> = {
  S: { size: 'S', label: 'タブ S', widthMm: 8, heightMm: 5 },
  M: { size: 'M', label: 'タブ M', widthMm: 10, heightMm: 6 },
  L: { size: 'L', label: 'タブ L', widthMm: 12, heightMm: 7 },
}

export const STAND_DEFS: Record<PartSize, StandDef> = {
  S: { size: 'S', label: '台座 小 ・ 穴S', widthMm: 40, heightMm: 12, holeWmm: 8.2, holeHmm: 3.2 },
  M: { size: 'M', label: '台座 中 ・ 穴M', widthMm: 60, heightMm: 16, holeWmm: 10.2, holeHmm: 3.2 },
  L: { size: 'L', label: '台座 大 ・ 穴L', widthMm: 80, heightMm: 20, holeWmm: 12.2, holeHmm: 3.2 },
}

/** 円弧をポリゴン点列で近似（時計回り角度、screen座標系） */
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, segs = 8): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= segs; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / segs) * Math.PI) / 180
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

/** 角丸矩形リング（中心原点） */
export function roundedRectRing(w: number, h: number, r: number): Ring {
  const hw = w / 2
  const hh = h / 2
  const rr = Math.min(r, hw, hh)
  return [
    ...arc(-hw + rr, -hh + rr, rr, 180, 270),
    ...arc(hw - rr, -hh + rr, rr, 270, 360),
    ...arc(hw - rr, hh - rr, rr, 0, 90),
    ...arc(-hw + rr, hh - rr, rr, 90, 180),
  ]
}

/**
 * タブのローカル形状。
 * 座標系: 取り付け点が原点、+y が本体の外側（輪郭の外向き法線方向）。
 * 本体側に 2mm 食い込ませて union が必ず繋がるようにする。
 * 下側（先端）の角は丸め。
 */
export function tabRing(def: TabDef): Ring {
  const hw = def.widthMm / 2
  const overlap = 2
  const r = Math.min(1.6, hw * 0.45)
  return [
    { x: -hw, y: -overlap },
    { x: hw, y: -overlap },
    ...arc(hw - r, def.heightMm - r, r, 0, 90),
    ...arc(-hw + r, def.heightMm - r, r, 90, 180),
  ]
}

/**
 * 台座のローカル形状（中心原点）。
 * 外周の角丸矩形 + 中央の差し込み穴（逆回転リング = 穴）。
 */
export function standRings(def: StandDef): Ring[] {
  const outer = roundedRectRing(def.widthMm, def.heightMm, 3)
  const hole = roundedRectRing(def.holeWmm, def.holeHmm, 0.8).reverse()
  return [outer, hole]
}
