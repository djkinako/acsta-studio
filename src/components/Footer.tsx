import { useUi } from '../stores/ui'

interface Props {
  violationCount: number
  objectCount: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

const btnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: '1px solid var(--border-input)',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1,
  color: 'var(--text-mid)',
  padding: 0,
}

export default function Footer({ violationCount, objectCount, onZoomIn, onZoomOut, onFit }: Props) {
  const cursorMm = useUi((s) => s.cursorMm)
  const zoomPct = useUi((s) => s.zoomPct)

  return (
    <div
      style={{
        height: 34,
        background: 'var(--bg-header)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 14,
        flexShrink: 0,
        fontSize: 11.5,
        fontWeight: 700,
        color: 'var(--text-mid)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button style={btnStyle} onClick={onZoomOut}>
          −
        </button>
        <span style={{ minWidth: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {zoomPct}%
        </span>
        <button style={btnStyle} onClick={onZoomIn}>
          ＋
        </button>
        <span style={{ color: '#c9b99f', margin: '0 2px' }}>|</span>
        <span style={{ cursor: 'pointer' }} onClick={onFit}>
          フィット
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-sub)', minWidth: 170, textAlign: 'right' }}>
        {cursorMm ? `X ${cursorMm.x.toFixed(1)}mm ／ Y ${cursorMm.y.toFixed(1)}mm` : '—'}
      </div>
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: violationCount > 0 ? 'var(--danger-text)' : 'var(--text-sub)',
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: 99,
            background: violationCount > 0 ? 'var(--danger)' : '#8fbf9b',
          }}
        />
        間隔違反 {violationCount} 件
      </div>
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
      <div style={{ color: 'var(--text-sub)' }}>オブジェクト {objectCount}</div>
    </div>
  )
}
