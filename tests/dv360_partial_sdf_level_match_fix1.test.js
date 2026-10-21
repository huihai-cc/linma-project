'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');

function createElement() {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: '',
  };
}

class AsyncFileReader {
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then(buffer => {
      if (this.onload) this.onload({ target: { result: buffer } });
    }, error => { if (this.onerror) this.onerror(error); });
  }
}

function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script exists');
  const exportBlock = `
window.__partialSdfApi = {
  parseSdfData,
  parseYoutubeSetting,
  parseXlsx,
  buildComparisonTree,
  workbookReferencesSheetName,
  setMediaType(value) { mediaType = value; },
  ensureGeoMasterLoaded,
};`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader: AsyncFileReader,
    JSZip, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX,
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} }, setTimeout, clearTimeout,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  sandbox.__partialSdfApi.setMediaType('youtube');
  return sandbox.__partialSdfApi;
}

const api = loadApi();
const availability = (campaigns = 'present', insertionOrders = 'present', lineItems = 'present') => ({
  Campaigns: campaigns, InsertionOrders: insertionOrders, LineItems: lineItems,
});
const sCp = (name = 'Campaign A', extra = {}) => ({ name, fields: {}, ...extra });
const sIo = (name = 'IO A', cpName = 'Campaign A', extra = {}) => ({ name, cpName, fields: {}, ...extra });
const sLi = (name = 'LI A', ioName = 'IO A', extra = {}) => ({ name, ioName, fields: {}, ...extra });
const dCp = (name = 'Campaign A', id = 'cp-1') => ({ name, id, fields: {}, rawFields: {}, rawFieldOrder: [] });
const dIo = (name = 'IO A', id = 'io-1', cpId = 'cp-1', extra = {}) => ({ name, id, cpId, fields: {}, rawFields: {}, rawFieldOrder: [], ...extra });
const dLi = (name = 'LI A', id = 'li-1', ioId = 'io-1', ioName = 'IO A', extra = {}) => ({ name, id, ioId, ioName, fields: {}, rawFields: {}, rawFieldOrder: [], ...extra });

function build(setting = {}, download = {}, states = availability()) {
  return api.buildComparisonTree({
    cp: setting.cp || [sCp()], io: setting.io || [sIo()], li: setting.li || [sLi()],
    gp: setting.gp || [], cr: setting.cr || [],
  }, {
    cp: download.cp || [], io: download.io || [], li: download.li || [],
    gp: download.gp || [], cr: download.cr || [], levelAvailability: states,
  });
}

function allNodes(result) {
  const nodes = [];
  const visit = node => { nodes.push(node); (node.children || []).forEach(visit); };
  result.roots.forEach(visit);
  return nodes;
}
function node(result, level, name) { return allNodes(result).find(item => item.level === level && item.name === name); }

function workbookBlob(sheets, hiddenNames = []) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  workbook.Workbook = { Sheets: workbook.SheetNames.map(name => ({ name, Hidden: hiddenNames.includes(name) ? 1 : 0 })) };
  return new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })]);
}

test('T1: 完整 CP+IO+LI SDF 保持原层级匹配', () => {
  const result = build({}, { cp: [dCp()], io: [dIo()], li: [dLi()] });
  assert.equal(node(result, 'CP', 'Campaign A').matchedName, 'Campaign A');
  assert.equal(node(result, 'IO', 'IO A').matchedName, 'IO A');
  assert.equal(node(result, 'LI', 'LI A').matchedName, 'LI A');
});

test('T2: Campaigns CSV 缺失时允许唯一 IO 和其 LI 正式匹配', () => {
  const result = build({}, { io: [dIo()], li: [dLi()] }, availability('missing', 'present', 'present'));
  assert.equal(node(result, 'IO', 'IO A').matchedName, 'IO A');
  assert.equal(node(result, 'LI', 'LI A').matchedName, 'LI A');
  assert.match(node(result, 'CP', 'Campaign A').compItems.map(item => item.dVal).join(' '), /SDF未提供（未校正）/);
});

test('T3: Campaigns 与 InsertionOrders CSV 缺失时允许唯一 LI 正式匹配', () => {
  const result = build({}, { li: [dLi()] }, availability('missing', 'missing', 'present'));
  assert.equal(node(result, 'LI', 'LI A').matchedName, 'LI A');
  assert.match(node(result, 'CP', 'Campaign A').compItems.map(item => item.dVal).join(' '), /SDF未提供（未校正）/);
  assert.match(node(result, 'IO', 'IO A').compItems.map(item => item.dVal).join(' '), /SDF未提供（未校正）/);
});

test('T4: CP 存在、IO CSV 缺失时保留 CP 比较并独立匹配 LI', () => {
  const result = build({}, { cp: [dCp()], li: [dLi()] }, availability('present', 'missing', 'present'));
  assert.equal(node(result, 'CP', 'Campaign A').matchedName, 'Campaign A');
  assert.equal(node(result, 'LI', 'LI A').matchedName, 'LI A');
  assert.match(node(result, 'IO', 'IO A').compItems.map(item => item.dVal).join(' '), /SDF未提供（未校正）/);
});

test('T5: Campaigns CSV 存在但 CP 名称不匹配时不绕过 CP 匹配 IO', () => {
  const result = build({}, { cp: [dCp('Unrelated Brand', 'other-cp')], io: [dIo('IO A', 'io-1', 'orphan-cp')] });
  assert.equal(node(result, 'CP', 'Campaign A').matchedName, null);
  assert.equal(node(result, 'IO', 'IO A').matchedName, null);
  assert.ok(result.dlOnly.some(item => item.level === 'IO' && item.name === 'IO A'));
});

test('T6: InsertionOrders CSV 存在但 IO 名称不匹配时不绕过 IO 匹配 LI', () => {
  const result = build({}, { cp: [dCp()], io: [dIo('Other IO')], li: [dLi()] });
  assert.equal(node(result, 'IO', 'IO A').matchedName, null);
  assert.equal(node(result, 'LI', 'LI A').matchedName, null);
  assert.ok(result.dlOnly.some(item => item.level === 'LI' && item.name === 'LI A'));
});

test('T7: 缺少 CP 且存在多个同名 IO 时保留 Warning，不强行匹配', () => {
  const result = build({}, { io: [dIo('IO A', 'io-1', 'cp-1'), dIo('IO A', 'io-2', 'cp-2')] }, availability('missing', 'present', 'missing'));
  const matched = node(result, 'IO', 'IO A');
  assert.equal(matched.matchedName, null);
  assert.equal(matched.ambiguous, true);
  assert.equal(matched.status, 'warning');
});

test('T8: 缺少 IO 且多个同名 LI 没有足够父级身份信息时保留 Warning', () => {
  const result = build({ li: [sLi('LI A', '')] }, {
    li: [dLi('LI A', 'li-1', 'io-1', ''), dLi('LI A', 'li-2', 'io-2', '')],
  }, availability('missing', 'missing', 'present'));
  const matched = node(result, 'LI', 'LI A');
  assert.equal(matched.matchedName, null);
  assert.equal(matched.ambiguous, true);

  const identified = build({ io: [sIo()], li: [sLi()] }, {
    li: [dLi('LI A', 'li-1', 'io-1', 'IO A'), dLi('LI A', 'li-2', 'io-2', 'IO B')],
  }, availability('missing', 'missing', 'present'));
  assert.equal(node(identified, 'LI', 'LI A').matchedId, 'li-1',
    'the matching parent IO name disambiguates duplicate LI names');
});

test('T9: 缺失父级且下级名称全局唯一时可匹配', () => {
  const result = build({}, { io: [dIo()], li: [dLi()] }, availability('missing', 'present', 'present'));
  assert.equal(node(result, 'IO', 'IO A').matchedId, 'io-1');
  assert.equal(node(result, 'LI', 'LI A').matchedId, 'li-1');
});

test('T10: 独立层级匹配遇到明确父级身份冲突时拒绝匹配', () => {
  const result = build({ io: [sIo('IO A', 'Campaign A', { cpId: 'expected-cp' })] }, {
    io: [dIo('IO A', 'io-1', 'other-cp')],
  }, availability('missing', 'present', 'missing'));
  const ioNode = node(result, 'IO', 'IO A');
  assert.equal(ioNode.matchedName, null);
  assert.equal(ioNode.status, 'warning');
  assert.match(ioNode.compItems[0].detail, /親階層IDが一致しない/);
});

test('T11: 一个 SDF IO 记录最多只能被一个设定表 IO 消费', () => {
  const result = build({
    cp: [sCp('Campaign A'), sCp('Campaign B')],
    io: [sIo('IO A', 'Campaign A'), sIo('IO A', 'Campaign B')],
    li: [],
  }, { io: [dIo()] }, availability('missing', 'present', 'missing'));
  const matched = allNodes(result).filter(item => item.level === 'IO' && item.matchedId === 'io-1');
  assert.equal(matched.length, 1);
  assert.equal(result.dlOnly.filter(item => item.level === 'IO' && item.id === 'io-1').length, 0);
});

test('T12: 独立匹配 LI 后 GP 与 CR 仍按 LI/GP 父级连接', () => {
  const result = build({
    gp: [{ name: 'GP A', ioName: 'IO A', liName: 'LI A', references: [{ ioName: 'IO A', liName: 'LI A', fields: {} }], fields: {} }],
    cr: [{ name: 'CR A', ioName: 'IO A', lpName: 'LI A', gpName: 'GP A', fields: {} }],
  }, {
    li: [dLi()],
    gp: [{ name: 'GP A', id: 'gp-1', liId: 'li-1', liName: 'LI A', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    cr: [{ name: 'CR A', id: 'cr-1', gpId: 'gp-1', gpName: 'GP A', fields: {}, rawFields: {}, rawFieldOrder: [] }],
  }, availability('missing', 'missing', 'present'));
  assert.equal(node(result, 'LI', 'LI A').matchedId, 'li-1');
  assert.equal(node(result, 'GP', 'GP A').matchedId, 'gp-1');
  assert.equal(node(result, 'CR', 'CR A').matchedId, 'cr-1');
});

test('T13: CSV 解析失败被标为 failed，不能按正常缺失跳过父级', () => {
  const parsed = api.parseSdfData([
    { name: 'SDF-InsertionOrders.csv', rows: null, parseError: true },
    { name: 'SDF-LineItems.csv', rows: [['Line Item Id', 'Io Id', 'Name'], ['li-1', 'io-1', 'LI A']] },
  ]);
  assert.equal(parsed.levelAvailability.InsertionOrders, 'failed');
  const result = build({}, { li: [dLi()] }, parsed.levelAvailability);
  assert.equal(node(result, 'IO', 'IO A').matchedName, null);
  assert.equal(node(result, 'LI', 'LI A').matchedName, null);

  const emptyParent = api.parseSdfData([
    { name: 'SDF-InsertionOrders.csv', rows: [['Io Id', 'Campaign Id', 'Name']] },
  ]);
  assert.equal(emptyParent.levelAvailability.InsertionOrders, 'present',
    'a valid but header-only CSV is present, not missing');
  const emptyResult = build({}, { li: [dLi()] }, availability('missing', 'present', 'present'));
  assert.equal(node(emptyResult, 'LI', 'LI A').matchedName, null,
    'an empty parent file prevents independent child promotion');
});

test('T14: 未匹配下载项目仍保留在 SDF-only 统计中', () => {
  const result = build({}, { cp: [dCp('Unrelated Brand', 'other-cp')], io: [dIo('Other IO', 'other-io', 'orphan-cp')] });
  assert.ok(result.dlOnly.some(item => item.level === 'CP' && item.name === 'Unrelated Brand'));
  assert.ok(result.dlOnly.some(item => item.level === 'IO' && item.name === 'Other IO'));
});

test('隐藏Sheet策略仅跳过已确认无关的大表，保留必要/未知隐藏Sheet与可见Sheet', async () => {
  const largeRows = Array.from({ length: 1200 }, (_, index) => [`entry-${index}`, 'lookup']);
  const blob = workbookBlob({
    'TrueView Main': [['setting marker'], ['Campaign']],
    'カテゴリターゲティング': largeRows,
    'アフィニティカテゴリ': [['category', 'include'], ['必要Audience', '含む']],
    '記入欄_営業・業推記入用': [['営業記入'], ['business value']],
    '未確認業務データ': [['unknown'], ['保留']],
  }, ['カテゴリターゲティング', 'アフィニティカテゴリ', '記入欄_営業・業推記入用', '未確認業務データ']);
  const parsed = await api.parseXlsx(blob);
  assert.ok(parsed.sheetNames.includes('カテゴリターゲティング'));
  assert.deepEqual(Array.from(parsed.skippedSheets), ['カテゴリターゲティング']);
  assert.deepEqual(Array.from(parsed.sheets['カテゴリターゲティング']), []);
  assert.equal(parsed.worksheets['カテゴリターゲティング'], undefined);
  for (const name of ['TrueView Main', 'アフィニティカテゴリ', '記入欄_営業・業推記入用', '未確認業務データ']) {
    assert.ok(parsed.sheets[name].length > 0, `${name} remains parsed`);
  }
  assert.equal(parsed.sheetVisibility['アフィニティカテゴリ'], 1);
});

test('no hidden sheets means all business data is parsed normally', async () => {
  const parsed = await api.parseXlsx(workbookBlob({ '設定シート': [['header'], ['data']] }));
  assert.deepEqual(Array.from(parsed.skippedSheets), []);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.sheets['設定シート'])), [['header'], ['data']]);
});

test('an explicit cell formula reference to the candidate hidden sheet cancels the skip', async () => {
  const workbook = XLSX.utils.book_new();
  const main = XLSX.utils.aoa_to_sheet([['setting']]);
  main.B2 = { t: 'n', v: 1, f: "'カテゴリターゲティング'!A1" };
  main['!ref'] = 'A1:B2';
  XLSX.utils.book_append_sheet(workbook, main, 'TrueView Main');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['business data'], ['keep']]), 'カテゴリターゲティング');
  workbook.Workbook = { Sheets: workbook.SheetNames.map(name => ({ name, Hidden: name === 'カテゴリターゲティング' ? 1 : 0 })) };
  const parsed = await api.parseXlsx(new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })]));
  assert.deepEqual(Array.from(parsed.skippedSheets), []);
  assert.equal(parsed.sheets['カテゴリターゲティング'].length, 2);
});

test('workbookReferencesSheetName 覆盖引号/无引号/ネスト/定義名の参照検出', () => {
  const buildWorkbook = formulaCells => ({
    Workbook: { Names: [] },
    Sheets: { 'Some Sheet': Object.fromEntries(
      Object.entries(formulaCells).map(([ref, f]) => [ref, { t: 'n', v: 0, f }])) },
  });
  const TARGET = 'カテゴリターゲティング';
  // 1) 引用符付き、式の先頭
  assert.equal(api.workbookReferencesSheetName(buildWorkbook({ A1: "'カテゴリターゲティング'!A1" }), TARGET), true);
  // 2) 無引号、SUM(...) 内ネスト
  assert.equal(api.workbookReferencesSheetName(buildWorkbook({ A1: 'SUM(カテゴリターゲティング!A1)' }), TARGET), true);
  // 3) 無引号、IF(...) 内ネスト
  assert.equal(api.workbookReferencesSheetName(buildWorkbook({ A1: 'IF(カテゴリターゲティング!A1>0,1,0)' }), TARGET), true);
  // 4) 引用符付き、SUM(...) 内ネスト
  assert.equal(api.workbookReferencesSheetName(buildWorkbook({ A1: "SUM('カテゴリターゲティング'!A1)" }), TARGET), true);
  // 5) 定義名（Defined Name）が参照
  const wbWithName = {
    Workbook: { Names: [{ Name: 'MyRef', Ref: 'SUM(カテゴリターゲティング!A1)' }] },
    Sheets: {},
  };
  assert.equal(api.workbookReferencesSheetName(wbWithName, TARGET), true);
  // 6) 別シート名は誤検出しない（より長い名前の一部として扱わない）
  assert.equal(api.workbookReferencesSheetName(buildWorkbook({ A1: 'OtherSheet!A1' }), TARGET), false);
  // 7) 参照を含まない普通の数式は検出しない
  assert.equal(api.workbookReferencesSheetName(buildWorkbook({ A1: '=1+2' }), TARGET), false);
});

test('ネストしたセル数式参照が非表示Sheetのスキップを取り消す（SUM/IF）', async () => {
  const workbook = XLSX.utils.book_new();
  const main = XLSX.utils.aoa_to_sheet([['setting']]);
  main.B2 = { t: 'n', v: 1, f: 'SUM(カテゴリターゲティング!A1)' };
  main.C2 = { t: 'n', v: 0, f: 'IF(カテゴリターゲティング!A1>0,1,0)' };
  main['!ref'] = 'A1:C2';
  XLSX.utils.book_append_sheet(workbook, main, 'TrueView Main');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['business data'], ['keep']]), 'カテゴリターゲティング');
  workbook.Workbook = { Sheets: workbook.SheetNames.map(name => ({ name, Hidden: name === 'カテゴリターゲティング' ? 1 : 0 })) };
  const parsed = await api.parseXlsx(new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })]));
  assert.deepEqual(Array.from(parsed.skippedSheets), []);
  assert.equal(parsed.sheets['カテゴリターゲティング'].length, 2);
});

test('麒麟NR TrueView Ver9 真实案件: 缺 Campaigns 时正式匹配 IO/LI 并延续 GP/CR', async t => {
  const caseRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/004';
  const settingPath = path.join(caseRoot,
    '2【長春依頼用】_v4_261020_キリンビール【NR】10-12月施策_限定缶施策_TrueView【設定シート】Ver9.xlsx');
  const sdfPath = path.join(caseRoot, 'SDF .zip');
  if (!fs.existsSync(settingPath) || !fs.existsSync(sdfPath)) {
    t.skip('Kirin NR real workbook/SDF fixture is not available in this environment');
    return;
  }
  const workbookBytes = fs.readFileSync(settingPath);
  const workbook = XLSX.read(workbookBytes, {
    type: 'buffer', cellStyles: true, cellNF: false, cellDates: true,
  });
  const sheets = {};
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false });
  }
  const fullSettingParsed = api.parseYoutubeSetting(sheets, workbook.SheetNames, path.basename(settingPath), workbook.Sheets);
  const optimizedSource = await api.parseXlsx(new Blob([workbookBytes]));
  assert.deepEqual(Array.from(optimizedSource.skippedSheets), ['カテゴリターゲティング']);
  assert.deepEqual(JSON.parse(JSON.stringify(optimizedSource.sheetNames)), workbook.SheetNames);
  assert.equal(optimizedSource.sheetVisibility['アフィニティカテゴリ'], 1,
    'a required hidden Audience sheet remains classified as hidden');
  const settingParsed = api.parseYoutubeSetting(
    optimizedSource.sheets, optimizedSource.sheetNames, path.basename(settingPath), optimizedSource.worksheets);
  const settingProjection = parsed => JSON.stringify({
    cp: parsed.cpList.map(item => ({ name: item.name, fields: item.fields, sourceSheet: item.sourceSheet })),
    io: parsed.ioList.map(item => ({ name: item.name, cpName: item.cpName, fields: item.fields, sourceSheet: item.sourceSheet })),
    li: parsed.liList.map(item => ({ name: item.name, ioName: item.ioName, fields: item.fields, sourceSheet: item.sourceSheet })),
    gp: parsed.gpList.map(item => ({ name: item.name, ioName: item.ioName, liName: item.liName, fields: item.fields, references: item.references })),
    cr: parsed.crList.map(item => ({ name: item.name, ioName: item.ioName, lpName: item.lpName, gpName: item.gpName, fields: item.fields })),
  });
  assert.equal(settingProjection(settingParsed), settingProjection(fullSettingParsed),
    'selective read preserves parsed YouTube setting entities and fields');
  const zip = await JSZip.loadAsync(fs.readFileSync(sdfPath));
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !/\.csv$/i.test(name)) continue;
    const bytes = await entry.async('uint8array');
    let csvText;
    try { csvText = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { csvText = new TextDecoder('shift_jis').decode(bytes); }
    const csvBook = XLSX.read(csvText, { type: 'string' });
    csvFiles.push({ name: path.basename(name), rows: XLSX.utils.sheet_to_json(
      csvBook.Sheets[csvBook.SheetNames[0]], { header: 1, defval: '', raw: false }) });
  }
  const downloadParsed = api.parseSdfData(csvFiles);
  assert.equal(downloadParsed.levelAvailability.Campaigns, 'missing');
  assert.equal(downloadParsed.levelAvailability.InsertionOrders, 'present');
  assert.equal(downloadParsed.levelAvailability.LineItems, 'present');
  assert.ok(settingParsed.ioList.length > 0, 'setting parser returns IOs');
  assert.ok(downloadParsed.ioList.length > 0, 'SDF parser returns IOs');
  await api.ensureGeoMasterLoaded();
  api.setMediaType('youtube');
  const result = api.buildComparisonTree({
    cp: settingParsed.cpList, io: settingParsed.ioList, li: settingParsed.liList,
    gp: settingParsed.gpList, cr: settingParsed.crList,
  }, {
    cp: downloadParsed.cpList, io: downloadParsed.ioList, li: downloadParsed.liList,
    gp: downloadParsed.gpList, cr: downloadParsed.crList,
    levelAvailability: downloadParsed.levelAvailability,
  });
  const fullResult = api.buildComparisonTree({
    cp: fullSettingParsed.cpList, io: fullSettingParsed.ioList, li: fullSettingParsed.liList,
    gp: fullSettingParsed.gpList, cr: fullSettingParsed.crList,
  }, {
    cp: downloadParsed.cpList, io: downloadParsed.ioList, li: downloadParsed.liList,
    gp: downloadParsed.gpList, cr: downloadParsed.crList,
    levelAvailability: downloadParsed.levelAvailability,
  });
  const comparisonProjection = tree => JSON.stringify(allNodes(tree).map(item => ({
    level: item.level, name: item.name, found: item.found, matchedName: item.matchedName,
    matchedId: item.matchedId, status: item.status,
    compItems: (item.compItems || []).map(field => ({ label: field.label, sVal: field.sVal, dVal: field.dVal, result: field.result })),
  })));
  assert.equal(comparisonProjection(result), comparisonProjection(fullResult),
    'selective read leaves the real-case comparison tree unchanged');
  const nodes = allNodes(result);
  const settingIoNodes = nodes.filter(item => item.level === 'IO' && !item.fromSdf && settingParsed.ioList.some(io => io.name === item.name));
  const settingLiNodes = nodes.filter(item => item.level === 'LI' && !item.fromSdf && settingParsed.liList.some(li => li.name === item.name));
  const settingGpNodes = nodes.filter(item => item.level === 'GP' && !item.fromSdf && settingParsed.gpList.some(gp => gp.name === item.name));
  const settingCrNodes = nodes.filter(item => item.level === 'CR' && !item.fromSdf && settingParsed.crList.some(cr => cr.name === item.name));
  assert.match(node(result, 'CP', settingParsed.cpList[0].name).compItems.map(item => item.dVal).join(' '), /SDF未提供（未校正）/);
  assert.ok(settingIoNodes.length > 0);
  assert.ok(settingIoNodes.every(item => item.matchedId),
    `every setting IO should formally match: ${settingIoNodes.map(item => `${item.name}=>${item.matchedName}`).join(' | ')}; SDF=${downloadParsed.ioList.map(item => `${item.name}[${item.id}]`).join(' | ')}`);
  assert.ok(settingLiNodes.length > 0);
  assert.ok(settingLiNodes.every(item => item.matchedId),
    `every setting LI should match under its IO: ${settingLiNodes.map(item => `${item.name}=>${item.matchedName}`).join(' | ')}`);
  assert.ok(settingGpNodes.every(item => item.matchedId),
    `every setting GP should match under its LI: ${settingGpNodes.map(item => `${item.name}=>${item.matchedName}`).join(' | ')}`);
  assert.ok(settingCrNodes.every(item => item.matchedId),
    `every setting CR should match under its GP: ${settingCrNodes.map(item => `${item.name}=>${item.matchedName}`).join(' | ')}`);
  assert.equal(result.dlOnly.filter(item => item.level === 'IO').length, 0,
    'matched SDF IOs must not be duplicated as SDF-only');
  assert.equal(result.dlOnly.filter(item => item.level === 'LI').length, 0,
    'matched SDF LIs must not be duplicated as SDF-only');
});

test('性能实测: 麒麟NR工作簿选择性读取指标', async t => {
  const settingPath = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/004/2【長春依頼用】_v4_261020_キリンビール【NR】10-12月施策_限定缶施策_TrueView【設定シート】Ver9.xlsx';
  if (!fs.existsSync(settingPath)) { t.skip('Kirin NR workbook is not available'); return; }
  const data = Uint8Array.from(fs.readFileSync(settingPath));
  const baseline = (() => {
    const gcAvailable = typeof global.gc === 'function';
    if (global.gc) global.gc();
    const heapBeforeBytes = process.memoryUsage().heapUsed;
    let started = performance.now();
    const workbook = XLSX.read(data, { type: 'array', cellStyles: true, cellNF: false, cellDates: true });
    const readMs = performance.now() - started;
    if (global.gc) global.gc();
    const heapAfterReadBytes = process.memoryUsage().heapUsed;
    const parsedSheets = {};
    started = performance.now();
    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name];
      parsedSheets[name] = !ws || !ws['!ref'] ? [] : XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    }
    const parseMs = performance.now() - started;
    if (global.gc) global.gc();
    return {
      readMs: +readMs.toFixed(2), parseMs: +parseMs.toFixed(2),
      memory: gcAvailable ? {
        heapBeforeBytes, heapAfterReadBytes, heapAfterParseBytes: process.memoryUsage().heapUsed,
        retainedHeapDeltaBytes: process.memoryUsage().heapUsed - heapBeforeBytes,
      } : null,
      parsedSheetCount: Object.keys(parsedSheets).length,
    };
  })();
  if (global.gc) global.gc();
  const originalRead = XLSX.read;
  const originalSheetToJson = XLSX.utils.sheet_to_json;
  const metrics = { xlsxReadMs: 0, sheetToJsonMs: 0, sheetToJsonCalls: 0, heapAfterXlsxReadBytes: null };
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  XLSX.read = function (...args) {
    const started = performance.now();
    const workbook = originalRead.apply(this, args);
    metrics.xlsxReadMs += performance.now() - started;
    if (global.gc) global.gc();
    metrics.heapAfterXlsxReadBytes = process.memoryUsage().heapUsed;
    return workbook;
  };
  XLSX.utils.sheet_to_json = function (...args) {
    const started = performance.now();
    const rows = originalSheetToJson.apply(this, args);
    metrics.sheetToJsonMs += performance.now() - started;
    metrics.sheetToJsonCalls++;
    return rows;
  };
  const totalStarted = performance.now();
  try {
    const parsed = await api.parseXlsx(new Blob([data]));
    if (global.gc) global.gc();
    const heapAfterParseBytes = process.memoryUsage().heapUsed;
    assert.deepEqual(Array.from(parsed.skippedSheets), ['カテゴリターゲティング']);
    assert.equal(metrics.sheetToJsonCalls, 24);
    console.log('[DV360_HIDDEN_SHEET_BENCH]', JSON.stringify({
      before: baseline,
      after: {
        totalMs: +(performance.now() - totalStarted).toFixed(2),
      xlsxReadMs: +metrics.xlsxReadMs.toFixed(2),
      sheetToJsonMs: +metrics.sheetToJsonMs.toFixed(2),
      sheetToJsonCalls: metrics.sheetToJsonCalls,
      memory: typeof global.gc === 'function' ? {
        heapBeforeBytes,
        heapAfterXlsxReadBytes: metrics.heapAfterXlsxReadBytes,
        heapAfterParseBytes,
        retainedHeapDeltaBytes: heapAfterParseBytes - heapBeforeBytes,
      } : null,
      parsedSheetCount: Object.keys(parsed.sheetNames).length - parsed.skippedSheets.length,
      skippedSheets: parsed.skippedSheets,
      gcAvailable: typeof global.gc === 'function',
      },
    }));
  } finally {
    XLSX.read = originalRead;
    XLSX.utils.sheet_to_json = originalSheetToJson;
  }
});
