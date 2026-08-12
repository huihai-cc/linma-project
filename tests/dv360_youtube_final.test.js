const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');

function createClassList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
  };
}

function createElement(initialValue = '') {
  const listeners = {};
  return {
    __listeners: listeners,
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    appendChild() {},
    classList: createClassList(),
    closest() { return null; },
    dataset: {},
    disabled: false,
    files: [],
    innerHTML: '',
    querySelector() { return null; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    style: { display: '', setProperty() {} },
    textContent: '',
    value: initialValue,
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = `
window.__dv360FinalTestApi = {
  getSelectedDv360CaseType: typeof getSelectedDv360CaseType === 'function' ? getSelectedDv360CaseType : undefined,
  getSelectedDv360CaseLabel: typeof getSelectedDv360CaseLabel === 'function' ? getSelectedDv360CaseLabel : undefined,
  onCaseSelectChange: typeof onCaseSelectChange === 'function' ? onCaseSelectChange : undefined,
  getCaseAllowedStatuses: typeof getCaseAllowedStatuses === 'function' ? getCaseAllowedStatuses : undefined,
  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === 'function' ? setSelectedDv360CaseType : undefined,
  compareCrDisplayUrl: typeof compareCrDisplayUrl === 'function' ? compareCrDisplayUrl : undefined,
  compareCR: typeof compareCR === 'function' ? compareCR : undefined,
  buildSdfOnlyCoreItems: typeof buildSdfOnlyCoreItems === 'function' ? buildSdfOnlyCoreItems : undefined,
  getSdfStatusValue: typeof getSdfStatusValue === 'function' ? getSdfStatusValue : undefined,
  parseSdfData: typeof parseSdfData === 'function' ? parseSdfData : undefined,
  buildCaseStatusItem: typeof buildCaseStatusItem === 'function' ? buildCaseStatusItem : undefined,
  compareCP: typeof compareCP === 'function' ? compareCP : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  buildRawSdfStatusItem: typeof buildRawSdfStatusItem === 'function' ? buildRawSdfStatusItem : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  appendDynamicDownloadColumns: typeof appendDynamicDownloadColumns === 'function' ? appendDynamicDownloadColumns : undefined,
  compareAgeDemographicTargeting: typeof compareAgeDemographicTargeting === 'function' ? compareAgeDemographicTargeting : undefined,
  buildRowHtml: typeof _buildRowHtml === 'function' ? _buildRowHtml : undefined,
  resetAll: typeof window.resetAll === 'function' ? window.resetAll : undefined,
  setMediaType: function(value) { mediaType=value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(),
    documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob,
    DecompressionStream: globalThis.DecompressionStream,
    Encoding: {},
    FileReader: function FileReader() {},
    JSZip: {},
    Map,
    Promise,
    Response,
    Set,
    TextDecoder,
    Uint8Array,
    URL,
    XLSX: {},
    alert() {},
    atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  sandbox.__dv360FinalTestApi.setMediaType('youtube');
  return { api: sandbox.__dv360FinalTestApi, document, sandbox };
}

test('案件区分 UI は下拉框だけを公開し、旧ボタンと旧 modal を公開しない', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.equal((html.match(/id="dv-case-select"/g) || []).length, 1);
  assert.equal((html.match(/id="case-type-btn"/g) || []).length, 0);
  assert.equal((html.match(/id="status-modal"/g) || []).length, 0);
});

test('案件区分の唯一 getter は初期案件を返す', () => {
  const { api } = loadDv360Api();
  assert.equal(typeof api.getSelectedDv360CaseType, 'function');
  assert.equal(api.getSelectedDv360CaseType(), 'initial');
  assert.equal(api.getSelectedDv360CaseLabel(), '初期案件');
});

test('下拉框を CR追加案件に切り替えると唯一状態源と比較規則が更新される', () => {
  const { api, document } = loadDv360Api();
  document.getElementById('dv-case-select').value = 'crAdditional';
  api.onCaseSelectChange();
  assert.equal(api.getSelectedDv360CaseType(), 'crAdditional');
  assert.equal(api.getSelectedDv360CaseLabel(), 'CR追加案件');
  assert.equal(api.getCaseAllowedStatuses('CP'), null);
  assert.deepEqual(Array.from(api.getCaseAllowedStatuses('CR')), ['Draft', 'Paused']);
});

test('旧 modal の selectCaseType API は案件区分を変更できない', () => {
  const { sandbox } = loadDv360Api();
  assert.equal(typeof sandbox.selectCaseType, 'undefined');
  assert.equal(typeof sandbox.showStatusDialog, 'undefined');
  assert.equal(typeof sandbox.confirmStatusDialog, 'undefined');
});

test('resetAll は案件区分と下拉框を初期案件へ戻す', () => {
  const { api, document } = loadDv360Api();
  document.getElementById('dv-case-select').value = 'crAdditional';
  api.onCaseSelectChange();
  api.resetAll();
  assert.equal(api.getSelectedDv360CaseType(), 'initial');
  assert.equal(document.getElementById('dv-case-select').value, 'initial');
});

test('case select change event is bound inside the application closure', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(html, /id="dv-case-select"[^>]*\sonchange=/);

  const { api, document } = loadDv360Api();
  const select = document.getElementById('dv-case-select');
  assert.equal(select.__listeners.change?.length, 1);
  select.value = 'crAdditional';
  select.__listeners.change[0]();
  assert.equal(api.getSelectedDv360CaseType(), 'crAdditional');
});

function makeCrSetting(displayUrl) {
  return { fields: { displayUrl } };
}

function makeCrDownload(displayUrl) {
  return {
    name: 'CR test',
    id: 'cr-test',
    fields: { displayUrl, status: 'Active' },
    rawFields: { 'Display URL': displayUrl, Status: 'Active' },
    rawFieldOrder: ['Display URL', 'Status'],
  };
}

test('CR Display URL は trim 後も大小文字を区別する', () => {
  const { api } = loadDv360Api();
  assert.equal(typeof api.compareCrDisplayUrl, 'function');
  assert.equal(api.compareCrDisplayUrl('Example.COM', 'example.com').result, 'mismatch');
});

test('CR Display URL の唯一関数は空値と完全一致を仕様どおり判定する', () => {
  const { api } = loadDv360Api();
  assert.equal(api.compareCrDisplayUrl('aflac.co.jp', '').result, 'ok');
  assert.equal(api.compareCrDisplayUrl('', 'aflac.co.jp').result, 'mismatch');
  assert.equal(api.compareCrDisplayUrl('　aflac.co.jp　', ' aflac.co.jp ').result, 'ok');
});

test('CR core compare の表示URLは唯一関数の結果と source を保持する', () => {
  const { api } = loadDv360Api();
  const items = api.compareCR(makeCrSetting('Example.COM'), makeCrDownload('example.com'), ['Active']);
  const displayItems = items.filter(item => item.label === '表示URL');
  assert.equal(displayItems.length, 1);
  assert.equal(displayItems[0].result, 'mismatch');
  assert.equal(displayItems[0].source, 'cr-display-url');
});

test('SDF-only CR は表示URLの core 判定を download-only で上書きしない', () => {
  const { api } = loadDv360Api();
  const items = api.buildSdfOnlyCoreItems('CR', makeCrDownload('example.com'));
  const displayItems = items.filter(item => item.label === '表示URL');
  assert.equal(displayItems.length, 1);
  assert.equal(displayItems[0].result, 'mismatch');
  assert.equal(displayItems[0].source, 'cr-display-url');
});

test('getSdfStatusValue は精確/BOM/前後空白の Status 表頭を読み rawFields を変更しない', () => {
  const { api } = loadDv360Api();
  assert.equal(typeof api.getSdfStatusValue, 'function');
  for (const key of ['Status', '\uFEFFStatus', '  Status　']) {
    const rawFields = { [key]: '  Paused　', Name: 'sample' };
    const before = JSON.stringify(rawFields);
    const result = api.getSdfStatusValue('LI', rawFields);
    assert.equal(result.found, true);
    assert.equal(result.matchedKey, key);
    assert.equal(result.rawValue, '  Paused　');
    assert.equal(result.normalizedValue, 'Paused');
    assert.equal(JSON.stringify(rawFields), before);
  }
});

test('getSdfStatusValue は Status 欠失と存在する空値を区別する', () => {
  const { api } = loadDv360Api();
  const missing = api.getSdfStatusValue('CP', { Name: 'missing' });
  const empty = api.getSdfStatusValue('CP', { Name: 'empty', Status: '' });
  assert.equal(missing.found, false);
  assert.equal(missing.matchedKey, null);
  assert.equal(empty.found, true);
  assert.equal(empty.matchedKey, 'Status');
  assert.equal(empty.rawValue, '');
  assert.equal(empty.normalizedValue, '');
});

test('parseSdfData は CP～CR の全階層で同じ Status 取得結果を保持する', () => {
  const { api } = loadDv360Api();
  const fixtures = [
    ['SDF-Campaigns.csv', ['Name', 'Campaign Id', 'Status'], ['CP', 'cp1', 'Paused'], 'cpList'],
    ['SDF-InsertionOrders.csv', ['Name', 'Io Id', 'Status'], ['IO', 'io1', 'Draft'], 'ioList'],
    ['SDF-LineItems.csv', ['Name', 'Line Item Id', 'Status'], ['LI', 'li1', 'Paused'], 'liList'],
    ['SDF-AdGroups.csv', ['Name', 'Ad Group Id', 'Status'], ['GP', 'gp1', 'Active'], 'gpList'],
    ['SDF-AdGroupAds.csv', ['Name', 'Ad Id', 'Status'], ['CR', 'cr1', 'Active'], 'crList'],
  ].map(([name, header, row]) => ({ name, rows: [header, row] }));
  const parsed = api.parseSdfData(fixtures);
  for (const [listName, expected] of [['cpList', 'Paused'], ['ioList', 'Draft'], ['liList', 'Paused'], ['gpList', 'Active'], ['crList', 'Active']]) {
    assert.equal(parsed[listName][0].fields.status, expected);
    assert.equal(parsed[listName][0].statusInfo.found, true);
    assert.equal(parsed[listName][0].statusInfo.matchedKey, 'Status');
    assert.equal(parsed[listName][0].statusInfo.rawValue, expected);
  }
});

function makeStatusDownload(status, { found = true } = {}) {
  const rawFields = found ? { Status: status } : { Name: 'missing-status' };
  return {
    name: 'status test',
    id: 'status-test',
    rawFields,
    rawFieldOrder: Object.keys(rawFields),
    statusInfo: found
      ? { found: true, matchedKey: 'Status', rawValue: status, normalizedValue: String(status ?? '').trim() }
      : { found: false, matchedKey: null, rawValue: undefined, normalizedValue: '' },
    fields: { status: found ? String(status ?? '').trim() : '' },
  };
}

test('初期案件は CP/IO/LI Draft・Paused、GP/CR Active を統一判定する', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('initial');
  for (const [level, value, expected] of [
    ['CP', 'Draft', 'ok'], ['CP', 'Paused', 'ok'], ['IO', 'Draft', 'ok'],
    ['LI', 'Paused', 'ok'], ['GP', 'Active', 'ok'], ['CR', 'Active', 'ok'],
    ['LI', 'Active', 'mismatch'], ['GP', 'Draft', 'mismatch'], ['CR', 'Paused', 'mismatch'],
  ]) {
    const item = api.buildCaseStatusItem(level, makeStatusDownload(value));
    assert.equal(item.result, expected, `${level} ${value}`);
    assert.equal(item.constrained, true);
    assert.equal(item.skipped, false);
  }
});

test('CR追加案件は CR のみ Draft・Paused を制約し CP～GP に warning を出さない', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('crAdditional');
  for (const level of ['CP', 'IO', 'LI', 'GP']) {
    const item = api.buildCaseStatusItem(level, makeStatusDownload('Active'));
    assert.equal(item.result, 'ok', level);
    assert.equal(item.constrained, false, level);
    assert.equal(item.skipped, true, level);
  }
  assert.equal(api.buildCaseStatusItem('CR', makeStatusDownload('Draft')).result, 'ok');
  assert.equal(api.buildCaseStatusItem('CR', makeStatusDownload('Paused')).result, 'ok');
  assert.equal(api.buildCaseStatusItem('CR', makeStatusDownload('Active')).result, 'mismatch');
});

test('受约束层的 Status 缺失显示未取得，不伪装成状态不符', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('initial');
  const item = api.buildCaseStatusItem('CR', makeStatusDownload('', { found: false }));
  assert.equal(item.result, 'warning');
  assert.equal(item.dVal, 'Status 未取得');
  assert.equal(item.statusInfo.found, false);
  assert.match(item.mpDetail, /Status 未取得/);
});

test('LI compare 使用当前案件区分并生成统一业务状态项', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('initial');
  const initialItem = api.compareLI({ fields: {} }, makeStatusDownload('Active')).find(item => item.label === 'ステータス');
  assert.equal(initialItem.result, 'mismatch');
  api.setSelectedDv360CaseType('crAdditional');
  const additionalItem = api.compareLI({ fields: {} }, makeStatusDownload('Active')).find(item => item.label === 'ステータス');
  assert.equal(additionalItem.result, 'ok');
  assert.equal(additionalItem.skipped, true);
});

test('CP～CR compare は呼び出し引数で案件状态规则を上書きできない', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('initial');
  const downloads = makeStatusDownload('Active');
  const cases = [
    ['CP', api.compareCP({ fields: {} }, downloads, ['Active'])],
    ['IO', api.compareIO({ fields: {} }, downloads, ['Active'])],
    ['LI', api.compareLI({ fields: {} }, downloads, ['Active'])],
    ['GP', api.compareGP({ fields: {} }, downloads, ['Draft'])],
    ['CR', api.compareCR({ fields: {} }, downloads, ['Draft'])],
  ];
  assert.equal(cases[0][1].find(item => item.label === 'ステータス').result, 'mismatch');
  assert.equal(cases[1][1].find(item => item.label === 'ステータス').result, 'mismatch');
  assert.equal(cases[2][1].find(item => item.label === 'ステータス').result, 'mismatch');
  assert.equal(cases[3][1].find(item => item.label === 'ステータス').result, 'ok');
  assert.equal(cases[4][1].find(item => item.label === 'ステータス').result, 'ok');
});

test('SDF-only でも案件状态判定を download-only に上書きしない', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('crAdditional');
  const item = api.buildSdfOnlyCoreItems('CP', makeStatusDownload('Active')).find(entry => entry.label === 'ステータス');
  assert.equal(item.result, 'ok');
  assert.equal(item.skipped, true);
  assert.equal(item.source, 'case-status');
});

test('LI/GP/CR は业务状态、固定 📥 Status、主字段の順に並ぶ', () => {
  const { api } = loadDv360Api();
  const expectedPrefixes = {
    LI: ['ステータス', 'raw_sdf__status', '動画タイプ'],
    GP: ['ステータス', 'raw_sdf__status', '動画フォーマット'],
    CR: ['ステータス', 'raw_sdf__status', '動画ID', '表示URL'],
  };
  for (const [level, expected] of Object.entries(expectedPrefixes)) {
    const keys = Array.from(api.getCoreLevelColumns(level, true), column => column.key);
    assert.deepEqual(keys.slice(0, expected.length), expected, level);
    assert.equal(keys.filter(key => key === 'raw_sdf__status').length, 1, level);
  }
});

test('LI/GP/CR compare は业务状态の直後に原始 Status を一度だけ保持する', () => {
  const { api } = loadDv360Api();
  api.setSelectedDv360CaseType('initial');
  const download = makeStatusDownload('  Paused  ');
  const comparisons = {
    LI: api.compareLI({ fields: {} }, download),
    GP: api.compareGP({ fields: {} }, download),
    CR: api.compareCR({ fields: {} }, download),
  };
  for (const [level, items] of Object.entries(comparisons)) {
    assert.equal(items[0].label, 'ステータス', level);
    assert.equal(items[1].key, 'raw_sdf__status', level);
    assert.equal(items[1].label, '📥 状态 Status', level);
    assert.equal(items[1].dVal, '  Paused  ', level);
    assert.equal(items.filter(item => item.key === 'raw_sdf__status').length, 1, level);
  }
});

test('动态 download-only 字段追加后 Status 不会在表尾重复', () => {
  const { api } = loadDv360Api();
  for (const level of ['LI', 'GP', 'CR']) {
    const core = api.getCoreLevelColumns(level, true);
    const columns = api.appendDynamicDownloadColumns(level, core, [{
      compItems: [
        { isAutoAdded: true, key: 'raw_sdf__status', label: '状态 / Status' },
        { isAutoAdded: true, key: 'raw_sdf__custom_field', label: 'Custom Field' },
      ],
    }]);
    const keys = Array.from(columns, column => column.key);
    assert.equal(keys.filter(key => key === 'raw_sdf__status').length, 1, level);
    assert.equal(keys.at(-1), 'raw_sdf__custom_field', level);
  }
});

test('SDF-only の LI/GP/CR でも固定原始 Status の来源と値を保持する', () => {
  const { api } = loadDv360Api();
  for (const level of ['LI', 'GP', 'CR']) {
    const item = api.buildSdfOnlyCoreItems(level, makeStatusDownload('Active'))
      .find(entry => entry.key === 'raw_sdf__status');
    assert.equal(item.source, 'raw-sdf-status', level);
    assert.equal(item.dVal, 'Active', level);
    assert.equal(item.result, 'ok', level);
  }
});

test('CP～CR の共通結果表示は差分をダウンロード視点の文言で示す', () => {
  const { api } = loadDv360Api();
  const comparison = {
    label: '年齢',
    sVal: '18-24; 25-34',
    dVal: '25-34; Unknown',
    result: 'mismatch',
    mpDetail: '不足：18-24 / 追加：Unknown',
  };

  for (const level of ['CP', 'IO', 'LI', 'GP', 'CR']) {
    const html = api.buildRowHtml({
      found: true,
      fromSdf: false,
      name: `${level} test`,
      ownStatus: 'mismatch',
      status: 'mismatch',
      compItems: [comparison],
    }, 0, level, [{ key: '年齢' }], { mismatch: '❌' }, { mismatch: '不一致' });

    // 2026-08-09: 表記を自然日本語に統一（不足/追加 のまま表示）
    assert.match(html, /不足：18-24/, level);
    assert.match(html, /追加：Unknown/, level);
    assert.doesNotMatch(html, /下载少了|下载多了/, level);
    assert.match(html, /cell-mismatch/, `${level} の判定表示は変更しない`);
  }
});
