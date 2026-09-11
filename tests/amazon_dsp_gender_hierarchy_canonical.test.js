// Amazon PVA Segment 名称：Demographic > Gender > の限定 canonical 比較
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');
const jkaPath = process.env.AMAZON_JKA_XLSX || '';
const downloadPath = process.env.AMAZON_JKA_DOWNLOAD_XLSX || '';

function createElement() {
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false,
    files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: '',
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('_segmentNamesEquivalent'));
  assert.ok(source, 'amazon_dsp_check application script should be present');
  const exportBlock = `
window.__amazonTestApi = {
  normalizeAudienceName: _normalizeAudienceName,
  segmentNamesEquivalent: _segmentNamesEquivalent,
  segmentNameFuzzyEquals: _segmentNameFuzzyEquals,
  audienceCheckFn: DL_COLUMNS_VIDEO.find(c => c.key === 'Audience names').checkFn,
  readSettingTableVideo,
  readDownloadDataVideoMulti,
  matchAndCompareVideo,
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById() { return createElement(); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL,
    XLSX: { utils: { sheet_to_json(ws) { return ws.__rows; } } },
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    setTimeout, addEventListener() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

function readWorkbookRows(filePath) {
  const script = `
import json, os, openpyxl
wb = openpyxl.load_workbook(os.environ['AMAZON_GENDER_TEST_XLSX'], data_only=True, read_only=True)
out = {}
for name in wb.sheetnames:
    rows = []
    for row in wb[name].iter_rows():
        rows.append(['' if cell.value is None else str(cell.value) for cell in row])
    out[name] = rows
print(json.dumps(out, ensure_ascii=False))
`;
  const result = spawnSync('py', ['-W', 'ignore', '-c', script], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, AMAZON_GENDER_TEST_XLSX: filePath, PYTHONIOENCODING: 'utf-8' },
  });
  assert.equal(result.status, 0, result.stderr || 'openpyxl failed');
  const rowsBySheet = JSON.parse(result.stdout);
  const SheetNames = Object.keys(rowsBySheet);
  const Sheets = Object.fromEntries(SheetNames.map(name => [name, {
    '!ref': 'A1:AZ500',
    A1: { v: rowsBySheet[name][0]?.[0] || '' },
    __rows: rowsBySheet[name],
  }]));
  return { SheetNames, Sheets };
}

const api = loadAmazonApi();
assert.equal(typeof api.normalizeAudienceName, 'function');
assert.equal(typeof api.segmentNamesEquivalent, 'function');
assert.equal(typeof api.segmentNameFuzzyEquals, 'function');

const equivalent = (setting, download) => api.segmentNamesEquivalent(setting, download);

test('G1: Demographic Gender Male equals Demo Male', () => {
  assert.equal(equivalent('Demographic > Gender > Male', 'Demo - Male'), true);
});

test('G2: Demographic Gender Female equals Demo Female', () => {
  assert.equal(equivalent('Demographic > Gender > Female', 'Demo - Female'), true);
});

test('G3: AudienceOne Gender Male existing match is preserved', () => {
  assert.equal(
    equivalent('Demographic > Gender > AudienceOne: Gender - Male', 'Demo - AudienceOne: Gender - Male'),
    true,
  );
});

test('G4: Intimate Merger Gender Male existing match is preserved', () => {
  assert.equal(
    equivalent('Demographic > Gender > Intimate Merger: Male', 'Demo - Intimate Merger: Male'),
    true,
  );
});

test('G5: Gender Male does not equal Gender Female', () => {
  assert.equal(equivalent('Demographic > Gender > Male', 'Demo - Female'), false);
});

test('G6: unrelated hierarchy ending in Male does not match Demo Male', () => {
  assert.equal(equivalent('Some Other Category > Male', 'Demo - Male'), false);
});

test('G7: existing Age hierarchy match remains true', () => {
  assert.equal(
    equivalent('Demographic > Age > AudienceOne: Age 20-21', 'Demo - AudienceOne: Age 20-21'),
    true,
  );
});

test('G8: existing long-last-segment fallback remains true', () => {
  assert.equal(equivalent('Some Other Category > Long Audience Name', 'Demo - Long Audience Name'), true);
});

test('G9: ordinary short Audience names do not gain false positives', () => {
  assert.equal(equivalent('Male', 'Demo - Female'), false);
  assert.equal(equivalent('AudienceOne', 'Demo - Intimate Merger'), false);
  assert.equal(equivalent('Female', 'Demo - Male'), false);
});

test('Real JKA download: all six LIs match the three Group2 Gender names', {
  skip: !jkaPath || !downloadPath || !fs.existsSync(jkaPath) || !fs.existsSync(downloadPath),
}, () => {
  const settingWorkbook = readWorkbookRows(jkaPath);
  const downloadWorkbook = readWorkbookRows(downloadPath);
  const settings = api.readSettingTableVideo(settingWorkbook, 'amazon_pva');
  const downloads = api.readDownloadDataVideoMulti([
    { wb: downloadWorkbook, fileName: path.basename(downloadPath) },
  ]);
  const results = api.matchAndCompareVideo(settings, downloads.liMap, 'amazon_pva');
  assert.equal(settings.length, 6);
  assert.equal(results.length, 6);
  const group2Names = settings[0].__SEGMENT_SHEET__.groups[1].segments;
  assert.deepEqual(JSON.parse(JSON.stringify(group2Names)), [
    'Demographic > Gender > AudienceOne: Gender - Male',
    'Demographic > Gender > Intimate Merger: Male',
    'Demographic > Gender > Male',
  ]);
  for (const result of results) {
    assert.equal(result.colResults.find(column => column.key === 'Audience names').result, true, result.liName);
  }
});
