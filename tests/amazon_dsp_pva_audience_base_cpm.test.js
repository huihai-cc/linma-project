// Amazon PVA: JKA Ver1-5 Audience extraction + PVA Base CPM retirement
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');
const jkaPath = process.env.AMAZON_JKA_XLSX || '';

function createElement(initialValue) {
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false,
    files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue || '',
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('_readSegmentSheetDynamic'));
  assert.ok(source, 'amazon_dsp_check application script should be present');

  const exportBlock = `
window.__amazonTestApi = {
  _readSegmentSheetOldFMT: typeof _readSegmentSheetOldFMT === 'function' ? _readSegmentSheetOldFMT : undefined,
  readAllSegmentSheets: typeof readAllSegmentSheets === 'function' ? readAllSegmentSheets : undefined,
  readSettingTableVideo: typeof readSettingTableVideo === 'function' ? readSettingTableVideo : undefined,
  readDownloadDataVideoMulti: typeof readDownloadDataVideoMulti === 'function' ? readDownloadDataVideoMulti : undefined,
  matchAndCompareVideo: typeof matchAndCompareVideo === 'function' ? matchAndCompareVideo : undefined,
  renderScResult: typeof renderScResult === 'function' ? renderScResult : undefined,
  getVideoColumn: function(key){ return DL_COLUMNS_VIDEO.find(c => c.key === key); },
  getDisplayColumn: function(key){ return DL_COLUMNS.find(c => c.key === key); },
  setRenderState: function(value){ scResults = value; },
  setFileLists: function(settingFiles, downloadFiles){ scFilesS = settingFiles; scFilesD = downloadFiles; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL,
    XLSX: { utils: { sheet_to_json(ws) { return ws.__rows; } } },
    esc(value) { return String(value ?? ''); }, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sendLog: async () => ({}), setTimeout, addEventListener() {},
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return { api: sandbox.__amazonTestApi, elements };
}

function readWorkbookRows(filePath) {
  const script = `
import json, os, openpyxl
wb = openpyxl.load_workbook(os.environ['AMAZON_PVA_TEST_XLSX'], data_only=True, read_only=True)
out = {}
for name in wb.sheetnames:
    rows = []
    for row in wb[name].iter_rows():
        rows.append(['' if cell.value is None else str(cell.value) for cell in row])
    out[name] = rows
print(json.dumps(out, ensure_ascii=False))
`;
  const result = spawnSync('py', ['-W', 'ignore', '-c', script], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, AMAZON_PVA_TEST_XLSX: filePath, PYTHONIOENCODING: 'utf-8' },
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

function getJkaWorkbook() {
  assert.ok(jkaPath && fs.existsSync(jkaPath), `AMAZON_JKA_XLSX must point to the real JKA XLSX: ${jkaPath}`);
  return readWorkbookRows(jkaPath);
}

const { api, elements } = loadAmazonApi();
assert.equal(typeof api._readSegmentSheetOldFMT, 'function');
assert.equal(typeof api.readAllSegmentSheets, 'function');
assert.equal(typeof api.readSettingTableVideo, 'function');
assert.equal(typeof api.matchAndCompareVideo, 'function');

test('JKA Ver1-5 real workbook extracts six LIs, two groups, and 11 unique source segments', {
  skip: !jkaPath || !fs.existsSync(jkaPath),
}, () => {
  const workbook = getJkaWorkbook();
  const segmentMap = api.readAllSegmentSheets(workbook);
  const segment = segmentMap['セグメントシート'];
  assert.ok(segment, 'セグメントシート should be read');
  assert.ok(segment.groupOps.includes('and'), 'row-3 および(and) should be captured');
  assert.deepEqual(JSON.parse(JSON.stringify(segment.groups.map(group => group.type))), ['Include', 'Include']);
  assert.deepEqual(JSON.parse(JSON.stringify(segment.groups.map(group => group.segments.length))), [8, 3]);

  const settingRows = api.readSettingTableVideo(workbook, 'amazon_pva');
  assert.equal(settingRows.length, 6);
  for (const row of settingRows) {
    assert.equal(row.__SEGMENT_SHEET_NAME__, 'セグメントシート');
    assert.deepEqual(JSON.parse(JSON.stringify(row.__SEGMENT_SHEET__.groups.map(group => group.segments.length))), [8, 3]);
    assert.equal(row.base_cpm, '1550', 'raw setting Base CPM must remain readable');
  }
  const sourceSegments = segment.groups.flatMap(group => group.segments);
  assert.equal(new Set(sourceSegments).size, 11);

  // sGetForCol('Audience names') → Audience names checkFn の実経路を通す。
  const ids = sourceSegments.map((_, index) => String(100001 + index));
  const idByName = new Map(sourceSegments.map((name, index) => [name, ids[index]]));
  const audienceNames = sourceSegments.map(name => `${name} (${idByName.get(name)})`).join('; ');
  const audienceInclude = segment.groups
    .map(group => `(${group.segments.map(name => idByName.get(name)).join('; ')})`).join('');
  const compared = api.matchAndCompareVideo(
    [settingRows[0]],
    { [settingRows[0].__LI_NAME__]: {
      'Audience names': audienceNames,
      'Audiences - include': audienceInclude,
    } },
    'amazon_pva',
  )[0];
  assert.equal(compared.colResults.find(column => column.key === 'Audience names').result, true);

  // 最初の欠落層を検出し、双方向比較の不一致理由を確認する。
  const firstLoss = sourceSegments[0];
  const reducedNames = sourceSegments.slice(1).map(name => `${name} (${idByName.get(name)})`).join('; ');
  const reducedInclude = segment.groups
    .map((group, groupIndex) => `(${group.segments
      .filter((name, segmentIndex) => !(groupIndex === 0 && segmentIndex === 0))
      .map(name => idByName.get(name)).join('; ')})`)
    .join('');
  const lossSetting = settingRows[0];
  const lossResult = api.getVideoColumn('Audience names').checkFn(
    lossSetting,
    reducedNames,
    { 'Audience names': reducedNames, 'Audiences - include': reducedInclude },
  );
  assert.equal(lossResult, false);
  assert.match(lossSetting.__audience_diff__, new RegExp(firstLoss.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

function makeSettingRow(system, baseCpm) {
  return {
    __LI_NAME__: 'LI-TEST', __SYSTEM__: system, __IO_NAME__: '',
    media: 'Streaming TV', base_cpm: baseCpm == null ? '' : String(baseCpm),
    audience: '', location: '', region: '', deal_id: '', deal_type: 'Preferred deal',
    __SEGMENT_SHEET__: { groups: [] },
  };
}

test('Base CPM is absent from PVA result models regardless of source values', () => {
  for (const [setting, download] of [[1550, 1550], [1550, 999], [1550, ''], ['', 1550]]) {
    const item = api.matchAndCompareVideo(
      [makeSettingRow('amazon_pva', setting)],
      { 'LI-TEST': { 'Base supply bid*': String(download) } },
      'amazon_pva',
    )[0];
    assert.equal(item.colResults.some(column => column.key === 'Base supply bid*'), false);
  }
});

test('Base CPM values do not change PVA mismatch or review counts', () => {
  const equal = api.matchAndCompareVideo(
    [makeSettingRow('amazon_pva', 1550)],
    { 'LI-TEST': { 'Base supply bid*': '1550' } },
    'amazon_pva',
  )[0];
  const different = api.matchAndCompareVideo(
    [makeSettingRow('amazon_pva', 1550)],
    { 'LI-TEST': { 'Base supply bid*': '999' } },
    'amazon_pva',
  )[0];
  assert.equal(different.mismatchCount, equal.mismatchCount);
  assert.equal(different.needsReview, equal.needsReview);
  assert.equal(JSON.stringify(different.colResults), JSON.stringify(equal.colResults));
});

test('download parser continues to retain raw Base supply bid* input', () => {
  const rows = [
    ['Line name', 'Video Ad Content Type', 'Base supply bid', 'Pacing profile', 'Audience names'],
    ['LI-DL', 'STREAMING_TV', '1550', 'Evenly', ''],
  ];
  const workbook = {
    SheetNames: ['VIDEO LINE ITEMS'],
    Sheets: { 'VIDEO LINE ITEMS': { '!ref': 'A1:E2', __rows: rows } },
  };
  const parsed = api.readDownloadDataVideoMulti([{ wb: workbook, fileName: 'download.csv' }]);
  assert.equal(parsed.liMap['LI-DL']['Base supply bid'], '1550');
});

test('Base CPM columns declare the shared Amazon QC exclusion', () => {
  assert.equal(api.getVideoColumn('Base supply bid*').amazonQcExcluded, true);
  assert.equal(api.getDisplayColumn('Base supply bid*').amazonQcExcluded, true);
});

test('PVA Base CPM is absent from normal columns and the toggle panel', () => {
  assert.equal(typeof api.renderScResult, 'function');
  api.setFileLists([{ name: 'setting.xlsx' }], []);
  api.setRenderState({
    system: 'amazon_pva', caseMode: 'initial', settingCount: 1,
    downloadFiles: [], downloadData: null,
    items: [{
      liName: 'LI-TEST', __IO_NAME__: 'IO-TEST', found: true,
      matchedName: 'LI-TEST', matchedIOName: '', matchedFileD: '',
      mismatchCount: 0, needsReview: false, coverageWarnings: [],
      colResults: [{
        key: 'Base supply bid*', ja: 'ベースCPM', sVal: '1550', dVal: '999',
        result: null, skipReason: 'PVAではBase CPMをQC対象外', status: 'skip',
      }],
    }],
  });
  api.renderScResult({ caseName: 'test', sessionId: 'test' });
  const html = elements.get('sc-result-area').innerHTML;
  assert.equal(html.includes('ベースCPM'), false);
  assert.equal(html.includes('data-col-key="Base supply bid*"'), false);
});
