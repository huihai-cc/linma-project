// Amazon DSP PVA 明确引用 Segment Sheet 解析测试
// 検証: _findSegmentForLI — 「セグメントシート1」で指定 等の安全な完全一致解決
// 対象: amazon_dsp_check.html
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false,
    files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('_readSegmentSheetDynamic'));
  assert.ok(source, 'amazon_dsp_check application script should be present');

  const exportBlock = '\n' +
    'window.__amazonTestApi = {\n' +
    '  _findSegmentForLI: typeof _findSegmentForLI === "function" ? _findSegmentForLI : undefined,\n' +
    '};\n';
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
    TextDecoder, Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

const api = loadAmazonApi();
assert.equal(typeof api._findSegmentForLI, 'function', '_findSegmentForLI should be exported');

function makeSegMap(names) {
  return Object.fromEntries(names.map((name, index) => [name, {
    groups: [{ id: `group-${index + 1}`, segments: [`audience-${index + 1}`] }],
    groupOps: [],
  }]));
}

test('A1: quoted 「セグメントシート1」で指定 resolves exactly Sheet1 and preserves groups', () => {
  const result = api._findSegmentForLI(
    '「セグメントシート1」で指定',
    makeSegMap(['セグメントシート1', 'セグメントシート2']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート1');
  assert.deepEqual(result.groups, [{ id: 'group-1', segments: ['audience-1'] }]);
});

test('A2: quoted 「セグメントシート2」で指定 resolves exactly Sheet2', () => {
  const result = api._findSegmentForLI(
    '「セグメントシート2」で指定',
    makeSegMap(['セグメントシート1', 'セグメントシート2']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート2');
  assert.deepEqual(result.groups, [{ id: 'group-2', segments: ['audience-2'] }]);
});

test('A3: direct Segment Sheet value resolves by exact sheet name', () => {
  const result = api._findSegmentForLI(
    'セグメントシート1',
    makeSegMap(['セグメントシート1', 'セグメントシート2']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート1');
  assert.deepEqual(result.groups, [{ id: 'group-1', segments: ['audience-1'] }]);
});

test('A4: quoted reference absorbs surrounding full-width and half-width spaces', () => {
  const result = api._findSegmentForLI(
    '「 セグメントシート1 」 で指定',
    makeSegMap(['セグメントシート1', 'セグメントシート2']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート1');
});

test('A5: missing quoted Sheet does not select an existing Sheet', () => {
  const result = api._findSegmentForLI(
    '「セグメントシート9」で指定',
    makeSegMap(['セグメントシート1', 'セグメントシート2']),
    'LI-TEST'
  );
  assert.equal(result.groups.length, 0);
  assert.equal(result.__sheetName__, undefined);
  assert.equal(result.__ambiguous__, undefined);
});

test('A6: quoted Sheet1 never prefix-matches Sheet10', () => {
  const result = api._findSegmentForLI(
    '「セグメントシート1」で指定',
    makeSegMap(['セグメントシート1', 'セグメントシート10']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート1');
  assert.deepEqual(result.groups, [{ id: 'group-1', segments: ['audience-1'] }]);
});

test('A7: existing CTV parenthesis reference remains supported', () => {
  const result = api._findSegmentForLI(
    'セグメントシート（CTV）',
    makeSegMap(['セグメントシート（CTV）', 'セグメントシート（SP）']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート（CTV）');
});

test('A8: existing default Segment Sheet reference remains supported', () => {
  const result = api._findSegmentForLI(
    'セグメントシート',
    makeSegMap(['セグメントシート', 'セグメントシート2']),
    'LI-TEST'
  );
  assert.equal(result.__sheetName__, 'セグメントシート');
});

test('A9: ordinary Audience names are not classified as Segment Sheet references', () => {
  for (const audienceVal of ['Demo - Female', 'AudienceOne Age 20-34']) {
    const result = api._findSegmentForLI(audienceVal, makeSegMap(['セグメントシート1']), 'LI-TEST');
    assert.equal(result.groups.length, 0, audienceVal);
    assert.equal(result.__sheetName__, undefined, audienceVal);
  }
});

test('A10: normalized duplicate exact candidates are ambiguous, never first-wins', () => {
  const result = api._findSegmentForLI(
    '「セグメントシート1」で指定',
    makeSegMap(['セグメントシート1', ' セグメントシート1 ']),
    'LI-TEST'
  );
  assert.equal(result.__ambiguous__, true);
  assert.equal(result.__sheetName__, undefined);
  assert.equal(result.groups.length, 0);
});

test('Explicit reference wrappers are limited to the confirmed quote forms', () => {
  for (const audienceVal of [
    '『セグメントシート1』で指定',
    '"セグメントシート1"で指定',
    '“セグメントシート1”で指定',
  ]) {
    const result = api._findSegmentForLI(audienceVal, makeSegMap(['セグメントシート1']), 'LI-TEST');
    assert.equal(result.__sheetName__, 'セグメントシート1', audienceVal);
  }
});
