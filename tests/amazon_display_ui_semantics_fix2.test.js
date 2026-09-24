// Amazon Display FIX2: internal Audience IDs and explicit contextual/category semantics.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');

const htmlPath = path.join(__dirname, '..', 'amazon_dsp_check.html');
const elements = new Map();
function element() {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false, files: [],
    innerHTML: '', parentNode: { replaceChild() {} }, querySelector() { return null; },
    querySelectorAll() { return []; }, removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: '',
  };
}
function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('resolveCreativeDownloadDateTime'));
  assert.ok(source);
  const exportBlock = '\nwindow.__fix2Api = { readSettingTableDSP, matchAndCompareDSP, checkAmazon, ' +
    'renderScResult, setResults(value) { scResults = value; }, ' +
    'getColumn(key) { return DL_COLUMNS.find(col => col.key === key); }, ' +
    'resultHtml() { return document.getElementById("sc-result-area").innerHTML; } };\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '})();');
  const document = {
    body: element(), documentElement: element(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const xlsxUtils = Object.assign({}, XLSX.utils, {
    sheet_to_json(ws, options) { return ws && Array.isArray(ws.__rows) ? ws.__rows : XLSX.utils.sheet_to_json(ws, options); },
  });
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: Object.assign({}, XLSX, { utils: xlsxUtils }),
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch])); },
    setTimeout() { return 1; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {},
    sendLog() { return Promise.resolve({}); },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__fix2Api;
}
const api = loadApi();
function workbook(sheets) {
  const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
  for (const [name, rows] of Object.entries(sheets)) wb.Sheets[name] = { '!ref': 'A1', __rows: rows };
  return wb;
}
function settingRow(contextual = '', category = '', audience = '') {
  const wb = workbook({ 'LineItem設定シート': [
    ['ラインアイテム名', 'Type', 'Only use contextual signals', 'In-market categories', 'Audience'],
    ['LI_FIX2', 'Display', contextual, category, audience],
  ] });
  return api.readSettingTableDSP(wb)[0];
}
function downloadRow(overrides = {}) {
  return { 'Line name*': 'LI_FIX2', 'Line type*': 'Display', 'Active/Inactive': 'Pause', ...overrides };
}
function compare(setting, download) {
  const item = api.matchAndCompareDSP([setting], { LI_FIX2: download }, 'amazon_dsp')[0];
  return { item, col(key) { return item.colResults.find(col => col.key === key); } };
}
function render(item, download) {
  elements.clear();
  api.setResults({ system: 'amazon_dsp', caseMode: 'initial', items: [item],
    settingCount: 1, downloadFiles: [], downloadData: { LI_FIX2: download } });
  api.renderScResult({});
  return api.resultHtml();
}
const AUDIENCE_ID = 'Audiences - include';
const CONTEXTUAL = 'Target Categories using only contextual signals?';
const CATEGORY = 'Contextual targeting by categories';

test('A1-A4: meaningful Audience ID stays in backend but has no result, table, toggle or review count', () => {
  const dl = downloadRow({ [AUDIENCE_ID]: '(70001) AND [NOT 70002]' });
  const { item, col } = compare(settingRow(), dl);
  assert.equal(dl[AUDIENCE_ID], '(70001) AND [NOT 70002]');
  assert.equal(api.getColumn(AUDIENCE_ID).internalOnly, true);
  assert.equal(col(AUDIENCE_ID), undefined);
  const html = render(item, dl);
  assert.doesNotMatch(html, /data-col-key="Audiences - include"/);
  assert.doesNotMatch(html, /オーディエンスID/);
  const baselineDl = downloadRow();
  const baselineHtml = render(compare(settingRow(), baselineDl).item, baselineDl);
  assert.equal(html.match(/要確認：(\d+)項目/)[1], baselineHtml.match(/要確認：(\d+)項目/)[1]);
  assert.equal(html.match(/不一致：(\d+)項目/)[1], baselineHtml.match(/不一致：(\d+)項目/)[1]);
  assert.match(html, /オーディエンス名/);
});

test('A5: Audience names still consumes the ID group and NOT structure', () => {
  const checkFn = api.getColumn('Audience names').checkFn;
  const s = { audience: 'Audience A' };
  const names = 'Audience A (70001)';
  const include = checkFn({ ...s }, names, { 'Audience names': names, [AUDIENCE_ID]: '(70001)' });
  const exclude = checkFn({ ...s }, names, { 'Audience names': names, [AUDIENCE_ID]: '[NOT 70001]' });
  assert.equal(include, true);
  assert.equal(exclude, false);
});

test('B1-B8: Only contextual parses Setting and compares all Yes/No/blank combinations', () => {
  const cases = [
    ['Yes', 'Yes', true], ['YES', 'no', false], ['No', 'No', true], ['no', 'YES', false],
    ['yes', 'YES', true], ['NO', 'no', true],
    ['', 'Yes', null], ['', 'No', null], ['', '', true],
  ];
  for (const [settingValue, downloadValue, expected] of cases) {
    const s = settingRow(settingValue);
    assert.equal(s.only_contextual, settingValue);
    const dl = downloadRow({ [CONTEXTUAL]: downloadValue });
    const { item, col } = compare(s, dl);
    assert.equal(col(CONTEXTUAL).result, expected, `${settingValue}/${downloadValue}`);
    if (!settingValue && downloadValue) {
      assert.match(col(CONTEXTUAL).note, /設定表に「Only use contextual signals」の指定がないため要確認/);
      assert.match(col(CONTEXTUAL).note, new RegExp(`DL：${downloadValue}`));
      assert.doesNotMatch(col(CONTEXTUAL).note, /デフォルト値|既定値/);
      const html = render(item, dl);
      const header = html.match(/<th data-col-key="Target Categories using only contextual signals\?"[\s\S]*?<\/th>/);
      assert.ok(header);
      assert.doesNotMatch(header[0], /display:none/);
      assert.match(html, /設定表に「Only use contextual signals」の指定がないため要確認/);
    }
  }
});

test('explicit N/A and Not applicable use the existing target-exclusion presentation', () => {
  for (const settingValue of ['N/A', 'Not applicable']) {
    const dl = downloadRow({ [CONTEXTUAL]: 'Yes' });
    const { item, col } = compare(settingRow(settingValue), dl);
    assert.equal(col(CONTEXTUAL).status, 'skip');
    assert.match(col(CONTEXTUAL).skipReason, /比較対象外/);
    const html = render(item, dl);
    assert.match(html, /対象外 \/ 設定表がN\/Aのため比較対象外/);
    const baselineDl = downloadRow();
    const baselineHtml = render(compare(settingRow(), baselineDl).item, baselineDl);
    assert.equal(html.match(/要確認：(\d+)項目/)[1], baselineHtml.match(/要確認：(\d+)項目/)[1]);
  }
});

test('C1-C6: In-market None/blank is match only when DL is blank; all other pairs review', () => {
  const cases = [
    ['None', '', true], ['', '', true], ['タオル', '268267011', null],
    ['None', '268267011', null], ['タオル', '', null],
    ['なし', '', true], ['無し', '', true], ['-', '', true],
  ];
  for (const [settingValue, downloadValue, expected] of cases) {
    const dl = downloadRow({ [CATEGORY]: downloadValue });
    const { item, col } = compare(settingRow('', settingValue), dl);
    assert.equal(col(CATEGORY).result, expected, `${settingValue}/${downloadValue}`);
    if (expected === null) {
      assert.match(col(CATEGORY).note, /カテゴリ名とBrowse Node IDを自動照合する権威マッピングがないため要確認/);
      const html = render(item, dl);
      const header = html.match(/<th data-col-key="Contextual targeting by categories"[\s\S]*?<\/th>/);
      assert.ok(header);
      assert.doesNotMatch(header[0], /display:none/);
      assert.match(html, /要確認/);
    }
  }
});

const realSetting = process.env.AMAZON_007_SETTING || '';
const realDownload = process.env.AMAZON_007_DOWNLOAD || '';
test('REAL 007: Audience ID internal, contextual blanks review, category None/blank match', {
  skip: !realSetting || !realDownload || !fs.existsSync(realSetting) || !fs.existsSync(realDownload),
}, () => {
  const setting = [{ wb: XLSX.readFile(realSetting), fileName: path.basename(realSetting) }];
  const download = [{ wb: XLSX.readFile(realDownload), fileName: path.basename(realDownload) }];
  const result = api.checkAmazon(setting, download, 'amazon_dsp', 'initial');
  const items = result.items;
  assert.equal(items.length, 14);
  assert.equal(items.every(item => !item.colResults.some(col => col.key === AUDIENCE_ID)), true);
  assert.equal(items.some(item => item.colResults.find(col => col.key === 'Audience names')?.result === true), true);
  const contextual = items.filter(item => {
    const col = item.colResults.find(c => c.key === CONTEXTUAL);
    return col && !col.sVal && /^(yes|no)$/i.test(col.dVal);
  });
  assert.ok(contextual.length > 0);
  assert.equal(contextual.every(item => item.colResults.find(col => col.key === CONTEXTUAL).result === null), true);
  const noneBlank = items.filter(item => {
    const col = item.colResults.find(c => c.key === CATEGORY);
    return col && /^(none|なし|無し|-)$/i.test(col.sVal) && !col.dVal;
  });
  assert.ok(noneBlank.length > 0);
  assert.equal(noneBlank.every(item => item.colResults.find(col => col.key === CATEGORY).result === true), true);
  const nameNode = items.filter(item => {
    const col = item.colResults.find(c => c.key === CATEGORY);
    return col && col.sVal === 'タオル' && col.dVal === '268267011';
  });
  assert.ok(nameNode.length > 0);
  assert.equal(nameNode.every(item => item.colResults.find(col => col.key === CATEGORY).result === null), true);
});
