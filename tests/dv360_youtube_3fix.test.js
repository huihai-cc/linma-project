// 2026-08-09 実案件3課題（011-selected）の専用テスト
// ① Geography canonical: 日文都道府県短縮名（東京/神奈川/…）↔ DV360 Code（20636 等）を Code で同一視
// ② 双空非表示: item レベル（filterVisibleComparisonItems）+ 列レベル（getLevelColumns）+ alwaysDisplay 例外
// ③ GP 親LIスコープ: liId 一致のみ許可・跨LI/global fallback 禁止・親LI不明 warning・SDF由来
// 使い方: node --test tests/dv360_youtube_3fix.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const JSZip = require('../jszip.min.js');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const case011Root = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube\\011\\011-selected';

// ── ページ読み込み（vm sandbox + export block） ──
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
window.__dv360TestApi = {
  parseYoutubeSetting,
  parseSdfData,
  buildComparisonTree,
  setMediaType(value) { mediaType = value; },
  setSelectedDv360CaseType,
  ensureGeoMasterLoaded,
  canonicalGeoName,
  resolveGeoCanonicalId,
  compareGeography,
  parseSettingGeography,
  parseDownloadGeography,
  geoSet,
  geoSetDifference,
  isVisuallyEmptyComparisonValue,
  shouldDisplayComparisonItem,
  filterVisibleComparisonItems,
  getCoreLevelColumns,
  getLevelColumns,
  collectLevelItems,
  setTreeRoots(roots) { treeRoots = roots; },
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
  return sandbox.__dv360TestApi;
}

let apiPromise = null;
function getApi() {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = loadDv360Api();
      api.setMediaType('youtube');
      await api.ensureGeoMasterLoaded();
      return api;
    })();
  }
  return apiPromise;
}

// ── 実案件（011-selected）読み込みヘルパー ──
function decodeCsv(buffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('shift_jis').decode(buffer); }
}

function parseCsvRows(buffer) {
  const workbook = XLSX.read(decodeCsv(buffer), { type: 'string' });
  if (!workbook.SheetNames.length) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false });
}

function parseSettingWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  }
  return { sheets, sheetNames: workbook.SheetNames };
}

async function collectCsvEntries(zipBuffer) {
  const results = [];
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (entryName.toLowerCase().endsWith('.csv')) {
      results.push({ name: path.basename(entryName), rows: parseCsvRows(await entry.async('uint8array')), path: entryName });
    } else if (entryName.toLowerCase().endsWith('.zip')) {
      results.push(...await collectCsvEntries(await entry.async('uint8array')));
    }
  }
  return results;
}

function flattenTree(roots) {
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.children || []) visit(child); };
  for (const root of roots || []) visit(root);
  return nodes;
}

// ── テスト用ツリー構築 ──
function makeSettingLi(name, fields = {}) { return { name, ioName: 'IO1', fields }; }
function makeDownloadLi(name, id, fields = {}) {
  return { name, id, ioId: 'DIO1', fields, rawFields: {}, rawFieldOrder: [] };
}
function makeSettingGp(name, liName) { return { name, liName, ioName: 'IO1', fields: {} }; }
function makeDownloadGp(name, id, liId) {
  return { name, id, liId, liName: '', fields: {}, rawFields: {}, rawFieldOrder: [] };
}
function baseSetting(lis = [], gps = []) {
  return { cp: [{ name: 'CP1', fields: {} }], io: [{ name: 'IO1', cpName: 'CP1', fields: {} }], li: lis, gp: gps, cr: [] };
}
function baseDownload(lis = [], gps = []) {
  return {
    cp: [{ name: 'CP1', id: 'DCP1', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    io: [{ name: 'IO1', id: 'DIO1', cpId: 'DCP1', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    li: lis, gp: gps, cr: [],
  };
}
async function buildTree(api, setting, download) {
  api.setSelectedDv360CaseType('initial');
  const comparison = api.buildComparisonTree(setting, download);
  api.setTreeRoots(comparison.roots);
  return comparison;
}
function gpNodesUnder(roots, liName) {
  const li = flattenTree(roots).find(n => n.level === 'LI' && n.name === liName);
  return li ? (li.children || []).filter(n => n.level === 'GP') : [];
}
function sdfGpNames(roots) {
  return flattenTree(roots).filter(n => n.level === 'GP' && n.fromSdf).map(n => n.name);
}

// ══════════════════════════════════════════════════════════════════
// ① Geography canonical（7 項）
// ══════════════════════════════════════════════════════════════════

test('Geo-1: 東京 (日文短縮) ↔ Tokyo Code 20636 → ok（誤判定の再発防止）', async () => {
  const api = await getApi();
  assert.equal(api.canonicalGeoName('東京'), '20636');
  const result = api.compareGeography('東京', 'Tokyo, Japan (Code: 20636)', '');
  assert.equal(result.result, 'ok', result.detail);
  assert.equal(JSON.stringify(result.includeMissing), '[]');
  assert.equal(JSON.stringify(result.includeExtra), '[]');
});

test('Geo-2: 神奈川 ↔ Kanagawa Code 20637 → ok', async () => {
  const api = await getApi();
  assert.equal(api.canonicalGeoName('神奈川'), '20637');
  const result = api.compareGeography('神奈川', 'Kanagawa, Japan (Code: 20637)', '');
  assert.equal(result.result, 'ok', result.detail);
});

test('Geo-3: 埼玉 ↔ Saitama Code 20634 → ok', async () => {
  const api = await getApi();
  assert.equal(api.canonicalGeoName('埼玉'), '20634');
  const result = api.compareGeography('埼玉', 'Saitama, Japan (Code: 20634)', '');
  assert.equal(result.result, 'ok', result.detail);
});

test('Geo-4: 8都府県（日文）↔ Code 集合（逆順）→ ok', async () => {
  const api = await getApi();
  const names = ['東京', '神奈川', '埼玉', '千葉', '愛知', '大阪', '京都', '兵庫'];
  const codes = names.map(n => api.canonicalGeoName(n));
  assert.ok(codes.every(Boolean), `8都府県すべて Code 解決: ${JSON.stringify(codes)}`);
  const result = api.compareGeography(names.join('、'), [...codes].reverse().join('; '), '');
  assert.equal(result.result, 'ok', result.detail);
  assert.equal(JSON.stringify(result.includeMissing), '[]');
  assert.equal(JSON.stringify(result.includeExtra), '[]');
});

test('Geo-5: Download に Japan(2392) が余分 → mismatch + 配信追加：Japan（Case B を無視しない）', async () => {
  const api = await getApi();
  const result = api.compareGeography('東京、神奈川', '20636; 20637; 2392', '');
  assert.equal(result.result, 'mismatch');
  assert.equal(JSON.stringify(result.includeMissing), '[]');
  assert.equal(JSON.stringify(result.includeExtra), '["Japan"]');
  assert.match(result.detail, /配信追加：Japan/);
});

test('Geo-6: 埼玉が不足 → mismatch + 配信不足：埼玉', async () => {
  const api = await getApi();
  const result = api.compareGeography('東京、神奈川、埼玉', '20636; 20637', '');
  assert.equal(result.result, 'mismatch');
  assert.equal(JSON.stringify(result.includeMissing), '["埼玉"]');
  assert.match(result.detail, /配信不足：埼玉/);
});

test('Geo-7: 都/府/県 付き正式名 ↔ 短縮名 → 同一 Code', async () => {
  const api = await getApi();
  for (const [short, formal] of [
    ['東京', '東京都'], ['埼玉', '埼玉県'], ['千葉', '千葉県'], ['神奈川', '神奈川県'],
    ['愛知', '愛知県'], ['大阪', '大阪府'], ['京都', '京都府'], ['兵庫', '兵庫県'],
  ]) {
    assert.ok(api.canonicalGeoName(short), `${short} が解決される`);
    assert.equal(api.canonicalGeoName(formal), api.canonicalGeoName(short), `${formal} ↔ ${short}`);
  }
});

// ══════════════════════════════════════════════════════════════════
// ② 双空非表示（7 項）
// ══════════════════════════════════════════════════════════════════

test('Empty-1: S/D とも空（null/undefined/空白）→ 非表示', async () => {
  const api = await getApi();
  assert.equal(api.isVisuallyEmptyComparisonValue(null), true);
  assert.equal(api.isVisuallyEmptyComparisonValue(undefined), true);
  assert.equal(api.isVisuallyEmptyComparisonValue(''), true);
  assert.equal(api.isVisuallyEmptyComparisonValue('   '), true);
  assert.equal(api.shouldDisplayComparisonItem({ label: 'X', sVal: '', dVal: '' }), false);
  assert.deepEqual(api.filterVisibleComparisonItems([{ label: 'X', sVal: '', dVal: '', result: 'ok' }]), []);
});

test('Empty-2: (設定表なし)/(空欄)/空白/(空)/—/- → 非表示', async () => {
  const api = await getApi();
  for (const v of ['(設定表なし)', '(空欄)', '(空)', '空白', '—', '-']) {
    assert.equal(api.isVisuallyEmptyComparisonValue(v), true, `isVisuallyEmpty('${v}')`);
  }
  assert.deepEqual(api.filterVisibleComparisonItems([{ label: 'X', sVal: '(設定表なし)', dVal: '(空欄)' }]), []);
});

test('Empty-3: 0 / 0 → 表示（0 は有意味値）', async () => {
  const api = await getApi();
  assert.equal(api.isVisuallyEmptyComparisonValue('0'), false);
  assert.equal(api.shouldDisplayComparisonItem({ label: 'X', sVal: '0', dVal: '0' }), true);
  assert.equal(api.filterVisibleComparisonItems([{ label: 'X', sVal: '0', dVal: '0' }]).length, 1);
});

test('Empty-4: False / False → 表示（有意味値）', async () => {
  const api = await getApi();
  assert.equal(api.isVisuallyEmptyComparisonValue('False'), false);
  assert.equal(api.isVisuallyEmptyComparisonValue('OFF'), false);
  assert.equal(api.shouldDisplayComparisonItem({ label: 'X', sVal: 'False', dVal: 'False' }), true);
  assert.equal(api.filterVisibleComparisonItems([{ label: 'X', sVal: 'False', dVal: '' }]).length, 1);
});

test('Empty-5: alwaysDisplay 例外（ステータス等）→ 双方空でも表示', async () => {
  const api = await getApi();
  assert.equal(api.shouldDisplayComparisonItem({ label: 'ステータス', sVal: '', dVal: '', alwaysDisplay: true }), true);
  const kept = api.filterVisibleComparisonItems([
    { label: 'ステータス', sVal: '', dVal: '', alwaysDisplay: true },
    { label: '予算', sVal: '', dVal: '' },
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].label, 'ステータス');
});

test('Empty-6: 全 LI が双方空の列 → 列頭ごと非表示（予算/性別 など）', async () => {
  const api = await getApi();
  const setting = baseSetting([makeSettingLi('LI-A'), makeSettingLi('LI-B')]);
  const download = baseDownload([makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')]);
  await buildTree(api, setting, download);
  const keys = api.getLevelColumns('LI').map(c => c.key);
  assert.ok(!keys.includes('予算'), `予算 非表示: ${keys.join(', ')}`);
  assert.ok(!keys.includes('日予算 / Pacing Amount'), '日予算 非表示');
  assert.ok(!keys.includes('性別'), '性別 非表示');
  assert.ok(!keys.includes('世帯年収'), '世帯年収 非表示');
  assert.ok(keys.includes('ステータス'), 'ステータス 表示（alwaysDisplay）');
  assert.ok(keys.includes('raw_sdf__status'), 'raw_sdf__status 表示（alwaysDisplay）');
});

test('Empty-7: 1 つでも有効な S または D がある LI が居れば列頭は表示', async () => {
  const api = await getApi();
  const setting = baseSetting([
    makeSettingLi('LI-A', { budgetNet: '1000000' }),
    makeSettingLi('LI-B'),
  ]);
  const download = baseDownload([makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')]);
  await buildTree(api, setting, download);
  const keys = api.getLevelColumns('LI').map(c => c.key);
  assert.ok(keys.includes('予算'), `予算 表示: ${keys.join(', ')}`);
});

// ══════════════════════════════════════════════════════════════════
// ③ GP 親LIスコープ（8 項）
// ══════════════════════════════════════════════════════════════════

test('GP-1: 同名 GP-X が 2 LI に存在 → 各々正しい親LI配下でマッチ', async () => {
  const api = await getApi();
  const setting = baseSetting(
    [makeSettingLi('LI-A'), makeSettingLi('LI-B')],
    [makeSettingGp('GP-X', 'LI-A'), makeSettingGp('GP-X', 'LI-B')],
  );
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')],
    [makeDownloadGp('GP-X', 'g1', '31'), makeDownloadGp('GP-X', 'g2', '32')],
  );
  const comparison = await buildTree(api, setting, download);
  const gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  const gpB = gpNodesUnder(comparison.roots, 'LI-B').find(n => n.name === 'GP-X');
  assert.ok(gpA && gpA.found && gpA.matchedName === 'GP-X', `LI-A GP-X: ${JSON.stringify(gpA && { found: gpA.found, matchedName: gpA.matchedName })}`);
  assert.ok(gpB && gpB.found && gpB.matchedName === 'GP-X', `LI-B GP-X: ${JSON.stringify(gpB && { found: gpB.found, matchedName: gpB.matchedName })}`);
  assert.deepEqual(sdfGpNames(comparison.roots), [], '両方マッチ → 誤った SDF由来 GP なし');
});

test('GP-2: liId が親LI ID と一致する GP のみマッチ（一致→マッチ / 不一致→notfound）', async () => {
  const api = await getApi();
  const setting = baseSetting(
    [makeSettingLi('LI-A')],
    [makeSettingGp('GP-X', 'LI-A'), makeSettingGp('GP-Y', 'LI-A')],
  );
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31')],
    [makeDownloadGp('GP-X', 'g1', '31'), makeDownloadGp('GP-Y', 'g2', '999')],
  );
  const comparison = await buildTree(api, setting, download);
  const underA = gpNodesUnder(comparison.roots, 'LI-A');
  const gpX = underA.find(n => n.name === 'GP-X');
  const gpY = underA.find(n => n.name === 'GP-Y');
  assert.ok(gpX && gpX.found && gpX.matchedName === 'GP-X', 'liId 一致 → マッチ');
  assert.equal(gpY.found, false, 'liId 不一致 → 未マッチ');
  assert.equal(gpY.status, 'notfound');
  assert.deepEqual(sdfGpNames(comparison.roots), ['GP-Y'], '親LI不一致の GP-Y は SDF 由来に残る');
});

test('GP-3: 同名 GP でも属する LI が違う → マッチしない（跨LI 禁止）', async () => {
  const api = await getApi();
  const setting = baseSetting([makeSettingLi('LI-A')], [makeSettingGp('GP-X', 'LI-A')]);
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')],
    [makeDownloadGp('GP-X', 'g2', '32')], // GP-X は LI-B 所属のみ
  );
  const comparison = await buildTree(api, setting, download);
  const gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  assert.equal(gpA.found, false, 'LI-A の GP-X は LI-B の GP とマッチしない');
  assert.equal(gpA.status, 'notfound');
  assert.deepEqual(sdfGpNames(comparison.roots), ['GP-X'], 'LI-B 所属の GP-X は SDF 由来として表示');
});

test('GP-4: 親LI はマッチ済みだが対象 GP が存在しない → notfound', async () => {
  const api = await getApi();
  const setting = baseSetting([makeSettingLi('LI-A')], [makeSettingGp('GP-X', 'LI-A')]);
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31')],
    [makeDownloadGp('GP-OTHER', 'g9', '31')],
  );
  const comparison = await buildTree(api, setting, download);
  const gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  assert.equal(gpA.found, false);
  assert.equal(gpA.status, 'notfound');
  assert.deepEqual(sdfGpNames(comparison.roots), ['GP-OTHER']);
});

test('GP-5: global fallback 禁止 — 親LI一致時は他LI を検索せず / 親LI不明時も candidate のみ（消費しない）', async () => {
  const api = await getApi();
  // 5a: 親LI一致 → 他LI 配下の同名 GP を global に拾わない
  let setting = baseSetting([makeSettingLi('LI-A')], [makeSettingGp('GP-X', 'LI-A')]);
  let download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')],
    [makeDownloadGp('GP-X', 'g2', '32')],
  );
  let comparison = await buildTree(api, setting, download);
  let gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  assert.equal(gpA.found, false, '親LI一致時は跨LI fallback しない');
  assert.ok(!gpA.candidate, 'candidate にもしない');

  // 5b: 親LIが Download に無い → 診断用 candidate としてのみ（matchedDGP を消費しない → SDF由来に残る）
  setting = baseSetting([makeSettingLi('LI-A')], [makeSettingGp('GP-X', 'LI-A')]);
  download = baseDownload([makeDownloadLi('LI-B', '32')], [makeDownloadGp('GP-X', 'g2', '32')]);
  comparison = await buildTree(api, setting, download);
  gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  assert.equal(gpA.candidate, true, '親LI不明 → candidate 診断表示');
  assert.equal(gpA.status, 'warning');
  assert.deepEqual(sdfGpNames(comparison.roots), ['GP-X'], 'candidate は消費しない → SDF 側も SDF 由来に残る');
});

test('GP-6: 設定GP の親LIが設定表から特定できない → warning「親LI特定」', async () => {
  const api = await getApi();
  const setting = baseSetting([makeSettingLi('LI-A')], [makeSettingGp('GP-ORPHAN', 'NO_SUCH_LI')]);
  const download = baseDownload([makeDownloadLi('LI-A', '31')], [makeDownloadGp('GP-OTHER', 'g9', '31')]);
  const comparison = await buildTree(api, setting, download);
  const orphan = flattenTree(comparison.roots).find(n => n.level === 'GP' && n.name === 'GP-ORPHAN');
  assert.ok(orphan, 'unparented GP ノードが生成される');
  assert.equal(orphan.found, true, '設定表側に存在 → notfound にしない');
  assert.equal(orphan.fromSetting, true);
  const item = (orphan.compItems || [])[0];
  assert.equal(item.label, '親LI特定');
  assert.equal(item.result, 'warning');
  assert.equal(item.detail, 'GPの親LIを設定表から特定できません');
  assert.equal(orphan.status, 'warning');
  assert.deepEqual(sdfGpNames(comparison.roots), ['GP-OTHER']);
});

test('GP-7: 正常系 — 2 GP とも正しく消費 → 誤った SDF由来 GP は出ない', async () => {
  const api = await getApi();
  const setting = baseSetting(
    [makeSettingLi('LI-A'), makeSettingLi('LI-B')],
    [makeSettingGp('GP-X', 'LI-A'), makeSettingGp('GP-Y', 'LI-B')],
  );
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')],
    [makeDownloadGp('GP-X', 'g1', '31'), makeDownloadGp('GP-Y', 'g2', '32')],
  );
  const comparison = await buildTree(api, setting, download);
  const gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  const gpB = gpNodesUnder(comparison.roots, 'LI-B').find(n => n.name === 'GP-Y');
  assert.ok(gpA && gpA.found && gpA.matchedName === 'GP-X');
  assert.ok(gpB && gpB.found && gpB.matchedName === 'GP-Y');
  assert.deepEqual(sdfGpNames(comparison.roots), [], `SDF由来 GP: ${JSON.stringify(sdfGpNames(comparison.roots))}`);
});

test('GP-8: 設定表に無い真の余剰 GP のみ SDF 由来として表示', async () => {
  const api = await getApi();
  const setting = baseSetting([makeSettingLi('LI-A')], [makeSettingGp('GP-X', 'LI-A')]);
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')],
    [makeDownloadGp('GP-X', 'g1', '31'), makeDownloadGp('GP-Z', 'g3', '32')],
  );
  const comparison = await buildTree(api, setting, download);
  const gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  assert.ok(gpA && gpA.found && gpA.matchedName === 'GP-X', 'GP-X はマッチ済み');
  assert.deepEqual(sdfGpNames(comparison.roots), ['GP-Z'], '余剰 GP-Z のみ SDF 由来');
});

test('GP-9: 一つの Setting GP definition を参照する二つの LI が各自の Download GP を消費する', async () => {
  const api = await getApi();
  const sharedDefinition = {
    name: 'GP-X', fields: {}, sourceSheet: 'operator-sheet', sourceRow: 25,
    references: [
      { ioName: 'IO1', liName: 'LI-A', sourceSheet: 'operator-sheet', sourceRow: 25, fields: {} },
      { ioName: 'IO1', liName: 'LI-B', sourceSheet: 'operator-sheet', sourceRow: 26, fields: {} },
    ],
  };
  const setting = baseSetting(
    [makeSettingLi('LI-A'), makeSettingLi('LI-B')],
    [sharedDefinition],
  );
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32')],
    [makeDownloadGp('GP-X', 'g1', '31'), makeDownloadGp('GP-X', 'g2', '32')],
  );
  const comparison = await buildTree(api, setting, download);
  const gpA = gpNodesUnder(comparison.roots, 'LI-A').find(n => n.name === 'GP-X');
  const gpB = gpNodesUnder(comparison.roots, 'LI-B').find(n => n.name === 'GP-X');
  assert.equal(gpA && gpA.matchedId, 'g1');
  assert.equal(gpB && gpB.matchedId, 'g2');
  assert.deepEqual(sdfGpNames(comparison.roots), []);
  assert.equal(setting.gp.length, 1, 'Setting definition 自体は一份のまま再利用する');
});

test('GP-10: reference の無い第三 LI の同名 Download GP は SDF 由来のまま残す', async () => {
  const api = await getApi();
  const sharedDefinition = {
    name: 'GP-X', fields: {},
    references: [
      { ioName: 'IO1', liName: 'LI-A', fields: {} },
      { ioName: 'IO1', liName: 'LI-B', fields: {} },
    ],
  };
  const setting = baseSetting(
    [makeSettingLi('LI-A'), makeSettingLi('LI-B'), makeSettingLi('LI-C')],
    [sharedDefinition],
  );
  const download = baseDownload(
    [makeDownloadLi('LI-A', '31'), makeDownloadLi('LI-B', '32'), makeDownloadLi('LI-C', '33')],
    [
      makeDownloadGp('GP-X', 'g1', '31'),
      makeDownloadGp('GP-X', 'g2', '32'),
      makeDownloadGp('GP-X', 'g3', '33'),
    ],
  );
  const comparison = await buildTree(api, setting, download);
  assert.equal(gpNodesUnder(comparison.roots, 'LI-A')[0].matchedId, 'g1');
  assert.equal(gpNodesUnder(comparison.roots, 'LI-B')[0].matchedId, 'g2');
  assert.equal(gpNodesUnder(comparison.roots, 'LI-C').length, 0, 'reference 無しでは Setting GP を挂载しない');
  const sdfGps = flattenTree(comparison.roots).filter(n => n.level === 'GP' && n.fromSdf);
  assert.equal(sdfGps.length, 1);
  assert.match(sdfGps[0].id, /g3$/);
});

// ══════════════════════════════════════════════════════════════════
// 実案件 011-selected 総合リグレッション
// ══════════════════════════════════════════════════════════════════

test('実案件011: VVC Geography ok / YTN mismatch(Japan 追加) / GP マッチ + SDF由来 / 双空列非表示', async (t) => {
  if (!fs.existsSync(case011Root)) { t.skip(`caseDir not found: ${case011Root}`); return; }
  const api = await getApi();

  const settingPath = fs.readdirSync(case011Root).find(f => /\.xlsx$/i.test(f) && !f.startsWith('~$'));
  const zipPath = fs.readdirSync(case011Root).find(f => /\.zip$/i.test(f));
  assert.ok(settingPath && zipPath, 'xlsx と zip が存在する');

  const workbook = parseSettingWorkbook(path.join(case011Root, settingPath));
  const parsed = api.parseYoutubeSetting(workbook.sheets, workbook.sheetNames, settingPath);
  const csvFiles = await collectCsvEntries(fs.readFileSync(path.join(case011Root, zipPath)));
  const dl = api.parseSdfData(csvFiles);

  // 運用者用 sheet では同一 GP definition が YTN/VVC の二つの LI から参照される。
  assert.equal(parsed.gpList.length, 1, `Setting GP definition 数=1: ${parsed.gpList.map(g => g.name)}`);
  const sharedGp = parsed.gpList[0];
  assert.equal(sharedGp.name, 'VID_15s-横-MF25ｰ64歳×BP×エリア');
  assert.deepEqual(Array.from(sharedGp.references || [], ref => ref.liName), [
    'DMG_ALL_AL_A01(MF25ｰ64歳×BP×エリア)-YTN',
    'DMG_ALL_AL_A01(MF25ｰ64歳×BP×エリア)-VVC',
  ]);
  assert.deepEqual(Array.from(sharedGp.references || [], ref => ref.sourceRow), [25, 26]);
  assert.ok((sharedGp.references || []).every(ref => ref.sourceSheet === '※運用者用※設定シート'));
  assert.deepEqual(Array.from(sharedGp.references || [], ref => ({
    liName: ref.rawValues.liName,
    gpName: ref.rawValues.gpName,
    gpBidCost: ref.rawValues.gpBidCost,
  })), [
    { liName:'DMG_ALL_AL_A01(MF25ｰ64歳×BP×エリア)-YTN', gpName:sharedGp.name, gpBidCost:'924' },
    { liName:'DMG_ALL_AL_A01(MF25ｰ64歳×BP×エリア)-VVC', gpName:sharedGp.name, gpBidCost:'1' },
  ], '原始 operator 行の LI→Group 参照と LI 別入札値を保持');
  const setting = { cp: parsed.cpList, io: parsed.ioList, li: parsed.liList, gp: parsed.gpList, cr: parsed.crList };
  const download = { cp: dl.cpList, io: dl.ioList, li: dl.liList, gp: dl.gpList, cr: dl.crList };

  const comparison = await buildTree(api, setting, download);
  const liNodes = flattenTree(comparison.roots).filter(n => n.level === 'LI');
  const ytn = liNodes.find(n => n.name.includes('YTN'));
  const vvc = liNodes.find(n => n.name.includes('VVC'));
  assert.ok(ytn && vvc, 'YTN / VVC 両 LI がツリーに存在');

  // ── Geography: VVC = ok（canonical 統一後は誤判定しない） ──
  const geoOf = n => (n.compItems || []).find(i => i.label === '地域 / Geography Targeting');
  const vvcGeo = geoOf(vvc);
  assert.equal(vvcGeo.result, 'ok', `VVC detail: ${vvcGeo.detail}`);
  assert.equal(JSON.stringify(vvcGeo.includeMissing), '[]', `VVC missing: ${JSON.stringify(vvcGeo.includeMissing)}`);
  assert.equal(JSON.stringify(vvcGeo.includeExtra), '[]', `VVC extra: ${JSON.stringify(vvcGeo.includeExtra)}`);
  assert.equal(api.geoSet(vvcGeo.normalizedSetting.include).length, 8, 'VVC は 8 都府県');

  // ── Geography: YTN = mismatch 維持（download include が Japan + exclude 8 都府県） ──
  const ytnGeo = geoOf(ytn);
  assert.equal(ytnGeo.result, 'mismatch', `YTN detail: ${ytnGeo.detail}`);
  assert.match(ytnGeo.detail, /配信追加：Japan/, 'Japan 追加を無視しない');

  // ── GP: 同一 Setting definition を参照する YTN/VVC が各自の liId 配下を正式照合 ──
  // 実案件では Download GP 2 行が同名（VID_15s-横-MF25ｰ64歳×BP×エリア）。liId（親LI）でのみ区別できる。
  const ytnDli = dl.liList.find(li => li.name === ytn.name);
  const vvcDli = dl.liList.find(li => li.name === vvc.name);
  const ytnDgp = dl.gpList.find(g => String(g.liId) === String(ytnDli.id));
  const vvcDgp = dl.gpList.find(g => String(g.liId) === String(vvcDli.id));
  assert.equal(ytnDli.id, '24110889268', `YTN LI ID: ${ytnDli.id}`);
  assert.equal(vvcDli.id, '24113932768', `VVC LI ID: ${vvcDli.id}`);
  assert.ok(ytnDgp && vvcDgp, 'Download GP 2 行（YTN / VVC）');
  assert.equal(ytnDgp.name, vvcDgp.name, '実案件の Download GP は同名（liId でのみ区別）');
  assert.equal(ytnDgp.id, '198625856629', `YTN GP ID: ${ytnDgp.id}`);
  assert.equal(vvcDgp.id, '200476448793', `VVC GP ID: ${vvcDgp.id}`);
  const ytnGpNode = (ytn.children || []).find(n => n.level === 'GP');
  assert.ok(ytnGpNode && ytnGpNode.found && ytnGpNode.matchedName === ytnDgp.name,
    'YTN GP が親LIスコープ（liId）で同名 GP のうち正しい方にマッチ');
  assert.equal(ytnGpNode.matchedId, '198625856629');
  const vvcGpNode = (vvc.children || []).find(n => n.level === 'GP');
  assert.ok(vvcGpNode && vvcGpNode.found && vvcGpNode.matchedName === vvcDgp.name,
    'VVC GP も同一 Setting definition の reference から親LIスコープでマッチ');
  assert.equal(vvcGpNode.matchedId, '200476448793');
  const sdfGps = flattenTree(comparison.roots).filter(n => n.level === 'GP' && n.fromSdf);
  assert.equal(sdfGps.length, 0, `YTN/VVC とも正式一致し、誤った SDF 由来 GP は無い: ${JSON.stringify(sdfGps)}`);

  // ── 双空非表示: 実案件で性別/年齢/子供の有無/世帯年収 が LI 列から消えている ──
  const liKeys = api.getLevelColumns('LI').map(c => c.key);
  for (const hiddenKey of ['性別', '年齢', '子供の有無', '世帯年収']) {
    assert.ok(!liKeys.includes(hiddenKey), `${hiddenKey} 列は非表示（実際の表示列: ${liKeys.join(', ')}）`);
  }
  assert.ok(liKeys.includes('ステータス'), 'ステータス列は表示');
});
