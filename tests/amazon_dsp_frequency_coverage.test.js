// Amazon DSP PVA/OTT Frequency 比較 + 双向フィールドカバレッジ監査テスト
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
'  normFrequency: typeof normFrequency === "function" ? normFrequency : undefined,\n' +
'  getColumnCheckFn: function(key){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === key) : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  getColumnKeys: function(){ return DL_COLUMNS_VIDEO.map(c => c.key); },\n' +
'  auditVideoFieldCoverage: typeof auditVideoFieldCoverage === "function" ? auditVideoFieldCoverage : undefined,\n' +
'  hasMeaningfulSettingValue: typeof hasMeaningfulSettingValue === "function" ? hasMeaningfulSettingValue : undefined,\n' +
'  hasMeaningfulDownloadValue: typeof hasMeaningfulDownloadValue === "function" ? hasMeaningfulDownloadValue : undefined,\n' +
'  getRegistry: function(){ return { setting: VIDEO_SETTING_FIELD_REGISTRY, ignoreS: VIDEO_SETTING_FIELD_IGNORE_RULES, ignoreD: VIDEO_DOWNLOAD_FIELD_IGNORE_RULES }; },\n' +
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
const checkFreq = api.getColumnCheckFn('Frequency Caps');
assert.equal(typeof checkFreq, 'function', 'Frequency Caps checkFn');
assert.ok(api.getColumnKeys().includes('Frequency Caps'), 'DL_COLUMNS_VIDEO に Frequency Caps が登録されている');

const makeS = (freq) => ({ __LI_NAME__: 'TEST-LI', __SYSTEM__: 'amazon_pva', deal_type: '', frequency: freq });

// ═══════════════════════════════════════════
// Frequency 専項
// ═══════════════════════════════════════════
test('F1: normFrequency の形式互換（全て 1_22_days に正規化）', () => {
  const n = api.normFrequency;
  assert.equal(n('1回/22日'), '1_22_days');
  assert.equal(n('1回／22日'), '1_22_days');
  assert.equal(n('1回/22日間'), '1_22_days');
  assert.equal(n('1times/22days'), '1_22_days');
  assert.equal(n('FrequencyCap1:[User, 1, 22, Days]'), '1_22_days');
  assert.equal(n('[User, 1, 22, Days]'), '1_22_days');
});

test('F2: 設定「1回/22日」DL空 → 不一致(false)', () => {
  const s = makeS('1回/22日');
  assert.equal(checkFreq(s, ''), false, '設定あり・DLなし → 不一致');
});

test('F3: 設定空、DL「FrequencyCap1:[User,1,22,Days]」 → 不一致(false)', () => {
  const s = makeS('');
  assert.equal(checkFreq(s, 'FrequencyCap1:[User, 1, 22, Days]'), false, 'DLあり・設定なし → 不一致');
});

test('F4: 双方等価 → 一致(true)', () => {
  const s = makeS('1回/22日');
  assert.equal(checkFreq(s, '[User, 1, 22, Days]'), true);
  assert.equal(checkFreq(s, '1times/22days'), true);
});

test('F5: 双方数值不同 → 不一致(false)', () => {
  const s = makeS('1回/22日');
  assert.equal(checkFreq(s, '[User, 2, 22, Days]'), false);
});

test('F6: 設定がテンプレート値「●回/●日間」＋DL空 → 対象外(null)', () => {
  const s = makeS('●回/●日間');
  assert.equal(checkFreq(s, ''), null);
});

test('F7: 非空だが解析不可 → 要確認(null)、隠さない', () => {
  const s = makeS('特殊な指定');
  assert.equal(checkFreq(s, ''), null, '設定側が解析不可 → null（不一致とも一致とも言えない）');
  const s2 = makeS('1回/22日');
  assert.equal(checkFreq(s2, 'unknown format value'), null, 'DL側が解析不可 → null');
});

// ═══════════════════════════════════════════
// 設定表側カバレッジ監査
// ═══════════════════════════════════════════
test('C1: 設定フィールド有値＆登録済み（frequency）→ warning なし', () => {
  const sRow = { __LI_NAME__: 'LI', __IO_NAME__: 'IO', __SYSTEM__: 'amazon_pva', frequency: '1回/22日' };
  const w = toJS(toJS(api.auditVideoFieldCoverage(sRow, {})));
  assert.deepEqual(w, []);
});

test('C2: device_type は互換コピーのため監査対象外（二重誤報しない）', () => {
  const sRow = { __LI_NAME__: 'LI', device: 'Desktop+Mobile', device_type: 'Desktop+Mobile', frequency: '1回/22日' };
  const w = toJS(toJS(api.auditVideoFieldCoverage(sRow, {})));
  assert.deepEqual(w, [], JSON.stringify(w));
});

test('C2b: 監査対象外フィールド（custom_field / product_big / __XXX__）は走査しない', () => {
  const sRow = { __LI_NAME__: 'LI', custom_field: 'xxx', product_big: 'Beauty', mobile_os: 'ALL', frequency: '1回/22日' };
  assert.deepEqual(toJS(toJS(api.auditVideoFieldCoverage(sRow, {}))), []);
});

test('C3: 設定フィールド空 → warning なし', () => {
  const sRow = { __LI_NAME__: 'LI', frequency: '', daypart: '   ' };
  assert.deepEqual(toJS(toJS(api.auditVideoFieldCoverage(sRow, {}))), []);
});

test('C4: 内部 __XXX__ フィールド → warning なし', () => {
  const sRow = { __LI_NAME__: 'LI', __SEGMENT_SHEET__: { groups: [] }, __AREA_SHEET__: { targeted: [], excluded: [] }, frequency: '1回/22日' };
  assert.deepEqual(toJS(toJS(api.auditVideoFieldCoverage(sRow, {}))), []);
});

test('C5: テンプレート残り値（指定なし（ALL）/▼選択/無し）→ warning なし', () => {
  const sRow = { __LI_NAME__: 'LI', daypart: '指定なし（ALL）', twitch: '無し', video_format: '▼選択', frequency: '1回/22日' };
  const w = toJS(toJS(api.auditVideoFieldCoverage(sRow, {})));
  assert.deepEqual(w, [], JSON.stringify(w));
});

test('C6: video_format 有値（In-stream only）→ 正式列登録済みのため未登録にならない', () => {
  const sRow = { __LI_NAME__: 'LI', video_format: 'In-stream only', frequency: '1回/22日' };
  const w = toJS(toJS(api.auditVideoFieldCoverage(sRow, {})));
  assert.deepEqual(w, [], 'Video ad format は DL_COLUMNS_VIDEO に登録済み\n' + JSON.stringify(w));
});

// ═══════════════════════════════════════════
// ダウンロード側カバレッジ監査
// ═══════════════════════════════════════════
test('D1: DLフィールド有値＆登録済み → warning なし', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Frequency Caps': '[User, 1, 22, Days]' };
  assert.deepEqual(toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow)), []);
});

test('D2: DLフィールド有値＆未登録 → uncovered', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Streaming TV app blocking': 'Yes' };
  const w = toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow));
  assert.equal(w.length, 1);
  assert.equal(w[0].side, 'download');
  assert.equal(w[0].field, 'Streaming TV app blocking');
});

test('D3: DLフィールド空 → warning なし', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Frequency Caps': '', 'Some Col': '  ' };
  assert.deepEqual(toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow)), []);
});

test('D4: DL ignore リスト（Line ID 等）→ warning なし', () => {
  const dlRow = { 'Line ID': '588737359264304415', 'Advertiser ID*': '592984519785286168', 'Order name - (READ ONLY)': 'Atto_2608', 'Tactic Tag - (READ ONLY)': 'xxx' };
  assert.deepEqual(toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow)), []);
});

test('D5: テンプレート指示文（Follow instructions…）→ warning なし', () => {
  const dlRow = { 'Line ID': 'Follow instructions in A1 comment', 'Frequency Caps': 'Follow instructions in the comment' };
  assert.deepEqual(toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow)), []);
});

// ═══════════════════════════════════════════
// hasMeaningful* 判定
// ═══════════════════════════════════════════
test('H1: hasMeaningfulSettingValue の判定', () => {
  assert.equal(api.hasMeaningfulSettingValue('frequency', '1回/22日'), true);
  assert.equal(api.hasMeaningfulSettingValue('daypart', '指定なし（ALL）'), false);
  assert.equal(api.hasMeaningfulSettingValue('twitch', '無し'), false);
  assert.equal(api.hasMeaningfulSettingValue('video_format', '▼選択'), false);
  assert.equal(api.hasMeaningfulSettingValue('frequency', '●回/●日間'), false);
  assert.equal(api.hasMeaningfulSettingValue('budget', '#N/A'), false);
  assert.equal(api.hasMeaningfulSettingValue('budget', '3931000'), true);
});

test('H2: hasMeaningfulDownloadValue の判定', () => {
  assert.equal(api.hasMeaningfulDownloadValue('Frequency Caps', '[User, 1, 22, Days]'), true);
  assert.equal(api.hasMeaningfulDownloadValue('Line ID', 'Follow instructions in A1 comment'), false);
  assert.equal(api.hasMeaningfulDownloadValue('X', '#N/A'), false);
  assert.equal(api.hasMeaningfulDownloadValue('X', ''), false);
});

// ═══════════════════════════════════════════
// 登録表の整合性
// ═══════════════════════════════════════════
test('R1: 設定側レジストリの dlKey が DL_COLUMNS_VIDEO に存在する（frequency→Frequency Caps）', () => {
  const reg = api.getRegistry();
  const keys = api.getColumnKeys();
  for (const [field, def] of Object.entries(reg.setting)) {
    assert.ok(keys.includes(def.dlKey), `registry[${field}].dlKey=${def.dlKey} が DL_COLUMNS_VIDEO に存在する`);
  }
});

test('R2: 設定側 ignore リストは内部フィールドのみ（業務フィールド不可）', () => {
  const reg = api.getRegistry();
  for (const key of Object.keys(reg.ignoreS)) {
    assert.ok(key.startsWith('__'), `ignoreS のキーは内部フィールドのみ（${key}）`);
  }
});

// ═══════════════════════════════════════════
// 新規正式列（ビデオ・ダウンロード既知フィールド）
// ═══════════════════════════════════════════
test('V1: Video ad format — 設定あり・DLなし → 要確認(null)', () => {
  const c = api.getColumnCheckFn('Video ad format');
  const s = { __LI_NAME__: 'LI', __SYSTEM__: 'amazon_pva', video_format: 'In-stream only' };
  assert.equal(c(s, ''), null, '設定あり・DLなし（deprecated列）→ 要確認');
  assert.equal(c(s, 'In-stream only'), true, '双方一致 → true');
  assert.equal(c(s, 'Out-stream'), false, '異なる値 → false');
  assert.equal(c({ ...s, video_format: '' }, ''), null, '双方なし → null');
});

test('V2: Target Categories using only contextual signals? → 既定値 Yes は一致', () => {
  const c = api.getColumnCheckFn('Target Categories using only contextual signals?');
  const s = { __LI_NAME__: 'LI' };
  assert.equal(c(s, 'Yes'), true, '既定値 Yes → 一致');
  assert.equal(c(s, 'No'), null, 'No → 要確認');
  assert.equal(c(s, ''), null, '空 → 対象外');
});

test('V3: Domain Targeting - (READ ONLY) — No → 一致(既定値), Yes → 要確認', () => {
  const c = api.getColumnCheckFn('Domain Targeting - (READ ONLY)');
  const s = { __LI_NAME__: 'LI' };
  assert.equal(c(s, 'No'), true, '既定値 No → 一致');
  assert.equal(c(s, 'Yes'), null, 'Yes → 要確認');
  assert.equal(c(s, ''), null);
});

test('V4: Mobile app targeting - include or exclude → 既定値 Exclude は一致', () => {
  const c = api.getColumnCheckFn('Mobile app targeting - include or exclude');
  const s = { __LI_NAME__: 'LI' };
  assert.equal(c(s, 'Exclude'), true, '既定値 Exclude → 一致');
  assert.equal(c(s, 'Include'), null, 'Include → 要確認');
  assert.equal(c(s, ''), null, '空 → 対象外');
});

test('V5: Deal Selection names は別名として消費され未登録にならない', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Deal selection': 'Prime Video ads:EXT7MP1F3GBF4J5', 'Deal Selection names': 'Prime Video | Preferred Deal | 1toMany' };
  const w = toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow));
  assert.deepEqual(w, [], 'Deal selection も Deal Selection names も登録済み扱い\n' + JSON.stringify(w));
});

test('V6: 新規未知ダウンロードフィールドは引き続き未登録になる', () => {
  const dlRow = { 'Line name*': 'PVA_xxx', 'Future Amazon Column': 'Some value' };
  const w = toJS(api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow));
  assert.equal(w.length, 1);
  assert.equal(w[0].field, 'Future Amazon Column');
  assert.equal(w[0].side, 'download');
});
