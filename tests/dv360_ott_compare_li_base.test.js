// OTT compareLI Base Test (Phase3-1)
// 検証: compareLI_OTT_Base — LI基本フィールド比較
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
'window.__ottLiApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Base: typeof compareLI_OTT_Base === "function" ? compareLI_OTT_Base : undefined,\n' +
'  compareField: typeof compareField === "function" ? compareField : undefined,\n' +
'  compareMoney: typeof compareMoney === "function" ? compareMoney : undefined,\n' +
'  buildCaseStatusItem: typeof buildCaseStatusItem === "function" ? buildCaseStatusItem : undefined,\n' +
'  buildRawSdfStatusItem: typeof buildRawSdfStatusItem === "function" ? buildRawSdfStatusItem : undefined,\n' +
'  getSdfStatusValue: typeof getSdfStatusValue === "function" ? getSdfStatusValue : undefined,\n' +
'  compareCP: typeof compareCP === "function" ? compareCP : undefined,\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  getMediaType: function() { return mediaType; },\n' +
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
  return sandbox.__ottLiApi;
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

// ── ヘルパー: LI データ取得 ──
async function getOttLIData(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);

  // Match first LI
  if (!setting.liList.length || !download.liList.length) return null;
  const sLi = setting.liList[0];
  const dLi = download.liList[0];
  const items = api.compareLI_OTT_Base(sLi, dLi);
  return { sLi, dLi, items };
}

// ── テスト ──

test('OTT compareLI functions exported', () => {
  assert.ok(typeof api.compareLI === 'function', 'compareLI');
  assert.ok(typeof api.compareLI_OTT_Base === 'function', 'compareLI_OTT_Base');
});

test('compareLI entry routes to OTT base', async () => {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const data = await getOttLIData('001');
  assert.ok(data, 'should get LI data');
  // compareLI for OTT = Base + Targeting (Phase3-2 onwards)
  const viaEntry = api.compareLI(data.sLi, data.dLi);
  const viaDirect = api.compareLI_OTT_Base(data.sLi, data.dLi);
  assert.ok(viaEntry.length >= viaDirect.length, 'compareLI should include Base + Targeting (>= Base only)');
  assert.ok(viaEntry.length >= 14, 'should have Base(11) + Targeting(4) items, got ' + viaEntry.length);
});

// ═══════════════════════════════════════════
// Case 001: full test
// ═══════════════════════════════════════════
test('Case 001: LI Type', async () => {
  const data = await getOttLIData('001');
  assert.ok(data, 'should get data');
  const item = findItem(data.items, '動画タイプ');
  assert.ok(item, 'should have LI type item');
  assert.ok(item.sVal || item.dVal, 'should have values');
  assert.ok(['ok','mismatch','warning'].includes(item.result), 'result should be ok/mismatch/warning');
});

test('Case 001: Start Date', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '開始日');
  assert.ok(item, 'should have start date');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: End Date', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '終了日');
  assert.ok(item, 'should have end date');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: Budget', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '予算');
  assert.ok(item, 'should have budget');
  assert.ok(item.sVal || item.dVal, 'should have budget values');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: Pacing', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '配信ペース');
  assert.ok(item, 'should have pacing');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: Bid Strategy', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '入札形式');
  assert.ok(item, 'should have bid strategy');
  assert.ok(item.sVal || item.dVal, 'should have values');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: Bid Price', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '入札単価');
  assert.ok(item, 'should have bid price');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: Revenue Model', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '収益モデル');
  assert.ok(item, 'should have revenue model');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: 広告枠ソース比較は削除済み（Deal関連はcompareLI_OTT_Dealのみ）', async () => {
  const data = await getOttLIData('001');
  const item = findItem(data.items, '広告枠ソース');
  assert.equal(item, undefined, '広告枠ソース item should NOT exist in OTT LI Base');
});

test('Case 001: Status items present', async () => {
  const data = await getOttLIData('001');
  const caseStatus = findItem(data.items, 'ステータス');
  assert.ok(caseStatus, 'should have case status');
  const rawStatus = data.items.find(i => i.key === 'raw_sdf__status');
  assert.ok(rawStatus, 'should have raw SDF status');
});

test('Case 001: all base items count >= 11', async () => {
  const data = await getOttLIData('001');
  assert.ok(data.items.length >= 11, 'should have at least 11 comparison items, got ' + data.items.length);
});

// ═══════════════════════════════════════════
// Case 003: minimal case
// ═══════════════════════════════════════════
test('Case 003: items returned', async () => {
  const dir = path.join(ottRoot, '003');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  if (!setting.liList.length) { console.log('  [SKIP] no LIs in case 003'); return; }

  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  if (!download.liList.length) { console.log('  [SKIP] no SDF LIs in case 003'); return; }

  const items = api.compareLI_OTT_Base(setting.liList[0], download.liList[0]);
  assert.ok(items.length >= 8, 'Case 003: should have comparison items, got ' + items.length);
});

// ═══════════════════════════════════════════
// Case 004: large GP data
// ═══════════════════════════════════════════
test('Case 004: items returned', async () => {
  const dir = path.join(ottRoot, '004');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  if (!setting.liList.length) { console.log('  [SKIP] no LIs in case 004'); return; }

  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  if (!download.liList.length) { console.log('  [SKIP] no SDF LIs in case 004'); return; }

  const items = api.compareLI_OTT_Base(setting.liList[0], download.liList[0]);
  assert.ok(items.length >= 8, 'Case 004: should have comparison items, got ' + items.length);
});

// ═══════════════════════════════════════════
// Case 005: Deal case
// ═══════════════════════════════════════════
test('Case 005: items returned', async () => {
  const dir = path.join(ottRoot, '005');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  if (!setting.liList.length) { console.log('  [SKIP] no LIs in case 005'); return; }

  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  if (!download.liList.length) { console.log('  [SKIP] no SDF LIs in case 005'); return; }

  const items = api.compareLI_OTT_Base(setting.liList[0], download.liList[0]);
  assert.ok(items.length >= 8, 'Case 005: should have comparison items, got ' + items.length);
});

// ═══════════════════════════════════════════
// YouTube regression: compareLI unchanged
// ═══════════════════════════════════════════
test('YouTube: compareLI not affected', () => {
  api.setMediaType('youtube');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = {
    name: 'Test LI', fields: {
      videoType:'VRC(s)', startDate:'2026/06/24', endDate:'2026/06/30',
      daypart:'', budgetNet:'500000', dailyBudget:'', pacing:'掲載期間',
      billing:'CPM', bidCap:'', inventory:'YouTube', language:'', region:'',
      gender:'', age:'', parentalStatus:'', householdIncome:'', revenueModel:'',
    }
  };
  const dLi = {
    name: 'Test LI', id: 'li1',
    rawFields: { Status:'Active' }, rawFieldOrder:['Status'],
    statusInfo: { found:true, normalizedValue:'Active' },
    fields: {
      type:'Video', subtype:'In-stream', status:'Active',
      startDate:'06/24/2026', endDate:'06/30/2026',
      budgetType:'TOTAL', budgetAmount:'500000',
      pacing:'Flight', pacingRate:'Evenly',
      bidStrategyType:'Target CPM', bidStrategyValue:'',
      trueViewKpiType:'CPCV', trueViewKpiValue:'',
      inventorySource:'YouTube', languageTargeting:'Japanese',
      geographyTargeting:'Japan', geographyExclude:'',
      daypartTargeting:'', partnerRevenueModel:'', partnerRevenueAmount:'',
      demographicGender:'', demographicAge:'',
      demographicIncome:'', demographicParental:'',
    }
  };

  const items = api.compareLI(sLi, dLi);
  // YouTube should have its full comparison including Daypart, Language, Geography etc.
  assert.ok(items.length >= 10, 'YouTube compareLI should have many items, got ' + items.length);
  // Check YouTube-specific fields exist
  const ytLabels = items.map(i => i.label);
  assert.ok(ytLabels.includes('動画タイプ'), 'YouTube should have 動画タイプ');
  assert.ok(ytLabels.includes('言語'), 'YouTube should have 言語');
});

// ═══════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════
test('OTT: null inputs return empty', () => {
  api.setMediaType('ott');
  assert.equal(api.compareLI(null, {}).length, 0);
  assert.equal(api.compareLI({}, null).length, 0);
});
