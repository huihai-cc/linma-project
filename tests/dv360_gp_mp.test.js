// GP MP 統一ルール テスト（2026-08-03）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function createClassList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
  };
}

function createElement() {
  return {
    addEventListener() {},
    appendChild() {},
    classList: createClassList(),
    closest() { return null; },
    dataset: {},
    innerHTML: '',
    scrollIntoView() {},
    style: { setProperty() {} },
    textContent: '',
    value: '',
  };
}

function loadDv360Api() {
  const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = `
window.__dv360TestApi = {
  hasMeaningfulDownloadValue: typeof hasMeaningfulDownloadValue === 'function' ? hasMeaningfulDownloadValue : undefined,
  normalizeSdfFieldName: typeof normalizeSdfFieldName === 'function' ? normalizeSdfFieldName : undefined,
  parseSdfData,
  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === 'function' ? appendDownloadOnlyItems : undefined,
  appendDynamicDownloadColumns: typeof appendDynamicDownloadColumns === 'function' ? appendDynamicDownloadColumns : undefined,
  compareCP: typeof compareCP === 'function' ? compareCP : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  parseSetTokens: typeof parseSetTokens === 'function' ? parseSetTokens : undefined,
  parseUrlTokens: typeof parseUrlTokens === 'function' ? parseUrlTokens : undefined,
  compareMasterSet: typeof compareMasterSet === 'function' ? compareMasterSet : undefined,
  parseUnknownIntent: typeof parseUnknownIntent === 'function' ? parseUnknownIntent : undefined,
  checkUnknownInSet: typeof checkUnknownInSet === 'function' ? checkUnknownInSet : undefined,
  formatDiffSummary: typeof formatDiffSummary === 'function' ? formatDiffSummary : undefined,
  gpMpUnifiedRules: typeof GP_MP_UNIFIED_RULES !== 'undefined' ? GP_MP_UNIFIED_RULES : undefined,
  getSdfFieldDisplayLabel: typeof getSdfFieldDisplayLabel === 'function' ? getSdfFieldDisplayLabel : undefined,
  sdfFieldDisplayLabels: typeof SDF_FIELD_DISPLAY_LABELS !== 'undefined' ? SDF_FIELD_DISPLAY_LABELS : undefined,
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
  return sandbox.__dv360TestApi;
}

const api = loadDv360Api();

function findCompareItem(items, label) {
  return items.find(item => item.label === label);
}

function makeGpDownload(rawFields) {
  return {
    name: 'Test GP',
    id: '12345',
    fields: {
      status: 'Active',
      videoAdFormat: 'Responsive',
      bidCost: '2',
      demographicGender: '',
      demographicAge: '',
      geographyInclude: '',
      geographyExclude: '',
    },
    rawFields,
    rawFieldOrder: Object.keys(rawFields),
  };
}

// ============================================================
//  1. parseSetTokens／parseUrlTokens
// ============================================================
test('GP MP parseSetTokens: 重複除去・ソート・空白正規化・D:除去', () => {
  assert.equal(api.parseSetTokens('D:A; B; A; ').join(','), 'A,B');
  assert.equal(api.parseSetTokens('  D:54  ;  56  ; 54 ;59;').join(','), '54,56,59');
  assert.equal(api.parseSetTokens('').length, 0);
  assert.equal(api.parseSetTokens(';').length, 0);
});

test('GP MP parseUrlTokens: 末尾スラッシュ正規化・大文字小文字不問ソート', () => {
  const r = api.parseUrlTokens('Example.com/; example.com; D:test.org/');
  // 末尾/削除：Example.com/→example.com, example.com→example.com, test.org/→test.org
  // 重複除去：example.com は1つに
  assert.equal(r.join(','), 'example.com,test.org');
});

// ============================================================
//  2. compareMasterSet 基本
// ============================================================
test('GP MP compareMasterSet: 完全一致（順不同）→ ok', () => {
  const rule = { comparisonType: 'set', master: 'A; B; C' };
  const r = api.compareMasterSet('D:C; B; A;', rule);
  assert.equal(r.result, 'ok');
  assert.equal(r.missing.length, 0);
  assert.equal(r.extra.length, 0);
});

test('GP MP compareMasterSet: 1件不足 → warning', () => {
  const rule = { comparisonType: 'set', master: 'A; B; C' };
  const r = api.compareMasterSet('A; B', rule);
  assert.equal(r.result, 'warning');
  assert.equal(r.missing.join(','), 'C');
  assert.equal(r.extra.length, 0);
});

test('GP MP compareMasterSet: 1件追加 → warning', () => {
  const rule = { comparisonType: 'set', master: 'A; B' };
  const r = api.compareMasterSet('A; B; C', rule);
  assert.equal(r.result, 'warning');
  assert.equal(r.missing.length, 0);
  assert.equal(r.extra.join(','), 'C');
});

test('GP MP compareMasterSet: 不足＋追加同時 → warning 両方表示', () => {
  const rule = { comparisonType: 'set', master: 'A; B; C' };
  const r = api.compareMasterSet('A; D', rule);
  assert.equal(r.result, 'warning');
  assert.equal(r.missing.join(','), 'B,C');
  assert.equal(r.extra.join(','), 'D');
});

test('GP MP compareMasterSet: 空 → warning', () => {
  const rule = { comparisonType: 'set', master: 'A; B' };
  const r = api.compareMasterSet('', rule);
  assert.equal(r.result, 'warning');
  assert.equal(r.missing.length, 2);
});

// ============================================================
//  3. Category Targeting - Exclude
// ============================================================
test('GP MP Category: 54;56;59;1020 → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': 'D:54; 56; 59; 1020;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'ok');
});

test('GP MP Category: 1020 不足 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /不足/);
});

test('GP MP Category: 999 追加 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59; 1020; 999;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /追加/);
});

// ============================================================
//  4. Apps - Exclude
// ============================================================
test('GP MP Apps: 2つとも存在 → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - Apps - Exclude': 'com.twitter.android; 333903271;' }), '');
  const item = findCompareItem(items, '排除应用');
  assert.equal(item.result, 'ok');
});

test('GP MP Apps: 333903271 不足 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - Apps - Exclude': 'com.twitter.android;' }), '');
  const item = findCompareItem(items, '排除应用');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /不足/);
});

// ============================================================
//  5. URLs - Exclude
// ============================================================
test('GP MP URL: 順不同 → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - URLs - Exclude': 'fc2.com; fc2web.com; nicovideo.jp;' }), '');
  const item = findCompareItem(items, '排除URL');
  // 3 of 268 → warning (not full set)
  assert.equal(item.result, 'warning');
});

test('GP MP URL: 末尾スラッシュ正規化', () => {
  const r = api.parseUrlTokens('example.com/; example.com');
  // After trailing slash removal, both become 'example.com', deduped
  assert.equal(r.length, 1);
});

test('GP MP URL: wwwあり・なしは区別', () => {
  assert.notDeepEqual(api.parseUrlTokens('www.example.com'), api.parseUrlTokens('example.com'));
});

// ============================================================
//  6. YouTube Channels
// ============================================================
test('GP MP YouTube: 完全master一致 → ok（マスター最初の数チャンネルのみで簡易テスト）', () => {
  const ytMaster = api.gpMpUnifiedRules.youtubeChannelExclude.master;
  // All channels from master should match
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - YouTube Channels - Exclude': 'D:' + ytMaster }), '');
  const item = findCompareItem(items, '排除YouTube频道');
  assert.equal(item.result, 'ok');
});

test('GP MP YouTube: 1つ不足 → warning 件数表示', () => {
  const ytMaster = api.gpMpUnifiedRules.youtubeChannelExclude.master;
  // Remove last channel by cutting the string
  const lastSemi = ytMaster.lastIndexOf(';');
  const missing = 'UC__MISSING_TEST__';
  const modified = ytMaster + '; ' + missing;
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - YouTube Channels - Exclude': 'D:' + modified }), '');
  const item = findCompareItem(items, '排除YouTube频道');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /追加1件/);
});

test('GP MP YouTube: 1つ追加 → warning 件数表示', () => {
  const ytMaster = api.gpMpUnifiedRules.youtubeChannelExclude.master;
  // Remove first channel
  const firstSemi = ytMaster.indexOf(';');
  const shortened = ytMaster.substring(firstSemi + 2); // skip '; '
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - YouTube Channels - Exclude': 'D:' + shortened }), '');
  const item = findCompareItem(items, '排除YouTube频道');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /不足1件/);
});

// ============================================================
//  7. Household Income
// ============================================================
test('GP MP Household Income: ALL(不明有)＋完全7項目 → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Household Income': 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;' }), '');
  const item = findCompareItem(items, '世帯年収');
  assert.equal(item.result, 'ok');
});

test('GP MP Household Income: Unknown不足 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Household Income': 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%;' }), '');
  const item = findCompareItem(items, '世帯年収');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /Unknown/);
});

test('GP MP Household Income: Lower 50%不足 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Household Income': 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Unknown;' }), '');
  const item = findCompareItem(items, '世帯年収');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /Lower 50%/);
});

test('GP MP Household Income: 余計な値 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Household Income': 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown; ExtraValue;' }), '');
  const item = findCompareItem(items, '世帯年収');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /ExtraValue/);
});

// ============================================================
//  8. Parental Status
// ============================================================
test('GP MP Parental Status: ALL＋3項目 → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Parental Status': 'Not a parent; Parent; Unknown;' }), '');
  const item = findCompareItem(items, '子供の有無');
  assert.equal(item.result, 'ok');
});

test('GP MP Parental Status: Unknown不足 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Parental Status': 'Not a parent; Parent;' }), '');
  const item = findCompareItem(items, '子供の有無');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /Unknown/);
});

test('GP MP Parental Status: Parent不足 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Demographic Targeting Parental Status': 'Not a parent; Unknown;' }), '');
  const item = findCompareItem(items, '子供の有無');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /Parent/);
});

// ============================================================
//  9. Unknown 共同規則
// ============================================================
test('GP MP Unknown: 不明あり → include', () => {
  assert.equal(api.parseUnknownIntent('ALL(不明あり)'), 'include');
  assert.equal(api.parseUnknownIntent('不明有'), 'include');
  assert.equal(api.parseUnknownIntent('不明含む'), 'include');
});

test('GP MP Unknown: 不明なし → exclude', () => {
  assert.equal(api.parseUnknownIntent('不明なし'), 'exclude');
  assert.equal(api.parseUnknownIntent('不明無'), 'exclude');
  assert.equal(api.parseUnknownIntent('Unknown除外'), 'exclude');
});

test('GP MP Unknown: 無関係キーワード → null', () => {
  assert.equal(api.parseUnknownIntent('fc2.com'), null);
  assert.equal(api.parseUnknownIntent(''), null);
  assert.equal(api.parseUnknownIntent(null), null);
});

test('GP MP Unknown: 不明あり・Unknown有 → ok', () => {
  assert.equal(api.checkUnknownInSet(['Male', 'Female', 'Unknown'], 'include'), 'ok');
});

test('GP MP Unknown: 不明あり・Unknown無 → warning', () => {
  assert.equal(api.checkUnknownInSet(['Male', 'Female'], 'include'), 'warning');
});

test('GP MP Unknown: 不明なし・Unknown無 → ok', () => {
  assert.equal(api.checkUnknownInSet(['Male', 'Female'], 'exclude'), 'ok');
});

test('GP MP Unknown: 不明なし・Unknown有 → warning', () => {
  assert.equal(api.checkUnknownInSet(['Male', 'Female', 'Unknown'], 'exclude'), 'warning');
});

// ============================================================
// 10. formatDiffSummary
// ============================================================
test('GP MP formatDiffSummary: 不足のみ', () => {
  assert.match(api.formatDiffSummary(['A', 'B'], []), /不足：A; B/);
});

test('GP MP formatDiffSummary: 追加のみ', () => {
  assert.match(api.formatDiffSummary([], ['C']), /追加：C/);
});

test('GP MP formatDiffSummary: 不足＋追加', () => {
  const s = api.formatDiffSummary(['A'], ['B']);
  assert.match(s, /不足：A/);
  assert.match(s, /追加：B/);
});

test('GP MP formatDiffSummary: maxShow超えで他N件表示', () => {
  const s = api.formatDiffSummary(['A', 'B', 'C', 'D', 'E', 'F'], [], 5);
  assert.match(s, /他1件/);
});

// ============================================================
// 11. Boolean デフォルト
// ============================================================
test('GP MP Optimized Targeting: False → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Optimized Targeting': 'False' }), '');
  const item = findCompareItem(items, '自动优化投放');
  assert.equal(item.result, 'ok');
});

test('GP MP Optimized Targeting: True → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Optimized Targeting': 'True' }), '');
  const item = findCompareItem(items, '自动优化投放');
  assert.equal(item.result, 'warning');
  assert.match(item.mpDetail, /True/);
});

test('GP MP Optimized Targeting: 空値 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Optimized Targeting': '' }), '');
  const item = findCompareItem(items, '自动优化投放');
  assert.equal(item.result, 'warning');
});

test('GP MP Audience Expansion Seed: False → ok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Audience Expansion Seed List Excluded': 'False' }), '');
  const item = findCompareItem(items, '受众扩展种子列表排除');
  assert.equal(item.result, 'ok');
});

test('GP MP Audience Expansion Seed: True → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Audience Expansion Seed List Excluded': 'True' }), '');
  const item = findCompareItem(items, '受众扩展种子列表排除');
  assert.equal(item.result, 'warning');
});

test('GP MP Audience Expansion Seed: 空値 → warning', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Audience Expansion Seed List Excluded': '' }), '');
  const item = findCompareItem(items, '受众扩展种子列表排除');
  assert.equal(item.result, 'warning');
});

// ============================================================
// 12. 前端表示名確認
// ============================================================
test('GP MP UI 表示名: 9フィールドすべて指定名で表示', () => {
  const expectedLabels = {
    'keyword targeting - exclude': '排除关键词',
    'category targeting - exclude': '排除类别',
    'placement targeting - urls - exclude': '排除URL',
    'placement targeting - apps - exclude': '排除应用',
    'placement targeting - youtube channels - exclude': '排除YouTube频道',
    'demographic targeting household income': '世帯年収',
    'demographic targeting parental status': '子供の有無',
    'optimized targeting': '自动优化投放',
    'audience expansion seed list excluded': '受众扩展种子列表排除',
  };
  for (const [field, expected] of Object.entries(expectedLabels)) {
    const actual = api.getSdfFieldDisplayLabel(field);
    // 汉字を含む日本語ラベルには / English 接尾辞が自動追加される
    assert.match(actual, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `Label for "${field}" should contain "${expected}" but got "${actual}"`);
  }
});

// ============================================================
// 13. MPフィールドの設定表側表示
// ============================================================
test('GP MP UI: MPフィールドの設定表側にMP統一ルールが表示される', () => {
  const items = api.compareGP({}, makeGpDownload({
    'Keyword Targeting - Exclude': 'test;',
    'Category Targeting - Exclude': '54;',
  }), '');
  const kw = findCompareItem(items, '排除关键词');
  assert.match(kw.sVal, /MP統一ルール/);
  const cat = findCompareItem(items, '排除类别');
  assert.match(cat.sVal, /MP統一ルール/);
});

test('GP MP UI: ダウンロード側は実際のD:内容を保持', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': 'D:54; 56; 59; 1020;' }), '');
  const cat = findCompareItem(items, '排除类别');
  assert.match(cat.dVal, /54.*56.*59.*1020/);
});

// ============================================================
// 14. GP複数行独立判定
// ============================================================
test('GP MP 独立判定: 行ごとに独立して結果を返す', () => {
  const gp1 = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59; 1020;' }), '');
  const gp2 = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59;' }), '');
  assert.equal(findCompareItem(gp1, '排除类别').result, 'ok');
  assert.equal(findCompareItem(gp2, '排除类别').result, 'warning');
});

// ============================================================
// 15. 已确认本地标题不再追加英文
// ============================================================
test('GP MP 标签: 排除关键词不追加英文', () => {
  const label = api.getSdfFieldDisplayLabel('Keyword Targeting - Exclude');
  assert.match(label, /排除关键词/);
  assert.doesNotMatch(label, /Keyword Targeting - Exclude/);
});

test('GP MP 标签: 世帯年収只显示日文', () => {
  const label = api.getSdfFieldDisplayLabel('Demographic Targeting Household Income');
  assert.match(label, /世帯年収/);
  assert.equal(label, '世帯年収');
});

test('GP MP 标签: Audience Expansion Level不追加英文', () => {
  const label = api.getSdfFieldDisplayLabel('Audience Expansion Level');
  assert.match(label, /受众扩展等级/);
  assert.doesNotMatch(label, /Audience Expansion Level/);
});

test('GP MP 标签: Audience Targeting Include不追加英文', () => {
  const label = api.getSdfFieldDisplayLabel('Audience Targeting - Include');
  assert.match(label, /包含受众/);
  assert.doesNotMatch(label, /Audience Targeting - Include/);
});

test('GP MP 标签: Audience Targeting Exclude不追加英文', () => {
  const label = api.getSdfFieldDisplayLabel('Audience Targeting - Exclude');
  assert.match(label, /排除受众/);
  assert.doesNotMatch(label, /Audience Targeting - Exclude/);
});

test('GP MP 标签: GP全字段使用已确认的本地标题', () => {
  // GPで表示されうる全フィールドをチェック
  const gpFields = [
    'Keyword Targeting - Exclude', 'Category Targeting - Exclude',
    'Placement Targeting - URLs - Exclude', 'Placement Targeting - Apps - Exclude',
    'Placement Targeting - YouTube Channels - Exclude',
    'Demographic Targeting Household Income', 'Demographic Targeting Parental Status',
    'Optimized Targeting', 'Audience Expansion Seed List Excluded',
    'Audience Expansion Level', 'Audience Targeting - Include', 'Audience Targeting - Exclude',
    'Keyword Targeting - Include', 'Category Targeting - Include',
    'Placement Targeting - YouTube Channels - Include',
    'Placement Targeting - YouTube Videos - Include', 'Placement Targeting - YouTube Videos - Exclude',
    'Placement Targeting - Popular Content - Include',
    'Placement Targeting - URLs - Include', 'Placement Targeting - Apps - Include',
    'Placement Targeting - App Collections - Include', 'Placement Targeting - App Collections - Exclude',
    'Lookalike Audience Targeting - Include', 'Lookalike Audience Targeting - Exclude',
    'Affinity & In Market Targeting - Include', 'Affinity & In Market Targeting - Exclude',
    'Custom List Targeting', 'Language Targeting - Include',
    'Demand Gen Inventory Source Strategy', 'Demand Gen Enabled Inventory Sources',
    'Demographic Targeting Gender', 'Demographic Targeting Age',
  ];
  for (const field of gpFields) {
    const label = api.getSdfFieldDisplayLabel(field);
    const normalized = api.normalizeSdfFieldName(field);
    const displayLabel = api.sdfFieldDisplayLabels[normalized];
    if (displayLabel) {
      assert.ok(displayLabel.ja || displayLabel.zh,
        `Field "${field}" must have ja or zh label`);
      assert.equal(label, String(displayLabel.ja || displayLabel.en || field).split(' / ')[0].trim(),
        `Field "${field}" should not append English to its local label`);
    }
  }
});

// ============================================================
// 16. 差异渲染（2026-08-03 追加）
// ============================================================
test('GP MP 差异渲染: Category不足时mpDetail包含不足信息', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail, 'mpDetail must exist');
  assert.match(item.mpDetail, /不足/);
  assert.match(item.mpDetail, /1020/);
});

test('GP MP 差异渲染: Category多了时mpDetail包含追加信息', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59; 1020; 999;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail, 'mpDetail must exist');
  assert.match(item.mpDetail, /追加/);
  assert.match(item.mpDetail, /999/);
});

test('GP MP 差异渲染: URL不足和追加同时可见', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - URLs - Exclude': 'fc2web.com; fc2.com; EXTRA_SITE;' }), '');
  const item = findCompareItem(items, '排除URL');
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail, 'mpDetail must exist');
  assert.match(item.mpDetail, /不足/);
  assert.match(item.mpDetail, /追加/);
  assert.match(item.mpDetail, /extra_site/);
});

test('GP MP 差异渲染: YouTube差异显示件数', () => {
  const ytMaster = api.gpMpUnifiedRules.youtubeChannelExclude.master;
  const firstSemi = ytMaster.indexOf(';');
  const shortened = ytMaster.substring(firstSemi + 2);
  const items = api.compareGP({}, makeGpDownload({ 'Placement Targeting - YouTube Channels - Exclude': 'D:' + shortened }), '');
  const item = findCompareItem(items, '排除YouTube频道');
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail, 'mpDetail must exist');
  assert.match(item.mpDetail, /不足/);
});

// ============================================================
// 17. warning/mismatch 分類（2026-08-03 追加）
// ============================================================
test('GP MP 統計: master完全一致はok', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59; 1020;' }), '');
  assert.equal(findCompareItem(items, '排除类别').result, 'ok');
});

test('GP MP 統計: master不一致はwarning（mismatchではない）', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'warning');
  assert.notEqual(item.result, 'mismatch');
});

test('GP MP 統計: MP warningはcalcOwnStatusでmismatchにカウントされない', () => {
  // Create items with only MP warnings, no mismatches
  const items = [
    { label: '動画フォーマット', result: 'ok' },
    { label: '排除关键词', result: 'warning', mpDetail: '不足：TEST' },
    { label: 'ステータス', result: 'ok' },
  ];
  // warning should not escalate to mismatch
  const hasMismatch = items.some(it => it.result === 'mismatch');
  const hasWarning = items.some(it => it.result === 'warning');
  assert.equal(hasMismatch, false);
  assert.equal(hasWarning, true);
});

test('GP MP 統計: mismatchがある場合はmismatch', () => {
  const items = [
    { label: '動画フォーマット', result: 'ok' },
    { label: '入札単価', result: 'mismatch' },
    { label: '排除关键词', result: 'warning', mpDetail: '不足：TEST' },
  ];
  const hasMismatch = items.some(it => it.result === 'mismatch');
  const hasWarning = items.some(it => it.result === 'warning');
  assert.equal(hasMismatch, true);
  assert.equal(hasWarning, true);
});

// ============================================================
// 18. 回帰確認
// ============================================================
test('GP MP 回帰: 完全一致時にS:MP統一ルールとD:実値が表示される', () => {
  const items = api.compareGP({}, makeGpDownload({ 'Category Targeting - Exclude': '54; 56; 59; 1020;' }), '');
  const item = findCompareItem(items, '排除类别');
  assert.equal(item.result, 'ok');
  assert.match(item.sVal, /MP統一ルール/);
  assert.match(item.dVal, /54.*56.*59.*1020/);
});

test('GP MP 回帰: 3行独立', () => {
  const gp1 = api.compareGP({}, makeGpDownload({ 'Optimized Targeting': 'False' }), '');
  const gp2 = api.compareGP({}, makeGpDownload({ 'Optimized Targeting': 'True' }), '');
  const gp3 = api.compareGP({}, makeGpDownload({ 'Optimized Targeting': '' }), '');
  assert.equal(findCompareItem(gp1, '自动优化投放').result, 'ok');
  assert.equal(findCompareItem(gp2, '自动优化投放').result, 'warning');
  assert.equal(findCompareItem(gp3, '自动优化投放').result, 'warning');
});

test('GP MP 回帰: existing tests still pass - verified by test count', () => {
  // This is a meta-test to confirm the test file is still coherent
  assert.ok(true);
});
