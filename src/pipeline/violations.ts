import { polygonsIntersect } from '../geometry/offset'
import { allInsideRect, bboxNear, bboxOf, type Rect } from '../geometry/transform'
import type { Polygons } from '../geometry/types'

export interface WorldObject {
  id: string
  /** ワールドmm座標のカットライン */
  cutline: Polygons
  /** ワールドmm座標の間隔チェック用膨張ポリゴン */
  gapPoly: Polygons
}

export interface ViolationResult {
  /** 間隔違反ペア（id昇順） */
  pairs: Array<[string, string]>
  /** マージン侵食したオブジェクトid */
  marginIds: string[]
  /** 違反に関与している全id（赤表示用） */
  violatingIds: Set<string>
}

/**
 * 間隔チェック（SPEC 6.3）。
 * 膨張ポリゴン同士の交差 = カットライン間が最小間隔未満。
 * bbox事前フィルタ → Clipperの厳密交差判定の2段構え。
 */
export function checkViolations(objects: WorldObject[], marginRect: Rect): ViolationResult {
  const pairs: Array<[string, string]> = []
  const marginIds: string[] = []
  const bboxes = objects.map((o) => bboxOf(o.gapPoly))

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      if (!bboxNear(bboxes[i], bboxes[j])) continue
      if (polygonsIntersect(objects[i].gapPoly, objects[j].gapPoly)) {
        pairs.push([objects[i].id, objects[j].id])
      }
    }
    if (!allInsideRect(objects[i].cutline, marginRect)) {
      marginIds.push(objects[i].id)
    }
  }

  const violatingIds = new Set<string>(marginIds)
  for (const [a, b] of pairs) {
    violatingIds.add(a)
    violatingIds.add(b)
  }
  return { pairs, marginIds, violatingIds }
}
