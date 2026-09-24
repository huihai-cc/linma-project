// Amazon CR scope: an exact setting/download pair with both parent LIs missing is review.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');

const htmlPath = path.join(__dirname, '..', 'amazon_dsp_check.html');

function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('resolveCreativeDownloadDateTime'));
  assert.ok(source);
  const exportBlock = '\nwindow.__orphanApi = { checkAmazon, readCreativeSettingDataMulti, ' +
    'detectCaseModeAuto, renderCreativeResultSection };\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '})();');
  function element() {
    return {
      addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
      closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false, files: [],
      innerHTML: '', parentNode: { replaceChild() {} }, querySelector() { return null; },
      querySelectorAll() { return []; }, removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
      style: { display: '', setProperty() {} }, textContent: '', value: '',
    };
  }
  const elements = new Map();
  const document = {
    body: element(), documentElement: element(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const xlsxUtils = Object.assign({}, XLSX.utils, {
    sheet_to_json(ws, options) {
      return ws && Array.isArray(ws.__rows) ? ws.__rows : XLSX.utils.sheet_to_json(ws, options);
    },
  });
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: Object.assign({}, XLSX, { utils: xlsxUtils }),
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[ch]));
    },
    setTimeout() { return 1; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {},
    sendLog() { return Promise.resolve({}); },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__orphanApi;
}

const api = loadApi();

function workbook(sheets) {
  const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
  for (const [name, rows] of Object.entries(sheets)) wb.Sheets[name] = { '!ref': 'A1', __rows: rows };
  return wb;
}

function syntheticCase({ extraSetting = [], extraDownload = [], extraDownloadLis = [] } = {}) {
  const setting = workbook({
    'LineItem設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Start time', 'End day', 'End time'],
      ['LI_NORMAL', 'Display', '2026/9/25', '00:00', '2026/10/31', '23:59'],
    ],
    '入稿物管理表 (ReC_ASIN)': [
      ['ラインアイテム名', '設定クリエイティブ名', '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'],
      ['LI_NORMAL', 'CR_NORMAL', 'LIに準ずる', '00:00', 'LIに準ずる', '23:59', '追加'],
      ['LI_ORPHAN', 'CR_ORPHAN', 'LIに準ずる', '00:00', 'LIに準ずる', '23:59', '追加'],
    ],
    '入稿物管理表(Thirdparty用)': [
      ['ラインアイテム名', '設定クリエイティブ名', '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'],
      ...extraSetting,
    ],
  });
  const download = workbook({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Order name - (READ ONLY)',
        'Line start date', 'Line end date', 'Active/Inactive'],
      ['LI_NORMAL', 'Display', '', 'ORDER_1', '09-25-2026-00-00', '10-31-2026-23-59', 'Pause'],
      ...extraDownloadLis,
    ],
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      ['LI_NORMAL', 'CR_NORMAL', '', '', 'ACTIVE'],
      ['LI_ORPHAN', 'CR_ORPHAN', '', '', 'ACTIVE'],
      ...extraDownload,
    ],
  });
  return {
    setting: [{ wb: setting, fileName: 'setting.xlsx' }],
    download: [{ wb: download, fileName: 'download.xlsx' }],
  };
}

function check(fixture, caseMode = 'initial') {
  return api.checkAmazon(fixture.setting, fixture.download, 'amazon_dsp', caseMode).creative;
}

test('R1-R5: exact orphan pair becomes review with both parent and date reasons, never match/mismatch/download-only', () => {
  const creative = check(syntheticCase());
  const item = creative.items.find(row => row.liName === 'LI_ORPHAN');
  assert.ok(item);
  assert.equal(item.matchStatus, 'review');
  assert.equal(creative.normalScopeCount, 1);
  assert.equal(creative.orphanReviewCount, 1);
  assert.equal(creative.settingCount, 2);
  assert.equal(creative.downloadMatchedCount, 2);
  assert.equal(creative.matchCount, 1);
  assert.equal(creative.mismatchCount, 0);
  assert.equal(creative.downloadOnlyCount, 0);
  assert.ok(item.settingSource && item.downloadSource);
  assert.equal(item.overallMatch, null);
  assert.match(item.unmatchedReason, /設定表LineItem未発見/);
  assert.match(item.unmatchedReason, /ダウンロードLineItem未発見/);
  assert.match(item.unmatchedReason, /LIに準ずる日時を解決できない/);
  for (const key of ['startDate', 'startTime', 'endDate', 'endTime']) {
    assert.equal(item.fields[key].status, 'review');
    assert.equal(item.fields[key].expected, '');
    assert.equal(item.fields[key].actual, '');
  }
  assert.equal(item.fields.status.status, 'not_compared');
  const html = api.renderCreativeResultSection(creative);
  assert.match(html, /通常比較：1件/);
  assert.match(html, /LI＋CRペア確認：2件/);
  assert.match(html, /要確認：1件/);
  const rowHtml = html.slice(html.indexOf('LI_ORPHAN'), html.indexOf('</tr>', html.indexOf('LI_ORPHAN')));
  assert.match(rowHtml, /要確認/);
  assert.match(rowHtml, /設定表LineItem未発見/);
  assert.match(rowHtml, /ダウンロードLineItem未発見/);
  assert.doesNotMatch(rowHtml, /設定表未発見|CR名不一致/);
});

test('R6: setting CR without an exact download pair does not enter orphan review', () => {
  const fixture = syntheticCase();
  fixture.download[0].wb.Sheets['CREATIVE ASSOCIATIONS'].__rows.splice(2, 1);
  const creative = check(fixture);
  assert.equal(creative.items.some(row => row.liName === 'LI_ORPHAN'), false);
});

test('R7: same creative name under another LI is not an exact pair', () => {
  const fixture = syntheticCase();
  fixture.download[0].wb.Sheets['CREATIVE ASSOCIATIONS'].__rows[2][0] = 'LI_DIFFERENT';
  const creative = check(fixture);
  assert.equal(creative.items.some(row => row.matchStatus === 'review'), false);
  assert.equal(creative.items.some(row => row.liName === 'LI_DIFFERENT' && row.matchStatus === 'download_only'), true);
});

test('R8: normal LI retains date inheritance and case-mode status rules', () => {
  const fixture = syntheticCase();
  const initial = check(fixture, 'initial').items.find(row => row.liName === 'LI_NORMAL');
  const addition = check(fixture, 'creative_addition').items.find(row => row.liName === 'LI_NORMAL');
  assert.equal(initial.matchStatus, 'match');
  assert.equal(initial.fields.startDate.downloadSource, 'LIに準ずる');
  assert.equal(addition.matchStatus, 'mismatch');
  assert.equal(addition.fields.status.expected, 'INACTIVE');
  assert.equal(addition.fields.status.actual, 'ACTIVE');
});

test('R9: another valid sheet cannot contribute a historical pair without an exact download association', () => {
  const fixture = syntheticCase({
    extraSetting: [
      ['LI_HISTORY', 'CR_HISTORY', 'LIに準ずる', '00:00', 'LIに準ずる', '23:59', '追加'],
      ['LI_OLD', 'CR_SHARED', 'LIに準ずる', '00:00', 'LIに準ずる', '23:59', '追加'],
    ],
    extraDownload: [['LI_OTHER', 'CR_SHARED', '', '', 'ACTIVE']],
  });
  const creative = check(fixture);
  assert.equal(creative.items.some(row => row.liName === 'LI_HISTORY'), false);
  assert.equal(creative.items.some(row => row.liName === 'LI_OLD'), false);
  assert.equal(creative.items.some(row => row.liName === 'LI_OTHER' && row.matchStatus === 'download_only'), true);
});

test('orphan review requires the download parent LI to be missing too', () => {
  const fixture = syntheticCase({
    extraDownloadLis: [['LI_ORPHAN', 'Display', '', 'ORDER_1', '09-25-2026-00-00', '10-31-2026-23-59', 'Pause']],
  });
  const creative = check(fixture);
  assert.equal(creative.items.some(row => row.matchStatus === 'review'), false);
  assert.equal(creative.items.some(row => row.liName === 'LI_ORPHAN' && row.matchStatus === 'download_only'), true);
});

test('creative_addition still makes the orphan review independent of ACTIVE/INACTIVE comparison', () => {
  const creative = check(syntheticCase(), 'creative_addition');
  const normal = creative.items.find(row => row.liName === 'LI_NORMAL');
  const orphan = creative.items.find(row => row.liName === 'LI_ORPHAN');
  assert.equal(normal.matchStatus, 'mismatch');
  assert.equal(orphan.matchStatus, 'review');
  assert.equal(orphan.fields.status.status, 'not_compared');
  assert.equal(creative.statusMismatchCount, 1);
});

test('creative_addition with only an exact orphan has no false NO_ADDITION_ROWS diagnostic', () => {
  const fixture = syntheticCase();
  fixture.setting[0].wb.Sheets['入稿物管理表 (ReC_ASIN)'].__rows.splice(1, 1);
  const creative = check(fixture, 'creative_addition');
  assert.equal(creative.normalScopeCount, 0);
  assert.equal(creative.orphanReviewCount, 1);
  assert.equal(creative.items[0].matchStatus, 'review');
  assert.equal(creative.diagnostics.some(row => row.code === 'NO_ADDITION_ROWS'), false);
});

const realSetting = process.env.AMAZON_007_SETTING || '';
const realDownload = process.env.AMAZON_007_DOWNLOAD || '';
test('REAL 007: 28 normal plus 20 exact orphan reviews represent all 48 setting CR pairs', {
  skip: !realSetting || !realDownload || !fs.existsSync(realSetting) || !fs.existsSync(realDownload),
}, () => {
  const setting = [{ wb: XLSX.readFile(realSetting), fileName: path.basename(realSetting) }];
  const download = [{ wb: XLSX.readFile(realDownload), fileName: path.basename(realDownload) }];
  const raw = api.readCreativeSettingDataMulti(setting, 'initial');
  const result = api.checkAmazon(setting, download, 'amazon_dsp', 'initial');
  const creative = result.creative;
  const reviewRows = creative.items.filter(row => row.matchStatus === 'review');
  assert.equal(reviewRows.length, 20);
  assert.equal(raw.rows.length, 48);
  assert.equal(creative.normalScopeCount, 28);
  assert.equal(creative.orphanReviewCount, 20);
  assert.equal(creative.settingCount, 48);
  assert.equal(creative.downloadCount, 48);
  assert.equal(creative.items.length, 48);
  assert.equal(creative.downloadMatchedCount, 48);
  assert.equal(creative.downloadOnlyCount, 0);
  assert.equal(creative.matchCount, 28);
  assert.equal(creative.mismatchCount, 0);
  assert.equal(new Set(reviewRows.map(row => row.liName)).size, 10);
  assert.equal(creative.items.filter(row => row.matchStatus === 'review').length, 20);
  assert.equal(reviewRows.every(row => row.settingSource && row.downloadSource), true);
  const settingLiNames = new Set(result.settingData.map(row => row.__LI_NAME__));
  const downloadLiNames = new Set(Object.keys(result.downloadData));
  assert.equal(reviewRows.every(row => !settingLiNames.has(row.liName) && row.settingLiMissing), true);
  assert.equal(reviewRows.every(row => !downloadLiNames.has(row.liName) && row.downloadLiMissing), true);
  assert.equal(reviewRows.every(row => row.dateResolution === 'unresolved'), true);
  assert.equal(reviewRows.every(row => /設定表LineItem未発見/.test(row.unmatchedReason)), true);
  assert.equal(reviewRows.every(row => /ダウンロードLineItem未発見/.test(row.unmatchedReason)), true);
  assert.equal(reviewRows.every(row => /LIに準ずる日時を解決できない/.test(row.unmatchedReason)), true);
  assert.equal(reviewRows.every(row => ['startDate', 'startTime', 'endDate', 'endTime']
    .every(key => row.fields[key].status === 'review' && !row.fields[key].expected && !row.fields[key].actual)), true);
  assert.equal(api.detectCaseModeAuto(setting, download).caseMode, 'creative_addition');
  const addition = api.checkAmazon(setting, download, 'amazon_dsp', 'creative_addition').creative;
  assert.equal(addition.orphanReviewCount, 20);
  assert.equal(addition.items.filter(row => row.matchStatus === 'review').length, 20);
  assert.equal(addition.mismatchCount, 28);
  assert.equal(addition.statusMismatchCount, 28);
});
