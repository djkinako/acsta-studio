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

export interface GenerationParams {
  offsetMm: number
  roundMm: number
  tolMm: number
  minGapMm: number
  includeHoles: boolean
}

export interface SettingsState {
  paperPreset: string
  customPaper: PaperSize
  orientation: 'portrait' | 'landscape'
  margins: { top: number; right: number; bottom: number; left: number }
  dpi: number
  params: GenerationParams
  layerNames: { print: string; cut: string; white: string }
  setOrientation: (o: 'portrait' | 'landscape') => void
  setParam: <K extends keyof GenerationParams>(key: K, value: GenerationParams[K]) => void
  setDpi: (dpi: number) => void
  setPaperPreset: (preset: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      paperPreset: 'A4',
      customPaper: { w: 210, h: 297 },
      orientation: 'portrait',
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      dpi: 350,
      params: {
        offsetMm: 0.5,
        roundMm: 0.5,
        tolMm: 0.05,
        minGapMm: 4.0,
        includeHoles: false,
      },
      layerNames: { print: 'print', cut: 'cut', white: 'white' },
      setOrientation: (orientation) => set({ orientation }),
      setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
      setDpi: (dpi) => set({ dpi }),
      setPaperPreset: (paperPreset) => set({ paperPreset }),
    }),
    { name: 'acsta-settings' },
  ),
)

/** 向きを反映した用紙の実寸（mm） */
export function paperSizeOf(s: Pick<SettingsState, 'paperPreset' | 'customPaper' | 'orientation'>): PaperSize {
  const base = PAPER_PRESETS[s.paperPreset] ?? s.customPaper
  return s.orientation === 'portrait' ? base : { w: base.h, h: base.w }
}
