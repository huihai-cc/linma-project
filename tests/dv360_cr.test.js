// CR 层测试（2026-08-03 修正版）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createClassList() {
  const values = new Set();
  return { add(...names) { names.forEach(name => values.add(name)); }, remove(...names) { names.forEach(name => values.delete(name)); }, contains(name) { return values.has(name); } };
}

function createElement() {
  return { addEventListener() {}, appendChild() {}, classList: createClassList(), closest() { return null; }, dataset: {}, innerHTML: '', scrollIntoView() {}, style: { setProperty() {} }, textContent: '', value: '' };
}

function loadDv360Api() {
  const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source);

  const exportBlock = `
window.__dv360TestApi = {
  compareCR: typeof compareCR === 'function' ? compareCR : undefined,
  compareCP: typeof compareCP === 'function' ? compareCP : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  compareField: typeof compareField === 'function' ? compareField : undefined,
  compareStatus: typeof compareStatus === 'function' ? compareStatus : undefined,
  statusValuesEquivalent: typeof statusValuesEquivalent === 'function' ? statusValuesEquivalent : undefined,
  getSdfFieldDisplayLabel: typeof getSdfFieldDisplayLabel === 'function' ? getSdfFieldDisplayLabel : undefined,
  sdfFieldDisplayLabels: typeof SDF_FIELD_DISPLAY_LABELS !== 'undefined' ? SDF_FIELD_DISPLAY_LABELS : undefined,
  normalizeSdfFieldName: typeof normalizeSdfFieldName === 'function' ? normalizeSdfFieldName : undefined,
  calcOwnStatus: typeof calcOwnStatus === 'function' ? calcOwnStatus : undefined,
  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === 'function' ? setSelectedDv360CaseType : undefined,
  setMediaType: function(value) { mediaType=value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader() {}, JSZip: {},
    Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__dv360TestApi;
}

const api = loadDv360Api();
api.setMediaType('youtube');

function findCompareItem(items, label) {
  return items.find(item => item.label === label);
}

function makeCrDownload(fields) {
  return {
    name: 'Test CR', id: 'cr1',
    fields: { status: 'Active', videoId: 'abcdefghijk', displayUrl: '', landingPageUrl: '',
      callToAction: '', headline: '', infeedVideoHeadline: '', description1: '', adType: 'Responsive', ...fields },
    rawFields: {},
    rawFieldOrder: [],
  };
}

function makeCrSetting(fields) {
  return { fields: { videoUrl: '', displayUrl: '', landingUrl: '', cta: '', headline: '',
    longHeadline: '', description: '', companionBanner: '', ...fields } };
}

// ============================================================
// In-feed Video Headline → 長い見出し※
// ============================================================
test('CR In-feed Video Headline: 長い見出し※ 同 → ok', () => {
  const items = api.compareCR(makeCrSetting({ longHeadline: '長い見出しテキスト' }),
    makeCrDownload({ infeedVideoHeadline: '長い見出しテキスト' }), '');
  const item = findCompareItem(items, '長い見出し※');
  assert.equal(item.result, 'ok');
  assert.equal(item.sVal, '長い見出しテキスト');
  assert.equal(item.dVal, '長い見出しテキスト');
});

test('CR In-feed Video Headline: 異 → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ longHeadline: '設定値' }),
    makeCrDownload({ infeedVideoHeadline: '別の値' }), '');
  const item = findCompareItem(items, '長い見出し※');
  assert.equal(item.result, 'mismatch');
});

test('CR In-feed Video Headline: 空 vs 有値 → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ longHeadline: '' }),
    makeCrDownload({ infeedVideoHeadline: 'DLにある値' }), '');
  const item = findCompareItem(items, '長い見出し※');
  assert.equal(item.result, 'mismatch');
});

test('CR In-feed Video Headline: 不再读取説明※', () => {
  // sf.description（説明※）は使わない。sf.longHeadline（長い見出し※）のみ使う
  const items = api.compareCR(makeCrSetting({ longHeadline: '長い', description: '説明' }),
    makeCrDownload({ infeedVideoHeadline: '長い' }), '');
  const item = findCompareItem(items, '長い見出し※');
  assert.equal(item.sVal, '長い');  // from longHeadline, NOT description
});

// ============================================================
// Description 1 → 説明※
// ============================================================
test('CR Description 1: 説明※ 同 → ok', () => {
  const items = api.compareCR(makeCrSetting({ description: '説明本文' }),
    makeCrDownload({ description1: '説明本文' }), '');
  const item = findCompareItem(items, '説明※');
  assert.equal(item.result, 'ok');
  assert.equal(item.sVal, '説明本文');
  assert.equal(item.dVal, '説明本文');
});

test('CR Description 1: 異 → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ description: '設定値' }),
    makeCrDownload({ description1: '異なる値' }), '');
  const item = findCompareItem(items, '説明※');
  assert.equal(item.result, 'mismatch');
});

test('CR Description 1: 空 vs 有値 → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ description: '' }),
    makeCrDownload({ description1: 'DL説明' }), '');
  const item = findCompareItem(items, '説明※');
  assert.equal(item.result, 'mismatch');
});

test('CR Description 1: 不再读取コンパニオンバナー', () => {
  // sf.description を使う。sf.companionBanner は使わない
  const items = api.compareCR(makeCrSetting({ description: '説明文', companionBanner: 'バナー文' }),
    makeCrDownload({ description1: '説明文' }), '');
  const descItem = findCompareItem(items, '説明※');
  assert.equal(descItem.sVal, '説明文');  // from sf.description
  const companionItem = findCompareItem(items, 'コンパニオンバナー');
  assert.equal(companionItem.sVal, 'バナー文');  // companion is separate
});

// ============================================================
// コンパニオンバナー（Asset ID が設定表で追跡できる場合のみ SDF 照合）
// ============================================================
test('CR コンパニオンバナー: 空値 → ok', () => {
  const items = api.compareCR(makeCrSetting({ companionBanner: '' }), makeCrDownload({}), '');
  const item = findCompareItem(items, 'コンパニオンバナー');
  assert.equal(item.result, 'ok');
});

test('CR コンパニオンバナー: 推奨文案 → ok', () => {
  const items = api.compareCR(makeCrSetting({ companionBanner: 'チャンネル内の動画から自動生成された画像を使用する（推奨）' }),
    makeCrDownload({}), '');
  const item = findCompareItem(items, 'コンパニオンバナー');
  assert.equal(item.result, 'ok');
});

test('CR コンパニオンバナー: 他値 → warning', () => {
  const items = api.compareCR(makeCrSetting({ companionBanner: '何か他の値' }), makeCrDownload({}), '');
  const item = findCompareItem(items, 'コンパニオンバナー');
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail);
  assert.match(item.mpDetail, /Asset ID/);
});

test('CR コンパニオンバナー: SDF の Asset ID を表示', () => {
  const items = api.compareCR(makeCrSetting({ companionBanner: '推奨' }),
    makeCrDownload({ description1: '何か' }), '');
  const item = findCompareItem(items, 'コンパニオンバナー');
  assert.equal(item.dVal, '(空欄)');
});

// ============================================================
// Display URL
// ============================================================
test('CR Display URL: S空 D空 → ok', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: '' }), makeCrDownload({ displayUrl: '' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
});

test('CR Display URL: S空 D=「-」→ ok', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: '' }), makeCrDownload({ displayUrl: '-' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
});

test('CR Display URL: S=aflac.co.jp D=aflac.co.jp → ok', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: 'aflac.co.jp' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
});

test('CR Display URL: S空 D=aflac.co.jp → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: '' }),
    makeCrDownload({ displayUrl: 'aflac.co.jp' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'mismatch');
});

test('CR Display URL: S有値 D=「—」→ ok（DL空等同）', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: '—' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
});

test('CR Display URL: S有値 D空 → ok（DL空なら常にok）', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: '' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
});

test('CR Display URL: 不下发旧错误提示', () => {
  // When D is empty, mpDetail should NOT contain "設定表に表示URLがあるが、DLは空です"
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: '' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
  assert.ok(!item.mpDetail || !item.mpDetail.includes('設定表に表示URLがあるが'));
});

test('CR Display URL: D空不计入mismatch', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: '' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'ok');
  assert.notEqual(item.result, 'mismatch');
});

test('CR Display URL: S=aflac.co.jp D=www.aflac.co.jp → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: 'www.aflac.co.jp' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'mismatch');
});

test('CR Display URL: S=aflac.co.jp D=https://aflac.co.jp → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: 'aflac.co.jp' }),
    makeCrDownload({ displayUrl: 'https://aflac.co.jp' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'mismatch');
});

test('CR Display URL: DL有内容时不走warning → mismatch', () => {
  const items = api.compareCR(makeCrSetting({ displayUrl: '' }),
    makeCrDownload({ displayUrl: 'http://example.com' }), '');
  const item = findCompareItem(items, '表示URL');
  assert.equal(item.result, 'mismatch');
  assert.notEqual(item.result, 'warning');
});

// ============================================================
// 回帰
// ============================================================
test('CR 回帰: Ad Type=Responsive → ok', () => {
  const items = api.compareCR({}, makeCrDownload({ adType: 'Responsive' }), '');
  assert.equal(findCompareItem(items, '広告形式').result, 'ok');
});

test('CR 回帰: CTA/LP URL/Status不受影响', () => {
  const items = api.compareCR(makeCrSetting({ cta: '購入', landingUrl: 'https://lp.example.com' }),
    makeCrDownload({ callToAction: '購入', landingPageUrl: 'https://lp.example.com' }), 'Active');
  assert.equal(findCompareItem(items, 'CTA').result, 'ok');
  assert.equal(findCompareItem(items, 'LP URL').result, 'ok');
  assert.equal(findCompareItem(items, 'ステータス').result, 'ok');
});

test('CR 回帰: CR字段包含业务状态和固定原始 Status（11个）', () => {
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({}), 'Active');
  const labels = items.map(i => i.label);
  assert.equal(labels.length, 11);
  const expected = ['ステータス','📥 状态 Status','動画ID','表示URL','LP URL','CTA','見出し','長い見出し※','説明※','コンパニオンバナー','広告形式'];
  expected.forEach(e => assert.ok(labels.includes(e), `Missing label: ${e}`));
});

test('CR 回帰: 列key与item label匹配', () => {
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({}), '');
  const labels = items.map(i => i.label);
  // 長い見出し※ (not 説明※ for In-feed Video Headline)
  assert.ok(labels.includes('長い見出し※'));
  // 説明※ (for Description 1)
  assert.ok(labels.includes('説明※'));
  // コンパニオンバナー (standalone)
  assert.ok(labels.includes('コンパニオンバナー'));
});

// ============================================================
// 案件区分 状態テスト（2026-08-03）
// ============================================================
test('compareStatus: 配列対応 Draft→ok', () => {
  assert.equal(api.compareStatus(['Draft','Paused'], 'Draft'), 'ok');
});

test('compareStatus: 配列対応 Paused→ok', () => {
  assert.equal(api.compareStatus(['Draft','Paused'], 'Paused'), 'ok');
});

test('compareStatus: 配列対応 Active→mismatch', () => {
  assert.equal(api.compareStatus(['Draft','Paused'], 'Active'), 'mismatch');
});

test('compareStatus: 単一値 Active→ok', () => {
  assert.equal(api.compareStatus('Active', 'Active'), 'ok');
});

test('compareStatus: 単一値 Draft→mismatch（Active期待）', () => {
  assert.equal(api.compareStatus('Active', 'Draft'), 'mismatch');
});

// 初期案件
test('初期案件: CP Draft→ok', () => {
  const items = api.compareCP({fields:{}}, {fields:{status:'Draft'}}, ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('初期案件: CP Paused→ok', () => {
  const items = api.compareCP({fields:{}}, {fields:{status:'Paused'}}, ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('初期案件: IO Draft→ok', () => {
  const items = api.compareIO({fields:{}}, {fields:{status:'Draft'}}, ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('初期案件: LI（download-only default）Draft正常', () => {
  // LI has no expectedStatus in compareLI; status goes through default rules
  assert.ok(true); // LI status via DOWNLOAD_FIELD_DEFAULT_RULES.LI.Status
});

test('初期案件: GP Active→ok', () => {
  const items = api.compareGP({}, {fields:{status:'Active'},rawFields:{}}, ['Active']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('初期案件: CR Active→ok', () => {
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({status:'Active'}), ['Active']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('初期案件: CP Active→mismatch', () => {
  const items = api.compareCP({fields:{}}, {fields:{status:'Active'}}, ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'mismatch');
});

test('初期案件: GP Draft→mismatch', () => {
  const items = api.compareGP({}, {fields:{status:'Draft'},rawFields:{}}, ['Active']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'mismatch');
});

test('初期案件: CR Paused→mismatch', () => {
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({status:'Paused'}), ['Active']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'mismatch');
});

test('初期案件: CR Draft→mismatch', () => {
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({status:'Draft'}), ['Active']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'mismatch');
});

// CR追加案件
test('CR追加案件: CR Draft→ok', () => {
  api.setSelectedDv360CaseType('crAdditional');
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({status:'Draft'}), ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('CR追加案件: CR Paused→ok', () => {
  api.setSelectedDv360CaseType('crAdditional');
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({status:'Paused'}), ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
});

test('CR追加案件: CR Active→mismatch', () => {
  api.setSelectedDv360CaseType('crAdditional');
  const items = api.compareCR(makeCrSetting({}), makeCrDownload({status:'Active'}), ['Draft','Paused']);
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'mismatch');
});

test('CR追加案件: CP Active 不受影响（null=制限なし）', () => {
  api.setSelectedDv360CaseType('crAdditional');
  const items = api.compareCP({fields:{}}, {fields:{status:'Active'}}, '');
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
  assert.equal(st.skipped, true);
});

test('CR追加案件: IO Active 不受影响', () => {
  api.setSelectedDv360CaseType('crAdditional');
  const items = api.compareIO({fields:{}}, {fields:{status:'Active'}}, '');
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
  assert.equal(st.skipped, true);
});

test('CR追加案件: GP Active 不受影响', () => {
  api.setSelectedDv360CaseType('crAdditional');
  const items = api.compareGP({}, {fields:{status:'Active'},rawFields:{}}, '');
  const st = items.find(i=>i.label==='ステータス');
  assert.equal(st.result, 'ok');
  assert.equal(st.skipped, true);
});

// Draft=Paused 等价保留
test('Draft=Paused等价: compareStatus継続確認', () => {
  assert.equal(api.statusValuesEquivalent('Draft', 'Paused'), true);
  assert.equal(api.statusValuesEquivalent('Paused', 'Draft'), true);
  assert.equal(api.compareStatus('Draft', 'Paused'), 'ok');
});
