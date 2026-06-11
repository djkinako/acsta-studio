import { describe, expect, it } from 'vitest'
import { extractContours } from '../src/geometry/contour'
import { simplifyClosed } from '../src/geometry/simplify'
import {
  generateCutline,
  inflateForGapCheck,
  polygonsIntersect,
  unionPolygons,
} from '../src/geometry/offset'
import { signedArea, type Ring } from '../src/geometry/types'
import { effectiveDpi, mmToPx, pxToMm } from '../src/geometry/units'

/** w×h のRGBAバッファに矩形の不透明領域を描いたものを作る */
function makeAlphaRect(
  w: number,
  h: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(w * h * 4)
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      buf[(y * w + x) * 4 + 3] = 255
    }
  }
  return buf
}

function square(size: number, x0 = 0, y0 = 0): Ring {
  return [
    { x: x0, y: y0 },
    { x: x0 + size, y: y0 },
    { x: x0 + size, y: y0 + size },
    { x: x0, y: y0 + size },
  ]
}

describe('extractContours', () => {
  it('不透明の矩形から閉リングを1本検出する', () => {
    const buf = makeAlphaRect(10, 10, 3, 3, 4, 4)
    const rings = extractContours(buf, 10, 10)
    expect(rings).toHaveLength(1)
    // 4×4px の矩形 → 中点トレースで面積はほぼ16（角の面取り分だけ減る）
    const area = Math.abs(signedArea(rings[0]))
    expect(area).toBeGreaterThan(15)
    expect(area).toBeLessThanOrEqual(16)
  })

  it('離れた2つの矩形は2本のリングになる', () => {
    const buf = makeAlphaRect(20, 10, 2, 2, 4, 4)
    for (let y = 2; y < 6; y++)
      for (let x = 12; x < 16; x++) buf[(y * 20 + x) * 4 + 3] = 255
    const rings = extractContours(buf, 20, 10)
    expect(rings).toHaveLength(2)
  })

  it('ドーナツ形状は外周と穴の2本になる', () => {
    const buf = makeAlphaRect(20, 20, 2, 2, 16, 16)
    // 中央に透明の穴
    for (let y = 8; y < 12; y++)
      for (let x = 8; x < 12; x++) buf[(y * 20 + x) * 4 + 3] = 0
    const rings = extractContours(buf, 20, 20)
    expect(rings).toHaveLength(2)
    const areas = rings.map((r) => signedArea(r))
    // 外周と穴は回転方向（符号）が逆
    expect(Math.sign(areas[0]) * Math.sign(areas[1])).toBe(-1)
  })

  it('1pxのゴミは minAreaPx2 で除去される', () => {
    const buf = makeAlphaRect(10, 10, 2, 2, 5, 5)
    buf[(8 * 10 + 8) * 4 + 3] = 255 // 孤立1px
    const rings = extractContours(buf, 10, 10, 0, 2)
    expect(rings).toHaveLength(1)
  })
})

describe('simplifyClosed', () => {
  it('直線上の冗長点を除去しつつ面積を保つ', () => {
    // 0.5刻みの点が並ぶ 10×10 正方形リング
    const ring: Ring = []
    for (let x = 0; x <= 19; x++) ring.push({ x: x * 0.5, y: 0 })
    for (let y = 0; y <= 19; y++) ring.push({ x: 10, y: y * 0.5 })
    for (let x = 20; x > 0; x--) ring.push({ x: x * 0.5, y: 10 })
    for (let y = 20; y > 0; y--) ring.push({ x: 0, y: y * 0.5 })
    const out = simplifyClosed(ring, 0.05)
    expect(out.length).toBeLessThan(ring.length)
    expect(out.length).toBeGreaterThanOrEqual(4)
    expect(Math.abs(signedArea(out))).toBeCloseTo(100, 0)
  })
})

describe('generateCutline', () => {
  it('Roundオフセットで面積が 元+周長×δ+πδ² に近づく', () => {
    const cut = generateCutline([square(10)], { offsetMm: 1, roundRadiusMm: 0 })
    expect(cut).toHaveLength(1)
    const area = Math.abs(signedArea(cut[0]))
    // 100 + 40×1 + π×1² ≈ 143.14（円弧近似で僅かに小さくなる）
    expect(area).toBeGreaterThan(141)
    expect(area).toBeLessThan(144)
  })

  it('凸形状ではクロージング（角丸め）が面積をほぼ変えない', () => {
    const plain = generateCutline([square(10)], { offsetMm: 0.5, roundRadiusMm: 0 })
    const closed = generateCutline([square(10)], { offsetMm: 0.5, roundRadiusMm: 0.5 })
    const a1 = Math.abs(signedArea(plain[0]))
    const a2 = Math.abs(signedArea(closed[0]))
    expect(Math.abs(a1 - a2) / a1).toBeLessThan(0.02)
  })

  it('狭い凹みがクロージングで埋まる', () => {
    // 幅0.4mmのスリットが入ったコの字形（角丸め0.5mmで埋まるはず）
    const cShape: Ring = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5.2, y: 10 },
      { x: 5.2, y: 3 },
      { x: 4.8, y: 3 },
      { x: 4.8, y: 10 },
      { x: 0, y: 10 },
    ]
    const noClose = generateCutline([cShape], { offsetMm: 0.1, roundRadiusMm: 0 })
    const withClose = generateCutline([cShape], { offsetMm: 0.1, roundRadiusMm: 0.8 })
    const areaNo = noClose.reduce((s, r) => s + Math.abs(signedArea(r)), 0)
    const areaYes = withClose.reduce((s, r) => s + Math.abs(signedArea(r)), 0)
    // オフセット0.1mm後のスリットは幅0.2mm×深さ約7mm ≈ 1.4mm²。
    // クロージングでこれがほぼ全部埋まる
    expect(areaYes - areaNo).toBeGreaterThan(1.2)
  })

  it('重なった2輪郭はunionされて1本になる', () => {
    const cut = generateCutline([square(10), square(10, 5, 5)], {
      offsetMm: 0.5,
      roundRadiusMm: 0,
    })
    expect(cut).toHaveLength(1)
  })

  it('なめらか補正で凸側のガタつきが除去される（角丸めだけでは残る）', () => {
    // 10mm四方の右辺に高さ0.8mm・幅0.4mmのトゲ（凸ノイズ）を3本生やす
    const noisy: Ring = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      ...[2, 5, 8].flatMap((y) => [
        { x: 10, y: y - 0.2 },
        { x: 10.8, y },
        { x: 10, y: y + 0.2 },
      ]),
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const perimeter = (polys: Ring[]) =>
      polys.reduce((sum, ring) => {
        let p = 0
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i]
          const b = ring[(i + 1) % ring.length]
          p += Math.hypot(b.x - a.x, b.y - a.y)
        }
        return sum + p
      }, 0)
    const bumpy = generateCutline([noisy], { offsetMm: 0.5, roundRadiusMm: 0.5 })
    const smooth = generateCutline([noisy], { offsetMm: 0.5, roundRadiusMm: 0.5, smoothMm: 0.6 })
    // トゲの出っ張り跡が削れて、輪郭長も面積も減る
    expect(perimeter(smooth)).toBeLessThan(perimeter(bumpy) - 1)
    const areaOf = (polys: Ring[]) => polys.reduce((s, r) => s + Math.abs(signedArea(r)), 0)
    expect(areaOf(smooth)).toBeLessThan(areaOf(bumpy))
  })

  it('なめらか補正は絶対防衛ライン（元輪郭+offset×0.2）より内側に入らない', () => {
    // 極端な補正量でも、生の輪郭+offset×0.2 のフロアを面積で下回らない
    const aggressive = generateCutline([square(10)], {
      offsetMm: 0.5,
      roundRadiusMm: 0,
      smoothMm: 2,
    })
    const hardFloor = generateCutline([square(10)], { offsetMm: 0.1, roundRadiusMm: 0 })
    const areaOf = (polys: Ring[]) => polys.reduce((s, r) => s + Math.abs(signedArea(r)), 0)
    expect(areaOf(aggressive)).toBeGreaterThanOrEqual(areaOf(hardFloor) - 0.1)
  })

  it('外周のみモードでは穴が除去され、穴も含むモードでは残る', () => {
    const outer = square(20)
    const hole = square(6, 7, 7).reverse() // 逆回転 = 穴
    const onlyOuter = generateCutline([outer, hole], { offsetMm: 0.3, roundRadiusMm: 0 })
    expect(onlyOuter).toHaveLength(1)
    const withHoles = generateCutline([outer, hole], {
      offsetMm: 0.3,
      roundRadiusMm: 0,
      includeHoles: true,
    })
    expect(withHoles).toHaveLength(2)
  })
})

describe('間隔チェック', () => {
  it('4mm未満に近づいたペアだけ交差判定になる', () => {
    const a = inflateForGapCheck([square(10)], 4)
    const near = inflateForGapCheck([square(10, 13, 0)], 4) // ギャップ3mm → 違反
    const far = inflateForGapCheck([square(10, 15, 0)], 4) // ギャップ5mm → OK
    expect(polygonsIntersect(a, near)).toBe(true)
    expect(polygonsIntersect(a, far)).toBe(false)
  })
})

describe('unionPolygons（タブ合体）', () => {
  it('本体とタブが1本のカットラインに結合される', () => {
    const body = square(20)
    const tab = square(6, 7, 18) // 下辺にまたがるタブ
    const merged = unionPolygons([body], [tab])
    expect(merged).toHaveLength(1)
    const area = Math.abs(signedArea(merged[0]))
    expect(area).toBeCloseTo(400 + 6 * 4, 0) // 重なり2mm分を除いたタブ寄与
  })
})

describe('units', () => {
  it('mm↔px変換が可逆', () => {
    expect(mmToPx(25.4, 350)).toBeCloseTo(350)
    expect(pxToMm(mmToPx(123.4, 350), 350)).toBeCloseTo(123.4)
  })
  it('実効DPI計算', () => {
    // 700pxの画像を50.8mm（2インチ）で配置 → 350dpi
    expect(effectiveDpi(700, 50.8)).toBeCloseTo(350)
  })
})
