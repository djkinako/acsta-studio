import { extractContours } from '../geometry/contour'
import { simplifyClosed } from '../geometry/simplify'
import { bboxOf } from '../geometry/transform'
import { generateCutline, inflateForGapCheck } from '../geometry/offset'
import { alphaMask, erodeMask, maskToRgba } from '../geometry/erosion'
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
  /**
   * 不透明領域のバウンディングボックス（px）。
   * オブジェクトの「幅」「サイズ」「実効DPI」はすべて透明余白を除いた
   * この領域を基準にする（きなこフィードバック 2026-06-11）。
   */
  trimBBox: { minX: number; minY: number; maxX: number; maxY: number }
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
  const contoursPx = extractContours(data.data, bitmap.width, bitmap.height, 0)
  const trimBBox = bboxOf(contoursPx)
  const source: SourceImage = {
    id: `src${nextSourceId++}`,
    name,
    url: canvas.toDataURL('image/png'),
    widthPx: bitmap.width,
    heightPx: bitmap.height,
    rgba: data.data,
    contoursPx,
    trimBBox:
      contoursPx.length > 0
        ? trimBBox
        : { minX: 0, minY: 0, maxX: bitmap.width, maxY: bitmap.height },
  }
  sources.set(source.id, source)
  return source
}

/** 不透明領域の幅（px） */
export function trimWidthPx(source: SourceImage): number {
  return source.trimBBox.maxX - source.trimBBox.minX
}

/** オブジェクトのローカル幾何（不透明領域の中心を原点としたmm座標）。キャッシュ付き */
export interface ObjectGeometry {
  /** 簡略化済み輪郭（表示・最短距離計算用） */
  contour: Polygons
  /** カットライン */
  cutline: Polygons
  /** 間隔チェック用（カットラインを minGap/2 膨張） */
  gapPoly: Polygons
  /** 不透明領域の高さ（mm）。widthMm と対になる */
  heightMm: number
  /** 透明余白込みのPNG全体の描画サイズ（mm） */
  imageWidthMm: number
  imageHeightMm: number
  /** ローカル座標での画像左上のオフセット（mm） */
  imageOffsetX: number
  imageOffsetY: number
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

  // 「幅」は不透明領域基準（透明余白は含まない）
  const trim = source.trimBBox
  const trimW = trim.maxX - trim.minX
  const scale = widthMm / trimW
  const heightMm = (trim.maxY - trim.minY) * scale
  // px → mm ＋ 不透明領域の中心を原点へシフト
  const cx = ((trim.minX + trim.maxX) / 2) * scale
  const cy = ((trim.minY + trim.maxY) / 2) * scale
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
  const geometry: ObjectGeometry = {
    contour,
    cutline,
    gapPoly,
    heightMm,
    imageWidthMm: source.widthPx * scale,
    imageHeightMm: source.heightPx * scale,
    imageOffsetX: -cx,
    imageOffsetY: -cy,
  }

  // キャッシュ肥大防止（パラメータ連続変更対策）
  if (geomCache.size > 200) geomCache.clear()
  geomCache.set(key, geometry)
  return geometry
}

/** 白版のレンダリング用URL（編集画面の水色可視化と書き出しの#000塗り） */
export interface WhiteUrls {
  /** 編集画面用: 半透明の水色（SPEC 7.1） */
  visUrl: string
  /** 書き出し用: #000000 不透明 */
  exportUrl: string
}

const whiteCache = new Map<string, WhiteUrls>()

function rgbaToDataUrl(rgba: Uint8ClampedArray, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // ImageData は ArrayBuffer 裏付けの配列を要求するためコピーで包む
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * 白版URLを生成する（erosion はソース解像度のpx基準）。
 * (sourceId, shrinkPx) ごとにキャッシュ。
 */
export function getWhiteUrls(sourceId: string, shrinkPx: number): WhiteUrls | null {
  const source = sources.get(sourceId)
  if (!source) return null
  const key = `${sourceId}|${shrinkPx}`
  const cached = whiteCache.get(key)
  if (cached) return cached

  const { widthPx: w, heightPx: h } = source
  const mask = erodeMask(alphaMask(source.rgba, w, h), w, h, shrinkPx)
  const urls: WhiteUrls = {
    visUrl: rgbaToDataUrl(maskToRgba(mask, w, h, 125, 205, 230, 115), w, h),
    exportUrl: rgbaToDataUrl(maskToRgba(mask, w, h, 0, 0, 0, 255), w, h),
  }
  if (whiteCache.size > 50) whiteCache.clear()
  whiteCache.set(key, urls)
  return urls
}
