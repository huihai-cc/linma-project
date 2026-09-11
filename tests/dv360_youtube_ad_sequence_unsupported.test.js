'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const realWorkbookPath = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/Youtube/020/260901開始_v4【ビオレフェイス】TheFace_スムースクリア 15秒CF動画_ 9月_TrueView【設定シート】Ver8 (1).xlsx';
const NOTICE = '広告シーケンスはSDFから比較用データを取得できないため、自動比較対象外です。設定表の内容をもとに、DV360管理画面で設定内容をご確認ください。';

function createElement(value = '') {
  const classNames = new Set();
  return {
    addEventListener() {}, appendChild() {}, closest() { return null; },
    classList: {
      add(...names) { names.forEach(name => classNames.add(name)); },
      remove(...names) { names.forEach(name => classNames.delete(name)); },
      contains(name) { return classNames.has(name); },
    },
    dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return createElement(); }, querySelectorAll() { return []; },
    scrollIntoView() {}, style: { display: '', setProperty() {} },
    textContent: '', value,
  };
}

function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = `
window.__sequenceTestApi = {
  parseYoutubeSetting: typeof parseYoutubeSetting === 'function' ? parseYoutubeSetting : undefined,
  buildComparisonTree: typeof buildComparisonTree === 'function' ? buildComparisonTree : undefined,
  updateNodeStatus: typeof updateNodeStatus === 'function' ? updateNodeStatus : undefined,
  getComparisonStatusCounts: typeof getComparisonStatusCounts === 'function' ? getComparisonStatusCounts : undefined,
  renderLevelTable: typeof renderLevelTable === 'function' ? renderLevelTable : undefined,
  setMediaType(value) { mediaType = value; },
  setTreeRoots(value) { treeRoots = value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
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
    TextDecoder, Uint8Array, URL, XLSX, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return { api: sandbox.__sequenceTestApi, elements };
}

function readWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), {
    type: 'buffer', cellStyles: true, cellNF: true, cellDates: true,
  });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, defval: '', raw: false,
    });
  }
  return { sheetNames: [...workbook.SheetNames], sheets, worksheets: { ...workbook.Sheets } };
}

function cloneWorkbook(source) {
  return {
    sheetNames: [...source.sheetNames],
    sheets: Object.fromEntries(Object.entries(source.sheets).map(([name, rows]) => [
      name, rows.map(row => [...row]),
    ])),
    worksheets: { ...source.worksheets },
  };
}

function skipIfMissing(t, filePath) {
  if (fs.existsSync(filePath)) return false;
  t.skip(`real workbook is unavailable: ${filePath}`);
  return true;
}

function makeSetting({ sequence = false, mixed = false } = {}) {
  const cpName = 'CP-SEQUENCE-TEST';
  const ioName = 'IO-SEQUENCE-TEST';
  const liNames = mixed ? ['LI-NORMAL', 'LI-SEQUENCE'] : ['LI-SEQUENCE'];
  const cp = [{ name: cpName, sourceSheet: 'fixture', fields: {} }];
  const io = [{ name: ioName, cpName, sourceSheet: 'fixture', fields: {} }];
  const li = liNames.map(name => ({
    name, ioName, sourceSheet: 'fixture',
    fields: {
      videoType: name === 'LI-NORMAL' ? 'TrvInstream' : 'VAS(CPM)',
      liSubtype: sequence || (mixed && name === 'LI-SEQUENCE') ? '広告シーケンス' : '',
    },
  }));
  const gp = liNames.map(name => ({
    name: `GP-${name}`, ioName, liName: name, sourceSheet: 'fixture', fields: {},
  }));
  const cr = liNames.map(name => ({
    name: `CR-${name}`, ioName, lpName: name, gpName: `GP-${name}`, sourceSheet: 'fixture',
    fields: { videoUrl: 'https://www.youtube.com/watch?v=video-test' },
  }));
  return { cp, io, li, gp, cr, audience: {} };
}

function makeDownload({ mixed = false } = {}) {
  const liNames = mixed ? ['LI-NORMAL', 'LI-SEQUENCE'] : ['LI-SEQUENCE'];
  return {
    cp: [{ name: 'CP-SEQUENCE-TEST', id: 'cp-1', fields: {} }],
    io: [{ name: 'IO-SEQUENCE-TEST', id: 'io-1', cpId: 'cp-1', fields: {} }],
    li: liNames.map((name, index) => ({ name, id: `li-${index + 1}`, ioId: 'io-1', fields: {} })),
    gp: liNames.map((name, index) => ({
      name: `GP-${name}`, id: `gp-${index + 1}`, liId: `li-${index + 1}`,
      fields: { videoAdFormat: 'Responsive', bidCost: '' },
    })),
    cr: liNames.map((name, index) => ({
      name: `CR-${name}`, id: `cr-${index + 1}`, gpId: `gp-${index + 1}`,
      fields: { videoId: 'video-test' },
    })),
  };
}

function build(api, setting, download = makeDownload()) {
  api.setMediaType('youtube');
  return api.buildComparisonTree(setting, download);
}

function flatten(roots) {
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.children || []) visit(child); };
  for (const root of roots || []) visit(root);
  return nodes;
}

function nodeAt(tree, level, name) {
  return flatten(tree.roots).find(node => node.level === level && node.name === name);
}

const { api, elements } = loadApi();

test('SEQ_1_REAL_DETECTION: operator sheet subtype rows 26-35 detect 10 sequence rows', t => {
  if (skipIfMissing(t, realWorkbookPath)) return;
  assert.equal(typeof api.parseYoutubeSetting, 'function');
  const source = readWorkbook(realWorkbookPath);
  const parsed = api.parseYoutubeSetting(
    source.sheets, source.sheetNames, path.basename(realWorkbookPath), source.worksheets,
  );
  assert.equal(parsed.sequenceLiCount, 10);
  assert.equal(parsed.liList.length, 2);
  assert.ok(parsed.liList.every(li => li.fields.liSubtype === '広告シーケンス'));
});

test('SEQ_2_VAS_NOT_ENOUGH: VAS(CPM) without sequence subtype stays comparable', () => {
  const setting = makeSetting({ sequence: false });
  const tree = build(api, setting);
  const liNode = nodeAt(tree, 'LI', 'LI-SEQUENCE');
  assert.notEqual(liNode.comparisonSupport, 'unsupported');
  assert.ok(liNode.compItems.some(item => item.label === '動画タイプ'));
});

test('SEQ_3_SHEET_EXISTENCE_NOT_ENOUGH: a sequence sheet name does not trigger a normal LI', t => {
  if (skipIfMissing(t, realWorkbookPath)) return;
  const source = readWorkbook(realWorkbookPath);
  const operatorSheet = source.sheets['※運用者用※設定シート'];
  const header = operatorSheet.find(row => row.includes('IO名') && row.includes('広告申込情報名') && row.includes('広告申込情報のサブタイプ'));
  const subtypeColumn = header.findIndex(value => value === '広告申込情報のサブタイプ');
  for (let row = 25; row < 35; row++) operatorSheet[row][subtypeColumn] = '通常';
  const parsed = api.parseYoutubeSetting(
    source.sheets, source.sheetNames, path.basename(realWorkbookPath), source.worksheets,
  );
  assert.equal(source.sheetNames.includes('広告シーケンス'), true);
  assert.equal(parsed.sequenceLiCount, 0);
  assert.ok(parsed.liList.every(li => li.fields.liSubtype !== '広告シーケンス'));
});

test('SEQ_4_LI_UNSUPPORTED: sequence LI has no normal comparison items or status', () => {
  const tree = build(api, makeSetting({ sequence: true }));
  const liNode = nodeAt(tree, 'LI', 'LI-SEQUENCE');
  assert.equal(liNode.comparisonSupport, 'unsupported');
  assert.equal(liNode.comparisonUnsupportedReason, 'youtube_ad_sequence');
  assert.equal(liNode.status, 'unsupported');
  assert.equal(liNode.compItems.length, 1);
  assert.equal(liNode.compItems[0].result, 'unsupported');
  assert.equal(liNode.compItems.some(item => item.label === '動画タイプ'), false);
});

test('SEQ_5_DESCENDANTS: GP and CR inherit the sequence unsupported scope', () => {
  const tree = build(api, makeSetting({ sequence: true }));
  for (const level of ['GP', 'CR']) {
    const node = nodeAt(tree, level, `${level}-LI-SEQUENCE`);
    assert.equal(node.comparisonSupport, 'unsupported', level);
    assert.equal(node.comparisonUnsupportedReason, 'youtube_ad_sequence', level);
    assert.equal(node.status, 'unsupported', level);
    assert.equal(node.compItems.length, 1, level);
    assert.equal(node.compItems[0].result, 'unsupported', level);
  }
});

test('SEQ_6_COUNTER_NEUTRAL: unsupported nodes contribute to none of the four status counts', () => {
  const tree = build(api, makeSetting({ sequence: true }));
  const sequenceLi = flatten(tree.roots)
    .find(node => node.level === 'LI' && node.name === 'LI-SEQUENCE');
  api.setTreeRoots([sequenceLi]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getComparisonStatusCounts())), {
    ok: 0, mismatch: 0, warning: 0, notfound: 0,
  });
});

test('SEQ_7_PARENT_NEUTRAL: an IO with only an unsupported child remains ok when its own comparison is ok', () => {
  const ioNode = {
    level: 'IO', found: true, compItems: [{ result: 'ok' }],
    children: [{ level: 'LI', found: true, comparisonSupport: 'unsupported', status: 'unsupported', compItems: [], children: [] }],
  };
  api.updateNodeStatus(ioNode);
  assert.equal(ioNode.status, 'ok');
});

test('SEQ_8_MIXED_CASE: normal and sequence LI branches remain independent', () => {
  const tree = build(api, makeSetting({ mixed: true }), makeDownload({ mixed: true }));
  const normal = nodeAt(tree, 'LI', 'LI-NORMAL');
  const sequence = nodeAt(tree, 'LI', 'LI-SEQUENCE');
  assert.notEqual(normal.comparisonSupport, 'unsupported');
  assert.ok(normal.compItems.length > 1);
  assert.equal(sequence.comparisonSupport, 'unsupported');
  assert.equal(sequence.status, 'unsupported');
  assert.equal(nodeAt(tree, 'GP', 'GP-LI-NORMAL').comparisonSupport, undefined);
  assert.equal(nodeAt(tree, 'CR', 'CR-LI-NORMAL').comparisonSupport, undefined);
  assert.equal(nodeAt(tree, 'GP', 'GP-LI-SEQUENCE').comparisonSupport, 'unsupported');
  assert.equal(nodeAt(tree, 'CR', 'CR-LI-SEQUENCE').comparisonSupport, 'unsupported');
});

test('SEQ_9_NORMAL_REGRESSION: ordinary YouTube LI still produces the existing comparison shape', () => {
  const tree = build(api, makeSetting({ sequence: false }));
  const liNode = nodeAt(tree, 'LI', 'LI-SEQUENCE');
  assert.equal(liNode.comparisonSupport, undefined);
  assert.ok(liNode.compItems.some(item => item.label === 'ステータス'));
  assert.ok(liNode.compItems.some(item => item.label === '動画タイプ'));
});

test('SEQ_10_NOTICE: an all-sequence level renders one exact unsupported notice', () => {
  const tree = build(api, makeSetting({ sequence: true }));
  api.setTreeRoots(tree.roots);
  api.renderLevelTable('LI');
  const html = elements.get('result-table-wrap').innerHTML;
  assert.equal((html.match(new RegExp(NOTICE, 'g')) || []).length, 1);
  assert.equal(html.includes('一致'), false);
  assert.equal(html.includes('不一致'), false);
  assert.equal(html.includes('未匹配'), false);
  assert.equal(html.includes('需確認'), false);
});
