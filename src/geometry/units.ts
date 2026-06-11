/** mm ↔ px 変換（SPEC 3: px = mm ÷ 25.4 × dpi。px化はここを通す） */
export const MM_PER_INCH = 25.4

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH
}

/** 画像の元解像度と配置サイズから実効DPIを求める（SPEC 6.1: 警告表示用） */
export function effectiveDpi(imageWidthPx: number, placedWidthMm: number): number {
  return imageWidthPx / (placedWidthMm / MM_PER_INCH)
}
