// DV360 OTT オーディエンス4項目 + Google Audience Master テスト（2026-08-07）
// Parser 1-5 / Master 6-14 / 実案件 15-18 / Advertiser固有 19-22 / 空値 23 / 回帰 24-26
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const ottRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/OTT';

function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = '\n' +
'window.__audienceApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Demographic: typeof compareLI_OTT_Demographic === "function" ? compareLI_OTT_Demographic : undefined,\n' +
'  compareDemographicTargeting: typeof compareDemographicTargeting === "function" ? compareDemographicTargeting : undefined,\n' +
'  isOttDemographicAllValue: typeof isOttDemographicAllValue === "function" ? isOttDemographicAllValue : undefined,\n' +
'  compareLI_OTT_DemographicAllAware: typeof compareLI_OTT_DemographicAllAware === "function" ? compareLI_OTT_DemographicAllAware : undefined,\n' +
'  normalizeDv360AudienceName: typeof normalizeDv360AudienceName === "function" ? normalizeDv360AudienceName : undefined,\n' +
'  hydrateAudienceTargetMaster: typeof hydrateAudienceTargetMaster === "function" ? hydrateAudienceTargetMaster : undefined,\n' +
'  resolveDv360AudienceName: typeof resolveDv360AudienceName === "function" ? resolveDv360AudienceName : undefined,\n' +
'  compareOttGoogleAudience: typeof compareOttGoogleAudience === "function" ? compareOttGoogleAudience : undefined,\n' +
'  parseOttAudienceIdSet: typeof parseOttAudienceIdSet === "function" ? parseOttAudienceIdSet : undefined,\n' +
'  parseOttAudienceNameSet: typeof parseOttAudienceNameSet === "function" ? parseOttAudienceNameSet : undefined,\n' +
'  ensureAudienceMasterLoaded: typeof ensureAudienceMasterLoaded === "function" ? ensureAudienceMasterLoaded : undefined,\n' +
'  getAudienceById: function() { return audienceById; },\n' +
'  getAudienceNameToIds: function() { return audienceNameToIds; },\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
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
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__audienceApi;
}

function parseWorkbook(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sname of wb.SheetNames) {
    sheets[sname] = XLSX.utils.sheet_to_json(wb.Sheets[sname], { header: 1, defval: '', raw: false });
  }
  return { sheets, sheetNames: wb.SheetNames };
}

async function parseSdfZip(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const csvFiles = [];
  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const blob = await entry.async('blob');
    const buffer = Buffer.from(await blob.arrayBuffer());
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch (e) {
      try { text = new TextDecoder('shift_jis', { fatal: true }).decode(buffer); }
      catch (e2) { text = new TextDecoder('utf-8').decode(buffer); }
    }
    const lines = text.split(/\r?\n/);
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim());
      if (cols.some(c => c)) rows.push(cols);
    }
    if (rows.length > 0) csvFiles.push({ name: filename, rows });
  }
  return csvFiles;
}

function findItem(items, label) {
  return items.find(i => i.label === label);
}

const api = loadDv360Api();
let masterReady = null;
function readyMaster() {
  if (!masterReady) masterReady = api.ensureAudienceMasterLoaded();
  return masterReady;
}

// モック LI（比較用）: オーディエンス4項目を自由に設定できる
function mockLi(sAudiences, dAudienceFields) {
  const sFields = Object.assign({
    videoType: 'VRC(s)', startDate: '2026/06/24', endDate: '2026/06/30',
    daypart: '', budgetNet: '500000', pacing: '掲載期間', billing: 'CPM',
    inventory: 'OTT', language: '', geo: 'Japan', gender: '', age: '',
    parentalStatus: '', householdIncome: '',
    audienceFirstPartyPartner: '', audienceGoogle: '', audienceCustomList: '', audienceCombined: '',
  }, sAudiences || {});
  const rawFields = Object.assign({
    'Status': 'Active', 'Line Item Type': 'Standard', 'Start Date': '06/24/2026',
    'End Date': '06/30/2026', 'Budget Type': 'TOTAL', 'Budget Amount': '500000',
    'Pacing': 'Flight', 'Pacing Rate': 'Evenly', 'Bid Strategy Type': 'Target CPM',
    'Bid Strategy Value': '', 'Revenue Type': 'None', 'Language Targeting - Include': '',
    'Device Targeting - Include': '', 'Environment Targeting': '',
    'Geography Targeting - Include': '2392', 'Geography Targeting - Exclude': '',
    'Daypart Targeting': '', 'Partner Revenue Model': '', 'Partner Revenue Amount': '',
    'Demographic Targeting Gender': '', 'Demographic Targeting Age': '',
    'Demographic Targeting Parental Status': '', 'Demographic Targeting Household Income': '',
  }, dAudienceFields || {});
  return {
    name: 'Test LI', fields: sFields,
    rawFields,
  };
}

// ═══════════════════════════════════════════
// 1-5. Parser: 設定表から4項目を独立にパース
// ═══════════════════════════════════════════
test('P-1: parseOttSetting はオーディエンス4項目を独立フィールドで返す', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const li = setting.liList[0];
  assert.ok('audienceFirstPartyPartner' in li.fields, 'audienceFirstPartyPartner key');
  assert.ok('audienceGoogle' in li.fields, 'audienceGoogle key');
  assert.ok('audienceCustomList' in li.fields, 'audienceCustomList key');
  assert.ok('audienceCombined' in li.fields, 'audienceCombined key');
  assert.ok(!('audience' in li.fields), 'no shared audience key');
  assert.ok(!('affinity' in li.fields), 'no legacy affinity key');
  assert.ok(!('customList' in li.fields), 'no legacy customList key');
});

test('P-2: 実案件001 アフィニティカテゴリー=料理愛好家、他3項目は空（相互に上書きしない）', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const li = setting.liList.find(l => l.fields.audienceGoogle === '料理愛好家');
  assert.ok(li, 'LI with 料理愛好家 should exist');
  assert.equal(li.fields.audienceFirstPartyPartner, '', 'firstParty empty');
  assert.equal(li.fields.audienceCustomList, '', 'customList empty');
  assert.equal(li.fields.audienceCombined, '', 'combined empty');
});

test('P-3: 単一値（料理愛好家）が正しくパースされる', () => {
  assert.equal(api.parseOttAudienceNameSet('料理愛好家').join(','), '料理愛好家');
});

test('P-4: 複数値（改行/セミコロン/読点）を分割してパース', () => {
  assert.equal(api.parseOttAudienceNameSet('旅行好き\nアウトドア ファン').join(','), '旅行好き,アウトドア ファン');
  assert.equal(api.parseOttAudienceNameSet('料理愛好家;テクノロジー愛好家').join(','), '料理愛好家,テクノロジー愛好家');
  assert.equal(api.parseOttAudienceNameSet('スポーツファン、映画ファン').join(','), 'スポーツファン,映画ファン');
});

test('P-5: 空値・空白のみ → 空配列', () => {
  assert.equal(api.parseOttAudienceNameSet('').length, 0);
  assert.equal(api.parseOttAudienceNameSet('   ').length, 0);
  assert.equal(api.parseOttAudienceNameSet(null).length, 0);
  assert.equal(api.parseOttAudienceNameSet(undefined).length, 0);
  assert.equal(api.parseOttAudienceIdSet('').length, 0);
  assert.equal(api.parseOttAudienceIdSet('D:1; 2;').join(','), '1,2');
});

// ═══════════════════════════════════════════
// 6-14. Master: 読み込み・逆引き・比較
// ═══════════════════════════════════════════
test('M-6: master が読み込める（内嵌gzip → hydrate）', async () => {
  const ok = await readyMaster();
  assert.equal(ok, true, 'master should load');
  const byId = api.getAudienceById();
  assert.ok(byId.size >= 800, 'at least 800 entries, got ' + byId.size);
  const byName = api.getAudienceNameToIds();
  assert.ok(byName.size >= 800, 'name map size: ' + byName.size);
});

test('M-7: 4511689 = 料理愛好家（実案件ID）', async () => {
  await readyMaster();
  const rec = api.getAudienceById().get('4511689');
  assert.ok(rec, 'record for 4511689');
  assert.equal(rec.name, '料理愛好家');
  assert.equal(rec.type, 'affinity');
});

test('M-7b: embedded master は canonical type/source/updated_at を runtime record に保持する', async () => {
  await readyMaster();
  const rec = api.getAudienceById().get('80279');
  assert.ok(rec, 'record for YouTube case 011 ID 80279');
  assert.equal(rec.audienceType, 'IN_MARKET');
  assert.match(rec.source, /in-market-categories\.csv$/);
  assert.equal(rec.updatedAt, '2026-08-09');
});

test('M-8: ID→名前 resolveDv360AudienceName(google, id)', async () => {
  await readyMaster();
  assert.equal(api.resolveDv360AudienceName('google', '4511689'), '料理愛好家');
  assert.equal(api.resolveDv360AudienceName('google', '4509169'), 'アウトドア ファン');
});

test('M-9: 名前→ID 逆引き（同名複数IDを全件保持）', async () => {
  await readyMaster();
  const ids = api.getAudienceNameToIds().get('自動車');
  assert.ok(Array.isArray(ids), 'ids array');
  assert.ok(ids.length >= 2, 'multi candidates kept: ' + JSON.stringify(ids));
});

test('M-10: 未知ID → Unknown 表示 + warning + detail', async () => {
  await readyMaster();
  const cmp = api.compareOttGoogleAudience('料理愛好家', '999999999;');
  assert.equal(cmp.result, 'warning');
  assert.ok(cmp.dVal.includes('Unknown (999999999)'), 'dVal shows Unknown: ' + cmp.dVal);
  assert.ok(cmp.mpDetail.includes('Audience Master に存在しないID: 999999999'),
    'detail lists unknown id');
  assert.equal(cmp.unknownIds.join(','), '999999999');
});

test('M-11: 順序非依存・正規化同値で ok', async () => {
  await readyMaster();
  const a = api.compareOttGoogleAudience('料理愛好家', '4511689;');
  const b = api.compareOttGoogleAudience('料理愛好家', '4511689');
  const c = api.compareOttGoogleAudience('料理愛好家', '4511689;');
  assert.equal(a.result, 'ok');
  assert.equal(b.result, 'ok');
  assert.equal(c.mpDetail, '', 'no detail on match');
});

test('M-12: 追加（SDF側にのみある）→ 追加: 名前', async () => {
  await readyMaster();
  const cmp = api.compareOttGoogleAudience('料理愛好家', '4511689; 4509169;');
  assert.equal(cmp.result, 'warning');
  assert.ok(cmp.mpDetail.includes('追加: アウトドア ファン'), 'extra reported by name');
});

test('M-13: 不足（設定側にのみある）→ 不足: 名前', async () => {
  await readyMaster();
  const cmp = api.compareOttGoogleAudience('料理愛好家', '');
  assert.equal(cmp.result, 'warning');
  assert.ok(cmp.mpDetail.includes('不足: 料理愛好家'), 'missing reported by name');
});

test('M-14: Audience ID は文字列として保持（Number 化しない）', async () => {
  await readyMaster();
  for (const id of ['4511689', '4702369']) {
    const rec = api.getAudienceById().get(id);
    assert.ok(rec, 'record: ' + id);
    assert.equal(typeof rec.id, 'string', 'id is string');
    assert.equal(typeof rec.audience_id, 'undefined', 'no audience_id field (uses id)');
  }
  const firstKey = [...api.getAudienceById().keys()][0];
  assert.equal(typeof firstKey, 'string', 'map key is string');
});

// ═══════════════════════════════════════════
// 15-18. 実案件（Case 001）: 設定=料理愛好家 ↔ SDF=4511689
// ═══════════════════════════════════════════
test('R-15: 実案件 compareOttGoogleAudience → ok', async () => {
  await readyMaster();
  const cmp = api.compareOttGoogleAudience('料理愛好家', '4511689;');
  assert.equal(cmp.result, 'ok');
});

test('R-16: D表示 = 料理愛好家 (4511689)', async () => {
  await readyMaster();
  const cmp = api.compareOttGoogleAudience('料理愛好家', '4511689;');
  assert.equal(cmp.dVal, 'D: 料理愛好家 (4511689)');
  assert.equal(cmp.sVal, 'S: 料理愛好家');
});

test('R-17: フルパイプライン（設定表xlsx + SDF zip）で アフィニティ項目 ok', async () => {
  await readyMaster();
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  assert.ok(setting.liList.length > 0, 'LIs parsed');
  assert.ok(download.liList.length > 0, 'SDF LIs parsed');
  const sLi = setting.liList.find(l => l.fields.audienceGoogle === '料理愛好家');
  const dLi = download.liList[0];
  assert.ok(sLi, 'setting LI with 料理愛好家');
  const items = api.compareLI_OTT_Demographic(sLi, dLi);
  const aff = findItem(items, 'オーディエンス｜アフィニティカテゴリー');
  assert.ok(aff, 'affinity audience item exists');
  assert.equal(aff.result, 'ok', 'real case should match: ' + JSON.stringify(aff));
  assert.equal(aff.dVal, 'D: 料理愛好家 (4511689)');
});

test('R-18: compareLI 全体は実値のあるアフィニティのみ生成する', async () => {
  await readyMaster();
  const sLi = mockLi({
    audienceGoogle: '料理愛好家',
  }, {
    'Affinity & In Market Targeting - Include': '4511689;',
  });
  api.setMediaType('ott');
  const dLi = { name: 'Test LI', id: 'li1', fields: {}, rawFields: sLi.rawFields, statusInfo: { found: true, normalizedValue: 'Active' } };
  const items = api.compareLI(sLi, dLi);
  const labels = items.map(i => i.label);
  assert.ok(labels.includes('オーディエンス｜アフィニティカテゴリー'), 'affinity item');
  assert.equal(labels.includes('オーディエンス｜自社と第三者'), false, 'empty first party hidden');
  assert.equal(labels.includes('オーディエンス｜カスタムリスト'), false, 'empty custom hidden');
  assert.equal(labels.includes('オーディエンス｜統合'), false, 'empty combined hidden');
  assert.ok(!labels.includes('オーディエンス'), 'no legacy single audience item');
});

// ═══════════════════════════════════════════
// 19-22. Advertiser固有（自社と第三者/カスタムリスト/統合）
// ═══════════════════════════════════════════
test('A-19: 自社と第三者 は mismatch にせず warning（ID自動照合対象外）', async () => {
  await readyMaster();
  const sLi = mockLi({ audienceFirstPartyPartner: '自社オーディエンスA' },
    { 'Audience Targeting - Include': '123456789;' });
  const items = api.compareLI_OTT_Demographic(sLi, sLi);
  const item = findItem(items, 'オーディエンス｜自社と第三者');
  assert.ok(item, 'item exists');
  assert.notEqual(item.result, 'mismatch', 'never mismatch solely for master absence');
  assert.ok(item.mpDetail.includes('Advertiser固有AudienceのためID自動照合対象外'), 'detail');
});

test('A-20: 自社と第三者 D側は生IDを保持（名前解決しない）', async () => {
  await readyMaster();
  const sLi = mockLi({ audienceFirstPartyPartner: '自社オーディエンスA' },
    { 'Audience Targeting - Include': '123456789;' });
  const items = api.compareLI_OTT_Demographic(sLi, sLi);
  const item = findItem(items, 'オーディエンス｜自社と第三者');
  assert.ok(item.dVal.includes('123456789'), 'raw ID kept: ' + item.dVal);
  assert.ok(!item.dVal.includes('料理愛好家'), 'no name resolution for first party');
});

test('A-21: カスタムリスト は warning + Custom List detail', async () => {
  await readyMaster();
  const sLi = mockLi({ audienceCustomList: 'カスタムリストA' },
    { 'Custom List Targeting': '888888888;' });
  const items = api.compareLI_OTT_Demographic(sLi, sLi);
  const item = findItem(items, 'オーディエンス｜カスタムリスト');
  assert.ok(item, 'item exists');
  assert.ok(item.mpDetail.includes('Advertiser固有Custom ListのためID自動照合対象外'), 'detail');
  assert.ok(item.dVal.includes('888888888'), 'raw ID kept');
});

test('A-22: 統合 は warning + Combined Audience detail', async () => {
  await readyMaster();
  const sLi = mockLi({ audienceCombined: '統合オーディエンスA' },
    { 'Combined Audience Targeting': '777777777;' });
  const items = api.compareLI_OTT_Demographic(sLi, sLi);
  const item = findItem(items, 'オーディエンス｜統合');
  assert.ok(item, 'item exists');
  assert.ok(item.mpDetail.includes('Advertiser固有Combined AudienceのためID自動照合対象外'), 'detail');
  assert.ok(item.dVal.includes('777777777'), 'raw ID kept');
});

// ═══════════════════════════════════════════
// 23. 空値: 値のあるカテゴリのみ比較
// ═══════════════════════════════════════════
test('E-23: アフィニティのみ設定 → 他3項目は非表示・エラーなし', async () => {
  await readyMaster();
  const sLi = mockLi({ audienceGoogle: '料理愛好家' },
    { 'Affinity & In Market Targeting - Include': '4511689;' });
  const items = api.compareLI_OTT_Demographic(sLi, sLi);
  const aff = findItem(items, 'オーディエンス｜アフィニティカテゴリー');
  assert.ok(aff, 'affinity item');
  assert.equal(aff.result, 'ok');
  // 空の他項目は item 自体を生成しない
  const fp = findItem(items, 'オーディエンス｜自社と第三者');
  const cl = findItem(items, 'オーディエンス｜カスタムリスト');
  const cb = findItem(items, 'オーディエンス｜統合');
  assert.equal(fp, undefined);
  assert.equal(cl, undefined);
  assert.equal(cb, undefined);
});

// ═══════════════════════════════════════════
// 24-26. 回帰
// ═══════════════════════════════════════════
test('RG-24: normalizeDv360AudienceName（trim/全半角/連続空白/NFKC/改行/英語大小文字）', () => {
  assert.equal(api.normalizeDv360AudienceName(' 料理愛好家 '), '料理愛好家');
  assert.equal(api.normalizeDv360AudienceName('料理愛好家　テスト'), '料理愛好家 テスト');
  assert.equal(api.normalizeDv360AudienceName('旅行好き\nアウトドア'), '旅行好き アウトドア');
  assert.equal(api.normalizeDv360AudienceName('ＣＡＲＥｅｒ'), 'career');
  assert.equal(api.normalizeDv360AudienceName('Outdoor Enthusiasts'), 'outdoor enthusiasts');
});

test('RG-25: 共有 compareDemographicTargeting は変更なし（ALL wrapper 非適用）', () => {
  // OTT では ▼選択系を未設定として扱い、共有関数には波及させない
  assert.equal(api.isOttDemographicAllValue('▼選択（ALLとして解釈）'), false);
  assert.equal(api.isOttDemographicAllValue('男性'), false);
  assert.equal(api.compareLI_OTT_DemographicAllAware('▼選択', '', 'parentalStatus'), null,
    'wrapper: 未設定 + SDF空 → item非生成');
  // 共有関数は ALL 解釈しない（▼選択 + SDF空 は mismatch/warning のまま）
  const shared = api.compareDemographicTargeting('▼選択', '', 'parentalStatus');
  assert.notEqual(shared.result, 'ok', 'shared fn must NOT apply ALL rule: ' + shared.result);
});

test('RG-26: YouTube/CP/IO の既存比較は影響なし（関数存在とシグネチャ）', async () => {
  assert.equal(typeof api.compareLI, 'function', 'compareLI');
  assert.equal(typeof api.parseOttSetting, 'function', 'parseOttSetting');
  assert.equal(typeof api.parseSdfData, 'function', 'parseSdfData');
  assert.equal(typeof api.compareLI_OTT_Demographic, 'function', 'compareLI_OTT_Demographic');
  // グローバル master 変数は YouTube フローで必須でない（lazy 読み込み）
  await readyMaster();
  const byId = api.getAudienceById();
  assert.ok(byId.has('4511689'), 'master populated');
});
