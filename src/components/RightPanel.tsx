import { useProject } from '../stores/project'
import { useUi } from '../stores/ui'
import { useSettings } from '../stores/settings'
import { getSource } from '../pipeline/sources'
import type { ObjectView, PairIndicator } from './EditorApp'
import type { ViolationResult } from '../pipeline/violations'

interface Props {
  views: ObjectView[]
  violations: ViolationResult
  indicators: PairIndicator[]
}

function NumberField({
  label,
  value,
  step,
  onChange,
  suffix,
}: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  suffix: string
}) {
  return (
    <div style={{ background: 'var(--bg-panel)', borderRadius: 9, padding: '7px 10px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text-sub)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(n)
          }}
          style={{
            width: '100%',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            fontFamily: "'M PLUS Rounded 1c', sans-serif",
            color: 'var(--text)',
            padding: 0,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>{suffix}</span>
      </div>
    </div>
  )
}

function LayerToggle({
  swatch,
  title,
  sub,
  on,
  onToggle,
  disabled,
}: {
  swatch: React.ReactNode
  title: string
  sub: string
  on: boolean
  onToggle?: () => void
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 8px',
        borderRadius: 10,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {swatch}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--text-sub)', fontFamily: 'monospace' }}>{sub}</div>
      </div>
      <div
        onClick={disabled ? undefined : onToggle}
        style={{
          width: 34,
          height: 20,
          borderRadius: 99,
          background: on ? 'var(--accent)' : '#d9cdb8',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: 99,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.15s',
          }}
        />
      </div>
    </div>
  )
}

export default function RightPanel({ views, violations, indicators }: Props) {
  const selectedId = useProject((s) => s.selectedId)
  const updateObject = useProject((s) => s.updateObject)
  const duplicate = useProject((s) => s.duplicate)
  const remove = useProject((s) => s.remove)
  const layerVisible = useUi((s) => s.layerVisible)
  const toggleLayer = useUi((s) => s.toggleLayer)
  const dpi = useSettings((s) => s.dpi)
  const layerNames = useSettings((s) => s.layerNames)

  const sel = views.find((v) => v.obj.id === selectedId)
  const nameOf = (id: string) =>
    getSource(views.find((v) => v.obj.id === id)?.obj.sourceId ?? '')?.name ?? id

  const totalViolations = violations.pairs.length + violations.marginIds.length

  return (
    <div
      style={{
        width: 270,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
        overflowY: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* 選択中オブジェクト */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div className="card-label" style={{ marginBottom: 0 }}>
            選択中のオブジェクト
          </div>
          {sel && (
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 99,
                background: '#fbe3ea',
                color: '#c2557a',
              }}
            >
              画像
            </div>
          )}
        </div>

        {!sel && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 700 }}>
            オブジェクトをクリックして選択してな
          </div>
        )}

        {sel && (
          <>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                marginBottom: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sel.source.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <NumberField
                label="X 位置（中心）"
                value={Math.round(sel.obj.x * 10) / 10}
                step={0.1}
                suffix="mm"
                onChange={(x) => updateObject(sel.obj.id, { x })}
              />
              <NumberField
                label="Y 位置（中心）"
                value={Math.round(sel.obj.y * 10) / 10}
                step={0.1}
                suffix="mm"
                onChange={(y) => updateObject(sel.obj.id, { y })}
              />
              <NumberField
                label="幅"
                value={Math.round(sel.obj.widthMm * 10) / 10}
                step={1}
                suffix="mm"
                onChange={(w) => updateObject(sel.obj.id, { widthMm: Math.max(5, Math.min(300, w)) })}
              />
              <NumberField
                label="回転"
                value={Math.round(sel.obj.rot * 10) / 10}
                step={1}
                suffix="°"
                onChange={(rot) => updateObject(sel.obj.id, { rot: ((rot % 360) + 360) % 360 })}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => duplicate(sel.obj.id)}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--border-input)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: "'M PLUS Rounded 1c', sans-serif",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#6b5d49',
                }}
              >
                複製 ⌘D
              </button>
              <button
                onClick={() => remove(sel.obj.id)}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid #f0d5cd',
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: "'M PLUS Rounded 1c', sans-serif",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--danger-text)',
                }}
              >
                削除
              </button>
            </div>
          </>
        )}
      </div>

      {/* レイヤー */}
      <div className="card">
        <div className="card-label">レイヤー</div>
        <LayerToggle
          swatch={
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                background: 'linear-gradient(135deg, #f8c9d4 0%, #f7d87c 55%, #d9a86c 100%)',
                border: '1px solid rgba(91,72,39,0.15)',
                flexShrink: 0,
              }}
            />
          }
          title="カラー版"
          sub={`${layerNames.print} ・ ラスター${dpi}dpi`}
          on={layerVisible.print}
          onToggle={() => toggleLayer('print')}
        />
        <LayerToggle
          swatch={
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                background: '#fff',
                border: '2px solid var(--cut)',
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            />
          }
          title="カットライン"
          sub={`${layerNames.cut} ・ ベクター 0.1mm`}
          on={layerVisible.cut}
          onToggle={() => toggleLayer('cut')}
        />
        <LayerToggle
          swatch={
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                background: 'var(--white-vis)',
                border: '1px solid #8fb9cc',
                flexShrink: 0,
              }}
            />
          }
          title="白版"
          sub={`${layerNames.white} ・ Phase 3 で実装`}
          on={false}
          disabled
        />
      </div>

      {/* 間隔チェック */}
      <div
        className="card"
        style={{ borderColor: totalViolations > 0 ? '#f0d5cd' : 'var(--border-card)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div className="card-label" style={{ marginBottom: 0 }}>
            間隔チェック
          </div>
          <div
            style={{
              background: totalViolations > 0 ? 'var(--danger-bg)' : '#eaf3ec',
              color: totalViolations > 0 ? 'var(--danger-text)' : '#4e8a5f',
              fontSize: 10.5,
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: 99,
            }}
          >
            {totalViolations > 0 ? `違反 ${totalViolations}件` : 'OK'}
          </div>
        </div>

        {violations.pairs.map(([a, b]) => {
          const ind = indicators.find((i) => i.a === a && i.b === b)
          return (
            <div
              key={`${a}-${b}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 10,
                background: '#fff5f3',
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: 'var(--danger)',
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#b5503c' }}>
                  {nameOf(a)} ↔ {nameOf(b)}
                </div>
                <div style={{ fontSize: 10.5, color: '#c97a6b', marginTop: 1 }}>
                  {ind ? `${ind.closest.distance.toFixed(1)}mm` : '計測中…'} — ドラッグで離すと解消
                </div>
              </div>
            </div>
          )
        })}

        {violations.marginIds.map((id) => (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '9px 10px',
              borderRadius: 10,
              background: '#fff5f3',
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: 'var(--danger)',
                marginTop: 4,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#b5503c' }}>
                {nameOf(id)} がマージン外
              </div>
              <div style={{ fontSize: 10.5, color: '#c97a6b', marginTop: 1 }}>
                配置可能エリア（点線の内側）に収めてな
              </div>
            </div>
          </div>
        ))}

        {totalViolations === 0 && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)' }}>
            全オブジェクトが最小間隔を満たしとるよ
          </div>
        )}
      </div>
    </div>
  )
}
