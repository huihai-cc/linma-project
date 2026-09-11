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

function createElement(initialValue = '') {
  const classNames = new Set();
  return {
    addEventListener() {}, appendChild() {}, closest() { return null; },
    classList: {
      add(...names) { names.forEach(name => classNames.add(name)); },
      remove(...names) { names.forEach(name => classNames.delete(name)); },
      contains(name) { return classNames.has(name); },
    },
    dataset: {}, disabled: false, files: [], innerHTML: '',
    getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    scrollIntoView() {}, style: { display: '', setProperty() {} },
    textContent: '', value: initialValue,
  };
}

class AsyncFileReader {
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then(buffer => {
      if (this.onload) this.onload({ target: { result: buffer } });
    }, error => {
      if (this.onerror) this.onerror(error);
    });
  }
}

function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script exists');

  const exportBlock = `
window.__csvSafeApi = {
  parseCsvTextSafely: typeof parseCsvTextSafely === 'function' ? parseCsvTextSafely : undefined,
  validateCsvRowsStructure: typeof validateCsvRowsStructure === 'function' ? validateCsvRowsStructure : undefined,
  parseCsv: typeof parseCsv === 'function' ? parseCsv : undefined,
  extractZip: typeof extractZip === 'function' ? extractZip : undefined,
  dvUnifiedSdfHeaderInfo: typeof dvUnifiedSdfHeaderInfo === 'function' ? dvUnifiedSdfHeaderInfo : undefined,
};`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return createElement(); },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream,
    Encoding: {
      detect() { return 'UTF8'; },
      convert(bytes, options) {
        return new TextDecoder(String(options.from || 'utf-8').toLowerCase()).decode(Uint8Array.from(bytes));
      },
    },
    FileReader: AsyncFileReader, JSZip, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    setTimeout, clearTimeout,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__csvSafeApi;
}

function namedBlob(name, value) {
  const blob = new Blob([value], { type: 'text/csv' });
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toHostValue(value) {
  return JSON.parse(JSON.stringify(value));
}

const REAL_HEADERS = [
  'Ad Id', 'Ad Group Id', 'Ad Group Name', 'Name', 'Status', 'Ad Type', 'Video Id',
  'Display URL', 'Landing Page URL', 'DCM Tracking - Placement Id',
  'DCM Tracking - Ad Id', 'DCM Tracking - Creative Id', 'Click Tracker URL',
  'Click Tracker URL Parameters', 'Call to Action', 'Headline', 'Display URL Path 1',
  'Display URL Path 2', 'In-feed Video Thumbnail', 'In-feed Video Headline',
  'Description 1', 'Description 2', 'In-feed Video Landing Page',
  'Mobile Landing Page URL', 'Business Name', 'Landing Page URL Suffix',
  'Logo Asset IDs', 'Marketing Image Asset IDs', 'Demand Gen Cards',
  'Companion Banner Asset IDs',
];

function realAdGroupAdsCsv(line1 = {}, line2 = {}) {
  const makeRow = values => REAL_HEADERS.map(header => values[header] || '');
  return [
    REAL_HEADERS.map(csvCell).join(','),
    makeRow({
      'Ad Id': '824056456475', 'Ad Group Id': '199359853145', Status: 'Active',
      'Ad Type': 'Responsive', 'Video Id': '6yZ9sjOGHHI', ...line1,
    }).map(csvCell).join(','),
    makeRow({
      'Ad Id': '823972335031', 'Ad Group Id': '200706646755', Status: 'Active',
      'Ad Type': 'Responsive', 'Video Id': 'sH7v9EnIThM', ...line2,
    }).map(csvCell).join(','),
  ].join('\r\n');
}

const api = loadApi();

test('CSV_SAFE_0_SHEETJS_FORMATTING_RISK: raw SDF date text is preserved exactly', async () => {
  const csv = 'Start Date,Status\n06/22/2026,Active';
  const rows = await api.parseCsv(namedBlob('SDF-LineItems.csv', csv));
  assert.equal(rows[1][0], '06/22/2026');
  assert.equal(typeof rows[1][0], 'string');
});

test('CSV_SAFE_1_REAL_ADGROUPADS: 30 headers and exact key values are retained', () => {
  const rows = toHostValue(api.parseCsvTextSafely(realAdGroupAdsCsv()));
  assert.equal(rows[0].length, 30);
  assert.equal(rows[1].length, 30);
  assert.equal(rows[2].length, 30);
  assert.equal(rows[0][4], 'Status');
  assert.equal(rows[0][5], 'Ad Type');
  assert.equal(rows[0][6], 'Video Id');
  assert.deepEqual(rows.slice(1).map(row => ({
    adId: row[0], adGroupId: row[1], status: row[4], adType: row[5], videoId: row[6],
  })), [
    { adId: '824056456475', adGroupId: '199359853145', status: 'Active', adType: 'Responsive', videoId: '6yZ9sjOGHHI' },
    { adId: '823972335031', adGroupId: '200706646755', status: 'Active', adType: 'Responsive', videoId: 'sH7v9EnIThM' },
  ]);
  assert.ok(rows.flat().every(value => typeof value === 'string'));
});

test('CSV_SAFE_2_LONG_ID_STRING: IDs remain strings character-for-character', () => {
  const rows = api.parseCsvTextSafely('Ad Id,Ad Group Id\n824056456475,199359853145');
  assert.equal(rows[1][0], '824056456475');
  assert.equal(rows[1][1], '199359853145');
  assert.equal(typeof rows[1][0], 'string');
  assert.equal(typeof rows[1][1], 'string');
});

test('CSV_SAFE_3_TRAILING_EMPTY_FIELDS: trailing blank cells are not dropped', () => {
  assert.deepEqual(toHostValue(api.parseCsvTextSafely('A,B,C,D,E\n1,2,3,,')), [
    ['A', 'B', 'C', 'D', 'E'], ['1', '2', '3', '', ''],
  ]);
});

test('CSV_SAFE_4_QUOTED_COMMA: comma inside a quoted field stays in one cell', () => {
  assert.deepEqual(toHostValue(api.parseCsvTextSafely('A,B,C\n123,"ABC,DEF",Active')), [
    ['A', 'B', 'C'], ['123', 'ABC,DEF', 'Active'],
  ]);
});

test('CSV_SAFE_5_ESCAPED_QUOTES: doubled quotes decode to one quote', () => {
  assert.deepEqual(toHostValue(api.parseCsvTextSafely('A,B,C\n123,"ABC ""TEST"" DEF",Active')), [
    ['A', 'B', 'C'], ['123', 'ABC "TEST" DEF', 'Active'],
  ]);
});

test('CSV_SAFE_6_CRLF_LF: CRLF and LF produce identical rows', () => {
  const lf = toHostValue(api.parseCsvTextSafely('A,B\n1,2\n3,4'));
  const crlf = toHostValue(api.parseCsvTextSafely('A,B\r\n1,2\r\n3,4'));
  assert.deepEqual(crlf, lf);
});

test('CSV_SAFE_7_QUOTED_NEWLINE: newline inside quotes does not split the record', () => {
  assert.deepEqual(toHostValue(api.parseCsvTextSafely('A,B,C\r\n123,"ABC\r\nDEF",Active')), [
    ['A', 'B', 'C'], ['123', 'ABC\r\nDEF', 'Active'],
  ]);
});

test('CSV_SAFE_8_BOM: UTF-8 BOM is absent from the first header', () => {
  const rows = toHostValue(api.parseCsvTextSafely('\uFEFFA,B\n1,2'));
  assert.deepEqual(rows[0], ['A', 'B']);
});

test('CSV_SAFE_9_JAPANESE: Japanese cell text is retained exactly', () => {
  assert.deepEqual(toHostValue(api.parseCsvTextSafely('Name,Status\n広告名,日本語テスト')), [
    ['Name', 'Status'], ['広告名', '日本語テスト'],
  ]);
});

test('CSV_SAFE_10_COLUMN_GUARD: only trailing short cells may be padded; extra cells fail', async () => {
  assert.deepEqual(toHostValue(api.validateCsvRowsStructure([
    ['A', 'B', 'C'], ['1', '2', ''],
  ])), [
    ['A', 'B', 'C'], ['1', '2', ''],
  ]);
  assert.deepEqual(toHostValue(api.validateCsvRowsStructure([
    ['A', 'B', 'C'], ['1', '2'],
  ])), [
    ['A', 'B', 'C'], ['1', '2', ''],
  ]);
  assert.throws(() => api.validateCsvRowsStructure([
    ['A', 'B', 'C'], ['1', '2', '3', 'UNSAFE EXTRA'],
  ]), /columns/i);
  await assert.rejects(
    () => api.parseCsv(namedBlob('SDF-AdGroupAds.csv', 'A,B,C\n1,2,3,UNSAFE EXTRA')),
    /columns/i,
  );
});

test('CSV_SAFE_DIRECT_AND_ZIP: direct CSV and ZIP CSV use the same safe parser', async () => {
  const csv = realAdGroupAdsCsv({ Name: '直接アップロード' }, { Name: 'ZIPアップロード' });
  const directRows = await api.parseCsv(namedBlob('SDF-AdGroupAds.csv', csv));

  const zip = new JSZip();
  zip.file('SDF-AdGroupAds.csv', csv);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const entries = await api.extractZip(zipBlob);
  assert.equal(entries.length, 1);
  const zipRows = await api.parseCsv(entries[0].blob);
  assert.deepEqual(zipRows, directRows);
  assert.equal(zipRows[1][0], '824056456475');
  assert.equal(zipRows[2][1], '200706646755');
});

test('CSV_SAFE_CLASSIFIER: AdGroupAds header classification remains unchanged', () => {
  const rows = toHostValue(api.parseCsvTextSafely(realAdGroupAdsCsv()));
  const info = api.dvUnifiedSdfHeaderInfo('SDF-AdGroupAds.csv', rows);
  assert.equal(info.canonical, 'AdGroupAds');
  assert.equal(info.standardHeader, true);
  assert.equal(info.hasExpectedId, true);
  assert.equal(info.hasName, true);
  assert.equal(info.hasStatus, true);
});
