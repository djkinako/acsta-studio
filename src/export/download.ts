/**
 * ダウンロード発火ユーティリティ（DOM使用OKな唯一のexport層モジュール）。
 * Blob + 一時 <a> タグでブラウザのダウンロードを起動する。
 */

/** Blob を指定ファイル名でダウンロードさせる */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** テキスト（SVG / .jsx など）を指定ファイル名でダウンロードさせる */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }))
}
