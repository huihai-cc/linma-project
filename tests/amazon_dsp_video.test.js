// Amazon DSP Online Video subtype の RED/GREEN 専用テスト
// 実装前に失敗することを確認し、Display / PVA / OTT / CR の境界を固定する。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {},
    disabled: false, files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1])
    .find(script => script.includes('resolveCreativeDownloadDateTime'));
  assert.ok(source, 'Amazon DSP application script should be present');

  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const exportBlock = `
window.__amazonTestApi = {
  detectDownloadSystemAuto: typeof detectDownloadSystemAuto === 'function' ? detectDownloadSystemAuto : undefined,
  autoDetectAndApply: typeof autoDetectAndApply === 'function' ? autoDetectAndApply : undefined,
  readSettingTableDSPVideo: typeof readSettingTableDSPVideo === 'function' ? readSettingTableDSPVideo : undefined,
  readDownloadDataVideoMulti: typeof readDownloadDataVideoMulti === 'function' ? readDownloadDataVideoMulti : undefined,
  checkAmazon: typeof checkAmazon === 'function' ? checkAmazon : undefined,
  getDspVideoColumns: function(){ return typeof DL_COLUMNS_DSP_VIDEO === 'undefined' ? undefined : DL_COLUMNS_DSP_VIDEO; },
  getSystems: function(){ return SC_SYSTEMS; },
  getScDetectedSystem: function(){ return scDetectedSystem; },
  setScWbs: function(s, d){ scWbsS = s; scWbsD = d; },
  setScSystem: function(v){ scSystem = v; },
  setManualFlags: function(sys, mode){ scSystemManual = !!sys; scCaseModeManual = !!mode; },
  resetSettingCheck: typeof resetSettingCheck === 'function' ? resetSettingCheck : undefined,
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: (s) => String(s ?? ''),
    XLSX: { utils: { sheet_to_json: (ws) => (ws && Array.isArray(ws.__rows)) ? ws.__rows : [] } },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

function makeWb(sheets) {
  const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
  for (const [name, definition] of Object.entries(sheets)) {
    const rows = Array.isArray(definition) ? definition : definition.rows;
    wb.Sheets[name] = { '!ref': 'A1', __rows: rows };
    if (!Array.isArray(definition) && definition.merges) {
      wb.Sheets[name]['!merges'] = definition.merges;
    }
  }
  return wb;
}

function wrap(...wbs) {
  return wbs.map((wb, index) => ({ wb, fileName: `test_${index + 1}.xlsx` }));
}

function makeOnlineSettingRows({ mobileEnv = 'Web', audience = '' } = {}) {
  return [
    ['', '', '', '', '', '', 'Setup', '', 'Targeting', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Line Item Name', 'Type', 'Start day', 'Start time', 'End day', 'End time',
      'Mobile environment', 'Device type', 'Mobile environment', 'Pacing',
      'Base supply bid', 'Maximum average CPM', 'Product categories', 'Audience',
      'Location', 'Language', 'Video initiation type', 'Video ad format',
      'Video player size', 'Video completion', 'Viewability', 'Unmeasured viewability',
      'Domain', 'Brand Safety'],
    ['LI_VIDEO_1', 'Online Video', '2026-09-01', '00:00', '2026-09-30', '23:59',
      'Web/App', 'All', mobileEnv, 'Evenly', '200', '500', 'Beauty & Fashion>Hair', audience,
      'Japan', 'チェック有', 'User initiated', 'In-stream only', 'Any', 'Any', 'Up to 40%',
      '含めない', 'Blacklist', 'Standard'],
  ];
}

const VIDEO_HEADERS = [
  'Line ID', 'Line name*', 'Line type*', 'Video Ad Content Type*',
  'Line start date', 'Line end date', 'Active/Inactive', 'Device type',
  'Mobile environment', 'Supply source', 'Product categories*',
  'Base supply bid*', 'Maximum average CPM', 'Audience names', 'Audiences - include',
  'Language targeting', 'Amazon viewability', 'Unmeasured viewability',
  'Brand suitability content exclusion categories', 'Brand suitability inventory tier',
  'Video initiation type', 'Video ad format', 'Video player size', 'Video completion',
  'In-stream position', 'Out-stream position', 'Pacing profile', 'Line item budget',
  'Budget cap', 'Domain Targeting - (READ ONLY)',
];

function makeOnlineDownloadRow({
  liName = 'LI_VIDEO_1',
  contentType = 'ONLINE_VIDEO',
  supply = 'APD',
  product = 'Beauty & Fashion:Hair',
  baseBid = '10.75',
  audienceNames = '',
  audienceInclude = '',
} = {}) {
  const row = Array(VIDEO_HEADERS.length).fill('');
  const put = (key, value) => { row[VIDEO_HEADERS.indexOf(key)] = value; };
  put('Line ID', '1');
  put('Line name*', liName);
  put('Line type*', 'Video');
  put('Video Ad Content Type*', contentType);
  put('Line start date', '09-01-2026-00-00');
  put('Line end date', '09-30-2026-23-59');
  put('Active/Inactive', 'Pause');
  put('Device type', 'All');
  put('Mobile environment', 'Web');
  put('Supply source', supply);
  put('Product categories*', product);
  put('Base supply bid*', baseBid);
  put('Maximum average CPM', '500');
  put('Audience names', audienceNames);
  put('Audiences - include', audienceInclude);
  put('Language targeting', 'Enable');
  put('Amazon viewability', 'Up to 40%');
  put('Unmeasured viewability', 'Exclude');
  put('Brand suitability inventory tier', 'STANDARD');
  put('Video initiation type', 'User initiated');
  put('Video ad format', 'In-stream only');
  put('Video player size', 'Any');
  put('Video completion', 'Any');
  put('In-stream position', 'Any');
  put('Out-stream position', 'Any');
  put('Pacing profile', 'Evenly');
  put('Line item budget', '10000');
  put('Budget cap', '1000');
  return row;
}

function makeOnlineDownload(options = {}) {
  return makeWb({
    'VIDEO LINE ITEMS': [VIDEO_HEADERS, makeOnlineDownloadRow(options)],
  });
}

function makeSetting(options = {}) {
  return makeWb({ 'Video設定シート': makeOnlineSettingRows(options) });
}

function makeTargetingSetting() {
  const row = () => Array(40).fill('');
  const parent = row();
  parent[1] = 'ラインアイテム名\n（Line Item Name）';
  parent[2] = 'Media';
  parent[21] = 'Targeting';

  const headers = row();
  headers[2] = 'Type';
  headers[3] = 'Device';
  headers[4] = 'Mobile environment';
  headers[5] = 'Start day';
  headers[6] = 'Start time';
  headers[7] = 'End day';
  headers[8] = 'End time';
  headers[9] = 'Automated optimization';
  headers[10] = 'Line item budget';
  headers[11] = 'Budget cap';
  headers[12] = 'Pacing';
  headers[14] = 'Frequency';
  headers[15] = 'Base supply bid';
  headers[16] = 'Maximum average CPM';
  headers[17] = 'Product categories';
  headers[18] = 'SSP';
  headers[25] = 'Mobile environment';
  headers[26] = 'Audience';
  headers[27] = 'Location';
  headers[28] = 'Language';
  headers[31] = 'Domain';
  headers[32] = 'Brand suitability';
  headers[34] = 'Viewability';
  headers[36] = 'Video initiation type';
  headers[37] = 'Video player size';
  headers[38] = 'Video completion';
  headers[39] = 'Position';

  const subheaders = row();
  subheaders[32] = 'Inventory tier';
  subheaders[33] = 'Content exclusion categories';
  subheaders[35] = '不明層';

  const data = row();
  data[0] = '1';
  data[1] = 'LI_VIDEO_1';
  data[2] = 'Online Video';
  data[3] = 'Desktop/Mobile';
  data[4] = 'Web/App';
  data[5] = 'Sep 16, 2026';
  data[6] = '12:00 AM';
  data[7] = 'Sep 30, 2026';
  data[8] = '11:59 PM';
  data[9] = 'Manage budget manually';
  data[10] = '¥100,000';
  data[12] = 'Even';
  data[14] = '5回/1日';
  data[15] = '¥200';
  data[16] = '¥400';
  data[17] = 'Beauty & Fashion>Hair';
  data[18] = 'Amazon外配信';
  data[25] = 'Web';
  data[26] = 'Audience';
  data[27] = 'Japan';
  data[28] = 'チェック有';
  data[31] = 'ブラックリスト（統一ルール）';
  data[32] = 'Standard';
  data[33] = 'Select all';
  data[34] = 'Up to 40%';
  data[35] = '含めない';
  data[36] = 'Any';
  data[37] = 'Any';
  data[38] = '40% +';
  data[39] = 'In-stream position, Out-stream position';

  return makeWb({
    '動画_LineItem設定シート': {
      rows: [parent, headers, subheaders, data],
      merges: [
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 0, c: 20 } },
        { s: { r: 0, c: 21 }, e: { r: 0, c: 39 } },
        { s: { r: 1, c: 32 }, e: { r: 1, c: 33 } },
        { s: { r: 1, c: 34 }, e: { r: 1, c: 35 } },
      ],
    },
  });
}

const SELECT_ALL_BRAND_CATEGORIES = [
  'ACCIDENTS_DISASTERS_AND_TRAGEDIES', 'WEAPONS', 'GAMBLING',
  'BLOOD_GORE_VIOLENCE', 'CRIME', 'SHOCK_AND_HORROR', 'PROFANITY',
  'HIGHLY_DEBATED_SOCIAL_ISSUES', 'POLITICS',
  'SEXUAL_REFERENCES_AND_SUGGESTIVE', 'ALCOHOL_AND_RELATED_PRODUCTS',
  'TOBACCO_AND_RELATED_PRODUCTS', 'DRUG_REFERENCES_OR_USE',
  'RELIGIOUS_CONTENT', 'UNRATED_MEDIA_CONTENT',
].join(';');

function makeRichOnlineDownload() {
  const wb = makeOnlineDownload({ supply: 'APD', baseBid: '200' });
  const row = wb.Sheets['VIDEO LINE ITEMS'].__rows[1];
  const put = (key, value) => { row[VIDEO_HEADERS.indexOf(key)] = value; };
  put('Maximum average CPM', '400');
  put('Brand suitability content exclusion categories', SELECT_ALL_BRAND_CATEGORIES);
  put('Domain Targeting - (READ ONLY)', 'Yes');
  put('Video initiation type', 'Any');
  put('Video completion', '40%+');
  return wb;
}

const api = loadAmazonApi();

test('RED-1 strict Online Video pair is detected as amazon_dsp_video without SSP evidence', () => {
  const result = api.detectDownloadSystemAuto(
    wrap(makeOnlineDownload({ supply: '' })),
    wrap(makeSetting()),
  );
  assert.equal(result.determined, true);
  assert.equal(result.system, 'amazon_dsp_video');
});

test('autoDetectAndApply publishes amazon_dsp_video through the existing auto path', () => {
  api.resetSettingCheck();
  api.setScSystem('auto');
  api.setManualFlags(false, true);
  api.setScWbs(wrap(makeSetting()), wrap(makeOnlineDownload({ supply: '' })));
  assert.equal(api.autoDetectAndApply(), true);
  assert.equal(api.getScDetectedSystem(), 'amazon_dsp_video');
});

test('RED-2 Display, PVA, and OTT keep their existing subtype detection', () => {
  const display = api.detectDownloadSystemAuto(wrap(makeWb({
    'DISPLAY LINE ITEMS': [['Line name', 'Line type', 'Supply source'], ['LI_DISPLAY', 'Display', '']],
  })));
  const pva = api.detectDownloadSystemAuto(wrap(makeWb({
    'VIDEO LINE ITEMS': [['Line name', 'Line type', 'Supply source', 'Video Ad Content Type*'],
      ['LI_PVA', 'Video', '', 'STREAMING_TV']],
  })));
  const ott = api.detectDownloadSystemAuto(wrap(makeWb({
    'VIDEO LINE ITEMS': [['Line name', 'Line type', 'Supply source', 'Video Ad Content Type*'],
      ['LI_OTT', 'Video', 'APD', 'STREAMING_TV']],
  })));
  assert.equal(display.system, 'amazon_dsp');
  assert.equal(pva.system, 'amazon_pva');
  assert.equal(ott.system, 'amazon_ott');
});

test('RED-3 STREAMING_TV and Prime Video evidence never become amazon_dsp_video', () => {
  const streaming = api.detectDownloadSystemAuto(
    wrap(makeWb({ 'VIDEO LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Video Ad Content Type*'],
      ['LI_TV', 'Video', 'APD', 'STREAMING_TV'],
    ] })),
    wrap(makeSetting()),
  );
  const pva = api.detectDownloadSystemAuto(
    wrap(makeWb({ 'VIDEO LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Deal Selection', 'Video Ad Content Type*'],
      ['LI_PVA', 'Video', '', 'Prime Video ads:DEAL-1', 'STREAMING_TV'],
    ] })),
    wrap(makeWb({ 'Video設定シート': makeOnlineSettingRows({ mobileEnv: 'Web' }).map((row, i) =>
      i === 2 ? row.map((cell, index) => index === 1 ? 'Streaming TV' : cell) : row) })),
  );
  assert.notEqual(streaming.system, 'amazon_dsp_video');
  assert.notEqual(pva.system, 'amazon_dsp_video');
});

test('RED-4 DSP Video adapter reads Targeting Mobile environment instead of earlier Web/App', () => {
  const rows = api.readSettingTableDSPVideo(wrap(makeSetting())[0].wb);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mobile_env, 'Web');
  assert.match(rows[0].__MOBILE_ENV_SOURCE__ || '', /Targeting/);
});

test('RED-5 existing VIDEO download parser reads VIDEO LINE ITEMS unchanged', () => {
  const result = api.readDownloadDataVideoMulti(wrap(makeOnlineDownload()));
  assert.equal(result.files[0].sheet, 'VIDEO LINE ITEMS');
  assert.equal(result.files[0].liCount, 1);
  assert.equal(result.liMap.LI_VIDEO_1['Video Ad Content Type*'], 'ONLINE_VIDEO');
});

function getVideoColumn(key) {
  const col = (api.getDspVideoColumns() || []).find(item => item.key === key);
  assert.ok(col, `DSP Video column exists: ${key}`);
  assert.ok(col.checkFn, `DSP Video checkFn exists: ${key}`);
  return col.checkFn;
}

test('RED-6 DSP Video compares Online Video to ONLINE_VIDEO', () => {
  assert.equal(getVideoColumn('Video Ad Content Type*')({ media: 'Online Video' }, 'ONLINE_VIDEO'), true);
  assert.equal(getVideoColumn('Video Ad Content Type*')({ media: 'Online Video' }, 'STREAMING_TV'), false);
});

test('RED-7 DSP Video product category only normalizes > to :', () => {
  const fn = getVideoColumn('Product categories*');
  assert.equal(fn({ product_small: 'Beauty & Fashion>Hair' }, 'Beauty & Fashion:Hair'), true);
  assert.equal(fn({ product_small: 'Beauty & Fashion>Hair' }, 'Beauty & Fashion:Skin'), false);
});

test('RED-8 DSP Video reuses Amazon DSP supply semantics for third-party SSP', () => {
  const fn = getVideoColumn('Supply source');
  assert.equal(fn({ ssp: 'Amazon外配信' }, 'APD'), true);
  assert.equal(fn({ ssp: 'Amazon外配信' }, 'Amazon Owned'), false);
});

test('B1 DSP Video excludes Base supply bid from QC columns', () => {
  const columns = api.getDspVideoColumns() || [];
  assert.equal(columns.some(column => column.key === 'Base supply bid*'), false);
});

test('B2 DSP Video Base supply bid does not affect mismatch count', () => {
  const matched = api.checkAmazon(
    wrap(makeSetting()),
    wrap(makeOnlineDownload({ baseBid: '200' })),
    'amazon_dsp_video',
    'initial',
  );
  const mismatched = api.checkAmazon(
    wrap(makeSetting()),
    wrap(makeOnlineDownload({ baseBid: '10.75' })),
    'amazon_dsp_video',
    'initial',
  );
  assert.equal(mismatched.items[0].mismatchCount, matched.items[0].mismatchCount);
});

test('B3 DSP Video Base supply bid is hidden from the normal result column set', () => {
  const keys = new Set((api.getDspVideoColumns() || []).map(column => column.key));
  assert.equal(keys.has('Base supply bid*'), false);
});

test('RED-10 DSP Video preserves a real Audience difference as mismatch with explanation', () => {
  const fn = getVideoColumn('Audience names');
  const setting = {
    __LI_NAME__: 'LI_VIDEO_1',
    audience: 'セグメントシート参照',
    __SEGMENT_SHEET__: { groups: [{ type: 'Include', segments: ['MISAMO Audience'] }] },
  };
  const result = fn(setting, '', { 'Audiences - include': '', 'Audience names': '' });
  assert.equal(result, false);
  assert.match(setting.__audience_diff__ || '', /MISAMO Audience/);
});

test('RED-11 DSP Video uses explicit Language, Viewability, and Brand mappings', () => {
  assert.equal(getVideoColumn('Language targeting')({ language: 'チェック有' }, 'Enable'), true);
  assert.equal(getVideoColumn('Amazon viewability')({ viewability_pct: 'Up to 40%' }, 'Up to 40%'), true);
  assert.equal(getVideoColumn('Unmeasured viewability')({ viewability_excl: '含めない' }, 'Exclude'), true);
  assert.equal(getVideoColumn('Brand suitability inventory tier')({ brand_safety: 'Standard' }, 'STANDARD'), true);
});

test('RED-12 checkAmazon routes amazon_dsp_video through the video parser and shared CR pipeline', () => {
  const result = api.checkAmazon(wrap(makeSetting()), wrap(makeOnlineDownload()), 'amazon_dsp_video', 'initial');
  assert.equal(result.system, 'amazon_dsp_video');
  assert.equal(result.settingCount, 1);
  assert.equal(result.downloadCount, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.creative.settingCount, 0);
});

test('checkAmazon retains Video mismatch statuses on the isolated DSP Video path', () => {
  const result = api.checkAmazon(
    wrap(makeSetting({ audience: '' })),
    wrap(makeOnlineDownload({ supply: 'APD', baseBid: '10.75' })),
    'amazon_dsp_video',
    'initial',
  );
  const item = result.items[0];
  assert.equal(item.found, true);
  assert.equal(item.colResults.find(c => c.key === 'Video Ad Content Type*').result, true);
  assert.equal(item.colResults.find(c => c.key === 'Mobile environment').result, true);
  assert.equal(item.colResults.find(c => c.key === 'Product categories*').result, true);
  assert.equal(item.colResults.find(c => c.key === 'Supply source').result, true);
  assert.equal(item.colResults.find(c => c.key === 'Base supply bid*'), undefined);
});

test('RED-13 parser-to-comparison handles the real two-level DSP Video setting shape', () => {
  const settingWb = makeTargetingSetting();
  const parsed = api.readSettingTableDSPVideo(settingWb);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].mobile_env, 'Web');
  assert.equal(parsed[0].language, 'チェック有');
  assert.equal(parsed[0].domain_bl, 'ブラックリスト（統一ルール）');
  assert.equal(parsed[0].brand_inventory_tier, 'Standard');
  assert.equal(parsed[0].brand_exclusions, 'Select all');
  assert.equal(parsed[0].viewability_pct, 'Up to 40%');
  assert.equal(parsed[0].viewability_excl, '含めない');
  assert.equal(parsed[0].video_init, 'Any');
  assert.equal(parsed[0].video_size, 'Any');
  assert.equal(parsed[0].video_comp, '40% +');
  assert.equal(parsed[0].position, 'In-stream position, Out-stream position');

  const result = api.checkAmazon(
    wrap(settingWb),
    wrap(makeRichOnlineDownload()),
    'amazon_dsp_video',
    'initial',
  );
  const checks = new Map(result.items[0].colResults.map(col => [col.key, col.result]));
  assert.equal(checks.get('Video Ad Content Type*'), true);
  assert.equal(checks.get('Mobile environment'), true);
  assert.equal(checks.get('Language targeting'), true);
  assert.equal(checks.get('Amazon viewability'), true);
  assert.equal(checks.get('Unmeasured viewability'), true);
  assert.equal(checks.get('Brand suitability inventory tier'), true);
  assert.equal(checks.get('Brand suitability content exclusion categories'), true);
  assert.equal(checks.get('Video initiation type'), true);
  assert.equal(checks.get('Video player size'), true);
  assert.equal(checks.get('Video completion'), true);
  assert.equal(checks.get('In-stream position'), true);
  assert.equal(checks.get('Out-stream position'), true);
  assert.equal(checks.get('Domain Targeting - (READ ONLY)'), null);
  assert.equal(result.items[0].__video_position_note__ || '', '');
  assert.match(result.items[0].__domain_note__ || '', /CSVではDomain Targeting/);
});

test('FIX1 Domain and Position notes are wired into rendered result cells', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const noteRenderer = html.slice(html.indexOf('const noteKey = col.key'));
  assert.match(noteRenderer, /col\.key === 'Domain Targeting - \(READ ONLY\)'[\s\S]*?__domain_note__/);
  assert.match(noteRenderer, /col\.key === 'In-stream position'[\s\S]*?__video_position_note__/);
});

function checkDspVideoDomain(setting, download) {
  const s = { domain_bl: setting };
  const result = getVideoColumn('Domain Targeting - (READ ONLY)')(s, download);
  return { result, note: s.__domain_note__ || '' };
}

test('D1 blacklist plus Yes stays REVIEW with a concrete Domain explanation', () => {
  const result = checkDspVideoDomain('ブラックリスト（統一ルール）', 'Yes');
  assert.equal(result.result, null);
  assert.match(result.note, /CSVではDomain Targeting「Yes」まで確認可能/);
  assert.match(result.note, /ブラックリスト（統一ルール）/);
});

test('D2 Domain setting plus No is a mismatch with a concrete explanation', () => {
  const result = checkDspVideoDomain('ブラックリスト（統一ルール）', 'No');
  assert.equal(result.result, false);
  assert.match(result.note, /設定表ではDomain Targeting指定があります/);
});

test('D3 no Domain setting plus Yes stays REVIEW', () => {
  const result = checkDspVideoDomain('', 'Yes');
  assert.equal(result.result, null);
  assert.match(result.note, /設定表にDomain Targetingの記載はありません/);
});

test('D4 no Domain setting plus No is neutral MATCH', () => {
  const result = checkDspVideoDomain('', 'No');
  assert.equal(result.result, true);
});

function checkDspVideoPosition(key, setting, download) {
  const s = { video_position: setting };
  const result = getVideoColumn(key)(s, download);
  return { result, note: s.__video_position_note__ || '' };
}

test('P1 In-stream token plus Any is MATCH', () => {
  assert.equal(checkDspVideoPosition('In-stream position', 'In-stream position, Out-stream position', 'Any').result, true);
});

test('P2 Out-stream token plus Any is MATCH', () => {
  assert.equal(checkDspVideoPosition('Out-stream position', 'In-stream position, Out-stream position', 'Any').result, true);
});

test('P3 missing In-stream token plus Any is MISMATCH', () => {
  const result = checkDspVideoPosition('In-stream position', 'Out-stream position', 'Any');
  assert.equal(result.result, false);
  assert.match(result.note, /In-stream positionの指定がありません/);
});

test('P4 missing Out-stream token plus Any is MISMATCH', () => {
  const result = checkDspVideoPosition('Out-stream position', 'In-stream position', 'Any');
  assert.equal(result.result, false);
  assert.match(result.note, /Out-stream positionの指定がありません/);
});

test('P5 In-stream token plus empty download is MISMATCH', () => {
  const result = checkDspVideoPosition('In-stream position', 'In-stream position', '');
  assert.equal(result.result, false);
  assert.match(result.note, /ダウンロードデータでは設定されていません/);
});

test('P6 Out-stream token plus empty download is MISMATCH', () => {
  const result = checkDspVideoPosition('Out-stream position', 'Out-stream position', '');
  assert.equal(result.result, false);
  assert.match(result.note, /ダウンロードデータでは設定されていません/);
});

test('P7 both Position sides absent are neutral MATCH', () => {
  assert.equal(checkDspVideoPosition('In-stream position', '', '').result, true);
});

test('P8 unknown download Position value is REVIEW', () => {
  const result = checkDspVideoPosition('In-stream position', 'In-stream position', 'Above the fold');
  assert.equal(result.result, null);
  assert.match(result.note, /未知/);
});
