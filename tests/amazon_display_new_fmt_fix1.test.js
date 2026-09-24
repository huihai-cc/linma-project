// Amazon Display 新FMT FIX1 focused tests.
// Scope: Base CPM exclusion, Product ASIN, In-market review, unsupported Display fields, CR single header.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');

const htmlPath = path.join(__dirname, '..', 'amazon_dsp_check.html');
const renderedElements = new Map();

function createElement(initialValue) {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false, files: [],
    innerHTML: '', parentNode: { replaceChild() {} }, querySelector() { return null; },
    querySelectorAll() { return []; }, removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue || '',
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('resolveCreativeDownloadDateTime'));
  assert.ok(source, 'Amazon application script is present');

  const exportBlock = '\n' +
'window.__amazonFix1TestApi = {\n' +
'  readSettingTableDSP: typeof readSettingTableDSP === "function" ? readSettingTableDSP : undefined,\n' +
'  matchAndCompareDSP: typeof matchAndCompareDSP === "function" ? matchAndCompareDSP : undefined,\n' +
'  matchAndCompareVideo: typeof matchAndCompareVideo === "function" ? matchAndCompareVideo : undefined,\n' +
'  matchAndCompareDSPVideo: typeof matchAndCompareDSPVideo === "function" ? matchAndCompareDSPVideo : undefined,\n' +
'  checkAmazon: typeof checkAmazon === "function" ? checkAmazon : undefined,\n' +
'  auditVideoFieldCoverage: typeof auditVideoFieldCoverage === "function" ? auditVideoFieldCoverage : undefined,\n' +
'  creativeHeaderInfo: typeof _creativeSettingHeaderInfo === "function" ? _creativeSettingHeaderInfo : undefined,\n' +
'  readCreativeSettingDataMulti: typeof readCreativeSettingDataMulti === "function" ? readCreativeSettingDataMulti : undefined,\n' +
'  detectCaseModeAuto: typeof detectCaseModeAuto === "function" ? detectCaseModeAuto : undefined,\n' +
'  getColumns: function(system){ return system === "amazon_dsp" ? DL_COLUMNS : (system === "amazon_dsp_video" ? DL_COLUMNS_DSP_VIDEO : DL_COLUMNS_VIDEO); },\n' +
'  setScResults: function(value){ scResults = value; },\n' +
'  renderScResult: typeof renderScResult === "function" ? renderScResult : undefined,\n' +
'  getResultHtml: function(){ return document.getElementById("sc-result-area").innerHTML; },\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!renderedElements.has(id)) renderedElements.set(id, createElement());
      return renderedElements.get(id);
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
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[ch]));
    },
    setTimeout() { return 1; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    sendLog() { return Promise.resolve({}); },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonFix1TestApi;
}

const api = loadAmazonApi();

function makeWorkbook(sheets) {
  const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
  for (const [name, rows] of Object.entries(sheets)) wb.Sheets[name] = { '!ref': 'A1', __rows: rows };
  return wb;
}

function wrapWorkbook(wb) {
  return [{ wb, fileName: 'fix1-test.xlsx' }];
}

function makeDisplaySetting(productRaw, category) {
  return makeWorkbook({
    'LineItem設定シート': [
      ['ラインアイテム名', 'Type', 'Base supply bid', 'Product categories', 'Product', 'In-market categories'],
      ['LI_FIX1', 'Display', '100', 'Home & Garden -General', productRaw || '', category || ''],
    ],
  });
}

function makeDisplayDownload(overrides) {
  return {
    'Line type*': 'Display',
    'Line name*': 'LI_FIX1',
    'Base supply bid*': '200',
    'Product categories*': 'Home & Garden -General',
    'Active/Inactive': 'Pause',
    ...(overrides || {}),
  };
}

function makeDisplayResult(downloadOverrides, productRaw, category) {
  const settingRows = api.readSettingTableDSP(makeDisplaySetting(productRaw, category));
  const downloadRow = makeDisplayDownload(downloadOverrides);
  const items = api.matchAndCompareDSP(settingRows, { LI_FIX1: downloadRow }, 'amazon_dsp');
  return { settingRows, downloadRow, items };
}

function renderItems(system, items, downloadData) {
  renderedElements.clear();
  api.setScResults({
    system,
    caseMode: 'initial',
    items,
    settingCount: items.length,
    downloadFiles: [],
    downloadData: downloadData || {},
  });
  api.renderScResult({});
  return api.getResultHtml();
}

const sampleAsins = ['B000000001', 'B000000002', 'B000000003'];
const excludeRaw = '↓を除外で登録\nb000000001\nB000000002\nB000000002\nB000000003';

test('A1/A4: Display Base CPMは比較結果・不一致数・画面・切替UIから完全に除外される', () => {
  const baseline = makeDisplayResult({ 'Base supply bid*': '100' });
  const { items, downloadRow } = makeDisplayResult({ 'Base supply bid*': '999' });
  assert.equal(items[0].colResults.some(col => col.key === 'Base supply bid*'), false);
  assert.equal(items[0].mismatchCount, baseline.items[0].mismatchCount);
  const html = renderItems('amazon_dsp', items, { LI_FIX1: downloadRow });
  const baselineHtml = renderItems('amazon_dsp', baseline.items, { LI_FIX1: baseline.downloadRow });
  assert.doesNotMatch(html, /Base supply bid|ベースCPM/);
  assert.equal(Number(html.match(/不一致：(\d+)項目/)[1]), Number(baselineHtml.match(/不一致：(\d+)項目/)[1]));
  assert.equal(Number(html.match(/要確認：(\d+)項目/)[1]), Number(baselineHtml.match(/要確認：(\d+)項目/)[1]));
});

test('A2/A3: OTTとPVAでもBase CPMは結果モデルに入らない', () => {
  for (const system of ['amazon_ott', 'amazon_pva']) {
    const item = api.matchAndCompareVideo(
      [{ __LI_NAME__: 'LI_FIX1', __SYSTEM__: system, base_cpm: '100' }],
      { LI_FIX1: { 'Line name*': 'LI_FIX1', 'Line type*': 'Video', 'Base supply bid*': '999' } },
      system,
    )[0];
    assert.equal(item.colResults.some(col => col.key === 'Base supply bid*'), false, system);
  }
  const dspVideo = api.matchAndCompareDSPVideo(
    [{ __LI_NAME__: 'LI_FIX1', base_cpm: '100' }],
    { LI_FIX1: { 'Line name*': 'LI_FIX1', 'Base supply bid*': '999' } },
    'amazon_dsp_video',
  )[0];
  assert.equal(dspVideo.colResults.some(col => col.key === 'Base supply bid*'), false);
});

test('A4: Base CPM is excluded from video coverage warnings on both sides', () => {
  const warnings = api.auditVideoFieldCoverage(
    { base_cpm: '100' },
    { 'Base supply bid*': '200', 'Base supply bid': '200' },
  );
  assert.deepEqual(Array.from(warnings), []);
});

test('B1/B2: Product raw・directive・重複排除ASINを解析し、順序に依存せず除外商品を比較する', () => {
  const { settingRows, items } = makeDisplayResult(
    { 'Contextual excluding by products': sampleAsins.slice().reverse().join('; ') },
    excludeRaw,
  );
  assert.equal(settingRows[0].product.raw, excludeRaw);
  assert.equal(settingRows[0].product_small, 'Home & Garden -General');
  assert.equal(settingRows[0].product.directive, '↓を除外で登録');
  assert.equal(settingRows[0].product.mode, 'exclude');
  assert.deepEqual(Array.from(settingRows[0].product.asins), sampleAsins);
  const col = items[0].colResults.find(value => value.key === 'Contextual excluding by products');
  assert.equal(col.result, true);
  assert.match(col.sVal, /↓を除外で登録/);
});

test('B3/B4: 設定表のみ／DLのみのASIN差分は双方向に不一致詳細を出す', () => {
  const missing = makeDisplayResult(
    { 'Contextual excluding by products': 'B000000001; B000000002' }, excludeRaw,
  ).items[0].colResults.find(value => value.key === 'Contextual excluding by products');
  assert.equal(missing.result, false);
  assert.match(missing.note, /【設定表にあるがDLにないASIN】[\s\S]*B000000003/);

  const extra = makeDisplayResult(
    { 'Contextual excluding by products': 'B000000001; B000000002; B000000003; B000000004' }, excludeRaw,
  ).items[0].colResults.find(value => value.key === 'Contextual excluding by products');
  assert.equal(extra.result, false);
  assert.match(extra.note, /【DLにあるが設定表にないASIN】[\s\S]*B000000004/);
});

test('B5: 未知のProduct directiveは推測せずreviewにする', () => {
  const { items, downloadRow } = makeDisplayResult(
    { 'Contextual excluding by products': 'B000000001' },
    'Include products\nB000000001',
  );
  const col = items[0].colResults.find(value => value.key === 'Contextual excluding by products');
  assert.equal(col.result, null);
  assert.match(col.note, /要確認|未対応/);
  const html = renderItems('amazon_dsp', items, { LI_FIX1: downloadRow });
  const productHeader = html.match(/<th data-col-key="Contextual excluding by products"[\s\S]*?<\/th>/);
  assert.ok(productHeader);
  assert.doesNotMatch(productHeader[0], /display:none/);
  assert.match(html, /Productの指示/);
});

test('C1/C2/C3: In-market名とBrowse Node IDは一致・不一致にせず、理由付きreviewにする', () => {
  const { items } = makeDisplayResult(
    { 'Contextual targeting by categories': '268267011', 'Target Categories using only contextual signals?': 'Yes' },
    '',
    'タオル',
  );
  const category = items[0].colResults.find(value => value.key === 'Contextual targeting by categories');
  assert.equal(category.sVal, 'タオル');
  assert.equal(category.dVal, '268267011');
  assert.equal(category.result, null);
  assert.match(category.note, /権威マッピングがないため要確認/);
  const contextual = items[0].colResults.find(value => value.key === 'Target Categories using only contextual signals?');
  assert.equal(contextual.result, null);
  assert.match(contextual.note, /設定表に「Only use contextual signals」の指定がないため要確認/);
  const html = renderItems('amazon_dsp', items, { LI_FIX1: makeDisplayDownload({
    'Contextual targeting by categories': '268267011',
    'Target Categories using only contextual signals?': 'Yes',
  }) });
  assert.match(html, /タオル/);
  assert.match(html, /268267011/);
  assert.match(html, /権威マッピングがないため要確認/);
});

test('D1/D2/D3: Displayの未対応有値は初期表示review、空値は非表示、QC除外が優先', () => {
  assert.equal(api.getColumns('amazon_dsp')
    .find(col => col.key === 'Contextual targeting by categories').checkFn, null);
  const meaningful = makeDisplayResult({
    'Contextual targeting by categories': '268267011',
    'Base supply bid*': '999',
  });
  const html = renderItems('amazon_dsp', meaningful.items, { LI_FIX1: meaningful.downloadRow });
  const meaningfulHeader = html.match(/<th data-col-key="Contextual targeting by categories"[\s\S]*?<\/th>/);
  assert.ok(meaningfulHeader);
  assert.doesNotMatch(meaningfulHeader[0], /display:none/);
  assert.doesNotMatch(html, /Base supply bid|ベースCPM/);
  const reviewCount = Number(html.match(/要確認：(\d+)項目/)[1]);
  const noUnsupported = makeDisplayResult({ 'Base supply bid*': '999' });
  const noUnsupportedHtml = renderItems('amazon_dsp', noUnsupported.items, { LI_FIX1: noUnsupported.downloadRow });
  const noUnsupportedReviewCount = Number(noUnsupportedHtml.match(/要確認：(\d+)項目/)[1]);
  assert.ok(reviewCount > noUnsupportedReviewCount);
  const sameUnsupportedDifferentBase = makeDisplayResult({
    'Contextual targeting by categories': '268267011',
    'Base supply bid*': '',
  });
  const sameUnsupportedDifferentBaseHtml = renderItems(
    'amazon_dsp', sameUnsupportedDifferentBase.items, { LI_FIX1: sameUnsupportedDifferentBase.downloadRow },
  );
  assert.equal(reviewCount, Number(sameUnsupportedDifferentBaseHtml.match(/要確認：(\d+)項目/)[1]));

  const empty = makeDisplayResult({});
  const emptyHtml = renderItems('amazon_dsp', empty.items, { LI_FIX1: empty.downloadRow });
  const emptyHeader = emptyHtml.match(/<th data-col-key="Contextual targeting by categories"[\s\S]*?<\/th>/);
  assert.ok(emptyHeader);
  assert.match(emptyHeader[0], /display:none/);
});

test('E1/E5/E6: 新FMTの単一クリエイティブ名は完全一致ヘッダーとして各入稿物管理表で読める', () => {
  const singleHeader = ['ラインアイテム名', '設定クリエイティブ名\n※半角英数字のみ',
    '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'];
  const info = api.creativeHeaderInfo([singleHeader]);
  assert.equal(info.complete, true);
  assert.equal(info.cols.creativeSingle, 1);

  for (const sheetName of ['入稿物管理表 (ReC_ASIN)', '入稿物管理表 (ABC_BSC)', '入稿物管理表(Thirdparty用)']) {
    const wb = makeWorkbook({
      [sheetName]: [
        singleHeader,
        ['LI_FIX1', 'CR_SINGLE', '2026/9/1', '0:00', '2026/9/30', '23:59', ''],
      ],
    });
    const parsed = api.readCreativeSettingDataMulti(wrapWorkbook(wb), 'initial', ['LI_FIX1']);
    assert.equal(parsed.rows.length, 1, sheetName);
    assert.equal(parsed.rows[0].creativeName, 'CR_SINGLE', sheetName);
    assert.equal(parsed.rows[0].creativeNameSource, '設定クリエイティブ名', sheetName);
  }
});

test('E3/E4: 旧FMT auto/changed headerとchanged優先順位を維持する', () => {
  const headers = ['ラインアイテム名', '設定クリエイティブ名（自動入力）', '設定クリエイティブ名（変更した場合）',
    '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'];
  const info = api.creativeHeaderInfo([headers]);
  assert.equal(info.cols.creativeAuto, 1);
  assert.equal(info.cols.creativeChanged, 2);
  assert.equal(info.cols.creativeSingle, undefined);
  const parsed = api.readCreativeSettingDataMulti(wrapWorkbook(makeWorkbook({
    '入稿物管理表': [headers, ['LI_FIX1', 'CR_AUTO', 'CR_CHANGED', '2026/9/1', '0:00', '2026/9/30', '23:59', '']],
  })), 'initial', ['LI_FIX1']);
  assert.equal(parsed.rows[0].creativeName, 'CR_CHANGED');
  assert.equal(parsed.rows[0].creativeNameSource, '変更した場合');

  const mixedHeaders = ['ラインアイテム名', '設定クリエイティブ名',
    '設定クリエイティブ名（自動入力）', '設定クリエイティブ名（変更した場合）',
    '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'];
  const mixed = api.readCreativeSettingDataMulti(wrapWorkbook(makeWorkbook({
    '入稿物管理表': [mixedHeaders, ['LI_FIX1', 'CR_SINGLE_SHOULD_NOT_WIN', 'CR_AUTO', 'CR_CHANGED',
      '2026/9/1', '0:00', '2026/9/30', '23:59', '']],
  })), 'initial', ['LI_FIX1']);
  assert.equal(mixed.rows[0].creativeName, 'CR_CHANGED');
  assert.equal(mixed.rows[0].creativeNameSource, '変更した場合');
});

test('E7: single-headerは初期案件とCR追加案件の判定入力を壊さない', () => {
  const headers = ['ラインアイテム名', '設定クリエイティブ名\n※半角英数字のみ',
    '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'];
  const setting = row => wrapWorkbook(makeWorkbook({
    '入稿物管理表 (ReC_ASIN)': [headers, row],
  }));
  const download = wrapWorkbook(makeWorkbook({
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      ['LI_FIX1', 'CR_SINGLE', '09-01-2026-00-00', '09-30-2026-23-59', 'ACTIVE'],
    ],
  }));
  assert.equal(api.detectCaseModeAuto(setting(['LI_FIX1', 'CR_SINGLE', '2026/9/1', '0:00', '2026/9/30', '23:59', '']), download).caseMode, 'initial');
  assert.equal(api.detectCaseModeAuto(setting(['LI_FIX1', 'CR_SINGLE', '2026/9/1', '0:00', '2026/9/30', '23:59', '追加']), download).caseMode, 'creative_addition');
});

const realSettingPath = process.env.AMAZON_FIX1_SETTING || '';
const realDownloadPath = process.env.AMAZON_FIX1_DOWNLOAD || '';
test('REAL 007: Product 88/88、In-market review、ReC_ASIN生48組と既存LI範囲を検証', {
  skip: !realSettingPath || !realDownloadPath
    || !fs.existsSync(realSettingPath) || !fs.existsSync(realDownloadPath),
}, () => {
  const settingWb = XLSX.readFile(realSettingPath, { cellDates: false });
  const downloadWb = XLSX.readFile(realDownloadPath, { cellDates: false });
  const result = api.checkAmazon(
    [{ wb: settingWb, fileName: path.basename(realSettingPath) }],
    [{ wb: downloadWb, fileName: path.basename(realDownloadPath) }],
    'amazon_dsp',
    'initial',
  );
  assert.equal(result.system, 'amazon_dsp');

  const liName = 'i-TOWEL_CX_onsite';
  const settingRow = result.settingData.find(row => row.__LI_NAME__ === liName);
  const item = result.items.find(row => row.liName === liName);
  assert.ok(settingRow, '007 setting LI exists');
  assert.ok(item && item.found, '007 LI is matched to download');
  const downloadRow = result.downloadData[item.matchedName || liName];
  assert.ok(downloadRow, '007 download row exists');
  const settingAsins = new Set(settingRow.product.asins);
  const downloadAsins = new Set(
    (String(downloadRow['Contextual excluding by products'] || '').match(/[A-Z0-9]{10}/gi) || [])
      .map(asin => asin.toUpperCase()),
  );
  assert.equal(settingAsins.size, 88);
  assert.equal(downloadAsins.size, 88);
  assert.deepEqual([...settingAsins].filter(asin => !downloadAsins.has(asin)), []);
  assert.deepEqual([...downloadAsins].filter(asin => !settingAsins.has(asin)), []);
  assert.equal(item.colResults.find(col => col.key === 'Contextual excluding by products').result, true);

  const category = item.colResults.find(col => col.key === 'Contextual targeting by categories');
  assert.equal(category.sVal, 'タオル');
  assert.equal(category.dVal, '268267011');
  assert.equal(category.result, null);
  assert.match(category.note, /権威マッピングがないため要確認/);
  assert.equal(item.colResults.some(col => col.key === 'Base supply bid*'), false);

  const rawCreative = api.readCreativeSettingDataMulti(
    [{ wb: settingWb, fileName: path.basename(realSettingPath) }], 'initial',
  );
  const pairKey = row => JSON.stringify([row.liName, row.creativeName]);
  const rawSettingPairs = new Set(rawCreative.rows.map(pairKey));
  const downloadPairs = new Set(result.creative.items.map(pairKey));
  const currentSettingLis = new Set(result.settingData.map(row => row.__LI_NAME__));
  const outsideCurrentLis = rawCreative.rows.filter(row => !currentSettingLis.has(row.liName));
  assert.equal(rawCreative.rows.length, 48);
  assert.equal(rawSettingPairs.size, 48);
  assert.equal(result.creative.downloadCount, 48);
  assert.equal(downloadPairs.size, 48);
  assert.deepEqual([...rawSettingPairs].filter(pair => !downloadPairs.has(pair)), []);
  assert.deepEqual([...downloadPairs].filter(pair => !rawSettingPairs.has(pair)), []);

  // The 14 parsed LIs retain the normal CR scope; exact pairs with missing parent LIs are review.
  assert.equal(result.settingData.length, 14);
  assert.equal(outsideCurrentLis.length, 20);
  assert.equal(new Set(outsideCurrentLis.map(row => row.liName)).size, 10);
  assert.equal(result.creative.normalScopeCount, 28);
  assert.equal(result.creative.orphanReviewCount, 20);
  assert.equal(result.creative.settingCount, 48);
  assert.equal(result.creative.matchCount, 28);
  assert.equal(result.creative.downloadMatchedCount, 48);
  assert.equal(result.creative.settingOnlyCount, 0);
  assert.equal(result.creative.downloadOnlyCount, 0);

  const recSheet = settingWb.SheetNames.find(name => name.includes('ReC_ASIN'));
  const recRows = XLSX.utils.sheet_to_json(settingWb.Sheets[recSheet], { header: 1, defval: '', raw: false });
  const recHeader = api.creativeHeaderInfo(recRows);
  assert.equal(recHeader.complete, true);
  assert.ok(recHeader.cols.creativeSingle !== undefined);
});
