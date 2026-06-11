import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProject, newObjectId, type PlacedObject } from '../stores/project'
import { useSettings, paperSizeOf } from '../stores/settings'
import { useUi } from '../stores/ui'
import { getObjectGeometry, getSource, importPng, type ObjectGeometry, type SourceImage } from '../pipeline/sources'
import { checkViolations, type ViolationResult } from '../pipeline/violations'
import { transformRings, minDistanceBetween, type ClosestPair, type Rect } from '../geometry/transform'
import type { Polygons } from '../geometry/types'
import Header from './Header'
import LeftPanel from './LeftPanel'
import CanvasView, { type CanvasHandle } from './CanvasView'
import RightPanel from './RightPanel'
import Footer from './Footer'

export interface ObjectView {
  obj: PlacedObject
  source: SourceImage
  geo: ObjectGeometry
  worldCutline: Polygons
  worldGap: Polygons
}

export interface PairIndicator {
  a: string
  b: string
  closest: ClosestPair
}

export default function EditorApp() {
  const objects = useProject((s) => s.objects)
  const settings = useSettings()
  const interacting = useUi((s) => s.interacting)
  const canvasRef = useRef<CanvasHandle>(null)

  const paper = paperSizeOf(settings)
  const marginRect: Rect = useMemo(
    () => ({
      minX: settings.margins.left,
      minY: settings.margins.top,
      maxX: paper.w - settings.margins.right,
      maxY: paper.h - settings.margins.bottom,
    }),
    [settings.margins, paper.w, paper.h],
  )

  // 配置オブジェクト → ワールド座標の幾何（ドラッグ中も毎フレーム再計算。
  // ローカル幾何はキャッシュ済みなので変換コストのみ）
  const views = useMemo<ObjectView[]>(() => {
    const result: ObjectView[] = []
    for (const obj of objects) {
      const source = getSource(obj.sourceId)
      if (!source) continue
      const geo = getObjectGeometry(obj.sourceId, obj.widthMm, settings.params)
      if (!geo) continue
      result.push({
        obj,
        source,
        geo,
        worldCutline: transformRings(geo.cutline, obj.x, obj.y, obj.rot),
        worldGap: transformRings(geo.gapPoly, obj.x, obj.y, obj.rot),
      })
    }
    return result
  }, [objects, settings.params])

  const violations = useMemo<ViolationResult>(
    () =>
      checkViolations(
        views.map((v) => ({ id: v.obj.id, cutline: v.worldCutline, gapPoly: v.worldGap })),
        marginRect,
      ),
    [views, marginRect],
  )

  // 違反ペアの最短距離バッジ（重いので操作確定後にデバウンスで計算）
  const [indicators, setIndicators] = useState<PairIndicator[]>([])
  useEffect(() => {
    if (interacting) return
    if (violations.pairs.length === 0) {
      setIndicators([])
      return
    }
    const timer = setTimeout(() => {
      const result: PairIndicator[] = []
      for (const [a, b] of violations.pairs) {
        const va = views.find((v) => v.obj.id === a)
        const vb = views.find((v) => v.obj.id === b)
        if (!va || !vb) continue
        result.push({ a, b, closest: minDistanceBetween(va.worldCutline, vb.worldCutline) })
      }
      setIndicators(result)
    }, 120)
    return () => clearTimeout(timer)
  }, [violations.pairs, views, interacting])

  // 画像追加（ドロップ／ファイル選択から）
  const addImageFiles = useCallback(
    async (files: FileList | File[]) => {
      const { addObject } = useProject.getState()
      let offset = 0
      for (const file of Array.from(files)) {
        if (!file.type.includes('png')) continue
        const source = await importPng(file, file.name)
        const defaultWidth = Math.min(60, marginRect.maxX - marginRect.minX - 10)
        const obj: PlacedObject = {
          id: newObjectId(),
          sourceId: source.id,
          x: paper.w / 2 + offset,
          y: paper.h / 2 + offset,
          rot: 0,
          widthMm: defaultWidth,
        }
        addObject(obj)
        offset += 10
      }
    },
    [paper.w, paper.h, marginRect],
  )

  // キーボードショートカット（SPEC 6.2）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      const { selectedId, updateObject, remove, duplicate, undo, redo, select } =
        useProject.getState()
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (selectedId) duplicate(selectedId)
        return
      }
      if (!selectedId) return
      const sel = useProject.getState().objects.find((o) => o.id === selectedId)
      if (!sel) return

      const step = e.shiftKey ? 1 : 0.1
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          updateObject(selectedId, { x: sel.x - step })
          break
        case 'ArrowRight':
          e.preventDefault()
          updateObject(selectedId, { x: sel.x + step })
          break
        case 'ArrowUp':
          e.preventDefault()
          updateObject(selectedId, { y: sel.y - step })
          break
        case 'ArrowDown':
          e.preventDefault()
          updateObject(selectedId, { y: sel.y + step })
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          remove(selectedId)
          break
        case 'Escape':
          select(null)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header violationCount={violations.pairs.length + violations.marginIds.length} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LeftPanel views={views} onAddFiles={addImageFiles} />
        <CanvasView
          ref={canvasRef}
          views={views}
          violations={violations}
          indicators={indicators}
          paper={paper}
          marginRect={marginRect}
          minGapMm={settings.params.minGapMm}
        />
        <RightPanel views={views} violations={violations} indicators={indicators} />
      </div>
      <Footer
        violationCount={violations.pairs.length + violations.marginIds.length}
        objectCount={objects.length}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFit={() => canvasRef.current?.fit()}
      />
    </div>
  )
}
