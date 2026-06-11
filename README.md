# AcSta Studio（アクスタスタジオ）

アクリルスタンドの印刷入稿データをブラウザ上で半自動生成するウェブアプリ。
透過PNGを置くだけでカットライン生成・白版生成・間隔チェックを自動化し、レイヤー分けされた入稿ファイルを書き出す。

- 仕様: [SPEC.md](./SPEC.md)
- 開発計画: [PLAN.md](./PLAN.md)
- UIデザイン: `design/AcSta Studio.dc.html`（Claude Design モック）

## 現在の状態

**Phase 2: メイン編集画面**（v0.2.0）

- 3ペインエディタ: 画像追加（D&D）／選択・ドラッグ移動・回転・拡縮・複製・削除
- 矢印キー微調整（0.1mm、Shiftで1mm）、Undo/Redo（⌘Z / ⌘⇧Z）、複製（⌘D)
- リアルタイム間隔チェック（違反ペア赤表示＋最短距離バッジ）とマージン侵食検出
- ズーム（ピンチ/⌘ホイール）・パン・フィット、カーソルmm座標表示
- レイヤー表示トグル（カラー版・カットライン。白版は Phase 3）
- 同一画像の複製はパイプライン再計算をスキップ（幾何キャッシュ共有）

Phase 1 の検証ページは `#/check` で残してある。

### Phase 1: コア技術スパイク（完了・きなこ品質判定済み）

- アルファチャンネルからの輪郭抽出（marching squares 自前実装）
- Douglas-Peucker 簡略化
- Round ジョインオフセット＋クロージング角丸め（clipper-lib）

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # geometry コアのユニットテスト
npm run build    # 型チェック＋本番ビルド（dist/）
```

`public/sample.png` に透過PNGを置くと起動時にそれを読み込む（無ければ内蔵の星形サンプル）。

## 技術メモ

- 内部座標はすべて mm（float64）。px化は表示・ラスター出力時のみ
- ポリゴン演算は clipper-lib（Clipper 6.4.2 純JS）。clipper2-js 1.2.4 は Round オフセットのバグで不採用
- すべての処理はブラウザ内で完結（サーバー・外部API なし）

## デプロイ

main へ push すると GitHub Actions がテスト→ビルド→GitHub Pages 公開まで自動実行する。
