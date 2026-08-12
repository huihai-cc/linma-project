'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadDv360Api() {
  const htmlPath = path.join(projectRoot, 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  if (!source) throw new Error(`DV360 application script not found: ${htmlPath}`);
  const exportBlock = `
window.__dv360AudienceCompareApi = {
  compareLI,
  compareGP,
  buildComparisonTree,
  appendDownloadOnlyItems,
  hydrateAudienceTargetMaster,
  hydrateYoutubeAudienceAliasMaster: typeof hydrateYoutubeAudienceAliasMaster === 'function' ? hydrateYoutubeAudienceAliasMaster : undefined,
  normYoutubeVideoType: typeof normYoutubeVideoType === 'function' ? normYoutubeVideoType : undefined,
  resolveYoutubeAudienceSettingItem: typeof resolveYoutubeAudienceSettingItem === 'function' ? resolveYoutubeAudienceSettingItem : undefined,
  compareYoutubeAudienceBucket: typeof compareYoutubeAudienceBucket === 'function' ? compareYoutubeAudienceBucket : undefined,
  buildYoutubeAudienceComparisonItems: typeof buildYoutubeAudienceComparisonItems === 'function' ? buildYoutubeAudienceComparisonItems : undefined,
  getCoreLevelColumns,
  setMediaType(value) { mediaType = value; },
  setSelectedDv360CaseType,
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
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX,
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  const api = sandbox.__dv360AudienceCompareApi;
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('initial');
  return api;
}

const api = loadDv360Api();

function downloadLi(type, subtype = '') {
  return {
    name: 'LI', id: 'LI1', fields: { type, subtype, status: 'Draft' },
    rawFields: { Status: 'Draft', Type: type, Subtype: subtype }, rawFieldOrder: ['Status', 'Type', 'Subtype'],
  };
}

function emptyAudience() {
  return {
    affinity: { include: [], exclude: [] },
    lifeEvent: { include: [], exclude: [] },
    detailedDemo: { include: [], exclude: [] },
  };
}

function settingItems(count, prefix = 'Affinity') {
  return Array.from({ length: count }, (_, index) => ({
    no: index + 1,
    name: `${prefix} ${index + 1}`,
    criterionId: String(80001 + index),
    sourceSheet: 'アフィニティカテゴリ',
    sourceRow: index + 6,
    visible: true,
    styleId: 1,
    fill: {},
    bucket: 'include',
  }));
}

function hydrateAffinityMaster(count = 19) {
  api.hydrateAudienceTargetMaster(Array.from({ length: count }, (_, index) => [
    String(80001 + index), 'in_market', 'Category', 'Parent', `Affinity ${index + 1}`,
    'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09',
  ]));
}

const confirmedAliases = [
  {
    audience_id: '93040', audience_type: 'AFFINITY', ja_name: '美容、健康',
    ja_path: 'アフィニティ カテゴリ/美容、健康', en_name: 'Beauty & Wellness',
    mapping_status: 'confirmed', source: 'manual-confirmed', evidence_case: '010 MEMEME', confirmed_by: 'manual',
  },
  {
    audience_id: '80546', audience_type: 'IN_MARKET', ja_name: '美容、パーソナルケア',
    ja_path: '購買意向の強いオーディエンス/美容、パーソナルケア', en_name: 'Beauty & Personal Care',
    mapping_status: 'confirmed', source: 'manual-confirmed', evidence_case: '010 MEMEME', confirmed_by: 'manual',
  },
  {
    audience_id: '80285', audience_type: 'IN_MARKET', ja_name: '美容、コスメ',
    ja_path: '購買意向の強いオーディエンス/教育/大学、短期大学/美容、コスメ', en_name: 'Cosmetology Education & Training',
    mapping_status: 'confirmed', source: 'manual-confirmed', evidence_case: '010 MEMEME', confirmed_by: 'manual',
  },
];

function hydrate010AudienceMaster() {
  api.hydrateAudienceTargetMaster([
    ['93040', 'affinity', 'Category', '', 'Beauty & Wellness', 'AFFINITY', 'https://developers.google.com/google-ads/api/data/tables/affinity-categories.csv', '2026-08-09'],
    ['80546', 'in_market', 'Category', '', 'Beauty & Personal Care', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
    ['80285', 'in_market', 'Category', 'Post-Secondary Education', 'Cosmetology Education & Training', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
  ]);
}

function hydrate010ConfirmedAliases() {
  hydrate010AudienceMaster();
  assert.equal(typeof api.hydrateYoutubeAudienceAliasMaster, 'function');
  const csv = fs.readFileSync(path.join(projectRoot, 'data', 'dv360_google_audience_alias_ja.csv'), 'utf8');
  const workbook = XLSX.read(csv, { type: 'string' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
  assert.equal(api.hydrateYoutubeAudienceAliasMaster(rows), 3);
}

function setting010Items() {
  return confirmedAliases.map((alias, index) => ({
    no: index + 1, name: alias.ja_path, sourceSheet: 'アフィニティカテゴリ(美容マス層)',
    sourceRow: index + 145, visible: true, styleId: 1, fill: {}, bucket: 'include',
  }));
}

function gpDownload(rawFields = {}) {
  return {
    name: 'GP', id: 'GP1', liId: 'LI1', fields: { status: 'Active', videoAdFormat: 'Responsive' },
    rawFields: { Status: 'Active', 'Video Ad Format': 'Responsive', ...rawFields },
    rawFieldOrder: ['Status', 'Video Ad Format', ...Object.keys(rawFields)],
  };
}

test('Video type 1: YouTube TrvNonskip と Non Skippable は explicit canonical で ok', () => {
  const items = api.compareLI({ name: 'LI', fields: { videoType: 'TrvNonskip' } }, downloadLi('Non Skippable'));
  assert.equal(items.find(item => item.label === '動画タイプ').result, 'ok');
});

test('Video type 1b: 实际 SDF Type=TrueView / Subtype=Non Skippable 也只映射为同一 explicit canonical', () => {
  const items = api.compareLI({ name: 'LI', fields: { videoType: 'TrvNonskip' } }, downloadLi('TrueView', 'Non Skippable'));
  assert.equal(items.find(item => item.label === '動画タイプ').result, 'ok');
});

test('Video type 2: TrvNonskip は他の動画タイプを許容しない', () => {
  const items = api.compareLI({ name: 'LI', fields: { videoType: 'TrvNonskip' } }, downloadLi('TrueView', 'Skippable'));
  assert.equal(items.find(item => item.label === '動画タイプ').result, 'mismatch');
});

test('Audience 1: resolver は Setting NO を criterion ID とみなさない', () => {
  hydrateAffinityMaster(1);
  assert.equal(typeof api.resolveYoutubeAudienceSettingItem, 'function');
  const resolved = api.resolveYoutubeAudienceSettingItem({ no: 80001, name: '存在しない日本語名' }, 'affinity');
  assert.equal(resolved.status, 'unknown');
});

test('Audience 2: 明示された安定 criterionId は型一致 master で解決する', () => {
  hydrateAffinityMaster(1);
  const resolved = api.resolveYoutubeAudienceSettingItem({ criterionId: '80001', name: '任意表示名' }, 'affinity');
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.id, '80001');
  assert.equal(resolved.officialName, 'Affinity 1');
});

test('Audience 3: YTN synthetic 19=19 は resolved set で ok', () => {
  hydrateAffinityMaster(19);
  const audience = emptyAudience();
  audience.affinity.include = settingItems(19);
  const ids = audience.affinity.include.map(item => item.criterionId).join('; ');
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': ids,
  }), 'affinity', 'include');
  assert.equal(item.result, 'ok', item.mpDetail);
  assert.deepEqual(JSON.parse(JSON.stringify(item.metrics)), {
    settingCount: 19, downloadCount: 19, resolvedCount: 19, unresolvedCount: 0,
    missingCount: 0, extraCount: 0, fieldPresent: true,
  });
});

test('Audience 4: VVC synthetic Setting19 / Download1 は missing18 の mismatch', () => {
  hydrateAffinityMaster(19);
  const audience = emptyAudience();
  audience.affinity.include = settingItems(19);
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': '80001',
  }), 'affinity', 'include');
  assert.equal(item.result, 'mismatch');
  assert.equal(item.metrics.missingCount, 18);
  assert.equal(item.metrics.extraCount, 0);
  assert.match(item.mpDetail, /配信不足/);
});

test('Audience 5: Setting 非空 + SDF field absent は指定文言の warning', () => {
  hydrateAffinityMaster(1);
  const audience = emptyAudience();
  audience.affinity.include = settingItems(1);
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload(), 'affinity', 'include');
  assert.equal(item.result, 'warning');
  assert.equal(item.metrics.fieldPresent, false);
  assert.equal(item.mpDetail, '設定表にAudience指定がありますが、SDFに対応フィールドが存在しないため自動比較できません。');
});

test('Audience 6: SDF field present empty は absent ではなく resolved missing の mismatch', () => {
  hydrateAffinityMaster(1);
  const audience = emptyAudience();
  audience.affinity.include = settingItems(1);
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': '',
  }), 'affinity', 'include');
  assert.equal(item.metrics.fieldPresent, true);
  assert.equal(item.result, 'mismatch');
  assert.equal(item.metrics.missingCount, 1);
});

test('Audience 7: 未解析日本語名は warning で、resolved missing には入れない', () => {
  hydrateAffinityMaster(1);
  const audience = emptyAudience();
  audience.affinity.include = [{ name: '公式ID未確認の日本語名', no: 180, visible: true, bucket: 'include' }];
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': '80001',
  }), 'affinity', 'include');
  assert.equal(item.result, 'warning');
  assert.equal(item.metrics.unresolvedCount, 1);
  assert.equal(item.metrics.missingCount, 0);
  assert.match(item.mpDetail, /名称の公式ID対応を確認できないため要確認/);
  assert.match(item.dVal, /Affinity 1 \(80001\)/);
});

test('Audience 8: Setting 空 + Download 追加は mismatch として識別する', () => {
  hydrateAffinityMaster(1);
  const item = api.compareYoutubeAudienceBucket(emptyAudience(), gpDownload({
    'Affinity & In Market Targeting - Include': '80001',
  }), 'affinity', 'include');
  assert.equal(item.result, 'mismatch');
  assert.equal(item.metrics.extraCount, 1);
  assert.match(item.mpDetail, /配信追加/);
});

test('Audience 9: 六个正式 Audience 字段不会再生成 download-only 裸 ID 项', () => {
  hydrateAffinityMaster(1);
  const fields = {
    'Affinity & In Market Targeting - Include': '80001',
    'Affinity & In Market Targeting - Exclude': '80001',
    'Life Event Targeting - Include': '80001',
    'Life Event Targeting - Exclude': '80001',
    'Detailed Demo Targeting - Include': '80001',
    'Detailed Demo Targeting - Exclude': '80001',
  };
  const download = gpDownload(fields);
  const formalItems = api.buildYoutubeAudienceComparisonItems(emptyAudience(), download);
  const allItems = api.appendDownloadOnlyItems('GP', download, formalItems);
  assert.equal(allItems.filter(item => item.isAutoAdded && Object.hasOwn(fields, item.rawFieldName)).length, 0);
});

test('Audience 10: GP 行に Sheet reference がない場合は全局 Setting Audience をコピーしない', () => {
  hydrateAffinityMaster(19);
  const audience = emptyAudience();
  audience.affinity.include = settingItems(19);
  const makeRawGp = (name, id, values) => ({
    name, id, liId: 'DLI', liName: 'LI', fields: { status: 'Active', videoAdFormat: 'Responsive' },
    rawFields: { Status: 'Active', 'Video Ad Format': 'Responsive', 'Affinity & In Market Targeting - Include': values },
    rawFieldOrder: ['Status', 'Video Ad Format', 'Affinity & In Market Targeting - Include'],
  });
  const ids = audience.affinity.include.map(item => item.criterionId);
  const setting = {
    cp: [{ name: 'CP', sourceSheet: '運用者用', fields: {} }],
    io: [{ name: 'IO', cpName: 'CP', sourceSheet: '運用者用', fields: {} }],
    li: [{ name: 'LI', ioName: 'IO', sourceSheet: '運用者用', fields: {} }],
    gp: [
      { name: 'YTN', liName: 'LI', ioName: 'IO', sourceSheet: '運用者用', fields: {} },
      { name: 'VVC', liName: 'LI', ioName: 'IO', sourceSheet: '運用者用', fields: {} },
    ],
    cr: [], audience,
  };
  const download = {
    cp: [{ name: 'CP', id: 'DCP', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    io: [{ name: 'IO', id: 'DIO', cpId: 'DCP', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    li: [{ name: 'LI', id: 'DLI', ioId: 'DIO', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    gp: [makeRawGp('YTN', 'YTN1', ids.join('; ')), makeRawGp('VVC', 'VVC1', ids[0])], cr: [],
  };
  const tree = api.buildComparisonTree(setting, download);
  const gpNodes = [];
  const visit = node => { if (node.level === 'GP' && !node.fromSdf) gpNodes.push(node); (node.children || []).forEach(visit); };
  tree.roots.forEach(visit);
  assert.equal(gpNodes.length, 2);
  const comparisons = Object.fromEntries(gpNodes.map(node => [node.name, node.compItems.find(item => item.label === 'Affinity 配信')]));
  assert.equal(comparisons.YTN.metrics.settingCount, 0);
  assert.equal(comparisons.YTN.result, 'mismatch');
  assert.equal(comparisons.YTN.metrics.extraCount, 19);
  assert.equal(comparisons.VVC.metrics.settingCount, 0);
  assert.equal(comparisons.VVC.result, 'mismatch');
  assert.equal(comparisons.VVC.metrics.extraCount, 1);
});

test('Audience 11: GP core columns に三類 × 配信/除外の六列が登録される', () => {
  const keys = api.getCoreLevelColumns('GP', true).map(column => column.key);
  assert.deepEqual(Array.from(keys.filter(key => /^(Affinity|Life Event|Detailed Demo)/.test(key))), [
    'Affinity 配信', 'Affinity 除外', 'Life Event 配信', 'Life Event 除外', 'Detailed Demo 配信', 'Detailed Demo 除外',
  ]);
});

test('Audience alias 1: 93040 confirmed 日文 path は AFFINITY criterion ID に exact resolve する', () => {
  hydrate010ConfirmedAliases();
  const result = api.resolveYoutubeAudienceSettingItem({ name: confirmedAliases[0].ja_path }, 'affinity');
  assert.equal(result.status, 'resolved');
  assert.equal(result.id, '93040');
  assert.equal(result.resolutionSource, 'confirmed-ja-alias');
});

test('Audience alias 2: 80546 confirmed 日文 path は IN_MARKET criterion ID に exact resolve する', () => {
  hydrate010ConfirmedAliases();
  const result = api.resolveYoutubeAudienceSettingItem({ name: confirmedAliases[1].ja_path }, 'affinity');
  assert.equal(result.status, 'resolved');
  assert.equal(result.id, '80546');
  assert.equal(result.officialName, 'Beauty & Personal Care');
});

test('Audience alias 3: 80285 confirmed 日文 path は IN_MARKET criterion ID に exact resolve する', () => {
  hydrate010ConfirmedAliases();
  const result = api.resolveYoutubeAudienceSettingItem({ name: confirmedAliases[2].ja_path }, 'affinity');
  assert.equal(result.status, 'resolved');
  assert.equal(result.id, '80285');
  assert.equal(result.officialName, 'Cosmetology Education & Training');
});

test('Audience alias 4: 010 三条 Setting 与顺序不同的 SDF ID Set 比较为 OK', () => {
  hydrate010ConfirmedAliases();
  const audience = emptyAudience();
  audience.affinity.include = setting010Items();
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': '80285; 80546; 93040',
  }), 'affinity', 'include');
  assert.equal(item.result, 'ok', item.mpDetail);
  assert.deepEqual(Array.from(item.resolvedIds).sort(), ['80285', '80546', '93040']);
  assert.match(item.sVal, /美容、健康 \(93040\)/);
  assert.match(item.dVal, /Beauty & Wellness \(93040\)/);
});

test('Audience alias 4b: confirmed 解決済みの 010 項目は warning source を残さない', () => {
  hydrate010ConfirmedAliases();
  const audience = emptyAudience();
  audience.affinity.include = setting010Items();
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': '80285; 80546; 93040',
  }), 'affinity', 'include');
  assert.equal(item.result, 'ok');
  assert.deepEqual(Array.from(item.unresolvedNames), []);
  assert.deepEqual(Array.from(item.warningNames), []);
  assert.equal(item.mpDetail, '');
});

test('Audience alias 5: confirmed 以外の Alias は自動消費せず warning を維持する', () => {
  hydrate010AudienceMaster();
  assert.equal(api.hydrateYoutubeAudienceAliasMaster([{ ...confirmedAliases[0], mapping_status: 'candidate' }]), 0);
  const audience = emptyAudience();
  audience.affinity.include = [{ name: confirmedAliases[0].ja_path, visible: true, bucket: 'include' }];
  const item = api.compareYoutubeAudienceBucket(audience, gpDownload({
    'Affinity & In Market Targeting - Include': '93040',
  }), 'affinity', 'include');
  assert.equal(item.result, 'warning');
  assert.equal(item.metrics.unresolvedCount, 1);
  assert.deepEqual(Array.from(item.unresolvedNames), [confirmedAliases[0].ja_path]);
  assert.deepEqual(Array.from(item.warningNames), [confirmedAliases[0].ja_path]);
  assert.match(item.mpDetail, /名称の公式ID対応を確認できないため要確認/);
});

test('Audience alias 6: 同じ confirmed Alias Set を参照する二つの GP は各自の SDF と個別に OK 表示できる', () => {
  hydrate010ConfirmedAliases();
  const audience = emptyAudience();
  audience.affinity.include = setting010Items();
  for (const gpName of ['インバス', 'アウトバス']) {
    const item = api.compareYoutubeAudienceBucket(audience, {
      ...gpDownload({ 'Affinity & In Market Targeting - Include': '80285; 80546; 93040' }),
      name: gpName,
    }, 'affinity', 'include');
    assert.equal(item.result, 'ok', `${gpName}: ${item.mpDetail}`);
    assert.ok(item.sVal);
    assert.ok(item.dVal);
    assert.equal(item.hiddenWhenOk, undefined);
  }
});

test('Audience alias 7: confirmed 比較後も raw Audience download-only 列を重複表示しない', () => {
  hydrate010ConfirmedAliases();
  const audience = emptyAudience();
  audience.affinity.include = setting010Items();
  const download = gpDownload({ 'Affinity & In Market Targeting - Include': '80285; 80546; 93040' });
  const formalItems = api.buildYoutubeAudienceComparisonItems(audience, download);
  const allItems = api.appendDownloadOnlyItems('GP', download, formalItems);
  assert.equal(allItems.filter(item => item.rawFieldName === 'Affinity & In Market Targeting - Include').length, 0);
});

test('010 runtime cleanup: Affinity 配信が OK の場合は debug を残さず通常表示する', () => {
  hydrate010ConfirmedAliases();
  const audience = emptyAudience();
  audience.affinity.include = setting010Items();
  const items = api.compareGP({ name: 'VID_60s-縦-18～34歳女性×美容マス層 インバス', fields: {} }, {
    ...gpDownload({ 'Affinity & In Market Targeting - Include': '80285; 80546; 93040' }),
    name: 'VID_60s-縦-18～34歳女性×美容マス層 インバス',
  }, audience);
  const affinity = items.find(item => item.label === 'Affinity 配信');
  assert.equal(affinity.result, 'ok');
  assert.equal(affinity.runtimeAudienceDebug, undefined);
  assert.equal(affinity.alwaysDisplay, undefined);
  assert.equal(affinity.hiddenWhenOk, undefined);
  assert.ok(affinity.sVal);
  assert.ok(affinity.dVal);
  assert.equal(affinity.mpDetail, '');
});
