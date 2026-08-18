// ============================================================
// 2026-08-18 専用テスト：地域指定状態ラベルの排除
// 「エリア指定あり」等は地域名ではなく状態ラベル。
// 設定表地域の include / exclude に混入させない（parseSettingGeography 層で統一除外）。
// 回帰: Japan / 都道府県 / 市区町村 / 地域 Include・Exclude /
//       エリアシート参照 / 地域シート参照 / 別シート参照 / 各媒体
// ============================================================
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
window.__dv360GeoLabelApi = {
  parseSettingGeography: typeof parseSettingGeography === 'function' ? parseSettingGeography : undefined,
  compareGeography: typeof compareGeography === 'function' ? compareGeography : undefined,
  geoNamesFromReferenceCell: typeof geoNamesFromReferenceCell === 'function' ? geoNamesFromReferenceCell : undefined,
  isGeographyStatusLabel: typeof isGeographyStatusLabel === 'function' ? isGeographyStatusLabel : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  setMediaType: function(value) { mediaType=value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
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
  sandbox.__dv360GeoLabelApi.setMediaType('youtube');
  return { api: sandbox.__dv360GeoLabelApi, document, sandbox };
}

const { api } = loadDv360Api();

const STATUS_LABELS = ['エリア指定あり', 'エリア指定有', '地域指定あり', '地域指定有', '配信地域指定あり'];

// ============================================================
// 主案例: エリア指定あり + 都府県 → 都府県のみ
// ============================================================
test('エリア指定あり+都府県: include は都府県のみで状態ラベルが混入しない', () => {
  const parsed = api.parseSettingGeography('エリア指定あり\n大阪府/京都府/兵庫県');
  assert.deepEqual([...parsed.include], ['大阪府', '京都府', '兵庫県']);
  assert.deepEqual([...parsed.exclude], []);
  assert.equal(parsed.include.includes('エリア指定あり'), false);
  assert.equal(parsed.include.includes('エリアあり'), false);
});

test('エリア指定あり は geography include/exclude に入らない', () => {
  const parsed = api.parseSettingGeography('エリア指定あり');
  assert.deepEqual([...parsed.include], []);
  assert.deepEqual([...parsed.exclude], []);
});

test('5 種の状態ラベルすべてが include/exclude に入らない', () => {
  STATUS_LABELS.forEach(label => {
    const parsed = api.parseSettingGeography(`${label}\n大阪府/京都府`);
    assert.deepEqual([...parsed.include], ['大阪府', '京都府'], label);
    assert.deepEqual([...parsed.exclude], [], label);
  });
});

// ============================================================
// isGeographyStatusLabel: 完全一致で判定
// ============================================================
test('isGeographyStatusLabel: 5 種の状態ラベルを検出（前後空白・全角空白許容）', () => {
  STATUS_LABELS.forEach(label => {
    assert.equal(api.isGeographyStatusLabel(label), true, label);
    assert.equal(api.isGeographyStatusLabel(` ${label} `), true, label);
    assert.equal(api.isGeographyStatusLabel(`${label}　`), true, label);
  });
});

test('isGeographyStatusLabel: シート参照・実地域名・単語部分一致は誤判定しない', () => {
  ['エリアシート参照', '地域シート参照', '別シート参照', '配信地域シート参照',
   '大阪府', '東京都', '日本', 'Japan', '大阪市', '港区',
   'エリア', '地域', 'エリア指定なし', 'エリア指定', '配信地域'].forEach(value => {
    assert.equal(api.isGeographyStatusLabel(value), false, value);
  });
});

// ============================================================
// compareGeography 端到端（YouTube 地域比較項目）
// ============================================================
test('compareGeography: sVal に エリア指定あり が表示されない', () => {
  const compared = api.compareGeography(
    'エリア指定あり\n大阪府/京都府/兵庫県',
    '2392; 2508; 2567;',  // 大阪府/京都府/兵庫県 の都道府県ID相当
    '',
  );
  assert.equal(compared.sVal.includes('エリア指定あり'), false);
  assert.equal(compared.sVal.includes('エリアあり'), false);
  assert.equal([...compared.normalizedSetting.include].includes('エリア指定あり'), false);
});

test('compareLI YouTube: 地域項目に状態ラベルが含まれない', () => {
  const items = api.compareLI(
    { fields: { region: 'エリア指定あり\n大阪府/京都府/兵庫県' } },
    {
      name: 'YouTube test', id: 'youtube-test', rawFields: {}, rawFieldOrder: [],
      statusInfo: { found: true, matchedKey: 'Status', rawValue: 'Paused', normalizedValue: 'Paused' },
      fields: { status: 'Paused', geographyTargeting: '2392; 2508; 2567;' },
    },
  );
  const region = items.find(entry => entry.label === '地域 / Geography Targeting' || entry.label === '地域');
  assert.ok(region, 'region comparison item should exist');
  assert.equal(region.sVal.includes('エリア指定あり'), false);
  assert.equal(region.sVal.includes('エリアあり'), false);
});

// ============================================================
// 回帰: 従来の地域値・参照シート・シート参照は影響なし
// ============================================================
test('回帰: Japan（国名）は従来どおり', () => {
  const parsed = api.parseSettingGeography('日本');
  assert.deepEqual([...parsed.include], ['日本']);
  const parsedEn = api.parseSettingGeography('Japan');
  assert.deepEqual([...parsedEn.include], ['Japan']);
});

test('回帰: 市区町村・都道府県は従来どおり include に入る', () => {
  const parsed = api.parseSettingGeography('大阪市\n港区');
  assert.deepEqual([...parsed.include], ['大阪市', '港区']);
});

test('回帰: 地域 Include/Exclude 構文は従来どおり', () => {
  const parsed = api.parseSettingGeography('配信：大阪府\n除外：京都府');
  assert.deepEqual([...parsed.include], ['大阪府']);
  assert.deepEqual([...parsed.exclude], ['京都府']);
});

test('回帰: エリアシート参照 / 別シート参照 は従来どおり参照扱い', () => {
  const areaSheet = api.parseSettingGeography('エリアシート参照');
  assert.equal(areaSheet.include.length, 0);
  assert.equal(areaSheet.unknown.length, 1);
  const otherSheet = api.parseSettingGeography('別シート参照');
  assert.equal(otherSheet.include.length, 0);
  assert.equal(otherSheet.unknown.length, 1);
});

test('回帰: 参照シートのセルで エリア指定あり は地域名として追加されない', () => {
  const parsed = api.geoNamesFromReferenceCell('エリア指定あり');
  assert.deepEqual([...parsed.names], []);
  assert.deepEqual([...parsed.codes], []);
});
