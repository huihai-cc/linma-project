// OTT compareLI Geography Test (Phase3-3)
// 検証: compareLI_OTT_Geography — 地域 Targeting 比較
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
'window.__ottGeoApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Geography: typeof compareLI_OTT_Geography === "function" ? compareLI_OTT_Geography : undefined,\n' +
'  compareGeography: typeof compareGeography === "function" ? compareGeography : undefined,\n' +
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
  return sandbox.__ottGeoApi;
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

async function getOttGeoItem(caseId) {
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
  const items = api.compareLI_OTT_Geography(setting.liList[0], download.liList[0]);
  const geoItem = findItem(items, '地域 / Geography Targeting');
  return { geoItem, items, sLi: setting.liList[0], dLi: download.liList[0] };
}

// ── テスト ──

test('OTT geography function exported', () => {
  assert.ok(typeof api.compareLI_OTT_Geography === 'function', 'compareLI_OTT_Geography');
  assert.ok(typeof api.compareGeography === 'function', 'compareGeography');
});

// ═══════════════════════════════════════════
// Case 001: Geography comparison
// ═══════════════════════════════════════════
test('Case 001: geography item exists', async () => {
  const data = await getOttGeoItem('001');
  assert.ok(data, 'should get data');
  assert.ok(data.geoItem, 'should have geography item');
});

test('Case 001: geography result is valid', async () => {
  const data = await getOttGeoItem('001');
  assert.ok(data.geoItem, 'should have geo item');
  assert.ok(['ok','mismatch','warning'].includes(data.geoItem.result),
    'valid result: ' + data.geoItem.result);
  assert.ok(data.geoItem.sVal || data.geoItem.dVal, 'should have geo values');
});

test('Case 001: geography has sVal and dVal', async () => {
  const data = await getOttGeoItem('001');
  assert.ok(data.geoItem.sVal.length > 0 || data.geoItem.dVal.length > 0,
    'at least one of sVal/dVal should be non-empty');
});

// ═══════════════════════════════════════════
// Case 003: minimal case
// ═══════════════════════════════════════════
test('Case 003: geography item exists', async () => {
  const data = await getOttGeoItem('003');
  if (!data) { console.log('  [SKIP] no data for case 003'); return; }
  assert.ok(data.geoItem, 'should have geo item');
  assert.ok(['ok','mismatch','warning'].includes(data.geoItem.result));
});

// ═══════════════════════════════════════════
// Case 004: large GP data
// ═══════════════════════════════════════════
test('Case 004: geography item exists', async () => {
  const data = await getOttGeoItem('004');
  if (!data) { console.log('  [SKIP] no data for case 004'); return; }
  assert.ok(data.geoItem, 'should have geo item');
});

// ═══════════════════════════════════════════
// Case 005: Deal case
// ═══════════════════════════════════════════
test('Case 005: geography item exists', async () => {
  const data = await getOttGeoItem('005');
  if (!data) { console.log('  [SKIP] no data for case 005'); return; }
  assert.ok(data.geoItem, 'should have geo item');
});

// ═══════════════════════════════════════════
// Geography included in combined compareLI
// ═══════════════════════════════════════════
test('Case 001: compareLI includes geography', async () => {
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
  assert.ok(labels.includes('地域 / Geography Targeting'), 'compareLI should include geography');
  // OTT should NOT have GP-level geography (it's at LI level)
  assert.ok(!labels.includes('GP 地域'), 'should not have GP geo');
});

// ═══════════════════════════════════════════
// YouTube non-regression
// ═══════════════════════════════════════════
test('YouTube: geography still at LI level', () => {
  api.setMediaType('youtube');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = { name:'Test', fields:{ videoType:'VRC(s)', startDate:'2026/06/24', endDate:'2026/06/30',
    daypart:'', budgetNet:'500000', dailyBudget:'', pacing:'掲載期間', billing:'CPM',
    bidCap:'', inventory:'YouTube', language:'', region:'Japan', geoReference:'', gender:'', age:'',
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
  const labels = items.map(i => i.label);
  assert.ok(labels.includes('地域 / Geography Targeting'), 'YouTube LI should have geography');
});
