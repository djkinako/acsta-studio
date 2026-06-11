import type { Ring } from './types'
import { signedArea } from './types'

/**
 * アルファチャンネルからの輪郭抽出（marching squares + セグメント縫合）。
 *
 * - 入力: RGBA の ImageData.data 相当バッファ
 * - 判定: alpha > threshold を「内側」とする（SPEC 6.1: デフォルト alpha > 0）
 * - 出力: px座標のリング群。外周・穴とも検出する（穴の除外は offset 側で行う）
 * - 座標系: ピクセル (px,py) の中心を (px+0.5, py+0.5) とし、輪郭は
 *   セル辺の中点（0.5刻み）を通る。画像全体は [0,w]×[0,h] に収まる。
 */
export function extractContours(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold = 0,
  minAreaPx2 = 2,
): Ring[] {
  // 外周1pxを「外側」でパディングした二値グリッド
  const bw = width + 2
  const bh = height + 2
  const bin = new Uint8Array(bw * bh)
  for (let y = 0; y < height; y++) {
    const rowIn = y * width
    const rowOut = (y + 1) * bw + 1
    for (let x = 0; x < width; x++) {
      bin[rowOut + x] = rgba[(rowIn + x) * 4 + 3] > threshold ? 1 : 0
    }
  }

  // 中点ID: 0=T, 1=R, 2=B, 3=L
  // ケース → 有向セグメント列（内側が進行方向の左になる向き）
  // bit: TL=1, TR=2, BR=4, BL=8
  const SEG: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [],
    [[3, 0]],
    [[0, 1]],
    [[3, 1]],
    [[1, 2]],
    [[3, 0], [1, 2]],
    [[0, 2]],
    [[3, 2]],
    [[2, 3]],
    [[2, 0]],
    [[0, 1], [2, 3]],
    [[2, 1]],
    [[1, 3]],
    [[1, 0]],
    [[0, 3]],
    [],
  ]

  // 中点座標（×2して整数化）をキーに start→end を引く
  // セル (i,j)（パディング座標）の中点（×2、グローバル）:
  //   T=(2i, 2j-1), R=(2i+1, 2j), B=(2i, 2j+1), L=(2i-1, 2j)
  //   ※セル左上コーナーのピクセル中心が (i-0.5, j-0.5)（元画像px座標）のとき
  const stride = 2 * bw + 2
  const segStart = new Map<number, number>()

  const midKey = (i: number, j: number, mid: number): number => {
    // ×2座標（パディング系）: i,j はセルindex（コーナー=bin[j*bw+i]..）
    // セルの4コーナーのピクセル中心（×2, パディング系）: (2i+1,2j+1)〜(2i+3,2j+3)
    // 中点: T=(2i+2,2j+1) R=(2i+3,2j+2) B=(2i+2,2j+3) L=(2i+1,2j+2)
    let kx: number, ky: number
    switch (mid) {
      case 0: kx = 2 * i + 2; ky = 2 * j + 1; break
      case 1: kx = 2 * i + 3; ky = 2 * j + 2; break
      case 2: kx = 2 * i + 2; ky = 2 * j + 3; break
      default: kx = 2 * i + 1; ky = 2 * j + 2; break
    }
    return ky * stride + kx
  }

  for (let j = 0; j < bh - 1; j++) {
    const row = j * bw
    const rowN = row + bw
    for (let i = 0; i < bw - 1; i++) {
      const caseIdx =
        bin[row + i] | (bin[row + i + 1] << 1) | (bin[rowN + i + 1] << 2) | (bin[rowN + i] << 3)
      if (caseIdx === 0 || caseIdx === 15) continue
      for (const [from, to] of SEG[caseIdx]) {
        segStart.set(midKey(i, j, from), midKey(i, j, to))
      }
    }
  }

  // キー → 元画像px座標へ復元
  // パディング系×2座標 (kx,ky) → 元画像px = ((kx - 3) / 2 + 0.5, ...) を整理すると:
  //   px = (kx - 2) / 2,  py = (ky - 2) / 2
  //   （パディングピクセル(0,0)の中心が元画像座標 (-0.5,-0.5) のため）
  const decode = (key: number): { x: number; y: number } => {
    const kx = key % stride
    const ky = (key - kx) / stride
    return { x: (kx - 2) / 2, y: (ky - 2) / 2 }
  }

  const rings: Ring[] = []
  const pushMerged = (ring: Ring, x: number, y: number) => {
    const n = ring.length
    if (n >= 2) {
      const a = ring[n - 2]
      const b = ring[n - 1]
      // 共線なら中間点を捨てる（直線エッジの中点列を圧縮）
      if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) === 0) {
        b.x = x
        b.y = y
        return
      }
    }
    ring.push({ x, y })
  }

  while (segStart.size > 0) {
    const startKey: number = segStart.keys().next().value!
    const ring: Ring = []
    let key = startKey
    for (;;) {
      const next = segStart.get(key)
      if (next === undefined) break
      segStart.delete(key)
      const p = decode(key)
      pushMerged(ring, p.x, p.y)
      key = next
      if (key === startKey) break
    }
    if (ring.length >= 3 && Math.abs(signedArea(ring)) >= minAreaPx2) {
      rings.push(ring)
    }
  }
  return rings
}
