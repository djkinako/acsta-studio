import { create } from 'zustand'

/** 高頻度更新される表示用状態（Footer等の局所再レンダーに留めるため分離） */
interface UiState {
  cursorMm: { x: number; y: number } | null
  zoomPct: number
  /** ドラッグ操作中（違反距離バッジの計算を止める） */
  interacting: boolean
  layerVisible: { print: boolean; cut: boolean; white: boolean }
  setCursor: (p: { x: number; y: number } | null) => void
  setZoomPct: (z: number) => void
  setInteracting: (v: boolean) => void
  toggleLayer: (layer: 'print' | 'cut' | 'white') => void
}

export const useUi = create<UiState>((set) => ({
  cursorMm: null,
  zoomPct: 100,
  interacting: false,
  layerVisible: { print: true, cut: true, white: false },
  setCursor: (cursorMm) => set({ cursorMm }),
  setZoomPct: (zoomPct) => set({ zoomPct }),
  setInteracting: (interacting) => set({ interacting }),
  toggleLayer: (layer) =>
    set((s) => ({ layerVisible: { ...s.layerVisible, [layer]: !s.layerVisible[layer] } })),
}))
