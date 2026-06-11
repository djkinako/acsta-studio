import { extractContours } from '../geometry/contour'
import { simplifyClosed } from '../geometry/simplify'
import { generateCutline, inflateForGapCheck } from '../geometry/offset'
import type { Polygons, Ring } from '../geometry/types'
import type { GenerationParams } from '../stores/settings'

/**
 * 読み込んだ元画像のレジストリ（Reactのストア外で保持）。
 * rgba（ImageData）と輪郭は画像1枚につき1回だけ計算し、
 * 複製・パラメータ変更時はここのキャッシュで再利用する（SPEC 6.2）。
 */
export interface SourceImage {
  id: string
  name: string
  url: string
  widthPx: number
  heightPx: number
  rgba: Uint8ClampedArray
  /** alpha>0 で抽出した輪郭（px座標） */
  contoursPx: Ring[]
}

const sources = new Map<string, SourceImage>()
let nextSourceId = 1

export function getSource(id: string): SourceImage | undefined {
  return sources.get(id)
}

export async function importPng(blob: Blob, name: string): Promise<SourceImage> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  const source: SourceImage = {
    id: `src${nextSourceId++}`,
    name,
    url: canvas.toDataURL('image/png'),
    widthPx: bitmap.width,
    heightPx: bitmap.height,
    rgba: data.data,
    contoursPx: extractContours(data.data, bitmap.width, bitmap.height, 0),
  }
  sources.set(source.id, source)
  return source
}

/** オブジェクトのローカル幾何（中心原点のmm座標）。キャッシュ付き */
export interface ObjectGeometry {
  /** 簡略化済み輪郭（表示・最短距離計算用） */
  contour: Polygons
  /** カットライン */
  cutline: Polygons
  /** 間隔チェック用（カットラインを minGap/2 膨張） */
  gapPoly: Polygons
  heightMm: number
}

const geomCache = new Map<string, ObjectGeometry>()

export function getObjectGeometry(
  sourceId: string,
  widthMm: number,
  params: GenerationParams,
): ObjectGeometry | null {
  const source = sources.get(sourceId)
  if (!source) return null
  const key = [
    sourceId,
    widthMm.toFixed(3),
    params.offsetMm,
    params.roundMm,
    params.tolMm,
    params.minGapMm,
    params.includeHoles,
  ].join('|')
  const cached = geomCache.get(key)
  if (cached) return cached

  const scale = widthMm / source.widthPx
  const heightMm = source.heightPx * scale
  // px → mm ＋ 中心原点へシフト
  const cx = widthMm / 2
  const cy = heightMm / 2
  const contoursMm = source.contoursPx.map((ring) =>
    ring.map((p) => ({ x: p.x * scale - cx, y: p.y * scale - cy })),
  )
  const contour = contoursMm.map((ring) => simplifyClosed(ring, params.tolMm))
  const cutline = generateCutline(contour, {
    offsetMm: params.offsetMm,
    roundRadiusMm: params.roundMm,
    includeHoles: params.includeHoles,
  })
  const gapPoly = inflateForGapCheck(cutline, params.minGapMm)
  const geometry: ObjectGeometry = { contour, cutline, gapPoly, heightMm }

  // キャッシュ肥大防止（パラメータ連続変更対策）
  if (geomCache.size > 200) geomCache.clear()
  geomCache.set(key, geometry)
  return geometry
}
