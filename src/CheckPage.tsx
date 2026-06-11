import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractContours } from './geometry/contour'
import { simplifyClosed } from './geometry/simplify'
import { generateCutline, ringsToSvgPath } from './geometry/offset'
import { effectiveDpi } from './geometry/units'
import type { Polygons } from './geometry/types'

const APP_VERSION = '0.1.0'

interface LoadedImage {
  name: string
  url: string
  width: number
  height: number
  rgba: Uint8ClampedArray
}

/** File/Blob から ImageData 付きの LoadedImage を作る */
async function loadImage(blob: Blob, name: string): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  return {
    name,
    url: canvas.toDataURL('image/png'),
    width: bitmap.width,
    height: bitmap.height,
    rgba: data.data,
  }
}

/** サンプル画像が無いときの内蔵テスト形状（鋭角スター＋細い突起＋近接円） */
function makeBuiltinSample(): Promise<LoadedImage> {
  const size = 420
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#e26d8e'
  // 鋭角5芒星
  ctx.beginPath()
  const cx = 200
  const cy = 210
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 150 : 58
    const a = (Math.PI / 5) * i - Math.PI / 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // 細い突起（アンテナ）
  ctx.fillRect(196, 18, 8, 60)
  ctx.beginPath()
  ctx.arc(200, 16, 14, 0, Math.PI * 2)
  ctx.fill()
  // 近接した小さい円（クロージングで繋がるかの確認用）
  ctx.beginPath()
  ctx.arc(364, 330, 36, 0, Math.PI * 2)
  ctx.fill()
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      void loadImage(blob!, '内蔵サンプル（星形）').then(resolve)
    }, 'image/png')
  })
}

interface PipelineResult {
  contoursRaw: Polygons
  simplified: Polygons
  cutline: Polygons
  rawPoints: number
  simplifiedPoints: number
  extractMs: number
  cutlineMs: number
}

export default function CheckPage() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [offsetMm, setOffsetMm] = useState(0.5)
  const [roundMm, setRoundMm] = useState(0.5)
  const [tolMm, setTolMm] = useState(0.05)
  const [widthMm, setWidthMm] = useState(60)
  const [threshold, setThreshold] = useState(0)
  const [includeHoles, setIncludeHoles] = useState(false)
  const [showImage, setShowImage] = useState(true)
  const [showContour, setShowContour] = useState(false)
  const [showCutline, setShowCutline] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 起動時: public/sample.png があればそれ、無ければ内蔵サンプル
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('./sample.png')
        if (!res.ok) throw new Error('no sample')
        const blob = await res.blob()
        const img = await loadImage(blob, 'sample.png')
        if (img.width === 0) throw new Error('bad image')
        if (!cancelled) setImage(img)
      } catch {
        const img = await makeBuiltinSample()
        if (!cancelled) setImage(img)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (!file || !file.type.includes('png')) return
    void loadImage(file, file.name).then(setImage)
  }, [])

  // 輪郭抽出（画像・しきい値が変わったときだけ）
  const extraction = useMemo(() => {
    if (!image) return null
    const t0 = performance.now()
    const contoursPx = extractContours(image.rgba, image.width, image.height, threshold)
    return { contoursPx, ms: performance.now() - t0 }
  }, [image, threshold])

  // mm変換 → 簡略化 → カットライン生成
  const result = useMemo<PipelineResult | null>(() => {
    if (!image || !extraction) return null
    const scale = widthMm / image.width
    const contoursRaw = extraction.contoursPx.map((ring) =>
      ring.map((p) => ({ x: p.x * scale, y: p.y * scale })),
    )
    const t0 = performance.now()
    const simplified = contoursRaw.map((ring) => simplifyClosed(ring, tolMm))
    const cutline = generateCutline(simplified, { offsetMm, roundRadiusMm: roundMm, includeHoles })
    const cutlineMs = performance.now() - t0
    return {
      contoursRaw,
      simplified,
      cutline,
      rawPoints: contoursRaw.reduce((s, r) => s + r.length, 0),
      simplifiedPoints: simplified.reduce((s, r) => s + r.length, 0),
      extractMs: extraction.ms,
      cutlineMs,
    }
  }, [image, extraction, widthMm, tolMm, offsetMm, roundMm, includeHoles])

  const heightMm = image ? (widthMm * image.height) / image.width : 0
  const dpi = image ? effectiveDpi(image.width, widthMm) : 0
  const pad = offsetMm + roundMm + 3
  const cutPath = result ? ringsToSvgPath(result.cutline) : ''
  const contourPath = result ? ringsToSvgPath(result.simplified) : ''

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <div
        style={{
          height: 58,
          background: 'var(--bg-header)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          flexShrink: 0,
        }}
      >
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
          <div style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 700, letterSpacing: '0.08em' }}>
            Phase 1 検証 ・ カットライン品質チェック ・ v{APP_VERSION}
          </div>
        </div>
      </div>

      {/* 本体 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 左パネル */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            background: 'var(--bg-panel)',
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
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
              handleFiles(e.dataTransfer.files)
            }}
          >
            透過PNGをここにドロップ
            <div className="sub">またはクリックして選択</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <div className="card">
            <div className="card-label">カットライン生成パラメータ</div>
            <div className="slider-row">
              <label>オフセット</label>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                value={offsetMm}
                onChange={(e) => setOffsetMm(Number(e.target.value))}
              />
              <span className="val">{offsetMm.toFixed(1)} mm</span>
            </div>
            <div className="slider-row">
              <label>角の丸め半径</label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={roundMm}
                onChange={(e) => setRoundMm(Number(e.target.value))}
              />
              <span className="val">{roundMm.toFixed(1)} mm</span>
            </div>
            <div className="slider-row">
              <label>簡略化許容誤差</label>
              <input
                type="range"
                min={0.01}
                max={0.3}
                step={0.01}
                value={tolMm}
                onChange={(e) => setTolMm(Number(e.target.value))}
              />
              <span className="val">{tolMm.toFixed(2)} mm</span>
            </div>
            <div className="slider-row">
              <label>配置幅（実寸）</label>
              <input
                type="range"
                min={10}
                max={150}
                step={1}
                value={widthMm}
                onChange={(e) => setWidthMm(Number(e.target.value))}
              />
              <span className="val">{widthMm} mm</span>
            </div>
            <div className="slider-row" style={{ marginBottom: 0 }}>
              <label>αしきい値</label>
              <input
                type="range"
                min={0}
                max={254}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="val">&gt; {threshold}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-label">表示</div>
            <label className="toggle-row">
              <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
              カラー版（元画像）
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={showContour}
                onChange={(e) => setShowContour(e.target.checked)}
              />
              抽出輪郭（簡略化後）
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={showCutline}
                onChange={(e) => setShowCutline(e.target.checked)}
              />
              カットライン
            </label>
            <label className="toggle-row" style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={includeHoles}
                onChange={(e) => setIncludeHoles(e.target.checked)}
              />
              輪郭の穴も含める
            </label>
          </div>

          {image && result && (
            <div className="card">
              <div className="card-label">
                {image.name} ・ {image.width}×{image.height}px
              </div>
              <div className="stat-grid">
                <div className="stat-cell">
                  <div className="k">実寸</div>
                  <div className="v">
                    {widthMm.toFixed(1)}×{heightMm.toFixed(1)}mm
                  </div>
                </div>
                <div className="stat-cell">
                  <div className="k">実効DPI</div>
                  <div className="v">{Math.round(dpi)}</div>
                </div>
                <div className="stat-cell">
                  <div className="k">輪郭点数</div>
                  <div className="v">
                    {result.rawPoints} → {result.simplifiedPoints}
                  </div>
                </div>
                <div className="stat-cell">
                  <div className="k">処理時間</div>
                  <div className="v">
                    {(result.extractMs + result.cutlineMs).toFixed(0)} ms
                  </div>
                </div>
              </div>
              {dpi < 350 ? (
                <div className="dpi-warn">⚠ 実効{Math.round(dpi)}dpi（350未満）。配置幅を小さくするか高解像度の画像を使ってね</div>
              ) : (
                <div className="dpi-ok">✓ 350dpi以上で配置できとるよ</div>
              )}
            </div>
          )}
        </div>

        {/* キャンバス */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#efe5d4',
            backgroundImage: 'radial-gradient(rgba(141,116,77,0.16) 1px, transparent 1.3px)',
            backgroundSize: '22px 22px',
            padding: 24,
          }}
        >
          {image && result && (
            <div
              style={{
                background: '#fff',
                borderRadius: 2,
                boxShadow: '0 8px 32px rgba(91,72,39,0.22)',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              <svg
                viewBox={`${-pad} ${-pad} ${widthMm + 2 * pad} ${heightMm + 2 * pad}`}
                style={{
                  display: 'block',
                  width: 'min(72vh, 100%)',
                  height: 'auto',
                  maxHeight: '78vh',
                }}
              >
                {showImage && (
                  <image
                    href={image.url}
                    x={0}
                    y={0}
                    width={widthMm}
                    height={heightMm}
                    preserveAspectRatio="none"
                  />
                )}
                {showContour && (
                  <path
                    d={contourPath}
                    fill="none"
                    stroke="#a89a85"
                    strokeWidth={0.12}
                    strokeDasharray="0.6 0.4"
                  />
                )}
                {showCutline && (
                  <path
                    d={cutPath}
                    fill="none"
                    stroke="var(--cut)"
                    strokeWidth={0.25}
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* フッター */}
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
        <span>Phase 1: 輪郭抽出 → 簡略化 → Roundオフセット → クロージング角丸め</span>
        <span style={{ flex: 1 }} />
        {result && (
          <span style={{ color: 'var(--text-sub)' }}>
            カットライン {result.cutline.length} パス ／ 抽出 {result.extractMs.toFixed(0)}ms ＋ 生成{' '}
            {result.cutlineMs.toFixed(0)}ms
          </span>
        )}
      </div>
    </div>
  )
}
