const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const workbookPath = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/Youtube/019/260907v2_日東電工_FY26Q2_TrueView【設定シート】Ver8 (1).xlsx';

function createElement(value = '') {
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value,
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');
  const exportBlock = `
window.__materialSheetTestApi = {
  parseYoutubeSetting: typeof parseYoutubeSetting === 'function' ? parseYoutubeSetting : undefined,
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
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__materialSheetTestApi;
}

function loadWorkbookSource() {
  const workbook = XLSX.read(fs.readFileSync(workbookPath), {
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

function requireRealWorkbook(t) {
  if (fs.existsSync(workbookPath)) return true;
  t.skip(`real workbook is unavailable: ${workbookPath}`);
  return false;
}

function cloneSource(source) {
  return {
    sheetNames: [...source.sheetNames],
    sheets: Object.fromEntries(Object.entries(source.sheets).map(([name, rows]) => [
      name, rows.map(row => [...row]),
    ])),
    worksheets: { ...source.worksheets },
  };
}

function salesMaterialColumn(source) {
  const salesName = source.sheetNames.find(name => name.includes('営業') || name.includes('業推') || name.includes('記入欄'));
  const rows = source.sheets[salesName] || [];
  const header = rows.find(row => row.join(' ').includes('J.No') && row.join(' ').includes('配信目的')) || [];
  const materialColumn = header.findIndex(value => String(value || '').includes('使用する入稿物管理表'));
  assert.ok(salesName && materialColumn >= 0, 'sales sheet material column should be present');
  return { salesName, materialColumn };
}

function setRequestedMaterialSheet(source, value) {
  const { salesName, materialColumn } = salesMaterialColumn(source);
  for (const row of source.sheets[salesName]) {
    if (/^\d+$/.test(String(row[0] || '').trim())) row[materialColumn] = value;
  }
}

function renameSheet(source, oldName, newName) {
  assert.ok(source.sheets[oldName], `source sheet should exist: ${oldName}`);
  if (oldName === newName) return;
  source.sheets[newName] = source.sheets[oldName];
  delete source.sheets[oldName];
  source.worksheets[newName] = source.worksheets[oldName];
  delete source.worksheets[oldName];
  source.sheetNames = source.sheetNames.map(name => name === oldName ? newName : name);
}

function parse(api, source) {
  return api.parseYoutubeSetting(source.sheets, source.sheetNames, path.basename(workbookPath), source.worksheets);
}

function videoId(url) {
  return String(url || '').match(/[?&]v=([^&#]+)/)?.[1] || '';
}

const api = loadDv360Api();

test('real NonS fullwidth/ascii closing-bracket mismatch selects the actual material sheet', t => {
  if (!requireRealWorkbook(t)) return;
  const source = loadWorkbookSource();
  const result = parse(api, source);
  assert.equal(result.gpList.length, 2);
  assert.equal(result.crList.length, 2);
  assert.deepEqual([...new Set(result.crList.map(item => item.sheet))], ['入稿物管理表（VRC(NonS))']);
});

test('reverse bracket styles and same material sheet names continue to match', t => {
  if (!requireRealWorkbook(t)) return;
  const original = '入稿物管理表（VRC(NonS))';
  for (const [requested, actual] of [
    ['入稿物管理表(VRC(NonS))', '入稿物管理表（VRC(NonS)）'],
    [original, original],
  ]) {
    const source = loadWorkbookSource();
    renameSheet(source, original, actual);
    setRequestedMaterialSheet(source, requested);
    const result = parse(api, source);
    assert.equal(result.crList.length, 2, `${requested} -> ${actual}`);
    assert.deepEqual([...new Set(result.crList.map(item => item.sheet))], [actual], `${requested} -> ${actual}`);
  }
});

test('existing material sheet names continue to select their own sheets', t => {
  if (!requireRealWorkbook(t)) return;
  const source = loadWorkbookSource();
  const nonS = '入稿物管理表（VRC(NonS))';
  for (const materialSheet of [
    '入稿物管理表（VRC・VVC・VRC(FQ))',
    '入稿物管理表（YTN(FQ)）',
    '入稿物管理表（オーディオ広告）',
  ]) {
    const caseSource = cloneSource(source);
    caseSource.sheets[materialSheet] = caseSource.sheets[nonS].map(row => [...row]);
    caseSource.worksheets[materialSheet] = caseSource.worksheets[nonS];
    setRequestedMaterialSheet(caseSource, materialSheet);
    const result = parse(api, caseSource);
    assert.ok(result.crList.length > 0, materialSheet);
    assert.deepEqual([...new Set(result.crList.map(item => item.sheet))], [materialSheet], materialSheet);
  }
});

test('NonS requested material does not select a YTN material sheet', t => {
  if (!requireRealWorkbook(t)) return;
  const source = loadWorkbookSource();
  const allowed = '入稿物管理表（YTN(FQ)）';
  source.sheetNames = source.sheetNames.filter(name => !name.includes('入稿物管理表') || name === allowed);
  for (const name of Object.keys(source.sheets)) {
    if (name.includes('入稿物管理表') && name !== allowed) delete source.sheets[name];
  }
  for (const name of Object.keys(source.worksheets)) {
    if (name.includes('入稿物管理表') && name !== allowed) delete source.worksheets[name];
  }
  setRequestedMaterialSheet(source, '入稿物管理表（VRC(NonS)）');
  assert.equal(parse(api, source).crList.length, 0);
});

test('exact/includes/reverse-includes material sheet matching semantics remain unchanged', t => {
  if (!requireRealWorkbook(t)) return;
  const actual = '入稿物管理表（VRC(NonS))';
  for (const requested of [
    'VRC(NonS)',
    `prefix ${actual} suffix`,
  ]) {
    const source = loadWorkbookSource();
    setRequestedMaterialSheet(source, requested);
    const result = parse(api, source);
    assert.equal(result.crList.length, 2, requested);
    assert.deepEqual([...new Set(result.crList.map(item => item.sheet))], [actual], requested);
  }
});

test('real NonS extraction keeps the expected CR fields untouched', t => {
  if (!requireRealWorkbook(t)) return;
  const result = parse(api, loadWorkbookSource());
  assert.equal(result.liList.length, 2);
  assert.equal(result.liList[0].fields.materialSheet, '入稿物管理表（VRC(NonS)）');
  assert.equal(result.liList[1].fields.materialSheet, '入稿物管理表（VRC(NonS)）');
  assert.equal(result.gpList.length, 2);
  assert.equal(result.crList.length, 2);
  const byGp = new Map(result.crList.map(item => [item.gpName, item]));
  const cr1 = byGp.get('VID_15s-横-MF18-24×ローテレターゲティング_naani');
  const cr2 = byGp.get('VID_15s-横-MF18-24×ローテレターゲティング_nattou');
  assert.ok(cr1);
  assert.ok(cr2);
  assert.equal(cr1.name, '【広告用】【Nittoさんとコジコジ】Nittoってなあに？ 篇');
  assert.equal(videoId(cr1.fields.videoUrl), 'sH7v9EnIThM');
  assert.equal(cr2.name, '【広告用】【Nittoさんとコジコジ】なっとうじゃなくてNittoです 篇');
  assert.equal(videoId(cr2.fields.videoUrl), '6yZ9sjOGHHI');
});
