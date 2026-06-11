import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PaperSize {
  w: number
  h: number
}

export const PAPER_PRESETS: Record<string, PaperSize> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  B4: { w: 257, h: 364 },
  B5: { w: 182, h: 257 },
}

export const DPI_PRESETS = [300, 350, 400]

export interface GenerationParams {
  offsetMm: number
  roundMm: number
  tolMm: number
  minGapMm: number
  /** 白版の縮小量（px、元画像解像度基準） */
  whiteShrinkPx: number
  includeHoles: boolean
}

const DEFAULT_PARAMS: GenerationParams = {
  offsetMm: 0.5,
  roundMm: 0.5,
  tolMm: 0.05,
  minGapMm: 4.0,
  whiteShrinkPx: 2,
  includeHoles: false,
}

export interface SettingsState {
  paperPreset: string
  customPaper: PaperSize
  orientation: 'portrait' | 'landscape'
  margins: { top: number; right: number; bottom: number; left: number }
  dpi: number
  params: GenerationParams
  layerNames: { print: string; cut: string; white: string }
  /** カットラインの書き出し色 */
  cutColor: string
  setOrientation: (o: 'portrait' | 'landscape') => void
  setParam: <K extends keyof GenerationParams>(key: K, value: GenerationParams[K]) => void
  setDpi: (dpi: number) => void
  setPaperPreset: (preset: string) => void
  setCustomPaper: (paper: PaperSize) => void
  setMargin: (side: 'top' | 'right' | 'bottom' | 'left', value: number) => void
  setLayerName: (layer: 'print' | 'cut' | 'white', name: string) => void
  setCutColor: (color: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      paperPreset: 'A4',
      customPaper: { w: 210, h: 297 },
      orientation: 'portrait',
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      dpi: 350,
      params: { ...DEFAULT_PARAMS },
      layerNames: { print: 'print', cut: 'cut', white: 'white' },
      cutColor: '#00B4D8',
      setOrientation: (orientation) => set({ orientation }),
      setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
      setDpi: (dpi) => set({ dpi }),
      setPaperPreset: (paperPreset) => set({ paperPreset }),
      setCustomPaper: (customPaper) => set({ customPaper }),
      setMargin: (side, value) =>
        set((s) => ({ margins: { ...s.margins, [side]: Math.max(0, Math.min(20, value)) } })),
      setLayerName: (layer, name) =>
        set((s) => ({ layerNames: { ...s.layerNames, [layer]: name } })),
      setCutColor: (cutColor) => set({ cutColor }),
    }),
    {
      name: 'acsta-settings',
      version: 1,
      // 旧バージョンの保存データに新パラメータのデフォルトを補完
      migrate: (persisted) => {
        const s = persisted as Partial<SettingsState>
        return {
          ...s,
          params: { ...DEFAULT_PARAMS, ...(s.params ?? {}) },
          cutColor: s.cutColor ?? '#00B4D8',
          layerNames: s.layerNames ?? { print: 'print', cut: 'cut', white: 'white' },
        } as SettingsState
      },
    },
  ),
)

/** 向きを反映した用紙の実寸（mm） */
export function paperSizeOf(
  s: Pick<SettingsState, 'paperPreset' | 'customPaper' | 'orientation'>,
): PaperSize {
  const base = PAPER_PRESETS[s.paperPreset] ?? s.customPaper
  return s.orientation === 'portrait' ? base : { w: base.h, h: base.w }
}
