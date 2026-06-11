/**
 * @types/node 未導入のプロジェクト（tsconfig types: ["vite/client"]）で
 * テストからNode組み込みモジュールを使うための最小型シム。
 * vitest 実行時は本物の node:fs / node:path が解決される。
 */
declare module 'node:fs' {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  export function writeFileSync(path: string, data: Uint8Array): void
}

declare module 'node:path' {
  export function dirname(p: string): string
  export function join(...parts: string[]): string
}

declare module 'node:os' {
  export function tmpdir(): string
}
