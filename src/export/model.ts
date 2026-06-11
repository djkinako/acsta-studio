import type { Polygons } from '../geometry/types'

/**
 * 書き出し用の中間モデル。
 * UI層（stores/pipeline）から組み立てて、SVG/PDFビルダーに渡す。
 * ビルダー側はこのモデルだけに依存し、ストアやDOMを参照しない。
 */
export interface ExportObjectModel {
  /** カラー版PNG（dataURL）。null = カットのみのパーツ（台座など） */
  printUrl: string | null
  /** 白版PNG（#000塗り・透過、dataURL）。null = 白版なし */
  whiteUrl: string | null
  /** 配置中心（ワールドmm） */
  x: number
  /** 配置中心（ワールドmm） */
  y: number
  /** 回転（deg、時計回り） */
  rot: number
  /** 画像全体の描画サイズ（mm）。透明余白を含むPNG全体 */
  imageWidthMm: number
  imageHeightMm: number
  /** ローカル座標（中心原点・回転前）での画像左上のオフセット（mm） */
  imageOffsetX: number
  imageOffsetY: number
  /** ワールドmm座標のカットライン */
  cutline: Polygons
}

export interface ExportModel {
  /** 用紙サイズ（mm） */
  paperW: number
  paperH: number
  /** ラスター出力解像度 */
  dpi: number
  /** 書き出しレイヤー名（入稿先指定） */
  layerNames: { print: string; cut: string; white: string }
  /** カットライン色（CSSカラー、デフォルトはシアン #00B4D8） */
  cutColor: string
  /** カットライン線幅（mm、デフォルト0.1） */
  cutStrokeMm: number
  objects: ExportObjectModel[]
}
