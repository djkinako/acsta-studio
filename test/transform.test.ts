import { describe, expect, it } from 'vitest'
import {
  allInsideRect,
  bboxNear,
  bboxOf,
  minDistanceBetween,
  transformRings,
} from '../src/geometry/transform'
import { checkViolations } from '../src/pipeline/violations'
import { inflateForGapCheck } from '../src/geometry/offset'
import type { Ring } from '../src/geometry/types'

function square(size: number, x0 = 0, y0 = 0): Ring {
  return [
    { x: x0, y: y0 },
    { x: x0 + size, y: y0 },
    { x: x0 + size, y: y0 + size },
    { x: x0, y: y0 + size },
  ]
}

/** 中心原点の正方形（ローカル座標想定） */
function centeredSquare(half: number): Ring {
  return [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ]
}

describe('transformRings', () => {
  it('平行移動', () => {
    const out = transformRings([centeredSquare(5)], 100, 50, 0)
    expect(out[0][0]).toEqual({ x: 95, y: 45 })
    expect(out[0][2]).toEqual({ x: 105, y: 55 })
  })

  it('90度回転で頂点が入れ替わる', () => {
    const out = transformRings([[{ x: 10, y: 0 }]], 0, 0, 90)
    expect(out[0][0].x).toBeCloseTo(0)
    expect(out[0][0].y).toBeCloseTo(10)
  })
})

describe('bbox', () => {
  it('bboxOf と bboxNear', () => {
    const a = bboxOf([square(10)])
    const b = bboxOf([square(10, 15, 0)])
    expect(a).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    expect(bboxNear(a, b)).toBe(false)
    expect(bboxNear(a, b, 6)).toBe(true)
  })
})

describe('allInsideRect', () => {
  it('マージン内判定', () => {
    const rect = { minX: 5, minY: 5, maxX: 205, maxY: 292 }
    expect(allInsideRect([square(10, 10, 10)], rect)).toBe(true)
    expect(allInsideRect([square(10, 0, 10)], rect)).toBe(false)
  })
})

describe('minDistanceBetween', () => {
  it('離れた正方形同士の最短距離', () => {
    const { distance } = minDistanceBetween([square(10)], [square(10, 13, 0)])
    expect(distance).toBeCloseTo(3, 5)
  })

  it('頂点ではなく辺が最近接になるケース', () => {
    // 上の正方形の右辺中央 vs 右の正方形の左辺
    const { distance, pa, pb } = minDistanceBetween([square(10)], [square(2, 14, 4)])
    expect(distance).toBeCloseTo(4, 5)
    expect(pa.x).toBeCloseTo(10)
    expect(pb.x).toBeCloseTo(14)
  })
})

describe('checkViolations', () => {
  const marginRect = { minX: 5, minY: 5, maxX: 205, maxY: 292 }
  const makeWorldObject = (id: string, x0: number, y0: number) => {
    const cutline = [square(20, x0, y0)]
    return { id, cutline, gapPoly: inflateForGapCheck(cutline, 4) }
  }

  it('4mm未満のペアを違反として検出', () => {
    const a = makeWorldObject('a', 10, 10)
    const near = makeWorldObject('near', 33, 10) // ギャップ3mm
    const far = makeWorldObject('far', 60, 10) // ギャップ30mm
    const result = checkViolations([a, near, far], marginRect)
    expect(result.pairs).toEqual([['a', 'near']])
    expect(result.violatingIds.has('far')).toBe(false)
  })

  it('マージン侵食を検出', () => {
    const out = makeWorldObject('out', 2, 10) // 左マージン(5mm)を侵食
    const result = checkViolations([out], marginRect)
    expect(result.marginIds).toEqual(['out'])
    expect(result.violatingIds.has('out')).toBe(true)
  })
})
