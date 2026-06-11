/**
 * Illustrator 変換スクリプト（.jsx / ExtendScript）ジェネレータ。
 * buildExportSvg で書き出したSVGを Illustrator で開いた後にこのスクリプトを
 * 実行すると、名前付きグループが同名のレイヤーへ振り分けられる
 * （white を最背面、cut を最前面に整列）。
 *
 * 注意: ExtendScript は ES3 相当。生成する jsx 文字列内では var と
 * 古い構文のみを使うこと（TS側でテンプレートリテラルに埋め込むのはOK）。
 */

/** ExtendScript のシングルクォート文字列リテラルへ安全に埋め込むためのエスケープ */
function escapeJsString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
}

/** レイヤー名3つを埋め込んだ .jsx スクリプト文字列を返す */
export function buildIllustratorJsx(layerNames: {
  print: string
  cut: string
  white: string
}): string {
  const p = escapeJsString(layerNames.print)
  const c = escapeJsString(layerNames.cut)
  const w = escapeJsString(layerNames.white)

  return `/*
 * AcSta Studio - SVG group to layer converter
 * 書き出したSVGを Illustrator で開いた状態でこのスクリプトを実行すると、
 * 名前付きグループ（${p} / ${c} / ${w}）を同名レイヤーへ移動します。
 * 使い方: ファイル > スクリプト > その他のスクリプト... で本ファイルを選択
 */
(function () {
  if (app.documents.length === 0) {
    alert('ドキュメントが開かれていません。\\n書き出したSVGをIllustratorで開いてから実行してください。');
    return;
  }

  var NAMES = { print: '${p}', cut: '${c}', white: '${w}' };
  var KEYS = ['print', 'cut', 'white'];
  var doc = app.activeDocument;

  function findLayer(name) {
    for (var i = 0; i < doc.layers.length; i++) {
      if (doc.layers[i].name === name) {
        return doc.layers[i];
      }
    }
    return null;
  }

  function getOrCreateLayer(name) {
    var layer = findLayer(name);
    if (layer === null) {
      layer = doc.layers.add();
      layer.name = name;
    }
    return layer;
  }

  function matchedKey(item) {
    for (var k = 0; k < KEYS.length; k++) {
      if (item.name === NAMES[KEYS[k]]) {
        return KEYS[k];
      }
    }
    return null;
  }

  // 移動中にコレクションが変わるため、対象グループを先にスナップショットする。
  // 各レイヤー直下のトップレベル GroupItem を走査し、名前が一致しない
  // ラッパーグループ（IllustratorがSVG読込時に作ることがある）は
  // 1階層だけ中も見る。
  var targets = [];
  var li, gi, ci;
  for (li = 0; li < doc.layers.length; li++) {
    var srcLayer = doc.layers[li];
    for (gi = 0; gi < srcLayer.groupItems.length; gi++) {
      var top = srcLayer.groupItems[gi];
      if (matchedKey(top) !== null) {
        targets.push(top);
      } else {
        for (ci = 0; ci < top.groupItems.length; ci++) {
          if (matchedKey(top.groupItems[ci]) !== null) {
            targets.push(top.groupItems[ci]);
          }
        }
      }
    }
  }

  // グループは解除（ungroup）せず、そのまま同名レイヤーへ移動する
  var moved = { print: 0, cut: 0, white: 0 };
  for (var t = 0; t < targets.length; t++) {
    var key = matchedKey(targets[t]);
    if (key === null) {
      continue;
    }
    var dest = getOrCreateLayer(NAMES[key]);
    targets[t].move(dest, ElementPlacement.PLACEATBEGINNING);
    moved[key]++;
  }

  // レイヤー順を整える: white を最背面、cut を最前面
  var whiteLayer = findLayer(NAMES.white);
  if (whiteLayer !== null) {
    whiteLayer.zOrder(ZOrderMethod.SENDTOBACK);
  }
  var cutLayer = findLayer(NAMES.cut);
  if (cutLayer !== null) {
    cutLayer.zOrder(ZOrderMethod.BRINGTOFRONT);
  }

  alert('AcSta Studio レイヤー変換が完了しました。\\n' +
    NAMES.print + ': ' + moved.print + ' グループ\\n' +
    NAMES.cut + ': ' + moved.cut + ' グループ\\n' +
    NAMES.white + ': ' + moved.white + ' グループ');
}());
`
}
