import { useRef, useState } from 'react'
import { useProject } from '../stores/project'
import { useSettings } from '../stores/settings'
import { effectiveDpi } from '../geometry/units'
import { trimWidthPx } from '../pipeline/sources'
import { STAND_DEFS, TAB_DEFS } from '../parts/defs'
import type { ObjectView } from './EditorApp'

interface Props {
  views: ObjectView[]
  onAddFiles: (files: FileList | File[]) => void
}

export default function LeftPanel({ views, onAddFiles }: Props) {
  const [tab, setTab] = useState<'images' | 'parts'>('images')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const selectedId = useProject((s) => s.selectedId)
  const select = useProject((s) => s.select)
  const dpi = useSettings((s) => s.dpi)
  const imageViews = views.filter((v) => v.obj.type === 'image' && v.source)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center',
    padding: '6px 0',
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    background: active ? '#fffdf8' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-sub)',
    boxShadow: active ? '0 1px 3px rgba(91,72,39,0.12)' : 'none',
  })

  return (
    <div
      className="ui-scale"
      style={{
        width: 236,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          margin: '12px 12px 10px',
          padding: 4,
          background: 'var(--bg-chip)',
          borderRadius: 12,
        }}
      >
        <div style={tabStyle(tab === 'images')} onClick={() => setTab('images')}>
          画像
        </div>
        <div style={tabStyle(tab === 'parts')} onClick={() => setTab('parts')}>
          パーツ
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {tab === 'images' && (
          <>
            <div
              className={`dropzone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                onAddFiles(e.dataTransfer.files)
              }}
            >
              透過PNGをここにドロップ
              <div className="sub">またはクリックして選択</div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) onAddFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {imageViews.length > 0 && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--text-sub)',
                  letterSpacing: '0.06em',
                  marginTop: 4,
                  paddingLeft: 2,
                }}
              >
                配置済みの画像 ・ {imageViews.length}
              </div>
            )}

            {imageViews.map((v) => {
              // 実効DPIは透明余白を除いた不透明領域の幅で計算
              const eDpi = Math.round(effectiveDpi(trimWidthPx(v.source!), v.obj.widthMm))
              const lowDpi = eDpi < dpi
              const active = v.obj.id === selectedId
              return (
                <div
                  key={v.obj.id}
                  onClick={() => select(v.obj.id)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: 8,
                    borderRadius: 11,
                    cursor: 'pointer',
                    background: active ? '#ffffff' : 'transparent',
                    border: active ? '1px solid var(--accent)' : '1px solid transparent',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      background: '#fff',
                      border: '1px solid var(--border-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={v.source!.url}
                      alt=""
                      style={{ maxWidth: 34, maxHeight: 34, objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {v.source!.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: lowDpi ? 'var(--danger-text)' : 'var(--text-sub)',
                        fontWeight: lowDpi ? 700 : 400,
                      }}
                    >
                      {lowDpi
                        ? `⚠ 実効${eDpi}dpi（${dpi}未満）`
                        : `${v.obj.widthMm.toFixed(1)} × ${v.geo.heightMm.toFixed(1)}mm ・ ${eDpi}dpi`}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'parts' && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-sub)',
                letterSpacing: '0.06em',
                paddingLeft: 2,
              }}
            >
              凸タブ（ポッチ）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {Object.values(TAB_DEFS).map((def) => (
                <div
                  key={def.size}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData(
                      'application/x-acsta-part',
                      JSON.stringify({ kind: 'tab', size: def.size }),
                    )
                  }
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border-card)',
                    borderRadius: 11,
                    padding: '10px 4px 8px',
                    textAlign: 'center',
                    cursor: 'grab',
                  }}
                >
                  <svg width={def.widthMm * 2.2 + 8} height="18" viewBox={`0 0 ${def.widthMm + 4} 9`}>
                    <path
                      d={`M 2,0 L 2,${def.heightMm - 2} Q 2,${def.heightMm + 1} 5,${def.heightMm + 1} L ${def.widthMm - 1},${def.heightMm + 1} Q ${def.widthMm + 2},${def.heightMm + 1} ${def.widthMm + 2},${def.heightMm - 2} L ${def.widthMm + 2},0`}
                      fill="#d6e9f1"
                      stroke="#7faec2"
                      strokeWidth="0.6"
                    />
                  </svg>
                  <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{def.label}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-sub)' }}>
                    {def.widthMm}×{def.heightMm}mm
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-sub)',
                letterSpacing: '0.06em',
                marginTop: 6,
                paddingLeft: 2,
              }}
            >
              台座
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(STAND_DEFS).map((def) => (
                <div
                  key={def.size}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData(
                      'application/x-acsta-part',
                      JSON.stringify({ kind: 'stand', size: def.size }),
                    )
                  }
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border-card)',
                    borderRadius: 11,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'grab',
                  }}
                >
                  <svg
                    width={def.widthMm * 0.9 + 4}
                    height={def.heightMm * 0.9 + 4}
                    viewBox={`0 0 ${def.widthMm + 4} ${def.heightMm + 4}`}
                  >
                    <rect
                      x="2"
                      y="2"
                      width={def.widthMm}
                      height={def.heightMm}
                      rx="3"
                      fill="#d6e9f1"
                      stroke="#7faec2"
                      strokeWidth="0.8"
                    />
                    <rect
                      x={2 + def.widthMm / 2 - def.holeWmm / 2}
                      y={2 + def.heightMm / 2 - def.holeHmm / 2}
                      width={def.holeWmm}
                      height={def.holeHmm}
                      rx="0.8"
                      fill="var(--bg-panel)"
                      stroke="#7faec2"
                      strokeWidth="0.6"
                    />
                  </svg>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800 }}>{def.label}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-sub)' }}>
                      {def.widthMm}×{def.heightMm}mm
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 11,
                background: '#fff4e8',
                fontSize: 11,
                color: '#9a6b35',
                fontWeight: 700,
                lineHeight: 1.55,
              }}
            >
              タブはイラストに、台座は用紙にドラッグしてな。タブと台座の穴はサイズをそろえる（タブM ↔ 穴M）。タブは本体カットラインに合体して、選択中に青ハンドルで輪郭沿いにスライドできるで。
              <br />
              <span style={{ color: '#c97a3f' }}>⚠ 寸法は仮値。入稿先テンプレが届いたら差し替える</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
