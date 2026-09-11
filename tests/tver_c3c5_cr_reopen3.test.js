'use strict';

// C3-C5-CR-REOPEN-3 BOUNDED IMPLEMENTATION 专项回归测试（Red 先行）。
// 范围：TVer CR / Ad 层（tver_check.html）
//  - FIX A: 計測タグ block vendor metadata 行「100%地点」block 級傳播 → tracking_url_complete
//  - FIX B: Tracking Start/25/50/75 CSV 驱动显示 + comparison DEFER（状态中立）
//  - FIX C: Creative ID GUI 不显示 / 不比较 / 状态中立；内部 creative_id / ad_id 全链保留
//  - FIX D: Ad start_time/end_time 默认契约（00:00 / 23:59）canonical 比较
//  - FIX E: Ad 横版字段少时 sticky header 右侧深蓝 bleed 修复（Ad scoped）
// 数据全部为程序生成合成数据，不含真实案件信息。
// CP（Campaign）/ GP（Ad Group）为 SEALED：本文件不新增对其行为的断言，
// 其不变性由既有 611 项测试全量回归保障。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  EDIT_HEADERS,
  REGISTER_HEADERS,
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
    'validateField', 'buildTverHorizontalColumns', 'buildTverHorizontalViewModel',
    'buildTverHorizontalTableHtml', 'buildTverHorizontalDetailViewModel',
    'syncTverHorizontalScrollAccess', 'projectTverDisplayStatus', 'projectTverEntityDisplayStatus',
    'resolveTverHorizontalWidths', 'getTverColumnWidth', 'buildTverDisplayTree',
  ];
  const exportBlock = `\nwindow.__tverReopen3Api = {\n`
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
  return sandbox.__tverReopen3Api;
}

const api = loadTverApi();

// ---------------------------------------------------------------------------
// 合成 Setting workbook：主结构复用 makeStructuredSettingWorkbook（已验证可匹配），
// 仅把「計測タグ」block 替换为真实案件结构：vendor metadata 行 + 明细表头（無計測地点列）+ 明细。
// ---------------------------------------------------------------------------
const VENDOR_TAG_HEADER = ['タグ訴求', 'タグ', 'タグ', 'タグ', 'タグ', '新規/流用']; // C:F=merged タグ 分列形态

function makeVendorTagWorkbook({
  mainTags = ['SPPC'],
  vendorMetadataRows = [['タグベンダー', '楽天BLS', '100%地点']],
  tagRows = [{ 'タグ訴求': 'SPPC', 'タグ': 'https://tracker.invalid/sppc-complete', '新規/流用': '新規' }],
  targetingBatches,
} = {}) {
  const mainRows = mainTags.map(tag => ({
    '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    'ターゲティング番号': 'TG-01', 'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
    'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', '素材名': 'synthetic-creative.mp4',
    'LP名': 'Synthetic LP', 'タグ訴求': tag, '初期設定日予算': '30',
    'その他設定': '', '変更履歴': '',
  }));
  const workbook = makeStructuredSettingWorkbook({
    mainRows,
    targetingBatches: targetingBatches || [[{ number: 'TG-01', device: 'SP／PC／CTV', price: '11' }]],
  });
  const rows = workbook.Sheets[workbook.SheetNames[0]];
  const markerIndex = rows.findIndex(row => row[1] === '計測タグ');
  const endIndex = rows.findIndex(row => row[1] === '後続区块');
  assert.ok(markerIndex > 0 && endIndex > markerIndex, 'fixture 計測タグ block 定位失败');
  const replacement = [
    ['★', '計測タグ'],
    ['楽天BLSタグ変換ツール', '調査タグ変換マニュアル'],
    ...vendorMetadataRows,
    ['', '※選択肢にないタグは要検証'],
    VENDOR_TAG_HEADER,
    ...tagRows.map(tag => VENDOR_TAG_HEADER.map(header => tag[header] ?? '')),
  ];
  rows.splice(markerIndex, endIndex - markerIndex, ...replacement);
  return { workbook, metadataRowNumber: markerIndex + 3 }; // marker+1链接行, +2 metadata 行（1-based）
}

function buildAdRun(workbook, _unused, csvFieldOverrides, csvKind) {
  const settingModel = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-setting.xlsx' });
  const baseRow = {
    campaign_name: settingModel.campaigns[0].expectedName,
    adgroup_name: 'REOPEN3-GP',
    device: 'android ios pc',
    price: '11',
    creative_name: 'synthetic-creative.mp4',
    url: 'https://example.invalid/synthetic-lp',
    ...(csvFieldOverrides || {}),
  };
  const useEdit = csvKind === 'edit';
  if (useEdit) Object.assign(baseRow, { campaign_id: '101', adgroup_id: '201', ad_id: '7832' });
  const csvText = useEdit ? makeEditCsv([baseRow]) : makeRegisterCsv([baseRow]);
  const parsedCsv = api.parseCsvText(csvText, { fileName: useEdit ? 'reopen3-edit.csv' : 'reopen3-register.csv' });
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

const SPPC_URL = 'https://tracker.invalid/sppc-complete';
const CTV_URL = 'https://tracker.invalid/ctv-complete';

// ===========================================================================
// FIX A — block metadata 100%地点 propagation
// ===========================================================================

test('REOPEN3-A1 Red: vendor metadata行の「100%地点」はblock級計測地点として全appealへ伝播する', () => {
  const { workbook, metadataRowNumber } = makeVendorTagWorkbook({
    mainTags: ['SPPC', 'CTV'],
    tagRows: [
      { 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' },
      { 'タグ訴求': 'CTV', 'タグ': CTV_URL, '新規/流用': '新規' },
    ],
  });
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-a1.xlsx' });
  const index = model.sourceIndex.measurementTagByAppeal;
  assert.equal(index.SPPC.measurementPoint, '100%地点');
  assert.equal(index.CTV.measurementPoint, '100%地点');
  assert.ok(index.SPPC.sourceRefs.measurementPoint, 'SPPC measurementPoint sourceRef 必须存在');
  assert.equal(index.SPPC.sourceRefs.measurementPoint.rowNumber, metadataRowNumber);
  assert.equal(index.SPPC.sourceRefs.measurementPoint.rawValue, '100%地点');
  assert.equal(index.CTV.sourceRefs.measurementPoint.rowNumber, metadataRowNumber);
});

test('REOPEN3-A2 Red: 「100%地点」はComplete計測地点としてtracking_url_completeへ該当appealのtagUrlを反映する', () => {
  const { workbook } = makeVendorTagWorkbook({
    mainTags: ['SPPC'],
    tagRows: [{ 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' }],
  });
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-a2.xlsx' });
  const ad = model.ads[0];
  assert.equal(ad.fields.tagAppeal, 'SPPC');
  const resolved = api.resolveCreativeFields(ad, model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, SPPC_URL);
  assert.ok(resolved.tracking.tracking_url_complete.measurementPointSourceRef, 'measurementPointSourceRef 必须指向 metadata 行');
});

test('REOPEN3-A3 Red: SPPC/CTVはtagAppealで一対一joinしURLを混線しない', () => {
  const { workbook } = makeVendorTagWorkbook({
    mainTags: ['SPPC', 'CTV'],
    tagRows: [
      { 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' },
      { 'タグ訴求': 'CTV', 'タグ': CTV_URL, '新規/流用': '新規' },
    ],
  });
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-a3.xlsx' });
  const byAppeal = new Map(model.ads.map(ad => [ad.fields.tagAppeal, ad]));
  for (const [appeal, expectedUrl] of [['SPPC', SPPC_URL], ['CTV', CTV_URL]]) {
    const resolved = api.resolveCreativeFields(byAppeal.get(appeal), model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
    assert.equal(resolved.tracking.tracking_url_complete.value, expectedUrl, `${appeal} 必须命中自己的 URL`);
  }
});

test('REOPEN3-A4 Red: 端到端 Tracking Complete — Setting值命中CSV值で一致、不一致値で不一致', () => {
  const { workbook } = makeVendorTagWorkbook({
    mainTags: ['SPPC'],
    tagRows: [{ 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' }],
  });
  const matchedCase = buildAdRun(workbook, null, { tracking_url_complete: SPPC_URL });
  const matchedAd = matchedCase.matching.matches.find(match => match.level === 'Ad');
  assert.equal(matchedAd && matchedAd.status, 'matched', 'Ad 必须匹配成功（前置条件）');
  const completeMatched = adEntries(matchedCase.run).find(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeMatched, 'matched Ad 必须产生 tracking_url_complete entry');
  assert.equal(completeMatched.settingRawValue, SPPC_URL);
  assert.equal(completeMatched.comparisonStatus, '一致');

  const mismatchCase = buildAdRun(workbook, null, { tracking_url_complete: 'https://tracker.invalid/different' });
  const completeMismatch = adEntries(mismatchCase.run).find(entry => entry.field === 'tracking_url_complete');
  assert.equal(completeMismatch.comparisonStatus, '不一致');
});

test('REOPEN3-A5: 既存の計測地点列（per-row値）はblock伝播より優先され挙動不変（回帰）', () => {
  // makeStructuredSettingWorkbook 既定 block：表头含「計測地点」列、行値 '100%'（既有 611 基线行为）。
  const workbook = makeStructuredSettingWorkbook();
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-a5.xlsx' });
  const tag = model.sourceIndex.measurementTagByAppeal['Synthetic Tag'];
  assert.equal(tag.measurementPoint, '100%');
  assert.equal(tag.sourceRefs.measurementPoint.columnName, '計測地点');
});

test('REOPEN3-A6 Red: tagUrl空のappeal（タグセット未展開形態）はmissingを維持しfake判定しない', () => {
  const { workbook } = makeVendorTagWorkbook({
    mainTags: ['タグセット_SP'],
    tagRows: [
      { 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' },
      { 'タグ訴求': 'タグセット_SP', 'タグ': '', '新規/流用': '新規' },
    ],
  });
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-a6.xlsx' });
  const ad = model.ads[0];
  assert.equal(ad.fields.tagAppeal, 'タグセット_SP');
  const resolved = api.resolveCreativeFields(ad, model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
  assert.equal(resolved.tracking.tracking_url_complete.state, 'missing');
  assert.equal(resolved.tracking.tracking_url_complete.value, null);
});

test('REOPEN3-A7 Red: 「100%地点」値を含むmetadata行（設定用タグセット形態）はappeal明細として扱わない', () => {
  const { workbook } = makeVendorTagWorkbook({
    mainTags: ['SPPC'],
    vendorMetadataRows: [['タグベンダー', '楽天BLS', '100%地点']],
    tagRows: [
      { 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' },
      { 'タグ訴求': '設定用タグセット', 'タグ': '楽天BLS,マクロミル', '新規/流用': '' },
    ],
  });
  // 第二行模拟真实⑦结构：B=label C=vendor列表 D=100%地点（数据区内的 metadata 载体行）
  const rows = workbook.Sheets[workbook.SheetNames[0]];
  const detailIndex = rows.findIndex(row => row[0] === 'SPPC');
  rows[detailIndex + 1] = ['設定用タグセット', '楽天BLS,マクロミル', '100%地点', '', '', ''];
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'reopen3-a7.xlsx' });
  const index = model.sourceIndex.measurementTagByAppeal;
  assert.equal(index['設定用タグセット'], undefined, 'metadata 载体行不得进入 appeal index');
  assert.ok(index.SPPC, '正常 appeal 不受影响');
});

// ===========================================================================
// FIX B — Tracking Start / 25 / 50 / 75：CSV 駆動表示 + comparison DEFER（状態中立）
// ===========================================================================

function makeSppcWorkbook() {
  return makeVendorTagWorkbook({
    mainTags: ['SPPC'],
    tagRows: [{ 'タグ訴求': 'SPPC', 'タグ': SPPC_URL, '新規/流用': '新規' }],
  }).workbook;
}

test('REOPEN3-T1 Red: CSV値が空のdeferred tracking字段はentryを生成しない（非表示）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL });
  const fields = adEntries(caseResult.run).map(entry => entry.field);
  assert.equal(fields.includes('tracking_url_start'), false, 'CSV 空的 start 不得生成 entry');
  assert.equal(fields.includes('tracking_url_first_quartile'), false);
  assert.equal(fields.includes('tracking_url_midpoint'), false);
  assert.equal(fields.includes('tracking_url_third_quartile'), false);
  const columns = api.buildTverHorizontalColumns(caseResult.run, 'Ad').map(column => column.key);
  assert.equal(columns.includes('tracking_url_start'), false, 'CSV 空的 start 不得显示列');
});

test('REOPEN3-T2 Red: CSV値ありのdeferred trackingは表示し判定状態は中立（要確認を出さない）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL,
    tracking_url_start: 'https://tracker.invalid/start',
  });
  const start = adEntries(caseResult.run).find(entry => entry.field === 'tracking_url_start');
  assert.ok(start, 'CSV 有值时 start entry 必须存在（显示）');
  assert.equal(start.csvRawValue, 'https://tracker.invalid/start', 'CSV 原值必须保留');
  assert.equal(start.deferred, true, 'deferred tracking 不得参与 comparison');
  assert.equal(start.displayStatus, '', 'deferred tracking 不得产生判定状态');
  const rowStatus = adRowStatuses(caseResult.run);
  assert.equal(rowStatus.length, 1);
  assert.equal(rowStatus[0].status, '一致', '仅 deferred 字段非空不得使 Ad 行变为要確認');
});

test('REOPEN3-T3 Red: CSV値ありの25/50/75はそれぞれ表示し状態中立', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL,
    tracking_url_first_quartile: 'https://tracker.invalid/25',
    tracking_url_midpoint: 'https://tracker.invalid/50',
    tracking_url_third_quartile: 'https://tracker.invalid/75',
  });
  for (const field of ['tracking_url_first_quartile', 'tracking_url_midpoint', 'tracking_url_third_quartile']) {
    const entry = adEntries(caseResult.run).find(item => item.field === field);
    assert.ok(entry, `${field} CSV 有值时必须显示`);
    assert.equal(entry.deferred, true);
    assert.equal(entry.displayStatus, '');
  }
  assert.equal(adRowStatuses(caseResult.run)[0].status, '一致');
});

test('REOPEN3-T4 Red: deferred tracking字段のみ値があってもAd行は要確認とならない（creative_id有値含む）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL,
    tracking_url_start: 'https://tracker.invalid/start',
    tracking_url_first_quartile: 'https://tracker.invalid/25',
    tracking_url_midpoint: 'https://tracker.invalid/50',
    tracking_url_third_quartile: 'https://tracker.invalid/75',
  }, 'edit'); // edit CSV 携带 creative_id=7832
  assert.equal(adRowStatuses(caseResult.run)[0].status, '一致', 'deferred + creative_id 不得使行变为要確認');
  const entryFields = adEntries(caseResult.run).map(entry => entry.field);
  assert.equal(entryFields.includes('creative_id'), false);
});
test('REOPEN3-T5 Red: Tracking Complete真不一致はdeferに関係なくAd行を不一致にする', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: 'https://tracker.invalid/different',
    tracking_url_start: 'https://tracker.invalid/start',
  });
  assert.equal(adRowStatuses(caseResult.run)[0].status, '不一致');
});

test('REOPEN3-T6 Red: deferred tracking字段は確認詳細（detail）に現れない', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL,
    tracking_url_start: 'https://tracker.invalid/start',
  });
  const view = api.buildTverHorizontalViewModel(caseResult.run, 'Ad');
  const details = api.buildTverHorizontalDetailViewModel(view.rows[0]);
  assert.equal(details.some(detail => detail.field === 'tracking_url_start'), false, 'deferred 字段不得进入确认详情');
});

// ===========================================================================
// FIX C — Creative ID：GUI 不显示 / 不比较 / 状态中立；内部全链保留
// ===========================================================================

test('REOPEN3-C1 Red: creative_id有値でもGUI列・entryに出現しない', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL,
    creative_id: '7832',
  }, 'edit');
  const entryFields = adEntries(caseResult.run).map(entry => entry.field);
  assert.equal(entryFields.includes('creative_id'), false, 'creative_id 不得生成比较 entry');
  const columns = api.buildTverHorizontalColumns(caseResult.run, 'Ad').map(column => column.key);
  assert.equal(columns.includes('creative_id'), false, 'creative_id 不得显示 GUI 列');
});

test('REOPEN3-C2 Red: creative_id有値でもAd行状態に影響しない', () => {
  const withId = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL, creative_id: '7832' }, 'edit');
  assert.equal(adRowStatuses(withId.run)[0].status, '一致');
});

test('REOPEN3-C3 Red: 内部csv entity fields.creative_id/sourceRefs/rawRows証拠は保持される', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL, creative_id: '7832' }, 'edit');
  const ad = caseResult.csvTree.ads[0];
  assert.equal(ad.fields.creative_id, '7832', '内部 fields.creative_id 必须保留');
  assert.ok(ad.sourceRefs.creative_id, '内部 sourceRefs.creative_id 必须保留');
  assert.ok(ad.rawRows.length >= 1, 'rawRows 证据必须保留');
});

test('REOPEN3-C4 Red: ad_id identity全链保持（key/id/adById/parentKey/CSV schema識別）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL, creative_id: '7832' }, 'edit');
  assert.equal(caseResult.parsedCsv.schema.kind, 'edit-with-ids', 'CSV schema 必须仍识别 edit-with-ids');
  const ad = caseResult.csvTree.ads[0];
  assert.equal(ad.id, '7832');
  assert.equal(ad.key, 'ad:7832', 'Edit Ad entity key 必须保持 ad:${adId}');
  assert.ok(ad.parentKey && String(ad.parentKey).startsWith('adgroup:'), 'parentKey 层级链必须保留');
  assert.ok(ad.sourceRefs.ad_id, '内部 sourceRefs.ad_id 必须保留');
  const adGroup = caseResult.csvTree.adGroups[0];
  assert.equal(adGroup.id, '201');
  assert.equal(caseResult.csvTree.campaigns[0].id, '101');
});

test('REOPEN3-C5 Red: Edit matching回归 — Ad層matched保持', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL }, 'edit');
  const adMatch = caseResult.matching.matches.find(match => match.level === 'Ad');
  assert.equal(adMatch && adMatch.status, 'matched');
  assert.ok(adMatch.csvKey === 'ad:7832', 'Edit matching 的 csvKey 必须仍基于 ad_id 实体');
});

// ===========================================================================
// FIX D — Ad Time：start_time 00:00 / end_time 23:59 默认契约 canonical 比较
// ===========================================================================

test('REOPEN3-D1 Red: start_time 00:00 / 00:00:00 / 0:00 はいずれも一致', () => {
  for (const value of ['00:00', '00:00:00', '0:00']) {
    const caseResult = buildAdRun(makeSppcWorkbook(), null, {
      tracking_url_complete: SPPC_URL, start_time: value,
    });
    const entry = adEntries(caseResult.run).find(item => item.field === 'start_time');
    assert.ok(entry, `start_time=${value} 时 entry 必须存在`);
    assert.equal(api.projectTverDisplayStatus(entry.displayStatus || entry.comparisonStatus), '一致', `start_time=${value} 必须一致`);
    assert.equal(entry.settingRawValue, '00:00', 'Setting 侧必须显示默认契约值 00:00');
  }
});

test('REOPEN3-D2 Red: start_time 00:01 は不一致', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL, start_time: '00:01',
  });
  const entry = adEntries(caseResult.run).find(item => item.field === 'start_time');
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus || entry.comparisonStatus), '不一致');
});

test('REOPEN3-D3 Red: end_time 23:59 / 23:59:00 は一致', () => {
  for (const value of ['23:59', '23:59:00']) {
    const caseResult = buildAdRun(makeSppcWorkbook(), null, {
      tracking_url_complete: SPPC_URL, end_time: value,
    });
    const entry = adEntries(caseResult.run).find(item => item.field === 'end_time');
    assert.ok(entry, `end_time=${value} 时 entry 必须存在`);
    assert.equal(api.projectTverDisplayStatus(entry.displayStatus || entry.comparisonStatus), '一致', `end_time=${value} 必须一致`);
    assert.equal(entry.settingRawValue, '23:59', 'Setting 侧必须显示默认契约值 23:59');
  }
});

test('REOPEN3-D4 Red: end_time 23:58 は不一致', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL, end_time: '23:58',
  });
  const entry = adEntries(caseResult.run).find(item => item.field === 'end_time');
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus || entry.comparisonStatus), '不一致');
});

test('REOPEN3-D5 Red: CSV time空はentryを生成しない（既存missing/defer語義）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL });
  const fields = adEntries(caseResult.run).map(entry => entry.field);
  assert.equal(fields.includes('start_time'), false);
  assert.equal(fields.includes('end_time'), false);
});

test('REOPEN3-D6 Red: Ad time既定値のvalidation互換 — 0:00/00:00/23:59 不产生格式issue', () => {
  for (const [field, value] of [['start_time', '0:00'], ['start_time', '00:00'], ['end_time', '23:59'], ['end_time', '23:59:00'], ['start_time', '00:00:00']]) {
    const issues = api.validateField({ field, value, source: null });
    assert.equal(issues.length, 0, `${field}=${value} 不得产生 validation issue（got ${JSON.stringify(issues)}）`);
  }
});

test('REOPEN3-D7: CP/GP datetime canonical 挙動不変（回帰・封板）', () => {
  // A7：CP/GP datetime 逻辑不得受 Ad time 影响（既有 611 项全量回归同时保障）。
  const datetime = api.compareField({ field: 'adgroup_start_datetime', settingValue: '2026/02/01 00:00', csvValue: '2026-02-01 00:00', ruleBasis: 'strict' });
  assert.equal(datetime.comparisonStatus, '表記ゆれ一致');
  const invalid = api.compareField({ field: 'adgroup_start_datetime', settingValue: '2026/02/01 00:00', csvValue: '2026/02/01 00:01', ruleBasis: 'strict' });
  assert.equal(invalid.comparisonStatus, '不一致');
});

test('REOPEN3-D8 Red: Ad time列ラベル表示（GUI投影）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, {
    tracking_url_complete: SPPC_URL, start_time: '00:00', end_time: '23:59',
  });
  const columns = api.buildTverHorizontalColumns(caseResult.run, 'Ad');
  const keys = columns.map(column => column.key);
  assert.equal(keys.includes('start_time'), true, 'start_time 列必须显示');
  assert.equal(keys.includes('end_time'), true, 'end_time 列必须显示');
  const startColumn = columns.find(column => column.key === 'start_time');
  assert.ok(startColumn.label && startColumn.label !== 'start_time', 'start_time 必须有显示名 label');
});

// ===========================================================================
// FIX E — Ad 横版 sticky header 右侧深蓝 bleed（Ad scoped）
// ===========================================================================

function makeScrollPanelMock({ level, scrollWidth, clientWidth }) {
  const state = { toggles: [] };
  const stickyHeader = {
    classList: {
      toggle(name, force) { state.toggles.push({ name, force }); },
      contains() { return false; },
    },
  };
  const source = { scrollWidth, clientWidth, scrollLeft: 0, style: {} };
  const access = { hidden: false, style: {}, setAttribute() {}, scrollLeft: 0 };
  const track = { style: { width: '' } };
  const levelTable = { getAttribute(name) { return name === 'data-level' ? level : null; } };
  const heightStub = { style: {}, getBoundingClientRect: undefined, offsetHeight: undefined };
  const panel = {
    querySelector(selector) {
      if (selector === '.tver-horizontal-scroll') return source;
      if (selector === '.tver-horizontal-scroll-access') return access;
      if (selector === '.tver-horizontal-scroll-access-track') return track;
      if (selector === '.tver-horizontal-sticky-header') return stickyHeader;
      if (selector === '.tver-horizontal-table[data-level]') return levelTable;
      if (selector === '.tver-horizontal-sticky-header-row') return heightStub;
      if (selector === '.tver-horizontal-sticky-header-fixed') return heightStub;
      if (selector === '.tver-horizontal-sticky-header-dynamic') return heightStub;
      if (selector === '.tver-horizontal-sticky-header-fixed-table') return heightStub;
      if (selector === '.tver-horizontal-sticky-header-dynamic-table') return heightStub;
      return null;
    },
    querySelectorAll() { return []; },
  };
  return { panel, state, access, track };
}

test('REOPEN3-G1 Red: Ad層で横溢出なしの時sticky headerにfit classを付与（深蓝bleed解消）', () => {
  const { panel, state } = makeScrollPanelMock({ level: 'Ad', scrollWidth: 900, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(panel);
  const fitToggle = state.toggles.find(toggle => toggle.name === 'tver-horizontal-sticky-header-fit');
  assert.ok(fitToggle, 'Ad 无溢出时必须切换 fit class');
  assert.equal(fitToggle.force, true, '无溢出时 fit class 必须为 on');
});

test('REOPEN3-G2 Red: Ad層で横溢出ありの時fit classは無効', () => {
  const { panel, state } = makeScrollPanelMock({ level: 'Ad', scrollWidth: 2400, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(panel);
  const fitToggle = state.toggles.find(toggle => toggle.name === 'tver-horizontal-sticky-header-fit');
  assert.ok(fitToggle, 'Ad 层必须执行 fit 切换逻辑');
  assert.equal(fitToggle.force, false, '溢出时 fit class 必须为 off');
});

test('REOPEN3-G3 Red: sticky header構造は保持される', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL });
  const view = api.buildTverHorizontalViewModel(caseResult.run, 'Ad');
  const html = api.buildTverHorizontalTableHtml(view);
  assert.match(html, /tver-horizontal-sticky-header"/, 'sticky header 容器必须保留');
  assert.match(html, /data-tver-sticky-header/, 'sticky header 标记必须保留');
  assert.match(html, /tver-horizontal-sticky-header-dynamic/, 'dynamic 区域必须保留');
  const htmlSource = fs.readFileSync(htmlPath, 'utf8');
  assert.match(htmlSource, /\.tver-horizontal-sticky-header\{position:sticky/, 'position:sticky CSS 必须保留');
});

test('REOPEN3-G4 Red: access scrollbar挙動は保持される', () => {
  const overflow = makeScrollPanelMock({ level: 'Ad', scrollWidth: 2400, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(overflow.panel);
  assert.equal(overflow.access.hidden, false, '溢出时 access scrollbar 必须显示');
  assert.ok(String(overflow.track.style.width).length > 0, 'track 宽度必须被设置');

  const noOverflow = makeScrollPanelMock({ level: 'Ad', scrollWidth: 900, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(noOverflow.panel);
  assert.equal(noOverflow.access.hidden, true, '无溢出时 access scrollbar 必须隐藏');
});

test('REOPEN3-G5 Red: 手動列幅機能は保持される', () => {
  const htmlSource = fs.readFileSync(htmlPath, 'utf8');
  assert.match(htmlSource, /data-action="resize-column"/, '列宽拖拽手柄必须保留');
  assert.equal(typeof api.resolveTverHorizontalWidths, 'function');
  const widths = api.resolveTverHorizontalWidths('Ad', [{ key: 'creative_name' }, { key: 'url' }], null);
  assert.ok(widths.fields.creative_name > 0, '列宽解析必须保持');
  const overflow = makeScrollPanelMock({ level: 'Ad', scrollWidth: 2400, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(overflow.panel);
  assert.ok(String(overflow.track.style.width).length > 0, 'fit 逻辑不得破坏 track 宽度设置');
});

test('REOPEN3-G6 Red: Campaign層はfit class切替を行わない（CP不変）', () => {
  const { panel, state } = makeScrollPanelMock({ level: 'Campaign', scrollWidth: 900, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(panel);
  assert.equal(state.toggles.length, 0, 'Campaign 不得触发 fit class 切换');
  const htmlSource = fs.readFileSync(htmlPath, 'utf8');
  // fit CSS 规则必须以 .tver-horizontal-sticky-header-fit 为前缀（scoped），不得改写 Campaign/GP 共用底色规则
  assert.match(htmlSource, /\.tver-horizontal-sticky-header\.tver-horizontal-sticky-header-fit\{background:transparent\}/, 'fit scoped CSS 规则必须存在');
  assert.match(htmlSource, /\.tver-horizontal-sticky-header-fit \.tver-horizontal-sticky-header-dynamic\{background:transparent\}/, 'dynamic 透明规则必须存在');
});

test('REOPEN3-G7 Red: Ad Group層はfit class切替を行わない（GP不変）', () => {
  const { panel, state } = makeScrollPanelMock({ level: 'Ad Group', scrollWidth: 900, clientWidth: 1200 });
  api.syncTverHorizontalScrollAccess(panel);
  assert.equal(state.toggles.length, 0, 'Ad Group 不得触发 fit class 切换');
});

test('REOPEN3-G8 Red: 横版HTML静的出力にfit classは含まれない（runtime classのみ）', () => {
  const caseResult = buildAdRun(makeSppcWorkbook(), null, { tracking_url_complete: SPPC_URL });
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const view = api.buildTverHorizontalViewModel(caseResult.run, level);
    const html = api.buildTverHorizontalTableHtml(view);
    assert.doesNotMatch(html, /tver-horizontal-sticky-header-fit/, `${level} 静态 HTML 不得包含 fit class`);
  }
});
