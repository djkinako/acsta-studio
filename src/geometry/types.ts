/** mm基準の座標点（内部座標はすべてmm float64。pxは表示・ラスター用の派生値） */
export interface Point {
  x: number
  y: number
}

/** 閉じたリング（最終点→先頭点は暗黙に接続） */
export type Ring = Point[]

/** 多角形群（外周＋穴を含みうる） */
export type Polygons = Ring[]

/** リングの符号付き面積（screen座標系: y下向き） */
export function signedArea(ring: Ring): number {
  let a = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % n]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}
