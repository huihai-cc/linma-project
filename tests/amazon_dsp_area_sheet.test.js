// Amazon DSP PVA/OTT エリアシート地域判定テスト
// 検証: Location targeting / Location excluding checkFn — エリアシート参照時の双向比較
// 対象: amazon_dsp_check.html
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('_readSegmentSheetDynamic'));
  assert.ok(source, 'amazon_dsp_check application script should be present');

  const exportBlock = '\n' +
'window.__amazonTestApi = {\n' +
'  _readSegmentSheetDynamic: typeof _readSegmentSheetDynamic === "function" ? _readSegmentSheetDynamic : undefined,\n' +
'  normalizeAreaForCompare: typeof normalizeAreaForCompare === "function" ? normalizeAreaForCompare : undefined,\n' +
'  _compareAreasBidirectional: typeof _compareAreasBidirectional === "function" ? _compareAreasBidirectional : undefined,\n' +
'  findAreaSheetForLI: typeof findAreaSheetForLI === "function" ? findAreaSheetForLI : undefined,\n' +
'  getLocationCheckFn: function(key){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === key) : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');

  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
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
const checkTargeting = api.getLocationCheckFn('Location targeting 1 of 2');
const checkExcluding = api.getLocationCheckFn('Location excluding 1 of 2');
assert.equal(typeof checkTargeting, 'function', 'Location targeting checkFn');
assert.equal(typeof checkExcluding, 'function', 'Location excluding checkFn');

// ── テストデータ ──
// sRow 構築（エリアシート参照）
function makeS(area, opts) {
  return {
    __LI_NAME__: 'TEST-LI',
    __SYSTEM__: 'amazon_pva',
    deal_type: '',
    location: '別紙エリアシート参照',
    region: '',
    __AREA_SHEET__: area || { targeted: [], excluded: [] },
    __AREA_SHEET_NAME__: 'エリアシート',
    __AREA_SHEET_DEBUG__: 'エリアシート',
    __AREA_SHEET_AMBIGUOUS__: false,
    ...(opts || {}),
  };
}

// ═══════════════════════════════════════════
// normalizeAreaForCompare 単体
// ═══════════════════════════════════════════
test('normalizeAreaForCompare: 日英・形式差異を統一キー化', () => {
  const n = api.normalizeAreaForCompare;
  assert.equal(n('熊本県'), 'kumamoto');
  assert.equal(n('Kumamoto Prefecture'), 'kumamoto');
  assert.equal(n('PREFECTURE:Kumamoto, JP'), 'kumamoto');
  assert.equal(n('Kumamoto'), 'kumamoto');
  assert.equal(n('CITY:Osaka, JP'), 'osaka');
  assert.equal(n('  Tokyo  '), 'tokyo');
  assert.equal(n(''), '');
});

// ═══════════════════════════════════════════
// Case 1: Sheetに含む地域のみ → 配信地域のみ検査
// ═══════════════════════════════════════════
test('Case 1: 含む地域のみのSheet → 配信地域のみ検査（除外は対象外）', () => {
  const s = makeS({ targeted: ['Tokyo'], excluded: [] });
  // 含む：一致
  assert.equal(checkTargeting(s, 'PREFECTURE:Tokyo, JP'), true);
  // 除外：Sheetに指定なし → 非設定項目
  assert.equal(checkExcluding(s, ''), null);
});

// ═══════════════════════════════════════════
// Case 2: Sheetに除外地域のみ → 除外のみ検査
// ═══════════════════════════════════════════
test('Case 2: 除外地域のみのSheet → 除外のみ検査（含むは対象外）', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] });
  // 含む：指定なし → 非設定項目
  assert.equal(checkTargeting(s, ''), null);
  // 除外：一致
  assert.equal(checkExcluding(s, 'PREFECTURE:Kumamoto, JP'), true);
});

// ═══════════════════════════════════════════
// Case 3: 本案 除外熊本県 vs PREFECTURE:Kumamoto, JP → 一致
// ═══════════════════════════════════════════
test('Case 3: 除外「熊本県」 vs PREFECTURE:Kumamoto, JP → 一致', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] });
  assert.equal(checkTargeting(s, ''), null, '配信地域：チェック対象外');
  assert.equal(checkExcluding(s, 'PREFECTURE:Kumamoto, JP'), true, '除外地域：一致');
  assert.ok(!s.__location_excl_diff__, '差異なし');
});

// ═══════════════════════════════════════════
// Case 4: Sheetに含む・除外両方 → 両列それぞれ一致
// ═══════════════════════════════════════════
test('Case 4: 含む・除外両方のSheet → 両列それぞれ一致', () => {
  const s = makeS({ targeted: ['Tokyo'], excluded: ['Kumamoto Prefecture'] });
  assert.equal(checkTargeting(s, 'PREFECTURE:Tokyo, JP'), true);
  assert.equal(checkExcluding(s, 'PREFECTURE:Kumamoto, JP'), true);
});

// ═══════════════════════════════════════════
// Case 5: Sheet含む空＆DL含む空 → 含む列は対象外
// ═══════════════════════════════════════════
test('Case 5: 含む両方空 → チェック対象外（null）', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] });
  assert.equal(checkTargeting(s, ''), null);
  assert.equal(checkTargeting(s, '  '), null);
});

// ═══════════════════════════════════════════
// Case 6: Sheet含む空＆DL含むに地域あり → 不一致
// ═══════════════════════════════════════════
test('Case 6: 含む指定なしなのにDLに含む地域 → 不一致', () => {
  const s = makeS({ targeted: [], excluded: [] });
  const r = checkTargeting(s, 'PREFECTURE:Tokyo, JP');
  assert.equal(r, false, '静かに一致させない');
  assert.ok(s.__location_diff__.includes('【配信地域：ダウンロードにあるがエリアシートにない】'), s.__location_diff__);
  assert.ok(s.__location_diff__.includes('Tokyo'));
});

// ═══════════════════════════════════════════
// Case 7: Sheet除外熊本＆DL除外熊本+福岡 → 不一致（DL多出）
// ═══════════════════════════════════════════
test('Case 7: DL除外が熊本+福岡 → 不一致で福岡を明示', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] });
  const r = checkExcluding(s, 'PREFECTURE:Kumamoto, JP; PREFECTURE:Fukuoka, JP');
  assert.equal(r, false, '部分一致では一致としない');
  assert.ok(s.__location_excl_diff__.includes('【除外地域：ダウンロードにあるがエリアシートにない】'), s.__location_excl_diff__);
  assert.ok(s.__location_excl_diff__.includes('Fukuoka'), 'Fukuoka が明示される');
});

// ═══════════════════════════════════════════
// Case 8: Sheet除外熊本+福岡＆DL除外熊本のみ → 不一致（DL欠落）
// ═══════════════════════════════════════════
test('Case 8: DL除外が熊本のみ → 不一致で福岡欠落を明示', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture', 'Fukuoka Prefecture'] });
  const r = checkExcluding(s, 'PREFECTURE:Kumamoto, JP');
  assert.equal(r, false);
  assert.ok(s.__location_excl_diff__.includes('【除外地域：エリアシートにあるがダウンロードにない】'), s.__location_excl_diff__);
  assert.ok(s.__location_excl_diff__.includes('Fukuoka'));
});

// ═══════════════════════════════════════════
// Case 9: 日文県名（エリアシートen変換後）と英文Prefecture形式が等価
// ═══════════════════════════════════════════
test('Case 9: 「熊本県」(en変換) vs Kumamoto Prefecture 等価', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] });
  assert.equal(checkExcluding(s, 'Kumamoto Prefecture'), true);
  assert.equal(checkExcluding(s, 'Kumamoto, JP'), true);
});

// ═══════════════════════════════════════════
// Case 10: 対応エリアシート未発見 → warning（判一致しない）
// ═══════════════════════════════════════════
test('Case 10: エリアシート特定不可 → 判定しない', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] }, {
    __AREA_SHEET__: null,
    __AREA_SHEET_AMBIGUOUS__: true,
    __AREA_SHEET_DEBUG__: '対応エリアシート未発見',
  });
  const r1 = checkTargeting(s, '');
  assert.equal(r1, null);
  assert.ok(s.__location_diff__.includes('対応エリアシートを特定できません'), s.__location_diff__);
  const r2 = checkExcluding(s, 'PREFECTURE:Kumamoto, JP');
  assert.equal(r2, null);
  assert.ok(s.__location_excl_diff__.includes('対応エリアシートを特定できません'), s.__location_excl_diff__);
});

// ═══════════════════════════════════════════
// Case 11: 複数エリアシートで唯一特定できない → 先頭を静かに使わない
// ═══════════════════════════════════════════
test('Case 11: 複数候補で一意に特定できない → 判定不可（先頭使用しない）', () => {
  const sheets = [
    { name: 'エリアシート_A社', data: { targeted: ['Tokyo'], excluded: [] } },
    { name: 'エリアシート_B社', data: { targeted: ['Osaka'], excluded: [] } },
  ];
  // LI名がどちらのシート名とも一致しない → マッチ0 → 判定不可
  const res = api.findAreaSheetForLI(sheets, 'PVA_テストLI_2608', '別紙エリアシート参照');
  assert.equal(res.data, null, 'data:null で判定不可');
  assert.equal(res.ambiguous, true);
  assert.ok(res.debug.includes('未発見') || res.debug.includes('複数'), res.debug);
});

test('Case 11b: LI名が複数シートに一致 → 判定不可', () => {
  const sheets = [
    { name: 'エリアシート_共通', data: { targeted: ['Tokyo'], excluded: [] } },
    { name: 'エリアシート_共通_2', data: { targeted: ['Osaka'], excluded: [] } },
  ];
  const res = api.findAreaSheetForLI(sheets, 'PVA_共通_LI', '別紙エリアシート参照');
  assert.equal(res.data, null, '曖昧な場合は先頭を使用しない');
  assert.equal(res.ambiguous, true);
});

test('Case 11c: 単一エリアシートはそのまま採用', () => {
  const sheets = [
    { name: 'エリアシート', data: { targeted: [], excluded: ['Kumamoto Prefecture'] } },
  ];
  const res = api.findAreaSheetForLI(sheets, 'PVA_テストLI', '別紙エリアシート参照');
  assert.equal(res.ambiguous, false);
  assert.deepEqual(res.data.excluded, ['Kumamoto Prefecture']);
});

// ═══════════════════════════════════════════
// Case 12: PG案件は比較対象外のまま
// ═══════════════════════════════════════════
test('Case 12: PG案件 → 地域比較対象外（null＋skipマーク）', () => {
  const s = makeS({ targeted: ['Tokyo'], excluded: [] }, {
    __SYSTEM__: 'amazon_pva',
    deal_type: 'programmatic guaranteed',
  });
  const r = checkTargeting(s, 'PREFECTURE:Tokyo, JP');
  assert.equal(r, null, 'PGはnull（比較対象外）');
  assert.equal(s.__pg_skip__, 'PGのため比較対象外');
});

// ═══════════════════════════════════════════
// Case 13: 双向一致で詳細な判定メッセージ生成用データが揃う
// ═══════════════════════════════════════════
test('Case 13: 一致時は result=true かつ __AREA_SHEET_INFO__ で説明可能', () => {
  const s = makeS({ targeted: [], excluded: ['Kumamoto Prefecture'] });
  const r = checkExcluding(s, 'PREFECTURE:Kumamoto, JP');
  assert.equal(r, true);
  // レンダリング用情報（item.__AREA_SHEET_INFO__ 相当）が除外地域を持っている
  const info = {
    isRef: true,
    excluded: s.__AREA_SHEET__.excluded,
    name: s.__AREA_SHEET_NAME__,
  };
  assert.ok(info.isRef);
  assert.deepEqual(info.excluded, ['Kumamoto Prefecture']);
});

// ═══════════════════════════════════════════
// Case 14: 除外両方空 → 対象外
// ═══════════════════════════════════════════
test('Case 14: 除外両方空 → チェック対象外', () => {
  const s = makeS({ targeted: ['Tokyo'], excluded: [] });
  assert.equal(checkExcluding(s, ''), null);
});
