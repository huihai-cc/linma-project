// OTT LI 默认选项・デバイス統合・デフォルト非表示 专项测试（2026-08-06）
// 十:
//  1-4:  默认选项（media-select=auto / selectedMediaType=auto / 案件区分=initial / reset維持）
//  4-8:  デバイス（列定義にデバイス(除外)なし / Include+Exclude統合 / ID＋名称表示 / 未識別）
//  9-11: 空項目（Daypart/Fees/BidAdjustment 最終列に出ない）
//  12-22: デフォルト一致 → 非表示
//  23-27: 非デフォルト → warning表示
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const ottRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/OTT';

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = '\n' +
'window.__api = {\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Targeting: typeof compareLI_OTT_Targeting === "function" ? compareLI_OTT_Targeting : undefined,\n' +
'  compareOttDevice: typeof compareOttDevice === "function" ? compareOttDevice : undefined,\n' +
'  getCoreLevelColumns: typeof getCoreLevelColumns === "function" ? getCoreLevelColumns : undefined,\n' +
'  getLevelColumns: typeof getLevelColumns === "function" ? getLevelColumns : undefined,\n' +
'  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === "function" ? appendDownloadOnlyItems : undefined,\n' +
'  appendDynamicDownloadColumns: typeof appendDynamicDownloadColumns === "function" ? appendDynamicDownloadColumns : undefined,\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  getSelectedMediaType: function() { return selectedMediaType; },\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
'  getSelectedDv360CaseType: typeof getSelectedDv360CaseType === "function" ? getSelectedDv360CaseType : undefined,\n' +
'  resetAll: typeof window.resetAll === "function" ? window.resetAll : undefined,\n' +
'  __setTreeRoots: function(roots) { treeRoots = roots; },\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__api;
}

function parseWorkbook(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sname of wb.SheetNames) {
    sheets[sname] = XLSX.utils.sheet_to_json(wb.Sheets[sname], { header: 1, defval: '', raw: false });
  }
  return { sheets, sheetNames: wb.SheetNames };
}

async function parseSdfZip(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const csvFiles = [];
  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const blob = await entry.async('blob');
    const buffer = Buffer.from(await blob.arrayBuffer());
    const text = new TextDecoder('utf-8').decode(buffer);
    const rows = text.split(/\r?\n/).filter(l => l.trim())
      .map(line => line.split(',').map(c => c.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim()));
    if (rows.length > 0) csvFiles.push({ name: filename, rows });
  }
  return csvFiles;
}

const api = loadDv360Api();
const htmlRaw = fs.readFileSync(htmlPath, 'utf8');

function findItem(items, label) {
  return items.find(i => i.label === label);
}

function mockLi() {
  const sLi = { name: 'S_LI', fields: { liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
    budget100: '500000', budget98: '490000', flightMode: '掲載期間', paceMode: '均等',
    bidForm: '固定入札', bidTarget: '▼選択', bidPrice: '1700',
    environment: 'ウェブ＆アプリ', language: 'Japanese', daypart: '月曜日 00:00~23:59', geo: 'Japan',
    devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' } };
  const dLi = { name: 'D_LI', id: 'li1', rawFields: {
    'Language Targeting - Include': '1005;', 'Device Targeting - Include': '30000; 30001; 30002; 30004;',
    'Device Targeting - Exclude': '', 'Environment Targeting': 'Web; App;',
    'Geography Targeting - Include': '2392;', 'Daypart Targeting': '300096;' },
    rawFieldOrder: [],
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: { type: 'Video', subtype: 'Simple', status: 'Draft', startDate: '2026/6/29', endDate: '2026/7/28',
      languageTargeting: '1005;', deviceTargetingInclude: '30000; 30001; 30002; 30004;',
      deviceTargetingExclude: '', environmentTargeting: 'Web; App;',
      geographyTargeting: '2392;', geographyTargetingInclude: '2392;', geographyTargetingExclude: '', geographyExclude: '',
      daypartTargeting: '300096;', pacing: 'Flight', pacingRate: 'Even',
      budgetType: 'Amount', budgetAmount: '490000', bidStrategyType: 'Fixed', bidStrategyValue: '1700' } };
  return { sLi, dLi };
}

// ═══════════════════════════════════════════
// 一. 默认选项（十-1〜4）
// ═══════════════════════════════════════════
test('默认选项: media-select の初期 selected は auto', () => {
  const selectHtml = htmlRaw.match(/<select id="media-select">[\s\S]*?<\/select>/)[0];
  assert.ok(/<option value="auto" selected>/.test(selectHtml), 'auto option has selected');
  assert.ok(!/<option value="youtube" selected>/.test(selectHtml), 'youtube option NOT selected');
});

test('默认选项: selectedMediaType の初期値は auto', () => {
  assert.equal(api.getSelectedMediaType(), 'auto');
});

test('默认选项: 案件区分の初期値は initial', () => {
  const selectHtml = htmlRaw.match(/id="dv-case-select"[\s\S]*?<\/select>/)[0];
  assert.ok(/<option value="initial">初期案件<\/option>/.test(selectHtml), 'initial option present');
  api.setSelectedDv360CaseType('initial');
  assert.equal(api.getSelectedDv360CaseType(), 'initial');
});

test('默认选项: reset 後も auto + initial のまま', () => {
  api.setMediaType('ott');
  api.setSelectedDv360CaseType('crAdditional');
  api.resetAll();
  assert.equal(api.getSelectedMediaType(), 'auto', 'reset keeps auto');
  assert.equal(api.getSelectedDv360CaseType(), 'initial', 'reset keeps initial');
});

// ═══════════════════════════════════════════
// 二. デバイス（十-4〜8）
// ═══════════════════════════════════════════
test('デバイス: OTT固定列に デバイス(除外) が含まれない', () => {
  api.setMediaType('ott');
  const keys = api.getCoreLevelColumns('LI', false).map(c => c.key);
  assert.ok(!keys.includes('デバイス(除外)'));
  assert.ok(keys.includes('デバイス'));
});

test('デバイス: Include四デバイス + Exclude空 → デバイス1項目で ok', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const dev = findItem(items, 'デバイス');
  assert.ok(dev, 'device item');
  assert.equal(dev.result, 'ok');
  assert.equal(findItem(items, 'デバイス(除外)'), undefined);
});

test('デバイス: dVal は ID（名称）形式', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '');
  assert.equal(r.dVal, '30000（PC） / 30001（Smartphone） / 30002（Tablet） / 30004（Connected TV）');
});

test('デバイス: Exclude が同一デバイスを除外 → 最終集合で比較', () => {
  api.setMediaType('ott');
  // 設定4 vs 最終3（30001除外）→ mismatch
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '30001;');
  assert.equal(r.result, 'mismatch');
  assert.ok(r.dVal.includes('除外: 30001（Smartphone）'));
  // 設定3（CTVなし） vs 最終3（30004除外）→ ok
  const r2 = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '-', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '30004;');
  assert.equal(r2.result, 'ok');
});

test('デバイス: 未識別IDは「未識別」表示かつ warning', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 99999;', '');
  assert.equal(r.result, 'warning');
  assert.ok(r.dVal.includes('99999（未識別）'));
  // Exclude側の未知IDも同様
  const r2 = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '88888;');
  assert.equal(r2.result, 'warning');
  assert.ok(r2.dVal.includes('88888（未識別）'));
});

// ═══════════════════════════════════════════
// 三. 空項目 → 最終列に出ない（十-9〜11）
// ═══════════════════════════════════════════
function finalLiColumns(compItems) {
  api.setMediaType('ott');
  const node = { level: 'LI', name: 'T', compItems, children: [] };
  api.__setTreeRoots([{ level: 'CP', name: 'C', compItems: [], children: [node] }]);
  return api.getLevelColumns('LI');
}

test('空項目: Daypart 双方空 → compItem なし & 最終列に 曜日と時間 が出ない', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  sLi.fields.daypart = '';
  dLi.rawFields['Daypart Targeting'] = '';
  dLi.fields.daypartTargeting = '';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  assert.equal(findItem(items, '曜日と時間'), undefined, 'no compItem');
  const cols = finalLiColumns(items);
  assert.ok(!cols.some(c => c.key === '曜日と時間'), 'no final column');
});

test('空項目: Fees 空 → 最終列に出ない', () => {
  api.setMediaType('ott');
  const items = api.appendDownloadOnlyItems('LI', { rawFieldOrder: ['Fees'], rawFields: { Fees: '' } }, []);
  assert.equal(items.some(i => i.isAutoAdded && i.rawFieldName === 'Fees'), false);
  const cols = api.appendDynamicDownloadColumns('LI', [], [{ compItems: items }]);
  assert.ok(!cols.some(c => c.label.includes('Fees')));
});

test('空項目: TrueView Bid Adjustment 空 → 最終列に出ない', () => {
  api.setMediaType('ott');
  const headers = ['TrueView Mobile Bid Adjustment Option', 'TrueView Mobile Bid Adjustment Percentage',
    'TrueView Desktop Bid Adjustment Option', 'TrueView Desktop Bid Adjustment Percentage',
    'TrueView Tablet Bid Adjustment Option', 'TrueView Tablet Bid Adjustment Percentage'];
  const raw = Object.fromEntries(headers.map(h => [h, '']));
  const items = api.appendDownloadOnlyItems('LI', { rawFieldOrder: headers, rawFields: raw }, []);
  assert.ok(!items.some(i => i.isAutoAdded && i.rawFieldName.includes('Bid Adjustment')));
  const cols = api.appendDynamicDownloadColumns('LI', [], [{ compItems: items }]);
  assert.ok(!cols.some(c => c.label.includes('Bid Adjustment')));
});

// ═══════════════════════════════════════════
// 四. デフォルト一致 → 非表示（十-12〜22）
// ═══════════════════════════════════════════
function defaultItems(headers, fields) {
  return api.appendDownloadOnlyItems('LI', { rawFieldOrder: headers, rawFields: fields }, [])
    .filter(i => i.isAutoAdded);
}

test('デフォルト非表示: Frequency Period=Minutes', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Frequency Period'], { 'Frequency Period': 'Minutes' });
  assert.equal(items.some(i => i.rawFieldName === 'Frequency Period'), false);
});

test('デフォルト非表示: Frequency Amount=0', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Frequency Amount'], { 'Frequency Amount': '0' });
  assert.equal(items.some(i => i.rawFieldName === 'Frequency Amount'), false);
});

test('デフォルト非表示: Algorithm Id=0', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Algorithm Id'], { 'Algorithm Id': '0' });
  assert.equal(items.some(i => i.rawFieldName === 'Algorithm Id'), false);
});

test('デフォルト非表示: Digital Content Labels - Exclude = "MA; ?;"', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Digital Content Labels - Exclude'], { 'Digital Content Labels - Exclude': 'MA; ?;' });
  assert.equal(items.some(i => i.rawFieldName === 'Digital Content Labels - Exclude'), false);
});

test('デフォルト表示: Brand Safety = "Use custom" → warning 表示（compareLI 経由）', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  dLi.rawFields['Brand Safety Sensitivity Setting'] = 'Use custom';
  const items = api.compareLI(sLi, dLi);
  const it = findItem(items, 'Brand Safety Sensitivity Setting');
  assert.ok(it, 'Brand Safety は常時表示対象（非デフォルト値）');
  assert.equal(it.result, 'warning');
});

test('デフォルト非表示: Apply Floor Price For Deals=False', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Apply Floor Price For Deals'], { 'Apply Floor Price For Deals': 'False' });
  assert.equal(items.some(i => i.rawFieldName === 'Apply Floor Price For Deals'), false);
});

test('デフォルト非表示: Third Party Verification Services=None', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Third Party Verification Services'], { 'Third Party Verification Services': 'None' });
  assert.equal(items.some(i => i.rawFieldName === 'Third Party Verification Services'), false);
});

test('デフォルト非表示: Optimized Targeting=False', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Optimized Targeting'], { 'Optimized Targeting': 'False' });
  assert.equal(items.some(i => i.rawFieldName === 'Optimized Targeting'), false);
});

test('デフォルト非表示: OTT TrueView Category Exclusions 空/未設定', () => {
  api.setMediaType('ott');
  const items = defaultItems(['TrueView Category Exclusions Targeting'], { 'TrueView Category Exclusions Targeting': '' });
  assert.equal(items.some(i => i.rawFieldName === 'TrueView Category Exclusions Targeting'), false);
});

test('デフォルト非表示: Fees 標準値 → 非表示（既存共用ルール）', () => {
  api.setMediaType('ott');
  const items = defaultItems(['Fees'], { Fees: '(Media; 0.0; Display & Video 360 Fee; True;);' });
  assert.equal(items.some(i => i.rawFieldName === 'Fees'), false);
});

test('デフォルト非表示: TrueView Bid Adjustment 空3種', () => {
  api.setMediaType('ott');
  const headers = ['TrueView Mobile Bid Adjustment Option', 'TrueView Desktop Bid Adjustment Option', 'TrueView Tablet Bid Adjustment Option'];
  const items = defaultItems(headers, Object.fromEntries(headers.map(h => [h, ''])));
  assert.ok(!items.some(i => i.rawFieldName.includes('Bid Adjustment')));
});

// ═══════════════════════════════════════════
// 五. 非デフォルト → warning表示（十-23〜27）
// ═══════════════════════════════════════════
test('異常表示: Frequency Amount=3 → warning', () => {
  api.setMediaType('ott');
  const it = defaultItems(['Frequency Amount'], { 'Frequency Amount': '3' })
    .find(i => i.rawFieldName === 'Frequency Amount');
  assert.ok(it);
  assert.equal(it.result, 'warning');
});

test('デフォルト表示: Brand Safety = "Do not block" → ok（想定デフォルト、compareLI 経由）', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  dLi.rawFields['Brand Safety Sensitivity Setting'] = 'Do not block';
  const items = api.compareLI(sLi, dLi);
  const it = findItem(items, 'Brand Safety Sensitivity Setting');
  assert.ok(it, 'Brand Safety は常時表示対象');
  assert.equal(it.result, 'ok');
});

test('異常表示: Optimized Targeting=True → warning', () => {
  api.setMediaType('ott');
  const it = defaultItems(['Optimized Targeting'], { 'Optimized Targeting': 'True' })
    .find(i => i.rawFieldName === 'Optimized Targeting');
  assert.ok(it);
  assert.equal(it.result, 'warning');
});

test('異常表示: Fees 非標準値 → warning', () => {
  api.setMediaType('ott');
  const it = defaultItems(['Fees'], { Fees: '(Media; 5.0; Display & Video 360 Fee; True;);' })
    .find(i => i.rawFieldName === 'Fees');
  assert.ok(it);
  assert.equal(it.result, 'warning');
});

test('異常表示: TrueView Bid Adjustment 数値あり → warning', () => {
  api.setMediaType('ott');
  const it = defaultItems(['TrueView Mobile Bid Adjustment Percentage'], { 'TrueView Mobile Bid Adjustment Percentage': '10' })
    .find(i => i.rawFieldName === 'TrueView Mobile Bid Adjustment Percentage');
  assert.ok(it);
  assert.equal(it.result, 'warning');
});
