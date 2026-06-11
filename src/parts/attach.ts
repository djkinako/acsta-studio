import { signedArea, type Point, type Ring } from '../geometry/types'
import { ATTACHMENT_DEFS, type AttachmentId } from './defs'

/**
 * タブの吸着・スライド計算（SPEC 6.4）。
 * タブ位置はカットライン輪郭上の弧長パラメータ t ∈ [0,1) で持つ。
 * 拡縮・パラメータ変更で輪郭が変わっても相対位置が保たれる。
 */

export interface RingPose {
  point: Point
  /** 外向き単位法線 */
  normal: Point
}

function ringLengths(ring: Ring): { lengths: number[]; total: number } {
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    lengths.push(len)
    total += len
  }
  return { lengths, total }
}

/** 弧長パラメータ t の位置と外向き法線 */
export function poseOnRing(ring: Ring, t: number): RingPose {
  const { lengths, total } = ringLengths(ring)
  const target = ((t % 1) + 1) % 1 * total
  let acc = 0
  let i = 0
  while (i < ring.length - 1 && acc + lengths[i] < target) {
    acc += lengths[i]
    i++
  }
  const a = ring[i]
  const b = ring[(i + 1) % ring.length]
  const len = lengths[i] || 1
  const u = (target - acc) / len
  const point = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
  const dx = (b.x - a.x) / len
  const dy = (b.y - a.y) / len
  // screen座標系（y下向き）: 時計回り（signedArea>0）なら進行方向の左 (dy,-dx) が外側
  const sign = signedArea(ring) > 0 ? 1 : -1
  return { point, normal: { x: dy * sign, y: -dx * sign } }
}

/** 点 p に最も近い輪郭上の弧長パラメータ t と距離 */
export function nearestParamOnRing(ring: Ring, p: Point): { t: number; distance: number } {
  const { lengths, total } = ringLengths(ring)
  let best = { t: 0, distance: Infinity }
  let acc = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const len = lengths[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = len * len
    let u = 0
    if (len2 > 0) {
      u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    }
    const qx = a.x + dx * u
    const qy = a.y + dy * u
    const d = Math.hypot(p.x - qx, p.y - qy)
    if (d < best.distance) {
      best = { t: (acc + len * u) / total, distance: d }
    }
    acc += len
  }
  return best
}

/** リング群のうち最大面積のリング（タブ取り付け対象 = 外周） */
export function largestRing(rings: Ring[]): Ring | null {
  let best: Ring | null = null
  let maxAbs = -1
  for (const r of rings) {
    const a = Math.abs(signedArea(r))
    if (a > maxAbs) {
      maxAbs = a
      best = r
    }
  }
  return best
}

/**
 * 吸着パーツ（タブ・穴付きポッチ）のローカル形状を、
 * 輪郭上のパラメータ t の位置・向きに変換して返す。
 * 逆回転リング（穴）もそのまま変換される。
 */
export function attachmentPolygonsAt(
  ring: Ring,
  t: number,
  id: AttachmentId,
): { polygons: Ring[]; pose: RingPose } {
  const pose = poseOnRing(ring, t)
  // ローカル +y を外向き法線へ回す回転: R(θ)·(0,1) = n
  const sin = -pose.normal.x
  const cos = pose.normal.y
  const polygons = ATTACHMENT_DEFS[id].rings().map((local) =>
    local.map((p) => ({
      x: pose.point.x + p.x * cos - p.y * sin,
      y: pose.point.y + p.x * sin + p.y * cos,
    })),
  )
  return { polygons, pose }
}
