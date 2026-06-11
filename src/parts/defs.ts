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
export function tabRing(def: TabDef, lengthMm = def.heightMm): Ring {
  const hw = def.widthMm / 2
  const overlap = 2
  const r = Math.min(1.6, hw * 0.45)
  return [
    { x: -hw, y: -overlap },
    { x: hw, y: -overlap },
    ...arc(hw - r, lengthMm - r, r, 0, 90),
    ...arc(-hw + r, lengthMm - r, r, 90, 180),
  ]
}

/** 台座（板厚）に実際に差し込まれる深さ（mm）。タブ先端の強調表示に使う */
export const INSERT_DEPTH_MM = 3

/** 円リング（screen座標系で時計回り = 外周） */
function circleRing(cx: number, cy: number, r: number, segs = 36): Ring {
  return arc(cx, cy, r, 0, 360, segs).slice(0, -1)
}

export interface KeyringDef {
  /** キーホルダー金具を通す穴の直径（mm） */
  holeDmm: number
  /** 穴の周囲の縁の太さ（mm） */
  rimMm: number
}

/**
 * アクキー用の穴付きポッチ（キーホール）のローカル形状。
 * 丸い頭（中央に貫通穴）＋本体へ繋がる首。穴は逆回転リング。
 */
export function keyringRings(def: KeyringDef): Ring[] {
  const outerR = def.holeDmm / 2 + def.rimMm
  const overlap = 2
  const cy = outerR - 1.2 // 頭の中心。本体側へ1.2mm食い込ませる
  const head = circleRing(0, cy, outerR)
  const neckHw = outerR * 0.75
  // 首の上端は必ず穴の下端より下に留める。
  // 穴に重なると NonZero union で穴の下半分が埋まり「かまぼこ穴」になる
  const neckTop = cy - def.holeDmm / 2 - 0.3
  const neck: Ring = [
    { x: -neckHw, y: -overlap },
    { x: neckHw, y: -overlap },
    { x: neckHw, y: neckTop },
    { x: -neckHw, y: neckTop },
  ]
  const hole = circleRing(0, cy, def.holeDmm / 2, 28).reverse()
  return [head, neck, hole]
}

/** 輪郭吸着パーツ（タブ＋穴付きポッチ）の統合レジストリ */
export type AttachmentId = PartSize | 'K3' | 'K5'

export interface AttachmentDef {
  id: AttachmentId
  kind: 'tab' | 'keyring'
  label: string
  /** ハンドル・ラベルを置く取り付け方向の距離（mm） */
  markerMm: number
  /** タブの幅（先端3mm強調バンドの描画用。keyring は外径） */
  widthMm: number
  rings: (lengthMm?: number) => Ring[]
}

export const KEYRING_DEFS: Record<'K3' | 'K5', KeyringDef> = {
  K3: { holeDmm: 3, rimMm: 2.2 },
  K5: { holeDmm: 5, rimMm: 2.4 },
}

const tabAttachment = (size: PartSize): AttachmentDef => ({
  id: size,
  kind: 'tab',
  label: TAB_DEFS[size].label,
  markerMm: TAB_DEFS[size].heightMm / 2,
  widthMm: TAB_DEFS[size].widthMm,
  rings: (lengthMm) => [tabRing(TAB_DEFS[size], lengthMm)],
})

const keyringAttachment = (id: 'K3' | 'K5'): AttachmentDef => ({
  id,
  kind: 'keyring',
  label: `ポッチ 穴${KEYRING_DEFS[id].holeDmm}mm`,
  markerMm: KEYRING_DEFS[id].holeDmm / 2 + KEYRING_DEFS[id].rimMm - 1.2,
  widthMm: (KEYRING_DEFS[id].holeDmm / 2 + KEYRING_DEFS[id].rimMm) * 2,
  rings: () => keyringRings(KEYRING_DEFS[id]),
})

export const ATTACHMENT_DEFS: Record<AttachmentId, AttachmentDef> = {
  S: tabAttachment('S'),
  M: tabAttachment('M'),
  L: tabAttachment('L'),
  K3: keyringAttachment('K3'),
  K5: keyringAttachment('K5'),
}

/** タブと本体の接合部（ほぼ90°の角）を丸める半径（mm） */
export const JUNCTION_ROUND_MM = 0.8

/**
 * 台座のローカル形状（中心原点）。
 * 外周の角丸矩形 + 中央の差し込み穴（逆回転リング = 穴）。
 * widthMm で外形を比例スケールできるが、**穴の寸法はタブとの嵌合を守るため固定**。
 */
export function standRings(def: StandDef, widthMm = def.widthMm, heightMm = def.heightMm): Ring[] {
  const outer = roundedRectRing(widthMm, heightMm, 3)
  const hole = roundedRectRing(def.holeWmm, def.holeHmm, 0.8).reverse()
  return [outer, hole]
}

/** 台座の最小外形幅（穴＋両側の縁）。これ未満には縮小できない */
export function standMinWidth(def: StandDef): number {
  return def.holeWmm + 8
}

/** 台座の最小外形高さ（穴＋上下の縁） */
export function standMinHeight(def: StandDef): number {
  return def.holeHmm + 6
}
