import { useEffect, useRef, useState } from 'react'
import { useSettings, paperSizeOf } from '../stores/settings'
import { buildExportModel } from '../export/buildModel'
import { buildExportSvg } from '../export/svg'
import { buildIllustratorJsx } from '../export/jsxScript'
import { downloadBlob, downloadText } from '../export/download'
import { APP_VERSION } from '../version'
import SettingsModal from './SettingsModal'
import type { ObjectView } from './EditorApp'

interface Props {
  views: ObjectView[]
  violationCount: number
}

export default function Header({ views, violationCount }: Props) {
  const [projectName, setProjectName] = useState('新規プロジェクト')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [exportOpen])

  /** 違反が残ったままの書き出しのみ例外的に確認を挟む（SPEC 6.3 / 8） */
  const confirmIfViolating = (): boolean => {
    if (violationCount === 0) return true
    return window.confirm(
      `間隔違反が ${violationCount} 件残っとるけど、このまま書き出す？\n（違反箇所はカット時にくっつく可能性があるで）`,
    )
  }

  const makeModel = () => {
    const s = useSettings.getState()
    const paper = paperSizeOf(s)
    return buildExportModel(views, {
      paperW: paper.w,
      paperH: paper.h,
      dpi: s.dpi,
      layerNames: s.layerNames,
      cutColor: s.cutColor,
      whiteShrinkPx: s.params.whiteShrinkPx,
    })
  }

  const fileBase = projectName.trim() === '' ? 'acsta' : projectName.trim()

  const exportSvg = () => {
    if (!confirmIfViolating()) return
    setExportOpen(false)
    const model = makeModel()
    downloadText(`${fileBase}.svg`, buildExportSvg(model), 'image/svg+xml')
    downloadText(
      `${fileBase}_レイヤー化.jsx`,
      buildIllustratorJsx(useSettings.getState().layerNames),
      'application/javascript',
    )
  }

  const exportPdf = async () => {
    if (!confirmIfViolating()) return
    setExportOpen(false)
    setExporting(true)
    try {
      // pdf-lib はサイズが大きいので必要時にだけロードする
      const { buildLayeredPdf } = await import('../export/pdfOcg')
      const bytes = await buildLayeredPdf(makeModel())
      downloadBlob(`${fileBase}.pdf`, new Blob([bytes as BlobPart], { type: 'application/pdf' }))
    } catch (err) {
      console.error(err)
      window.alert('PDF書き出しでエラーが出たわ…コンソール見てな。SVG書き出しは使えるはずや。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="ui-scale"
      style={{
        height: 58,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 14,
        flexShrink: 0,
        position: 'relative',
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
        title="設定"
        onClick={() => setSettingsOpen(true)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid var(--border-input)',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 歯車アイコン（放射線だと太陽＝テーマ切替に見えるため、歯付きギアで「設定」を明示） */}
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-mid)"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3.1" />
          <path d="M 19.5,13.4 a 7.8,7.8 0 0 0 0,-2.8 l 2.1,-1.6 -1.9,-3.3 -2.5,0.9 a 7.7,7.7 0 0 0 -2.4,-1.4 L 14.4,2.6 h -3.8 l -0.4,2.6 a 7.7,7.7 0 0 0 -2.4,1.4 l -2.5,-0.9 -1.9,3.3 2.1,1.6 a 7.8,7.8 0 0 0 0,2.8 l -2.1,1.6 1.9,3.3 2.5,-0.9 a 7.7,7.7 0 0 0 2.4,1.4 l 0.4,2.6 h 3.8 l 0.4,-2.6 a 7.7,7.7 0 0 0 2.4,-1.4 l 2.5,0.9 1.9,-3.3 z" />
        </svg>
      </button>

      <div style={{ position: 'relative' }} ref={exportRef}>
        <button
          onClick={() => setExportOpen((v) => !v)}
          disabled={views.length === 0 || exporting}
          style={{
            height: 36,
            padding: '0 18px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent)',
            opacity: views.length === 0 ? 0.45 : 1,
            cursor: views.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: "'M PLUS Rounded 1c', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(226,109,142,0.4)',
          }}
        >
          {exporting ? '書き出し中…' : '書き出し'}
        </button>

        {exportOpen && (
          <div
            style={{
              position: 'absolute',
              top: 44,
              right: 0,
              width: 280,
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: '0 10px 30px rgba(91,72,39,0.18)',
              padding: 8,
              zIndex: 50,
            }}
          >
            <div
              onClick={() => void exportPdf()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fbf3f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: '#fbe3ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#c2557a',
                  flexShrink: 0,
                }}
              >
                PDF
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>レイヤー付きPDF</div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                  print / cut / white の3層 ・ 推奨
                </div>
              </div>
            </div>

            <div
              onClick={exportSvg}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fbf3f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: 'var(--bg-chip)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--text-mid)',
                  flexShrink: 0,
                }}
              >
                SVG
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>SVG + 変換スクリプト</div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                  Illustratorでレイヤー化する.jsx同梱
                </div>
              </div>
            </div>

            {violationCount > 0 && (
              <div
                style={{
                  margin: '6px 4px 4px',
                  padding: '8px 10px',
                  borderRadius: 9,
                  background: 'var(--danger-bg)',
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 12, lineHeight: 1.3 }}>⚠️</span>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--danger-text)',
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  間隔違反が{violationCount}件あります。このまま書き出すこともできます。
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
