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

function loadApi() {
  const htmlPath = path.join(projectRoot, 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('function parseSdfData'));
  if (!source) throw new Error(`DV360 application script not found: ${htmlPath}`);
  const exportBlock = `
window.__aliasLifecycleApi = {
  ensureYoutubeAudienceAliasReady,
  hydrateAudienceTargetMaster,
  compareYoutubeAudienceBucket,
  resetAll,
  runCheckSource: runCheck.toString(),
  getState() { return { ...youtubeAudienceAliasState }; },
  getAliasKeyCount() { return youtubeAudienceAliasByKey.size; },
  setLoader(loader) { loadYoutubeAudienceAliasRows = loader; },
  resetLifecycle() {
    youtubeAudienceAliasByKey = new Map();
    youtubeAudienceAliasLoadPromise = null;
    youtubeAudienceAliasState = { status: 'idle', count: 0, error: null };
  },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(), documentElement: createElement(), readyState: 'loading',
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
  return sandbox.__aliasLifecycleApi;
}

const officialMaster = [
  ['93040', 'affinity', 'Category', '', 'Beauty & Wellness', 'AFFINITY', 'https://developers.google.com/google-ads/api/data/tables/affinity-categories.csv', '2026-08-09'],
  ['80546', 'in_market', 'Category', '', 'Beauty & Personal Care', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
  ['80285', 'in_market', 'Category', 'Post-Secondary Education', 'Cosmetology Education & Training', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
];

const confirmedAliases = [
  { audience_id: '93040', audience_type: 'AFFINITY', ja_name: '美容、健康', ja_path: 'アフィニティ カテゴリ/美容、健康', en_name: 'Beauty & Wellness', mapping_status: 'confirmed' },
  { audience_id: '80546', audience_type: 'IN_MARKET', ja_name: '美容、パーソナルケア', ja_path: '購買意向の強いオーディエンス/美容、パーソナルケア', en_name: 'Beauty & Personal Care', mapping_status: 'confirmed' },
  { audience_id: '80285', audience_type: 'IN_MARKET', ja_name: '美容、コスメ', ja_path: '購買意向の強いオーディエンス/教育/大学、短期大学/美容、コスメ', en_name: 'Cosmetology Education & Training', mapping_status: 'confirmed' },
];

const settingAudience = {
  affinity: { include: confirmedAliases.map(alias => ({ name: alias.ja_path, jaPath: alias.ja_path })), exclude: [] },
};
const downloadRecord = {
  rawFields: { 'Affinity & In Market Targeting - Include': '80285;80546;93040' },
  fields: { audienceInclude: '80285;80546;93040' },
};

function createReadyApi(loader) {
  const api = loadApi();
  assert.equal(api.hydrateAudienceTargetMaster(officialMaster), 3);
  api.setLoader(loader || (async () => confirmedAliases));
  return api;
}

function compareAffinity(api) {
  return api.compareYoutubeAudienceBucket(settingAudience, downloadRecord, 'affinity', 'include');
}

test('Alias-1: ready 后比较时三个 Alias 全 resolved', async () => {
  const api = createReadyApi();
  await api.ensureYoutubeAudienceAliasReady();
  assert.equal(api.getState().status, 'ready');
  assert.equal(api.getState().count, 3);
  assert.equal(api.getState().error, null);
  assert.equal(compareAffinity(api).result, 'ok');
});

test('Alias-2: idle 时检查门禁自动 load/hydrate 后才允许比较', async () => {
  let loads = 0;
  const api = createReadyApi(async () => { loads += 1; return confirmedAliases; });
  assert.equal(api.getState().status, 'idle');
  await api.ensureYoutubeAudienceAliasReady();
  assert.equal(loads, 1);
  assert.equal(api.getState().status, 'ready');
  assert.equal(compareAffinity(api).result, 'ok');
  assert.match(api.runCheckSource, /await\s+ensureYoutubeAudienceAliasReady\s*\(\s*\)/);
});

test('Alias-3: loading 时并发检查复用同一次加载，ready 前不比较', async () => {
  let loads = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const api = createReadyApi(async () => { loads += 1; await gate; return confirmedAliases; });
  let comparisons = 0;
  const check = async () => { await api.ensureYoutubeAudienceAliasReady(); comparisons += 1; return compareAffinity(api); };
  const first = check();
  const second = check();
  await Promise.resolve();
  assert.equal(loads, 1);
  assert.equal(api.getState().status, 'loading');
  assert.equal(comparisons, 0);
  release();
  const results = await Promise.all([first, second]);
  assert.equal(loads, 1);
  assert.equal(comparisons, 2);
  assert.deepEqual(results.map(result => result.result), ['ok', 'ok']);
});

test('Alias-4: 第一次失败后第二次调用可 retry 成功', async () => {
  let loads = 0;
  const api = createReadyApi(async () => {
    loads += 1;
    if (loads === 1) throw new Error('temporary failure');
    return confirmedAliases;
  });
  await assert.rejects(api.ensureYoutubeAudienceAliasReady(), /Alias/);
  assert.equal(api.getState().status, 'error');
  assert.match(api.getState().error, /temporary failure/);
  await api.ensureYoutubeAudienceAliasReady();
  assert.equal(loads, 2);
  assert.equal(api.getState().status, 'ready');
  assert.equal(compareAffinity(api).result, 'ok');
});

test('Alias-5: 连续失败保持系统初始化错误，不产生 Affinity warning', async () => {
  let loads = 0;
  const api = createReadyApi(async () => { loads += 1; throw new Error(`failure-${loads}`); });
  await assert.rejects(api.ensureYoutubeAudienceAliasReady(), /YouTube Audience Alias マスタ/);
  await assert.rejects(api.ensureYoutubeAudienceAliasReady(), /YouTube Audience Alias マスタ/);
  assert.equal(loads, 2);
  assert.equal(api.getState().status, 'error');
  assert.equal(api.getAliasKeyCount(), 0);
});

test('Alias-6: resetAll 后静态 Alias 仍保持 ready', async () => {
  const api = createReadyApi();
  await api.ensureYoutubeAudienceAliasReady();
  api.resetAll();
  assert.equal(api.getState().status, 'ready');
  assert.equal(api.getState().count, 3);
  assert.equal(api.getState().error, null);
  assert.equal(api.getAliasKeyCount(), 3);
  assert.equal(compareAffinity(api).result, 'ok');
});

test('Alias-7: 同一案件连续两次均 resolvedIds=3、warningNames=0、result=ok', async () => {
  const api = createReadyApi();
  await api.ensureYoutubeAudienceAliasReady();
  for (let run = 0; run < 2; run += 1) {
    const result = compareAffinity(api);
    assert.equal(api.getAliasKeyCount(), 3);
    assert.equal(result.resolvedIds.length, 3);
    assert.equal(result.warningNames.length, 0);
    assert.equal(result.result, 'ok');
  }
});
