// 2026-08-18: 状態 Status（raw_sdf__status）は案件区分ステータス（buildCaseStatusItem）に統合。
// YouTube LI/GP/CR の重複 Status 列を排除し、各層で「ステータス」業務列を1つだけ保つこと、
// および Status 業務判定（Draft/Paused 等価・GP/CR Active・CR追加案件・OTT/Display）が
// 変化していないことを検証する専用テスト。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');

function createElement(initialValue = '') {
  return {
    addEventListener() {},
    appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
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
window.__statusSingleTestApi = {
  setMediaType: function(v) { mediaType = v; },
  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === 'function' ? setSelectedDv360CaseType : undefined,
  compareCP: typeof compareCP === 'function' ? compareCP : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  compareCR: typeof compareCR === 'function' ? compareCR : undefined,
  buildCaseStatusItem: typeof buildCaseStatusItem === 'function' ? buildCaseStatusItem : undefined,
  buildRawSdfStatusItem: typeof buildRawSdfStatusItem === 'function' ? buildRawSdfStatusItem : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  compareStatus: typeof compareStatus === 'function' ? compareStatus : undefined,
  compareOttLiStatus: typeof compareOttLiStatus === 'function' ? compareOttLiStatus : undefined,
  getDownloadStatusInfo: typeof getDownloadStatusInfo === 'function' ? getDownloadStatusInfo : undefined,
  getSdfStatusValue: typeof getSdfStatusValue === 'function' ? getSdfStatusValue : undefined,
  getCaseAllowedStatuses: typeof getCaseAllowedStatuses === 'function' ? getCaseAllowedStatuses : undefined,
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
  return { api: sandbox.window.__statusSingleTestApi, document };
}

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

// 各層の compare 出力が「ステータス」業務列を1つだけ持ち、raw_sdf__status を出さないことを検証
function assertSingleBusinessStatus(api, level, fn, status) {
  const items = fn({ fields: {} }, makeStatusDownload(status));
  const statusItems = items.filter(item => item.label === 'ステータス');
  assert.equal(statusItems.length, 1, `${level}: 案件区分ステータス は1つだけ（${status}）`);
  assert.equal(statusItems[0].source, 'case-status', level);
  assert.equal(statusItems[0].skipped, false, `${level}: 案件区分制限ありのため skipped 不可`);
  assert.equal(items.filter(item => item.key === 'raw_sdf__status').length, 0, `${level}: raw_sdf__status（状態 Status）は表示しない`);
  return items;
}

// ── ユーザー要求: LI Status=Draft → 案件区分ステータス が1回だけ ──
test('LI Status=Draft: 案件区分ステータス が1回だけで 状態 Status は出ない（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('initial');
  const items = assertSingleBusinessStatus(api, 'LI', api.compareLI, 'Draft');
  const st = items.find(item => item.label === 'ステータス');
  assert.equal(st.result, 'ok', 'Draft は初期案件 LI の期待値');
  assert.equal(st.dVal, 'Draft');
  assert.equal(st.sVal, '想定: Draft / Paused');
  assert.equal(st.alwaysDisplay, true);
});

// ── ユーザー要求: GP Status=Active → 案件区分ステータス が1回だけ ──
test('GP Status=Active: 案件区分ステータス が1回だけで 状態 Status は出ない（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('initial');
  const items = assertSingleBusinessStatus(api, 'GP', api.compareGP, 'Active');
  const st = items.find(item => item.label === 'ステータス');
  assert.equal(st.result, 'ok', 'Active は GP の期待値');
  assert.equal(st.dVal, 'Active');
  assert.equal(st.sVal, '想定: Active');
});

// ── 全層の静的列定義にも raw_sdf__status は存在しない ──
test('CP/IO/LI/GP/CR の静的列定義に raw_sdf__status はなく、ステータス列は各層1つ（2026-08-18）', () => {
  const { api } = loadDv360Api();
  for (const level of ['CP', 'IO', 'LI', 'GP', 'CR']) {
    const keys = Array.from(api.getCoreLevelColumns(level, true), column => column.key);
    assert.equal(keys.includes('raw_sdf__status'), false, level);
    assert.equal(keys.filter(key => key === 'ステータス').length, 1, `${level}: ステータス列は1つ`);
  }
});

// ── 回帰: 初期案件の Status 判定（Draft/Paused 等価を含む）─ ─
test('回帰: 初期案件 CP/IO/LI Draft/Paused 等価・GP/CR Active 判定（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('initial');
  const compareFns = { CP: api.compareCP, IO: api.compareIO, LI: api.compareLI, GP: api.compareGP, CR: api.compareCR };
  for (const [level, value, expected] of [
    ['CP', 'Draft', 'ok'], ['CP', 'Paused', 'ok'], ['CP', 'Active', 'mismatch'],
    ['IO', 'Draft', 'ok'], ['IO', 'Paused', 'ok'],
    ['LI', 'Draft', 'ok'], ['LI', 'Paused', 'ok'], ['LI', 'Active', 'mismatch'],
    ['GP', 'Active', 'ok'], ['GP', 'Draft', 'mismatch'], ['GP', 'Paused', 'mismatch'],
    ['CR', 'Active', 'ok'], ['CR', 'Draft', 'mismatch'], ['CR', 'Paused', 'mismatch'],
  ]) {
    const items = compareFns[level]({ fields: {} }, makeStatusDownload(value));
    const st = items.find(item => item.label === 'ステータス');
    assert.ok(st, `${level}: ステータス item 必須`);
    assert.equal(st.result, expected, `${level} Status=${value} → ${expected}`);
    assert.equal(items.filter(item => item.key === 'raw_sdf__status').length, 0, `${level}: raw_sdf__status なし`);
  }
});

// ── 回帰: CR 追加案件（CR: Draft/Paused、CP/IO/LI/GP は制限なし）─ ─
test('回帰: CR 追加案件の Status 規則は不変（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('crAdditional');
  // CR: Draft/Paused のみ ok
  const crDraft = api.compareCR({ fields: {} }, makeStatusDownload('Draft'));
  assert.equal(crDraft.find(item => item.label === 'ステータス').result, 'ok');
  const crActive = api.compareCR({ fields: {} }, makeStatusDownload('Active'));
  assert.equal(crActive.find(item => item.label === 'ステータス').result, 'mismatch');
  assert.equal(crActive.filter(item => item.key === 'raw_sdf__status').length, 0);
  // CP/IO/LI/GP: 制限なし（constrained=false → skipped=true・result ok）
  for (const [level, fn] of [['CP', api.compareCP], ['IO', api.compareIO], ['LI', api.compareLI], ['GP', api.compareGP]]) {
    const items = fn({ fields: {} }, makeStatusDownload('Active'));
    const st = items.find(item => item.label === 'ステータス');
    assert.equal(st.constrained, false, `${level}: 制限なし`);
    assert.equal(st.skipped, true, `${level}: 制限なしは skipped`);
    assert.equal(st.result, 'ok', `${level}: 制限なしは ok`);
  }
});

// ── 回帰: OTT LI は従来どおり 案件区分ステータス＋状態 Status 併記 ──
test('回帰: OTT LI の Status 判定と raw 併記は不変（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('ott');
  api.setSelectedDv360CaseType('initial');
  // compareOttLiStatus は OTT 専用規則（Draft/Paused=ok, Active/Archived=mismatch）
  const items = api.compareLI({ fields: {} }, makeStatusDownload('Active'));
  const statusItems = items.filter(item => item.label === 'ステータス');
  assert.equal(statusItems.length, 1, 'OTT LI: 案件区分ステータス は1つ');
  assert.equal(statusItems[0].source, 'case-status');
  assert.equal(statusItems[0].result, 'mismatch', 'OTT LI: Active は mismatch（compareOttLiStatus の既存規則）');
  const pausedItems = api.compareLI({ fields: {} }, makeStatusDownload('Paused'));
  assert.equal(pausedItems.find(item => item.label === 'ステータス').result, 'ok', 'OTT LI: Paused は ok');
  // OTT は従来どおり raw_sdf__status を併記する（対象外）
  assert.equal(items.filter(item => item.key === 'raw_sdf__status').length, 1, 'OTT LI: 状態 Status 併記は従来どおり');
});

// ── 回帰: Display LI はステータス判定があり、raw_sdf__status は出ない ──
test('回帰: Display LI の Status 判定は不変・raw_sdf__status なし（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('display');
  api.setSelectedDv360CaseType('initial');
  const items = api.compareLI({ fields: {} }, makeStatusDownload('Draft'));
  const statusItems = items.filter(item => item.label === 'ステータス');
  assert.equal(statusItems.length, 1, 'Display LI: 案件区分ステータス は1つ');
  assert.equal(statusItems[0].source, 'case-status');
  assert.equal(statusItems[0].result, 'ok', 'Display LI: Draft は ok');
  assert.equal(items.filter(item => item.key === 'raw_sdf__status').length, 0, 'Display LI: raw_sdf__status なし');
});

// ── 回帰: Status 業務判定の内部関数は変更していない（等価比較の確認）─ ─
test('回帰: compareStatus の Draft/Paused 等価は不変（2026-08-18）', () => {
  const { api } = loadDv360Api();
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('initial');
  for (const level of ['CP', 'IO', 'LI']) {
    const allowed = api.getCaseAllowedStatuses(level);
    assert.deepEqual([...allowed], ['Draft', 'Paused'], level);
  }
  assert.deepEqual([...api.getCaseAllowedStatuses('GP')], ['Active'], 'GP');
  assert.deepEqual([...api.getCaseAllowedStatuses('CR')], ['Active'], 'CR');
});
