import { useState } from 'react'
import { APP_VERSION } from '../version'

interface Props {
  violationCount: number
}

export default function Header({ violationCount }: Props) {
  const [projectName, setProjectName] = useState('新規プロジェクト')

  return (
    <div
      style={{
        height: 58,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 14,
        flexShrink: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(226,109,142,0.35)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="7" r="4.6" fill="#fff" />
            <rect x="8.4" y="10.5" width="3.2" height="3.6" fill="#fff" />
            <path d="M 4.5,17 L 15.5,17 L 14.2,13.8 L 5.8,13.8 Z" fill="#fff" opacity="0.85" />
          </svg>
        </div>
        <div>
          <div className="logo-font" style={{ fontSize: 17, lineHeight: 1.1 }}>
            AcSta <span style={{ color: 'var(--accent)' }}>Studio</span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-sub)',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            アクスタ入稿データメーカー ・ v{APP_VERSION}
          </div>
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid transparent',
          background: 'transparent',
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
          color: 'var(--text)',
          width: 220,
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--border-input)')}
        onBlur={(e) => (e.target.style.borderColor = 'transparent')}
      />

      <div style={{ flex: 1 }} />

      {violationCount > 0 && (
        <div
          style={{
            background: 'var(--danger-bg)',
            color: 'var(--danger-text)',
            fontSize: 11.5,
            fontWeight: 800,
            padding: '5px 12px',
            borderRadius: 99,
          }}
        >
          ⚠ 違反 {violationCount} 件
        </div>
      )}

      <button
        title="設定（Phase 7 で実装予定）"
        disabled
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid var(--border-input)',
          background: '#fff',
          opacity: 0.45,
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="var(--text-mid)"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <circle cx="10" cy="10" r="2.6" />
          <path d="M 10,2.6 L 10,4.8 M 10,15.2 L 10,17.4 M 2.6,10 L 4.8,10 M 15.2,10 L 17.4,10 M 4.8,4.8 L 6.3,6.3 M 13.7,13.7 L 15.2,15.2 M 15.2,4.8 L 13.7,6.3 M 6.3,13.7 L 4.8,15.2" />
        </svg>
      </button>
      <button
        title="書き出し（Phase 4/5 で実装予定）"
        disabled
        style={{
          height: 36,
          padding: '0 18px',
          borderRadius: 10,
          border: 'none',
          background: 'var(--accent)',
          opacity: 0.45,
          cursor: 'not-allowed',
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
          fontSize: 13,
          fontWeight: 800,
          color: '#fff',
        }}
      >
        書き出し
      </button>
    </div>
  )
}
