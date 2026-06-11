import { useEffect, useState } from 'react'
import CheckPage from './CheckPage'
import EditorApp from './components/EditorApp'

/**
 * ルーティング:
 *   デフォルト  → メイン編集画面（Phase 2〜）
 *   #/check    → Phase 1 のカットライン品質検証ページ（デバッグ用に残す）
 */
export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  if (hash === '#/check') return <CheckPage />
  return <EditorApp />
}
