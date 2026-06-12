# AcSta Studio 引き継ぎ書

**最終更新: 2026-06-12（開発2日目終了時点）／ 現行バージョン: v0.9.0**

次回セッションの開発者（番頭）へ。これ読めば即再開できるようにまとめてある。

---

## 1. プロジェクト概要（30秒で把握）

- **何**: アクリルスタンド/アクキーの印刷入稿データをブラウザで半自動生成するツール。透過PNG → カットライン・白版・間隔チェック → レイヤー付きPDF/SVG書き出し
- **正典ドキュメント**: `SPEC.md`（仕様 v1.0）／ `PLAN.md`（8フェーズ計画）／ UIモック `design/AcSta Studio.dc.html`
- **公開URL**: https://djkinako.github.io/acsta-studio/ （main に push → GitHub Actions が test→build→Pages 自動デプロイ）
- **リポ**: https://github.com/djkinako/acsta-studio
- **技術**: React 18 + Vite + TS + Zustand。ポリゴン演算は **clipper-lib**（純JS）。OpenCV.js 不使用（輪郭抽出は自前 marching squares）。pdf-lib は書き出し時のみ遅延ロード
- **Phase 1 検証ページ**が `#/check` に残してある（カットライン品質のデバッグ用）

## 2. 進捗状況（フェーズ別）

| Phase | 内容 | 状態 |
|---|---|---|
| 0-1 | 足場＋カットライン生成コア | ✅ 完了（きなこ品質判定「最高」） |
| 2 | 編集キャンバス（配置・回転・拡縮・複製・Undo・間隔チェック） | ✅ 完了 |
| 3 | 白版（erosion・水色可視化・トグル） | ✅ 完了 |
| 4 | SVG書き出し＋Illustrator用 .jsx | ✅ 実装済み・**イラレ実機検証が未了** |
| 5 | レイヤー付きPDF（OCG） | ✅ 実装済み・**イラレ実機検証が未了** |
| 6 | スタンドパーツ（タブ・ポッチ・台座） | ✅ 完了・**寸法は仮値** |
| 7 | 設定メニュー | ✅ 完了（前倒し）／ **プリセット保存・プロジェクト保存は未実装** |
| 8 | Pagesデプロイ | ✅ 完了（CI込み） |

## 3. 次回の最有力タスク

1. **プロジェクト保存/読込（JSON）**: 配置＋設定を保存・復元（画像はbase64埋め込み）。SPEC 7.2「その他」参照。きなこ承認済みの次候補
2. **プリセット保存**: 入稿先A/B等の設定セット切替（SPEC 5）。設定モーダルに組み込む
3. **きなこ待ちで進められないもの**:
   - パーツ実寸差し替え（入稿先テンプレSVG待ち）→ 来たら `src/parts/defs.ts` の数値を差し替えるだけ
   - Illustrator実機検証（PDF/SVG+jsx）→ きなこのイラレ環境待ち。確認観点は `test/export-pdf.test.ts` 冒頭コメントと過去チャット参照
   - 入稿先の正式レイヤー名・カットライン指定色

## 4. アーキテクチャ地図（どこに何があるか）

```
src/
├── geometry/        ★コア。DOM非依存の純関数（mm座標系・vitestで検証）
│   ├── contour.ts     marching squares 輪郭抽出（alpha>2）
│   ├── simplify.ts    Douglas-Peucker
│   ├── offset.ts      Round オフセット・クロージング・なめらか補正・union・closeCorners
│   ├── smoothcurve.ts ガウシアン曲線平滑化（なめらか補正の本体）
│   ├── erosion.ts     白版用の厳密ユークリッド距離変換 erosion
│   └── transform.ts   回転/平行移動・bbox・最短距離
├── parts/           パーツ（⚠寸法は仮値、ここだけ差し替えれば確定）
│   ├── defs.ts        タブS/M/L・ポッチK3/K5・台座 小/中/大 の寸法と形状生成
│   └── attach.ts      輪郭弧長パラメータt・吸着方向・最近接点
├── pipeline/
│   ├── sources.ts     画像レジストリ＋ジオメトリキャッシュ（タブunion・接合部丸めもここ）
│   └── violations.ts  間隔違反・マージン侵食判定
├── export/          書き出し（ExportModel 経由、ストア非依存）
│   ├── model.ts       中間モデル定義（printUrl は null 可 = カットのみパーツ）
│   ├── buildModel.ts  ObjectView → ExportModel
│   ├── svg.ts / jsxScript.ts / pdfOcg.ts / download.ts
├── stores/          Zustand: settings(persist+deepマージ) / project(Undo履歴) / ui
└── components/      EditorApp(統括) / CanvasView(最大・操作全部) / 各パネル
```

**重要な設計判断**（理由ごと覚えとくこと）:
- 内部座標は**すべてmm（float64）**。px化は表示と出力時のみ
- 「幅」「実効DPI」は**透明余白を除いた不透明領域基準**（きなこ要望）
- **タブは紙面に常に垂直**（輪郭法線基準やと画像フチの歪みでスタンド角度が狂う）。回転0.5°単位でジオメトリキャッシュ
- **台座・ポッチの穴寸法は固定**（タブとの嵌合・キーホルダー金具のため）。台座外形だけ縦横自由
- なめらか補正 = オープニング＋ガウシアン平滑化＋**二重安全フロア**（絵に食い込まない構造的保証）
- 設定ストアは persist の `merge` で**常にデフォルトとディープマージ**（旧データに新キーが無くてもクラッシュしない。v0.6.0白画面事故の再発防止）

## 5. ハマりどころ（必読）

- **依存追加後の dev サーバー**: `rm -rf node_modules/.vite` + `--force` で起動せんと「Invalid hook call」が出る
- **QAは旧 localStorage が残った状態でも必ず確認**（v0.6.0で設定画面が白画面クラッシュした）
- **clipper2-js は使うな**: Round オフセットで角の円弧が壊れるバグあり（不採用済み、clipper-lib を使う）
- ポッチ等で**逆回転リング（穴）を union する時**、他の正リングが穴に重なると NonZero で穴が埋まる（かまぼこ穴事件）。形状定義側で重なりを避けること
- vite の HMR で `sources.ts` のレジストリ（モジュール変数）が飛ぶ → 開発中は画像再アップロードが必要
- CI（GitHub Actions）でもテストが走る。**ローカル固有パスをテストに書かない**（OS tmpdir を使う）
- 検証用画像: `public/sample.png`（いらすとや系・gitignore済みローカル専用）。フチノイズ再現PNGは Python スクリプトで生成した（過去チャット参照、420×640・sin+乱数ノイズ＋alpha2ハロー）

## 6. 開発コマンド

```bash
npm run dev        # 開発サーバー（依存変更後は rm -rf node_modules/.vite && npx vite --force）
npm test           # vitest 64件（geometry/transform/erosion/parts/export-svg/export-pdf）
npm run build      # tsc -b + vite build
# デプロイは main へ push するだけ（Actions が test→build→Pages）
```

## 7. 今日（2日目）やったことの要約

- v0.6.0-0.6.1: **なめらか補正**（写真切り抜きのガタガタ線対策）＋設定クラッシュ修正＋歯車アイコン＋ErrorBoundary
- v0.7.0: **Phase 6 パーツシステム**（タブDnD吸着・union・輪郭スライド・穴付き台座・書き出し反映）＋ UI 1.18倍拡大
- v0.8.0: ハンドルUX刷新（ピンク⇄グリップ）・×削除ボタン・接合部丸め・**アクキーポッチ（穴3/5mm）**・台座拡縮
- v0.9.0: **タブ垂直化**・長さ可変＋差込3mm強調帯・かまぼこ穴修正・ラベル操作妨害解消・台座縦横独立

（1日目: Phase 0〜5 一式。v0.1.0→v0.5.0。並行エージェント3体で白版/SVG/PDF を同時開発した）

## 8. きなこの好み・運用メモ

- 音声入力派。フィードバックは長文多論点で来る → bullet で整理して全部拾うこと
- 「ガンガン進めて」=自走OK・マルチエージェントOKの人。ただし**勝手な仕様変更はせず、判断はきなこに渡す**
- バージョンは変更のたびに必ず上げる（title とヘッダー表示で実機反映を確認する運用）
- UIはポップで大きめ・モック（`design/`）のクリーム×ピンクが正
- GitHub の URL は必ずチャットに直貼り。Issue クローズはきなこ承認制
