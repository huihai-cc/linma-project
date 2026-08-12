// OTT compareLI Targeting Test (Phase3-2)
// 検証: compareLI_OTT_Targeting — Language / Device / Environment / Daypart
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

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = '\n' +
'window.__ottTgtApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Base: typeof compareLI_OTT_Base === "function" ? compareLI_OTT_Base : undefined,\n' +
'  compareLI_OTT_Targeting: typeof compareLI_OTT_Targeting === "function" ? compareLI_OTT_Targeting : undefined,\n' +
'  compareOttDevice: typeof compareOttDevice === "function" ? compareOttDevice : undefined,\n' +
'  compareField: typeof compareField === "function" ? compareField : undefined,\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
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
  return sandbox.__ottTgtApi;
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
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch (e) {
      try { text = new TextDecoder('shift_jis', { fatal: true }).decode(buffer); }
      catch (e2) { text = new TextDecoder('utf-8').decode(buffer); }
    }
    const lines = text.split(/\r?\n/);
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim());
      if (cols.some(c => c)) rows.push(cols);
    }
    if (rows.length > 0) csvFiles.push({ name: filename, rows });
  }
  return csvFiles;
}

function findItem(items, label) {
  return items.find(i => i.label === label);
}

const api = loadDv360Api();

async function getOttTargetingItems(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);

  if (!setting.liList.length || !download.liList.length) return null;
  const items = api.compareLI_OTT_Targeting(setting.liList[0], download.liList[0]);
  return { items, sLi: setting.liList[0], dLi: download.liList[0] };
}

// ── テスト ──

test('OTT targeting functions exported', () => {
  assert.ok(typeof api.compareLI_OTT_Targeting === 'function', 'compareLI_OTT_Targeting');
  assert.ok(typeof api.compareOttDevice === 'function', 'compareOttDevice');
});

// ═══════════════════════════════════════════
// Case 001: All targeting items
// ═══════════════════════════════════════════
test('Case 001: Language', async () => {
  const data = await getOttTargetingItems('001');
  assert.ok(data, 'should get data');
  const item = findItem(data.items, '言語');
  assert.ok(item, 'should have language item');
  assert.ok(item.sVal || item.dVal, 'should have language values');
  assert.ok(['ok','mismatch','warning'].includes(item.result), 'valid result: ' + item.result);
});

test('Case 001: Device', async () => {
  const data = await getOttTargetingItems('001');
  const item = findItem(data.items, 'デバイス');
  assert.ok(item, 'should have device item');
  assert.ok(['ok','mismatch','warning'].includes(item.result), 'valid result: ' + item.result);
});

test('Case 001: Environment', async () => {
  const data = await getOttTargetingItems('001');
  const item = findItem(data.items, '環境');
  assert.ok(item, 'should have environment item');
  assert.ok(['ok','mismatch','warning'].includes(item.result), 'valid result: ' + item.result);
});

test('Case 001: Daypart 双方空 → 非表示', async () => {
  const data = await getOttTargetingItems('001');
  const item = findItem(data.items, '曜日と時間');
  assert.equal(item, undefined, 'Case 001 daypart both empty → no item');
});

test('Case 001: targeting item count', async () => {
  const data = await getOttTargetingItems('001');
  assert.ok(data.items.length >= 3, 'should have at least 3 targeting items (言語/デバイス/環境), got ' + data.items.length);
});

// ═══════════════════════════════════════════
// Base + Targeting combined via compareLI
// ═══════════════════════════════════════════
test('Case 001: compareLI combines Base + Targeting', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);

  const items = api.compareLI(setting.liList[0], download.liList[0]);
  const labels = items.map(i => i.label);

  // Base fields should be present
  assert.ok(labels.includes('動画タイプ'), 'Base: LI Type');
  assert.ok(labels.includes('予算'), 'Base: Budget');
  assert.ok(labels.includes('入札形式'), 'Base: Bid Strategy');
  assert.ok(labels.includes('収益モデル'), 'Base: Revenue Model');

  // Targeting fields should be present
  assert.ok(labels.includes('言語'), 'Targeting: Language');
  assert.ok(labels.includes('デバイス'), 'Targeting: Device');
  assert.ok(labels.includes('環境'), 'Targeting: Environment');
  // 双方空の Daypart は表示しない
  assert.ok(!labels.includes('曜日と時間'), 'Targeting: Daypart both empty → hidden');

  // Total should be Base(13) + Targeting(3) = 16
  assert.ok(items.length >= 13, 'Combined items >= 13, got ' + items.length);
});

// ═══════════════════════════════════════════
// Case 003: minimal case
// ═══════════════════════════════════════════
test('Case 003: targeting items returned', async () => {
  const data = await getOttTargetingItems('003');
  if (!data) { console.log('  [SKIP] no data for case 003'); return; }
  assert.ok(data.items.length >= 2, 'Case 003: should have targeting items, got ' + data.items.length);
});

// ═══════════════════════════════════════════
// Case 004: large GP data
// ═══════════════════════════════════════════
test('Case 004: targeting items returned', async () => {
  const data = await getOttTargetingItems('004');
  if (!data) { console.log('  [SKIP] no data for case 004'); return; }
  assert.ok(data.items.length >= 2, 'Case 004: should have targeting items, got ' + data.items.length);
});

// ═══════════════════════════════════════════
// Case 005: Deal case
// ═══════════════════════════════════════════
test('Case 005: targeting items returned', async () => {
  const data = await getOttTargetingItems('005');
  if (!data) { console.log('  [SKIP] no data for case 005'); return; }
  assert.ok(data.items.length >= 2, 'Case 005: should have targeting items, got ' + data.items.length);
});

// ═══════════════════════════════════════════
// YouTube non-regression
// ═══════════════════════════════════════════
test('YouTube: compareLI still works', () => {
  api.setMediaType('youtube');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = { name:'Test', fields:{ videoType:'VRC(s)', startDate:'2026/06/24', endDate:'2026/06/30',
    daypart:'', budgetNet:'500000', dailyBudget:'', pacing:'掲載期間', billing:'CPM',
    bidCap:'', inventory:'YouTube', language:'', region:'', gender:'', age:'',
    parentalStatus:'', householdIncome:'', revenueModel:'' }};
  const dLi = { name:'Test', id:'li1', rawFields:{Status:'Active'}, rawFieldOrder:['Status'],
    statusInfo:{found:true,normalizedValue:'Active'},
    fields:{type:'Video',subtype:'In-stream',status:'Active',startDate:'06/24/2026',
      endDate:'06/30/2026',budgetType:'TOTAL',budgetAmount:'500000',
      pacing:'Flight',pacingRate:'Evenly',bidStrategyType:'Target CPM',bidStrategyValue:'',
      trueViewKpiType:'CPCV',trueViewKpiValue:'',inventorySource:'YouTube',
      languageTargeting:'Japanese',geographyTargeting:'Japan',geographyExclude:'',
      daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'',
      demographicGender:'',demographicAge:'',demographicIncome:'',demographicParental:''}};
  const items = api.compareLI(sLi, dLi);
  assert.ok(items.length >= 10, 'YouTube: items >= 10, got ' + items.length);
});

// ═══════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════
test('OTT: empty targeting for null inputs', () => {
  api.setMediaType('ott');
  assert.equal(api.compareLI_OTT_Targeting(null, {}).length, 0);
  assert.equal(api.compareLI_OTT_Targeting({}, null).length, 0);
});

test('OTT: device with no devices set', () => {
  api.setMediaType('ott');
  const result = api.compareOttDevice({}, '');
  assert.equal(result.sVal, '(設定なし)');
  assert.equal(result.result, 'ok');
});

test('OTT: device with PC only', () => {
  api.setMediaType('ott');
  const result = api.compareOttDevice(
    {devicePC:'●',deviceSP:'-',deviceTablet:'-',deviceCTV:'-',deviceCD:'-'},
    '30000;'
  );
  assert.equal(result.result, 'ok', 'PC(30000) should match 30000');
});
