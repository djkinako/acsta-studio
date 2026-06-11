import type { Point, Ring } from './types'

/** 点 p から線分 a-b への距離の2乗 */
function distSqToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) {
    t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
  }
  const qx = a.x + t * dx
  const qy = a.y + t * dy
  return (p.x - qx) ** 2 + (p.y - qy) ** 2
}

/** 開いたポリライン（両端固定）の Douglas-Peucker。反復実装 */
function dpOpen(points: Point[], tolerance: number): Point[] {
  const n = points.length
  if (n <= 2) return points.slice()
  const tol2 = tolerance * tolerance
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: Array<[number, number]> = [[0, n - 1]]
  while (stack.length > 0) {
    const [s, e] = stack.pop()!
    let maxD = -1
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = distSqToSegment(points[i], points[s], points[e])
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  const out: Point[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i])
  return out
}

/**
 * 閉リングの簡略化（SPEC 6.1-2: Douglas-Peucker、許容誤差はmm）。
 * 先頭点とそこから最遠の点をアンカーに2本の開ポリラインへ分割して処理する。
 */
export function simplifyClosed(ring: Ring, tolerance: number): Ring {
  const n = ring.length
  if (n <= 4 || tolerance <= 0) return ring
  let far = 1
  let maxD = -1
  for (let i = 1; i < n; i++) {
    const d = (ring[i].x - ring[0].x) ** 2 + (ring[i].y - ring[0].y) ** 2
    if (d > maxD) {
      maxD = d
      far = i
    }
  }
  const first = dpOpen(ring.slice(0, far + 1), tolerance)
  const second = dpOpen([...ring.slice(far), ring[0]], tolerance)
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}
