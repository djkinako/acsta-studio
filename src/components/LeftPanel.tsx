import { useRef, useState } from 'react'
import { useProject } from '../stores/project'
import { useSettings } from '../stores/settings'
import { effectiveDpi } from '../geometry/units'
import { trimWidthPx } from '../pipeline/sources'
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

            {views.length > 0 && (
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
                配置済みの画像 ・ {views.length}
              </div>
            )}

            {views.map((v) => {
              // 実効DPIは透明余白を除いた不透明領域の幅で計算
              const eDpi = Math.round(effectiveDpi(trimWidthPx(v.source), v.obj.widthMm))
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
                      src={v.source.url}
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
                      {v.source.name}
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
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 11,
              background: '#fff4e8',
              fontSize: 11,
              color: '#9a6b35',
              fontWeight: 700,
              lineHeight: 1.55,
            }}
          >
            凸タブ・台座のパーツライブラリは Phase 6 で実装予定やで。きなこのテンプレSVG（タブ各サイズ・台座各サイズ）が届いたらここに並ぶ。
          </div>
        )}
      </div>
    </div>
  )
}
