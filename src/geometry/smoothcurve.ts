import type { Point, Ring } from './types'

/**
 * 閉リングの曲線平滑化（なめらか補正の本体）。
 *
 * 1. 弧長に沿って等間隔にリサンプリング
 * 2. ガウシアン重みの循環畳み込みで x, y を平滑化
 *
 * モルフォロジー（オープニング/クロージング）は鋭いトゲや凹みに効くが、
 * 振幅が小さく波長が中程度の「うねり」はほぼ素通しする。
 * ガウシアン平滑化は σ 以下の波長成分を直接減衰させるので、
 * 写真切り抜きのフチノイズ由来の波打ちをシュッとした線にできる。
 *
 * 注意: 平滑化は曲線を内側に縮める（曲率収縮）ことがあるため、
 * 呼び出し側で安全フロア（元輪郭からの最低クリアランス）と union すること。
 */
export function smoothClosedCurve(ring: Ring, sigmaMm: number, stepMm = 0.2): Ring {
  const n = ring.length
  if (n < 3 || sigmaMm <= 0) return ring

  // 1) 弧長リサンプリング
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % n]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    lengths.push(len)
    total += len
  }
  if (total < stepMm * 4) return ring
  const count = Math.max(16, Math.round(total / stepMm))
  const step = total / count
  const resampled: Point[] = []
  let segIdx = 0
  let segPos = 0
  for (let i = 0; i < count; i++) {
    const target = i * step
    while (segPos + lengths[segIdx] < target && segIdx < n - 1) {
      segPos += lengths[segIdx]
      segIdx++
    }
    const a = ring[segIdx]
    const b = ring[(segIdx + 1) % n]
    const t = lengths[segIdx] > 0 ? (target - segPos) / lengths[segIdx] : 0
    resampled.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }

  // 2) ガウシアン循環畳み込み（カーネル半径 = 3σ）
  const sigmaSteps = sigmaMm / step
  const radius = Math.min(Math.ceil(sigmaSteps * 3), Math.floor(count / 2) - 1)
  if (radius < 1) return resampled
  const kernel: number[] = []
  let kernelSum = 0
  for (let k = -radius; k <= radius; k++) {
    const w = Math.exp(-(k * k) / (2 * sigmaSteps * sigmaSteps))
    kernel.push(w)
    kernelSum += w
  }
  const out: Point[] = new Array(count)
  for (let i = 0; i < count; i++) {
    let sx = 0
    let sy = 0
    for (let k = -radius; k <= radius; k++) {
      const p = resampled[(i + k + count) % count]
      const w = kernel[k + radius]
      sx += p.x * w
      sy += p.y * w
    }
    out[i] = { x: sx / kernelSum, y: sy / kernelSum }
  }
  return out
}
