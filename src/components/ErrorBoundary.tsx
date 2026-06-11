import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 白画面クラッシュ防止。エラー内容と復旧手段（設定リセット）を表示する。
 * 2026-06-11 の「設定ボタンで画面が全部消える」事故を踏まえて導入。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: '#fff',
            border: '1px solid var(--border-card)',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
            ごめん、エラーで画面が落ちたわ…
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--danger-text)',
              fontFamily: 'monospace',
              background: 'var(--danger-bg)',
              borderRadius: 8,
              padding: '8px 10px',
              marginBottom: 14,
              wordBreak: 'break-all',
            }}
          >
            {this.state.error.message}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                height: 34,
                padding: '0 16px',
                borderRadius: 9,
                border: '1px solid var(--border-input)',
                background: '#fff',
                cursor: 'pointer',
                fontFamily: "'M PLUS Rounded 1c', sans-serif",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              再読み込み
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('acsta-settings')
                window.location.reload()
              }}
              style={{
                height: 34,
                padding: '0 16px',
                borderRadius: 9,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: "'M PLUS Rounded 1c', sans-serif",
                fontSize: 12.5,
                fontWeight: 800,
              }}
            >
              設定をリセットして再読み込み
            </button>
          </div>
        </div>
      </div>
    )
  }
}
