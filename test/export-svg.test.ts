import { describe, expect, it } from 'vitest'
import { buildExportSvg } from '../src/export/svg'
import { buildIllustratorJsx } from '../src/export/jsxScript'
import type { ExportModel, ExportObjectModel } from '../src/export/model'

const PRINT_URL_A = 'data:image/png;base64,xxxxAAAA'
const PRINT_URL_B = 'data:image/png;base64,xxxxBBBB'
const WHITE_URL_A = 'data:image/png;base64,xxxxWHITE'

/** ダミーオブジェクト（10mm角のカットライン付き） */
function makeObject(overrides: Partial<ExportObjectModel> = {}): ExportObjectModel {
  return {
    printUrl: PRINT_URL_A,
    whiteUrl: WHITE_URL_A,
    x: 105,
    y: 80.5,
    rot: 15,
    imageWidthMm: 50,
    imageHeightMm: 40,
    imageOffsetX: -25,
    imageOffsetY: -20,
    cutline: [
      [
        { x: 80, y: 60 },
        { x: 130, y: 60 },
        { x: 130, y: 100 },
        { x: 80, y: 100 },
      ],
    ],
    ...overrides,
  }
}

/** ダミーモデル（A4縦・2オブジェクト、2つ目は白版なし） */
function makeModel(overrides: Partial<ExportModel> = {}): ExportModel {
  return {
    paperW: 210,
    paperH: 297,
    dpi: 350,
    layerNames: { print: 'print-layer', cut: 'cut-layer', white: 'white-layer' },
    cutColor: '#00B4D8',
    cutStrokeMm: 0.1,
    objects: [
      makeObject(),
      makeObject({ printUrl: PRINT_URL_B, whiteUrl: null, x: 50, y: 200, rot: 0 }),
    ],
    ...overrides,
  }
}

/** id 指定の <g> の中身（開始タグ〜対応する </g> 直前）を取り出す。グループは入れ子にしない前提 */
function groupContent(svg: string, id: string): string {
  const open = `<g id="${id}">`
  const start = svg.indexOf(open)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = svg.indexOf('</g>', start)
  expect(end).toBeGreaterThan(start)
  return svg.slice(start + open.length, end)
}

describe('buildExportSvg', () => {
  it('3つの <g> がレイヤー名通り・print→cut→white の順序で存在する', () => {
    const svg = buildExportSvg(makeModel())
    const iPrint = svg.indexOf('<g id="print-layer">')
    const iCut = svg.indexOf('<g id="cut-layer">')
    const iWhite = svg.indexOf('<g id="white-layer">')
    expect(iPrint).toBeGreaterThanOrEqual(0)
    expect(iCut).toBeGreaterThan(iPrint)
    expect(iWhite).toBeGreaterThan(iCut)
    // <g> はちょうど3つ
    expect(svg.match(/<g /g)).toHaveLength(3)
  })

  it('ルートのサイズと viewBox が用紙mmと一致する', () => {
    const svg = buildExportSvg(makeModel())
    expect(svg).toContain('width="210mm"')
    expect(svg).toContain('height="297mm"')
    expect(svg).toContain('viewBox="0 0 210 297"')
    // mm実寸の別用紙でも追従する
    const svgB5 = buildExportSvg(makeModel({ paperW: 182, paperH: 257, objects: [] }))
    expect(svgB5).toContain('width="182mm"')
    expect(svgB5).toContain('height="257mm"')
    expect(svgB5).toContain('viewBox="0 0 182 257"')
  })

  it('cutパスは fill="none"・指定ストローク色・線幅mm のベクターパスになる', () => {
    const svg = buildExportSvg(makeModel())
    const cut = groupContent(svg, 'cut-layer')
    // オブジェクト2個分のパス
    const paths = cut.match(/<path /g)
    expect(paths).toHaveLength(2)
    expect(cut).toContain('fill="none"')
    expect(cut).toContain('stroke="#00B4D8"')
    expect(cut).toContain('stroke-width="0.1"')
    // ワールドmm座標のままパス化されている（変換なし）
    expect(cut).toContain('d="M 80.000 60.000 L 130.000 60.000 L 130.000 100.000 L 80.000 100.000 Z"')
  })

  it('画像は translate(x y) rotate(rot) で配置され、ローカル座標の矩形に描画される', () => {
    const svg = buildExportSvg(makeModel())
    const print = groupContent(svg, 'print-layer')
    expect(print).toContain('transform="translate(105 80.5) rotate(15)"')
    expect(print).toContain('x="-25" y="-20" width="50" height="40"')
    // 2つ目のオブジェクト（回転0）
    expect(print).toContain('transform="translate(50 200) rotate(0)"')
    // dataURL は href と xlink:href の両方に出る（Illustrator互換）
    expect(print).toContain(`href="${PRINT_URL_A}"`)
    expect(print).toContain(`xlink:href="${PRINT_URL_A}"`)
  })

  it('白版なしオブジェクトは white グループに含まれない', () => {
    const svg = buildExportSvg(makeModel())
    const white = groupContent(svg, 'white-layer')
    // 白版ありの1オブジェクトのみ
    expect(white.match(/<image /g)).toHaveLength(1)
    expect(white).toContain(WHITE_URL_A)
    // 白版なしオブジェクトのカラー版URLが紛れ込んでいない
    expect(white).not.toContain(PRINT_URL_B)
    // print グループには2オブジェクトとも入っている
    expect(groupContent(svg, 'print-layer').match(/<image /g)).toHaveLength(2)
  })

  it('レイヤー名に " や < が入っても XML エスケープされて壊れない', () => {
    const svg = buildExportSvg(
      makeModel({
        layerNames: { print: 'pri"nt', cut: 'cu<t>', white: 'wh&ite' },
      }),
    )
    expect(svg).toContain('<g id="pri&quot;nt">')
    expect(svg).toContain('<g id="cu&lt;t&gt;">')
    expect(svg).toContain('<g id="wh&amp;ite">')
    // 生の " や < が属性値内に漏れていない（タグ構造が壊れない）
    expect(svg).not.toContain('id="pri"nt"')
    expect(svg).not.toContain('id="cu<t>"')
  })
})

describe('buildIllustratorJsx', () => {
  it('3つのレイヤー名を含む .jsx スクリプト文字列を返す', () => {
    const jsx = buildIllustratorJsx({ print: 'print-layer', cut: 'cut-layer', white: 'white-layer' })
    expect(jsx).toContain("print: 'print-layer'")
    expect(jsx).toContain("cut: 'cut-layer'")
    expect(jsx).toContain("white: 'white-layer'")
    // ExtendScript として最低限の構造（レイヤー移動・順序整列・報告）を持つ
    expect(jsx).toContain('app.activeDocument')
    expect(jsx).toContain('ZOrderMethod.SENDTOBACK')
    expect(jsx).toContain('ZOrderMethod.BRINGTOFRONT')
    expect(jsx).toContain('alert(')
  })

  it("レイヤー名の ' や \\ はJS文字列リテラル用にエスケープされる", () => {
    const jsx = buildIllustratorJsx({ print: "pri'nt", cut: 'cu\\t', white: 'white' })
    expect(jsx).toContain("print: 'pri\\'nt'")
    expect(jsx).toContain("cut: 'cu\\\\t'")
  })
})
