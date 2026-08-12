// OTT LI 列提取・デフォルト値 专项测试（2026-08-06）
// 七: 列提取（AW言語 / BE地域 / BQ~BUデバイス5列 / 値抽出 / ●→ID）
// 八: OTT LI 専用ダウンロードデフォルト値
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
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  resolveOttColumns: typeof resolveOttColumns === "function" ? resolveOttColumns : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Targeting: typeof compareLI_OTT_Targeting === "function" ? compareLI_OTT_Targeting : undefined,\n' +
'  compareLI_OTT_Geography: typeof compareLI_OTT_Geography === "function" ? compareLI_OTT_Geography : undefined,\n' +
'  compareOttDevice: typeof compareOttDevice === "function" ? compareOttDevice : undefined,\n' +
'  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === "function" ? appendDownloadOnlyItems : undefined,\n' +
'  ensureGeoMasterLoaded: typeof ensureGeoMasterLoaded === "function" ? ensureGeoMasterLoaded : undefined,\n' +
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

const api = loadDv360Api();
const dir = path.join(ottRoot, '002');
const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
const workbook = parseWorkbook(path.join(dir, xf));
const ottRows = workbook.sheets['設定シート (OTT)'];

// ヘッダー行検出（parseOttSetting と同じロジック）
function findOttHeaderRow(rows) {
  for (let i = 20; i < Math.min(45, rows.length); i++) {
    const joined = rows[i].map(v => String(v || '').trim()).join(' ');
    if (joined.includes('NO') && joined.includes('IO名') && joined.includes('全体予算')) return i;
  }
  return -1;
}
const headerRow = findOttHeaderRow(ottRows);
assert.ok(headerRow >= 0, 'header row found');
const col = api.resolveOttColumns(ottRows[headerRow], ottRows[headerRow + 1] || []);

// ── 七.1-7: 列定位 ──
test('列定位: Row31「言語」→ AW(48)', () => {
  assert.equal(col.LI_LANGUAGE, 48, 'LI_LANGUAGE should be AW(48), got ' + col.LI_LANGUAGE);
});

test('列定位: Row31「地域」→ BE(56)', () => {
  assert.equal(col.LI_GEO, 56, 'LI_GEO should be BE(56), got ' + col.LI_GEO);
});

test('列定位: Row32「パソコン」→ BQ(68)', () => {
  assert.equal(col.LI_DEVICE_PC, 68, 'LI_DEVICE_PC should be BQ(68), got ' + col.LI_DEVICE_PC);
});

test('列定位: Row32「スマートフォン」→ BR(69)', () => {
  assert.equal(col.LI_DEVICE_SP, 69, 'LI_DEVICE_SP should be BR(69), got ' + col.LI_DEVICE_SP);
});

test('列定位: Row32「タブレット」→ BS(70)', () => {
  assert.equal(col.LI_DEVICE_TABLET, 70, 'LI_DEVICE_TABLET should be BS(70), got ' + col.LI_DEVICE_TABLET);
});

test('列定位: Row32「コネクテッド テレビ」→ BT(71)', () => {
  assert.equal(col.LI_DEVICE_CTV, 71, 'LI_DEVICE_CTV should be BT(71), got ' + col.LI_DEVICE_CTV);
});

test('列定位: 改行入り「コネクテッド デバイス（オーディオのみ）」→ BU(72)', () => {
  assert.equal(col.LI_DEVICE_CD, 72, 'LI_DEVICE_CD should be BU(72), got ' + col.LI_DEVICE_CD);
});

// ── 七.8-10: 値抽出 ──
test('値抽出: Japanese が抽出される', () => {
  api.setMediaType('ott');
  const result = api.parseOttSetting(workbook.sheets, workbook.sheetNames, xf);
  assert.ok(result.liList.length >= 2);
  for (const li of result.liList) {
    assert.equal(li.fields.language, 'Japanese', li.name + ' language=' + JSON.stringify(li.fields.language));
  }
});

test('値抽出: 大阪府/京都府/兵庫県 と 東京都/埼玉県/神奈川県/千葉県 が改行付きで保持される', () => {
  api.setMediaType('ott');
  const result = api.parseOttSetting(workbook.sheets, workbook.sheetNames, xf);
  const k = result.liList.find(li => li.name.includes('関西'));
  const kanto = result.liList.find(li => li.name.includes('関東'));
  assert.ok(k, '関西 LI exists');
  assert.ok(kanto, '関東 LI exists');
  assert.ok(k.fields.geo.includes('大阪府'), 'geo contains 大阪府: ' + JSON.stringify(k.fields.geo));
  assert.ok(k.fields.geo.includes('京都府'), 'geo contains 京都府');
  assert.ok(k.fields.geo.includes('兵庫県'), 'geo contains 兵庫県');
  assert.ok(kanto.fields.geo.includes('東京都'), 'geo contains 東京都');
  assert.ok(kanto.fields.geo.includes('埼玉県'), 'geo contains 埼玉県');
  assert.ok(kanto.fields.geo.includes('神奈川県'), 'geo contains 神奈川県');
  assert.ok(kanto.fields.geo.includes('千葉県'), 'geo contains 千葉県');
});

test('値抽出: ●●●●- が 30000/30001/30002/30004 に解決され ok', () => {
  api.setMediaType('ott');
  const r = api.compareOttDevice(
    { devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' },
    '30000; 30001; 30002; 30004;');
  assert.equal(r.result, 'ok', 'device match ok: ' + r.result);
  assert.equal(r.sVal, 'PC / Smartphone / Tablet / Connected TV');
});

// ── 六: 任意一方有値必表示 ──
test('表示保証: 設定表空+ダウンロード有値でも 言語/デバイス/環境/地域 項目が存在する', () => {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const sLi = { name: 'S_LI', fields: { liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
    budget100: '', budget98: '', flightMode: '掲載期間', paceMode: '均等', bidForm: '固定入札', bidPrice: '100',
    environment: '', language: '', geo: '', daypart: '',
    devicePC: '', deviceSP: '', deviceTablet: '', deviceCTV: '', deviceCD: '' } };
  const dLi = { name: 'D_LI', id: 'li1', rawFields: {
    'Language Targeting - Include': '1005;', 'Device Targeting - Include': '30000; 30001;',
    'Environment Targeting': 'Web; App;', 'Geography Targeting - Include': '20634; 20635; 20636; 20637;' },
    rawFieldOrder: ['Language Targeting - Include', 'Device Targeting - Include', 'Environment Targeting', 'Geography Targeting - Include'],
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: { type: 'Video', subtype: '', status: 'Draft', startDate: '2026/6/29', endDate: '2026/7/28',
      languageTargeting: '1005;', deviceTargetingInclude: '30000; 30001;',
      environmentTargeting: 'Web; App;', geographyTargeting: '20634; 20635; 20636; 20637;',
      geographyTargetingInclude: '20634; 20635; 20636; 20637;',
      deviceTargetingExclude: '', geographyTargetingExclude: '', geographyExclude: '',
      pacing: 'Flight', pacingRate: 'Even', budgetType: 'Amount', budgetAmount: '100',
      bidStrategyType: 'Fixed', bidStrategyValue: '100' } };
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const labels = items.map(i => i.label);
  for (const required of ['言語', 'デバイス', '環境']) {
    assert.ok(labels.includes(required), 'item exists: ' + required);
  }
  assert.equal(items.find(i => i.label === '言語').result, 'warning', '設定空+SDF有値言語=warning');
  // デバイス(除外) は双方空 → 生成しない
  assert.ok(!labels.includes('デバイス(除外)'), 'デバイス(除外) both empty → hidden');
  const geoItems = api.compareLI_OTT_Geography(sLi, dLi);
  assert.ok(geoItems.some(i => i.label === '地域 / Geography Targeting'), '地域 item always exists when download has value');
});

// ── 八: OTT LI デフォルト値 ──
function checkOttDefault(headers, fields) {
  return api.appendDownloadOnlyItems('LI', { rawFieldOrder: headers, rawFields: fields }, [])
    .filter(i => i.isAutoAdded);
}

test('デフォルト: OTT Frequency Period=Minutes → 非表示', () => {
  api.setMediaType('ott');
  const items = checkOttDefault(['Frequency Period'], { 'Frequency Period': 'Minutes' });
  const it = items.find(i => i.rawFieldName === 'Frequency Period');
  assert.equal(it, undefined, 'Frequency Period=Minutes should be hidden');
});

test('デフォルト: OTT Frequency Period=Days → warning', () => {
  api.setMediaType('ott');
  const items = checkOttDefault(['Frequency Period'], { 'Frequency Period': 'Days' });
  const it = items.find(i => i.rawFieldName === 'Frequency Period');
  assert.ok(it);
  assert.equal(it.result, 'warning');
});

test('デフォルト: Frequency Amount=0 / 0.0 → 非表示, 非0 → warning', () => {
  api.setMediaType('ott');
  for (const v of ['0', '0.0']) {
    const items = checkOttDefault(['Frequency Amount'], { 'Frequency Amount': v });
    assert.equal(items.some(i => i.rawFieldName === 'Frequency Amount'), false, v + ' should be hidden');
  }
  const warn = checkOttDefault(['Frequency Amount'], { 'Frequency Amount': '5' })
    .find(i => i.rawFieldName === 'Frequency Amount');
  assert.equal(warn.result, 'warning');
});

test('デフォルト: Algorithm Id=0 / 0.0 → 非表示, 非0 → warning', () => {
  api.setMediaType('ott');
  for (const v of ['0', '0.0']) {
    const items = checkOttDefault(['Algorithm Id'], { 'Algorithm Id': v });
    assert.equal(items.some(i => i.rawFieldName === 'Algorithm Id'), false, v + ' should be hidden');
  }
  const warn = checkOttDefault(['Algorithm Id'], { 'Algorithm Id': '3' })
    .find(i => i.rawFieldName === 'Algorithm Id');
  assert.equal(warn.result, 'warning');
});

test('デフォルト: Digital Content Labels - Exclude = "MA; ?;" → 非表示', () => {
  api.setMediaType('ott');
  const items = checkOttDefault(['Digital Content Labels - Exclude'], { 'Digital Content Labels - Exclude': 'MA; ?;' });
  assert.equal(items.some(i => i.rawFieldName === 'Digital Content Labels - Exclude'), false);
});

test('デフォルト: Digital Content Labels - Exclude 大小文字・空白・末尾分号の差異は 非表示', () => {
  api.setMediaType('ott');
  for (const v of ['ma ; ?', 'MA;?;', ' ma ; ? ; ']) {
    const items = checkOttDefault(['Digital Content Labels - Exclude'], { 'Digital Content Labels - Exclude': v });
    assert.equal(items.some(i => i.rawFieldName === 'Digital Content Labels - Exclude'), false, JSON.stringify(v) + ' should be hidden');
  }
  // token集合が異なる → warning
  const warn = checkOttDefault(['Digital Content Labels - Exclude'], { 'Digital Content Labels - Exclude': 'MA; X;' })
    .find(i => i.rawFieldName === 'Digital Content Labels - Exclude');
  assert.equal(warn.result, 'warning');
});

test('デフォルト: Brand Safety = "Do not block" → ok（想定デフォルト、常時表示）', () => {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const sLi = { name: 'S_LI', fields: { liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
    budget100: '', budget98: '', flightMode: '掲載期間', paceMode: '均等', bidForm: '固定入札', bidPrice: '100',
    environment: '', language: '', geo: '', daypart: '',
    devicePC: '', deviceSP: '', deviceTablet: '', deviceCTV: '', deviceCD: '' } };
  for (const v of ['Do not block', ' do NOT block ']) {
    const dLi = { name: 'D_LI', id: 'li1', rawFields: {
      'Brand Safety Sensitivity Setting': v,
      'Language Targeting - Include': '1005;', 'Device Targeting - Include': '30000; 30001;',
      'Environment Targeting': 'Web; App;', 'Geography Targeting - Include': '20634; 20635;' },
      rawFieldOrder: ['Brand Safety Sensitivity Setting'],
      statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
      fields: { type: 'Video', subtype: '', status: 'Draft', startDate: '2026/6/29', endDate: '2026/7/28',
        languageTargeting: '1005;', deviceTargetingInclude: '30000; 30001;',
        environmentTargeting: 'Web; App;', geographyTargeting: '20634; 20635;',
        geographyTargetingInclude: '20634; 20635;',
        deviceTargetingExclude: '', geographyTargetingExclude: '', geographyExclude: '',
        pacing: 'Flight', pacingRate: 'Even', budgetType: 'Amount', budgetAmount: '100',
        bidStrategyType: 'Fixed', bidStrategyValue: '100' } };
    const it = api.compareLI(sLi, dLi).find(i => i.label === 'Brand Safety Sensitivity Setting');
    assert.ok(it, JSON.stringify(v) + ' should be shown');
    assert.equal(it.result, 'ok', JSON.stringify(v) + ' should be ok');
  }
});

test('デフォルト: Brand Safety = "Use custom" → warning 表示（大小文字・空白無視）', () => {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const sLi = { name: 'S_LI', fields: { liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
    budget100: '', budget98: '', flightMode: '掲載期間', paceMode: '均等', bidForm: '固定入札', bidPrice: '100',
    environment: '', language: '', geo: '', daypart: '',
    devicePC: '', deviceSP: '', deviceTablet: '', deviceCTV: '', deviceCD: '' } };
  for (const v of ['Use custom', 'use  CUSTOM', '  use custom ']) {
    const dLi = { name: 'D_LI', id: 'li1', rawFields: {
      'Brand Safety Sensitivity Setting': v,
      'Language Targeting - Include': '1005;', 'Device Targeting - Include': '30000; 30001;',
      'Environment Targeting': 'Web; App;', 'Geography Targeting - Include': '20634; 20635;' },
      rawFieldOrder: ['Brand Safety Sensitivity Setting'],
      statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
      fields: { type: 'Video', subtype: '', status: 'Draft', startDate: '2026/6/29', endDate: '2026/7/28',
        languageTargeting: '1005;', deviceTargetingInclude: '30000; 30001;',
        environmentTargeting: 'Web; App;', geographyTargeting: '20634; 20635;',
        geographyTargetingInclude: '20634; 20635;',
        deviceTargetingExclude: '', geographyTargetingExclude: '', geographyExclude: '',
        pacing: 'Flight', pacingRate: 'Even', budgetType: 'Amount', budgetAmount: '100',
        bidStrategyType: 'Fixed', bidStrategyValue: '100' } };
    const it = api.compareLI(sLi, dLi).find(i => i.label === 'Brand Safety Sensitivity Setting');
    assert.ok(it, JSON.stringify(v) + ' should be shown');
    assert.equal(it.result, 'warning', JSON.stringify(v) + ' should be warning');
  }
});

test('デフォルト: YouTube/Display では OTT ルールを適用しない（共用ルール維持）', () => {
  api.setMediaType('youtube');
  // 共用ルール: Frequency Period=Days がデフォルト → Minutes は warning（非表示にならない）
  const yt = api.appendDownloadOnlyItems('LI', { rawFieldOrder: ['Frequency Period'], rawFields: { 'Frequency Period': 'Minutes' } }, [])
    .filter(i => i.isAutoAdded);
  assert.equal(yt.find(i => i.rawFieldName === 'Frequency Period').result, 'warning');
  // 共用ルールで Days はデフォルト → 非表示
  const ytDefault = api.appendDownloadOnlyItems('LI', { rawFieldOrder: ['Frequency Period'], rawFields: { 'Frequency Period': 'Days' } }, [])
    .filter(i => i.isAutoAdded);
  assert.equal(ytDefault.some(i => i.rawFieldName === 'Frequency Period'), false, 'Days hidden for YouTube');
  // Brand Safety は OTT 専用ルールなので YouTube では普通の download-only
  const bs = api.appendDownloadOnlyItems('LI', { rawFieldOrder: ['Brand Safety Sensitivity Setting'], rawFields: { 'Brand Safety Sensitivity Setting': 'Use custom' } }, [])
    .filter(i => i.isAutoAdded);
  const bsIt = bs.find(i => i.rawFieldName === 'Brand Safety Sensitivity Setting');
  assert.ok(bsIt);
  assert.equal(bsIt.result, 'download-only');
  assert.equal(bsIt.source, 'raw-sdf');
  api.setMediaType('ott');
});
