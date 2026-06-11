import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames as Ops,
} from 'pdf-lib'
import type { PDFPage, PDFRef } from 'pdf-lib'
import type { ExportModel, ExportObjectModel } from './model'

/**
 * レイヤー付きPDF（OCG: Optional Content Groups）ビルダー。SPEC 7.2 のメイン書き出し。
 *
 * - 1ファイルに print / cut / white の3レイヤーを OCG として格納する。
 *   Illustrator はカタログの /OCProperties /D /Order の並びをレイヤーパネル
 *   （上→下）として表示するため、Order は [cut, print, white] にしている。
 * - 描画順（コンテンツストリーム）は white → print → cut。PDFは後に描いたものが
 *   前面に来るので、カットラインが最前面・白版が最背面になる。
 * - 各レイヤーの内容は `/OC /ocXX BDC ... EMC` のマークコンテンツで囲み、
 *   ページ Resources の /Properties 経由で OCG を参照する。
 * - DOM 非依存（dataURL文字列は pdf-lib の embedPng がそのまま受ける）。
 *
 * 座標系の検算メモ:
 * - ワールド: mm・原点左上・y下向き。PDF: pt・原点左下・y上向き。
 *   変換は X = wx*k, Y = (paperH - wy)*k （k = 72/25.4）。
 *   検算: ワールド(0,0)=用紙左上 → PDF(0, paperH*k)=ページ左上 ✓
 *         ワールド(0,paperH)=用紙左下 → PDF(0,0)=ページ左下 ✓
 * - 回転 rot は「y下向き座標系での時計回り」。y下向き系では画面上の時計回りが
 *   数学の標準回転行列 (x',y') = (x cosθ − y sinθ, x sinθ + y cosθ) に一致する。
 *   検算: (1,0)（右向き）を90°回転 → (0,1) = 画面下向き = 時計回り ✓
 */

/** mm → pt 換算係数（1mm = 72/25.4 pt ≒ 2.8346） */
const MM_TO_PT = 72 / 25.4

/** PDF座標（pt・y上向き） */
interface PtPoint {
  x: number
  y: number
}

/** 数値→PDF演算子引数（小数4桁 ≒ 0.035µm 精度に丸めてストリームを軽くする） */
function num(v: number): PDFNumber {
  return PDFNumber.of(Math.round(v * 1e4) / 1e4)
}

/**
 * CSSカラー（#rgb / #rrggbb）→ 0..1 RGB。
 * 解釈できない場合はデフォルトのシアン #00B4D8 にフォールバック（SPEC 7.1）。
 */
export function parseCssColor(css: string): { r: number; g: number; b: number } {
  const m6 = /^#([0-9a-f]{6})$/i.exec(css.trim())
  if (m6) {
    const n = parseInt(m6[1], 16)
    return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 }
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(css.trim())
  if (m3) {
    const [r, g, b] = m3[1].split('').map((c) => parseInt(c + c, 16) / 255)
    return { r, g, b }
  }
  return { r: 0x00 / 255, g: 0xb4 / 255, b: 0xd8 / 255 }
}

/**
 * 配置済み画像1枚ぶんの描画演算子を組む。
 *
 * PDFの画像XObjectは単位正方形（(0,0)=画像左下、(0,1)=画像左上）に描かれるため、
 * cm 行列 [a b c d e f] は
 *   (a,b) = 画像下辺ベクトル（左下→右下）
 *   (c,d) = 画像左辺ベクトル（左下→左上）
 *   (e,f) = 画像左下隅の位置
 * を、ワールド回転を反映した実座標から直接構成する（回転の符号間違いが起きない）。
 *
 * 検算（回転なし: 中心(50,50) offset(-10,-5) 20×10mm 用紙高100mm）:
 *   左下隅ワールド = (40, 55) → PDF (40k, 45k)、左上隅 = (40,45) → PDF (40k, 55k)
 *   → a=20k, b=0, c=0, d=10k, e=40k, f=45k。画像上端が PDF y=55k = ワールドy45mm ✓
 */
function imageOperators(
  obj: ExportObjectModel,
  xobjName: PDFName,
  toPdf: (wx: number, wy: number) => PtPoint,
): PDFOperator[] {
  const rad = (obj.rot * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // ローカル座標（中心原点・y下向き・回転前）→ ワールド → PDF pt
  const local = (lx: number, ly: number): PtPoint =>
    toPdf(obj.x + lx * cos - ly * sin, obj.y + lx * sin + ly * cos)

  const { imageOffsetX: ox, imageOffsetY: oy, imageWidthMm: w, imageHeightMm: h } = obj
  const tl = local(ox, oy) // 画像左上（ワールドでの見た目の左上）
  const bl = local(ox, oy + h) // 画像左下
  const br = local(ox + w, oy + h) // 画像右下

  return [
    PDFOperator.of(Ops.PushGraphicsState),
    PDFOperator.of(Ops.ConcatTransformationMatrix, [
      num(br.x - bl.x), // a: 単位正方形 (1,0) → 下辺ベクトル
      num(br.y - bl.y), // b
      num(tl.x - bl.x), // c: 単位正方形 (0,1) → 左辺ベクトル
      num(tl.y - bl.y), // d
      num(bl.x), // e: 左下隅
      num(bl.y), // f
    ]),
    PDFOperator.of(Ops.DrawObject, [xobjName]),
    PDFOperator.of(Ops.PopGraphicsState),
  ]
}

/**
 * カットライン（ワールドmmの閉リング群）のストローク演算子を組む。
 * 塗りなし・ストロークのみ（SPEC 7.1）。全リングを1パスにまとめて一度に S する。
 */
function cutlineOperators(
  model: ExportModel,
  toPdf: (wx: number, wy: number) => PtPoint,
): PDFOperator[] {
  const { r, g, b } = parseCssColor(model.cutColor)
  const ops: PDFOperator[] = [
    PDFOperator.of(Ops.PushGraphicsState),
    PDFOperator.of(Ops.StrokingColorRgb, [num(r), num(g), num(b)]),
    PDFOperator.of(Ops.SetLineWidth, [num(model.cutStrokeMm * MM_TO_PT)]),
    PDFOperator.of(Ops.SetLineJoinStyle, [num(1)]), // round join（カット機が拾いやすい滑らかな角）
    PDFOperator.of(Ops.SetLineCapStyle, [num(1)]), // round cap
  ]
  let hasPath = false
  for (const obj of model.objects) {
    for (const ring of obj.cutline) {
      if (ring.length < 3) continue
      hasPath = true
      const p0 = toPdf(ring[0].x, ring[0].y)
      ops.push(PDFOperator.of(Ops.MoveTo, [num(p0.x), num(p0.y)]))
      for (let i = 1; i < ring.length; i++) {
        const p = toPdf(ring[i].x, ring[i].y)
        ops.push(PDFOperator.of(Ops.LineTo, [num(p.x), num(p.y)]))
      }
      ops.push(PDFOperator.of(Ops.ClosePath))
    }
  }
  ops.push(PDFOperator.of(hasPath ? Ops.StrokePath : Ops.EndPath))
  ops.push(PDFOperator.of(Ops.PopGraphicsState))
  return ops
}

/**
 * レイヤー付きPDFを生成して PDF バイト列を返す。
 *
 * 構造:
 *  - カタログ: /OCProperties << /OCGs [3refs] /D << /Order [cut,print,white]
 *    /ON [3refs] /BaseState /ON >> >>
 *  - ページ Resources: /Properties << /ocCut /ocPrint /ocWhite >>、/XObject に各画像
 *  - コンテンツ: /OC /ocWhite BDC …白版画像… EMC → print → cut の3ブロック
 */
export async function buildLayeredPdf(model: ExportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const ctx = doc.context
  const page: PDFPage = doc.addPage([model.paperW * MM_TO_PT, model.paperH * MM_TO_PT])

  // ワールドmm（原点左上・y下向き）→ PDF pt（原点左下・y上向き）
  const toPdf = (wx: number, wy: number): PtPoint => ({
    x: wx * MM_TO_PT,
    y: (model.paperH - wy) * MM_TO_PT,
  })

  // --- OCG（レイヤー）を3つ登録 ---
  const makeOcg = (name: string): PDFRef =>
    ctx.register(ctx.obj({ Type: 'OCG', Name: PDFHexString.fromText(name) }))
  const cutOcg = makeOcg(model.layerNames.cut)
  const printOcg = makeOcg(model.layerNames.print)
  const whiteOcg = makeOcg(model.layerNames.white)

  // Illustrator のレイヤーパネル順（上→下）= /D /Order の並び: cut, print, white
  const orderedOcgs = [cutOcg, printOcg, whiteOcg]
  doc.catalog.set(
    PDFName.of('OCProperties'),
    ctx.obj({
      OCGs: orderedOcgs,
      D: {
        Order: orderedOcgs,
        ON: orderedOcgs,
        BaseState: 'ON',
      },
    }),
  )

  // --- ページ Resources /Properties に OCG を登録（BDC が /ocXX で参照する） ---
  const { Resources } = page.node.normalizedEntries()
  Resources.set(
    PDFName.of('Properties'),
    ctx.obj({ ocCut: cutOcg, ocPrint: printOcg, ocWhite: whiteOcg }),
  )

  // --- 画像を埋め込み、XObjectリソース名を確保 ---
  const printImages: { obj: ExportObjectModel; name: PDFName }[] = []
  const whiteImages: { obj: ExportObjectModel; name: PDFName }[] = []
  for (const obj of model.objects) {
    const printImg = await doc.embedPng(obj.printUrl)
    printImages.push({ obj, name: page.node.newXObject('AcstaPrint', printImg.ref) })
    if (obj.whiteUrl !== null) {
      const whiteImg = await doc.embedPng(obj.whiteUrl)
      whiteImages.push({ obj, name: page.node.newXObject('AcstaWhite', whiteImg.ref) })
    }
  }

  // --- コンテンツストリーム（描画順: white → print → cut = cutが最前面） ---
  const beginLayer = (propKey: string): PDFOperator =>
    PDFOperator.of(Ops.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of(propKey)])
  const endLayer = (): PDFOperator => PDFOperator.of(Ops.EndMarkedContent)

  const ops: PDFOperator[] = []

  // 白版レイヤー（whiteUrl ありのオブジェクトのみ。空でも BDC/EMC は出してレイヤーを成立させる）
  ops.push(beginLayer('ocWhite'))
  for (const { obj, name } of whiteImages) ops.push(...imageOperators(obj, name, toPdf))
  ops.push(endLayer())

  // カラー版レイヤー
  ops.push(beginLayer('ocPrint'))
  for (const { obj, name } of printImages) ops.push(...imageOperators(obj, name, toPdf))
  ops.push(endLayer())

  // カットラインレイヤー（ベクター・最前面）
  ops.push(beginLayer('ocCut'))
  ops.push(...cutlineOperators(model, toPdf))
  ops.push(endLayer())

  page.pushOperators(...ops)

  // useObjectStreams: false — オブジェクトストリーム（PDF1.5圧縮機構）を使わず
  // プレーンなxref構造で保存。Illustrator等の互換性とテストでの検証性を優先。
  return doc.save({ useObjectStreams: false })
}
