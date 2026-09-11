'use strict';

// C3-C5-CR-REOPEN-5 BOUNDED IMPLEMENTATION 专项回归测试（Red 先行）。
// 范围：TVer CR / Ad 层（tver_check.html）
//  - FIX A: Ad start_time/end_time canonical 分钟 1~2 位（H:M "0:0" 形态）
//  - FIX B: タグセット展開（⑧ `*_set` 接尾辞 + ⑦ `タグセット_SP/_CTV` 形態）
//  - FIX C: Tracking Complete 多URL比較 = ORDER_INSENSITIVE_MULTISET
//  - 保護: ⑤ 両側空 tracking（無源）は fake 判定しない（現行 需确认 維持）
// 数据全部为程序生成合成数据，不含真实案件信息。
// CP（Campaign）/ GP（Ad Group）为 SEALED：本文件不新增对其行为的断言，
// 其不变性由既有 611 项测试全量回归保障。
//
// Red 核心：T1/T2/T3(H:M canonical)/S1-S11（タグセット展開）
// 保护断言（修复前后均应通过）：T4（非法值拒绝）/T5（既有形态）/S12（unresolved 不 fake）/V1（⑤ 空值）

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  makeEditCsv,
  makeRegisterCsv,
  makeStructuredSettingWorkbook,
} = require('./fixtures/tver-fixtures.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'tver_check.html');

function createElement() {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} },
    dataset: {}, files: [], innerHTML: '', style: {}, textContent: '', value: '',
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

function loadTverApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('TVER_APP_MARKER'));
  if (!source) throw new Error('TVer inline app (TVER_APP_MARKER) not found');

  const exportNames = [
    'parseCsvText', 'detectTverCsvSchema', 'parseTverSettingWorkbook',
    'buildEditTree', 'buildRegisterTree', 'matchTverEntities', 'buildRunFromModels',
    'createTverConversionContext', 'resolveCreativeFields', 'compareField', 'buildComparisonRun',
    'validateField', 'validateAdTime', 'normalizeTverAdTimeForComparison',
    'buildTverHorizontalColumns', 'buildTverHorizontalViewModel',
    'buildTverHorizontalTableHtml', 'buildTverHorizontalDetailViewModel',
    'syncTverHorizontalScrollAccess', 'projectTverDisplayStatus', 'projectTverEntityDisplayStatus',
    'resolveTverHorizontalWidths', 'getTverColumnWidth', 'buildTverDisplayTree',
  ];
  const exportBlock = `\nwindow.__tverReopen5Api = {\n`
    + exportNames.map(name => `  ${name}: typeof ${name} === 'function' ? ${name} : undefined,\n`).join('')
    + `};\n`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);

  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById() { return createElement(); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return createElement(); },
  };
  const sandbox = { Blob, Map, Set, TextDecoder, Uint8Array, URL, console, document, window: null };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__tverReopen5Api;
}

const api = loadTverApi();

// ---------------------------------------------------------------------------
// 合成 workbook helpers
// ---------------------------------------------------------------------------

const TAG_HEADER = ['タグ訴求', 'タグ', 'タグ', 'タグ', 'タグ', '新規/流用']; // C:F=merged タグ 分列形态

function makeMainRows(mainTags) {
  return mainTags.map(tag => ({
    '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    'ターゲティング番号': 'TG-01', 'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
    'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', '素材名': 'synthetic-creative.mp4',
    'LP名': 'Synthetic LP', 'タグ訴求': tag, '初期設定日予算': '30',
    'その他設定': '', '変更履歴': '',
  }));
}

// 多 block 計測タグ section（⑦/⑧ 真实结构形态的合成复刻）。
// blocks: [{ labelRow?: [..], metadataRow: [..], tags: [{appeal, url, newOrReuse}] }]
//   ⑧ 形态：labelRow=['タグセットを使用'], metadataRow=['タグベンダー','VendorA,VendorB','100%地点']
//   ⑦ 形态：metadataRow=['設定用タグセット','VendorA,VendorB','100%地点']
function makeTagSetWorkbook({ mainTags, blocks }) {
  const workbook = makeStructuredSettingWorkbook({
    mainRows: makeMainRows(mainTags),
    targetingBatches: [[{ number: 'TG-01', device: 'SP／PC／CTV', price: '11' }]],
  });
  const rows = workbook.Sheets[workbook.SheetNames[0]];
  const markerIndex = rows.findIndex(row => row[1] === '計測タグ');
  const endIndex = rows.findIndex(row => row[1] === '後続区块');
  assert.ok(markerIndex > 0 && endIndex > markerIndex, 'fixture 計測タグ block 定位失败');
  const replacement = [
    ['★', '計測タグ'],
    ['楽天BLSタグ変換ツール', '調査タグ変換マニュアル'],
  ];
  blocks.forEach(block => {
    if (block.labelRow) replacement.push([...block.labelRow]);
    replacement.push([...block.metadataRow]);
    replacement.push(['', '※選択肢にないタグは要検証']);
    replacement.push([...TAG_HEADER]);
    block.tags.forEach(tag => replacement.push([tag.appeal, tag.url ?? '', '', '', '', tag.newOrReuse ?? '新規']));
  });
  rows.splice(markerIndex, endIndex - markerIndex, ...replacement);
  return workbook;
}

function buildAdRun(workbook, csvFieldOverrides, csvKind) {
  const settingModel = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen5-setting.xlsx' });
  const baseRow = {
    campaign_name: settingModel.campaigns[0].expectedName,
    adgroup_name: 'REOPEN5-GP',
    device: 'android ios pc',
    price: '11',
    creative_name: 'synthetic-creative.mp4',
    url: 'https://example.invalid/synthetic-lp',
    ...(csvFieldOverrides || {}),
  };
  const useEdit = csvKind === 'edit';
  if (useEdit) Object.assign(baseRow, { campaign_id: '101', adgroup_id: '201', ad_id: '7833' });
  const csvText = useEdit ? makeEditCsv([baseRow]) : makeRegisterCsv([baseRow]);
  const parsedCsv = api.parseCsvText(csvText, { fileName: useEdit ? 'reopen5-edit.csv' : 'reopen5-register.csv' });
  assert.ok(parsedCsv.schema.kind, 'CSV schema 必须被识别');
  const csvTree = parsedCsv.schema.kind === 'edit-with-ids' ? api.buildEditTree(parsedCsv) : api.buildRegisterTree(parsedCsv);
  const matching = api.matchTverEntities(settingModel, csvTree, {
    schemaKind: parsedCsv.schema.kind,
    conversionContext: api.createTverConversionContext(parsedCsv.schema.kind, csvTree),
  });
  const run = api.buildRunFromModels(settingModel, csvTree, matching, parsedCsv);
  return { settingModel, parsedCsv, csvTree, matching, run };
}

function adEntries(run) {
  return run.entries.filter(entry => entry.level === 'Ad');
}

function adRowStatuses(run) {
  const view = api.buildTverHorizontalViewModel(run, 'Ad');
  return view.rows.map(row => ({ label: row.displayLabel, status: row.entityDisplayStatus }));
}

// ---------------------------------------------------------------------------
// ⑧ 形态合成 URL（fake domain，结构等价：Rakuten 型 / Macromill 型双 vendor）
// ---------------------------------------------------------------------------
const A_SPPC_URL = 'https://tracker-a.invalid/sppc-hanyo';      // 楽天 SPPC_汎用
const A_CTV_URL = 'https://tracker-a.invalid/ctv-hanyo';        // 楽天 CTV_汎用
const A_SPPC2_URL = 'https://tracker-a.invalid/sppc-sakuma';    // 楽天 SPPC_佐久間
const A_CTV2_URL = 'https://tracker-a.invalid/ctv-sakuma';      // 楽天 CTV_佐久間
const B_SPPC_URL = 'https://tracker-b.invalid/sppc';            // マクロミルSPPC
const B_CTV_URL = 'https://tracker-b.invalid/ctv';              // マクロミルCTV
const B_SOLO_URL = 'https://tracker-b.invalid/solo';            // ⑦ 単一appeal（無設備型接尾）

// ⑧ 形态：3 blocks（VendorA 単体 / VendorB 単体 / タグセット vendor list）
function makeCase8Workbook(mainTags) {
  return makeTagSetWorkbook({
    mainTags,
    blocks: [
      { metadataRow: ['タグベンダー', 'VendorA', '100%地点'], tags: [
        { appeal: 'SPPC_汎用', url: A_SPPC_URL },
        { appeal: 'CTV_汎用', url: A_CTV_URL },
        { appeal: 'SPPC_佐久間ファン', url: A_SPPC2_URL },
        { appeal: 'CTV_佐久間ファン', url: A_CTV2_URL },
      ] },
      { metadataRow: ['タグベンダー', 'VendorB', '100%地点'], tags: [
        { appeal: 'VendorBSPPC', url: B_SPPC_URL },
        { appeal: 'VendorBCTV', url: B_CTV_URL },
      ] },
      { labelRow: ['タグセットを使用'], metadataRow: ['タグベンダー', 'VendorA,VendorB', '100%地点'], tags: [
        { appeal: 'SPPC_汎用_set', url: '' },
        { appeal: 'CTV_汎用_set', url: '' },
        { appeal: 'SPPC_佐久間ファン_set', url: '' },
        { appeal: 'CTV_佐久間ファン_set', url: '' },
      ] },
    ],
  });
}

// ⑦ 形态：3 blocks（設定用タグセット label 行 = vendor metadata 载体）
function makeCase7Workbook(mainTags) {
  return makeTagSetWorkbook({
    mainTags,
    blocks: [
      { metadataRow: ['タグベンダー', 'VendorA', '100%地点'], tags: [
        { appeal: 'SPPC', url: A_SPPC_URL },
        { appeal: 'CTV', url: A_CTV_URL },
      ] },
      { metadataRow: ['タグベンダー', 'VendorB', '100%地点'], tags: [
        { appeal: 'VendorB', url: B_SOLO_URL },   // 単一appeal・無設備型接尾（⑦ マクロミル形態）
      ] },
      { metadataRow: ['設定用タグセット', 'VendorA,VendorB', '100%地点'], tags: [
        { appeal: 'タグセット_SP', url: '' },
        { appeal: 'タグセット_CTV', url: '' },
      ] },
    ],
  });
}

function resolveFirstAd(model, tagAppeal) {
  const ad = model.ads.find(candidate => candidate.fields.tagAppeal === tagAppeal)
    || model.ads[0];
  return api.resolveCreativeFields(ad, model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
}

// ===========================================================================
// FIX A — Ad Time H:M canonical（T1-T5）
// ===========================================================================

test('REOPEN5-T1 Red: H:M 形態（0:0 / 00:0）は canonical 00:00 に正規化される', () => {
  assert.equal(api.normalizeTverAdTimeForComparison('0:0'), '00:00', '"0:0" → 00:00');
  assert.equal(api.normalizeTverAdTimeForComparison('00:0'), '00:00', '"00:0" → 00:00');
  assert.equal(api.normalizeTverAdTimeForComparison('0:00'), '00:00', '"0:00" → 00:00（既有）');
  assert.equal(api.normalizeTverAdTimeForComparison('00:00:00'), '00:00', '"00:00:00" → 00:00（既有）');
  assert.equal(api.normalizeTverAdTimeForComparison('0:1'), '00:01', '"0:1" → 00:01（非默认值保留语义）');
  assert.equal(api.normalizeTverAdTimeForComparison('23:59'), '23:59');
});

test('REOPEN5-T2 Red: "0:0" は validation 上合法（INVALID_AD_TIME を出さない）', () => {
  // 注意：validateAdTime 返回 vm sandbox realm 的数组，与宿主 [] 的 prototype 不同，
  // deepEqual 会因跨 realm 失败——改用 length/内容断言（与 T4 同模式）。
  const issues = api.validateAdTime('start_time', '0:0');
  assert.equal(issues.length, 0, '"0:0" 不得产生 validation issue');
  const endIssues = api.validateAdTime('end_time', '23:59');
  assert.equal(endIssues.length, 0, '"23:59" 不得产生 validation issue');
});

test('REOPEN5-T3 Red: 端到端 "0:0" は默认契约 00:00 と一致（false mismatch 解消）', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const caseResult = buildAdRun(workbook, { start_time: '0:0', end_time: '23:59', tracking_url_complete: `${A_SPPC_URL},${B_SPPC_URL}` });
  const start = adEntries(caseResult.run).find(entry => entry.field === 'start_time');
  assert.ok(start, 'start_time entry 必须存在');
  assert.equal(start.csvRawValue, '0:0', 'CSV 原值必须保留显示');
  assert.equal(api.projectTverDisplayStatus(start.displayStatus || start.comparisonStatus), '一致', '"0:0" 必须判一致（canonical 00:00 == 默认契约）');
  assert.ok(!start.validationIssues.some(issue => issue.code === 'INVALID_AD_TIME'), '"0:0" 不得报 INVALID_AD_TIME');
  const end = adEntries(caseResult.run).find(entry => entry.field === 'end_time');
  assert.equal(api.projectTverDisplayStatus(end.displayStatus || end.comparisonStatus), '一致');
});

test('REOPEN5-T3b Red: "0:1" は canonical 00:01（非默认）→ 不一致（真の差異は検出維持）', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const caseResult = buildAdRun(workbook, { start_time: '0:1', tracking_url_complete: `${A_SPPC_URL},${B_SPPC_URL}` });
  const start = adEntries(caseResult.run).find(entry => entry.field === 'start_time');
  assert.ok(start);
  assert.equal(start.comparisonStatus, '不一致', '"0:1"（00:01）≠ 默认 00:00 必须判不一致');
  assert.equal(start.normalizedValues.csv, '00:01', 'canonical 必须是 00:01');
  assert.ok(!start.validationIssues.some(issue => issue.code === 'INVALID_AD_TIME'), '"0:1" 是合法时间格式（粒度 issue 允许，INVALID 不允许）');
});

test('REOPEN5-T4（保護）: 非法時間は拒否される（hour>23 / minute>59 / 3桁分）', () => {
  for (const invalid of ['24:00', '00:60', '0:99', '12:345']) {
    assert.equal(api.normalizeTverAdTimeForComparison(invalid), null, `${invalid} 不得 canonical 化`);
    const issues = api.validateAdTime('start_time', invalid);
    assert.ok(issues.length === 1 && issues[0].code === 'INVALID_AD_TIME', `${invalid} 必须报 INVALID_AD_TIME`);
  }
});

test('REOPEN5-T5（保護）: 既有形態（0:00 / 00:00 / 00:00:00 / 23:59）挙動不変', () => {
  for (const value of ['0:00', '00:00', '00:00:00']) {
    const workbook = makeCase8Workbook(['SPPC_汎用_set']);
    const caseResult = buildAdRun(workbook, { start_time: value, tracking_url_complete: `${A_SPPC_URL},${B_SPPC_URL}` });
    const start = adEntries(caseResult.run).find(entry => entry.field === 'start_time');
    assert.equal(api.projectTverDisplayStatus(start.displayStatus || start.comparisonStatus), '一致', `${value} 必须判一致`);
  }
});

// ===========================================================================
// FIX B — タグセット展開（⑧ `*_set` / ⑦ `タグセット_SP/_CTV`）（S1-S12）
// ===========================================================================

test('REOPEN5-S1 Red: ⑧ SPPC_汎用_set は [VendorA SPPC URL, VendorB SPPC URL] に展開される', () => {
  const model = api.parseTverSettingWorkbook(makeCase8Workbook(['SPPC_汎用_set']), { fileName: 'reopen5-s1.xlsx' });
  const resolved = resolveFirstAd(model, 'SPPC_汎用_set');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique', '展開成功必须 state=unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, `${A_SPPC_URL},${B_SPPC_URL}`);
  assert.equal(resolved.tracking.tracking_url_complete.ruleBasis, 'TVER_260605_TAG_SET_EXPANSION');
});

test('REOPEN5-S2 Red: ⑧ CTV_汎用_set は [VendorA CTV URL, VendorB CTV URL] に展開される', () => {
  const model = api.parseTverSettingWorkbook(makeCase8Workbook(['CTV_汎用_set']), { fileName: 'reopen5-s2.xlsx' });
  const resolved = resolveFirstAd(model, 'CTV_汎用_set');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, `${A_CTV_URL},${B_CTV_URL}`);
});

test('REOPEN5-S3 Red: ⑧ SPPC_佐久間ファン_set は [楽天 SPPC_佐久間 URL, VendorB SPPC URL] に展開される', () => {
  const model = api.parseTverSettingWorkbook(makeCase8Workbook(['SPPC_佐久間ファン_set']), { fileName: 'reopen5-s3.xlsx' });
  const resolved = resolveFirstAd(model, 'SPPC_佐久間ファン_set');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, `${A_SPPC2_URL},${B_SPPC_URL}`);
});

test('REOPEN5-S4 Red: ⑧ CTV_佐久間ファン_set は [楽天 CTV_佐久間 URL, VendorB CTV URL] に展開される', () => {
  const model = api.parseTverSettingWorkbook(makeCase8Workbook(['CTV_佐久間ファン_set']), { fileName: 'reopen5-s4.xlsx' });
  const resolved = resolveFirstAd(model, 'CTV_佐久間ファン_set');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, `${A_CTV2_URL},${B_CTV_URL}`);
});

test('REOPEN5-S5 Red: SPPC/CTV 厳格隔離（SPPC set は CTV URL を含まず、逆も同様）', () => {
  const model = api.parseTverSettingWorkbook(makeCase8Workbook(['SPPC_汎用_set', 'CTV_汎用_set', 'SPPC_佐久間ファン_set', 'CTV_佐久間ファン_set']), { fileName: 'reopen5-s5.xlsx' });
  const sppcHanyo = api.resolveCreativeFields(model.ads.find(ad => ad.fields.tagAppeal === 'SPPC_汎用_set'), model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
  const ctvHanyo = api.resolveCreativeFields(model.ads.find(ad => ad.fields.tagAppeal === 'CTV_汎用_set'), model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
  assert.equal(sppcHanyo.tracking.tracking_url_complete.state, 'unique', '前置条件：SPPC_汎用_set 必须展开成功');
  assert.equal(ctvHanyo.tracking.tracking_url_complete.state, 'unique', '前置条件：CTV_汎用_set 必须展开成功');
  const sppcValue = sppcHanyo.tracking.tracking_url_complete.value || '';
  const ctvValue = ctvHanyo.tracking.tracking_url_complete.value || '';
  assert.ok(!sppcValue.includes(A_CTV_URL) && !sppcValue.includes(A_CTV2_URL) && !sppcValue.includes(B_CTV_URL), `SPPC set 不得包含 CTV URL: ${sppcValue}`);
  assert.ok(!ctvValue.includes(A_SPPC_URL) && !ctvValue.includes(A_SPPC2_URL) && !ctvValue.includes(B_SPPC_URL), `CTV set 不得包含 SPPC URL: ${ctvValue}`);
  assert.notEqual(B_SPPC_URL, B_CTV_URL, '前置条件：VendorB 的 SPPC/CTV URL 必须不同');
});

test('REOPEN5-S6 Red: CSV URL 順序不同・空白差異は一致（ORDER_INSENSITIVE_MULTISET）', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const reversed = buildAdRun(workbook, { tracking_url_complete: `${B_SPPC_URL},${A_SPPC_URL}` });
  const reversedEntry = adEntries(reversed.run).find(entry => entry.field === 'tracking_url_complete');
  assert.ok(reversedEntry, 'tracking_url_complete entry 必须存在');
  assert.equal(reversedEntry.comparisonStatus, '表記ゆれ一致', '顺序不同 multiset 相等必须表記ゆれ一致');
  const spaced = buildAdRun(workbook, { tracking_url_complete: `${A_SPPC_URL}, ${B_SPPC_URL}` });
  const spacedEntry = adEntries(spaced.run).find(entry => entry.field === 'tracking_url_complete');
  assert.equal(spacedEntry.comparisonStatus, '表記ゆれ一致', '分隔符两侧空白差异必须一致');
});

test('REOPEN5-S6b Red: CSV URL 同順序は一致（raw 等価）', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const same = buildAdRun(workbook, { tracking_url_complete: `${A_SPPC_URL},${B_SPPC_URL}` });
  const entry = adEntries(same.run).find(item => item.field === 'tracking_url_complete');
  assert.equal(entry.settingRawValue, `${A_SPPC_URL},${B_SPPC_URL}`, 'Setting 侧必须显示展开后业务顺序的 URL collection');
  assert.equal(entry.comparisonStatus, '一致');
  assert.equal(adRowStatuses(same.run)[0].status, '一致', 'Ad 行整体必须一致');
});

test('REOPEN5-S7 Red: CSV 側 1 URL 欠落は不一致', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const missing = buildAdRun(workbook, { tracking_url_complete: A_SPPC_URL });
  const entry = adEntries(missing.run).find(item => item.field === 'tracking_url_complete');
  assert.equal(entry.comparisonStatus, '不一致', '缺一个 URL 必须不一致（不得因 subset 而 fake 一致）');
});

test('REOPEN5-S8 Red: CSV 側余分 URL は不一致', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const extra = buildAdRun(workbook, { tracking_url_complete: `${A_SPPC_URL},${B_SPPC_URL},${A_CTV_URL}` });
  const entry = adEntries(extra.run).find(item => item.field === 'tracking_url_complete');
  assert.equal(entry.comparisonStatus, '不一致', '多一个 URL 必须不一致');
});

test('REOPEN5-S9 Red: URL 重複回数の差異は不一致（multiset 計数语义）', () => {
  const workbook = makeCase8Workbook(['SPPC_汎用_set']);
  const duplicated = buildAdRun(workbook, { tracking_url_complete: `${A_SPPC_URL},${A_SPPC_URL},${B_SPPC_URL}` });
  const entry = adEntries(duplicated.run).find(item => item.field === 'tracking_url_complete');
  assert.equal(entry.comparisonStatus, '不一致', '[A,A,B] vs [A,B] 必须不一致（重复计数保留）');
});

test('REOPEN5-S10 Red: ⑦ タグセット_SP は [VendorA SPPC URL, VendorB 単一appeal URL] に展開される', () => {
  const model = api.parseTverSettingWorkbook(makeCase7Workbook(['タグセット_SP']), { fileName: 'reopen5-s10.xlsx' });
  const resolved = resolveFirstAd(model, 'タグセット_SP');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique', '⑦ 形态展開必须成功（不得继续 DEFER）');
  assert.equal(resolved.tracking.tracking_url_complete.value, `${A_SPPC_URL},${B_SOLO_URL}`);
});

test('REOPEN5-S11 Red: ⑦ タグセット_CTV は [VendorA CTV URL, VendorB 単一appeal URL] に展開される', () => {
  const model = api.parseTverSettingWorkbook(makeCase7Workbook(['タグセット_CTV']), { fileName: 'reopen5-s11.xlsx' });
  const resolved = resolveFirstAd(model, 'タグセット_CTV');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, `${A_CTV_URL},${B_SOLO_URL}`);
});

test('REOPEN5-S12（保護）: 解決不能なタグセット構造は展開せず missing 維持（fake 判定しない）', () => {
  // vendor list 引用不存在的 vendor → rest 无法解析 → 保守 missing
  const workbook = makeTagSetWorkbook({
    mainTags: ['SPPC_汎用_set'],
    blocks: [
      { metadataRow: ['タグベンダー', 'VendorA', '100%地点'], tags: [
        { appeal: 'SPPC_汎用', url: A_SPPC_URL },
      ] },
      { labelRow: ['タグセットを使用'], metadataRow: ['タグベンダー', 'VendorA,VendorMissing', '100%地点'], tags: [
        { appeal: 'SPPC_汎用_set', url: '' },
      ] },
    ],
  });
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen5-s12.xlsx' });
  const resolved = resolveFirstAd(model, 'SPPC_汎用_set');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'missing', 'unresolved 不得 fake 展開');
  assert.equal(resolved.tracking.tracking_url_complete.value, null);
});

// ===========================================================================
// 保護 — ⑤ 両側空 tracking（無源）は fake 判定しない（V1）
// ===========================================================================

test('REOPEN5-V1（保護）: 無tracking源かつCSV空の Ad は neutral defer（fake 判定しない）', () => {
  // 真实⑤等价形态：計測タグ block vendor=なし・無数据行 → measurementTagByAppeal 無条目
  // → Ad tagAppeal join 不命中（無源）。真实⑤ tagAppeal='' 与此处 'SPPC' 均 join undefined，语义等价。
  // Contract 演进：REOPEN-5 当轮「保持现状=需确认」；C3-C5-CR-REOPEN-5-FIX1 Contract CASE A
  // 正式定义为 neutral defer（entry 不生成・状態無効・行集計不参加・GUI 非表示）——
  // REOPEN-5 第6节「除非当前正式 Contract 已另有定义」条件自此成立。细节断言见
  // tests/tver_c3c5_cr_reopen5_fix1.test.js E1/E6；本条保留最小保护：不得 fake 一致/不一致。
  const workbook = makeTagSetWorkbook({
    mainTags: ['SPPC'],
    blocks: [
      { metadataRow: ['タグベンダー', 'なし', '100%地点'], tags: [] },
    ],
  });
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen5-v1.xlsx' });
  const tagIndex = model.sourceIndex.measurementTagByAppeal;
  assert.equal(Object.keys(tagIndex).length, 0, '前置条件：計測タグ block 無数据行 → index 为空');
  const resolved = resolveFirstAd(model, 'SPPC');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'missing', '前置条件：無源 → missing');
  const caseResult = buildAdRun(workbook, { tracking_url_complete: '' });
  const entry = adEntries(caseResult.run).find(item => item.field === 'tracking_url_complete');
  // CASE A（FIX1 Contract）：entry 不生成（neutral defer），不产生任何比较状态。
  assert.equal(entry, undefined, '無源+空CSV → neutral defer（entry 不生成）');
  const rowStatus = adRowStatuses(caseResult.run);
  assert.equal(rowStatus.length, 1);
  assert.equal(rowStatus[0].status, '一致', '無源+空CSV 不得使 Ad 行变为要確認（也不得 fake 不一致）');
});
