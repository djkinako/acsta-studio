import type { Point, Polygons, Ring } from './types'

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** ローカル座標のリング群を 回転(deg) → 平行移動(cx,cy) でワールドmm座標へ */
export function transformRings(polys: Polygons, cx: number, cy: number, deg: number): Polygons {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return polys.map((ring) =>
    ring.map((p) => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos,
    })),
  )
}

export function bboxOf(polys: Polygons): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const ring of polys) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, minY, maxX, maxY }
}

/** bbox同士が gap 未満まで近接（または交差）しているか。粗い事前フィルタ用 */
export function bboxNear(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.minX - gap < b.maxX && b.minX - gap < a.maxX && a.minY - gap < b.maxY && b.minY - gap < a.maxY
  )
}

/** 全頂点が矩形内にあるか（凸矩形なので頂点判定で包含が言える） */
export function allInsideRect(polys: Polygons, rect: Rect): boolean {
  for (const ring of polys) {
    for (const p of ring) {
      if (p.x < rect.minX || p.x > rect.maxX || p.y < rect.minY || p.y > rect.maxY) return false
    }
  }
  return true
}

function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) {
    t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
  }
  return { x: a.x + t * dx, y: a.y + t * dy }
}

export interface ClosestPair {
  distance: number
  pa: Point
  pb: Point
}

/**
 * 2つのポリゴン群の最短距離と最近接点ペア（違反バッジの表示用）。
 * 頂点⇔辺の総当たり。違反確定ペアにのみ・操作確定後にのみ使う想定。
 */
export function minDistanceBetween(a: Polygons, b: Polygons): ClosestPair {
  let best: ClosestPair = { distance: Infinity, pa: { x: 0, y: 0 }, pb: { x: 0, y: 0 } }
  const check = (from: Polygons, to: Polygons, swap: boolean) => {
    for (const ring of from) {
      for (const p of ring) {
        for (const toRing of to) {
          for (let i = 0, n = toRing.length; i < n; i++) {
            const q = closestOnSegment(p, toRing[i], toRing[(i + 1) % n])
            const d = Math.hypot(p.x - q.x, p.y - q.y)
            if (d < best.distance) {
              best = swap ? { distance: d, pa: q, pb: p } : { distance: d, pa: p, pb: q }
            }
          }
        }
      }
    }
  }
  check(a, b, false)
  check(b, a, true)
  return best
}

/** リング群の頂点数合計（パフォーマンス表示用） */
export function totalPoints(polys: Polygons): number {
  return polys.reduce((s, r) => s + r.length, 0)
}

export type { Ring }
