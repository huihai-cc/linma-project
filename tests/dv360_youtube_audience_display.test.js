'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createElement(initialValue = '') {
  const table = { querySelectorAll() { return []; }, style: { setProperty() {} } };
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '', innerText: '',
    querySelector() { return table; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadApi() {
  const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script exists');
  const exportBlock = `
window.__audienceDisplayApi = {
  stripComparisonDisplayPrefix: typeof stripComparisonDisplayPrefix === 'function' ? stripComparisonDisplayPrefix : undefined,
  shouldDisplayYoutubeAudienceItem: typeof shouldDisplayYoutubeAudienceItem === 'function' ? shouldDisplayYoutubeAudienceItem : undefined,
  filterVisibleComparisonItems,
  getLevelColumns,
  renderIssueSummary,
  renderLevelTable,
  compareYoutubeAudienceBucket,
  hydrateAudienceTargetMaster,
  hydrateYoutubeAudienceAliasMaster,
  resolveYoutubeAudienceSettingItem,
  setMediaType(value) { mediaType = value; },
  setTree(roots) { treeRoots = roots; allComparisonData = { roots, dlOnly: [], counts: {} }; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(), documentElement: createElement(),
    createElement() { return createElement(); }, addEventListener() {}, removeEventListener() {},
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
  const api = sandbox.__audienceDisplayApi;
  api.setMediaType('youtube');
  return { api, elements };
}

function hydrateAudience(api) {
  api.hydrateAudienceTargetMaster([
    ['93040', 'affinity', 'Category', '', 'Beauty & Wellness', 'AFFINITY', 'https://developers.google.com/google-ads/api/data/tables/affinity-categories.csv', '2026-08-10'],
    ['80546', 'in_market', 'Category', '', 'Beauty & Personal Care', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-10'],
    ['80285', 'in_market', 'Category', '', 'Cosmetology Education & Training', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-10'],
    ['80001', 'in_market', 'Category', '', 'Extra Audience', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-10'],
  ]);
  api.hydrateYoutubeAudienceAliasMaster([
    {
      audience_id: '93040', audience_type: 'AFFINITY', ja_name: '美容、健康',
      ja_path: 'アフィニティ カテゴリ/美容、健康', en_name: 'Beauty & Wellness',
      mapping_status: 'confirmed', source: 'manual-confirmed', evidence_case: '010 MEMEME', confirmed_by: 'manual',
    },
    {
      audience_id: '80285', audience_type: 'IN_MARKET', ja_name: '美容、コスメ',
      ja_path: '購買意向の強いオーディエンス/教育/大学、短期大学/美容、コスメ', en_name: 'Cosmetology Education & Training',
      mapping_status: 'confirmed', source: 'manual-confirmed', evidence_case: '010 MEMEME', confirmed_by: 'manual',
    },
    {
      audience_id: '80546', audience_type: 'IN_MARKET', ja_name: '美容、パーソナルケア',
      ja_path: '購買意向の強いオーディエンス/美容、パーソナルケア', en_name: 'Beauty & Personal Care',
      mapping_status: 'confirmed', source: 'manual-confirmed', evidence_case: '010 MEMEME', confirmed_by: 'manual',
    },
  ]);
}

function emptyAudience() {
  return {
    affinity: { include: [], exclude: [] },
    lifeEvent: { include: [], exclude: [] },
    detailedDemo: { include: [], exclude: [] },
  };
}

function settingAudienceItems() {
  return [
    { name: 'アフィニティ カテゴリ/美容、健康' },
    { name: '購買意向の強いオーディエンス/教育/大学、短期大学/美容、コスメ' },
    { name: '購買意向の強いオーディエンス/美容、パーソナルケア' },
  ];
}

function downloadGp(ids) {
  return { rawFields: { 'Affinity & In Market Targeting - Include': ids }, fields: {} };
}

function gpNode(name, compItems) {
  return { level: 'GP', id: name, name, found: true, compItems, children: [] };
}

function setGpNodes(api, nodes) {
  api.setTree([{ level: 'CP', id: 'CP', name: 'CP', found: true, compItems: [], children: nodes }]);
}

const displayCases = [
  ['Display-1: sVal/dVal 有値の OK は表示', { sVal: 'setting', dVal: 'download', result: 'ok' }, true],
  ['Display-2: sVal/dVal 有値の warning は表示', { sVal: 'setting', dVal: 'download', result: 'warning' }, true],
  ['Display-3: sVal/dVal 有値の mismatch は表示', { sVal: 'setting', dVal: 'download', result: 'mismatch' }, true],
  ['Display-4: sVal/dVal が双方空なら非表示', { sVal: '', dVal: '', result: 'ok' }, false],
  ['Display-5: sVal のみ有値なら表示', { sVal: 'setting', dVal: '', result: 'ok' }, true],
  ['Display-6: dVal のみ有値なら表示', { sVal: '', dVal: 'download', result: 'ok' }, true],
];

test('comparison renderer strips only the matching leading side prefix', () => {
  const { api } = loadApi();
  assert.equal(typeof api.stripComparisonDisplayPrefix, 'function');
  assert.equal(api.stripComparisonDisplayPrefix('ABC', 'S'), 'ABC');
  assert.equal(api.stripComparisonDisplayPrefix('S: ABC', 'S'), 'ABC');
  assert.equal(api.stripComparisonDisplayPrefix('S：ABC', 'S'), 'ABC');
  assert.equal(api.stripComparisonDisplayPrefix('ABC', 'D'), 'ABC');
  assert.equal(api.stripComparisonDisplayPrefix('D: ABC', 'D'), 'ABC');
  assert.equal(api.stripComparisonDisplayPrefix('D：ABC', 'D'), 'ABC');
  assert.equal(api.stripComparisonDisplayPrefix('URL https://example.test/D:value', 'D'), 'URL https://example.test/D:value');
  assert.equal(api.stripComparisonDisplayPrefix('note S: keep', 'S'), 'note S: keep');
});

test('rendered comparison cells contain exactly one S:/D: label', () => {
  const { api, elements } = loadApi();
  setGpNodes(api, [gpNode('GP-1', [{
    label: 'Affinity 配信', key: 'Affinity 配信', result: 'ok',
    sVal: 'S: Setting Audience', dVal: 'D：Download Audience',
  }])]);

  api.renderLevelTable('GP');
  const tableHtml = elements.get('result-table-wrap').innerHTML;
  assert.ok(tableHtml.includes('<span class="cell-s-label">S:</span>Setting Audience'));
  assert.ok(tableHtml.includes('<span class="cell-d-label">D:</span>Download Audience'));
  assert.equal(tableHtml.includes('<span class="cell-s-label">S:</span>S:'), false);
  assert.equal(tableHtml.includes('<span class="cell-d-label">D:</span>D:'), false);
});

for (const [name, values, expected] of displayCases) {
  test(name, () => {
    const { api } = loadApi();
    const item = { label: 'Affinity 配信', key: 'Affinity 配信', ...values };
    assert.equal(api.shouldDisplayYoutubeAudienceItem(item), expected);
    assert.equal(api.filterVisibleComparisonItems([item]).length, expected ? 1 : 0);
  });
}

test('真实 Affinity 三个完整路径全部 exact resolve，并得到一致 ID Set', () => {
  const { api } = loadApi();
  hydrateAudience(api);
  const expected = [
    ['アフィニティ カテゴリ/美容、健康', '93040'],
    ['購買意向の強いオーディエンス/教育/大学、短期大学/美容、コスメ', '80285'],
    ['購買意向の強いオーディエンス/美容、パーソナルケア', '80546'],
  ];
  for (const [name, id] of expected) {
    const resolved = api.resolveYoutubeAudienceSettingItem({ name }, 'affinity');
    assert.equal(resolved.status, 'resolved', name);
    assert.equal(resolved.id, id, name);
  }

  const audience = emptyAudience();
  audience.affinity.include = settingAudienceItems();
  const affinity = api.compareYoutubeAudienceBucket(
    audience,
    downloadGp('80546; 93040; 80285'),
    'affinity',
    'include',
  );
  assert.equal(affinity.result, 'ok');
  assert.deepEqual(Array.from(affinity.resolvedIds).sort(), ['80285', '80546', '93040']);
  assert.equal(affinity.missingIds.length, 0);
  assert.equal(affinity.extraIds.length, 0);
  assert.equal(affinity.warningNames.length, 0);
  assert.equal(affinity.mpDetail, '');
});

test('两个 GP 的 Affinity OK 最终显示一个 header、两个逻辑 cell，问题总览为零', () => {
  const { api, elements } = loadApi();
  hydrateAudience(api);
  const audience = emptyAudience();
  audience.affinity.include = settingAudienceItems();
  const affinity = api.compareYoutubeAudienceBucket(
    audience,
    downloadGp('80285; 80546; 93040'),
    'affinity',
    'include',
  );
  const gpNodes = [gpNode('GP-1', [{ ...affinity }]), gpNode('GP-2', [{ ...affinity }])];
  setGpNodes(api, gpNodes);
  assert.deepEqual(gpNodes.map(node => node.compItems[0].result), ['ok', 'ok']);
  assert.equal(gpNodes.filter(node => node.compItems.some(item => item.label === 'Affinity 配信')).length, 2);

  api.renderLevelTable('GP');
  const tableHtml = elements.get('result-table-wrap').innerHTML;
  assert.equal((tableHtml.match(/<th[^>]*data-col-key="Affinity 配信"/g) || []).length, 1);
  assert.equal((tableHtml.match(/cell-ok dv-cell-dblclick/g) || []).length >= 4, true);

  api.renderIssueSummary();
  const issueHtml = elements.get('result-issues-content').innerHTML;
  assert.equal((issueHtml.match(/Affinity 配信/g) || []).length, 0);
  assert.equal((issueHtml.match(/名称の公式ID対応を確認できないため要確認/g) || []).length, 0);
});
