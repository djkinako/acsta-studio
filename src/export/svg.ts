import { ringsToSvgPath } from '../geometry/offset'
import type { ExportModel, ExportObjectModel } from './model'

/**
 * SVG書き出しビルダー（SPEC 7.2 サブ形式）。
 * 3つの名前付き <g>（グループ名 = ユーザー設定のレイヤー名）で構成する単一SVGを生成する。
 * グループ順は print（カラー版）→ cut（カットライン）→ white（白版）。
 * Illustrator 側でのレイヤー化は同梱の .jsx（jsxScript.ts）が担当する。
 */

/** XML属性値用エスケープ（レイヤー名・色指定などユーザー入力を安全に埋め込む） */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** mm数値の整形（小数3桁まで、末尾ゼロと不要な小数点は省く） */
function fmt(n: number): string {
  const s = n.toFixed(3).replace(/\.?0+$/, '')
  return s === '' || s === '-' ? '0' : s
}

/**
 * 画像1枚分の <image> 要素。
 * 配置中心 (x, y) mm へ translate → rot 度回転、画像本体はローカル座標
 * （中心原点・回転前）で左上 (imageOffsetX, imageOffsetY) から
 * imageWidthMm × imageHeightMm の矩形に描画する。
 * href と xlink:href の両方に dataURL を出す（Illustrator 互換のため）。
 */
function imageTag(obj: ExportObjectModel, url: string): string {
  const transform = `translate(${fmt(obj.x)} ${fmt(obj.y)}) rotate(${fmt(obj.rot)})`
  const href = escapeXml(url)
  return (
    `    <image transform="${transform}"` +
    ` x="${fmt(obj.imageOffsetX)}" y="${fmt(obj.imageOffsetY)}"` +
    ` width="${fmt(obj.imageWidthMm)}" height="${fmt(obj.imageHeightMm)}"` +
    ` preserveAspectRatio="none" href="${href}" xlink:href="${href}"/>`
  )
}

/** ExportModel から完全なSVG文字列を組み立てる（mm実寸、viewBox単位 = mm） */
export function buildExportSvg(model: ExportModel): string {
  const { paperW, paperH, layerNames, cutColor, cutStrokeMm, objects } = model
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
      ` width="${fmt(paperW)}mm" height="${fmt(paperH)}mm" viewBox="0 0 ${fmt(paperW)} ${fmt(paperH)}">`,
  )

  // print: カラー版ラスター（dataURL埋め込み）
  lines.push(`  <g id="${escapeXml(layerNames.print)}">`)
  for (const obj of objects) {
    lines.push(imageTag(obj, obj.printUrl))
  }
  lines.push('  </g>')

  // cut: カットライン（ベクターパス。塗りなし・指定色ストローク・線幅mm）
  lines.push(`  <g id="${escapeXml(layerNames.cut)}">`)
  for (const obj of objects) {
    const d = ringsToSvgPath(obj.cutline)
    if (d === '') continue
    lines.push(
      `    <path d="${d}" fill="none" stroke="${escapeXml(cutColor)}" stroke-width="${fmt(cutStrokeMm)}"/>`,
    )
  }
  lines.push('  </g>')

  // white: 白版ラスター（#000塗りPNGが渡ってくる前提。色操作はしない）
  // whiteUrl を持つオブジェクトのみ含める
  lines.push(`  <g id="${escapeXml(layerNames.white)}">`)
  for (const obj of objects) {
    if (obj.whiteUrl === null) continue
    lines.push(imageTag(obj, obj.whiteUrl))
  }
  lines.push('  </g>')

  lines.push('</svg>')
  return lines.join('\n')
}
