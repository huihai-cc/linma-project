'use strict';

// C3-C5-CR-REOPEN-5-FIX1 EMPTY TRACKING COMPLETE NEUTRAL 专项回归测试（Red 先行）。
// 范围：TVer CR / Ad 层 tracking_url_complete 的 empty/missing projection（tver_check.html）
//  - CASE A：Setting source missing + CSV 空 → neutral defer（不生成有效 comparison status、
//            displayStatus=''、STATUS_EFFECT=NONE、不参与 Ad overall、GUI 不显示空字段）
//  - CASE B：Setting URL + CSV 空 → 真 mismatch 保持（不得被隐藏）
//  - CASE C：Setting missing + CSV URL → 保守需确认保持
//  - CASE D：Setting URL + CSV URL → 正常一致/不一致
//  - 保护：Time canonical / Tag Set expansion / Multi URL / Creative ID / Start25/50/75 /
//          Ad Status / GUI layout / Campaign / Ad Group —— 本文件不触碰其行为断言。
// 数据全部为程序生成合成数据（E6-E8 使用真实案件只读文件，不写入）。
// CP（Campaign）/ GP（Ad Group）为 SEALED：其不变性由既有 611 项测试全量回归保障。
//
// Red 核心：E1（CASE A defer 中性）/E6（真实⑤不再要確認）
// 保护断言（修复前后均应通过）：E2/E3/E4/E5/E7/E8

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
    'parseCsvText', 'parseTverSettingWorkbook', 'buildEditTree', 'buildRegisterTree',
    'matchTverEntities', 'buildRunFromModels', 'createTverConversionContext',
    'resolveCreativeFields', 'buildTverHorizontalColumns', 'buildTverHorizontalViewModel',
    'projectTverDisplayStatus', 'settingParseBlockingIssue',
  ];
  const exportBlock = `\nwindow.__tverReopen5Fix1Api = {\n`
    + exportNames.map(name => `  ${name}: typeof ${name} === 'function' ? ${name} : undefined,\n`).join('')
    + `};\n`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);

  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById() { return createElement(); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return createElement(); },
  };
  const sandbox = { Blob, Map, Set, TextDecoder, Uint8Array, URL, console, document, window: null, XLSX: require(path.join(projectRoot, 'xlsx.full.min.js')) };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__tverReopen5Fix1Api;
}

const api = loadTverApi();

// ---------------------------------------------------------------------------
// 合成 workbook helpers（与 REOPEN-5 测试同构）
// ---------------------------------------------------------------------------

const TAG_HEADER = ['タグ訴求', 'タグ', 'タグ', 'タグ', 'タグ', '新規/流用'];

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
  const settingModel = api.parseTverSettingWorkbook(workbook, { fileName: 'fix1-setting.xlsx' });
  const baseRow = {
    campaign_name: settingModel.campaigns[0].expectedName,
    adgroup_name: 'FIX1-GP',
    device: 'android ios pc',
    price: '11',
    creative_name: 'synthetic-creative.mp4',
    url: 'https://example.invalid/synthetic-lp',
    ...(csvFieldOverrides || {}),
  };
  const useEdit = csvKind === 'edit';
  if (useEdit) Object.assign(baseRow, { campaign_id: '101', adgroup_id: '201', ad_id: '7834' });
  const csvText = useEdit ? makeEditCsv([baseRow]) : makeRegisterCsv([baseRow]);
  const parsedCsv = api.parseCsvText(csvText, { fileName: useEdit ? 'fix1-edit.csv' : 'fix1-register.csv' });
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

// CASE A 场景：vendor=なし block 無数据行 → measurementTagByAppeal 空 → resolve state='missing'
function makeNoSourceWorkbook() {
  return makeTagSetWorkbook({
    mainTags: ['SPPC'],
    blocks: [{ metadataRow: ['タグベンダー', 'なし', '100%地点'], tags: [] }],
  });
}

// CASE B/D 场景：SPPC 単体 block → resolve state='unique'
function makeSppcWorkbook() {
  return makeTagSetWorkbook({
    mainTags: ['SPPC'],
    blocks: [{
      metadataRow: ['タグベンダー', 'VendorA', '100%地点'],
      tags: [{ appeal: 'SPPC', url: SPPC_URL }],
    }],
  });
}

// ===========================================================================
// E1 — CASE A：Setting missing + CSV 空 → neutral defer
// ===========================================================================

test('REOPEN5-FIX1-E1 Red: setting missing + csv 空の tracking_url_complete は neutral defer（entry 不生成・状態無効・行集計不参加・列非表示）', () => {
  const workbook = makeNoSourceWorkbook();
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'fix1-e1.xlsx' });
  // 前置条件：Setting 側 source は missing
  const ad = model.ads[0];
  const resolved = api.resolveCreativeFields(ad, model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
  assert.equal(resolved.tracking.tracking_url_complete.state, 'missing', '前置条件：Setting source missing');

  const caseResult = buildAdRun(workbook, { tracking_url_complete: '' });
  const completeEntry = adEntries(caseResult.run).find(entry => entry.field === 'tracking_url_complete');
  assert.equal(completeEntry, undefined, 'CASE A 不得生成 tracking_url_complete entry（neutral defer・GUI 非表示）');
  // STATUS_EFFECT=NONE：Ad overall 不得因此变为要確認
  const rowStatus = adRowStatuses(caseResult.run);
  assert.equal(rowStatus.length, 1);
  assert.equal(rowStatus[0].status, '一致', 'CASE A 不得影响 Ad overall（无 review/mismatch 字段时行=一致）');
  // GUI 列非表示
  const columns = api.buildTverHorizontalColumns(caseResult.run, 'Ad').map(column => column.key);
  assert.equal(columns.includes('tracking_url_complete'), false, 'CASE A GUI 不得显示空 Tracking Complete 列');
});

// ===========================================================================
// E2 — CASE B：Setting URL + CSV 空 → 真 mismatch 保持
// ===========================================================================

test('REOPEN5-FIX1-E2（保護）: setting URL + csv 空は mismatch 保持（隐藏しない）', () => {
  const workbook = makeSppcWorkbook();
  const model = api.parseTverSettingWorkbook(workbook, { fileName: 'fix1-e2.xlsx' });
  const resolved = api.resolveCreativeFields(model.ads[0], model.sourceIndex.creativeByMaterial, model.sourceIndex.measurementTagByAppeal);
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique', '前置条件：Setting URL 存在');

  const caseResult = buildAdRun(workbook, { tracking_url_complete: '' });
  const completeEntry = adEntries(caseResult.run).find(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntry, 'CASE B entry 必须生成（Setting 有值时 CSV 空是真差异）');
  assert.equal(completeEntry.comparisonStatus, '不一致', 'Setting URL vs CSV 空必须保持不一致');
  assert.equal(completeEntry.displayStatus, '不一致', 'displayStatus 必须为不一致');
  assert.equal(api.projectTverDisplayStatus(completeEntry.displayStatus || completeEntry.comparisonStatus), '不一致', 'GUI 投影后仍为不一致');
});

// ===========================================================================
// E3 — CASE C：Setting missing + CSV URL → 保守需确认保持
// ===========================================================================

test('REOPEN5-FIX1-E3（保護）: setting missing + csv URL は保守「需确认」保持', () => {
  const workbook = makeNoSourceWorkbook();
  const caseResult = buildAdRun(workbook, { tracking_url_complete: 'https://tracker.invalid/csv-side' });
  const completeEntry = adEntries(caseResult.run).find(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntry, 'CASE C entry 必须生成（CSV 有数据）');
  assert.equal(completeEntry.comparisonStatus, '需确认', 'CSV 有值但 Setting source 无法确认 → 保守需确认');
  assert.equal(completeEntry.displayStatus, '需确认');
});

// ===========================================================================
// E4/E5 — CASE D：正常比较保持
// ===========================================================================

test('REOPEN5-FIX1-E4（保護）: setting URL + csv 同 URL は一致', () => {
  const workbook = makeSppcWorkbook();
  const caseResult = buildAdRun(workbook, { tracking_url_complete: SPPC_URL });
  const completeEntry = adEntries(caseResult.run).find(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntry);
  assert.equal(completeEntry.comparisonStatus, '一致');
});

test('REOPEN5-FIX1-E5（保護）: setting URL + csv 異 URL は不一致', () => {
  const workbook = makeSppcWorkbook();
  const caseResult = buildAdRun(workbook, { tracking_url_complete: 'https://tracker.invalid/different' });
  const completeEntry = adEntries(caseResult.run).find(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntry);
  assert.equal(completeEntry.comparisonStatus, '不一致');
});

// ===========================================================================
// E6-E8 — 真实案件（只读）
// ===========================================================================

const TVER_DIR = 'D:\\業務用\\開発用\\2課設定依頼\\Tver';
const REAL_CASES = { E6: '⑤', E7: '⑦', E8: '⑧' };

function runRealCase(caseName) {
  const dir = path.join(TVER_DIR, caseName);
  const files = fs.readdirSync(dir).filter(n => !n.startsWith('~$'));
  const xlsxName = files.find(n => /\.xlsx$/i.test(n));
  const csvName = files.find(n => /\.csv$/i.test(n));
  assert.ok(xlsxName && csvName, `${caseName}: 案件文件必须恰好一份 xlsx + 一份 csv`);
  const XLSX = require(path.join(projectRoot, 'xlsx.full.min.js'));
  const buffer = fs.readFileSync(path.join(dir, xlsxName));
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const settingModel = api.parseTverSettingWorkbook(workbook, { fileName: xlsxName });
  assert.ok(settingModel, `${caseName}: setting model null`);
  const blocking = api.settingParseBlockingIssue(settingModel);
  assert.ok(!blocking, `${caseName}: blocking ${blocking && blocking.code}`);
  const csvText = fs.readFileSync(path.join(dir, csvName), 'utf8');
  const parsedCsv = api.parseCsvText(csvText, { fileName: csvName });
  const csvTree = parsedCsv.schema.kind === 'edit-with-ids' ? api.buildEditTree(parsedCsv) : api.buildRegisterTree(parsedCsv);
  const matching = api.matchTverEntities(settingModel, csvTree, {
    schemaKind: parsedCsv.schema.kind,
    conversionContext: api.createTverConversionContext(parsedCsv.schema.kind, csvTree),
  });
  const run = api.buildRunFromModels(settingModel, csvTree, matching, parsedCsv);
  return { caseName, run, parsedCsv };
}

test('REOPEN5-FIX1-E6 Red: 真実⑤ tracking_url_complete は要確認原因とならない（CASE A defer）', () => {
  const { run } = runRealCase(REAL_CASES.E6);
  const completeEntries = adEntries(run).filter(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntries.length === 0, `真实⑤：全部 Ad 的 tracking_url_complete entry 必须不生成（当前 ${completeEntries.length} 条）`);
  // Ad overall：不再因空 tracking 显示要確認
  const view = api.buildTverHorizontalViewModel(run, 'Ad');
  assert.ok(view.rows.length > 0, '真实⑤ Ad 行必须存在');
  for (const row of view.rows) {
    assert.notEqual(row.entityDisplayStatus, '要確認', `真实⑤ Ad [${row.displayLabel}] 不得再因空 tracking 显示要確認`);
  }
  // overall 决定字段报告：剩余非 deferred 字段状态集合
  const remaining = {};
  adEntries(run).forEach(entry => {
    if (entry.deferred) return;
    const key = `${entry.field}:${entry.comparisonStatus}`;
    remaining[key] = (remaining[key] || 0) + 1;
  });
  // 期望：仅一致系（creative_name/url/start_time/end_time）——tracking 已 defer
  const nonMatch = Object.keys(remaining).filter(key => !['一致', '表記ゆれ一致'].includes(key.split(':').pop()));
  assert.equal(nonMatch.length, 0, `真实⑤剩余字段不得有非一致判定（实际：${JSON.stringify(remaining)}）`);
});

test('REOPEN5-FIX1-E7（保護）: 真実⑦ Tag Set Tracking Complete は一致を保持', () => {
  const { run } = runRealCase(REAL_CASES.E7);
  const completeEntries = adEntries(run).filter(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntries.length > 0, '真实⑦ tracking entry 必须存在');
  const statuses = [...new Set(completeEntries.map(entry => entry.comparisonStatus))];
  assert.deepEqual(statuses, ['一致'], `真实⑦ tracking 必须 一致（实际 ${statuses.join('/')}）`);
});

test('REOPEN5-FIX1-E8（保護）: 真実⑧ Tag Set Tracking Complete は一致を保持', () => {
  const { run } = runRealCase(REAL_CASES.E8);
  const completeEntries = adEntries(run).filter(entry => entry.field === 'tracking_url_complete');
  assert.ok(completeEntries.length > 0, '真实⑧ tracking entry 必须存在');
  const statuses = [...new Set(completeEntries.map(entry => entry.comparisonStatus))];
  assert.deepEqual(statuses, ['一致'], `真实⑧ tracking 必须 一致（实际 ${statuses.join('/')}）`);
});
