'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const JSZip = require('../jszip.min.js');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const youtubeRoot = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube';
const case011Root = path.join(youtubeRoot, '011');
const case011SelectedRoot = path.join(case011Root, '011-selected');

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {}, closest() { return null; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; },
    scrollIntoView() {}, style: { display: '', setProperty() {} },
    textContent: '', value: initialValue,
  };
}

function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script exists');
  const exportBlock = `
window.__structuralApi = {
  parseYoutubeSetting,
  parseSdfData,
  buildComparisonTree,
  ensureGeoMasterLoaded,
  parseSdfFrequencyCap,
  compareFq,
  compareIO,
  appendDownloadOnlyItems,
  setMediaType(value) { mediaType = value; },
  setSelectedDv360CaseType,
};`;
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
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  sandbox.__structuralApi.setMediaType('youtube');
  sandbox.__structuralApi.setSelectedDv360CaseType('initial');
  return sandbox.__structuralApi;
}

const api = loadApi();

function sdfFile(name, header, rows, source) {
  return { name, rows: [header, ...rows], path: `${source}/${name}`, parentZip: source };
}

test('SDF stable IDs deduplicate every hierarchy while preserving all source records', () => {
  const csvFiles = [
    sdfFile('SDF-Campaigns.csv', ['Campaign Id', 'Name'], [['cp-1', 'Same CP']], 'outer.zip'),
    sdfFile('SDF-Campaigns.csv', ['Campaign Id', 'Name'], [['cp-1', 'Same CP']], 'inner/SDF.zip'),
    sdfFile('SDF-InsertionOrders.csv', ['Io Id', 'Campaign Id', 'Name'], [['io-1', 'cp-1', 'Same IO']], 'outer.zip'),
    sdfFile('SDF-InsertionOrders.csv', ['Io Id', 'Campaign Id', 'Name'], [['io-1', 'cp-1', 'Same IO']], 'inner/SDF.zip'),
    sdfFile('SDF-LineItems.csv', ['Line Item Id', 'Io Id', 'Name'], [['li-1', 'io-1', 'Same LI']], 'outer.zip'),
    sdfFile('SDF-LineItems.csv', ['Line Item Id', 'Io Id', 'Name'], [['li-1', 'io-1', 'Same LI']], 'inner/SDF.zip'),
    sdfFile('SDF-AdGroups.csv', ['Ad Group Id', 'Line Item Id', 'Name'], [['gp-1', 'li-1', 'Same GP']], 'outer.zip'),
    sdfFile('SDF-AdGroups.csv', ['Ad Group Id', 'Line Item Id', 'Name'], [['gp-1', 'li-1', 'Same GP']], 'inner/SDF.zip'),
    sdfFile('SDF-AdGroupAds.csv', ['Ad Id', 'Ad Group Id', 'Name'], [['ad-1', 'gp-1', 'Same Ad']], 'outer.zip'),
    sdfFile('SDF-AdGroupAds.csv', ['Ad Id', 'Ad Group Id', 'Name'], [['ad-1', 'gp-1', 'Same Ad']], 'inner/SDF.zip'),
  ];
  const parsed = api.parseSdfData(csvFiles);
  for (const [listName, id] of [
    ['cpList', 'cp-1'], ['ioList', 'io-1'], ['liList', 'li-1'],
    ['gpList', 'gp-1'], ['crList', 'ad-1'],
  ]) {
    assert.equal(parsed[listName].length, 1, `${listName} deduplicates by stable ID`);
    assert.equal(parsed[listName][0].id, id);
    assert.equal(parsed[listName][0].sources.length, 2, `${listName} keeps both sources`);
    assert.deepEqual(Array.from(parsed[listName][0].sources, source => source.parentZip),
      ['outer.zip', 'inner/SDF.zip']);
  }
});

function makeOperatorSheet(cpName, ioName, liName) {
  const rows = Array.from({ length: 24 }, () => []);
  rows[15][1] = 'キャンペーン名';
  rows[15][3] = cpName;
  rows[18][1] = 'NO';
  rows[18][2] = 'IO名';
  rows[18][3] = 'IOタイプ';
  rows[18][23] = '広告申込情報名';
  rows[19][1] = '1';
  rows[19][2] = ioName;
  rows[19][3] = 'Standard';
  rows[19][23] = liName;
  return rows;
}

test('YouTube parser extracts every valid operator sheet and retains duplicate CP names by sourceSheet', () => {
  const sheets = {
    '※運用者用※設定シート': makeOperatorSheet('Same CP', 'IO-A', 'LI-A'),
    '※運用者用※設定シート (2)': makeOperatorSheet('Same CP', 'IO-B', 'LI-B'),
    '※運用者用※設定シート (例)': makeOperatorSheet('テスト', 'IO-TEST', 'LI-TEST'),
  };
  const parsed = api.parseYoutubeSetting(sheets, Object.keys(sheets), 'multi-operator.xlsx');
  assert.equal(parsed.cpList.length, 2, 'two valid sheets produce two CP records');
  assert.deepEqual(Array.from(parsed.cpList, cp => cp.name), ['Same CP', 'Same CP']);
  assert.deepEqual(Array.from(parsed.cpList, cp => cp.sourceSheet),
    ['※運用者用※設定シート', '※運用者用※設定シート (2)']);
  assert.deepEqual(Array.from(parsed.ioList, io => [io.name, io.sourceSheet]), [
    ['IO-A', '※運用者用※設定シート'],
    ['IO-B', '※運用者用※設定シート (2)'],
  ]);
});

function record(name, extra = {}) {
  return {
    name, fields: { status: 'Active' }, rawFields: { Name: name, Status: 'Active' },
    rawFieldOrder: ['Name', 'Status'], ...extra,
  };
}

function flatten(roots) {
  const result = [];
  const visit = node => { result.push(node); for (const child of node.children || []) visit(child); };
  for (const root of roots || []) visit(root);
  return result;
}

test('same-name CP candidates are disambiguated only by unique child IO hierarchy evidence', () => {
  const setting = {
    cp: [record('Same CP', { sourceSheet: 'sheet-A' }), record('Same CP', { sourceSheet: 'sheet-B' })],
    io: [
      record('IO-A', { cpName: 'Same CP', sourceSheet: 'sheet-A' }),
      record('IO-B', { cpName: 'Same CP', sourceSheet: 'sheet-B' }),
    ], li: [], gp: [], cr: [],
  };
  const download = {
    cp: [record('Same CP', { id: 'cp-B' }), record('Same CP', { id: 'cp-A' })],
    io: [record('IO-A', { id: 'io-A', cpId: 'cp-A' }), record('IO-B', { id: 'io-B', cpId: 'cp-B' })],
    li: [], gp: [], cr: [],
  };
  const tree = api.buildComparisonTree(setting, download);
  const settingRoots = tree.roots.filter(node => !node.fromSdf && node.level === 'CP');
  assert.equal(settingRoots[0].matchedId, 'cp-A');
  assert.equal(settingRoots[1].matchedId, 'cp-B');
  assert.equal(settingRoots[0].matchEvidence.childIoExactIntersection, 1);
  assert.equal(settingRoots[1].matchEvidence.childIoExactIntersection, 1);
  assert.equal(tree.dlOnly.filter(node => node.level === 'CP').length, 0);
});

test('tied exact CP candidates become ambiguous warnings and consume nothing', () => {
  const tree = api.buildComparisonTree(
    { cp: [record('Same CP', { sourceSheet: 'sheet-A' })], io: [], li: [], gp: [], cr: [] },
    { cp: [record('Same CP', { id: 'cp-1' }), record('Same CP', { id: 'cp-2' })], io: [], li: [], gp: [], cr: [] },
  );
  const cp = tree.roots.find(node => !node.fromSdf && node.level === 'CP');
  assert.equal(cp.found, false);
  assert.equal(cp.ambiguous, true);
  assert.equal(cp.status, 'warning');
  assert.deepEqual(Array.from(cp.ambiguousCandidates, candidate => candidate.id), ['cp-1', 'cp-2']);
  assert.equal(tree.dlOnly.filter(node => node.level === 'CP').length, 2, 'ambiguous candidates remain unconsumed');
});

test('matched CP forbids IO global fallback outside Campaign Id scope', () => {
  const tree = api.buildComparisonTree(
    { cp: [record('CP-1')], io: [record('IO-X', { cpName: 'CP-1' })], li: [], gp: [], cr: [] },
    {
      cp: [record('CP-1', { id: 'cp-1' }), record('CP-2', { id: 'cp-2' })],
      io: [record('IO-X', { id: 'io-x', cpId: 'cp-2' })], li: [], gp: [], cr: [],
    },
  );
  const io = flatten(tree.roots).find(node => !node.fromSdf && node.level === 'IO');
  assert.equal(io.found, false);
  assert.equal(io.candidate, false, 'matched parent does not even use an out-of-scope candidate');
  assert.equal(tree.dlOnly.filter(node => node.level === 'IO').length, 1);
});

test('matched IO forbids LI global fallback outside Io Id scope', () => {
  const tree = api.buildComparisonTree(
    {
      cp: [record('CP-1')], io: [record('IO-1', { cpName: 'CP-1' })],
      li: [record('LI-X', { ioName: 'IO-1' })], gp: [], cr: [],
    },
    {
      cp: [record('CP-1', { id: 'cp-1' })],
      io: [record('IO-1', { id: 'io-1', cpId: 'cp-1' }), record('IO-2', { id: 'io-2', cpId: 'cp-1' })],
      li: [record('LI-X', { id: 'li-x', ioId: 'io-2' })], gp: [], cr: [],
    },
  );
  const li = flatten(tree.roots).find(node => !node.fromSdf && node.level === 'LI');
  assert.equal(li.found, false);
  assert.equal(li.candidate, false);
  assert.equal(tree.dlOnly.filter(node => node.level === 'LI').length, 1);
});

function buildDisplayLiNameTree(settingLiName, downloadLis) {
  api.setMediaType('display');
  return api.buildComparisonTree(
    {
      cp: [record('CP-1')], io: [record('IO-1', { cpName: 'CP-1' })],
      li: [record(settingLiName, { ioName: 'IO-1' })], gp: [], cr: [],
    },
    {
      cp: [record('CP-1', { id: 'cp-1' })], io: [record('IO-1', { id: 'io-1', cpId: 'cp-1' })],
      li: downloadLis, gp: [], cr: [],
    },
  );
}

function settingLiNode(tree) {
  return flatten(tree.roots).find(node => !node.fromSdf && node.level === 'LI');
}

test('Display LI matches an SDF-only leading LI_ prefix inside its matched IO', t => {
  t.after(() => api.setMediaType('youtube'));
  const li = settingLiNode(buildDisplayLiNameTree('DV360_Q426_Test', [
    record('LI_DV360_Q426_Test', { id: 'li-1', ioId: 'io-1' }),
  ]));
  assert.equal(li.found, true);
  assert.equal(li.matchedName, 'LI_DV360_Q426_Test');
  assert.equal(li.candidate, false);
});

test('Display LI keeps an unchanged exact name as a formal match', t => {
  t.after(() => api.setMediaType('youtube'));
  const li = settingLiNode(buildDisplayLiNameTree('DV360_Q426_Test', [
    record('DV360_Q426_Test', { id: 'li-1', ioId: 'io-1' }),
  ]));
  assert.equal(li.found, true);
  assert.equal(li.matchedName, 'DV360_Q426_Test');
});

test('Display LI also normalizes a leading LI_ prefix on the setting name', t => {
  t.after(() => api.setMediaType('youtube'));
  const li = settingLiNode(buildDisplayLiNameTree('LI_DV360_Q426_Test', [
    record('DV360_Q426_Test', { id: 'li-1', ioId: 'io-1' }),
  ]));
  assert.equal(li.found, true);
  assert.equal(li.matchedName, 'DV360_Q426_Test');
});

test('Display LI does not promote a different normalized name to a match', t => {
  t.after(() => api.setMediaType('youtube'));
  const li = settingLiNode(buildDisplayLiNameTree('DV360_Q426_Test', [
    record('LI_DV360_Q426_Test2', { id: 'li-1', ioId: 'io-1' }),
  ]));
  assert.equal(li.found, false);
});

test('Display LI retains an ambiguous warning when two in-scope names normalize equally', t => {
  t.after(() => api.setMediaType('youtube'));
  const li = settingLiNode(buildDisplayLiNameTree('DV360_Q426_Test', [
    record('LI_DV360_Q426_Test', { id: 'li-1', ioId: 'io-1' }),
    record('DV360_Q426_Test', { id: 'li-2', ioId: 'io-1' }),
  ]));
  assert.equal(li.found, false);
  assert.equal(li.ambiguous, true);
});

test('Display LI does not cross IO scope for a normalized name', t => {
  t.after(() => api.setMediaType('youtube'));
  api.setMediaType('display');
  const tree = api.buildComparisonTree(
    {
      cp: [record('CP-1')], io: [record('IO-1', { cpName: 'CP-1' })],
      li: [record('DV360_Q426_Test', { ioName: 'IO-1' })], gp: [], cr: [],
    },
    {
      cp: [record('CP-1', { id: 'cp-1' })],
      io: [record('IO-1', { id: 'io-1', cpId: 'cp-1' }), record('IO-2', { id: 'io-2', cpId: 'cp-1' })],
      li: [record('LI_DV360_Q426_Test', { id: 'li-1', ioId: 'io-2' })], gp: [], cr: [],
    },
  );
  const li = settingLiNode(tree);
  assert.equal(li.found, false);
  assert.equal(li.candidate, false);
});

test('matched LI keeps GP scoped by Line Item Id', () => {
  const tree = api.buildComparisonTree(
    {
      cp: [record('CP-1')], io: [record('IO-1', { cpName: 'CP-1' })],
      li: [record('LI-1', { ioName: 'IO-1' })],
      gp: [record('GP-X', { ioName: 'IO-1', liName: 'LI-1' })], cr: [],
    },
    {
      cp: [record('CP-1', { id: 'cp-1' })], io: [record('IO-1', { id: 'io-1', cpId: 'cp-1' })],
      li: [record('LI-1', { id: 'li-1', ioId: 'io-1' }), record('LI-2', { id: 'li-2', ioId: 'io-1' })],
      gp: [record('GP-X', { id: 'gp-x', liId: 'li-2' })], cr: [],
    },
  );
  const gp = flatten(tree.roots).find(node => !node.fromSdf && node.level === 'GP');
  assert.equal(gp.found, false);
  assert.equal(tree.dlOnly.filter(node => node.level === 'GP').length, 1);
});

test('matched GP forbids CR global fallback outside Ad Group Id scope', () => {
  const tree = api.buildComparisonTree(
    {
      cp: [record('CP-1')], io: [record('IO-1', { cpName: 'CP-1' })],
      li: [record('LI-1', { ioName: 'IO-1' })],
      gp: [record('GP-1', { ioName: 'IO-1', liName: 'LI-1' })],
      cr: [record('CR-X', { ioName: 'IO-1', lpName: 'LI-1', gpName: 'GP-1' })],
    },
    {
      cp: [record('CP-1', { id: 'cp-1' })], io: [record('IO-1', { id: 'io-1', cpId: 'cp-1' })],
      li: [record('LI-1', { id: 'li-1', ioId: 'io-1' }), record('LI-2', { id: 'li-2', ioId: 'io-1' })],
      gp: [record('GP-1', { id: 'gp-1', liId: 'li-1' }), record('GP-2', { id: 'gp-2', liId: 'li-2' })],
      cr: [record('CR-X', { id: 'cr-x', gpId: 'gp-2' })],
    },
  );
  const cr = flatten(tree.roots).find(node => !node.fromSdf && node.level === 'CR');
  assert.equal(cr.found, false);
  assert.equal(cr.candidate, false);
  assert.equal(tree.dlOnly.filter(node => node.level === 'CR').length, 1);
});

test('unmatched parent exposes only a diagnostic candidate and does not consume it', () => {
  const tree = api.buildComparisonTree(
    { cp: [record('SETTING-CP')], io: [record('IO-X', { cpName: 'SETTING-CP' })], li: [], gp: [], cr: [] },
    { cp: [record('OTHER-CP', { id: 'cp-2' })], io: [record('IO-X', { id: 'io-x', cpId: 'unknown-cp' })], li: [], gp: [], cr: [] },
  );
  const io = flatten(tree.roots).find(node => !node.fromSdf && node.level === 'IO');
  assert.equal(io.found, false);
  assert.equal(io.candidate, true);
  assert.equal(io.status, 'warning');
  assert.equal(tree.dlOnly.filter(node => node.level === 'IO').length, 1, 'diagnostic candidate remains unconsumed');
});

test('OTT treats a trailing download Job ID as deterministic IO-name metadata inside the matched CP scope', () => {
  api.setMediaType('ott');
  try {
    const tree = api.buildComparisonTree(
      {
        cp: [record('CP-OTT')],
        io: [record('IO_Netflix_PMP_埼玉', { cpName: 'CP-OTT' })],
        li: [record('LI-OTT', { ioName: 'IO_Netflix_PMP_埼玉' })], gp: [], cr: [],
      },
      {
        cp: [record('CP-OTT', { id: 'cp-ott' })],
        io: [record('IO_Netflix_PMP_埼玉_J1000411167', { id: 'io-ott', cpId: 'cp-ott' })],
        li: [record('LI-OTT', { id: 'li-ott', ioId: 'io-ott' })], gp: [], cr: [],
      },
    );
    const nodes = flatten(tree.roots).filter(node => !node.fromSdf);
    const io = nodes.find(node => node.level === 'IO');
    const li = nodes.find(node => node.level === 'LI');
    assert.equal(io.found, true);
    assert.equal(io.matchedId, 'io-ott');
    assert.equal(li.found, true);
    assert.equal(li.matchedId, 'li-ott');
    assert.equal(tree.dlOnly.length, 0);
  } finally {
    api.setMediaType('youtube');
  }
});

function decodeCsv(buffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('shift_jis').decode(buffer); }
}

function parseCsvRows(buffer) {
  const workbook = XLSX.read(decodeCsv(buffer), { type: 'string' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],
    { header: 1, defval: '', raw: false });
}

async function collectCsvEntries(zipBuffer, sourceLabel) {
  const results = [];
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (entryName.toLowerCase().endsWith('.csv')) {
      results.push({
        name: path.basename(entryName), rows: parseCsvRows(await entry.async('uint8array')),
        path: entryName, parentZip: sourceLabel,
      });
    } else if (entryName.toLowerCase().endsWith('.zip')) {
      results.push(...await collectCsvEntries(await entry.async('uint8array'), `${sourceLabel}::${entryName}`));
    }
  }
  return results;
}

function parseSettingWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],
      { header: 1, defval: '', raw: true });
  }
  return { sheets, sheetNames: workbook.SheetNames };
}

test('real 011 outer ZIP plus inner SDF.zip deduplicates Campaign Id and keeps both sources', async t => {
  if (!fs.existsSync(case011Root)) { t.skip(`case missing: ${case011Root}`); return; }
  const zipPaths = [
    path.join(case011Root, '011-selected.zip'),
    path.join(case011SelectedRoot, 'SDF.zip'),
  ];
  if (!zipPaths.every(fs.existsSync)) { t.skip('011 outer/inner ZIP pair missing'); return; }
  const csvFiles = [];
  for (const zipPath of zipPaths) {
    csvFiles.push(...await collectCsvEntries(fs.readFileSync(zipPath), path.basename(zipPath)));
  }
  const parsed = api.parseSdfData(csvFiles);
  assert.equal(parsed.cpList.length, 1, 'same Campaign Id builds one business CP node');
  assert.equal(parsed.cpList[0].id, '57224545');
  assert.equal(parsed.cpList[0].sources.length, 2);
  assert.deepEqual(new Set(parsed.cpList[0].sources.map(source => source.parentZip)),
    new Set(['011-selected.zip::SDF.zip', 'SDF.zip']));
});

test('real 011 parser chain proves VVC ok and YTN mismatch with complete set differences', async t => {
  if (!fs.existsSync(case011SelectedRoot)) { t.skip(`case missing: ${case011SelectedRoot}`); return; }
  await api.ensureGeoMasterLoaded();
  const settingName = fs.readdirSync(case011SelectedRoot)
    .find(name => /\.xlsx$/i.test(name) && !name.startsWith('~$'));
  const workbook = parseSettingWorkbook(path.join(case011SelectedRoot, settingName));
  const settingParsed = api.parseYoutubeSetting(workbook.sheets, workbook.sheetNames, settingName);
  const csvFiles = await collectCsvEntries(
    fs.readFileSync(path.join(case011SelectedRoot, 'SDF.zip')), 'SDF.zip');
  const downloadParsed = api.parseSdfData(csvFiles);
  const tree = api.buildComparisonTree(
    { cp: settingParsed.cpList, io: settingParsed.ioList, li: settingParsed.liList, gp: settingParsed.gpList, cr: settingParsed.crList },
    { cp: downloadParsed.cpList, io: downloadParsed.ioList, li: downloadParsed.liList, gp: downloadParsed.gpList, cr: downloadParsed.crList },
  );
  const geographyOf = suffix => {
    const li = flatten(tree.roots).find(node => node.level === 'LI' && node.name.includes(suffix));
    return li.compItems.find(item => item.label === '地域 / Geography Targeting');
  };
  const vvc = geographyOf('VVC');
  assert.equal(vvc.result, 'ok');
  assert.deepEqual(Array.from(vvc.normalizedSetting.include), ['20634', '20635', '20636', '20637', '20646', '20649', '20650', '20651']);
  assert.deepEqual(Array.from(vvc.normalizedDownload.include), ['20634', '20635', '20636', '20637', '20646', '20649', '20650', '20651']);
  assert.deepEqual(Array.from(vvc.includeMissing), []);
  assert.deepEqual(Array.from(vvc.includeExtra), []);

  const ytn = geographyOf('YTN');
  assert.equal(ytn.result, 'mismatch');
  assert.deepEqual(Array.from(ytn.normalizedDownload.include), ['2392']);
  assert.deepEqual(Array.from(ytn.normalizedDownload.exclude), ['20634', '20635', '20636', '20637', '20646', '20649', '20650', '20651']);
  assert.equal(ytn.includeMissing.length, 8);
  assert.deepEqual(Array.from(ytn.includeExtra), ['Japan']);
  assert.equal(ytn.excludeExtra.length, 8);
  assert.match(ytn.detail, /配信不足：東京、神奈川、埼玉、千葉、愛知、大阪、京都、兵庫/);
  assert.match(ytn.detail, /配信追加：Japan/);
  assert.match(ytn.detail, /除外追加：Saitama, Japan、Chiba, Japan、Tokyo, Japan、Kanagawa, Japan、Aichi, Japan、Kyoto, Japan、Osaka, Japan、Hyogo, Japan/);
});

test('YouTube FQ consumes Frequency Amount and compares the period count', () => {
  const parsed = api.parseSdfData([
    sdfFile('SDF-InsertionOrders.csv',
      ['Io Id', 'Name', 'Frequency Enabled', 'Frequency Exposures', 'Frequency Period', 'Frequency Amount'],
      [['io-fq', 'IO-FQ', 'True', '2', 'Months', '2']], 'fq.zip'),
  ]);
  const fields = parsed.ioList[0].fields;
  assert.equal(fields.frequencyAmount, '2');
  assert.equal(api.parseSdfFrequencyCap(fields).periodCount, 2);
  api.setMediaType('youtube');
  assert.equal(api.compareFq('2か月/2', fields).result, 'ok');
  assert.equal(api.compareFq('1か月/2', fields).result, 'mismatch');
});

test('OTT FQ also rejects a different Frequency Amount period count', () => {
  api.setMediaType('ott');
  const setting = { fields: {
    ioType: 'Standard', optTarget: 'No Objective', autoBudget: 'OFF',
    budgetNet: '', startDate: '', startTime: '', endDate: '', endTime: '',
    pacingType: '', kpi: '', kpiValue: '', fqTiming: '2か月', fqCount: '2回',
  } };
  const download = { name: 'IO-FQ', fields: {
    ioType: 'Standard', ioSubtype: 'Default', objective: 'No Objective',
    frequencyEnabled: 'True', frequencyExposures: '2', frequencyPeriod: 'Months', frequencyAmount: '2',
  }, rawFields: { 'Auto Budget Allocation': 'False' }, rawFieldOrder: ['Auto Budget Allocation'] };
  assert.equal(api.compareIO(setting, download).find(item => item.label === 'FQ').result, 'ok');
  download.fields.frequencyAmount = '1';
  assert.equal(api.compareIO(setting, download).find(item => item.label === 'FQ').result, 'mismatch');
  api.setMediaType('youtube');
});

test('media-specific or unimplemented core fields are never silently swallowed', () => {
  api.setMediaType('youtube');
  const youtubeLi = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Device Targeting - Include', 'Environment Targeting', 'Apply Floor Price For Deals'],
    rawFields: {
      'Device Targeting - Include': 'Desktop',
      'Environment Targeting': 'Web',
      'Apply Floor Price For Deals': 'True',
    },
  }, []);
  const liTargetFields = ['Device Targeting - Include', 'Environment Targeting', 'Apply Floor Price For Deals'];
  assert.deepEqual(Array.from(youtubeLi.filter(item => liTargetFields.includes(item.rawFieldName)), item => item.rawFieldName),
    ['Device Targeting - Include', 'Environment Targeting', 'Apply Floor Price For Deals']);

  const gp = api.appendDownloadOnlyItems('GP', {
    rawFieldOrder: ['Geography Targeting - Include'],
    rawFields: { 'Geography Targeting - Include': '20634;' },
  }, []);
  assert.deepEqual(Array.from(gp, item => item.rawFieldName), ['Geography Targeting - Include']);

  const cr = api.appendDownloadOnlyItems('CR', {
    rawFieldOrder: ['Headline', 'Description 2', 'Business Name'],
    rawFields: { Headline: 'headline', 'Description 2': 'description', 'Business Name': 'business' },
  }, []);
  assert.deepEqual(Array.from(cr, item => item.rawFieldName), ['Headline', 'Description 2', 'Business Name']);

  api.setMediaType('ott');
  const ottCore = [{
    label: 'デバイス', result: 'ok',
    sourceSdfFields: ['Device Targeting - Include', 'Environment Targeting', 'Apply Floor Price For Deals'],
  }];
  const ottItems = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Device Targeting - Include', 'Environment Targeting', 'Apply Floor Price For Deals'],
    rawFields: {
      'Device Targeting - Include': 'Desktop',
      'Environment Targeting': 'Web',
      'Apply Floor Price For Deals': 'True',
    },
  }, ottCore);
  assert.equal(ottItems.filter(item => liTargetFields.includes(item.rawFieldName)).length, 0,
    'sourceSdfFields suppress duplicate download-only fields');
  api.setMediaType('youtube');
});
