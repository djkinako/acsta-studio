import { create } from 'zustand'
import type { AttachmentId, PartSize } from '../parts/defs'

/** 画像オブジェクトに吸着したパーツ（タブ・穴付きポッチ）。位置は輪郭上の弧長パラメータ */
export interface PlacedTab {
  size: AttachmentId
  /** 輪郭上の位置 t ∈ [0,1) */
  t: number
  /** タブの長さ（mm）。省略時はパーツ定義のデフォルト */
  lengthMm?: number
}

/** 配置済みオブジェクト。座標は中心基準のワールドmm */
export interface PlacedObject {
  id: string
  type: 'image' | 'stand'
  /** type='image' のとき必須 */
  sourceId?: string
  /** type='stand' のとき必須 */
  partSize?: PartSize
  /** 中心X（mm） */
  x: number
  /** 中心Y（mm） */
  y: number
  /** 回転（deg、時計回り） */
  rot: number
  /** 配置幅（mm、不透明領域基準）。台座は外形幅 */
  widthMm: number
  /** 台座の外形高さ（mm、台座のみ。穴の寸法は固定） */
  heightMm?: number
  /** 吸着済みタブ（画像のみ） */
  tabs?: PlacedTab[]
}

let nextId = 1
export function newObjectId(): string {
  return `obj${nextId++}`
}

interface ProjectState {
  objects: PlacedObject[]
  selectedId: string | null
  past: PlacedObject[][]
  future: PlacedObject[][]
  /** ジェスチャー（ドラッグ等）開始時のスナップショット。確定時に履歴へ積む */
  gestureSnapshot: PlacedObject[] | null

  select: (id: string | null) => void
  addObject: (obj: PlacedObject) => void
  /** transient: ドラッグ中の連続更新（履歴に積まない） */
  updateObject: (id: string, patch: Partial<PlacedObject>, transient?: boolean) => void
  beginGesture: () => void
  endGesture: () => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  undo: () => void
  redo: () => void
}

const HISTORY_LIMIT = 100

function pushHistory(past: PlacedObject[][], snapshot: PlacedObject[]): PlacedObject[][] {
  const next = [...past, snapshot]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

export const useProject = create<ProjectState>((set, get) => ({
  objects: [],
  selectedId: null,
  past: [],
  future: [],
  gestureSnapshot: null,

  select: (selectedId) => set({ selectedId }),

  addObject: (obj) =>
    set((s) => ({
      objects: [...s.objects, obj],
      selectedId: obj.id,
      past: pushHistory(s.past, s.objects),
      future: [],
    })),

  updateObject: (id, patch, transient = false) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      ...(transient ? {} : { past: pushHistory(s.past, s.objects), future: [] }),
    })),

  beginGesture: () => set((s) => ({ gestureSnapshot: s.objects })),

  endGesture: () => {
    const { gestureSnapshot, objects } = get()
    if (!gestureSnapshot) return
    const changed = JSON.stringify(gestureSnapshot) !== JSON.stringify(objects)
    set((s) => ({
      gestureSnapshot: null,
      ...(changed ? { past: pushHistory(s.past, gestureSnapshot), future: [] } : {}),
    }))
  },

  duplicate: (id) => {
    const src = get().objects.find((o) => o.id === id)
    if (!src) return
    const copy: PlacedObject = { ...src, id: newObjectId(), x: src.x + 8, y: src.y + 8 }
    get().addObject(copy)
  },

  remove: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      past: pushHistory(s.past, s.objects),
      future: [],
    })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      return {
        objects: prev,
        past: s.past.slice(0, -1),
        future: [s.objects, ...s.future],
        selectedId: prev.some((o) => o.id === s.selectedId) ? s.selectedId : null,
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const next = s.future[0]
      return {
        objects: next,
        past: pushHistory(s.past, s.objects),
        future: s.future.slice(1),
        selectedId: next.some((o) => o.id === s.selectedId) ? s.selectedId : null,
      }
    }),
}))
