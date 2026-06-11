import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildLayeredPdf, parseCssColor } from '../src/export/pdfOcg'
import type { ExportModel, ExportObjectModel } from '../src/export/model'
import type { Ring } from '../src/geometry/types'

/** 4×4 RGBA・ピンク/イエロー市松の本物PNG（zlib+CRC込みで生成済みのbase64） */
const COLOR_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVR4nGP4f9P2///suf9hNAMyB0QzEFQBAH3mMNEFPW3pAAAAAElFTkSuQmCC'
/** 4×4 RGBA・#000不透明塗り（白版用）の本物PNG */
const BLACK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR4nGNgYGD4j4ZJFQAABloP8SzApEkAAAAASUVORK5CYII='

/** Illustrator実機確認用サンプルPDFの出力先 */
const SAMPLE_PDF_PATH = '/Users/tairaikushi/.claude/jobs/27ad1f81/tmp/acsta-sample-layered.pdf'

/** 中心(cx,cy)・幅w×高h・rot度（時計回り・y下向き系）の矩形リングを作る */
function rotatedRect(cx: number, cy: number, w: number, h: number, rot: number): Ring {
  const rad = (rot * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const corners = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ]
  return corners.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }))
}

function makeObject(over: Partial<ExportObjectModel>): ExportObjectModel {
  return {
    printUrl: COLOR_PNG,
    whiteUrl: null,
    x: 50,
    y: 60,
    rot: 0,
    imageWidthMm: 40,
    imageHeightMm: 30,
    imageOffsetX: -20,
    imageOffsetY: -15,
    cutline: [rotatedRect(50, 60, 44, 34, 0)],
    ...over,
  }
}

/** A4縦・2オブジェクト（回転30度+白版あり / 回転なし+白版なし）のモデル */
function makeA4Model(): ExportModel {
  return {
    paperW: 210,
    paperH: 297,
    dpi: 350,
    layerNames: { print: 'print', cut: 'cut', white: 'white' },
    cutColor: '#00B4D8',
    cutStrokeMm: 0.1,
    objects: [
      makeObject({
        whiteUrl: BLACK_PNG,
        x: 70,
        y: 100,
        rot: 30,
        imageWidthMm: 60,
        imageHeightMm: 40,
        imageOffsetX: -30,
        imageOffsetY: -20,
        cutline: [rotatedRect(70, 100, 64, 44, 30)],
      }),
      makeObject({
        x: 140,
        y: 200,
        cutline: [rotatedRect(140, 200, 44, 34, 0)],
      }),
    ],
  }
}

/** ページのコンテンツストリームを（FlateDecode等があれば伸長して）文字列化する */
function pageContentText(doc: PDFDocument): string {
  const page = doc.getPage(0)
  const contents = page.node.Contents()
  const streams: PDFRawStream[] = []
  if (contents instanceof PDFRawStream) {
    streams.push(contents)
  } else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const s = page.node.context.lookup(contents.get(i))
      if (s instanceof PDFRawStream) streams.push(s)
    }
  }
  expect(streams.length).toBeGreaterThan(0)
  let text = ''
  for (const s of streams) {
    // decodePDFRawStream は /Filter 無しならそのまま、FlateDecode等なら伸長して返す
    const bytes = decodePDFRawStream(s).decode()
    text += String.fromCharCode(...bytes)
  }
  return text
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

describe('parseCssColor', () => {
  it('#rrggbb と #rgb を 0..1 RGB に変換する', () => {
    expect(parseCssColor('#00B4D8')).toEqual({ r: 0, g: 0xb4 / 255, b: 0xd8 / 255 })
    expect(parseCssColor('#f0a')).toEqual({ r: 1, g: 0, b: 0xaa / 255 })
  })

  it('解釈できない色はシアン #00B4D8 にフォールバックする', () => {
    expect(parseCssColor('cyanish')).toEqual({ r: 0, g: 0xb4 / 255, b: 0xd8 / 255 })
  })
})

describe('buildLayeredPdf', () => {
  it('返り値が %PDF- で始まり、PDFDocument.load で再読込できる', async () => {
    const bytes = await buildLayeredPdf(makeA4Model())
    const head = String.fromCharCode(...bytes.slice(0, 5))
    expect(head).toBe('%PDF-')
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBe(1)
    // 用紙サイズ: A4 210×297mm → 595.28×841.89pt（mm→pt換算の検算）
    const { width, height } = loaded.getPage(0).getSize()
    expect(width).toBeCloseTo((210 * 72) / 25.4, 1)
    expect(height).toBeCloseTo((297 * 72) / 25.4, 1)
  })

  it('カタログに /OCProperties があり OCG が3つ、/Order に cut, print, white の順で並ぶ', async () => {
    const model = makeA4Model()
    model.layerNames = { print: 'プリント', cut: 'カット', white: 'シロ' }
    const bytes = await buildLayeredPdf(model)
    const loaded = await PDFDocument.load(bytes)

    const ocProps = loaded.catalog.lookup(PDFName.of('OCProperties'), PDFDict)
    const ocgs = ocProps.lookup(PDFName.of('OCGs'), PDFArray)
    expect(ocgs.size()).toBe(3)

    const d = ocProps.lookup(PDFName.of('D'), PDFDict)
    const order = d.lookup(PDFName.of('Order'), PDFArray)
    expect(order.size()).toBe(3)
    expect(d.lookup(PDFName.of('BaseState'))).toBe(PDFName.of('ON'))
    expect(d.lookup(PDFName.of('ON'), PDFArray).size()).toBe(3)

    // Order の並び（Illustratorレイヤーパネル 上→下）= cut, print, white
    const names = [0, 1, 2].map((i) => {
      const ocg = order.lookup(i, PDFDict)
      expect(ocg.lookup(PDFName.of('Type'))).toBe(PDFName.of('OCG'))
      const name = ocg.lookup(PDFName.of('Name'))
      expect(name).toBeInstanceOf(PDFHexString)
      return (name as PDFHexString).decodeText()
    })
    expect(names).toEqual(['カット', 'プリント', 'シロ'])
  })

  it('ページ Resources の /Properties に3つの OCG 参照がある', async () => {
    const bytes = await buildLayeredPdf(makeA4Model())
    const loaded = await PDFDocument.load(bytes)
    const page = loaded.getPage(0)
    const resources = page.node.Resources()
    expect(resources).toBeDefined()
    const props = resources!.lookup(PDFName.of('Properties'), PDFDict)
    expect(props.keys().map((k) => k.decodeText()).sort()).toEqual([
      'ocCut',
      'ocPrint',
      'ocWhite',
    ])
  })

  it('コンテンツストリームに BDC/EMC ペアが3組あり、white→print→cut の描画順になっている', async () => {
    const bytes = await buildLayeredPdf(makeA4Model())
    const loaded = await PDFDocument.load(bytes)
    const text = pageContentText(loaded)

    expect(countMatches(text, /\bBDC\b/g)).toBeGreaterThanOrEqual(3)
    expect(countMatches(text, /\bEMC\b/g)).toBeGreaterThanOrEqual(3)
    expect(countMatches(text, /\/OC\s/g)).toBeGreaterThanOrEqual(3)

    // 描画順（= cut が最前面）: white が最初、cut が最後
    const posWhite = text.indexOf('/ocWhite')
    const posPrint = text.indexOf('/ocPrint')
    const posCut = text.indexOf('/ocCut')
    expect(posWhite).toBeGreaterThanOrEqual(0)
    expect(posWhite).toBeLessThan(posPrint)
    expect(posPrint).toBeLessThan(posCut)

    // 画像描画: print 2枚 + white 1枚 = Do が3回
    expect(countMatches(text, /\bDo\b/g)).toBe(3)
    // カットライン: ベクターパスのストロークがある（塗りなし）
    expect(countMatches(text, /\bS\b/g)).toBeGreaterThanOrEqual(1)
    expect(countMatches(text, /\bm\b/g)).toBeGreaterThanOrEqual(2) // リング2本 → m 2回
    expect(countMatches(text, /\bf\b/g)).toBe(0) // 塗りは使わない
    // ストローク色 #00B4D8 → 0 0.7059 0.8471 RG
    expect(text).toMatch(/0 0\.7059 0\.8471 RG/)
    // 線幅 0.1mm → 0.2835pt
    expect(text).toMatch(/0\.2835 w/)
  })

  it('回転なしオブジェクトの cm 行列が正しい位置・サイズになる（座標変換の検算）', async () => {
    // 1オブジェクトだけのモデル: 中心(140,200) 40×30mm offset(-20,-15) 回転なし
    // 画像左下隅: ワールド(120, 215) → PDF (120k, (297-215)k) = (340.157, 232.441)pt
    // 下辺ベクトル = (40k, 0) = (113.386, 0)、左辺ベクトル = (0, 30k) = (0, 85.039)
    const model = makeA4Model()
    model.objects = [model.objects[1]]
    const bytes = await buildLayeredPdf(model)
    const loaded = await PDFDocument.load(bytes)
    const text = pageContentText(loaded)
    expect(text).toContain('113.3858 0 0 85.0394 340.1575 232.4409 cm')
  })

  it('白版なしオブジェクトのみでも white レイヤーの BDC/EMC は出力される', async () => {
    const model = makeA4Model()
    model.objects = [model.objects[1]] // whiteUrl: null のみ
    const bytes = await buildLayeredPdf(model)
    const loaded = await PDFDocument.load(bytes)
    const text = pageContentText(loaded)
    expect(countMatches(text, /\bBDC\b/g)).toBe(3)
    expect(countMatches(text, /\bDo\b/g)).toBe(1) // print 1枚のみ
  })

  it('Illustrator実機確認用のサンプルPDF（A4・2オブジェクト）を書き出す', async () => {
    const bytes = await buildLayeredPdf(makeA4Model())
    mkdirSync(dirname(SAMPLE_PDF_PATH), { recursive: true })
    writeFileSync(SAMPLE_PDF_PATH, bytes)
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
