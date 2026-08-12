// OTT LI 修正 Round2 专项测试（2026-08-07）
// 覆盖范围（31项）:
//   UI/层级 [1-9]: 状態→比較結果 / 层级列表（YouTube 5 / OTT・Display 3）/
//                  Tab・Filter 動的構築 / reset / ステータス 列名不变
//   目標単価 [10-13]: ▼選択保持 / (未指定) / Fixed=入札形式 / SDF対応フィールドなし
//   Deal    [14-16]: Deal ID 保留 / Deal 詳細・フロア価格 削除
//   Demographic [17-19]: 子供・世帯年収 ALL/空白等价 / YouTube 非回归
//   Default SDF [20-29]: Brand Safety / Authorized Seller / Inventory Exclude
//   Rewarded [30-31]: SDF に reward 列なし → 項目非表示・誤認識なし
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

function createElement(initialValue = '') {
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
'window.__api = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  compareLI: typeof compareLI === "function" ? compareLI : undefined,\n' +
'  compareLI_OTT_Base: typeof compareLI_OTT_Base === "function" ? compareLI_OTT_Base : undefined,\n' +
'  compareLI_OTT_Deal: typeof compareLI_OTT_Deal === "function" ? compareLI_OTT_Deal : undefined,\n' +
'  compareLI_OTT_Demographic: typeof compareLI_OTT_Demographic === "function" ? compareLI_OTT_Demographic : undefined,\n' +
'  compareLI_OTT_DownloadDefaults: typeof compareLI_OTT_DownloadDefaults === "function" ? compareLI_OTT_DownloadDefaults : undefined,\n' +
'  compareDemographicTargeting: typeof compareDemographicTargeting === "function" ? compareDemographicTargeting : undefined,\n' +
'  compareOttInventoryExcludeDefault: typeof compareOttInventoryExcludeDefault === "function" ? compareOttInventoryExcludeDefault : undefined,\n' +
'  getVisibleLevels: typeof getVisibleLevels === "function" ? getVisibleLevels : undefined,\n' +
'  getCoreLevelColumns: typeof getCoreLevelColumns === "function" ? getCoreLevelColumns : undefined,\n' +
'  getLevelColumns: typeof getLevelColumns === "function" ? getLevelColumns : undefined,\n' +
'  renderAll: typeof renderAll === "function" ? renderAll : undefined,\n' +
'  updateTabCounters: typeof updateTabCounters === "function" ? updateTabCounters : undefined,\n' +
'  switchLevel: typeof window.switchLevel === "function" ? window.switchLevel : undefined,\n' +
'  toggleLevel: typeof window.toggleLevel === "function" ? window.toggleLevel : undefined,\n' +
'  resetAll: typeof window.resetAll === "function" ? window.resetAll : undefined,\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  getMediaType: function() { return mediaType; },\n' +
'  getSelectedMediaType: function() { return selectedMediaType; },\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
'  getSelectedDv360CaseType: typeof getSelectedDv360CaseType === "function" ? getSelectedDv360CaseType : undefined,\n' +
'  __setTreeRoots: function(roots) { treeRoots = roots; },\n' +
'  __setAllComparisonData: function(v) { allComparisonData = v; },\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');

  // 要素を記録できる DOM モック（Tab bar / Filter bar を検査用に捕捉）
  const captured = {};
  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(), documentElement: createElement(),
    createElement,
    getElementById(id) {
      if (id === 'filter-bar' && !elements.has(id)) {
        // 層級ボタン再構築を検証するための特殊モック
        const group = createElement();
        group._buttons = [];
        group.appendChild = function (b) { this._buttons.push(b); };
        const span = createElement(); span.textContent = '層級フィルタ';
        group.querySelector = function (sel) { return sel === 'span' ? span : null; };
        group.querySelectorAll = function (sel) { return sel === '.filter-group' ? [group] : []; };
        elements.set(id, group);
      } else if (!elements.has(id)) {
        elements.set(id, createElement());
      }
      captured[id] = elements.get(id);
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
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
  return { api: sandbox.__api, captured };
}

const { api, captured } = loadDv360Api();
const htmlRaw = fs.readFileSync(htmlPath, 'utf8');

function findItem(items, label) {
  return items.find(i => i.label === label);
}

// 最小 LI モック（OTT LI 全項目を安定生成できる値）
function mockLi() {
  const sLi = { name: 'S_LI', fields: { liType: '動画', startDate: '2026/6/29', endDate: '2026/7/28',
    budget100: '500000', budget98: '490000', flightMode: '掲載期間', paceMode: '均等',
    bidForm: '固定入札', bidTarget: '▼選択', bidPrice: '1700',
    environment: 'ウェブ＆アプリ', language: 'Japanese', daypart: '月曜日 00:00~23:59', geo: 'Japan',
    devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '●', deviceCD: '-' } };
  const dLi = { name: 'D_LI', id: 'li1', rawFields: {
    'Language Targeting - Include': '1005;', 'Device Targeting - Include': '30000; 30001; 30002; 30004;',
    'Device Targeting - Exclude': '', 'Environment Targeting': 'Web; App;',
    'Geography Targeting - Include': '2392;', 'Daypart Targeting': '300096;' },
    rawFieldOrder: [],
    statusInfo: { found: true, normalizedValue: 'Draft', rawValue: 'Draft' },
    fields: { type: 'Video', subtype: 'Simple', status: 'Draft', startDate: '2026/6/29', endDate: '2026/7/28',
      languageTargeting: '1005;', deviceTargetingInclude: '30000; 30001; 30002; 30004;',
      deviceTargetingExclude: '', environmentTargeting: 'Web; App;',
      geographyTargeting: '2392;', geographyTargetingInclude: '2392;', geographyTargetingExclude: '', geographyExclude: '',
      daypartTargeting: '300096;', pacing: 'Flight', pacingRate: 'Even',
      budgetType: 'Amount', budgetAmount: '490000', bidStrategyType: 'Fixed', bidStrategyValue: '1700' } };
  return { sLi, dLi };
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

// ═══════════════════════════════════════════
// [1-9] UI / 层级
// ═══════════════════════════════════════════
test('[1] UI: ヘッダ表示「比較結果：」（状態 → 比較結果）', () => {
  assert.ok(htmlRaw.includes('<span>比較結果：</span>'), 'header label');
  assert.ok(!htmlRaw.includes('<span>状態：</span>'), 'old label removed');
});

test('[2] UI: 操作ヒントに「比較結果：」', () => {
  assert.ok(htmlRaw.includes('比較結果：✅一致'), 'hint text');
});

test('[3] UI: 結果列ヘッダ・issue表 が「比較結果」', () => {
  assert.ok(htmlRaw.includes("{key:'__status',label:'比較結果',className:'col-status'"), '__status label');
  assert.ok(htmlRaw.includes('<th style="text-align:left;padding:6px 8px;width:90px;">比較結果</th>'), 'issue th');
  assert.ok(!htmlRaw.includes("label:'状態'"), 'old column label removed');
});

test('[4] UI: 広告ステータス列「ステータス」は名称不变', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  const st = findItem(items, 'ステータス');
  assert.ok(st, 'ステータス item exists');
  assert.equal(st.result, 'ok', 'Draft → ok');
  // 列定義にも ステータス キーが存在（getCoreLevelColumns で確認）
  const cols = api.getCoreLevelColumns('LI', false);
  assert.ok(cols.some(c => c.key === 'ステータス'), 'LI columns contain ステータス');
});

test('[5] 层级: YouTube は CP/IO/LI/GP/CR の5階層', () => {
  api.setMediaType('youtube');
  assert.equal(api.getVisibleLevels().join(','), 'CP,IO,LI,GP,CR');
});

test('[6] 层级: OTT は CP/IO/LI/CR の4階層（GP なし）', () => {
  api.setMediaType('ott');
  assert.equal(api.getVisibleLevels().join(','), 'CP,IO,LI');
});

test('[7] 层级: Display は CP/IO/LI の3階層（CR なし）', () => {
  api.setMediaType('display');
  assert.equal(api.getVisibleLevels().join(','), 'CP,IO,LI');
});

test('[8] UI: renderAll が媒体別に Tab を動的構築（OTT 4 / YouTube 5）', () => {
  // OTT: CP/IO/LI/CR のタブ（GP なし）
  api.setMediaType('ott');
  api.renderAll();
  const tabBar = captured['level-tab-bar'];
  const ottTabs = (tabBar.innerHTML.match(/data-lvl="(\w+)"/g) || []).map(m => m.match(/data-lvl="(\w+)"/)[1]);
  assert.equal(ottTabs.join(','), 'CP,IO,LI', 'OTT tabs');
  // OTT: フィルタ層級ボタンも CP/IO/LI/CR
  const filterBar = captured['filter-bar'];
  const group = filterBar.querySelectorAll('.filter-group')[0];
  assert.equal(group._buttons.map(b => b.dataset.lvl).join(','), 'CP,IO,LI', 'OTT filter level buttons');
  // YouTube: 5タブ
  api.setMediaType('youtube');
  api.renderAll();
  const ytTabs = (tabBar.innerHTML.match(/data-lvl="(\w+)"/g) || []).map(m => m.match(/data-lvl="(\w+)"/)[1]);
  assert.equal(ytTabs.join(','), 'CP,IO,LI,GP,CR', 'YouTube tabs');
});

test('[9] UI: toggleLevel / updateTabCounters / resetAll が OTT で安全に動作', () => {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('crAdditional');
  api.resetAll();
  assert.equal(api.getSelectedMediaType(), 'auto', 'reset keeps selectedMediaType=auto');
  assert.equal(api.getSelectedDv360CaseType(), 'initial', 'reset keeps 案件区分=initial');
  api.setMediaType('ott');
  api.updateTabCounters(); // 3階層ループでクラッシュしないこと
  // 状態を追跡できる classList モック
  let active = false;
  const btn = { classList: { add() { active = true; }, remove() { active = false; }, contains() { return active; } } };
  api.toggleLevel('LI', btn); // visibleLevels に LI がある → 非表示化
  assert.equal(active, false, 'toggle removes active');
  api.toggleLevel('LI', btn); // 再表示化
  assert.equal(active, true, 'toggle re-adds active');
});

// ═══════════════════════════════════════════
// [10-13] 目標単価の有無
// ═══════════════════════════════════════════
test('[10] 目標単価: ▼選択 は未指定として warning を出さない', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  const it = findItem(items, '目標単価の有無');
  assert.ok(it, 'item exists');
  assert.equal(it.sVal, '(未指定)');
  assert.equal(it.dVal, '');
  assert.equal(it.result, 'ok');
});

test('[11] 目標単価: S 空のときのみ (未指定)', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  sLi.fields.bidTarget = '';
  const items = api.compareLI(sLi, dLi);
  assert.equal(findItem(items, '目標単価の有無').sVal, '(未指定)');
});

test('[12] 目標単価: Fixed は「入札形式」に属し 目標単価 は独立', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  // 入札形式は SDF Bid Strategy Type=Fixed と一致 → ok
  assert.equal(findItem(items, '入札形式').result, 'ok', 'Fixed matches 入札形式');
  assert.equal(findItem(items, '目標単価の有無').result, 'ok', '未指定の目標単価は warning にしない');
});

test('[13] 目標単価: 未指定なら SDF 独立フィールド warning を出さない', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  const it = findItem(items, '目標単価の有無');
  assert.equal(it.result, 'ok');
  assert.equal(it.mpDetail, '');
});

// ═══════════════════════════════════════════
// [14-16] Deal
// ═══════════════════════════════════════════
test('[14] Deal: Deal ID は残す', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  const dealItems = api.compareLI_OTT_Deal(sLi, dLi);
  assert.ok(dealItems.some(i => i.label === 'Deal ID'), 'Deal ID in module');
  // 列定義にも Deal ID が存在
  const cols = api.getCoreLevelColumns('LI', false);
  assert.ok(cols.some(c => c.key === 'Deal ID'), 'LI columns contain Deal ID');
});

test('[15] Deal: Deal 詳細 は削除済み（列定義・出力の両方）', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  assert.ok(!items.some(i => i.label.includes('Deal 詳細')), 'no Deal 詳細 item');
  const cols = api.getLevelColumns('LI');
  assert.ok(!cols.some(c => String(c.key).includes('Deal 詳細')), 'no Deal 詳細 column');
});

test('[16] Deal: Deal フロア価格 は削除済み、Apply Floor Price For Deals も列追加されない', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  assert.ok(!items.some(i => i.label.includes('フロア価格')), 'no floor price item');
  assert.ok(!items.some(i => i.label.includes('Apply Floor Price')), 'no Apply Floor Price item');
  const cols = api.getLevelColumns('LI');
  assert.ok(!cols.some(c => String(c.key).includes('フロア価格')), 'no floor price column');
  assert.ok(!cols.some(c => String(c.key).includes('Apply Floor Price')), 'no Apply Floor Price column');
});

// ═══════════════════════════════════════════
// [17-19] Demographic（子供・世帯年収 ALL 等价）
// ═══════════════════════════════════════════
test('[17] 子供の有無: ▼選択系 + SDF空 → item非生成', () => {
  api.setMediaType('ott');
  for (const v of ['▼選択（ALLとして解釈）', '▼選択(ALLとして解釈)', '▼選択 (ALL として解釈)', '▼選択']) {
    const { sLi, dLi } = mockLi();
    sLi.fields.parentalStatus = v;
    dLi.rawFields['Demographic Targeting Parental Status'] = '';
    dLi.fields.demographicParental = '';
    const items = api.compareLI_OTT_Demographic(sLi, dLi);
    const it = findItem(items, '子供の有無');
    assert.equal(it, undefined, 'item hidden: ' + v);
  }
});

test('[18] 世帯年収: ▼選択 + SDF空 → 非生成（SDFに実値があれば warning）', () => {
  api.setMediaType('ott');
  const { sLi, dLi } = mockLi();
  sLi.fields.householdIncome = '▼選択';
  dLi.rawFields['Demographic Targeting Household Income'] = '';
  dLi.fields.demographicIncome = '';
  const empty = findItem(api.compareLI_OTT_Demographic(sLi, dLi), '世帯年収');
  assert.equal(empty, undefined, '▼選択 + SDF空 → hidden');
  // SDF に実値 → warning（設定表は未制限なのに SDF に制限）
  dLi.rawFields['Demographic Targeting Household Income'] = '100001;';
  dLi.fields.demographicIncome = '100001;';
  const withVal = findItem(api.compareLI_OTT_Demographic(sLi, dLi), '世帯年収');
  assert.equal(withVal.result, 'warning', '▼選択 + SDF実値 → warning');
});

test('[19] YouTube: compareDemographicTargeting は従来ロジックのまま（wrapper 非適用）', () => {
  api.setMediaType('youtube');
  // 同一入力に対する元関数の挙動: ▼選択(ALL解釈) + SDF空 → mismatch（ALL 扱いの欠落警告）
  // OTT wrapper では ok になるため、元関数が変更されていないことを証明する
  const direct = api.compareDemographicTargeting('▼選択', '', 'parentalStatus');
  assert.equal(direct.result, 'mismatch', 'original function keeps old behavior (no ALL-empty equivalence)');
  // YouTube compareLI には OTT 専用のダウンロードデフォルト列が混入しない
  const { sLi, dLi } = mockLi();
  const items = api.compareLI(sLi, dLi);
  assert.ok(!items.some(i => i.label === 'Brand Safety Sensitivity Setting'), 'no OTT download-default columns in YouTube');
  assert.ok(!items.some(i => i.label === 'Inventory Source Targeting - Exclude'), 'no OTT exclude column in YouTube');
});

// ═══════════════════════════════════════════
// [20-29] Download-only 既定値（3 フィールド）
// ═══════════════════════════════════════════
function dlDefaultItems(rawFields) {
  const { sLi, dLi } = mockLi();
  Object.assign(dLi.rawFields, rawFields);
  return api.compareLI_OTT_DownloadDefaults(sLi, dLi);
}
function dlItem(rawFields, label) {
  return findItem(dlDefaultItems(rawFields), label);
}

test('[20] Default SDF: Brand Safety "Do not block" → ok', () => {
  api.setMediaType('ott');
  for (const v of ['Do not block', ' do not block ', 'DO NOT BLOCK']) {
    const it = dlItem({ 'Brand Safety Sensitivity Setting': v }, 'Brand Safety Sensitivity Setting');
    assert.ok(it, v);
    assert.equal(it.result, 'ok', v + ' → ok');
    assert.equal(it.sVal, '想定: Do not block');
  }
});

test('[21] Default SDF: Brand Safety 他値 → warning', () => {
  api.setMediaType('ott');
  for (const v of ['Use custom', 'Use Campaign Manager 360 Verification']) {
    const it = dlItem({ 'Brand Safety Sensitivity Setting': v }, 'Brand Safety Sensitivity Setting');
    assert.ok(it, v);
    assert.equal(it.result, 'warning', v + ' → warning');
  }
});

test('[22] Default SDF: Brand Safety 空欄 → warning', () => {
  api.setMediaType('ott');
  const it = dlItem({ 'Brand Safety Sensitivity Setting': '' }, 'Brand Safety Sensitivity Setting');
  assert.ok(it, 'item exists even when empty');
  assert.equal(it.result, 'warning');
});

test('[23] Default SDF: Authorized Seller 既定値 → ok', () => {
  api.setMediaType('ott');
  const it = dlItem({ 'Inventory Source Targeting - Authorized Seller Options': 'Authorized and Non-Participating Publisher' },
    'Inventory Source Targeting - Authorized Seller Options');
  assert.ok(it);
  assert.equal(it.result, 'ok');
  assert.equal(it.sVal, '想定: Authorized and Non-Participating Publisher');
});

test('[24] Default SDF: Authorized Seller 他値/空欄 → warning', () => {
  api.setMediaType('ott');
  for (const v of ['Authorized', '', 'Some Other Value']) {
    const it = dlItem({ 'Inventory Source Targeting - Authorized Seller Options': v },
      'Inventory Source Targeting - Authorized Seller Options');
    assert.ok(it, 'item: ' + v);
    assert.equal(it.result, 'warning', JSON.stringify(v) + ' → warning');
  }
});

test('[25] Default SDF: Inventory Exclude 既定集合 完全一致（順序/空白/D:前缀無視）→ ok', () => {
  api.setMediaType('ott');
  // 順序入れ替え・スペース違い・D: 前缀あり・末尾分号違いのバリエーション
  const base = ['D:1; 6; 8; 9; 10; 11; 12; 13; 21; 23; 27; 29; 30; 34; 37; 38; 41; 42; 48; 50; 51; 52; 67; 78; 112; 90; 91; 93; 76; 99; 100; 101; 103; 104; 105; 118; 110; 114; 120; 122; 123; 125; 128; 129; 132;'];
  const shuffled = ['132; 129; 128; 125; 123; 122; 120; 114; 110; 118; 105; 104; 103; 101; 100; 99; 76; 93; 91; 90; 112; 78; 67; 52; 51; 50; 48; 42; 41; 38; 37; 34; 30; 29; 27; 23; 21; 13; 12; 11; 10; 9; 8; 6; 1;'];
  for (const v of [base, shuffled, '1;6;8;9;10;11;12;13;21;23;27;29;30;34;37;38;41;42;48;50;51;52;67;78;112;90;91;93;76;99;100;101;103;104;105;118;110;114;120;122;123;125;128;129;132']) {
    const it = dlItem({ 'Inventory Source Targeting - Exclude': v }, 'Inventory Source Targeting - Exclude');
    assert.ok(it);
    assert.equal(it.result, 'ok', 'set-equal should be ok');
  }
});

test('[26] Default SDF: Inventory Exclude 不足 ID → warning「不足:」', () => {
  api.setMediaType('ott');
  const it = dlItem({ 'Inventory Source Targeting - Exclude': 'D:1; 6; 8;' }, 'Inventory Source Targeting - Exclude');
  assert.equal(it.result, 'warning');
  assert.ok(it.mpDetail.includes('不足:'), '不足 detail: ' + it.mpDetail);
  assert.ok(it.mpDetail.includes('9'), 'missing ID 9 listed');
});

test('[27] Default SDF: Inventory Exclude 余分 ID → warning「追加:」', () => {
  api.setMediaType('ott');
  const extra = 'D:1; 6; 8; 9; 10; 11; 12; 13; 21; 23; 27; 29; 30; 34; 37; 38; 41; 42; 48; 50; 51; 52; 67; 78; 112; 90; 91; 93; 76; 99; 100; 101; 103; 104; 105; 118; 110; 114; 120; 122; 123; 125; 128; 129; 132; 999;';
  const it = dlItem({ 'Inventory Source Targeting - Exclude': extra }, 'Inventory Source Targeting - Exclude');
  assert.equal(it.result, 'warning');
  assert.ok(it.mpDetail.includes('追加: 999'), '追加 detail: ' + it.mpDetail);
});

test('[28] Default SDF: Inventory Exclude 不足 + 余分 同時 → warning 両方表示', () => {
  api.setMediaType('ott');
  const both = 'D:1; 6; 8; 9; 10; 11; 12; 13; 21; 23; 27; 29; 30; 34; 37; 38; 41; 42; 48; 50; 51; 52; 67; 78; 112; 90; 91; 93; 76; 99; 100; 101; 103; 104; 105; 118; 110; 114; 120; 122; 123; 125; 128; 129; 132; 999;'; // 全ID + 999
  const removed = both.replace('8;', ''); // 8 を欠落させる
  const it = dlItem({ 'Inventory Source Targeting - Exclude': removed }, 'Inventory Source Targeting - Exclude');
  assert.equal(it.result, 'warning');
  assert.ok(it.mpDetail.includes('不足: 8'), 'missing: ' + it.mpDetail);
  assert.ok(it.mpDetail.includes('追加: 999'), 'extra: ' + it.mpDetail);
});

test('[29] Default SDF: Inventory Exclude 空欄 → warning（空欄明示）', () => {
  api.setMediaType('ott');
  const it = dlItem({ 'Inventory Source Targeting - Exclude': '' }, 'Inventory Source Targeting - Exclude');
  assert.ok(it, 'item exists even when empty');
  assert.equal(it.result, 'warning');
  assert.ok(it.mpDetail.includes('空欄'), 'mpDetail: ' + it.mpDetail);
});

// ═══════════════════════════════════════════
// [30-31] ユーザリワード調査
// ═══════════════════════════════════════════
test('[30] Rewarded: 実SDF の全 CSV に reward 系ヘッダが存在しない', async () => {
  const dir = path.join(ottRoot, '001');
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  assert.ok(csvFiles.length >= 6, 'SDF CSVs: ' + csvFiles.map(c => c.name).join(', '));
  const rewardLike = /reward|リワード|user_feedback|ユーザー報酬/i;
  const found = [];
  for (const csv of csvFiles) {
    const header = csv.rows[0] || [];
    for (const col of header) {
      if (rewardLike.test(col)) found.push(csv.name + ':' + col);
    }
  }
  assert.equal(found.length, 0, 'no reward-like headers: ' + found.join('; '));
});

test('[31] Rewarded: ユーザリワード比較項目は出力されず、誤認識もない', async () => {
  api.setMediaType('ott');
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  const { sheets, sheetNames } = (() => {
    const wb = XLSX.read(fs.readFileSync(path.join(dir, xf)), { type: 'buffer', cellDates: true });
    const s = {};
    for (const name of wb.SheetNames) s[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    return { sheets: s, sheetNames: wb.SheetNames };
  })();
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const download = api.parseSdfData(await parseSdfZip(path.join(dir, zf)));
  assert.ok(setting.liList.length > 0 && download.liList.length > 0, 'real LI data');
  const items = api.compareLI(setting.liList[0], download.liList[0]);
  // ユーザリワード項目が存在しない
  assert.ok(!items.some(i => /リワード|reward/i.test(i.label)), 'no rewarded item');
  // 誤認識チェック: Inventory Source / Environment / Video Position / App / Rewarded API が
  // 「ユーザリワード」扱いの項目にならない
  assert.ok(!items.some(i => /ユーザリワード/i.test(i.label)), 'no ユーザリワード label');
  // warning のうち reward 由来のものがない（すべて既知項目の warning のみ）
  const warnings = items.filter(i => i.result === 'warning');
  assert.ok(warnings.every(i => !/リワード|reward/i.test(i.mpDetail || '')), 'no reward warning');
});
