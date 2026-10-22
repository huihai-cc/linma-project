'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../xlsx.full.min.js');
const { getTverApi } = require('./tver_real_file.verify.js');
const { makeStructuredSettingWorkbook, makeRegisterCsv, makeEditCsv } = require('./fixtures/tver-fixtures.js');
const api = getTverApi();
const ASR_0_C = '0 1 2 3 4 5 6 7 8 9 A B C';

function workbook({ mode = 'あり', point = '購入：225\r\n登録：226', times = ['6:00～23:59', '8:00～21:30'], asr = '0~C' } = {}) {
  const mainRows = ['1', '2'].map(number => ({
    '発注CPN名': 'FIX4 Synthetic Campaign', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/10/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/10/31 23:45',
    'ターゲティング番号': number, '素材名': 'synthetic-creative.mp4', 'LP名': 'Synthetic LP',
  }));
  const wb = makeStructuredSettingWorkbook({ mainRows, targetingBatches: [[
    { number: '1', device: 'CTV', price: '11', duration: '15秒(11-22秒)' },
    { number: '2', device: 'CTV', price: '22', duration: '15秒(11-22秒)' },
  ]] });
  const rows = wb.Sheets[wb.SheetNames[0]];
  rows[0] = ['★', '基本情報'];
  rows[7] = ['', 'レポート開放アカウント', '既存', '', '開放指標設定', 'CV有', 'CV', 'CV, 間接CV'];
  rows[17] = ['', 'CV', mode, 'CVポイント', point];
  const creative = rows.findIndex(row => row.includes('★') && row.includes('クリエイティブ'));
  const line = (label, values) => {
    const row = [];
    [1, 7].forEach((column, i) => { row[column] = label; row[column + 1] = values[i] ? '○' : ''; row[column + 2] = values[i] || ''; });
    return row;
  };
  rows.splice(creative, 0, line('時間指定', times), line('ASR', [asr, asr]));
  return wb;
}

function runCase({ settingOptions, wb = workbook(settingOptions), csvCv = '225 226', csvAsr = ASR_0_C,
  csvTimes = [['6:00', '23:59'], ['8:00', '21:30']], schema = 'register', mutateRows, sheetJs = false } = {}) {
  if (sheetJs) {
    const book = XLSX.utils.book_new();
    for (const name of wb.SheetNames) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(wb.Sheets[name]), name);
    wb = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellDates: true });
  }
  const setting = api.parseTverSettingWorkbook(wb, { fileName: 'fix4-synthetic.xlsx' });
  const rows = ['1', '2'].map((number, i) => ({
    campaign_name: setting.campaigns[0].expectedName, start_datetime: '2026/10/01 00:00', end_datetime: '2026/10/31 23:45',
    budget_type: '2', budget: '900', daily_budget: '30', campaign_status: '0', consumption_type: '1', cv_point: csvCv,
    adgroup_name: 'Synthetic GP ' + number, device: 'ctv', price: i ? '22' : '11', tver_video_duration: '15',
    creative_name: 'synthetic-creative.mp4', url: 'https://example.invalid/synthetic-lp', status: '1', uid_suffix: csvAsr,
    start_time: csvTimes[i][0], end_time: csvTimes[i][1], campaign_id: '101', adgroup_id: String(201 + i), ad_id: String(301 + i),
  }));
  if (mutateRows) mutateRows(rows);
  const parsed = api.parseCsvText((schema === 'edit' ? makeEditCsv : makeRegisterCsv)(rows), { fileName: 'fix4-synthetic.csv' });
  const tree = schema === 'edit' ? api.buildEditTree(parsed) : api.buildRegisterTree(parsed);
  const matching = api.matchTverEntities(setting, tree, { schemaKind: parsed.schema.kind, conversionContext: api.createTverConversionContext(parsed.schema.kind, tree) });
  const run = api.buildRunFromModels(setting, tree, matching, parsed);
  return { setting, tree, matching, parsed, run, cv: run.entries.find(e => e.level === 'Campaign' && e.field === 'cv_point') };
}

function assertEqualStatus(entry) { assert.ok(['一致', '表記ゆれ一致'].includes(entry.comparisonStatus), JSON.stringify(entry)); }
function adEntry(result, index, field) { return result.run.entries.find(e => e.entityKey === result.setting.ads[index].key && e.field === field); }

test('FIX4-A CV business source: SheetJS reads C18/E18 rather than report G8/H8', () => {
  const r = runCase({ sheetJs: true });
  assert.equal(r.setting.campaigns[0].fields.cvMode, 'あり');
  assert.equal(r.setting.campaigns[0].sourceRefs.cvMode.rowNumber, 18);
  assert.equal(r.cv.settingRawValue, '購入：225\r\n登録：226');
  assert.equal(r.cv.csvRawValue, '225 226');
  assert.equal(r.cv.normalizedValues.setting, '225 226');
  assert.equal(r.cv.normalizedValues.csv, '225 226');
  assertEqualStatus(r.cv);
  assert.deepEqual(Array.from(r.cv.sourceEvidence.csv, s => s.rowNumber), [2, 3]);
  assert.equal(r.cv.sourceRefs.csv.rawValue, r.cv.csvRawValue);
});

for (const [title, point, csvCv, expected] of [
  ['single ID', '225', '225', 'equal'],
  ['multiple IDs', '225 226', '225 226', 'equal'],
  ['order differs', '購入：225\n登録：226', '226 225', 'equal'],
  ['description contains unrelated numbers', '30日計測：225\n25歳区分：226', '225 226', 'equal'],
  ['missing ID', '225 226', '225', '不一致'],
  ['extra ID', '225 226', '225 226 227', '不一致'],
  ['wrong numeric ID', '225 226', '225 999', '不一致'],
  ['CSV empty with explicit Setting IDs', '225 226', '', '不一致'],
  ['Setting duplicate ID is visible review', '225 225 226', '225 226', '需确认'],
  ['CSV duplicate ID is visible review', '225 226', '225 226 226', '需确认'],
  ['CSV invalid token', '225 226', '225 bad', '需确认'],
  ['Setting partial extraction forbidden', '購入：225\n不明なポイント', '225', '需确认'],
  ['Setting arbitrary numbers forbidden', '30日間の計測225', '225', '需确认'],
  ['CVあり without IDs', '', '', '需确认'],
]) test('FIX4-A CV collection: ' + title, () => {
  const r = runCase({ settingOptions: { point }, csvCv });
  assert.equal(r.cv.csvRawValue, csvCv);
  if (expected === 'equal') assertEqualStatus(r.cv); else assert.equal(r.cv.comparisonStatus, expected);
  if (title.includes('duplicate')) assert.match(r.cv.conservativeReason, /DUPLICATE/);
});

test('FIX4-A CVなし: empty is comparable, IDs contradict none, unresolved mode remains review', () => {
  const empty = runCase({ settingOptions: { mode: 'なし', point: '' }, csvCv: '' });
  assert.equal(empty.cv.comparisonStatus, '一致');
  assert.equal(empty.cv.comparable, true);
  assert.equal(runCase({ settingOptions: { mode: 'なし', point: '' }, csvCv: '225' }).cv.comparisonStatus, '不一致');
  assert.equal(runCase({ settingOptions: { mode: 'なし', point: '225' }, csvCv: '225' }).cv.comparisonStatus, '需确认');
  assert.equal(runCase({ settingOptions: { mode: '要相談', point: '225' }, csvCv: '225' }).cv.comparisonStatus, '需确认');
});

test('FIX4-A CV: conflicting business sources cannot select the first CV mode', () => {
  const wb = workbook(); wb.Sheets[wb.SheetNames[0]][16] = ['', 'CV', 'なし'];
  assert.equal(runCase({ wb }).cv.comparisonStatus, '需确认');
});

test('FIX4-A CV: Register raw-row conflict is review without splitting Campaign signature', () => {
  const good = runCase();
  const conflict = runCase({ mutateRows(rows) { rows[1].cv_point = '225 227'; } });
  assert.equal(conflict.cv.comparisonStatus, '需确认');
  assert.equal(conflict.tree.campaigns.length, 1);
  assert.equal(conflict.tree.campaigns[0].key, good.tree.campaigns[0].key);
  assert.equal(conflict.tree.campaigns[0].rawRows[1].values.cv_point, '225 227');
  assert.equal(conflict.matching.matches.filter(x => x.status === 'matched').length, 5);
});

test('FIX4-A CV: normalized raw-row order is compatible; mixed empty/nonempty is not', () => {
  assertEqualStatus(runCase({ mutateRows(rows) { rows[1].cv_point = '226 225'; } }).cv);
  assert.equal(runCase({ mutateRows(rows) { rows[1].cv_point = ''; } }).cv.comparisonStatus, '需确认');
});

test('FIX4-A CV: Edit uses its own field; CSV-only Survey never inherits normal CV', () => {
  assertEqualStatus(runCase({ schema: 'edit' }).cv);
  const r = runCase({ mutateRows(rows) { rows.push({ ...rows[0], campaign_name: '【BLS】Synthetic Survey', cv_point: '', adgroup_name: 'Survey Contact', creative_name: 'Survey Creative' }); } });
  const bls = r.tree.campaigns.find(x => x.fields.campaignName === '【BLS】Synthetic Survey');
  assert.ok(bls);
  assert.equal(r.run.entries.filter(e => e.csvEntityKey === bls.key && e.field === 'cv_point').length, 0);
  assert.ok(r.run.entries.some(e => e.csvEntityKey === bls.key && e.field === 'entity' && e.comparisonStatus === '未匹配'));
});

test('FIX4-A Ad time: each Ad uses only its own Targeting time and retains source', () => {
  const r = runCase();
  for (const [index, start, end] of [[0, '06:00', '23:59'], [1, '08:00', '21:30']]) {
    const s = adEntry(r, index, 'start_time'), e = adEntry(r, index, 'end_time');
    assert.equal(s.normalizedValues.setting, start);
    assert.equal(e.normalizedValues.setting, end);
    assertEqualStatus(s); assertEqualStatus(e);
    assert.equal(s.sourceRefs.setting.columnName, '時間指定');
    assert.equal(s.sourceRefs.csv.columnName, 'start_time');
    assert.equal(e.sourceRefs.csv.columnName, 'end_time');
    assert.equal(s.sourceRefs.csv.rawValue, s.csvRawValue);
    assert.equal(e.sourceRefs.csv.rawValue, e.csvRawValue);
    assert.ok(s.sourceEvidence.derivedFrom.some(ref => ref.rawValue.includes(index ? '8:00' : '6:00')));
  }
});

test('FIX4-A Ad time: a mismatch is detected separately at start/end without changing identity', () => {
  const good = runCase();
  const bad = runCase({ csvTimes: [['5:00', '23:45'], ['8:00', '21:30']] });
  assert.equal(adEntry(bad, 0, 'start_time').comparisonStatus, '不一致');
  assert.equal(adEntry(bad, 0, 'end_time').comparisonStatus, '不一致');
  assertEqualStatus(adEntry(bad, 1, 'start_time'));
  assert.deepEqual(JSON.parse(JSON.stringify(bad.matching.reservations)), JSON.parse(JSON.stringify(good.matching.reservations)));
  const otherTime = runCase({ settingOptions: { times: ['7:00～23:59', '8:00～21:30'] } });
  assert.equal(otherTime.setting.adGroups[0].key, good.setting.adGroups[0].key);
});

test('FIX4-A Ad time: no directive keeps 00:00/23:59 defaults and empty CSV stays deferred', () => {
  const r = runCase({ settingOptions: { times: ['', ''] }, csvTimes: [['0:00', '23:59'], ['', '']] });
  assertEqualStatus(adEntry(r, 0, 'start_time')); assertEqualStatus(adEntry(r, 0, 'end_time'));
  assert.equal(adEntry(r, 1, 'start_time'), undefined);
  assert.equal(adEntry(r, 1, 'end_time'), undefined);
});

test('FIX4-A Ad time: unknown/conflicting directives require review instead of defaulting', () => {
  const bad = runCase({ settingOptions: { times: ['要相談', '8:00～21:30'] } });
  assert.equal(adEntry(bad, 0, 'start_time').comparisonStatus, '需确认');
  assert.equal(adEntry(bad, 0, 'end_time').comparisonStatus, '需确认');
  assertEqualStatus(adEntry(bad, 1, 'start_time'));
  const wb = workbook(); const timeRow = wb.Sheets[wb.SheetNames[0]].find(row => row[1] === '時間指定'); timeRow[4] = '7:00～23:59';
  assert.equal(adEntry(runCase({ wb }), 0, 'start_time').comparisonStatus, '需确认');
});

test('FIX4-A Ad time: explicit directive with missing CSV time is visible review', () => {
  const r = runCase({ csvTimes: [['', ''], ['8:00', '21:30']] });
  assert.equal(adEntry(r, 0, 'start_time')?.comparisonStatus, '需确认');
  assert.equal(adEntry(r, 0, 'end_time')?.comparisonStatus, '需确认');
});

for (const [title, value, expected] of [
  ['full set', ASR_0_C, 'equal'],
  ['order change', 'C B A 9 8 7 6 5 4 3 2 1 0', 'equal'],
  ['missing member', '0 1 2 3 4 5 6 7 8 9 A B', '不一致'],
  ['extra member', ASR_0_C + ' D', '不一致'],
  ['duplicate member', ASR_0_C + ' C', '需确认'],
  ['invalid character', ASR_0_C + ' G', '需确认'],
]) test('FIX4-A ASR 0~C: ' + title, () => {
  const r = runCase({ csvAsr: value });
  const e = r.run.entries.find(x => x.field === 'uid_suffix');
  if (expected === 'equal') assertEqualStatus(e); else assert.equal(e.comparisonStatus, expected);
  assert.equal(e.settingRawValue, '0~C'); assert.equal(e.csvRawValue, value);
  if (title.includes('duplicate')) assert.match(e.conservativeReason, /DUPLICATE/);
});

test('FIX4-A ASR: unknown ranges stay review and historical 0~8/0のみ duplicate semantics survive', () => {
  assert.equal(runCase({ settingOptions: { asr: '1~C' } }).run.entries.find(x => x.field === 'uid_suffix').comparisonStatus, '需确认');
  assertEqualStatus(runCase({ settingOptions: { asr: '0~8' }, csvAsr: '8 7 6 5 4 3 2 1 0 0' }).run.entries.find(x => x.field === 'uid_suffix'));
  assertEqualStatus(runCase({ settingOptions: { asr: '0のみ' }, csvAsr: '0 0' }).run.entries.find(x => x.field === 'uid_suffix'));
});
