// Amazon DSP PVA セグメントシート動的解析テスト
// 検証: _readSegmentSheetDynamic — セグメント名表頭の模糊識別 / 最大5グループ動的解析
// 対象: amazon_dsp_check.html
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

// ── テストヘルパー ──
function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  const el = {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return el; }, dataset: {}, disabled: false,
    files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
  return el;
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('_readSegmentSheetDynamic'));
  assert.ok(source, 'amazon_dsp_check application script should be present');

  const exportBlock = '\n' +
'window.__amazonTestApi = {\n' +
'  _readSegmentSheetDynamic: typeof _readSegmentSheetDynamic === "function" ? _readSegmentSheetDynamic : undefined,\n' +
'  getScSystem: function(){ return scSystem; },\n' +
'  getScDetectedSystem: function(){ return scDetectedSystem; },\n' +
'  getScCaseMode: function(){ return scCaseMode; },\n' +
'  applyScSystemUI: typeof applyScSystemUI === "function" ? applyScSystemUI : undefined,\n' +
'  resetSettingCheck: typeof resetSettingCheck === "function" ? resetSettingCheck : undefined,\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');

  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

const api = loadAmazonApi();
const toJS = v => JSON.parse(JSON.stringify(v));

// ── テストデータ作成 ──
// 実ファイル（Ver1.6 セグメントシート）と同じ「縦置き形式」の行配列を作る。
// 列構成（1グループ5列：typeCol=1,6,11,16,21…、segCol=typeCol 同列）：
//   R0: col tc   = グループN        | col tc+3 = グループ間演算子
//   R1: col tc   = 含む/除外        | col tc+1 = Include/Exclude | col tc+3 = および(and)/または(or)
//   R2: col tc   = グループ内演算子 | col tc+1 = または(or)
//   R3: col tc   = セグメント名（「セグメント名＋他の文字」も可）
//   R4+: col tc  = Audience名（データ行）
function makeSegmentSheet(headers, groupData, groupTypes) {
  // headers:     ['セグメント名', 'セグメント名', 'セグメント名LS - Beauty Fans']
  // groupData:   [['IM - A','IM - B'], ['Demo - X'], ['IM - C']]  ※表頭連結分は含めない
  // groupTypes:  ['Include','Exclude','Include']（省略時: 2番目以外は Include）
  const rows = [];
  const MAXC = 26;
  const row = (r) => { while (rows.length <= r) rows.push(new Array(MAXC).fill('')); return rows[r]; };

  headers.forEach((h, i) => {
    const tc = 1 + i * 5;
    row(0)[tc] = 'グループ' + (i + 1);
    if (i < headers.length - 1) row(0)[tc + 3] = 'グループ間演算子';
    row(1)[tc] = '含む/除外';
    row(1)[tc + 1] = (groupTypes && groupTypes[i]) || (i === 1 ? 'Exclude' : 'Include');
    if (i < headers.length - 1) row(1)[tc + 3] = (i % 2 === 0) ? 'および(and)' : 'または(or)';
    row(2)[tc] = 'グループ内演算子';
    row(2)[tc + 1] = 'または(or)';
    row(3)[tc] = h;
  });

  const maxLen = Math.max(0, ...groupData.map(g => g.length));
  for (let di = 0; di < maxLen; di++) {
    groupData.forEach((g, i) => {
      const tc = 1 + i * 5;
      if (di < g.length && g[di]) row(4 + di)[tc] = g[di];
    });
  }
  return rows;
}

// ═══════════════════════════════════════════
// 基本テスト
// ═══════════════════════════════════════════
test('API exported', () => {
  assert.equal(typeof api._readSegmentSheetDynamic, 'function');
});

// ═══════════════════════════════════════════
// Case 1: 標準3組
// ═══════════════════════════════════════════
test('Case 1: 標準3組が全て抽出される', () => {
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名', 'セグメント名'],
    [['IM - エアコン本体', 'IM - 冷蔵庫', 'IM - テレビ'], ['Demo - Age 18-19'], ['IM - 洗濯機', 'IM - 掃除機', 'IM - 電子レンジ']],
    ['Include', 'Exclude', 'Include']
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 3, '3組');
  assert.equal(result.groups[0].type, 'Include');
  assert.equal(result.groups[1].type, 'Exclude');
  assert.deepEqual(result.groups[0].segments, ['IM - エアコン本体', 'IM - 冷蔵庫', 'IM - テレビ']);
  assert.deepEqual(result.groups[1].segments, ['Demo - Age 18-19']);
  assert.deepEqual(result.groups[2].segments, ['IM - 洗濯機', 'IM - 掃除機', 'IM - 電子レンジ']);
});

// ═══════════════════════════════════════════
// Case 2: 第3組表頭が「セグメント名＋他の文字」
// （実ファイル: 「セグメント名LS - Beauty Fans」）
// ═══════════════════════════════════════════
test('Case 2: 第3組表頭が「セグメント名＋他の文字」でも抽出される', () => {
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名', 'セグメント名LS - Beauty Fans'],
    [['IM - エアコン本体', 'IM - 冷蔵庫', 'IM - テレビ'], ['Demo - Age 18-19'], ['IM - 掃除機', 'IM - 食器洗い機']],
    ['Include', 'Exclude', 'Include']
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 3, '3組すべて');
  assert.equal(result.groups[2].type, 'Include');
  // 第3組: 表頭の連結部分「LS - Beauty Fans」が最初のデータとして保持され、
  // 続くデータ行も抽出される
  assert.deepEqual(result.groups[2].segments, ['LS - Beauty Fans', 'IM - 掃除機', 'IM - 食器洗い機']);
  // 他の組は従来通り
  assert.deepEqual(result.groups[0].segments, ['IM - エアコン本体', 'IM - 冷蔵庫', 'IM - テレビ']);
  assert.deepEqual(result.groups[1].segments, ['Demo - Age 18-19']);
});

// ═══════════════════════════════════════════
// Case 2b: 表頭の前後空白・全角空白・改行
// ═══════════════════════════════════════════
test('Case 2b: 表頭の前後空白・全角空白・改行が混在しても認識される', () => {
  const rows = makeSegmentSheet(
    [' セグメント名 ', 'セグメント名\n改行入り', '　セグメント名　LS - Beauty Fans　'],
    [['IM - エアコン本体'], ['Demo - A'], ['IM - 掃除機']]
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 3, '3組すべて');
  assert.deepEqual(result.groups[2].segments, ['LS - Beauty Fans', 'IM - 掃除機']);
});

// ═══════════════════════════════════════════
// Case 3: 只有1組
// ═══════════════════════════════════════════
test('Case 3: 1組のみの設定でも解析される', () => {
  const rows = makeSegmentSheet(
    ['セグメント名'],
    [['IM - A', 'IM - B']]
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].segments, ['IM - A', 'IM - B']);
});

// ═══════════════════════════════════════════
// Case 4: 5組完整数据
// ═══════════════════════════════════════════
test('Case 4: 5組までのデータが全て抽出される', () => {
  const headers = ['セグメント名', 'セグメント名', 'セグメント名', 'セグメント名', 'セグメント名'];
  const groupData = [0, 1, 2, 3, 4].map(i => ['Group' + (i + 1) + ' - Aud1', 'Group' + (i + 1) + ' - Aud2']);
  const rows = makeSegmentSheet(headers, groupData);
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 5, '5組');
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(result.groups[i].segments, ['Group' + (i + 1) + ' - Aud1', 'Group' + (i + 1) + ' - Aud2']);
  }
});

// ═══════════════════════════════════════════
// Case 5: 中間Groupが空
// ═══════════════════════════════════════════
test('Case 5: 中間の空グループは出力されない', () => {
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名', 'セグメント名'],
    [['IM - エアコン本体', 'IM - 冷蔵庫'], [], ['IM - 洗濯機', 'IM - 掃除機']]  // 組2はテンプレート予備で空
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 2, '空グループは除外される');
  assert.deepEqual(result.groups[0].segments, ['IM - エアコン本体', 'IM - 冷蔵庫']);
  assert.deepEqual(result.groups[1].segments, ['IM - 洗濯機', 'IM - 掃除機']);
});

// ═══════════════════════════════════════════
// Case 6: 黄色空白区域を読まない
// ═══════════════════════════════════════════
test('Case 6: データ間の空白行（黄色空白域）はAudienceとして抽出されない', () => {
  // 縦置きデータ行の途中に空セル（黄色拡張域相当）を挟む
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名'],
    [['IM - エアコン本体', 'IM - 冷蔵庫', 'IM - テレビ'], ['Demo - A', '', 'Demo - B']]
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 2);
  // 組2の中央の空セルは抽出されない
  assert.deepEqual(result.groups[1].segments, ['Demo - A', 'Demo - B']);
});

// ═══════════════════════════════════════════
// Case 7: IncludeとExcludeの混合
// ═══════════════════════════════════════════
test('Case 7: Include/Exclude グループが正しく分類される', () => {
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名', 'セグメント名'],
    [['IM - A', 'IM - B'], ['Demo - X', 'Demo - Y'], ['IM - C', 'IM - D']],
    ['Include', 'Exclude', 'Include']
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 3);
  assert.deepEqual(result.groups.map(g => g.type), ['Include', 'Exclude', 'Include']);
  assert.deepEqual(result.groups[1].segments, ['Demo - X', 'Demo - Y']);
});

// ═══════════════════════════════════════════
// Case 8: グループ間演算子（および/または）が抽出される
// ═══════════════════════════════════════════
test('Case 8: グループ間演算子（and/or）が抽出される', () => {
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名', 'セグメント名'],
    [['IM - A'], ['Demo - X'], ['IM - C']]
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  // R1 の および(and) / または(or) から抽出
  assert.ok(result.groupOps.includes('and'), 'and が含まれる');
  assert.ok(result.groupOps.includes('or'), 'or が含まれる');
});

// ═══════════════════════════════════════════
// Case 9: 普通のAudience名が「セグメント名」で始まっても表頭に誤認されない
// ═══════════════════════════════════════════
test('Case 9: Audience名が「セグメント名」で始まる場合もデータとして保持される', () => {
  const rows = makeSegmentSheet(
    ['セグメント名', 'セグメント名'],
    [['IM - A', 'IM - B'], ['セグメント名A', 'Demo - B']]
  );
  const result = toJS(api._readSegmentSheetDynamic(rows));
  assert.equal(result.groups.length, 2);
  // データ行の孤立「セグメント名…」セルは表頭ではなくデータとして残る
  assert.deepEqual(result.groups[1].segments, ['セグメント名A', 'Demo - B']);
});

// ═══════════════════════════════════════════
// デフォルト選択（タスク2）
// ═══════════════════════════════════════════
test('Default: scSystem=auto（自動検出） / scCaseMode=initial で初期化される', () => {
  assert.equal(api.getScSystem(), 'auto');
  assert.equal(api.getScDetectedSystem(), '');
  assert.equal(api.getScCaseMode(), 'initial');
});

test('Default: applyScSystemUI が存在し自動検出状態に同期できる', () => {
  assert.equal(typeof api.applyScSystemUI, 'function');
  assert.equal(api.getScSystem(), 'auto');
});

test('Default: resetSettingCheck 後もデフォルト選択（自動検出）に戻る', () => {
  api.resetSettingCheck();
  assert.equal(api.getScSystem(), 'auto');
  assert.equal(api.getScDetectedSystem(), '');
  assert.equal(api.getScCaseMode(), 'initial');
});
