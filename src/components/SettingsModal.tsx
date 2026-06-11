import { useSettings, DPI_PRESETS, PAPER_PRESETS } from '../stores/settings'

interface Props {
  onClose: () => void
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 13px',
  borderRadius: 9,
  background: active ? 'var(--text)' : 'var(--bg-chip)',
  color: active ? 'var(--bg-header)' : 'var(--text-mid)',
  fontSize: 12,
  fontWeight: active ? 800 : 700,
  cursor: 'pointer',
  userSelect: 'none',
})

const sectionLabel: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: 'var(--text-sub)',
  letterSpacing: '0.06em',
  marginBottom: 8,
}

const boxStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border-card)',
  borderRadius: 13,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const rowLabel: React.CSSProperties = { width: 150, fontSize: 12.5, fontWeight: 700, flexShrink: 0 }

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={rowLabel}>{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)', minWidth: 0 }}
      />
      <div style={{ width: 70, textAlign: 'right', fontSize: 12.5, fontWeight: 800 }}>
        {format ? format(value) : value} {suffix}
      </div>
    </div>
  )
}

export default function SettingsModal({ onClose }: Props) {
  const s = useSettings()

  return (
    <div
      className="ui-scale"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(77,67,55,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 660,
          maxHeight: '84vh',
          background: 'var(--bg-header)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(60,45,25,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid #efe6d5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="logo-font" style={{ fontSize: 17 }}>
            設定
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 'none',
              background: 'var(--bg-chip)',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text-mid)',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* 用紙とキャンバス */}
          <div>
            <div style={sectionLabel}>用紙とキャンバス</div>
            <div style={boxStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ ...rowLabel, width: 110 }}>用紙サイズ</div>
                <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.keys(PAPER_PRESETS).map((preset) => (
                    <div
                      key={preset}
                      style={chipStyle(s.paperPreset === preset)}
                      onClick={() => s.setPaperPreset(preset)}
                    >
                      {preset}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ ...rowLabel, width: 110 }}>向き</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div
                    style={chipStyle(s.orientation === 'portrait')}
                    onClick={() => s.setOrientation('portrait')}
                  >
                    縦
                  </div>
                  <div
                    style={chipStyle(s.orientation === 'landscape')}
                    onClick={() => s.setOrientation('landscape')}
                  >
                    横
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ ...rowLabel, width: 110 }}>マージン</div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    fontSize: 11,
                    color: 'var(--text-sub)',
                    fontWeight: 700,
                    flexWrap: 'wrap',
                  }}
                >
                  {(
                    [
                      ['top', '上'],
                      ['bottom', '下'],
                      ['left', '左'],
                      ['right', '右'],
                    ] as const
                  ).map(([side, label]) => (
                    <span key={side} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {label}
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={s.margins[side]}
                        onChange={(e) => s.setMargin(side, Number(e.target.value))}
                        style={{
                          width: 52,
                          padding: '5px 8px',
                          borderRadius: 8,
                          border: '1px solid var(--border-input)',
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--text)',
                          fontFamily: "'M PLUS Rounded 1c', sans-serif",
                        }}
                      />
                    </span>
                  ))}
                  <span>mm</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ ...rowLabel, width: 110 }}>解像度（DPI）</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {DPI_PRESETS.map((dpi) => (
                    <div key={dpi} style={chipStyle(s.dpi === dpi)} onClick={() => s.setDpi(dpi)}>
                      {dpi}
                    </div>
                  ))}
                  <input
                    type="number"
                    min={72}
                    max={1200}
                    value={s.dpi}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n) && n > 0) s.setDpi(n)
                    }}
                    style={{
                      width: 64,
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: '1px solid var(--border-input)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text)',
                      fontFamily: "'M PLUS Rounded 1c', sans-serif",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 生成パラメータ */}
          <div>
            <div style={sectionLabel}>カットライン・白版の生成</div>
            <div style={{ ...boxStyle, gap: 14 }}>
              <SliderRow
                label="カットラインオフセット"
                value={s.params.offsetMm}
                min={0.1}
                max={3}
                step={0.1}
                suffix="mm"
                format={(v) => v.toFixed(1)}
                onChange={(v) => s.setParam('offsetMm', v)}
              />
              <SliderRow
                label="角の丸め半径"
                value={s.params.roundMm}
                min={0}
                max={2}
                step={0.1}
                suffix="mm"
                format={(v) => v.toFixed(1)}
                onChange={(v) => s.setParam('roundMm', v)}
              />
              <SliderRow
                label="なめらか補正（ガタつき除去）"
                value={s.params.smoothMm}
                min={0}
                max={2}
                step={0.1}
                suffix="mm"
                format={(v) => v.toFixed(1)}
                onChange={(v) => s.setParam('smoothMm', v)}
              />
              <SliderRow
                label="オブジェクト最小間隔"
                value={s.params.minGapMm}
                min={2}
                max={10}
                step={0.5}
                suffix="mm"
                format={(v) => v.toFixed(1)}
                onChange={(v) => s.setParam('minGapMm', v)}
              />
              <SliderRow
                label="白版の縮小量"
                value={s.params.whiteShrinkPx}
                min={0}
                max={10}
                step={1}
                suffix="px"
                onChange={(v) => s.setParam('whiteShrinkPx', v)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={rowLabel}>輪郭の穴の扱い</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div
                    style={chipStyle(!s.params.includeHoles)}
                    onClick={() => s.setParam('includeHoles', false)}
                  >
                    外周のみ
                  </div>
                  <div
                    style={chipStyle(s.params.includeHoles)}
                    onClick={() => s.setParam('includeHoles', true)}
                  >
                    穴も含む
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* レイヤー名 */}
          <div>
            <div style={sectionLabel}>書き出しレイヤー名（入稿先の指定に合わせてね）</div>
            <div
              style={{
                ...boxStyle,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
              }}
            >
              {(
                [
                  ['print', 'カラー版'],
                  ['cut', 'カットライン'],
                  ['white', '白版'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: 'var(--text-sub)',
                      marginBottom: 4,
                    }}
                  >
                    {label}
                  </div>
                  <input
                    value={s.layerNames[key]}
                    onChange={(e) => s.setLayerName(key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-input)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: '#eaf5f9',
              fontSize: 11,
              color: '#4e89a3',
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            設定は変更した瞬間に全オブジェクトへ反映されて、ブラウザに自動保存されるで（次回起動時も復元）。
          </div>
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #efe6d5',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 36,
              padding: '0 20px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: "'M PLUS Rounded 1c', sans-serif",
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 2px 8px rgba(226,109,142,0.4)',
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
