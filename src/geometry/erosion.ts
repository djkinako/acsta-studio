/**
 * 白版生成用の erosion（マスク縮小）処理。
 *
 * - アクリル印刷の白版 = カラー版のアルファマスクを N px 縮小したもの（SPEC 6.1 / 5）
 * - erosion はユークリッド距離変換（Felzenszwalb–Huttenlocher 法）で実装する。
 *   「背景までの距離 > radius」の画素だけを残すことで、円板構造要素による
 *   厳密な erosion と等価になる（Chebyshev 正方形のように斜めが削れすぎない）。
 * - 計算量は O(w×h)。2000×2000px・radius 10 でも 1 秒以内に終わる。
 * - DOM / canvas に依存しない純関数のみ（node の vitest で走る）。
 */

/** 距離変換の初期値として使う「無限大」（Infinity 演算を避けるための大きな有限値） */
const INF = 1e20

/**
 * RGBA バッファから二値マスクを作る。
 *
 * - 判定: alpha > threshold を 1（内側）、それ以外を 0 とする（SPEC 6.1: デフォルト alpha > 0）
 * - 入力は ImageData.data 相当の RGBA 並びバッファ
 */
export function alphaMask(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold = 0,
): Uint8Array {
  const n = width * height
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    mask[i] = rgba[i * 4 + 3] > threshold ? 1 : 0
  }
  return mask
}

/**
 * 1次元の二乗距離変換（Felzenszwalb–Huttenlocher 法）。
 *
 * f[0..n-1] を入力、d[0..n-1] に min_q ((p-q)^2 + f[q]) を書き込む。
 * v / z は呼び出し側で確保した作業バッファ（放物線の頂点indexと境界）。
 */
function distanceTransform1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
): void {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    // 放物線 q と v[k] の交点。先に積まれた放物線より左に来る間は取り除く
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dq = q - v[k]
    d[q] = dq * dq + f[v[k]]
  }
}

/**
 * 二値マスクを半径 radiusPx の円板構造要素で erosion する。
 *
 * - 各画素について「最も近い背景（mask=0）画素までのユークリッド距離」を
 *   厳密に求め、distance > radiusPx の画素だけを 1 として残す
 * - 画像外は背景として扱う（画像端に接する不透明領域も端から痩せる）
 * - radiusPx <= 0 は恒等変換（コピーを返す）
 */
export function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radiusPx: number,
): Uint8Array {
  if (radiusPx <= 0) return mask.slice()

  // 画像外＝背景を表すため外周1pxを 0 でパディング
  // （最近傍の「画像外背景」は必ず隣接リング上にあるので 1px で十分）
  const pw = width + 2
  const ph = height + 2
  const grid = new Float64Array(pw * ph) // 二乗距離（背景=0、前景=INF で初期化）
  for (let y = 0; y < height; y++) {
    const rowIn = y * width
    const rowOut = (y + 1) * pw + 1
    for (let x = 0; x < width; x++) {
      grid[rowOut + x] = mask[rowIn + x] ? INF : 0
    }
  }

  const maxDim = Math.max(pw, ph)
  const f = new Float64Array(maxDim)
  const d = new Float64Array(maxDim)
  const v = new Int32Array(maxDim)
  const z = new Float64Array(maxDim + 1)

  // 縦方向の1次元変換
  for (let x = 0; x < pw; x++) {
    for (let y = 0; y < ph; y++) f[y] = grid[y * pw + x]
    distanceTransform1d(f, ph, d, v, z)
    for (let y = 0; y < ph; y++) grid[y * pw + x] = d[y]
  }
  // 横方向の1次元変換（これで2次元の厳密な二乗ユークリッド距離になる）
  for (let y = 0; y < ph; y++) {
    const row = y * pw
    for (let x = 0; x < pw; x++) f[x] = grid[row + x]
    distanceTransform1d(f, pw, d, v, z)
    for (let x = 0; x < pw; x++) grid[row + x] = d[x]
  }

  // distance > radius ⇔ 二乗距離 > radius^2 の画素のみ残す
  const r2 = radiusPx * radiusPx
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const rowIn = (y + 1) * pw + 1
    const rowOut = y * width
    for (let x = 0; x < width; x++) {
      out[rowOut + x] = grid[rowIn + x] > r2 ? 1 : 0
    }
  }
  return out
}

/**
 * 二値マスクから単色塗りの RGBA バッファを作る。
 *
 * - mask=1 の画素のみ (r,g,b,a) で着色、それ以外は完全透明（全チャンネル0）
 * - 編集画面の半透明水色プレビューにも、書き出し時の #000000 塗りにも使う
 */
export function maskToRgba(
  mask: Uint8Array,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number,
): Uint8ClampedArray {
  const n = width * height
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      const o = i * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = a
    }
  }
  return out
}
