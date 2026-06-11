import { describe, expect, it } from 'vitest'
import { alphaMask, erodeMask, maskToRgba } from '../src/geometry/erosion'

/** w×h の二値マスクに矩形の前景領域を描いたものを作る */
function makeRectMask(
  w: number,
  h: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Uint8Array {
  const mask = new Uint8Array(w * h)
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      mask[y * w + x] = 1
    }
  }
  return mask
}

/** 中心 (cx,cy)・半径 r の円板マスクを作る（画素中心が円内なら前景） */
function makeDiskMask(w: number, h: number, cx: number, cy: number, r: number): Uint8Array {
  const mask = new Uint8Array(w * h)
  const r2 = r * r
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) mask[y * w + x] = 1
    }
  }
  return mask
}

/** マスクの前景画素数（面積px2） */
function maskArea(mask: Uint8Array): number {
  let n = 0
  for (let i = 0; i < mask.length; i++) n += mask[i]
  return n
}

describe('alphaMask', () => {
  it('alpha > 0 の画素だけが 1 になる（デフォルト threshold）', () => {
    const rgba = new Uint8ClampedArray(3 * 1 * 4)
    rgba[0 * 4 + 3] = 0
    rgba[1 * 4 + 3] = 1
    rgba[2 * 4 + 3] = 255
    const mask = alphaMask(rgba, 3, 1)
    expect(Array.from(mask)).toEqual([0, 1, 1])
  })

  it('threshold 指定時は alpha > threshold で判定される', () => {
    const rgba = new Uint8ClampedArray(4 * 1 * 4)
    rgba[0 * 4 + 3] = 0
    rgba[1 * 4 + 3] = 100 // 境界値ちょうどは外側
    rgba[2 * 4 + 3] = 101
    rgba[3 * 4 + 3] = 255
    const mask = alphaMask(rgba, 4, 1, 100)
    expect(Array.from(mask)).toEqual([0, 0, 1, 1])
  })
})

describe('erodeMask', () => {
  it('矩形を 2px erosion すると四辺が 2px ずつ痩せる', () => {
    // 20×20 内の (4,4)〜(15,13) の 12×10 矩形
    const mask = makeRectMask(20, 20, 4, 4, 12, 10)
    const eroded = erodeMask(mask, 20, 20, 2)
    // 期待値: (6,6)〜(13,11) の 8×6 矩形（各辺 2px 減）
    const expected = makeRectMask(20, 20, 6, 6, 8, 6)
    expect(Array.from(eroded)).toEqual(Array.from(expected))
  })

  it('幅 5px の細い帯は radius 3 で消滅する', () => {
    // 30×30 の中央に高さ 5px の横帯
    const mask = makeRectMask(30, 30, 0, 10, 30, 5)
    const eroded = erodeMask(mask, 30, 30, 3)
    expect(maskArea(eroded)).toBe(0)
  })

  it('半径 r の円は radius e の erosion で半径ほぼ r-e の円になる（面積で近似検証）', () => {
    const r = 30
    const e = 5
    const mask = makeDiskMask(100, 100, 50, 50, r)
    const eroded = erodeMask(mask, 100, 100, e)
    const area = maskArea(eroded)
    const ideal = Math.PI * (r - e) * (r - e)
    // 離散化誤差を見込んで ±10% で検証
    // （Chebyshev 正方形 erosion だと斜めが √2 倍削れて大きく下振れするのでここで弾ける）
    expect(area).toBeGreaterThan(ideal * 0.9)
    expect(area).toBeLessThan(ideal * 1.1)
    // 中心は残り、元の縁は削れている
    expect(eroded[50 * 100 + 50]).toBe(1)
    expect(eroded[50 * 100 + (50 + r)]).toBe(0)
  })

  it('erosion 0px は恒等変換である', () => {
    const mask = makeDiskMask(40, 40, 20, 20, 12)
    // 画像端に接する領域も足しておく
    for (let x = 0; x < 5; x++) mask[x] = 1
    const eroded = erodeMask(mask, 40, 40, 0)
    expect(Array.from(eroded)).toEqual(Array.from(mask))
    // 別バッファが返ること（元マスクを破壊しない）
    expect(eroded).not.toBe(mask)
  })

  it('画像端に接する前景も端から痩せる（画像外は背景扱い）', () => {
    // 画像全面が前景の 10×10 を 2px erosion → 中央 6×6 が残る
    const mask = new Uint8Array(10 * 10).fill(1)
    const eroded = erodeMask(mask, 10, 10, 2)
    const expected = makeRectMask(10, 10, 2, 2, 6, 6)
    expect(Array.from(eroded)).toEqual(Array.from(expected))
  })
})

describe('maskToRgba', () => {
  it('mask=1 の画素のみ指定色で塗られ、他は完全透明になる', () => {
    const mask = new Uint8Array([0, 1, 0, 1])
    // 編集画面プレビュー想定の半透明水色
    const rgba = maskToRgba(mask, 2, 2, 64, 200, 255, 128)
    // mask=0 → 全チャンネル 0
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(rgba.slice(8, 12))).toEqual([0, 0, 0, 0])
    // mask=1 → 指定の RGBA
    expect(Array.from(rgba.slice(4, 8))).toEqual([64, 200, 255, 128])
    expect(Array.from(rgba.slice(12, 16))).toEqual([64, 200, 255, 128])
  })

  it('書き出し時の #000000・不透明塗りも表現できる', () => {
    const mask = new Uint8Array([1])
    const rgba = maskToRgba(mask, 1, 1, 0, 0, 0, 255)
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255])
  })
})
