// OTT LI 专项规则测试（2026-08-06）
// 覆盖:
//   1. Status (Draft/Paused=ok, Active/Archived=mismatch, 空/未知=warning)
//   2. 動画タイプ (動画/Video 不受 Subtype 影响)
//   3. Same as Insertion Order 日期 (一致/不一致/找不到IO)
//   4. 予算期間 Flight/Daily
//   5. 配信ペース Even/ASAP/Ahead
//   6. 入札 Fixed / 7. Minimize+CPA / 8. Minimize+CPC / 9. Maximize+AV_VIEWED
//   10. Environment Web/App/Web+App/Web Not Optimized
//   11. Geography Include/Exclude
//   12. Device Include 一致/缺少/多出/未知ID
//   13. Device Exclude 存在
//   14. 下载独有字段追加且不重复
// 另含 002 実案件（梅田芸術劇場）フル比較
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
'window.__ottLiApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Base: typeof compareLI_OTT_Base === "function" ? compareLI_OTT_Base : undefined,\n' +
'  compareLI_OTT_Targeting: typeof compareLI_OTT_Targeting === "function" ? compareLI_OTT_Targeting : undefined,\n' +
'  compareLI_OTT_Geography: typeof compareLI_OTT_Geography === "function" ? compareLI_OTT_Geography : undefined,\n' +
'  compareOttDevice: typeof compareOttDevice === "function" ? compareOttDevice : undefined,\n' +
'  compareOttEnvironment: typeof compareOttEnvironment === "function" ? compareOttEnvironment : undefined,\n' +
'  compareOttLiStatus: typeof compareOttLiStatus === "function" ? compareOttLiStatus : undefined,\n' +
'  compareOttBidTargetMode: typeof compareOttBidTargetMode === "function" ? compareOttBidTargetMode : undefined,\n' +
'  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === "function" ? appendDownloadOnlyItems : undefined,\n' +
'  ensureGeoMasterLoaded: typeof ensureGeoMasterLoaded === "function" ? ensureGeoMasterLoaded : undefined,\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
'  setSelectedMediaType: typeof setSelectedMediaType === "function" ? setSelectedMediaType : undefined,\n' +
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
    const rows = text.split(/\r?\n/).filter(l => l.trim())
      .map(line => line.split(',').map(c => c.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim()));
    if (rows.length > 0) csvFiles.push({ name: filename, rows });
  }
  return csvFiles;
}

const api = loadDv360Api();

function findItem(items, label) {
  return items.find(i => i.label === label);
}

function makeLi(sFields, dFields, dRaw, extra = {}) {
  const sLi = { name: 'S_LI', fields: { liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
    budget100: '500000', budget98: '490000', budgetPace: '掲載期間', flightMode: '掲載期間',
    paceMode: '均等', bidStrategy: '固定入札', bidForm: '固定入札', bidTarget: '▼選択', bidPrice: '1700',
    environment: 'ウェブ＆アプリ', devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-',
    ...sFields } };
  const dLi = { name: 'D_LI', id: 'li1', rawFields: dRaw || {}, rawFieldOrder: Object.keys(dRaw || {}),
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: { type: 'Video', subtype: 'Simple', status: 'Draft',
      startDate: '2026/6/29', endDate: '2026/7/28',
      budgetType: 'Amount', budgetAmount: '490000', pacing: 'Flight', pacingRate: 'Even',
      bidStrategyType: 'Fixed', bidStrategyValue: '1700', bidStrategyUnit: '', bidStrategyDoNotExceed: '0',
      applyFloorPriceForDeals: 'False', deviceTargetingInclude: '30000; 30001; 30002; 30004;',
      deviceTargetingExclude: '', environmentTargeting: 'Web; App;',
      geographyTargetingInclude: '', geographyTargetingExclude: '', geographyTargeting: '', geographyExclude: '',
      inventorySource: '', partnerRevenueModel: '', partnerRevenueAmount: '',
      ...dFields }, ...extra };
  return { sLi, dLi };
}

function baseItems(sFields, dFields, dRaw, extra) {
  const { sLi, dLi } = makeLi(sFields, dFields, dRaw, extra);
  return { items: api.compareLI_OTT_Base(sLi, dLi), sLi, dLi };
}

// ── 1. Status ──
test('LI Status: Draft and Paused are ok', () => {
  api.setMediaType('ott');
  api.setSelectedDv360CaseType('initial');
  for (const status of ['Draft', 'Paused']) {
    const { items } = baseItems({}, {}, {}, { statusInfo: { found: true, normalizedValue: status, rawValue: status } });
    const st = findItem(items, 'ステータス');
    assert.equal(st.result, 'ok', status + ' should be ok');
  }
});

test('LI Status: Active and Archived are mismatch', () => {
  api.setMediaType('ott');
  api.setSelectedDv360CaseType('initial');
  for (const status of ['Active', 'Archived']) {
    const { items } = baseItems({}, {}, {}, { statusInfo: { found: true, normalizedValue: status, rawValue: status } });
    const st = findItem(items, 'ステータス');
    assert.equal(st.result, 'mismatch', status + ' should be mismatch');
  }
});

test('LI Status: empty or unknown values are warning', () => {
  api.setMediaType('ott');
  api.setSelectedDv360CaseType('initial');
  const empty = baseItems({}, {}, {}, { statusInfo: { found: true, normalizedValue: '', rawValue: '' } });
  assert.equal(findItem(empty.items, 'ステータス').result, 'warning', 'empty should be warning');
  const unknown = baseItems({}, {}, {}, { statusInfo: { found: true, normalizedValue: 'Scheduled', rawValue: 'Scheduled' } });
  assert.equal(findItem(unknown.items, 'ステータス').result, 'warning', 'unknown should be warning');
  const missing = baseItems({}, {}, {}, { statusInfo: { found: false, normalizedValue: '', rawValue: undefined } });
  assert.equal(findItem(missing.items, 'ステータス').result, 'warning', 'missing should be warning');
});

// ── 2. 動画タイプ / Subtype ──
test('LI Type: 動画/Video ok regardless of Subtype', () => {
  api.setMediaType('ott');
  for (const subtype of ['Simple', 'In-stream', '']) {
    const { items } = baseItems({}, { subtype });
    const t = findItem(items, '動画タイプ');
    assert.equal(t.result, 'ok', 'video type ok with subtype=' + JSON.stringify(subtype));
    assert.equal(t.sVal, '動画');
    assert.equal(t.dVal, 'Video');
  }
});

test('LI Type: ディスプレイ/Display and オーディオ/Audio map correctly', () => {
  api.setMediaType('ott');
  const d = baseItems({ liType: 'ディスプレイ' }, { type: 'Display', subtype: '' });
  assert.equal(findItem(d.items, '動画タイプ').result, 'ok');
  const a = baseItems({ liType: 'オーディオ' }, { type: 'Audio', subtype: '' });
  assert.equal(findItem(a.items, '動画タイプ').result, 'ok');
});

test('Subtype: 設定表なし + SDF有り → S:— / D:Simple, warning', () => {
  api.setMediaType('ott');
  const { items } = baseItems({}, { subtype: 'Simple' });
  const sub = findItem(items, 'Subtype');
  assert.equal(sub.sVal, '—');
  assert.equal(sub.dVal, 'Simple');
  assert.equal(sub.result, 'warning');
});

// ── 3. Same as Insertion Order ──
test('Dates: Same as Insertion Order + IO一致 → ok, D值显示参照IO', () => {
  api.setMediaType('ott');
  const { items } = baseItems({}, { startDate: 'Same as Insertion Order', endDate: 'Same as Insertion Order' },
    {}, { resolvedIo: { id: 'io1', name: 'IO1', startDate: '2026-06-29', endDate: '2026-07-28' } });
  const st = findItem(items, '開始日');
  assert.equal(st.result, 'ok');
  assert.ok(st.dVal.includes('2026-06-29'), 'D should show IO date: ' + st.dVal);
  const en = findItem(items, '終了日');
  assert.equal(en.result, 'ok');
  assert.ok(en.dVal.includes('2026-07-28'));
});

test('Dates: Same as Insertion Order + IO日期不一致 → mismatch', () => {
  api.setMediaType('ott');
  const { items } = baseItems({}, { startDate: 'Same as Insertion Order' },
    {}, { resolvedIo: { id: 'io1', name: 'IO1', startDate: '2026-07-01', endDate: '2026-07-28' } });
  assert.equal(findItem(items, '開始日').result, 'mismatch');
});

test('Dates: Same as Insertion Order + IO找不到 → warning', () => {
  api.setMediaType('ott');
  const { items } = baseItems({}, { startDate: 'Same as Insertion Order', endDate: 'Same as Insertion Order' },
    {}, { resolvedIo: null });
  assert.equal(findItem(items, '開始日').result, 'warning');
  assert.equal(findItem(items, '終了日').result, 'warning');
});

test('Dates: SDF为实际日期时直接比较', () => {
  api.setMediaType('ott');
  const { items } = baseItems({}, { startDate: '06/29/2026', endDate: '07/28/2026' });
  assert.equal(findItem(items, '開始日').result, 'ok');
  assert.equal(findItem(items, '終了日').result, 'ok');
});

// ── 4. 予算期間 Flight/Daily ──
test('Pacing: 掲載期間/Flight ok, 日次/Daily ok', () => {
  api.setMediaType('ott');
  const flight = baseItems({ flightMode: '掲載期間' }, { pacing: 'Flight' });
  assert.equal(findItem(flight.items, '予算期間').result, 'ok');
  const daily = baseItems({ flightMode: '日次' }, { pacing: 'Daily' });
  assert.equal(findItem(daily.items, '予算期間').result, 'ok');
  const mismatch = baseItems({ flightMode: '日次' }, { pacing: 'Flight' });
  assert.equal(findItem(mismatch.items, '予算期間').result, 'mismatch');
});

// ── 5. 配信ペース Even/ASAP/Ahead ──
test('Pacing Rate: 均等/Even, できるだけ早く/ASAP, 前倒し/Ahead', () => {
  api.setMediaType('ott');
  const even = baseItems({ paceMode: '均等' }, { pacingRate: 'Even' });
  assert.equal(findItem(even.items, '配信ペース').result, 'ok');
  const asap = baseItems({ paceMode: 'できるだけ早く' }, { pacingRate: 'ASAP' });
  assert.equal(findItem(asap.items, '配信ペース').result, 'ok');
  const ahead = baseItems({ paceMode: '前倒し' }, { pacingRate: 'Ahead' });
  assert.equal(findItem(ahead.items, '配信ペース').result, 'ok');
  const bad = baseItems({ paceMode: '均等' }, { pacingRate: 'ASAP' });
  assert.equal(findItem(bad.items, '配信ペース').result, 'mismatch');
});

// ── 6-9. 入札規則 ──
test('Bid: 固定入札 → Fixed + 単価比較', () => {
  api.setMediaType('ott');
  const { items } = baseItems({ bidForm: '固定入札', bidPrice: '1700' },
    { bidStrategyType: 'Fixed', bidStrategyValue: '1700' });
  const bid = findItem(items, '入札形式');
  assert.equal(bid.result, 'ok');
  const price = findItem(items, '入札単価');
  assert.equal(price.result, 'ok');
  assert.equal(price.sVal, '1700');
  assert.equal(price.dVal, '1700');
});

test('Bid: 固定入札 + 単価不一致 → mismatch', () => {
  api.setMediaType('ott');
  const { items } = baseItems({ bidForm: '固定入札', bidPrice: '1700' }, { bidStrategyValue: '2000' });
  assert.equal(findItem(items, '入札単価').result, 'mismatch');
});

test('Bid: コンバージョン数を最大化 → Minimize + CPA', () => {
  api.setMediaType('ott');
  const ok = baseItems({ bidForm: 'コンバージョン数を最大化', bidPrice: '' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPA', bidStrategyValue: '' });
  assert.equal(findItem(ok.items, '入札形式').result, 'ok');
  const bad = baseItems({ bidForm: 'コンバージョン数を最大化' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPC' });
  assert.equal(findItem(bad.items, '入札形式').result, 'mismatch');
  const wrongType = baseItems({ bidForm: 'コンバージョン数を最大化' },
    { bidStrategyType: 'Maximize', bidStrategyUnit: 'CPA' });
  assert.equal(findItem(wrongType.items, '入札形式').result, 'mismatch');
});

test('Bid: クリック数を最大化 → Minimize + CPC', () => {
  api.setMediaType('ott');
  const ok = baseItems({ bidForm: 'クリック数を最大化', bidPrice: '' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPC', bidStrategyValue: '' });
  assert.equal(findItem(ok.items, '入札形式').result, 'ok');
  const bad = baseItems({ bidForm: 'クリック数を最大化' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPA' });
  assert.equal(findItem(bad.items, '入札形式').result, 'mismatch');
});

test('Bid: 視認範囲のインプレッションを最大化 → Maximize + AV_VIEWED', () => {
  api.setMediaType('ott');
  const ok = baseItems({ bidForm: '視認範囲のインプレッションを最大化', bidPrice: '' },
    { bidStrategyType: 'Maximize', bidStrategyUnit: 'AV_VIEWED', bidStrategyValue: '' });
  assert.equal(findItem(ok.items, '入札形式').result, 'ok');
  // 未知Unit(例:AV_VIEWED以外)は等価としない
  const unknownUnit = baseItems({ bidForm: '視認範囲のインプレッションを最大化' },
    { bidStrategyType: 'Maximize', bidStrategyUnit: 'AV_VIEWED_CUSTOM' });
  assert.equal(findItem(unknownUnit.items, '入札形式').result, 'mismatch');
});

test('Bid: 目標単価の有無 — ▼選択は未指定として warning を出さない', () => {
  api.setMediaType('ott');
  const a = baseItems({ bidTarget: '▼選択' },
    { bidStrategyType: 'Fixed', bidStrategyUnit: '', bidStrategyDoNotExceed: '0' });
  const aIt = findItem(a.items, '目標単価の有無');
  assert.equal(aIt.result, 'ok');
  assert.equal(aIt.sVal, '(未指定)');
  assert.equal(aIt.dVal, '');
});

test('Bid: 目標単価の有無 — S空は未指定として warning を出さない', () => {
  api.setMediaType('ott');
  const { items } = baseItems({ bidTarget: '' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPA', bidStrategyDoNotExceed: '500' });
  const it = findItem(items, '目標単価の有無');
  assert.equal(it.result, 'ok');
  assert.equal(it.sVal, '(未指定)', 'S空 → (未指定)');
});

test('Bid: 目標単価の有無 — 予算を使い切ることを推奨 + 制約なし = warning', () => {
  api.setMediaType('ott');
  const { items } = baseItems({ bidTarget: '予算を使い切ることを推奨' },
    { bidStrategyType: 'Maximize', bidStrategyUnit: '', bidStrategyDoNotExceed: '' });
  const it = findItem(items, '目標単価の有無');
  assert.equal(it.result, 'warning');
  assert.equal(it.sVal, '予算を使い切ることを推奨');
});

test('Bid: 目標単価の有無 — while prioritizing + SDFターゲット制約 = warning（比較不可）', () => {
  api.setMediaType('ott');
  const { items } = baseItems({ bidTarget: 'while prioritizing hitting a target' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPA', bidStrategyDoNotExceed: '500' });
  assert.equal(findItem(items, '目標単価の有無').result, 'warning');
  // SDF制約の有無にかかわらず、SDFに対応フィールドがないため比較不能
  const bad = baseItems({ bidTarget: 'while prioritizing hitting a target' },
    { bidStrategyType: 'Maximize', bidStrategyUnit: '', bidStrategyDoNotExceed: '' });
  assert.equal(findItem(bad.items, '目標単価の有無').result, 'warning');
});

test('Bid: 入札形式 Fixed は「入札形式」項目で比較され 目標単価 とは独立', () => {
  api.setMediaType('ott');
  const ok = baseItems({ bidForm: '固定入札', bidTarget: '▼選択', bidPrice: '1700' },
    { bidStrategyType: 'Fixed', bidStrategyUnit: 'CPM', bidStrategyValue: '1700' });
  assert.equal(findItem(ok.items, '入札形式').result, 'ok');
  assert.equal(findItem(ok.items, '目標単価の有無').result, 'ok', '未指定の目標単価は warning にしない');
});

// ── 10. Environment ──
test('Environment: Web/App/Web+App 集合一致 = ok', () => {
  api.setMediaType('ott');
  const web = api.compareOttEnvironment('ウェブ', 'Web;');
  assert.equal(web.result, 'ok');
  const app = api.compareOttEnvironment('アプリ', 'App');
  assert.equal(app.result, 'ok');
  const both = api.compareOttEnvironment('ウェブ＆アプリ', 'Web; App;');
  assert.equal(both.result, 'ok');
  const bothRev = api.compareOttEnvironment('ウェブ＆アプリ', 'app; web'); // 順序無視
  assert.equal(bothRev.result, 'ok');
});

test('Environment: Web Not Optimized は独立値として扱う', () => {
  api.setMediaType('ott');
  const mismatch = api.compareOttEnvironment('ウェブ', 'Web Not Optimized;');
  assert.equal(mismatch.result, 'mismatch', 'Web != Web Not Optimized');
  const mixed = api.compareOttEnvironment('ウェブ', 'Web Not Optimized; Web;');
  assert.equal(mixed.result, 'mismatch', 'Web Not Optimized 追加は一致とみなさない');
  const self = api.compareOttEnvironment('ウェブ', 'Web;');
  assert.equal(self.result, 'ok');
  const wno = api.compareOttEnvironment('ウェブ', 'Web Not Optimized');
  assert.equal(wno.result, 'mismatch');
  // 同じ集合同士は ok（Web Not Optimized 同士）
  const both = api.compareOttEnvironment('ウェブ', 'Web Not Optimized; Web;');
  assert.notEqual(both.result, 'ok');
});

// ── 11. Geography Include/Exclude ──
test('Geography: 地域名 → ID解決して一致 = ok（GeoMaster使用）', async () => {
  api.setMediaType('ott');
  if (api.ensureGeoMasterLoaded) await api.ensureGeoMasterLoaded();
  const sLi = { name: 'S_LI', fields: { liType: '動画', geo: '東京都\n埼玉県\n神奈川県\n千葉県' } };
  const dLi = { name: 'D_LI', id: 'li1', rawFields: { 'Geography Targeting - Include': '20634; 20635; 20636; 20637;' },
    rawFieldOrder: ['Geography Targeting - Include'],
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: { type: 'Video', subtype: 'Simple', status: 'Draft',
      geographyTargeting: '20634; 20635; 20636; 20637;', geographyTargetingInclude: '20634; 20635; 20636; 20637;',
      geographyExclude: '', geographyTargetingExclude: '' } };
  const items = api.compareLI_OTT_Geography(sLi, dLi);
  const geo = findItem(items, '地域 / Geography Targeting');
  assert.equal(geo.result, 'ok', 'geo should be ok: ' + geo.result);
});

test('Geography: 設定表なし + SDF除外あり → warning', async () => {
  api.setMediaType('ott');
  if (api.ensureGeoMasterLoaded) await api.ensureGeoMasterLoaded();
  const sLi = { name: 'S_LI', fields: { liType: '動画', geo: 'Japan' } };
  const dLi = { name: 'D_LI', id: 'li1', rawFields: {
    'Geography Targeting - Include': '2392;', 'Geography Targeting - Exclude': '20636;' },
    rawFieldOrder: ['Geography Targeting - Include', 'Geography Targeting - Exclude'],
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: { type: 'Video', subtype: 'Simple', status: 'Draft',
      geographyTargeting: '2392;', geographyTargetingInclude: '2392;',
      geographyExclude: '20636;', geographyTargetingExclude: '20636;' } };
  const items = api.compareLI_OTT_Geography(sLi, dLi);
  const geo = findItem(items, '地域 / Geography Targeting');
  assert.equal(geo.result, 'warning', 'exclude only in SDF should be warning: ' + geo.result);
});

// ── 12. Device Include ──
test('Device: 設定4デバイス = SDF 4ID → ok', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;');
  assert.equal(r.result, 'ok');
});

test('Device: 缺少（設定3, SDF 4ID）→ mismatch', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '-', deviceCD: '-' },
    '30000; 30001; 30002; 30004;');
  assert.equal(r.result, 'mismatch');
});

test('Device: 多出（設定4, SDF 3ID）→ mismatch', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002;');
  assert.equal(r.result, 'mismatch');
});

test('Device: 未知ID → warning 且显示未知ID', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004; 99999;');
  assert.equal(r.result, 'warning');
  assert.ok(r.detail.includes('99999'), 'unknown id shown: ' + r.detail);
});

// ── 13. Device Include/Exclude 統合（2026-08-06: デバイス1項目に統合） ──
test('Device: Include=4, Exclude=空 → ok', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '');
  assert.equal(r.result, 'ok');
  assert.equal(r.sVal, 'PC / Smartphone / Tablet / Connected TV');
  assert.ok(r.dVal.includes('30000（PC）'), 'dVal ID+name: ' + r.dVal);
});

test('Device: Exclude が同一デバイスを除外 → 最終集合で比較', () => {
  api.setMediaType('ott');
  // Include=4, Exclude=30001 → 最終3 vs 設定4 → mismatch（除外明示）
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '30001;');
  assert.equal(r.result, 'mismatch');
  assert.ok(r.dVal.includes('除外: 30001（Smartphone）'), 'dVal shows exclusion: ' + r.dVal);
  assert.ok(r.detail.includes('除外'), 'detail: ' + r.detail);
  // 設定=3（CTVなし）, Exclude=30004 → 最終3 = 設定3 → ok
  const r2 = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '-', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '30004;');
  assert.equal(r2.result, 'ok', 'final set match: ' + r2.result);
});

test('Device: Exclude 未知ID → warning かつ「未識別」表示', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;', '99999;');
  assert.equal(r.result, 'warning');
  assert.ok(r.dVal.includes('99999（未識別）'), 'dVal unknown display: ' + r.dVal);
});

// ── 14. 下载独有字段 ──
test('Download-only: 未消费非空字段が追加され、消費済みは重複しない', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = makeLi({}, {},
    { Status: 'Draft', Type: 'Video', Subtype: 'Simple', 'Bid Strategy Type': 'Fixed',
      'Bid Strategy Value': '1700', 'Device Targeting - Include': '30000;',
      'Creative Assignments': '731756403;', 'Brand Safety Sensitivity Setting': 'Do not block',
      'Integration Code': 'abc123' });
  const items = api.compareLI(sLi, dLi); // 全OTTチェーン（DownloadDefaults含む）
  const all = api.appendDownloadOnlyItems('LI', dLi, items);
  const labels = all.map(i => i.label);
  // ビジネス規則で消費済み → ダウンロード専用として重複追加されない（コア項目自体は除く）
  const autoAdded = all.filter(i => i.isAutoAdded);
  const autoLabels = autoAdded.map(i => i.label);
  assert.ok(!autoLabels.includes('Type'), 'Type consumed');
  assert.ok(!autoLabels.includes('Subtype'), 'Subtype consumed');
  assert.ok(!autoLabels.includes('Bid Strategy Value'), 'Bid Strategy Value consumed');
  assert.ok(!autoLabels.includes('Device Targeting - Include'), 'Device Targeting - Include consumed');
  assert.ok(!autoLabels.includes('Creative Assignments'), 'Creative Assignments excluded as metadata');
  // Brand Safety は DownloadDefaults の明示比較項目で消費済み → 二重追加されない
  const brand = all.find(i => i.label.includes('Brand Safety'));
  assert.ok(brand, 'Brand Safety は明示比較項目として表示');
  assert.ok(!brand.isAutoAdded, 'Brand Safety はダウンロード専用として二重追加されない');
  assert.ok(!autoLabels.some(l => l.includes('Brand Safety')), 'Brand Safety not in auto-added');
  // 未消費の非空フィールドはダウンロード専用項目として追加される
  const integration = all.find(i => i.label.includes('Integration Code'));
  assert.ok(integration, 'Integration Code should be appended');
  // 重複なし（自動追加分がコア項目のラベルと重複しない）
  const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
  assert.equal(dupes.length, 0, 'no duplicate labels: ' + dupes.join(', '));
});

test('Download-only: 002案件でCreative Assignments等がノイズとして出ない', async () => {
  const dir = path.join(ottRoot, '002');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  if (api.ensureGeoMasterLoaded) await api.ensureGeoMasterLoaded();
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  for (const sLi of setting.liList) {
    const dLi = download.liList.find(d => norm(d.name) === norm(sLi.name));
    assert.ok(dLi, 'download LI matched: ' + sLi.name);
    const all = api.appendDownloadOnlyItems('LI', dLi, api.compareLI(sLi, dLi));
    const labels = all.map(i => i.label);
    assert.ok(!labels.some(l => l.includes('Creative Assignments')), 'no Creative Assignments noise');
    assert.ok(!labels.some(l => l === 'Io Name' || l === 'Name'), 'no Name noise');
  }
});

// ── 002 実案件フル検証（タスク十二の期待結果） ──
test('Case 002（梅田芸術劇場）: 全LIの主要項目が期待結果', async () => {
  const dir = path.join(ottRoot, '002');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  if (api.ensureGeoMasterLoaded) await api.ensureGeoMasterLoaded();

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  assert.ok(setting.liList.length >= 2, '2+ LIs in setting');
  assert.ok(download.liList.length >= 2, '2+ LIs in download');

  // IO日付参照解決
  for (const dLi of download.liList) {
    assert.ok(dLi.resolvedIo, 'LI has resolvedIo');
    assert.equal(dLi.resolvedIo.startDate, '2026-06-29');
    assert.equal(dLi.resolvedIo.endDate, '2026-07-28');
  }

  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  for (const sLi of setting.liList) {
    const dLi = download.liList.find(d => norm(d.name) === norm(sLi.name));
    assert.ok(dLi, 'matched download LI: ' + sLi.name);
    const items = api.compareLI(sLi, dLi);
    const expectOk = ['ステータス', '動画タイプ', '開始日', '終了日', '予算期間', '配信ペース',
      '予算', '入札形式', '入札単価', '言語', '環境', 'デバイス', '地域 / Geography Targeting'];
    for (const label of expectOk) {
      const item = findItem(items, label);
      assert.ok(item, 'item exists: ' + label);
      assert.equal(item.result, 'ok', label + ' should be ok, got ' + item.result);
    }
    // 目標単価の有無: ▼選択は未指定として warning を出さない
    const bidTarget = findItem(items, '目標単価の有無');
    assert.ok(bidTarget, '目標単価の有無 exists');
    assert.equal(bidTarget.result, 'ok', '目標単価の有無 should be ok/hidden');
    assert.equal(bidTarget.sVal, '(未指定)');
    // デバイス(除外) は双方空 → 生成しない
    assert.ok(!findItem(items, 'デバイス(除外)'), 'デバイス(除外) both empty → hidden');
    const type = findItem(items, '動画タイプ');
    assert.equal(type.sVal, '動画');
    assert.equal(type.dVal, 'Video');
    const sub = findItem(items, 'Subtype');
    assert.equal(sub.sVal, '—');
    assert.equal(sub.dVal, 'Simple');
    const start = findItem(items, '開始日');
    assert.ok(start.dVal.includes('Same as Insertion Order → 2026-06-29'), 'D: ' + start.dVal);
    const env = findItem(items, '環境');
    assert.equal(env.dVal, 'Web; App;');
    const dev = findItem(items, 'デバイス');
    assert.ok(dev.dVal.includes('30000'), 'device D: ' + dev.dVal);
    assert.ok(dev.dVal.includes('30004'), 'device D: ' + dev.dVal);
    const geo = findItem(items, '地域 / Geography Targeting');
    assert.ok(geo.result === 'ok', 'geo ok');
  }
});

test('Case 002: 全LI項目のラベル重複なし・result有効', async () => {
  const dir = path.join(ottRoot, '002');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  const valid = ['ok', 'mismatch', 'warning', 'notfound', 'download-only'];
  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  for (const sLi of setting.liList) {
    const dLi = download.liList.find(d => norm(d.name) === norm(sLi.name));
    const items = api.compareLI(sLi, dLi);
    const labels = items.map(i => i.label);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    assert.equal(dupes.length, 0, 'no dup labels: ' + dupes.join(', '));
    items.forEach(i => assert.ok(valid.includes(i.result), i.label + ': ' + i.result));
  }
});

// ── parseSdfData 新フィールド ──
test('parseSdfData: LineItems新フィールドが抽出される', async () => {
  const dir = path.join(ottRoot, '002');
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  const li = download.liList[0];
  const f = li.fields;
  assert.equal(f.bidStrategyUnit, '');
  assert.equal(f.bidStrategyDoNotExceed, '0');
  assert.equal(f.applyFloorPriceForDeals, 'False');
  assert.equal(f.deviceTargetingInclude, '30000; 30001; 30002; 30004;');
  assert.equal(f.deviceTargetingExclude, '');
  assert.equal(f.environmentTargeting, 'Web; App;');
  assert.ok(f.geographyTargetingInclude.includes('20634'), 'geo include');
  assert.equal(f.geographyTargetingExclude, '');
  assert.ok(li.rawFields['Bid Strategy Type'], 'rawFields preserved');
});
