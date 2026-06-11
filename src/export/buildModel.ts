import { getWhiteUrls } from '../pipeline/sources'
import type { ObjectView } from '../components/EditorApp'
import type { ExportModel } from './model'

export interface BuildModelOptions {
  paperW: number
  paperH: number
  dpi: number
  layerNames: { print: string; cut: string; white: string }
  cutColor: string
  whiteShrinkPx: number
}

/** エディタの表示状態（ObjectView）から書き出し用の中間モデルを組み立てる */
export function buildExportModel(views: ObjectView[], opts: BuildModelOptions): ExportModel {
  return {
    paperW: opts.paperW,
    paperH: opts.paperH,
    dpi: opts.dpi,
    layerNames: opts.layerNames,
    cutColor: opts.cutColor,
    cutStrokeMm: 0.1,
    objects: views.map((v) => ({
      // 台座などカットのみのパーツは printUrl/whiteUrl とも null
      printUrl: v.source?.url ?? null,
      whiteUrl: v.source ? (getWhiteUrls(v.source.id, opts.whiteShrinkPx)?.exportUrl ?? null) : null,
      x: v.obj.x,
      y: v.obj.y,
      rot: v.obj.rot,
      imageWidthMm: v.geo.imageWidthMm,
      imageHeightMm: v.geo.imageHeightMm,
      imageOffsetX: v.geo.imageOffsetX,
      imageOffsetY: v.geo.imageOffsetY,
      cutline: v.worldCutline,
    })),
  }
}
