// OTT IO Compare regression tests
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');

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
  assert.ok(source, 'production script found');

  const exportsSource = '\nwindow.__api = {\n' +
    '  compareIO, appendDownloadOnlyItems, getCoreLevelColumns,\n' +
    '  setMediaType: function(value) { mediaType = value; },\n' +
    '  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
    '};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportsSource + '\n})();');

  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {}, alert() {},
    atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__api;
}

const api = loadDv360Api();

function baseSetting(overrides = {}) {
  return {
    fields: {
      ioType: '',
      optimization: '広告申込情報単位で入札単価と予算を手動で管理する',
      optTarget: '▼選択',
      autoBudget: 'OFF',
      budgetNet: '¥980,000',
      budgetGross: '¥1,000,000',
      startDate: '2026/06/29', startTime: '00:00',
      endDate: '2026/07/28', endTime: '23:59',
      pacing: '掲載期間', pacingType: '均等',
      kpi: 'インプレッション単価（CPM）', kpiValue: '3300',
      kpiVal: '9999',
      fqTiming: '▼選択', fqCount: '',
      ...overrides,
    },
  };
}

function allDayDaypart() {
  // DV360 daypart numeric IDs for Monday..Sunday 00:00-23:59 (96 slots)
  const ids = [300096, 310096, 320096, 330096, 340096, 350096, 360096];
  return ids.join('; ');
}

function baseDownload(fieldOverrides = {}, rawOverrides = {}) {
  const fields = {
    status: 'Draft', ioType: 'Standard', ioSubtype: 'Default', objective: 'No Objective',
    budgetSegments: '(980000.0; 06/29/2026 00:00; 07/28/2026 23:59; ; なし;);',
    pacing: 'Flight', pacingRate: 'Even', kpiType: 'CPM', kpiValue: '3300',
    trueViewKpiType: '', trueViewKpiValue: '',
    frequencyEnabled: 'False', frequencyExposures: '0', frequencyPeriod: 'Minutes',
    ...fieldOverrides,
  };
  const rawFields = {
    Name: 'OTT IO', Status: fields.status,
    'Io Type': fields.ioType, 'Io Subtype': fields.ioSubtype, 'Io Objective': fields.objective,
    'Insertion Order Optimization': 'False', 'Auto Budget Allocation': 'False',
    'Budget Segments': fields.budgetSegments, Pacing: fields.pacing, 'Pacing Rate': fields.pacingRate,
    'Kpi Type': fields.kpiType, 'Kpi Value': fields.kpiValue,
    'Daypart Targeting': allDayDaypart(), 'Daypart Targeting Time Zone': 'Asia/Tokyo',
    ...rawOverrides,
  };
  return { fields, rawFields, rawFieldOrder: Object.keys(rawFields) };
}

function compareOtt(setting = baseSetting(), download = baseDownload()) {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  return api.compareIO(setting, download);
}

function item(items, label) {
  const found = items.find(candidate => candidate.label === label);
  assert.ok(found, `comparison item ${label} exists`);
  return found;
}

test('OTT IO default values and mapped fields compare as equal', () => {
  const items = compareOtt();
  for (const label of ['IOタイプ', '最適化', '目標指標', '予算の自動割り当て', '予算', '説明',
    '開始日', '開始時間', '終了日', '終了時間', 'ペース', 'KPI', 'KPI値']) {
    assert.equal(item(items, label).result, 'ok', `${label} should be ok`);
  }
  assert.match(item(items, 'IOタイプ').sVal, /Standard \/ Default/);
  assert.equal(item(items, 'KPI値').sVal, '3300', 'uses sf.kpiValue, not legacy sf.kpiVal');
});

test('OTT IO type default requires both Standard and Default', () => {
  assert.equal(item(compareOtt(), 'IOタイプ').result, 'ok');
  assert.equal(item(compareOtt(baseSetting(), baseDownload({ ioSubtype: 'Programmatic Guaranteed' })), 'IOタイプ').result, 'mismatch');
});

test('OTT manual optimization maps to FALSE and unknown options remain warning', () => {
  assert.equal(item(compareOtt(), '最適化').result, 'ok');
  assert.equal(item(compareOtt(baseSetting({ optimization: '将来の最適化オプション' })), '最適化').result, 'warning');
});

test('OTT target selector maps to No Objective', () => {
  assert.equal(item(compareOtt(), '目標指標').result, 'ok');
  assert.equal(item(compareOtt(baseSetting(), baseDownload({ objective: 'Brand Awareness' })), '目標指標').result, 'mismatch');
});

test('OTT IO Objective: ブランドの知名度 maps to Brand Awareness', () => {
  const download = baseDownload({ objective: 'Brand Awareness' });
  assert.equal(item(compareOtt(baseSetting({ optTarget: 'ブランドの知名度' }), download), '目標指標').result, 'ok');
});

test('OTT IO Objective: 目標なし/▼選択 maps to No Objective', () => {
  assert.equal(item(compareOtt(baseSetting({ optTarget: '広告掲載オーダー（目標なし）' })), '目標指標').result, 'ok');
  assert.equal(item(compareOtt(baseSetting({ optTarget: '▼選択' })), '目標指標').result, 'ok');
});

test('OTT Auto Budget Allocation maps OFF/FALSE and ON/TRUE', () => {
  assert.equal(item(compareOtt(), '予算の自動割り当て').result, 'ok');
  const onSetting = baseSetting({ optTarget: 'Brand Awareness', autoBudget: 'ON' });
  const onDownload = baseDownload({ objective: 'Brand Awareness' }, { 'Auto Budget Allocation': 'True' });
  assert.equal(item(compareOtt(onSetting, onDownload), '予算の自動割り当て').result, 'ok');
});

test('OTT No Objective with Auto Budget Allocation not FALSE is warning', () => {
  const download = baseDownload({}, { 'Auto Budget Allocation': 'True' });
  assert.equal(item(compareOtt(baseSetting({ autoBudget: 'ON' }), download), '予算の自動割り当て').result, 'warning');
});

test('OTT budget only uses budgetNet and never falls back to budgetGross', () => {
  assert.equal(item(compareOtt(), '予算').result, 'ok');
  const missingNet = baseSetting({ budgetNet: '', budgetGross: '¥980,000' });
  assert.equal(item(compareOtt(missingNet), '予算').result, 'warning');
});

test('OTT missing budgetNet stays warning even when Budget Segments is empty', () => {
  const setting = baseSetting({ budgetNet: '', budgetGross: '¥980,000' });
  const download = baseDownload({ budgetSegments: '' });
  assert.equal(item(compareOtt(setting, download), '予算').result, 'warning');
});

test('OTT Budget Segments compares dates and default description', () => {
  const items = compareOtt();
  assert.equal(item(items, '予算').dVal, '980000');
  assert.equal(item(items, '開始日').result, 'ok');
  assert.equal(item(items, '終了日').result, 'ok');
  assert.equal(item(items, '説明').result, 'ok');

  const unexpected = baseDownload({
    budgetSegments: '(980000.0; 06/29/2026 00:00; 07/28/2026 23:59; ; campaign note;);',
  });
  assert.equal(item(compareOtt(baseSetting(), unexpected), '説明').result, 'mismatch');
});

test('OTT missing Daypart Targeting: all-day setting is ok', () => {
  const download = baseDownload({}, { 'Daypart Targeting': '', 'Daypart Targeting Time Zone': '' });
  const items = compareOtt(baseSetting(), download);
  assert.equal(item(items, '開始時間').result, 'ok');
  assert.equal(item(items, '終了時間').result, 'ok');
});

test('OTT missing Daypart Targeting: non-all-day setting is mismatch', () => {
  const download = baseDownload({}, { 'Daypart Targeting': '', 'Daypart Targeting Time Zone': '' });
  const setting = baseSetting({ startTime: '10:00', endTime: '16:59' });
  const items = compareOtt(setting, download);
  assert.equal(item(items, '開始時間').result, 'mismatch');
  assert.equal(item(items, '終了時間').result, 'mismatch');
});

test('OTT Daypart final: 全天設定 + no Daypart => ok', () => {
  const download = baseDownload({}, { 'Daypart Targeting': '', 'Daypart Targeting Time Zone': '' });
  const items = compareOtt(baseSetting({ startTime: '00:00', endTime: '23:59' }), download);
  assert.equal(item(items, '開始時間').sVal, '00:00');
  assert.equal(item(items, '開始時間').dVal, '(空)');
  assert.equal(item(items, '開始時間').result, 'ok');
  assert.equal(item(items, '終了時間').sVal, '23:59');
  assert.equal(item(items, '終了時間').dVal, '(空)');
  assert.equal(item(items, '終了時間').result, 'ok');
});

test('OTT Daypart final: 非全天設定 + no Daypart => mismatch', () => {
  const download = baseDownload({}, { 'Daypart Targeting': '', 'Daypart Targeting Time Zone': '' });
  const items = compareOtt(baseSetting({ startTime: '10:00', endTime: '16:59' }), download);
  assert.equal(item(items, '開始時間').sVal, '10:00');
  assert.equal(item(items, '開始時間').dVal, '(空)');
  assert.equal(item(items, '開始時間').result, 'mismatch');
  assert.equal(item(items, '終了時間').sVal, '16:59');
  assert.equal(item(items, '終了時間').dVal, '(空)');
  assert.equal(item(items, '終了時間').result, 'mismatch');
});

test('OTT FQ: unset timing with disabled download is ok', () => {
  const items = compareOtt(baseSetting({ fqTiming: '▼選択', fqCount: '●回' }));
  assert.equal(item(items, 'FQ').sVal, 'なし');
  assert.equal(item(items, 'FQ').result, 'ok');
});

test('OTT FQ: unset timing with enabled download is mismatch', () => {
  const download = baseDownload({ frequencyEnabled: 'True', frequencyExposures: '7', frequencyPeriod: 'Day' });
  const items = compareOtt(baseSetting({ fqTiming: '▼選択', fqCount: '●回' }), download);
  assert.equal(item(items, 'FQ').sVal, 'なし');
  assert.equal(item(items, 'FQ').result, 'mismatch');
});

test('OTT FQ: set timing compares count with frequency exposures', () => {
  const download = baseDownload({ frequencyEnabled: 'True', frequencyExposures: '7', frequencyPeriod: 'Day' });
  const items = compareOtt(baseSetting({ fqTiming: 'キャンペーン単位', fqCount: '7回' }), download);
  assert.equal(item(items, 'FQ').sVal, '7回');
  assert.equal(item(items, 'FQ').result, 'ok');
});

test('OTT FQ: set timing with mismatched count is mismatch', () => {
  const download = baseDownload({ frequencyEnabled: 'True', frequencyExposures: '5', frequencyPeriod: 'Day' });
  const items = compareOtt(baseSetting({ fqTiming: 'キャンペーン単位', fqCount: '7回' }), download);
  assert.equal(item(items, 'FQ').result, 'mismatch');
});

test('OTT pacing and KPI Value use OTT setting field names', () => {
  const items = compareOtt();
  assert.equal(item(items, 'ペース').result, 'ok');
  assert.equal(item(items, 'KPI値').result, 'ok');
});

test('OTT core items consume raw optimization and Auto Budget fields once', () => {
  const setting = baseSetting({ optTarget: 'Brand Awareness', autoBudget: 'ON' });
  const download = baseDownload({ objective: 'Brand Awareness' }, {
    'Insertion Order Optimization': 'True',
    'Auto Budget Allocation': 'True',
  });
  const coreItems = compareOtt(setting, download);
  const allItems = api.appendDownloadOnlyItems('IO', download, coreItems);
  assert.equal(allItems.filter(candidate => candidate.label === '最適化').length, 1);
  assert.equal(allItems.filter(candidate => candidate.label === '予算の自動割り当て').length, 1);
  assert.equal(allItems.filter(candidate => candidate.rawFieldName === 'Insertion Order Optimization').length, 0);
  assert.equal(allItems.filter(candidate => candidate.rawFieldName === 'Auto Budget Allocation').length, 0);
});

test('YouTube and Display expose their respective IO contracts', () => {
  api.setMediaType('youtube');
  const youtubeLabels = api.compareIO(baseSetting(), baseDownload()).map(candidate => candidate.label);
  assert.ok(youtubeLabels.includes('目標'));
  assert.ok(!youtubeLabels.includes('目標指標'));
  assert.ok(youtubeLabels.includes('最適化'));
  assert.ok(!youtubeLabels.includes('予算の自動割り当て'));

  api.setMediaType('display');
  const displayLabels = api.compareIO(baseSetting(), baseDownload()).map(candidate => candidate.label);
  assert.ok(!displayLabels.includes('目標'));
  assert.ok(displayLabels.includes('目標指標'));
  assert.ok(displayLabels.includes('最適化'));
  assert.ok(displayLabels.includes('予算の自動割り当て'));
});

test('YouTube, OTT and Display expose their respective IO columns', () => {
  api.setMediaType('youtube');
  const youtubeKeys = api.getCoreLevelColumns('IO', true).map(column => column.key);
  api.setMediaType('display');
  const displayKeys = api.getCoreLevelColumns('IO', false).map(column => column.key);

  api.setMediaType('ott');
  const ottKeys = api.getCoreLevelColumns('IO', false).map(column => column.key);
  for (const key of ['IOタイプ', '最適化', '目標指標', '予算の自動割り当て', '予算', '説明',
    '開始日', '開始時間', '終了日', '終了時間', 'ペース', 'KPI', 'KPI値']) {
    assert.ok(ottKeys.includes(key), `OTT IO table contains ${key}`);
  }
  assert.ok(youtubeKeys.includes('最適化'), 'YouTube IO includes its SDF optimization column');
  assert.ok(displayKeys.includes('最適化'), 'Display IO has its independent optimization column');
  assert.ok(!youtubeKeys.includes('予算の自動割り当て'), 'YouTube has no OTT auto-budget column');
  assert.ok(displayKeys.includes('予算の自動割り当て'), 'Display IO has its independent auto-budget column');
});
