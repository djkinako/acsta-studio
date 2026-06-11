import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 配信のため相対パス必須（プロジェクト規約）
export default defineConfig({
  base: './',
  plugins: [react()],
})
