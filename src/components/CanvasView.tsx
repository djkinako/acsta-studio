import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useProject } from '../stores/project'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { ringsToSvgPath } from '../geometry/offset'
import type { Rect } from '../geometry/transform'
import type { ObjectView, PairIndicator } from './EditorApp'
import type { ViolationResult } from '../pipeline/violations'

export interface CanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
}

interface Props {
  views: ObjectView[]
  violations: ViolationResult
  indicators: PairIndicator[]
  paper: { w: number; h: number }
  marginRect: Rect
  minGapMm: number
}

interface ViewState {
  pxPerMm: number
  cx: number
  cy: number
}

type DragState =
  | { type: 'none' }
  | { type: 'maybe-pan'; startClient: { x: number; y: number }; startView: ViewState }
  | { type: 'pan'; startClient: { x: number; y: number }; startView: ViewState }
  | { type: 'move'; id: string; startMm: { x: number; y: number }; orig: { x: number; y: number } }
  | { type: 'rotate'; id: string; center: { x: number; y: number } }
  | {
      type: 'scale'
      id: string
      center: { x: number; y: number }
      startDist: number
      origWidth: number
    }

const ZOOM_MIN = 0.5
const ZOOM_MAX = 40
/** 100% = 96dpi 相当（1mm ≈ 3.78px） */
const PX_PER_MM_100 = 96 / 25.4
/** ルーラーの太さ（px） */
const RULER = 22

/** 上・左のmm定規（Canva風）。ズーム・パンに追従する */
function Rulers({
  view,
  size,
  paper,
}: {
  view: ViewState
  size: { w: number; h: number }
  paper: { w: number; h: number }
}) {
  // ラベル付き目盛りが画面上で56px以上空くような間隔を選ぶ
  const candidates = [1, 2, 5, 10, 20, 50, 100]
  const major = candidates.find((s) => s * view.pxPerMm >= 56) ?? 200
  const minor = (major / 5) * view.pxPerMm >= 7 ? major / 5 : major

  const mmToScreenX = (mm: number) => size.w / 2 + (mm - view.cx) * view.pxPerMm
  const mmToScreenY = (mm: number) => size.h / 2 + (mm - view.cy) * view.pxPerMm

  const buildTicks = (visibleStartMm: number, visibleEndMm: number) => {
    const result: Array<{ mm: number; isMajor: boolean }> = []
    const first = Math.floor(visibleStartMm / minor) * minor
    for (let mm = first; mm <= visibleEndMm; mm += minor) {
      const rounded = Math.round(mm * 1000) / 1000
      result.push({ mm: rounded, isMajor: Math.abs(rounded % major) < 1e-6 })
    }
    return result
  }

  const hTicks = buildTicks(view.cx - size.w / 2 / view.pxPerMm, view.cx + size.w / 2 / view.pxPerMm)
  const vTicks = buildTicks(view.cy - size.h / 2 / view.pxPerMm, view.cy + size.h / 2 / view.pxPerMm)

  const rulerBg = 'rgba(255, 253, 248, 0.95)'
  const tickColor = '#b5a78f'
  const labelStyle: React.CSSProperties = {
    fontSize: 8.5,
    fill: '#8d7d66',
    fontWeight: 700,
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
  }

  return (
    <>
      {/* 上ルーラー */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: RULER,
          background: rulerBg,
          borderBottom: '1px solid var(--border)',
          zIndex: 6,
          pointerEvents: 'none',
        }}
      >
        <svg width={size.w} height={RULER} style={{ display: 'block' }}>
          {/* 用紙の範囲をうっすら強調 */}
          <rect
            x={mmToScreenX(0)}
            y={0}
            width={paper.w * view.pxPerMm}
            height={RULER}
            fill="rgba(226,109,142,0.07)"
          />
          {hTicks.map((t) => {
            const x = mmToScreenX(t.mm)
            if (x < RULER - 4) return null
            return (
              <g key={t.mm}>
                <line
                  x1={x}
                  y1={t.isMajor ? 11 : 16}
                  x2={x}
                  y2={RULER}
                  stroke={tickColor}
                  strokeWidth={1}
                />
                {t.isMajor && (
                  <text x={x + 3} y={9.5} style={labelStyle}>
                    {t.mm}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* 左ルーラー */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: RULER,
          background: rulerBg,
          borderRight: '1px solid var(--border)',
          zIndex: 6,
          pointerEvents: 'none',
        }}
      >
        <svg width={RULER} height={size.h} style={{ display: 'block' }}>
          <rect
            x={0}
            y={mmToScreenY(0)}
            width={RULER}
            height={paper.h * view.pxPerMm}
            fill="rgba(226,109,142,0.07)"
          />
          {vTicks.map((t) => {
            const y = mmToScreenY(t.mm)
            if (y < RULER - 4) return null
            return (
              <g key={t.mm}>
                <line
                  x1={t.isMajor ? 11 : 16}
                  y1={y}
                  x2={RULER}
                  y2={y}
                  stroke={tickColor}
                  strokeWidth={1}
                />
                {t.isMajor && (
                  <text
                    x={9}
                    y={y - 3}
                    style={labelStyle}
                    transform={`rotate(-90 9 ${y - 3})`}
                    textAnchor="start"
                  >
                    {t.mm}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* 左上コーナー */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: RULER,
          height: RULER,
          background: rulerBg,
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          zIndex: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          fontWeight: 800,
          color: '#b5a78f',
          pointerEvents: 'none',
        }}
      >
        mm
      </div>
    </>
  )
}

const CanvasView = forwardRef<CanvasHandle, Props>(function CanvasView(
  { views, violations, indicators, paper, marginRect, minGapMm },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState<ViewState>({ pxPerMm: 2, cx: paper.w / 2, cy: paper.h / 2 })
  const [scaling, setScaling] = useState<{ id: string; factor: number } | null>(null)
  const dragRef = useRef<DragState>({ type: 'none' })
  const fittedRef = useRef(false)

  const selectedId = useProject((s) => s.selectedId)
  const dpi = useSettings((s) => s.dpi)
  const orientation = useSettings((s) => s.orientation)
  const paperPreset = useSettings((s) => s.paperPreset)
  const layerVisible = useUi((s) => s.layerVisible)

  // コンテナサイズ追従
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const fit = useCallback(() => {
    setSize((sz) => {
      setView({
        pxPerMm: Math.min((sz.w - 90) / paper.w, (sz.h - 90) / paper.h),
        cx: paper.w / 2,
        cy: paper.h / 2,
      })
      return sz
    })
  }, [paper.w, paper.h])

  // 初回フィット
  useEffect(() => {
    if (!fittedRef.current && size.w > 100) {
      fittedRef.current = true
      fit()
    }
  }, [size, fit])

  // ズーム%をフッターへ反映
  useEffect(() => {
    useUi.getState().setZoomPct(Math.round((view.pxPerMm / PX_PER_MM_100) * 100))
  }, [view.pxPerMm])

  const zoomBy = useCallback((factor: number) => {
    setView((v) => ({
      ...v,
      pxPerMm: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.pxPerMm * factor)),
    }))
  }, [])

  useImperativeHandle(ref, () => ({ zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(0.8), fit }), [
    zoomBy,
    fit,
  ])

  // ホイール: pinch/Ctrl+wheel = ズーム（カーソル中心）、それ以外 = パン
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          const factor = Math.exp(-e.deltaY * 0.01)
          const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.pxPerMm * factor))
          // カーソル位置を不動点にズーム
          const rect = el.getBoundingClientRect()
          const px = e.clientX - rect.left - rect.width / 2
          const py = e.clientY - rect.top - rect.height / 2
          const mmX = v.cx + px / v.pxPerMm
          const mmY = v.cy + py / v.pxPerMm
          return { pxPerMm: next, cx: mmX - px / next, cy: mmY - py / next }
        }
        return { ...v, cx: v.cx + e.deltaX / v.pxPerMm, cy: v.cy + e.deltaY / v.pxPerMm }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const screenToMm = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: pt.x, y: pt.y }
  }, [])

  // ---- ポインタ操作 ----

  const onObjectPointerDown = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const { select, beginGesture } = useProject.getState()
    select(id)
    beginGesture()
    const obj = useProject.getState().objects.find((o) => o.id === id)!
    dragRef.current = { type: 'move', id, startMm: screenToMm(e), orig: { x: obj.x, y: obj.y } }
    useUi.getState().setInteracting(true)
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onRotateHandleDown = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    useProject.getState().beginGesture()
    const obj = useProject.getState().objects.find((o) => o.id === id)!
    dragRef.current = { type: 'rotate', id, center: { x: obj.x, y: obj.y } }
    useUi.getState().setInteracting(true)
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onScaleHandleDown = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    useProject.getState().beginGesture()
    const obj = useProject.getState().objects.find((o) => o.id === id)!
    const mm = screenToMm(e)
    const startDist = Math.hypot(mm.x - obj.x, mm.y - obj.y)
    if (startDist < 0.5) return
    dragRef.current = {
      type: 'scale',
      id,
      center: { x: obj.x, y: obj.y },
      startDist,
      origWidth: obj.widthMm,
    }
    useUi.getState().setInteracting(true)
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onBackgroundPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    dragRef.current = {
      type: 'maybe-pan',
      startClient: { x: e.clientX, y: e.clientY },
      startView: view,
    }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    const mm = screenToMm(e)
    useUi.getState().setCursor(mm)

    switch (drag.type) {
      case 'maybe-pan': {
        const dx = e.clientX - drag.startClient.x
        const dy = e.clientY - drag.startClient.y
        if (Math.hypot(dx, dy) > 4) {
          dragRef.current = { ...drag, type: 'pan' }
        }
        break
      }
      case 'pan': {
        const dx = (e.clientX - drag.startClient.x) / view.pxPerMm
        const dy = (e.clientY - drag.startClient.y) / view.pxPerMm
        setView({ ...drag.startView, cx: drag.startView.cx - dx, cy: drag.startView.cy - dy })
        break
      }
      case 'move': {
        useProject
          .getState()
          .updateObject(
            drag.id,
            {
              x: drag.orig.x + (mm.x - drag.startMm.x),
              y: drag.orig.y + (mm.y - drag.startMm.y),
            },
            true,
          )
        break
      }
      case 'rotate': {
        let deg =
          (Math.atan2(mm.y - drag.center.y, mm.x - drag.center.x) * 180) / Math.PI + 90
        if (e.shiftKey) deg = Math.round(deg / 15) * 15
        deg = ((deg % 360) + 360) % 360
        useProject.getState().updateObject(drag.id, { rot: Math.round(deg * 10) / 10 }, true)
        break
      }
      case 'scale': {
        const dist = Math.hypot(mm.x - drag.center.x, mm.y - drag.center.y)
        const factor = Math.max(0.05, dist / drag.startDist)
        const width = Math.max(5, Math.min(300, drag.origWidth * factor))
        // ドラッグ中は見た目だけスケール（パイプライン再計算は確定時に1回）
        setScaling({ id: drag.id, factor: width / drag.origWidth })
        break
      }
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (drag.type === 'maybe-pan') {
      useProject.getState().select(null)
    }
    if (drag.type === 'scale' && scaling) {
      const width = Math.max(5, Math.min(300, drag.origWidth * scaling.factor))
      useProject.getState().updateObject(drag.id, { widthMm: Math.round(width * 10) / 10 }, true)
      setScaling(null)
    }
    if (drag.type === 'move' || drag.type === 'rotate' || drag.type === 'scale') {
      useProject.getState().endGesture()
    }
    dragRef.current = { type: 'none' }
    useUi.getState().setInteracting(false)
    svgRef.current?.releasePointerCapture(e.pointerId)
  }

  // ---- 描画 ----

  const vw = size.w / view.pxPerMm
  const vh = size.h / view.pxPerMm
  const viewBox = `${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`
  /** 画面上で一定サイズに見せるためのmm換算 */
  const px = (n: number) => n / view.pxPerMm

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#efe5d4',
        backgroundImage: 'radial-gradient(rgba(141,116,77,0.16) 1px, transparent 1.3px)',
        backgroundSize: '22px 22px',
        touchAction: 'none',
      }}
    >
      <Rulers view={view} size={size} paper={paper} />

      {/* 用紙情報チップ */}
      <div
        style={{
          position: 'absolute',
          top: RULER + 10,
          left: RULER + 12,
          background: 'rgba(255,253,248,0.92)',
          border: '1px solid var(--border)',
          borderRadius: 99,
          padding: '5px 14px',
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--text-mid)',
          display: 'flex',
          gap: 8,
          zIndex: 5,
          whiteSpace: 'nowrap',
        }}
      >
        <span>
          {paperPreset} ・ {orientation === 'portrait' ? '縦' : '横'}
        </span>
        <span style={{ color: '#d5c6ac' }}>|</span>
        <span>
          {paper.w} × {paper.h}mm
        </span>
        <span style={{ color: '#d5c6ac' }}>|</span>
        <span>{dpi}dpi</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBox}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => useUi.getState().setCursor(null)}
      >
        {/* 用紙 */}
        <rect
          x={0}
          y={0}
          width={paper.w}
          height={paper.h}
          fill="#ffffff"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(91,72,39,0.25))' }}
        />
        {/* マージン（配置可能エリア） */}
        <rect
          x={marginRect.minX}
          y={marginRect.minY}
          width={marginRect.maxX - marginRect.minX}
          height={marginRect.maxY - marginRect.minY}
          fill="none"
          stroke="#c9b99f"
          strokeWidth={px(1)}
          strokeDasharray={`${px(5)} ${px(4)}`}
        />
        <text
          x={marginRect.minX + px(6)}
          y={marginRect.minY + px(13)}
          style={{ fontSize: px(10), fill: '#b5a78f', fontWeight: 700 }}
        >
          マージン
        </text>

        {/* オブジェクト */}
        {views.map((v) => {
          const { obj, source, geo } = v
          const violating = violations.violatingIds.has(obj.id)
          const cutColor = violating ? 'var(--danger)' : 'var(--cut)'
          const sc = scaling?.id === obj.id ? scaling.factor : 1
          const cutPath = ringsToSvgPath(geo.cutline)
          return (
            <g
              key={obj.id}
              transform={`translate(${obj.x},${obj.y}) rotate(${obj.rot}) scale(${sc})`}
              style={{ cursor: 'move' }}
              onPointerDown={(e) => onObjectPointerDown(e, obj.id)}
            >
              {layerVisible.cut && (
                <>
                  <path
                    d={cutPath}
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={0.7}
                    strokeLinejoin="round"
                  />
                  <path
                    d={cutPath}
                    fill="none"
                    stroke={cutColor}
                    strokeWidth={0.3}
                    strokeLinejoin="round"
                  />
                </>
              )}
              {layerVisible.print && (
                <image
                  href={source.url}
                  x={geo.imageOffsetX}
                  y={geo.imageOffsetY}
                  width={geo.imageWidthMm}
                  height={geo.imageHeightMm}
                  preserveAspectRatio="none"
                />
              )}
              {!layerVisible.print && (
                <path d={cutPath} fill="rgba(180,214,228,0.2)" stroke="none" />
              )}
              {layerVisible.white && v.whiteVisUrl && (
                <image
                  href={v.whiteVisUrl}
                  x={geo.imageOffsetX}
                  y={geo.imageOffsetY}
                  width={geo.imageWidthMm}
                  height={geo.imageHeightMm}
                  preserveAspectRatio="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          )
        })}

        {/* 選択オーバーレイ（ハンドル類） */}
        {views
          .filter((v) => v.obj.id === selectedId)
          .map((v) => {
            const { obj, geo } = v
            const sc = scaling?.id === obj.id ? scaling.factor : 1
            const w = (obj.widthMm / 2 + 2) * sc
            const h = (geo.heightMm / 2 + 2) * sc
            const hs = px(9) / 2 // ハンドル半サイズ
            const rotY = -h - px(26)
            return (
              <g key={`sel-${obj.id}`} transform={`translate(${obj.x},${obj.y}) rotate(${obj.rot})`}>
                <rect
                  x={-w}
                  y={-h}
                  width={w * 2}
                  height={h * 2}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={px(1.4)}
                  strokeDasharray={`${px(5)} ${px(3)}`}
                />
                {/* 拡縮ハンドル（四隅） */}
                {[
                  [-w, -h],
                  [w, -h],
                  [w, h],
                  [-w, h],
                ].map(([hx, hy], i) => (
                  <rect
                    key={i}
                    x={hx - hs}
                    y={hy - hs}
                    width={hs * 2}
                    height={hs * 2}
                    fill="#ffffff"
                    stroke="var(--accent)"
                    strokeWidth={px(1.4)}
                    style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(e) => onScaleHandleDown(e, obj.id)}
                  />
                ))}
                {/* 回転ハンドル */}
                <line
                  x1={0}
                  y1={-h}
                  x2={0}
                  y2={rotY}
                  stroke="var(--accent)"
                  strokeWidth={px(1.2)}
                />
                <circle
                  cx={0}
                  cy={rotY}
                  r={px(6)}
                  fill="#ffffff"
                  stroke="var(--accent)"
                  strokeWidth={px(1.6)}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onRotateHandleDown(e, obj.id)}
                />
              </g>
            )
          })}

        {/* 間隔違反インジケーター */}
        {indicators.map((ind) => {
          const { closest } = ind
          const mx = (closest.pa.x + closest.pb.x) / 2
          const my = (closest.pa.y + closest.pb.y) / 2
          const label = `${closest.distance.toFixed(1)}mm ＜ ${minGapMm}mm`
          const bw = px(11) * (label.length * 0.62) + px(12)
          return (
            <g key={`${ind.a}-${ind.b}`} style={{ pointerEvents: 'none' }}>
              <line
                x1={closest.pa.x}
                y1={closest.pa.y}
                x2={closest.pb.x}
                y2={closest.pb.y}
                stroke="var(--danger)"
                strokeWidth={px(1.6)}
                strokeDasharray={`${px(4)} ${px(3)}`}
              />
              <circle cx={closest.pa.x} cy={closest.pa.y} r={px(2.6)} fill="var(--danger)" />
              <circle cx={closest.pb.x} cy={closest.pb.y} r={px(2.6)} fill="var(--danger)" />
              <rect
                x={mx + px(8)}
                y={my - px(11)}
                width={bw}
                height={px(22)}
                rx={px(11)}
                fill="var(--danger)"
              />
              <text
                x={mx + px(8) + bw / 2}
                y={my + px(4.5)}
                textAnchor="middle"
                style={{ fontSize: px(11), fill: '#ffffff', fontWeight: 800 }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
})

export default CanvasView
