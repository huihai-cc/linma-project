const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const case007Root = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube\\007';
const youtubeCasesRoot = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube';
const case006Root = path.join(youtubeCasesRoot, '006');
const case008Root = path.join(youtubeCasesRoot, '008');

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
  const exportBlock = `
window.__dv360TargetingApi = {
  parseYoutubeSetting: typeof parseYoutubeSetting === 'function' ? parseYoutubeSetting : undefined,
  compareLanguage: typeof compareLanguage === 'function' ? compareLanguage : undefined,
  parseSettingGeography: typeof parseSettingGeography === 'function' ? parseSettingGeography : undefined,
  compareGeography: typeof compareGeography === 'function' ? compareGeography : undefined,
  normalizeParentalSettingValue: typeof normalizeParentalSettingValue === 'function' ? normalizeParentalSettingValue : undefined,
  normalizeGeographySheetName: typeof normalizeGeographySheetName === 'function' ? normalizeGeographySheetName : undefined,
  findGeographyReferenceSheetCandidates: typeof findGeographyReferenceSheetCandidates === 'function' ? findGeographyReferenceSheetCandidates : undefined,
  parseGeographyReferenceSheet: typeof parseGeographyReferenceSheet === 'function' ? parseGeographyReferenceSheet : undefined,
  resolveGeographyReference: typeof resolveGeographyReference === 'function' ? resolveGeographyReference : undefined,
  ensureGeoMasterLoaded: typeof ensureGeoMasterLoaded === 'function' ? ensureGeoMasterLoaded : undefined,
  resolveUnknownRequirement: typeof resolveUnknownRequirement === 'function' ? resolveUnknownRequirement : undefined,
  parseUnknownTokens: typeof parseUnknownTokens === 'function' ? parseUnknownTokens : undefined,
  compareAgeDemographicTargeting: typeof compareAgeDemographicTargeting === 'function' ? compareAgeDemographicTargeting : undefined,
  compareDemographicTargeting: typeof compareDemographicTargeting === 'function' ? compareDemographicTargeting : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  filterVisibleComparisonItems: typeof filterVisibleComparisonItems === 'function' ? filterVisibleComparisonItems : undefined,
  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === 'function' ? appendDownloadOnlyItems : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  setMediaType(value) { mediaType = value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
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
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__dv360TargetingApi;
}

function parseSettingWorkbook(filePath, api) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, defval: '', raw: true,
    });
  }
  return api.parseYoutubeSetting(sheets, workbook.SheetNames, path.basename(filePath));
}

function readSettingWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, defval: '', raw: true,
    });
  }
  return { sheets, sheetNames: workbook.SheetNames, fileName: path.basename(filePath) };
}

function findSettingPath(caseRoot) {
  return fs.readdirSync(caseRoot)
    .map(name => path.join(caseRoot, name))
    .find(name => /\.xlsx$/i.test(name) && !path.basename(name).startsWith('~$'));
}

function makeGpDownload(overrides = {}) {
  const rawFields = {
    'Demographic Targeting Gender': 'Male;',
    'Demographic Targeting Age': '25-34; 35-44; 45-54; 55-64;',
    'Demographic Targeting Household Income': 'Top 10%; 11-20%;',
    'Demographic Targeting Parental Status': 'Not a parent; Parent; Unknown;',
    ...overrides,
  };
  return {
    rawFields,
    fields: {
      demographicGender: rawFields['Demographic Targeting Gender'],
      demographicAge: rawFields['Demographic Targeting Age'],
      demographicIncome: rawFields['Demographic Targeting Household Income'],
      demographicParental: rawFields['Demographic Targeting Parental Status'],
      geographyInclude: '', geographyExclude: '',
    },
  };
}

function makeLiDownload(rawOverrides = {}, fieldOverrides = {}) {
  const rawFields = {
    Status: 'Active',
    'Language Targeting - Include': '1005;',
    'Geography Targeting - Include': '20663;',
    'Geography Targeting - Exclude': '',
    ...rawOverrides,
  };
  return {
    statusInfo: { found: true, rawValue: 'Active', normalizedValue: 'Active' },
    rawFields,
    rawFieldOrder: Object.keys(rawFields),
    fields: {
      type: 'TrueView', subtype: 'Reach', status: 'Active',
      startDate: '', endDate: '', pacing: '', pacingRate: '', pacingAmount: '',
      bidStrategyType: '', bidStrategyValue: '', inventorySource: '',
      geographyTargeting: rawFields['Geography Targeting - Include'],
      geographyExclude: rawFields['Geography Targeting - Exclude'],
      languageTargeting: rawFields['Language Targeting - Include'],
      ...fieldOverrides,
    },
  };
}

function makeSettingFields(overrides = {}) {
  return {
    videoType: '', startDate: '', endDate: '', daypart: '', budgetNet: '', budgetGross: '',
    dailyBudget: '', pacing: '', billing: '', inventory: '', revenueModel: '',
    language: 'Japanese', region: '福岡県', gender: 'すべて / 不明あり',
    age: '全年齢', ageUnknown: '不明なし', parentalStatus: 'ALL', householdIncome: 'ALL(不明有)',
    ...overrides,
  };
}

function compareYoutubeGpVideoFormat(downloadValue, settingValue = 'VID_15s-横-MF25-64歳×BP×エリア') {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const setting = { fields: { ...makeSettingFields(), videoAdFormat: settingValue } };
  const download = makeGpDownload({ 'Video Ad Format': downloadValue });
  download.fields.videoAdFormat = downloadValue;
  const items = api.compareGP(setting, download);
  return { api, item: items.find(entry => entry.label === '動画フォーマット'), items };
}

test('YouTube GP Video Ad Format: Responsive は ok だが通常表示から隠す', () => {
  const { api, item, items } = compareYoutubeGpVideoFormat('Responsive');
  assert.equal(item.result, 'ok');
  assert.equal(api.filterVisibleComparisonItems(items).some(entry => entry.label === '動画フォーマット'), false);
});

test('YouTube GP Video Ad Format: responsive は大小文字を無視して ok + hidden', () => {
  const { api, item, items } = compareYoutubeGpVideoFormat('rEsPoNsIvE');
  assert.equal(item.result, 'ok');
  assert.equal(api.filterVisibleComparisonItems(items).some(entry => entry.label === '動画フォーマット'), false);
});

test('YouTube GP Video Ad Format: 非 Responsive は warning で実値と説明を表示', () => {
  const { api, item, items } = compareYoutubeGpVideoFormat('In-stream');
  assert.equal(item.result, 'warning');
  assert.equal(item.sVal, '想定: Responsive');
  assert.equal(item.dVal, 'In-stream');
  assert.equal(item.mpDetail, 'YouTube GP の Video Ad Format は Responsive を想定しています。');
  assert.equal(api.filterVisibleComparisonItems(items).some(entry => entry.label === '動画フォーマット'), true);
});

test('YouTube GP Video Ad Format: 空欄は warning で (空欄) を表示', () => {
  const { api, item, items } = compareYoutubeGpVideoFormat('');
  assert.equal(item.result, 'warning');
  assert.equal(item.sVal, '想定: Responsive');
  assert.equal(item.dVal, '(空欄)');
  assert.equal(api.filterVisibleComparisonItems(items).some(entry => entry.label === '動画フォーマット'), true);
});

test('YouTube GP Video Ad Format: Setting の GP 名を sVal に使わない', () => {
  const gpName = 'VID_15s-横-MF25-64歳×BP×エリア';
  const { item } = compareYoutubeGpVideoFormat('In-stream', gpName);
  assert.equal(item.sVal, '想定: Responsive');
  assert.doesNotMatch(item.sVal, /VID_15s/);
});

test('Language: Japanese / 日本語 / 1005 は同一、English は mismatch', () => {
  const api = loadDv360Api();
  assert.equal(api.compareLanguage('Japanese', '1005;').result, 'ok');
  assert.equal(api.compareLanguage('日本語', '日本語（1005）').result, 'ok');
  assert.equal(api.compareLanguage('Japanese', 'English').result, 'mismatch');
  const compared = api.compareLanguage('Japanese', '1005;');
  assert.equal(compared.rawSetting, 'Japanese');
  assert.equal(compared.rawDownload, '1005;');
  assert.deepEqual(Array.from(compared.normalizedSetting), ['Japanese']);
  assert.deepEqual(Array.from(compared.normalizedDownload), ['Japanese']);
});

test('007: LI language setting is non-empty and compares through the core Language item', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const settingPath = fs.readdirSync(case007Root)
    .map(name => path.join(case007Root, name)).find(name => /\.xlsx$/i.test(name) && !path.basename(name).startsWith('~$'));
  assert.ok(settingPath, '007 setting workbook should exist');
  const parsed = parseSettingWorkbook(settingPath, api);
  assert.equal(parsed.liList.length, 4);
  for (const li of parsed.liList) {
    assert.equal(li.fields.language, 'Japanese');
    const item = api.compareLI(li, makeLiDownload()).find(entry => entry.label === '言語');
    assert.equal(item.result, 'ok');
    assert.equal(item.rawSetting, 'Japanese');
    assert.equal(item.rawDownload, '1005;');
  }
});

test('Geography: no exclusion marker means include, while exclusion is kept separate', () => {
  const api = loadDv360Api();
  assert.deepEqual(Array.from(api.parseSettingGeography('福岡県').include), ['福岡県']);
  assert.deepEqual(Array.from(api.parseSettingGeography('福岡県').exclude), []);
  assert.deepEqual(Array.from(api.parseSettingGeography('配信：Japan / 除外：福岡県').include), ['Japan']);
  assert.deepEqual(Array.from(api.parseSettingGeography('配信：Japan / 除外：福岡県').exclude), ['福岡県']);
});

test('Geography: name is primary, code is auxiliary, and include/exclude differences are explicit', async () => {
  const api = loadDv360Api();
  assert.equal(await api.ensureGeoMasterLoaded(), true);
  const same = api.compareGeography('福岡県', '20663;', '');
  assert.equal(same.result, 'ok');
  assert.match(same.dVal, /福岡県|Fukuoka/);
  assert.match(same.dVal, /20663/);
  assert.equal(same.rawSetting, '福岡県');
  assert.equal(same.rawInclude, '20663;');
  assert.deepEqual(Array.from(same.includeMissing), []);
  assert.deepEqual(Array.from(same.includeExtra), []);

  const includeDiff = api.compareGeography('福岡県', '2392;', '');
  assert.equal(includeDiff.result, 'mismatch');
  assert.match(includeDiff.detail, /配信不足/);
  assert.match(includeDiff.detail, /配信追加/);

  const excludeDiff = api.compareGeography('配信：Japan / 除外：福岡県', '2392;', '');
  assert.equal(excludeDiff.result, 'mismatch');
  assert.match(excludeDiff.detail, /除外不足/);
});

test('LI Geography is a fixed core item and download-only does not append or override it', async () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const setting = { fields: makeSettingFields() };
  const download = makeLiDownload();
  const core = api.compareLI(setting, download);
  const geography = core.filter(item => item.label === '地域 / Geography Targeting');
  assert.equal(geography.length, 1);
  assert.equal(geography[0].result, 'ok');
  const all = api.appendDownloadOnlyItems('LI', download, core);
  assert.equal(all.filter(item => /Geography Targeting/.test(item.label)).length, 1);
  const columnKeys = Array.from(api.getCoreLevelColumns('LI', true), column => column.key);
  assert.ok(columnKeys.includes('地域 / Geography Targeting'));
});

test('Unknown requirement resolves negative before positive and preserves field-specific ALL semantics', () => {
  const api = loadDv360Api();
  assert.equal(typeof api.resolveUnknownRequirement, 'function');
  assert.equal(api.resolveUnknownRequirement('全年齢 / 不明なし', 'age'), 'exclude');
  assert.equal(api.resolveUnknownRequirement('すべて / 不明あり', 'gender'), 'include');
  assert.equal(api.resolveUnknownRequirement('不明無', 'gender'), 'exclude');
  assert.equal(api.resolveUnknownRequirement('Unknown除外', 'age'), 'exclude');
  assert.equal(api.resolveUnknownRequirement('ALL', 'parentalStatus'), 'include');
  assert.equal(api.resolveUnknownRequirement('ALL(不明有)', 'householdIncome'), 'include');
  assert.equal(api.resolveUnknownRequirement('ALL', 'age'), 'fieldDefault');
  assert.equal(api.resolveUnknownRequirement('指定値', 'age'), 'unknown');
});

test('Unknown tokens ignore case, trailing semicolons, spaces, and duplicates', () => {
  const api = loadDv360Api();
  assert.equal(typeof api.parseUnknownTokens, 'function');
  assert.deepEqual(Array.from(api.parseUnknownTokens(' Male ; UNKNOWN; unknown ; Female; ')), ['male', 'unknown', 'female']);
});

test('Age rejects download-side Unknown when 年齢 不明 is 不明なし', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const ageDownload = '18-24; 25-34; 35-44; 45-54; 55-64; 65+; Unknown;';
  const setting = { fields: makeSettingFields({ age: '全年齢', ageUnknown: '不明なし' }) };
  const item = api.compareLI(
    setting,
    makeLiDownload({ 'Demographic Targeting Age': ageDownload }),
  ).find(entry => entry.label === '年齢');
  assert.equal(item.result, 'mismatch');
  assert.deepEqual(Array.from(item.extra), ['unknown']);
  assert.match(item.detail, /追加：Unknown/);
});

test('Age accepts download-side Unknown when 年齢 不明 is 不明あり', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const ageDownload = '18-24; 25-34; 35-44; 45-54; 55-64; 65+; Unknown;';
  const setting = { fields: makeSettingFields({ age: '全年齢', ageUnknown: '不明あり' }) };
  const item = api.compareLI(
    setting,
    makeLiDownload({ 'Demographic Targeting Age': ageDownload }),
  ).find(entry => entry.label === '年齢');
  assert.equal(item.result, 'ok');
  assert.ok(item.normalizedSetting.includes('unknown'));
  assert.deepEqual(Array.from(item.extra), []);
});

test('Age keeps ▼選択 as an unspecified Unknown rule', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const ageDownload = '18-24; 25-34; 35-44; 45-54; 55-64; 65+; Unknown;';
  const setting = { fields: makeSettingFields({ age: '全年齢', ageUnknown: '▼選択' }) };
  const item = api.compareLI(
    setting,
    makeLiDownload({ 'Demographic Targeting Age': ageDownload }),
  ).find(entry => entry.label === '年齢');
  assert.equal(item.result, 'ok');
  assert.equal(item.unknownRequirement, 'unspecified');
  assert.deepEqual(Array.from(item.extra), []);
  assert.match(item.sVal, /▼選択/);
});

test('Parental ALL and Household ALL(不明有) include Unknown with full field-specific sets', () => {
  const api = loadDv360Api();
  // 2026-08-18: parentalStatus の ALL は Unknown を必須にしない（核心集合は Not a parent + Parent）。
  // SDF に Unknown が残っていても ok。ダウンロード側の余計 Unknown は不一致にしない。
  const parental = api.compareDemographicTargeting('ALL', 'Not a parent; Parent; Unknown;', 'parentalStatus', 'warning');
  assert.equal(parental.result, 'ok');
  assert.deepEqual(Array.from(parental.normalizedSetting), ['not a parent', 'parent']);
  const income = api.compareDemographicTargeting(
    'ALL(不明有)',
    'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;',
    'householdIncome',
    'warning',
  );
  assert.equal(income.result, 'ok');
  assert.deepEqual(Array.from(income.normalizedSetting), [
    'top 10%', '11-20%', '21-30%', '31-40%', '41-50%', 'lower 50%', 'unknown',
  ]);
  assert.deepEqual(Array.from(income.missing), []);
  assert.deepEqual(Array.from(income.extra), []);
});

test('Household income Japanese top ranges normalize to the equivalent SDF buckets', () => {
  const api = loadDv360Api();
  const cases = [
    ['上位10%~ / ~20%', 'Top 10%; 11-20%;', ['top 10%', '11-20%']],
    ['上位10%〜〜/〜20%', 'Top 10%; 11-20%;', ['top 10%', '11-20%']],
    ['上位10%～ / ～30%', 'Top 10%; 11-20%; 21-30%;', ['top 10%', '11-20%', '21-30%']],
  ];
  for (const [settingValue, downloadValue, expectedTokens] of cases) {
    const compared = api.compareDemographicTargeting(
      settingValue,
      downloadValue,
      'householdIncome',
      'warning',
    );
    assert.equal(compared.result, 'ok', settingValue);
    assert.deepEqual(Array.from(compared.normalizedSetting), expectedTokens, settingValue);
    assert.deepEqual(Array.from(compared.missing), [], settingValue);
    assert.deepEqual(Array.from(compared.extra), [], settingValue);
  }
});

test('Household income 上位10%〜40% reports only download-side extra buckets', () => {
  const api = loadDv360Api();
  const downloadValue = 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;';
  for (const settingValue of ['上位10%〜40%', '上位10%~ / ~40%']) {
    const compared = api.compareDemographicTargeting(
      settingValue,
      downloadValue,
      'householdIncome',
      'warning',
    );
    assert.equal(compared.result, 'warning', settingValue);
    assert.deepEqual(Array.from(compared.normalizedSetting), [
      'top 10%', '11-20%', '21-30%', '31-40%',
    ], settingValue);
    assert.deepEqual(Array.from(compared.missing), [], settingValue);
    assert.deepEqual(Array.from(compared.extra), ['41-50%', 'lower 50%', 'unknown'], settingValue);
    assert.doesNotMatch(compared.detail, /不足：/, settingValue);
    assert.match(compared.detail, /追加：41-50%; Lower 50%; Unknown/, settingValue);
  }
});

test('Household income range normalization does not apply to other Demographic fields', () => {
  const api = loadDv360Api();
  const compared = api.compareDemographicTargeting(
    '上位10%~ / ~20%',
    'Top 10%; 11-20%;',
    'parentalStatus',
    'warning',
  );
  assert.equal(compared.result, 'warning');
  assert.deepEqual(Array.from(compared.normalizedSetting), ['上位10%~ / ~20%']);
  assert.notDeepEqual(Array.from(compared.normalizedSetting), ['top 10%', '11-20%']);
});

test('LI and GP both reject Age Unknown when 年齢 不明 is 不明なし', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const setting = { fields: makeSettingFields({ age: '全年齢', ageUnknown: '不明なし' }) };
  const ageDownload = '18-24; 25-34; 35-44; 45-54; 55-64; 65+; Unknown;';
  const liDownload = makeLiDownload({ 'Demographic Targeting Age': ageDownload });
  const liCore = api.compareLI(setting, liDownload);
  const liAge = liCore.find(item => item.label === '年齢');
  assert.equal(liAge.result, 'mismatch');
  assert.match(liAge.detail, /追加：Unknown/);
  const liAll = api.appendDownloadOnlyItems('LI', liDownload, liCore);
  assert.equal(liAll.filter(item => item.rawFieldName === 'Demographic Targeting Age').length, 0);

  const gpDownload = {
    rawFields: {
      'Demographic Targeting Gender': 'Male; Female; Unknown;',
      'Demographic Targeting Age': ageDownload,
      'Demographic Targeting Household Income': 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;',
      'Demographic Targeting Parental Status': 'Not a parent; Parent; Unknown;',
    },
    fields: {
      demographicGender: 'Male; Female; Unknown;', demographicAge: ageDownload,
      demographicIncome: 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;',
      demographicParental: 'Not a parent; Parent; Unknown;', geographyInclude: '', geographyExclude: '',
    },
  };
  const gpAge = api.compareGP(setting, gpDownload).find(item => item.label === '年齢');
  assert.equal(gpAge.result, 'mismatch');
  assert.match(gpAge.detail, /追加：Unknown/);
  assert.equal(gpAge.unknownRuleSource, liAge.unknownRuleSource);
});

test('007 parser keeps 年齢 and 年齢 不明 independent', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const settingPath = fs.readdirSync(case007Root)
    .map(name => path.join(case007Root, name)).find(name => /\.xlsx$/i.test(name) && !path.basename(name).startsWith('~$'));
  const parsed = parseSettingWorkbook(settingPath, api);
  const withoutUnknown = parsed.gpList.find(item => item.fields.ageUnknown === '不明なし');
  assert.ok(withoutUnknown, '007 should contain a GP that explicitly excludes Unknown age');
  assert.equal(withoutUnknown.fields.age, '18歳～ / 24歳');
  assert.equal(withoutUnknown.fields.ageUnknown, '不明なし');
  assert.doesNotMatch(withoutUnknown.fields.age, /不明なし/);
  const compared = api.compareAgeDemographicTargeting(
    withoutUnknown.fields.age,
    withoutUnknown.fields.ageUnknown,
    '18-24; 25-34; 35-44; 45-54; 55-64; 65+; Unknown;',
  );
  assert.equal(compared.result, 'mismatch');
  assert.ok(Array.from(compared.extra).includes('unknown'));
  assert.match(compared.detail, /追加：.*Unknown/);
});

test('GP keeps Geography Targeting as traceable download-only data while LI owns the sole core comparison', async () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  assert.equal(await api.ensureGeoMasterLoaded(), true);
  const setting = { fields: makeSettingFields({ region: '福岡県' }) };
  const gpDownload = {
    rawFieldOrder: ['Geography Targeting - Include', 'Geography Targeting - Exclude'],
    rawFields: {
      'Geography Targeting - Include': '20663;',
      'Geography Targeting - Exclude': '',
    },
    fields: {
      status: 'Active', geographyInclude: '20663;', geographyExclude: '',
      demographicGender: '', demographicAge: '',
    },
  };
  const gpCore = api.compareGP(setting, gpDownload);
  assert.equal(gpCore.some(item => item.label === '地域' || /Geography Targeting/.test(item.label)), false);
  assert.equal(api.getCoreLevelColumns('GP').some(column => column.key === '地域'), false);
  const gpAll = api.appendDownloadOnlyItems('GP', gpDownload, gpCore);
  const gpGeography = gpAll.filter(item => /Geography Targeting/.test(item.rawFieldName || item.label));
  assert.equal(gpGeography.length, 1);
  assert.equal(gpGeography[0].result, 'download-only');
  assert.equal(gpGeography[0].rawFieldName, 'Geography Targeting - Include');

  const liCore = api.compareLI(setting, makeLiDownload({ 'Geography Targeting - Include': '20663;' }));
  const liGeography = liCore.filter(item => item.label === '地域 / Geography Targeting');
  assert.equal(liGeography.length, 1);
  assert.equal(liGeography[0].result, 'ok');
});

test('Parental default: ▼選択 is interpreted as ALL while preserving the raw value', () => {
  const api = loadDv360Api();
  const normalized = api.normalizeParentalSettingValue('▼選択');
  assert.deepEqual({ ...normalized }, { raw: '▼選択', effective: 'ALL', defaulted: true });
});

test('Parental default: blank is interpreted as ALL', () => {
  const api = loadDv360Api();
  assert.deepEqual({ ...api.normalizeParentalSettingValue('') }, { raw: '', effective: 'ALL', defaulted: true });
});

test('Parental default: 選択 and 未選択 are interpreted as ALL', () => {
  const api = loadDv360Api();
  assert.equal(api.normalizeParentalSettingValue('選択').effective, 'ALL');
  assert.equal(api.normalizeParentalSettingValue('未選択').effective, 'ALL');
});

test('Parental default ALL matches Not a parent, Parent, and Unknown', () => {
  const api = loadDv360Api();
  // 2026-08-18: ▼選択（ALL）では Unknown は必須でなく、ダウンロード側に残っていても ok。
  const compared = api.compareDemographicTargeting('▼選択', 'Not a parent; Parent; Unknown;', 'parentalStatus', 'warning');
  assert.equal(compared.result, 'ok');
  assert.deepEqual(Array.from(compared.normalizedSetting), ['not a parent', 'parent']);
  assert.match(compared.sVal, /▼選択/);
  assert.match(compared.sVal, /ALL/);
});

test('Parental default ALL does not require Unknown (2026-08-18 新ルール)', () => {
  const api = loadDv360Api();
  // 旧ルールでは Unknown 不足 → warning だったが、新ルールでは ok になる。
  const compared = api.compareDemographicTargeting('▼選択', 'Not a parent; Parent;', 'parentalStatus', 'warning');
  assert.equal(compared.result, 'ok');
  assert.equal(compared.detail, '');
});

test('Parental default ALL reports a missing Parent', () => {
  const api = loadDv360Api();
  const compared = api.compareDemographicTargeting('▼選択', 'Not a parent; Unknown;', 'parentalStatus', 'warning');
  assert.equal(compared.result, 'warning');
  assert.match(compared.detail, /不足：Parent/);
});

test('Parental default does not turn ▼選択 in age into ALL', () => {
  const api = loadDv360Api();
  const compared = api.compareDemographicTargeting('▼選択', '18-24; 25-34; 35-44; 45-54; 55-64; 65+;', 'age');
  assert.notDeepEqual(Array.from(compared.normalizedSetting), ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']);
});

test('006 no longer produces a parental warning for the complete default ALL download set', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const parsed = parseSettingWorkbook(findSettingPath(case006Root), api);
  const gpUsages = parsed.gpList.flatMap(gp => (gp.references || []).length
    ? Array.from(gp.references, ref => ({...gp, fields:{...(gp.fields || {}), ...(ref.fields || {})}}))
    : [gp]);
  assert.equal(gpUsages.length, 5, '2 definitions are referenced by 5 LI rows');
  for (const gp of gpUsages) {
    assert.equal(gp.fields.parentalStatus, '▼選択');
    const item = api.compareGP(gp, makeGpDownload()).find(entry => entry.label.includes('子供'));
    assert.equal(item.result, 'ok');
    assert.match(item.sVal, /ALL/);
  }
});

test('006 household income ranges compare as the equivalent SDF bucket sets', () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  const parsed = parseSettingWorkbook(findSettingPath(case006Root), api);
  const gpUsages = parsed.gpList.flatMap(gp => (gp.references || []).length
    ? Array.from(gp.references, ref => ({...gp, fields:{...(gp.fields || {}), ...(ref.fields || {})}}))
    : [gp]);
  assert.equal(gpUsages.length, 5, '2 definitions are referenced by 5 LI rows');
  for (const gp of gpUsages) {
    const downloadValue = gp.fields.householdIncome.includes('30%')
      ? 'Top 10%; 11-20%; 21-30%;'
      : 'Top 10%; 11-20%;';
    const item = api.compareGP(
      gp,
      makeGpDownload({ 'Demographic Targeting Household Income': downloadValue }),
    ).find(entry => entry.label.includes('世帯年収'));
    assert.equal(item.result, 'ok', gp.fields.householdIncome);
    assert.deepEqual(Array.from(item.missing), [], gp.fields.householdIncome);
    assert.deepEqual(Array.from(item.extra), [], gp.fields.householdIncome);
  }
});

test('Area reference: explicit 「エリア」シート参照 finds the actual エリア sheet', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const workbook = readSettingWorkbook(findSettingPath(case008Root));
  const resolved = api.resolveGeographyReference('「エリア」シート参照', workbook.sheets, workbook.sheetNames);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.sheetName, 'エリア');
  assert.equal(resolved.include.length, 24);
  assert.deepEqual(Array.from(resolved.exclude), []);
});

test('Area reference: sheet names ignore width, spaces, brackets, and case', () => {
  const api = loadDv360Api();
  assert.equal(api.normalizeGeographySheetName(' 「 ＡＲＥＡ 」 '), 'area');
  assert.equal(api.normalizeGeographySheetName('（エリア）'), 'エリア');
});

test('Area sheet parser: a single geography column defaults to include', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['地域'], ['福岡県'], ['佐賀県']], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県', '佐賀県']);
  assert.deepEqual(Array.from(parsed.exclude), []);
});

test('Area sheet parser: 区分 plus 地域 separates include and exclude', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['区分', '地域'], ['配信', '福岡県'], ['除外', '佐賀県']], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県']);
  assert.deepEqual(Array.from(parsed.exclude), ['佐賀県']);
});

test('Area sheet parser: separate include and exclude columns are supported', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['配信地域', '除外地域'], ['福岡県', '佐賀県']], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県']);
  assert.deepEqual(Array.from(parsed.exclude), ['佐賀県']);
});

test('Area sheet parser: horizontal include and exclude rows are supported', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['配信', '福岡県', '佐賀県'], ['除外', '長崎県', '熊本県']], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県', '佐賀県']);
  assert.deepEqual(Array.from(parsed.exclude), ['長崎県', '熊本県']);
});

test('Area sheet parser: a Code column is auxiliary and does not replace the geography name', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['地域名', 'Code'], ['福岡県', '20663']], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県']);
  assert.deepEqual(Array.from(parsed.exclude), []);
});

test('Area sheet parser: instruction rows are not treated as geography values', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([
    ['以下地域を配信対象とする'], ['対象エリア'], ['※設定不要'], ['地域'], ['福岡県'], ['除外なし'],
  ], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県']);
  assert.deepEqual(Array.from(parsed.exclude), []);
});

test('Area sheet parser: duplicate geography values are removed', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['地域'], ['福岡県'], ['福岡県']], '地域');
  assert.deepEqual(Array.from(parsed.include), ['福岡県']);
});

test('Area reference result continues through the existing compareGeography path', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const reference = { status: 'resolved', raw: '「エリア」シート参照', sheetName: 'エリア', include: ['福岡県'], exclude: [] };
  const compared = api.compareGeography('「エリア」シート参照', '20663;', '', reference);
  assert.equal(compared.result, 'ok');
  assert.match(compared.sVal, /参照元：エリア/);
  assert.equal(compared.referenceSheet, 'エリア');
});

test('Area reference core result is not overwritten by download-only geography fields', async () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const setting = { fields: makeSettingFields({
    region: '「エリア」シート参照',
    regionReference: { status: 'resolved', raw: '「エリア」シート参照', sheetName: 'エリア', include: ['福岡県'], exclude: [] },
  }) };
  const download = makeLiDownload();
  const core = api.compareLI(setting, download);
  assert.equal(core.find(item => item.label === '地域 / Geography Targeting').result, 'ok');
  const all = api.appendDownloadOnlyItems('LI', download, core);
  assert.equal(all.filter(item => /Geography Targeting/.test(item.label)).length, 1);
});

test('Area reference: missing sheet returns warning with a concrete reason', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const resolved = api.resolveGeographyReference('エリアシート参照', { Other: [['値']] }, ['Other']);
  assert.equal(resolved.status, 'warning');
  assert.match(resolved.reason, /地域参照Sheetが見つかりません/);
});

test('Area reference: multiple name candidates return warning and list candidates', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const sheets = { '配信地域': [['地域'], ['福岡県']], '対象エリア': [['地域'], ['佐賀県']] };
  const resolved = api.resolveGeographyReference('別シート参照', sheets, Object.keys(sheets));
  assert.equal(resolved.status, 'warning');
  assert.match(resolved.reason, /候補が複数/);
  assert.deepEqual(Array.from(resolved.candidates), ['配信地域', '対象エリア']);
});

test('Area sheet parser: an unresolvable include/exclude layout returns warning', async () => {
  const api = loadDv360Api();
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseGeographyReferenceSheet([['配信／除外', '地域'], ['対象', '福岡県']], '地域');
  assert.equal(parsed.status, 'warning');
  assert.match(parsed.reason, /配信／除外区分を特定できません/);
});

test('008 actual workbook resolves all regions and compares without the old reference warning', async () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const workbook = readSettingWorkbook(findSettingPath(case008Root));
  const parsed = api.parseYoutubeSetting(workbook.sheets, workbook.sheetNames, workbook.fileName);
  const codes = '20624; 20627; 20631; 20632; 20633; 20634; 20635; 20636; 20637; 20644; 20645; 20646; 20647; 20648; 20649; 20650; 20651; 20652; 20653; 20658; 20663; 20664; 20666; 20667;';
  assert.equal(parsed.liList.length, 3);
  for (const li of parsed.liList) {
    assert.equal(li.fields.region, '「エリア」シート参照');
    assert.equal(li.fields.regionReference.sheetName, 'エリア');
    const compared = api.compareGeography(li.fields.region, codes, '', li.fields.regionReference);
    assert.equal(compared.result, 'ok');
    assert.doesNotMatch(compared.detail, /設定表未識別/);
  }
});

test('001-010 setting workbooks all complete parsing after area-reference support', async () => {
  const api = loadDv360Api();
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  for (let number = 1; number <= 10; number++) {
    const caseRoot = path.join(youtubeCasesRoot, String(number).padStart(3, '0'));
    const workbook = readSettingWorkbook(findSettingPath(caseRoot));
    assert.doesNotThrow(() => api.parseYoutubeSetting(workbook.sheets, workbook.sheetNames, workbook.fileName));
  }
});
