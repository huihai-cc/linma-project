// OTT LI 前端列契约 + 表示ルール 专项测试（2026-08-06）
// 六:
//  1-7: getCoreLevelColumns('LI') OTT 列定義（言語/デバイス/デバイス(除外)/環境/地域 含む、広告枠ソース/課金形態 含まない）
//  8:   compareLI_OTT_* が返す label が全て OTT 列定義に存在
//  9-18: 双方空 → 非表示 / 片側有値 → 表示
//  19-20: ダウンロードデフォルト値項目は引き続き表示・ok
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
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Base: typeof compareLI_OTT_Base === "function" ? compareLI_OTT_Base : undefined,\n' +
'  compareLI_OTT_Targeting: typeof compareLI_OTT_Targeting === "function" ? compareLI_OTT_Targeting : undefined,\n' +
'  compareLI_OTT_Geography: typeof compareLI_OTT_Geography === "function" ? compareLI_OTT_Geography : undefined,\n' +
'  compareLI_OTT_Deal: typeof compareLI_OTT_Deal === "function" ? compareLI_OTT_Deal : undefined,\n' +
'  compareLI_OTT_Demographic: typeof compareLI_OTT_Demographic === "function" ? compareLI_OTT_Demographic : undefined,\n' +
'  getCoreLevelColumns: typeof getCoreLevelColumns === "function" ? getCoreLevelColumns : undefined,\n' +
'  appendDynamicDownloadColumns: typeof appendDynamicDownloadColumns === "function" ? appendDynamicDownloadColumns : undefined,\n' +
'  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === "function" ? appendDownloadOnlyItems : undefined,\n' +
'  hasMeaningfulComparisonValue: typeof hasMeaningfulComparisonValue === "function" ? hasMeaningfulComparisonValue : undefined,\n' +
'  shouldShowOttComparisonItem: typeof shouldShowOttComparisonItem === "function" ? shouldShowOttComparisonItem : undefined,\n' +
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

// 全項目を網羅するモック LI（Deal詳細・フロア価格・除外デバイス・オーディエンス含む）
function fullMockLi() {
  const sLi = {
    name: 'S_FULL', fields: {
      liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
      budget100: '500000', budget98: '490000', budgetPace: '掲載期間', flightMode: '掲載期間',
      paceMode: '均等', bidStrategy: '固定入札', bidForm: '固定入札', bidTarget: '▼選択', bidPrice: '1700',
      environment: 'ウェブ＆アプリ', language: 'Japanese', daypart: '月曜日 00:00~23:59', geo: 'Japan',
      devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-',
      gender: 'Male', age: '18-24', parentalStatus: 'Parent', householdIncome: '上位10%',
      audienceFirstPartyPartner: 'ListA', audienceGoogle: '料理愛好家',
      audienceCustomList: 'CustomA', audienceCombined: 'CombinedA',
      dealId: 'DEAL-EXT-001',
      resolvedDealInfo: { source: 'direct', dealId: 'DEAL-EXT-001', dealName: 'Test Deal',
        exchange: 'Netflix', rateType: 'CPM (最低価格)', rate: '¥1,600', format: '動画',
        startDate: 'Monday, June 29, 2026', isTemplateDeal: false },
    },
  };
  const dLi = {
    name: 'D_FULL', id: 'li1',
    rawFields: {
      Status: 'Draft', 'Private Deal Group Targeting Include': '889900;',
      'Apply Floor Price For Deals': 'False',
      'Device Targeting - Exclude': '30001;',
      'Audience Targeting - Include': '12345;',
      'Affinity & In Market Targeting - Include': '4511689;',
      'Custom List Targeting': '67890;', 'Combined Audience Targeting': '24680;',
      'Device Targeting - Include': '30000; 30001; 30002; 30004;',
      'Environment Targeting': 'Web; App;', 'Language Targeting - Include': '1005;',
      'Geography Targeting - Include': '2392;', 'Daypart Targeting': '300096;',
      'Demographic Targeting Gender': 'Male;', 'Demographic Targeting Age': '18-24;',
      'Demographic Targeting Parental Status': 'Parent;',
      'Demographic Targeting Household Income': 'Top 10%;',
    },
    rawFieldOrder: [],
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: {
      type: 'Video', subtype: 'Simple', status: 'Draft',
      startDate: '2026/6/29', endDate: '2026/7/28',
      budgetType: 'Amount', budgetAmount: '490000', pacing: 'Flight', pacingRate: 'Even',
      bidStrategyType: 'Fixed', bidStrategyValue: '1700', bidStrategyUnit: '', bidStrategyDoNotExceed: '0',
      deviceTargetingInclude: '30000; 30001; 30002; 30004;', deviceTargetingExclude: '30001;',
      environmentTargeting: 'Web; App;', languageTargeting: '1005;',
      geographyTargeting: '2392;', geographyTargetingInclude: '2392;',
      geographyTargetingExclude: '', geographyExclude: '',
      daypartTargeting: '300096;', demographicGender: 'Male;', demographicAge: '18-24;',
      demographicIncome: 'Top 10%;', demographicParental: 'Parent;',
      inventorySource: '', partnerRevenueModel: '', partnerRevenueAmount: '',
    },
  };
  return { sLi, dLi };
}

function ottCoreColumnKeys() {
  return api.getCoreLevelColumns('LI', false).map(c => c.key);
}

// ═══════════════════════════════════════════
// 一. 列定義コントラクト（六-1〜7）
// ═══════════════════════════════════════════
test('列定義: OTT LI に 言語 が含まれる', () => {
  api.setMediaType('ott');
  assert.ok(ottCoreColumnKeys().includes('言語'));
});

test('列定義: OTT LI に デバイス が含まれる', () => {
  api.setMediaType('ott');
  assert.ok(ottCoreColumnKeys().includes('デバイス'));
});

test('列定義: OTT LI に デバイス(除外) が含まれない（Include/Exclude統合）', () => {
  api.setMediaType('ott');
  assert.ok(!ottCoreColumnKeys().includes('デバイス(除外)'));
});

test('列定義: OTT LI に 環境 が含まれる', () => {
  api.setMediaType('ott');
  assert.ok(ottCoreColumnKeys().includes('環境'));
});

test('列定義: OTT LI に 地域 / Geography Targeting が含まれる', () => {
  api.setMediaType('ott');
  assert.ok(ottCoreColumnKeys().includes('地域 / Geography Targeting'));
});

test('列定義: OTT LI に 広告枠ソース が含まれない', () => {
  api.setMediaType('ott');
  assert.ok(!ottCoreColumnKeys().includes('広告枠ソース'));
});

test('列定義: OTT LI に 課金形態 が含まれない', () => {
  api.setMediaType('ott');
  assert.ok(!ottCoreColumnKeys().includes('課金形態'));
});

test('列定義: compareLI_OTT_* が返す全 label が OTT LI 列定義に存在する', () => {
  api.setMediaType('ott');
  api.setSelectedDv360CaseType('initial');
  const { sLi, dLi } = fullMockLi();
  const items = api.compareLI(sLi, dLi);
  // レンダラーは (item.key || item.label) と列 key を照合する
  const labels = [...new Set(items.map(i => i.key || i.label))];
  const keys = new Set(ottCoreColumnKeys());
  const missing = labels.filter(l => !keys.has(l));
  assert.equal(missing.length, 0, '列定義に無い label: ' + missing.join(', '));
  // 列定義側の各キーは compareLI で生成される（モックで全項目網羅）
  const expected = ['ステータス','raw_sdf__status','動画タイプ','Subtype','開始日','終了日','予算期間',
    '配信ペース','予算','入札形式','目標単価の有無','入札単価','収益モデル','言語','デバイス',
    '環境','曜日と時間','地域 / Geography Targeting','Deal ID',
    'Brand Safety Sensitivity Setting','Inventory Source Targeting - Authorized Seller Options',
    'Inventory Source Targeting - Exclude',
    '性別','年齢','子供の有無','世帯年収',
    'オーディエンス｜自社と第三者','オーディエンス｜アフィニティカテゴリー',
    'オーディエンス｜カスタムリスト','オーディエンス｜統合'];
  const missingExpected = expected.filter(l => !labels.includes(l));
  assert.equal(missingExpected.length, 0, 'モックで生成されない項目: ' + missingExpected.join(', '));
});

// ═══════════════════════════════════════════
// 二. 表示ルール（六-9〜18）
// ═══════════════════════════════════════════
test('表示: 言語 双方空 → 非表示', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  sLi.fields.language = '';
  dLi.fields.languageTargeting = '';
  dLi.rawFields['Language Targeting - Include'] = '';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  assert.equal(findItem(items, '言語'), undefined);
});

test('表示: 言語 片側有値 → 表示', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  sLi.fields.language = '';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const it = findItem(items, '言語');
  assert.ok(it, '言語 shown when download has value');
  assert.equal(it.result, 'warning');
});

test('表示: デバイス 双方空 → 非表示（Include/Exclude とも空）', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  for (const k of ['devicePC','deviceSP','deviceTablet','deviceCTV','deviceCD']) sLi.fields[k] = '';
  dLi.rawFields['Device Targeting - Include'] = '';
  dLi.fields.deviceTargetingInclude = '';
  dLi.rawFields['Device Targeting - Exclude'] = '';
  dLi.fields.deviceTargetingExclude = '';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  assert.equal(findItem(items, 'デバイス'), undefined);
  assert.equal(findItem(items, 'デバイス(除外)'), undefined);
});

test('表示: 002 四デバイス → デバイス1項目で生成かつ ok、dValはID＋名称', async () => {
  api.setMediaType('ott');
  const dir = path.join(ottRoot, '002');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setSelectedDv360CaseType('initial');
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  const sLi = setting.liList[0];
  const dLi = download.liList.find(d => norm(d.name) === norm(sLi.name));
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const dev = findItem(items, 'デバイス');
  assert.ok(dev, 'device item exists');
  assert.equal(dev.result, 'ok');
  assert.equal(dev.sVal, 'PC / Smartphone / Tablet / Connected TV');
  assert.ok(dev.dVal.includes('30000（PC）'), 'dVal: ' + dev.dVal);
  assert.ok(dev.dVal.includes('30001（Smartphone）'), 'dVal: ' + dev.dVal);
  assert.ok(dev.dVal.includes('30002（Tablet）'), 'dVal: ' + dev.dVal);
  assert.ok(dev.dVal.includes('30004（Connected TV）'), 'dVal: ' + dev.dVal);
  assert.equal(findItem(items, 'デバイス(除外)'), undefined, 'no separate exclude item');
});

test('表示: Exclude で除外 → 最終集合で比較（mismatch と除外明示）', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  // Include=4, Exclude=30001 → 最終3 ≠ 設定4
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const dev = findItem(items, 'デバイス');
  assert.ok(dev, 'device item exists');
  assert.equal(dev.result, 'mismatch');
  assert.ok(dev.dVal.includes('除外: 30001（Smartphone）'), 'dVal shows exclusion: ' + dev.dVal);
  assert.ok(dev.mpDetail.includes('除外'), 'detail mentions exclusion: ' + dev.mpDetail);
});

test('表示: Exclude で除外しても最終集合一致なら ok', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  // 設定=PC/SP/Tablet（CTVなし）, Include=4デバイス, Exclude=30004 → 最終3 = 設定3 → ok
  sLi.fields.deviceCTV = '-';
  dLi.rawFields['Device Targeting - Exclude'] = '30004;';
  dLi.fields.deviceTargetingExclude = '30004;';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const dev = findItem(items, 'デバイス');
  assert.ok(dev);
  assert.equal(dev.result, 'ok', 'final set matches: ' + dev.result);
});

test('表示: 環境 双方空 → 非表示', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  sLi.fields.environment = '';
  dLi.rawFields['Environment Targeting'] = '';
  dLi.fields.environmentTargeting = '';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  assert.equal(findItem(items, '環境'), undefined);
});

test('表示: 地域 三方空 → 非表示', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  sLi.fields.geo = '';
  dLi.rawFields['Geography Targeting - Include'] = '';
  dLi.fields.geographyTargeting = '';
  dLi.fields.geographyTargetingInclude = '';
  dLi.rawFields['Geography Targeting - Exclude'] = '';
  dLi.fields.geographyTargetingExclude = '';
  dLi.fields.geographyExclude = '';
  const items = api.compareLI_OTT_Geography(sLi, dLi);
  assert.equal(findItem(items, '地域 / Geography Targeting'), undefined);
});

test('表示: 002 地域 → 生成かつ ok（GeoMaster利用）', async () => {
  api.setMediaType('ott');
  if (api.ensureGeoMasterLoaded) await api.ensureGeoMasterLoaded();
  const dir = path.join(ottRoot, '002');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setSelectedDv360CaseType('initial');
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  for (const sLi of setting.liList) {
    const dLi = download.liList.find(d => norm(d.name) === norm(sLi.name));
    const items = api.compareLI_OTT_Geography(sLi, dLi);
    const geo = findItem(items, '地域 / Geography Targeting');
    assert.ok(geo, 'geo item exists');
    assert.equal(geo.result, 'ok', sLi.name + ' geo ok, got ' + geo.result);
  }
});

test('表示: Daypart 双方空 → 非表示', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = fullMockLi();
  sLi.fields.daypart = '';
  dLi.rawFields['Daypart Targeting'] = '';
  dLi.fields.daypartTargeting = '';
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  assert.equal(findItem(items, '曜日と時間'), undefined);
});

// ═══════════════════════════════════════════
// 三. ダウンロードデフォルト値（六-19〜20）
// ═══════════════════════════════════════════
test('デフォルト: Frequency Amount=0 → 非表示（動的列にも出ない）', () => {
  api.setMediaType('ott');
  const items = api.appendDownloadOnlyItems('LI',
    { rawFieldOrder: ['Frequency Amount'], rawFields: { 'Frequency Amount': '0' } }, []);
  assert.equal(items.some(i => i.isAutoAdded && i.rawFieldName === 'Frequency Amount'), false, 'should be hidden');
  // 動的列にも追加されない
  const cols = api.appendDynamicDownloadColumns('LI', [], [{ compItems: items }]);
  assert.ok(!cols.some(c => c.label.includes('Frequency Amount')), 'no dynamic column');
});

test('デフォルト: Algorithm Id=0 → 非表示（動的列にも出ない）', () => {
  api.setMediaType('ott');
  const items = api.appendDownloadOnlyItems('LI',
    { rawFieldOrder: ['Algorithm Id'], rawFields: { 'Algorithm Id': '0' } }, []);
  assert.equal(items.some(i => i.isAutoAdded && i.rawFieldName === 'Algorithm Id'), false, 'should be hidden');
  const cols = api.appendDynamicDownloadColumns('LI', [], [{ compItems: items }]);
  assert.ok(!cols.some(c => c.label.includes('Algorithm Id')), 'no dynamic column');
});

// ── helper 単体 ──
test('helper: hasMeaningfulComparisonValue の空値判定', () => {
  assert.equal(api.hasMeaningfulComparisonValue(''), false);
  assert.equal(api.hasMeaningfulComparisonValue(null), false);
  assert.equal(api.hasMeaningfulComparisonValue(undefined), false);
  assert.equal(api.hasMeaningfulComparisonValue('   '), false);
  assert.equal(api.hasMeaningfulComparisonValue('(空欄)'), false);
  assert.equal(api.hasMeaningfulComparisonValue('(設定なし)'), false);
  assert.equal(api.hasMeaningfulComparisonValue('—'), false);
  assert.equal(api.hasMeaningfulComparisonValue('-'), false);
  assert.equal(api.hasMeaningfulComparisonValue('▼選択'), false);
  assert.equal(api.hasMeaningfulComparisonValue('0'), true, '0 は原則有値');
  assert.equal(api.hasMeaningfulComparisonValue('0.0'), true, '0.0 は原則有値');
  assert.equal(api.hasMeaningfulComparisonValue('0', { zeroIsValue: false }), false);
  assert.equal(api.hasMeaningfulComparisonValue('Japanese'), true);
});
