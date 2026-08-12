'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const projectRoot = path.join(__dirname, '..');
const case010Workbook = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube\\010\\260610開始_v3【MEMEME】26年6月UGCパワー動画_TrueView【設定シート】Ver5.xlsx';
const case011Zip = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube\\011\\011-selected.zip';

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadDv360Api() {
  const htmlPath = path.join(projectRoot, 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  if (!source) throw new Error(`DV360 application script not found: ${htmlPath}`);
  const exportBlock = `
window.__dv360AudienceScopeApi = {
  extractYoutubeAudienceSheetReferences: typeof extractYoutubeAudienceSheetReferences === 'function' ? extractYoutubeAudienceSheetReferences : undefined,
  getYoutubeAudienceTypeKeyForSheetName: typeof getYoutubeAudienceTypeKeyForSheetName === 'function' ? getYoutubeAudienceTypeKeyForSheetName : undefined,
  parseYoutubeAudienceSheets,
  parseYoutubeSetting,
  parseSdfData,
  resolveYoutubeAudienceForSettingRecord: typeof resolveYoutubeAudienceForSettingRecord === 'function' ? resolveYoutubeAudienceForSettingRecord : undefined,
  buildYoutubeAudienceComparisonItems,
  buildComparisonTree,
  hydrateAudienceTargetMaster,
  hydrateYoutubeAudienceAliasMaster: typeof hydrateYoutubeAudienceAliasMaster === 'function' ? hydrateYoutubeAudienceAliasMaster : undefined,
  resolveYoutubeAudienceSettingItem: typeof resolveYoutubeAudienceSettingItem === 'function' ? resolveYoutubeAudienceSettingItem : undefined,
  compareGP,
  compareLI,
  getLevelColumns,
  setTreeRoots(value) { treeRoots = value; },
  setMediaType(value) { mediaType = value; },
  setSelectedDv360CaseType,
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
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
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX,
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  const api = sandbox.__dv360AudienceScopeApi;
  api.setMediaType('youtube');
  api.setSelectedDv360CaseType('initial');
  return api;
}

const api = loadDv360Api();
const yellowStyle = { patternType: 'solid', fgColor: { rgb: 'FFFF00' }, bgColor: { indexed: 64 } };

function decodeCsv(buffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('shift_jis').decode(buffer); }
}

function parseCsvRows(buffer) {
  const workbook = XLSX.read(decodeCsv(buffer), { type: 'string' });
  if (!workbook.SheetNames.length) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1, defval: '', raw: false,
  });
}

async function parseSdfZip(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const csvFiles = [];
  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir || !entryName.toLowerCase().endsWith('.csv')) continue;
    csvFiles.push({
      name: path.basename(entryName),
      path: entryName,
      parentZip: path.basename(filePath),
      rows: parseCsvRows(await entry.async('uint8array')),
    });
  }
  return csvFiles;
}

async function parseSdfBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const csvFiles = [];
  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir || !entryName.toLowerCase().endsWith('.csv')) continue;
    csvFiles.push({
      name: path.basename(entryName), path: entryName, parentZip: 'SDF.zip',
      rows: parseCsvRows(await entry.async('uint8array')),
    });
  }
  return csvFiles;
}

function hydrate010AudienceMasters() {
  api.hydrateAudienceTargetMaster([
    ['93040', 'affinity', 'Category', '', 'Beauty & Wellness', 'AFFINITY', 'https://developers.google.com/google-ads/api/data/tables/affinity-categories.csv', '2026-08-09'],
    ['80546', 'in_market', 'Category', '', 'Beauty & Personal Care', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
    ['80285', 'in_market', 'Category', 'Post-Secondary Education', 'Cosmetology Education & Training', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
  ]);
  const aliasCsv = fs.readFileSync(path.join(projectRoot, 'data', 'dv360_google_audience_alias_ja.csv'), 'utf8');
  const aliasWb = XLSX.read(aliasCsv, { type: 'string' });
  const aliasRows = XLSX.utils.sheet_to_json(aliasWb.Sheets[aliasWb.SheetNames[0]], { defval: '', raw: false });
  assert.equal(api.hydrateYoutubeAudienceAliasMaster(aliasRows), 3);
}

function makeWorksheet(items, { effectiveFilter = true } = {}) {
  const lastRow = items.length + 6;
  const ws = {
    '!ref': `A1:B${lastRow}`,
    '!autofilter': { ref: `A5:B${lastRow}` },
    '!rows': [],
    A5: { t: 's', v: 'NO' },
    B5: { t: 's', v: 'セグメント名' },
  };
  items.forEach((item, index) => {
    const row = index + 6;
    ws[`A${row}`] = { t: 'n', v: index + 1, s: item.style || {} };
    ws[`B${row}`] = { t: 's', v: item.name, s: item.style || {} };
    if (item.hidden) ws['!rows'][row - 1] = { hidden: true };
  });
  if (effectiveFilter) {
    const row = lastRow;
    ws[`A${row}`] = { t: 'n', v: 999 };
    ws[`B${row}`] = { t: 's', v: 'hidden master row' };
    ws['!rows'][row - 1] = { hidden: true };
  }
  return ws;
}

function parsedItem(id, name, sheetName) {
  return { criterionId: id, no: id, name, sourceSheet: sheetName, sourceRow: 6, visible: true, styleId: 1, fill: {}, bucket: 'include' };
}

function catalog(sheets) {
  const result = {
    affinity: { include: [], exclude: [] }, lifeEvent: { include: [], exclude: [] }, detailedDemo: { include: [], exclude: [] }, bySheet: {},
  };
  for (const [sheetName, config] of Object.entries(sheets)) {
    result.bySheet[sheetName] = { typeKey: config.typeKey, filterActive: config.filterActive !== false, visibleCount: config.items.length,
      hiddenCount: 1, include: config.items, exclude: [] };
  }
  return result;
}

function hydrateMaster() {
  api.hydrateAudienceTargetMaster([
    ['80001', 'in_market', 'Category', 'Parent', 'Audience A', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
    ['80002', 'in_market', 'Category', 'Parent', 'Audience B', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
    ['81001', 'life_event', 'Category', 'Parent', 'Life A', 'LIFE_EVENT', 'https://developers.google.com/google-ads/api/data/tables/life-events.csv', '2026-08-09'],
  ]);
}

function gpDownload(name, id, liId, audienceIds) {
  return {
    name, id, liId, fields: { status: 'Active', videoAdFormat: 'Responsive' },
    rawFields: { Status: 'Active', 'Video Ad Format': 'Responsive', 'Affinity & In Market Targeting - Include': audienceIds },
    rawFieldOrder: ['Status', 'Video Ad Format', 'Affinity & In Market Targeting - Include'],
  };
}

test('marker fallback resolves one active sheet per Audience type', () => {
  const c = catalog({
    'Affinity Selection': { typeKey: 'affinity', items: [parsedItem('80001', 'Audience A', 'Affinity Selection')] },
    'Life Event Selection': { typeKey: 'lifeEvent', items: [parsedItem('81001', 'Life A', 'Life Event Selection')] },
    'Detailed Demo Selection': { typeKey: 'detailedDemo', items: [parsedItem('82001', 'Demo A', 'Detailed Demo Selection')] },
  });

  const resolved = api.resolveYoutubeAudienceForSettingRecord({
    fields: { audienceListRaw: '別セグメントシート参照', audienceManualRaw: '' },
  }, c);

  assert.equal(resolved.resolutionMode, 'type-unique-fallback');
  assert.deepEqual(Array.from(resolved.referencedSheets), [
    'Affinity Selection', 'Life Event Selection', 'Detailed Demo Selection',
  ]);
  assert.deepEqual(Array.from(resolved.affinity.include, item => item.criterionId), ['80001']);
  assert.deepEqual(Array.from(resolved.lifeEvent.include, item => item.criterionId), ['81001']);
  assert.deepEqual(Array.from(resolved.detailedDemo.include, item => item.criterionId), ['82001']);
});

test('marker fallback remains ambiguous when one Audience type has multiple active sheets', () => {
  const c = catalog({
    'Affinity Selection A': { typeKey: 'affinity', items: [parsedItem('80001', 'Audience A', 'Affinity Selection A')] },
    'Affinity Selection B': { typeKey: 'affinity', items: [parsedItem('80002', 'Audience B', 'Affinity Selection B')] },
    'Life Event Selection': { typeKey: 'lifeEvent', items: [parsedItem('81001', 'Life A', 'Life Event Selection')] },
  });

  const resolved = api.resolveYoutubeAudienceForSettingRecord({
    fields: { audienceListRaw: '別セグメントシート参照', audienceManualRaw: '' },
  }, c);

  assert.equal(resolved.resolutionMode, 'ambiguous-fallback');
  assert.deepEqual(Array.from(resolved.referencedSheets), []);
  assert.equal(resolved.affinity.include.length, 0);
  assert.equal(resolved.lifeEvent.include.length, 0);
});

test('Sheet reference: 「xxx」/『xxx』/无引号格式均解析并保留 raw', () => {
  assert.equal(typeof api.extractYoutubeAudienceSheetReferences, 'function');
  const raw = '「アフィニティカテゴリ(A)」シート参照\n『ライフイベント(B)』シート参照\n詳しいユーザー属性(C) シート参照';
  const result = api.extractYoutubeAudienceSheetReferences(raw);
  assert.equal(result.raw, raw);
  assert.deepEqual(Array.from(result.sheetNames), ['アフィニティカテゴリ(A)', 'ライフイベント(B)', '詳しいユーザー属性(C)']);
});

test('派生 Sheet 名は半角/全角括号に関係なく前缀で Audience type を判定する', () => {
  assert.equal(typeof api.getYoutubeAudienceTypeKeyForSheetName, 'function');
  assert.equal(api.getYoutubeAudienceTypeKeyForSheetName('アフィニティカテゴリ(美容マス層)'), 'affinity');
  assert.equal(api.getYoutubeAudienceTypeKeyForSheetName('アフィニティカテゴリ（美容マス層）'), 'affinity');
  assert.equal(api.getYoutubeAudienceTypeKeyForSheetName('ライフイベント(B)'), 'lifeEvent');
  assert.equal(api.getYoutubeAudienceTypeKeyForSheetName('詳しいユーザー属性(C)'), 'detailedDemo');
});

test('派生 Audience Sheet 也只读取 visible 行，hidden 行不参与', () => {
  const sheetName = 'アフィニティカテゴリ(美容マス層)';
  const result = api.parseYoutubeAudienceSheets({
    [sheetName]: makeWorksheet([
      { name: 'visible yellow', style: yellowStyle },
      { name: 'hidden yellow', style: yellowStyle, hidden: true },
    ]),
  }, [sheetName]);
  assert.ok(result.bySheet);
  assert.deepEqual(Array.from(result.bySheet[sheetName].include, item => item.name), ['visible yellow']);
  assert.equal(result.bySheet[sheetName].exclude.length, 0);
});

test('同一 GP 引用多张 Sheet 时按 type 合并并 Set union 去重', () => {
  assert.equal(typeof api.resolveYoutubeAudienceForSettingRecord, 'function');
  const c = catalog({
    'アフィニティカテゴリ(A)': { typeKey: 'affinity', items: [parsedItem('80001', 'Audience A', 'アフィニティカテゴリ(A)')] },
    'アフィニティカテゴリ（B）': { typeKey: 'affinity', items: [parsedItem('80001', 'Audience A', 'アフィニティカテゴリ（B）'), parsedItem('80002', 'Audience B', 'アフィニティカテゴリ（B）')] },
    'ライフイベント(C)': { typeKey: 'lifeEvent', items: [parsedItem('81001', 'Life A', 'ライフイベント(C)')] },
  });
  const resolved = api.resolveYoutubeAudienceForSettingRecord({ fields: {
    audienceListRaw: '別セグメントシート参照',
    audienceManualRaw: '「アフィニティカテゴリ(A)」シート参照\n「アフィニティカテゴリ（B）」シート参照\n「ライフイベント(C)」シート参照',
  } }, c);
  assert.deepEqual(Array.from(resolved.referencedSheets), ['アフィニティカテゴリ(A)', 'アフィニティカテゴリ（B）', 'ライフイベント(C)']);
  assert.deepEqual(Array.from(resolved.affinity.include, item => item.criterionId), ['80001', '80002']);
  assert.deepEqual(Array.from(resolved.lifeEvent.include, item => item.criterionId), ['81001']);
});

test('引用 Sheet 不存在时生成指定 warning detail', () => {
  const resolved = api.resolveYoutubeAudienceForSettingRecord({ fields: {
    audienceManualRaw: '「アフィニティカテゴリ(美容マス層)」シート参照',
  } }, catalog({}));
  const items = api.buildYoutubeAudienceComparisonItems(resolved, { rawFields: {}, fields: {} });
  const warning = items.find(item => item.label === 'Audience Sheet参照');
  assert.equal(warning.result, 'warning');
  assert.equal(warning.mpDetail, '設定表で参照されているAudience Sheetが見つかりません：\nアフィニティカテゴリ(美容マス層)');
});

test('引用 Sheet 无有效 Filter 时按 Audience 未设定处理', () => {
  const c = catalog({ 'アフィニティカテゴリ(A)': { typeKey: 'affinity', filterActive: false, items: [parsedItem('80001', 'Audience A', 'アフィニティカテゴリ(A)')] } });
  const resolved = api.resolveYoutubeAudienceForSettingRecord({ fields: { audienceManualRaw: '「アフィニティカテゴリ(A)」シート参照' } }, c);
  assert.equal(resolved.affinity.include.length, 0);
  assert.deepEqual(Array.from(resolved.unfilteredSheets), ['アフィニティカテゴリ(A)']);
});

test('两个 GP 引用不同 Sheet 时 Audience 不互相污染', () => {
  hydrateMaster();
  const c = catalog({
    'アフィニティカテゴリ(A)': { typeKey: 'affinity', items: [parsedItem('80001', 'Audience A', 'アフィニティカテゴリ(A)')] },
    'アフィニティカテゴリ(B)': { typeKey: 'affinity', items: [parsedItem('80002', 'Audience B', 'アフィニティカテゴリ(B)')] },
  });
  const setting = {
    cp: [{ name: 'CP', sourceSheet: '運用者用', fields: {} }],
    io: [{ name: 'IO', cpName: 'CP', sourceSheet: '運用者用', fields: {} }],
    li: [{ name: 'LI', ioName: 'IO', sourceSheet: '運用者用', fields: {} }],
    gp: [
      { name: 'GP-A', references: [{ ioName: 'IO', liName: 'LI', sourceSheet: '運用者用', fields: { audienceManualRaw: '「アフィニティカテゴリ(A)」シート参照' } }] },
      { name: 'GP-B', references: [{ ioName: 'IO', liName: 'LI', sourceSheet: '運用者用', fields: { audienceManualRaw: '「アフィニティカテゴリ(B)」シート参照' } }] },
    ], cr: [], audience: c,
  };
  const download = {
    cp: [{ name: 'CP', id: 'DCP', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    io: [{ name: 'IO', id: 'DIO', cpId: 'DCP', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    li: [{ name: 'LI', id: 'DLI', ioId: 'DIO', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    gp: [gpDownload('GP-A', 'GPA', 'DLI', '80001'), gpDownload('GP-B', 'GPB', 'DLI', '80002')], cr: [],
  };
  const tree = api.buildComparisonTree(setting, download);
  const nodes = [];
  const visit = node => { if (node.level === 'GP' && !node.fromSdf) nodes.push(node); (node.children || []).forEach(visit); };
  tree.roots.forEach(visit);
  const comparisons = Object.fromEntries(nodes.map(node => [node.name, node.compItems.find(item => item.label === 'Affinity 配信')]));
  assert.equal(comparisons['GP-A'].result, 'ok', 'GP-A の一致した Audience は通常表示');
  assert.equal(comparisons['GP-B'].result, 'ok', 'GP-B の一致した Audience は通常表示');
  assert.equal(nodes.some(node => (node.compItems || []).some(item => item.label === 'Affinity 配信' && item.result === 'mismatch')), false);
});

test('两个 GP 引用同一 Sheet 时仍分别比较各自 SDF', () => {
  hydrateMaster();
  const c = catalog({ 'アフィニティカテゴリ(A)': { typeKey: 'affinity', items: [parsedItem('80001', 'Audience A', 'アフィニティカテゴリ(A)')] } });
  const settingRecord = { fields: { audienceManualRaw: '「アフィニティカテゴリ(A)」シート参照' } };
  const scoped = api.resolveYoutubeAudienceForSettingRecord(settingRecord, c);
  const ok = api.buildYoutubeAudienceComparisonItems(scoped, gpDownload('GP-1', 'GP1', 'LI1', '80001')).find(item => item.label === 'Affinity 配信');
  const mismatch = api.buildYoutubeAudienceComparisonItems(scoped, gpDownload('GP-2', 'GP2', 'LI2', '80002')).find(item => item.label === 'Affinity 配信');
  assert.equal(ok.result, 'ok');
  assert.equal(mismatch.result, 'mismatch');
  assert.deepEqual(Array.from(mismatch.missingIds), ['80001']);
  assert.deepEqual(Array.from(mismatch.extraIds), ['80002']);
});

test('Setting 无引用且 SDF 有 Audience 时判定为 Download 侧额外 mismatch', () => {
  hydrateMaster();
  const resolved = api.resolveYoutubeAudienceForSettingRecord({ fields: { audienceListRaw: '', audienceManualRaw: '' } }, catalog({}));
  const item = api.buildYoutubeAudienceComparisonItems(resolved, gpDownload('GP', 'GP1', 'LI1', '80001')).find(value => value.label === 'Affinity 配信');
  assert.equal(item.result, 'mismatch');
  assert.deepEqual(Array.from(item.extraIds), ['80001']);
});

test('011 real workbook + SDF keeps scoped Audience setting values for both target GPs', async () => {
  const outer = await JSZip.loadAsync(fs.readFileSync(case011Zip));
  const workbookEntry = Object.values(outer.files).find(entry => !entry.dir && /\.xlsx$/i.test(entry.name));
  const sdfEntry = Object.values(outer.files).find(entry => !entry.dir && /SDF\.zip$/i.test(entry.name));
  assert.ok(workbookEntry, '011 workbook exists in the real case archive');
  assert.ok(sdfEntry, '011 SDF exists in the real case archive');

  const workbook = XLSX.read(Buffer.from(await workbookEntry.async('uint8array')), {
    type: 'buffer', cellDates: true, cellStyles: true,
  });
  const sheets = Object.fromEntries(workbook.SheetNames.map(sheetName => [sheetName,
    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true })]));
  const parsedSetting = api.parseYoutubeSetting(sheets, workbook.SheetNames, workbookEntry.name, workbook.Sheets);
  const parsedDownload = api.parseSdfData(await parseSdfBuffer(await sdfEntry.async('uint8array')));

  const targetRecords = parsedSetting.gpList.flatMap(definition => (definition.references || [])
    .filter(reference => definition.name === 'VID_15s-横-MF25ｰ64歳×BP×エリア')
    .map(reference => ({
      ...definition,
      ioName: reference.ioName,
      liName: reference.liName,
      fields: { ...(definition.fields || {}), ...(reference.fields || {}) },
      audienceCatalog: reference.audienceCatalog || definition.audienceCatalog,
    })));
  assert.equal(targetRecords.length, 2);

  const reports = targetRecords.map(record => {
    const scoped = api.resolveYoutubeAudienceForSettingRecord(record, record.audienceCatalog || parsedSetting.audience);
    const settingLi = parsedSetting.liList.find(li => li.name === record.liName && li.ioName === record.ioName);
    const downloadLi = parsedDownload.liList.find(li => settingLi && li.name === settingLi.name);
    const downloadGp = parsedDownload.gpList.find(gp => gp.name === record.name
      && (!downloadLi || String(gp.liId) === String(downloadLi.id)));
    assert.ok(downloadGp, `matching SDF GP exists for ${record.liName}`);
    const affinity = api.compareGP(record, downloadGp, scoped).find(item => item.label === 'Affinity 配信');
    return { record, scoped, affinity };
  });

  assert.deepEqual(Array.from(reports, report => report.scoped.resolutionMode), [
    'type-unique-fallback', 'type-unique-fallback',
  ]);
  for (const { scoped, affinity } of reports) {
    assert.deepEqual(Array.from(scoped.referencedSheets), [
      'アフィニティカテゴリ', 'ライフイベント', '詳しいユーザー属性',
    ]);
    assert.equal(scoped.affinity.include.length, 19);
    assert.equal(scoped.lifeEvent.include.length, 6);
    assert.equal(scoped.detailedDemo.include.length, 11);
    assert.ok(affinity.sVal.includes('ビジネス'), 'Setting cell contains parsed Audience names');
    assert.ok(!affinity.sVal.includes('(設定なし)'), 'Setting cell is not rendered as empty');
  }
  assert.deepEqual(Array.from(reports, report => report.affinity.downloadIds.length), [19, 1]);
});

test('010 真实 workbook：两个 GP 行均解析到美容マス層 Sheet 且 Sheet visible=3', () => {
  const wb = XLSX.read(fs.readFileSync(case010Workbook), { type: 'buffer', cellDates: true, cellStyles: true });
  const sheets = Object.fromEntries(wb.SheetNames.map(sheetName => [sheetName,
    XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true })]));
  const parsed = api.parseYoutubeSetting(sheets, wb.SheetNames, path.basename(case010Workbook), wb.Sheets);
  const wanted = parsed.gpList.flatMap(gp => gp.references || []).filter(ref => /美容マス層/.test(ref.liName || ''));
  assert.equal(wanted.length, 2);
  for (const ref of wanted) {
    assert.equal(ref.fields.audienceListRaw, '別セグメントシート参照');
    assert.equal(ref.fields.audienceManualRaw, '「アフィニティカテゴリ(美容マス層)」シート参照');
    assert.deepEqual(Array.from(ref.fields.audienceSheetReferences), ['アフィニティカテゴリ(美容マス層)']);
  }
  const sheet = parsed.audience.bySheet['アフィニティカテゴリ(美容マス層)'];
  assert.equal(sheet.filterActive, true);
  assert.equal(sheet.visibleCount, 3);
  assert.equal(sheet.include.length, 3);
  assert.equal(sheet.exclude.length, 0);

  api.hydrateAudienceTargetMaster([
    ['93040', 'affinity', 'Category', '', 'Beauty & Wellness', 'AFFINITY', 'https://developers.google.com/google-ads/api/data/tables/affinity-categories.csv', '2026-08-09'],
    ['80546', 'in_market', 'Category', '', 'Beauty & Personal Care', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
    ['80285', 'in_market', 'Category', 'Post-Secondary Education', 'Cosmetology Education & Training', 'IN_MARKET', 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.csv', '2026-08-09'],
  ]);
  const aliasCsv = fs.readFileSync(path.join(projectRoot, 'data', 'dv360_google_audience_alias_ja.csv'), 'utf8');
  const aliasWb = XLSX.read(aliasCsv, { type: 'string' });
  const aliasRows = XLSX.utils.sheet_to_json(aliasWb.Sheets[aliasWb.SheetNames[0]], { defval: '', raw: false });
  assert.equal(api.hydrateYoutubeAudienceAliasMaster(aliasRows), 3);
  const resolvedIds = sheet.include.map(item => api.resolveYoutubeAudienceSettingItem(item, 'affinity').id).sort();
  assert.deepEqual(Array.from(resolvedIds), ['80285', '80546', '93040']);
});

test('010 production chain：real workbook + SDF → buildComparisonTree → compareGP → Affinity OK/visible', async () => {
  hydrate010AudienceMasters();
  const workbook = XLSX.read(fs.readFileSync(case010Workbook), {
    type: 'buffer', cellDates: true, cellStyles: true,
  });
  const sheets = Object.fromEntries(workbook.SheetNames.map(sheetName => [sheetName,
    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true })]));
  const parsedSetting = api.parseYoutubeSetting(
    sheets, workbook.SheetNames, path.basename(case010Workbook), workbook.Sheets,
  );
  const parsedDownload = api.parseSdfData(await parseSdfZip(path.join(path.dirname(case010Workbook), 'SDF.zip')));
  const setting = {
    cp: parsedSetting.cpList, io: parsedSetting.ioList, li: parsedSetting.liList,
    gp: parsedSetting.gpList, cr: parsedSetting.crList, audience: parsedSetting.audience,
  };
  const download = {
    cp: parsedDownload.cpList, io: parsedDownload.ioList, li: parsedDownload.liList,
    gp: parsedDownload.gpList, cr: parsedDownload.crList,
  };

  const expectedIds = ['80285', '80546', '93040'];
  const targetSettingGps = setting.gp.filter(gp => /美容マス層/.test(gp.name || ''));
  assert.equal(targetSettingGps.length, 2);
  for (const settingGp of targetSettingGps) {
    const downloadGp = download.gp.find(gp => gp.name === settingGp.name);
    assert.ok(downloadGp, `SDF GP should exist: ${settingGp.name}`);
    const scopedAudience = api.resolveYoutubeAudienceForSettingRecord(settingGp, settingGp.audienceCatalog);
    const affinity = api.compareGP(settingGp, downloadGp, scopedAudience)
      .find(item => item.label === 'Affinity 配信');
    assert.ok(affinity, `raw comparison item should exist: ${settingGp.name}`);
    assert.equal(affinity.result, 'ok');
    assert.deepEqual(Array.from(affinity.resolvedIds).sort(), expectedIds);
    assert.deepEqual(Array.from(affinity.downloadIds).sort(), expectedIds);
    assert.equal(affinity.unresolved.length, 0);
    assert.deepEqual(Array.from(affinity.missingIds), []);
    assert.deepEqual(Array.from(affinity.extraIds), []);
  }

  const tree = api.buildComparisonTree(setting, download);
  const gpNodes = [];
  const visit = node => {
    if (node.level === 'GP' && /美容マス層/.test(node.name || '')) gpNodes.push(node);
    (node.children || []).forEach(visit);
  };
  tree.roots.forEach(visit);
  assert.equal(gpNodes.length, 2);
  gpNodes.forEach(node => {
    const affinity=node.compItems.find(item => item.label === 'Affinity 配信');
    assert.ok(affinity, `${node.name}: OK Audience must remain visible`);
    assert.equal(affinity.result, 'ok');
  });
  api.setTreeRoots(tree.roots);
  assert.equal(api.getLevelColumns('GP').some(column => column.key === 'Affinity 配信'), true,
    'Affinity 配信 must appear in final visible GP columns');
});

test('TrvNonskip ↔ Non Skippable 继续使用 explicit canonical 并判定 OK', () => {
  const items = api.compareLI({ name: 'LI', fields: { videoType: 'TrvNonskip' } }, {
    name: 'LI', id: 'LI1', fields: { type: 'Non Skippable', subtype: '', status: 'Draft' },
    rawFields: { Status: 'Draft', Type: 'Non Skippable', Subtype: '' }, rawFieldOrder: ['Status', 'Type', 'Subtype'],
  });
  assert.equal(items.find(item => item.label === '動画タイプ').result, 'ok');
});
