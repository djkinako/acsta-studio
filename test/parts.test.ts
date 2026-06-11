import { describe, expect, it } from 'vitest'
import { KEYRING_DEFS, STAND_DEFS, TAB_DEFS, keyringRings, standMinWidth, standRings, tabRing } from '../src/parts/defs'
import { attachmentPolygonsAt, largestRing, nearestParamOnRing, poseOnRing } from '../src/parts/attach'
import { unionPolygons } from '../src/geometry/offset'
import { bboxOf } from '../src/geometry/transform'
import { signedArea, type Ring } from '../src/geometry/types'

/** 時計回り（screen座標系・signedArea>0）の正方形 */
function squareCW(size: number, x0 = 0, y0 = 0): Ring {
  return [
    { x: x0, y: y0 },
    { x: x0 + size, y: y0 },
    { x: x0 + size, y: y0 + size },
    { x: x0, y: y0 + size },
  ]
}

describe('パーツ定義形状', () => {
  it('タブの形状寸法（幅・突き出し・本体への食い込み）', () => {
    const def = TAB_DEFS.M
    const bbox = bboxOf([tabRing(def)])
    expect(bbox.maxX - bbox.minX).toBeCloseTo(def.widthMm, 5)
    expect(bbox.maxY).toBeCloseTo(def.heightMm, 5)
    expect(bbox.minY).toBeCloseTo(-2, 5) // union を確実に繋ぐ食い込み
  })

  it('台座は外周＋穴の2リングで回転方向が逆', () => {
    const rings = standRings(STAND_DEFS.M)
    expect(rings).toHaveLength(2)
    const outerBox = bboxOf([rings[0]])
    expect(outerBox.maxX - outerBox.minX).toBeCloseTo(STAND_DEFS.M.widthMm, 1)
    expect(outerBox.maxY - outerBox.minY).toBeCloseTo(STAND_DEFS.M.heightMm, 1)
    expect(Math.sign(signedArea(rings[0])) * Math.sign(signedArea(rings[1]))).toBe(-1)
    const holeBox = bboxOf([rings[1]])
    expect(holeBox.maxX - holeBox.minX).toBeCloseTo(STAND_DEFS.M.holeWmm, 1)
  })
})

describe('タブ吸着計算', () => {
  it('輪郭上の位置と外向き法線（時計回りリング）', () => {
    const ring = squareCW(10)
    // 周長40。t=0.125 → 上辺の中央 (5,0)、外向き法線は上 (0,-1)
    const pose = poseOnRing(ring, 0.125)
    expect(pose.point.x).toBeCloseTo(5)
    expect(pose.point.y).toBeCloseTo(0)
    expect(pose.normal.x).toBeCloseTo(0)
    expect(pose.normal.y).toBeCloseTo(-1)
    // t=0.375 → 右辺の中央 (10,5)、外向き法線は右 (1,0)
    const right = poseOnRing(ring, 0.375)
    expect(right.point.x).toBeCloseTo(10)
    expect(right.normal.x).toBeCloseTo(1)
  })

  it('最近接点パラメータが位置と往復一致する', () => {
    const ring = squareCW(10)
    const near = nearestParamOnRing(ring, { x: 5, y: -3 })
    expect(near.t).toBeCloseTo(0.125, 3)
    expect(near.distance).toBeCloseTo(3, 5)
  })

  it('タブを下辺に置くと本体と union で1本に繋がり面積が増える', () => {
    const body = [squareCW(20)]
    // t=0.625 → 下辺の中央 (10,20)、法線は下 (0,1)
    const { polygons, pose } = attachmentPolygonsAt(body[0], 0.625, 'M')
    expect(pose.normal.y).toBeCloseTo(1)
    const merged = unionPolygons(body, polygons)
    expect(merged).toHaveLength(1)
    const areaBody = Math.abs(signedArea(body[0]))
    const areaMerged = Math.abs(signedArea(merged[0]))
    // タブの突き出し分（約 幅10×高6 − 角丸め）だけ増える
    expect(areaMerged - areaBody).toBeGreaterThan(40)
    expect(areaMerged - areaBody).toBeLessThan(62)
  })

  it('largestRing は外周を返す', () => {
    const rings = standRings(STAND_DEFS.S)
    const outer = largestRing(rings)
    expect(outer).toBe(rings[0])
  })
})

describe('アクキーポッチと台座スケール', () => {
  it('穴付きポッチは外周＋首＋穴（逆回転）で構成され、穴径が定義どおり', () => {
    const rings = keyringRings(KEYRING_DEFS.K3)
    expect(rings).toHaveLength(3)
    const hole = rings[2]
    expect(signedArea(hole)).toBeLessThan(0) // 外周(時計回り=正)と逆 = 穴
    const box = bboxOf([hole])
    expect(box.maxX - box.minX).toBeCloseTo(3, 1)
  })

  it('本体にポッチを union しても穴が残る', () => {
    const body = [squareCW(20)]
    const { polygons } = attachmentPolygonsAt(body[0], 0.125, 'K5')
    const merged = unionPolygons(body, polygons)
    // 外周1 + 穴1
    expect(merged.length).toBe(2)
    const holes = merged.filter((r) => Math.abs(signedArea(r)) < 30)
    expect(holes).toHaveLength(1)
    const holeBox = bboxOf([holes[0]])
    expect(holeBox.maxX - holeBox.minX).toBeCloseTo(5, 1)
  })

  it('台座は外形をスケールしても穴の寸法は固定', () => {
    const def = STAND_DEFS.M
    const scaled = standRings(def, 90) // 60mm → 90mm に拡大
    const outerBox = bboxOf([scaled[0]])
    expect(outerBox.maxX - outerBox.minX).toBeCloseTo(90, 1)
    expect(outerBox.maxY - outerBox.minY).toBeCloseTo(def.heightMm * 1.5, 1)
    const holeBox = bboxOf([scaled[1]])
    expect(holeBox.maxX - holeBox.minX).toBeCloseTo(def.holeWmm, 2)
    expect(holeBox.maxY - holeBox.minY).toBeCloseTo(def.holeHmm, 2)
  })

  it('standMinWidth は穴幅より大きい', () => {
    expect(standMinWidth(STAND_DEFS.S)).toBeGreaterThan(STAND_DEFS.S.holeWmm)
  })
})
