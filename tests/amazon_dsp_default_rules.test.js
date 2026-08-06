// Amazon DSP PVA デフォルト値判定テスト
// 検証: コンテキストシグナルのみ使用（既定 Yes）／モバイルアプリターゲティング（既定 Exclude）／
//       Daypart targeting timezone（Account系時区＋Daypartなし → DL空で一致）
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
'  getColumnCheckFn: function(key){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === key) : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  getColumnKeys: function(){ return DL_COLUMNS_VIDEO.map(c => c.key); },\n' +
'  auditVideoFieldCoverage: typeof auditVideoFieldCoverage === "function" ? auditVideoFieldCoverage : undefined,\n' +
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
const toJS = v => JSON.parse(JSON.stringify(v));
const checkCtx = api.getColumnCheckFn('Target Categories using only contextual signals?');
const checkMobile = api.getColumnCheckFn('Mobile app targeting - include or exclude');
const checkDaypartTz = api.getColumnCheckFn('Daypart targeting timezone');
assert.equal(typeof checkCtx, 'function');
assert.equal(typeof checkMobile, 'function');
assert.equal(typeof checkDaypartTz, 'function');

const makeS = (extra) => ({ __LI_NAME__: 'TEST-LI', __SYSTEM__: 'amazon_pva', timezone: '', daypart: '', ...(extra || {}) });

// ═══════════════════════════════════════════
// コンテキストシグナルのみ使用（既定値 Yes）
// ═══════════════════════════════════════════
test('C1: DL Yes → 一致(true)', () => {
  const s = makeS();
  assert.equal(checkCtx(s, 'Yes'), true);
  assert.ok(!s.__contextual_signal_note__);
});

test('C2: DL YES → 一致(true)', () => {
  const s = makeS();
  assert.equal(checkCtx(s, 'YES'), true);
});

test('C3: DL No → 要確認(null)＋note', () => {
  const s = makeS();
  assert.equal(checkCtx(s, 'No'), null);
  assert.ok(s.__contextual_signal_note__.includes('デフォルト値は「Yes」'), s.__contextual_signal_note__);
  assert.ok(s.__contextual_signal_note__.includes('No'), s.__contextual_signal_note__);
});

test('C4: DL空 → チェック対象外(null)', () => {
  const s = makeS();
  assert.equal(checkCtx(s, ''), null);
  assert.ok(!s.__contextual_signal_note__);
});

test('C5: 未登録項目にならない（正式列登録済み）', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Target Categories using only contextual signals?': 'Yes' };
  const w = toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow));
  assert.deepEqual(w.map(x => x.field), [], '正式列は監査で消費される');
});

// ═══════════════════════════════════════════
// モバイルアプリターゲティング（既定値 Exclude）
// ═══════════════════════════════════════════
test('M1: DL Exclude → 一致(true)', () => {
  const s = makeS();
  assert.equal(checkMobile(s, 'Exclude'), true);
  assert.ok(!s.__mobile_app_targeting_note__);
});

test('M2: DL exclude → 一致(true)', () => {
  const s = makeS();
  assert.equal(checkMobile(s, 'exclude'), true);
});

test('M3: DL Include → 要確認(null)＋note', () => {
  const s = makeS();
  assert.equal(checkMobile(s, 'Include'), null);
  assert.ok(s.__mobile_app_targeting_note__.includes('デフォルト値は「Exclude」'), s.__mobile_app_targeting_note__);
  assert.ok(s.__mobile_app_targeting_note__.includes('Include'), s.__mobile_app_targeting_note__);
});

test('M4: DL空 → チェック対象外(null)', () => {
  const s = makeS();
  assert.equal(checkMobile(s, ''), null);
  assert.ok(!s.__mobile_app_targeting_note__);
});

test('M5: 未登録項目にならない（正式列登録済み）', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Mobile app targeting - include or exclude': 'Exclude' };
  const w = toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow));
  assert.deepEqual(w.map(x => x.field), []);
});

// ═══════════════════════════════════════════
// Daypart targeting timezone
// ═══════════════════════════════════════════
test('D1: Daypart空＋設定時区空＋DL空 → 一致(true)', () => {
  const s = makeS({ timezone: '', daypart: '' });
  assert.equal(checkDaypartTz(s, ''), true);
});

test('D2: Daypart空＋Account\'s time zone＋DL空 → 一致(true)', () => {
  const s = makeS({ timezone: "Account's time zone", daypart: '' });
  assert.equal(checkDaypartTz(s, ''), true);
});

test('D3: Daypart空＋Account time zone＋DL空 → 一致(true)', () => {
  const s = makeS({ timezone: 'Account time zone', daypart: '' });
  assert.equal(checkDaypartTz(s, ''), true);
});

test('D4: Daypart空＋Account系時区＋DL非空 → 要確認(null)＋note', () => {
  const s = makeS({ timezone: "Account's time zone", daypart: '' });
  assert.equal(checkDaypartTz(s, "Viewer's time zone"), null);
  assert.ok(s.__daypart_timezone_note__.includes('時間帯指定はありません'), s.__daypart_timezone_note__);
});

test('D5: Daypart有値＋Viewer時区一致 → 一致(true)', () => {
  const s = makeS({ timezone: "Viewer's time zone", daypart: '月曜日 00:00-01:00' });
  assert.equal(checkDaypartTz(s, "Viewer's time zone"), true);
});

test('D6: Daypart有値＋DL時区空 → 不一致(false)', () => {
  const s = makeS({ timezone: "Viewer's time zone", daypart: '月曜日 00:00-01:00' });
  assert.equal(checkDaypartTz(s, ''), false);
});

test('D7: 指定なし（ALL）は Daypart 指定なし扱い', () => {
  const s = makeS({ timezone: "Account's time zone", daypart: '指定なし（ALL）' });
  assert.equal(checkDaypartTz(s, ''), true, '指定なし（ALL）は daypart なしとして処理');
});

test('D8: Daypart空＋設定時区非空（Account以外）＋DL空 → 要確認(null)＋note', () => {
  const s = makeS({ timezone: "Viewer's time zone", daypart: '' });
  assert.equal(checkDaypartTz(s, ''), null);
  assert.ok(s.__daypart_timezone_note__.includes('タイムゾーンは'), s.__daypart_timezone_note__);
});
