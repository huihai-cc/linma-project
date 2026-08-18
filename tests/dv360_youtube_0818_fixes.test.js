// ============================================================
// 2026-08-18 専用テスト：DV360 設定チェック 4 点修正の検証
//   #1 Non-Skippable 同義表記の canonical 統一（VRC(Non-Skippable) = TrueView/Non Skippable）
//   #2 子供の有無 すべて/ALL/▼選択/空白 で Unknown を必須にしない
//   #3 表ヘッダ 日文優先（世帯年収/子供の有無 等に英語サフィックスを付けない）
//   #4 YouTube LI/GP 旧カテゴリ除外（Category Exclusions）を比較対象から削除
//   #5（回帰確認）Inventory Mode / 広告枠モード の既定ルールは維持
// ============================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');

function createClassList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
  };
}

function createElement(initialValue = '') {
  const listeners = {};
  return {
    __listeners: listeners,
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    appendChild() {},
    classList: createClassList(),
    closest() { return null; },
    dataset: {},
    disabled: false,
    files: [],
    innerHTML: '',
    querySelector() { return null; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    style: { display: '', setProperty() {} },
    textContent: '',
    value: initialValue,
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = `
window.__dv360FixesTestApi = {
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === 'function' ? appendDownloadOnlyItems : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  normVideoType: typeof normVideoType === 'function' ? normVideoType : undefined,
  normYoutubeVideoType: typeof normYoutubeVideoType === 'function' ? normYoutubeVideoType : undefined,
  getDemographicExpectedTokens: typeof getDemographicExpectedTokens === 'function' ? getDemographicExpectedTokens : undefined,
  compareDemographicTargeting: typeof compareDemographicTargeting === 'function' ? compareDemographicTargeting : undefined,
  compareAgeDemographicTargeting: typeof compareAgeDemographicTargeting === 'function' ? compareAgeDemographicTargeting : undefined,
  resolveUnknownRequirement: typeof resolveUnknownRequirement === 'function' ? resolveUnknownRequirement : undefined,
  DOWNLOAD_FIELD_DEFAULT_RULES: typeof DOWNLOAD_FIELD_DEFAULT_RULES === 'object' ? DOWNLOAD_FIELD_DEFAULT_RULES : undefined,
  DOWNLOAD_FIELD_VALIDATION_RULES: typeof DOWNLOAD_FIELD_VALIDATION_RULES === 'object' ? DOWNLOAD_FIELD_VALIDATION_RULES : undefined,
  calcOwnStatus: typeof calcOwnStatus === 'function' ? calcOwnStatus : undefined,
  setMediaType: function(value) { mediaType=value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
  const document = {
    body: createElement(),
    documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob,
    DecompressionStream: globalThis.DecompressionStream,
    Encoding: {},
    FileReader: function FileReader() {},
    JSZip: {},
    Map,
    Promise,
    Response,
    Set,
    TextDecoder,
    Uint8Array,
    URL,
    XLSX: {},
    alert() {},
    atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  sandbox.__dv360FixesTestApi.setMediaType('youtube');
  return { api: sandbox.__dv360FixesTestApi, document, sandbox };
}

const { api } = loadDv360Api();

function makeYoutubeDownload(fields = {}) {
  return {
    name: 'YouTube test', id: 'youtube-test', rawFields: {}, rawFieldOrder: [],
    statusInfo: { found: true, matchedKey: 'Status', rawValue: 'Paused', normalizedValue: 'Paused' },
    fields: { status: 'Paused', ...fields },
  };
}

function findItem(items, label) {
  const item = items.find(entry => entry.label === label);
  assert.ok(item, `${label} comparison item should exist`);
  return item;
}

function liVideoType(settingVideoType, downloadType, downloadSubtype, downloadExtra = {}) {
  return api.compareLI(
    { fields: { videoType: settingVideoType } },
    makeYoutubeDownload({ type: downloadType, subtype: downloadSubtype, ...downloadExtra }),
  );
}

function liVideoItem(settingVideoType, downloadType, downloadSubtype, downloadExtra = {}) {
  return findItem(liVideoType(settingVideoType, downloadType, downloadSubtype, downloadExtra), '動画タイプ');
}

// ============================================================
// #1 Non-Skippable 同義表記の canonical 統一
// ============================================================
// 設定表「VRC(Non-Skippable)」と SDF「TrueView / Non Skippable」は同一物。
// すべての表記揺れが単一 canonical 'vrc_nonskippable' に統一され、両方向で ok になる。
test('#1 YouTube LI: VRC(Non-Skippable) vs SDF TrueView/Non Skippable → ok', () => {
  assert.equal(liVideoItem('VRC(Non-Skippable)', 'TrueView', 'Non Skippable').result, 'ok');
});

test('#1 YouTube LI: VRC (Non Skippable) vs TrueView/Non Skippable → ok', () => {
  assert.equal(liVideoItem('VRC (Non Skippable)', 'TrueView', 'Non Skippable').result, 'ok');
});

test('#1 YouTube LI: VRC(NonS) vs TrueView/Non Skippable → ok', () => {
  assert.equal(liVideoItem('VRC(NonS)', 'TrueView', 'Non Skippable').result, 'ok');
});

test('#1 YouTube LI: TrueView/Non Skippable vs TrueView/Non Skippable → ok', () => {
  assert.equal(liVideoItem('TrueView/Non Skippable', 'TrueView', 'Non Skippable').result, 'ok');
});

test('#1 YouTube LI: Non Skippable / Non-Skippable vs TrueView/Non Skippable → ok', () => {
  assert.equal(liVideoItem('Non Skippable', 'TrueView', 'Non Skippable').result, 'ok');
  assert.equal(liVideoItem('Non-Skippable', 'TrueView', 'Non Skippable').result, 'ok');
});

test('#1 YouTube LI: 逆方向 SDF 側のハイフン表記 TrueView / Non-Skippable → ok', () => {
  assert.equal(liVideoItem('VRC(Non-Skippable)', 'TrueView', 'Non-Skippable').result, 'ok');
});

test('#1 normVideoType: 全表記揺れは単一 canonical vrc_nonskippable に統一', () => {
  const forms = [
    'VRC(Non-Skippable)', 'VRC (Non Skippable)', 'VRC(NonS)', 'VRC(Non-Skip)',
    'TrueView/Non Skippable', 'TrueView / Non-Skippable', 'Non Skippable', 'Non-Skippable',
    'TRUEVIEW/NON SKIPPABLE',
  ];
  forms.forEach(form => assert.equal(api.normVideoType(form), 'vrc_nonskippable', form));
  assert.equal(api.normYoutubeVideoType('VRC(Non-Skippable)'), 'vrc_nonskippable');
  assert.equal(api.normYoutubeVideoType('TrueView/Non Skippable'), 'vrc_nonskippable');
  // 旧 dual canonical 'youtube_nonskippable' は二度と返さない
  assert.notEqual(api.normVideoType('TrueView/Non Skippable'), 'youtube_nonskippable');
  assert.notEqual(api.normYoutubeVideoType('TrueView/Non Skippable'), 'youtube_nonskippable');
});

test('#1 回帰: 他の動画タイプは従来どおり', () => {
  assert.equal(liVideoItem('VRC(Skippable)', 'TrueView', 'Reach').result, 'ok');
  assert.equal(liVideoItem('VRC(S)', 'TrueView', 'Reach').result, 'ok');
  assert.equal(liVideoItem('Bumper', 'Bumper', 'Bumper').result, 'ok');
  assert.equal(liVideoItem('TrueView/View', 'VVC', 'View').result, 'ok');
  assert.equal(liVideoItem('VVC', 'VVC', 'View').result, 'ok');
  assert.equal(liVideoItem('TrueView/Action', 'TrueView', 'Action').result, 'ok');
  assert.equal(liVideoItem('YTN', 'YTN', 'Next').result, 'ok');
  // Bumper vs Skippable は従来どおり warning（誤って vrc_nonskippable にしない）
  assert.equal(liVideoItem('Bumper', 'TrueView', 'Reach').result, 'warning');
  // VRC Skippable vs Non-Skippable は mismatch（従来どおり別物）
  assert.equal(liVideoItem('VRC(Skippable)', 'TrueView', 'Non Skippable').result, 'mismatch');
});

// ============================================================
// #2 子供の有無 すべて/ALL/▼選択/空白 → Unknown 不要
// ============================================================
function gpParental(settingValue, downloadParental) {
  return api.compareGP(
    { fields: { parentalStatus: settingValue } },
    makeYoutubeDownload({ demographicParental: downloadParental }),
  );
}

function gpParentalItem(settingValue, downloadParental) {
  return findItem(gpParental(settingValue, downloadParental), '子供の有無');
}

test('#2 GP 子供の有無: すべて vs Not a parent; Parent; → ok', () => {
  const item = gpParentalItem('すべて', 'Not a parent; Parent;');
  assert.equal(item.result, 'ok');
  assert.equal(item.mpDetail, '');
});

test('#2 GP 子供の有無: ALL vs Not a parent; Parent; Unknown; → ok（Unknown は必須でも余計でもない）', () => {
  const item = gpParentalItem('ALL', 'Not a parent; Parent; Unknown;');
  assert.equal(item.result, 'ok');
});

test('#2 GP 子供の有無: ▼選択 vs Not a parent; Parent; → ok', () => {
  assert.equal(gpParentalItem('▼選択', 'Not a parent; Parent;').result, 'ok');
});

test('#2 GP 子供の有無: 空白（設定表なし）= ALL → ok', () => {
  const items = api.compareGP({}, makeYoutubeDownload({ demographicParental: 'Not a parent; Parent;' }));
  assert.equal(findItem(items, '子供の有無').result, 'ok');
});

test('#2 getDemographicExpectedTokens: ALL/▼選択/空白は [not a parent, parent] のみ', () => {
  ['すべて', 'ALL', 'all', '▼選択', ''].forEach(setting => {
    const expected = api.getDemographicExpectedTokens(setting, 'parentalStatus');
    // 注: 配列を [...tokens] でホスト側配列にコピーして比較する（vm サンドボックス由来の
    // プロトタイプ差異で deepStrictEqual が失敗しないようにするため）。
    assert.deepEqual([...expected.tokens], ['not a parent', 'parent'], setting);
    assert.equal(expected.requirement, 'include', setting);
  });
});

test('#2 GP 子供の有無: 不明あり は従来どおり Unknown を要求する', () => {
  assert.equal(gpParentalItem('すべて / 不明あり', 'Not a parent; Parent; Unknown;').result, 'ok');
  const missing = gpParentalItem('すべて / 不明あり', 'Not a parent; Parent;');
  assert.equal(missing.result, 'warning');
  assert.match(missing.mpDetail, /Unknown/);
});

test('#2 GP 子供の有無: 不明なし は従来どおり Unknown を排除（ダウンロード側に残れば warning）', () => {
  assert.equal(gpParentalItem('すべて / 不明なし', 'Not a parent; Parent;').result, 'ok');
  assert.equal(gpParentalItem('すべて / 不明なし', 'Not a parent; Parent; Unknown;').result, 'warning');
});

test('#2 GP 子供の有無: ALL でも Unknown 以外の余計は mismatch/warning', () => {
  assert.equal(gpParentalItem('すべて', 'Not a parent; Parent; ExtraValue;').result, 'warning');
});

test('#2 GP 子供の有無: Parent 不足は従来どおり warning', () => {
  const item = gpParentalItem('すべて', 'Not a parent; Unknown;');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /Parent/);
});

test('#2 回帰: Unknown 規則は 性別/年齢/世帯年収 に波及しない', () => {
  // 性別: すべて + ダウンロードに Unknown が残れば従来どおり不一致
  const gender = api.compareGP({ fields: { gender: 'すべて' } },
    makeYoutubeDownload({ demographicGender: 'Male; Female; Unknown;' }));
  // 性別では Unknown 余計が従来どおり mismatch（parentalStatus だけが緩和される）
  assert.equal(findItem(gender, '性別').result, 'mismatch');
  // 世帯年収: ALL / 不明なし + ダウンロードに Unknown → warning（従来どおり）
  const income = api.compareGP({ fields: { householdIncome: 'ALL / 不明なし' } },
    makeYoutubeDownload({ demographicIncome: 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;' }));
  assert.equal(findItem(income, '世帯年収').result, 'warning');
  // 世帯年収: ALL / 不明あり + Unknown あり → ok（従来どおり）
  const incomeOk = api.compareGP({ fields: { householdIncome: 'ALL / 不明あり' } },
    makeYoutubeDownload({ demographicIncome: 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;' }));
  assert.equal(findItem(incomeOk, '世帯年収').result, 'ok');
  // 年齢: 不明なし + Unknown → mismatch（従来どおり。parentalStatus だけが緩和される）
  const age = api.compareGP({ fields: { age: '全年齢', ageUnknown: '不明なし' } },
    makeYoutubeDownload({ demographicAge: '18-24; 25-34; 35-44; 45-54; 55-64; 65+; Unknown;' }));
  assert.equal(findItem(age, '年齢').result, 'mismatch');
  // 年齢: 不明なし + Unknown なし → ok（従来どおり）
  const ageOk = api.compareGP({ fields: { age: '全年齢', ageUnknown: '不明なし' } },
    makeYoutubeDownload({ demographicAge: '18-24; 25-34; 35-44; 45-54; 55-64; 65+;' }));
  assert.equal(findItem(ageOk, '年齢').result, 'ok');
});

// ============================================================
// #3 表ヘッダ 日文優先（英語サフィックスを外す）
// ============================================================
test('#3 GP 列: 世帯年収 / 子供の有無 は日本語のみで英語サフィックスなし', () => {
  const columns = api.getCoreLevelColumns('GP', true);
  const income = columns.find(column => column.key === '世帯年収');
  const parental = columns.find(column => column.key === '子供の有無');
  assert.ok(income && parental, 'GP columns should contain 世帯年収 and 子供の有無');
  assert.equal(income.label, '世帯年収');
  assert.equal(parental.label, '子供の有無');
  assert.doesNotMatch(income.label, /\\n|Demographic|Household/i);
  assert.doesNotMatch(parental.label, /\\n|Demographic|Parental|Status/i);
});

test('#3 GP 列: 排除类别 キーが存在しない（カテゴリ除外廃止）', () => {
  const keys = api.getCoreLevelColumns('GP', true).map(column => column.key);
  assert.equal(keys.includes('排除类别'), false);
});

test('#3 GP 列: 排除关键词/排除URL/排除应用/排除YouTube频道 はローカル名のみ', () => {
  const columns = api.getCoreLevelColumns('GP', true);
  [
    ['排除关键词', 'Keyword Targeting'],
    ['排除URL', 'Placement Targeting'],
    ['排除应用', 'Apps'],
    ['排除YouTube频道', 'YouTube Channels'],
  ].forEach(([key, englishFragment]) => {
    const column = columns.find(entry => entry.key === key);
    assert.ok(column, `${key} column should exist`);
    assert.equal(column.label, key);
    assert.doesNotMatch(column.label, new RegExp(englishFragment, 'i'));
  });
});

test('#3 全レベル列定義: 日本語を含むヘッダは英語サフィックスを付けない', () => {
  // 日本語（ひらがな/カタカナ）を含む行 → \n → 英字、の二重表記は残っていないこと
  // （英語のみの列「LP URL / Landing Page URL」「CTA / Call to Action」等は対象外）
  const levels = ['CP', 'IO', 'LI', 'GP', 'CR'];
  const bilingualPattern = /[぀-ヿァ-ヶヷ-ヺ][^\n]*\n[^\n]*[A-Za-z]/;
  levels.forEach(level => {
    const labels = api.getCoreLevelColumns(level, true).map(column => column.label);
    labels.forEach(label => {
      assert.doesNotMatch(label, bilingualPattern, `level=${level} label=${JSON.stringify(label)}`);
    });
  });
});

// ============================================================
// #4 YouTube LI/GP 旧カテゴリ除外（Category Exclusions）比較廃止
// ============================================================
const STANDARD_CATEGORY = [
  'Embedded Videos', 'Live Streaming', 'Mature Games', 'Not Yet Determined Health Sources',
  'Not Yet Determined News Sources', 'Politics', 'Recent News', 'Religion',
  'Unpleasant Health Content', 'Unpleasant News',
].join('; ') + ';';

test('#4 LI 検証ルール: TrueView Category Exclusions Targeting が登録されていない', () => {
  const liRules = api.DOWNLOAD_FIELD_VALIDATION_RULES.LI || {};
  assert.equal(liRules['TrueView Category Exclusions Targeting'], undefined);
});

test('#4 GP 検証ルール: Category Targeting - Exclude が登録されていない', () => {
  const gpRules = api.DOWNLOAD_FIELD_VALIDATION_RULES.GP || {};
  assert.equal(gpRules['Category Targeting - Exclude'], undefined);
});

test('#4 LI: カテゴリ除外が空欄なら項目も warning も出さない', () => {
  const items = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['TrueView Category Exclusions Targeting'],
    rawFields: { 'TrueView Category Exclusions Targeting': '' },
  }, []);
  assert.equal(items.some(item => item.rawFieldName === 'TrueView Category Exclusions Targeting'), false);
});

test('#4 LI: 旧カテゴリ除外の残留値は LI エラーにならない（download-only 情報のみ）', () => {
  const items = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['TrueView Category Exclusions Targeting'],
    rawFields: { 'TrueView Category Exclusions Targeting': STANDARD_CATEGORY },
  }, []);
  const legacy = items.find(item => item.rawFieldName === 'TrueView Category Exclusions Targeting');
  assert.equal(legacy.result, 'download-only');
  assert.equal(api.calcOwnStatus([legacy]), 'ok');
  assert.equal(legacy.isAutoAdded, true);
});

test('#4 LI: 旧カテゴリ除外の差異値も不一致にしない', () => {
  const deviated = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['TrueView Category Exclusions Targeting'],
    rawFields: { 'TrueView Category Exclusions Targeting': STANDARD_CATEGORY.replace('Politics;', 'Different Politics;') },
  }, []);
  const legacy = deviated.find(item => item.rawFieldName === 'TrueView Category Exclusions Targeting');
  assert.equal(legacy.result, 'download-only');
});

test('#4 GP: 旧カテゴリ除外があっても 排除类别 比較項目を出さない', () => {
  const items = api.compareGP({}, makeYoutubeDownload({
    type: 'TrueView', subtype: 'Non Skippable',
  }), '');
  assert.equal(items.some(item => item.label === '排除类别'), false);
  assert.equal(items.some(item => item.result === 'mismatch' && /カテゴリ|Category/.test(item.label)), false);
});

// ============================================================
// #5（回帰）Inventory Mode / 広告枠モード は維持
// ============================================================
test('#5 Inventory Mode 既定ルールが LI に残っている', () => {
  const liDefaults = api.DOWNLOAD_FIELD_DEFAULT_RULES.LI || {};
  const inventory = Object.values(liDefaults).find(rule => rule.field === 'Inventory Mode');
  assert.ok(inventory, 'LI default rules should still contain Inventory Mode');
  assert.equal(inventory.expected, 'Moderate');
});

test('#5 Inventory Mode の既定値一致は表示されず、乖離は warning（従来どおり）', () => {
  const matching = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Inventory Mode'],
    rawFields: { 'Inventory Mode': 'Moderate' },
  }, []);
  assert.equal(matching.some(item => item.rawFieldName === 'Inventory Mode'), false);
  const deviated = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Inventory Mode'],
    rawFields: { 'Inventory Mode': 'High' },
  }, []);
  const inventory = deviated.find(item => item.rawFieldName === 'Inventory Mode');
  assert.equal(inventory.result, 'warning');
});
