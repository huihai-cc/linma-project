'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const fixtureRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/002';
const settingPath = path.join(fixtureRoot, '【長春依頼用】※菅更新_1020※【YouTube】26年度10-12月ピースフィット_入稿シートv3.xlsx');
const sdfPath = path.join(fixtureRoot, 'SDF 7.zip');
const hasRealCase = fs.existsSync(settingPath) && fs.existsSync(sdfPath);

function createElement() {
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: '',
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');
  const exportBlock = `
window.__youtubeGeoBusinessFix1Api = {
  parseYoutubeSetting: typeof parseYoutubeSetting === 'function' ? parseYoutubeSetting : undefined,
  parseSdfData: typeof parseSdfData === 'function' ? parseSdfData : undefined,
  parseSettingGeography: typeof parseSettingGeography === 'function' ? parseSettingGeography : undefined,
  compareGeography: typeof compareGeography === 'function' ? compareGeography : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareCR: typeof compareCR === 'function' ? compareCR : undefined,
  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === 'function' ? appendDownloadOnlyItems : undefined,
  compareLI_OTT_Base: typeof compareLI_OTT_Base === 'function' ? compareLI_OTT_Base : undefined,
  compareLI_Display_Geography: typeof compareLI_Display_Geography === 'function' ? compareLI_Display_Geography : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  ensureGeoMasterLoaded: typeof ensureGeoMasterLoaded === 'function' ? ensureGeoMasterLoaded : undefined,
  setMediaType(value) { mediaType = value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const element = createElement();
  const document = {
    body: element, documentElement: element,
    getElementById() { return element; }, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX,
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__youtubeGeoBusinessFix1Api;
}

const api = loadDv360Api();

function parseWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
  }
  return { workbook, sheets, sheetNames: workbook.SheetNames };
}

function cloneSheets(sheets) {
  return Object.fromEntries(Object.entries(sheets).map(([name, rows]) => [name, rows.map(row => [...row])]));
}

function parseSettingCase(sheets, sheetNames, worksheets) {
  return api.parseYoutubeSetting(sheets, sheetNames, path.basename(settingPath), worksheets);
}

async function parseSdfZip(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const csvFiles = [];
  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir || !filename.toLowerCase().endsWith('.csv')) continue;
    const buffer = Buffer.from(await entry.async('nodebuffer'));
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { text = new TextDecoder('shift_jis').decode(buffer); }
    const workbook = XLSX.read(text, { type: 'string' });
    if (!workbook.SheetNames.length) continue;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false });
    if (rows.length) csvFiles.push({ name: path.basename(filename), rows });
  }
  return csvFiles;
}

function findCrBusinessItem(items) {
  return items.find(item => item.label === 'ビジネス名');
}

test('地域：中点と半角中点分隔为独立地域，顺序不影响集合比较', async () => {
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const parsed = api.parseSettingGeography('埼玉県・千葉県･東京都');
  assert.deepEqual(Array.from(parsed.include), ['埼玉県', '千葉県', '東京都']);
  assert.equal(api.compareGeography('埼玉・千葉・東京', '20636;20635;20634;', '').result, 'ok');
});

test('地域：缺少/多出地域继续 mismatch，未知设定地域不能自动一致', async () => {
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  assert.equal(api.compareGeography('東京・埼玉', '20636;', '').result, 'mismatch');
  assert.equal(api.compareGeography('東京', '20636;20634;', '').result, 'mismatch');
  const unknown = api.compareGeography('架空県', '架空県', '');
  assert.equal(unknown.result, 'warning');
  assert.match(unknown.detail, /設定表未識別/);
});

test('YouTube LI 地域显示只保留已识别日文地域，且未知 Code 仍可见', async () => {
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const setting = { fields: { region: '埼玉県・千葉県' } };
  const download = { name: 'geo-test', rawFields: {}, rawFieldOrder: [], fields: {
    geographyTargeting: '20634;20635;', geographyExclude: '',
  } };
  const geo = api.compareLI(setting, download).find(item => item.label === '地域 / Geography Targeting');
  assert.equal(geo.result, 'ok');
  assert.match(geo.dVal, /配信：埼玉県・千葉県/);
  assert.match(geo.dVal, /除外：なし/);
  assert.doesNotMatch(geo.dVal, /Saitama|Chiba|Japan|Code/i);

  const unknownDownload = { ...download, fields: { geographyTargeting: 'Unknown area (Code: 999999);', geographyExclude: '' } };
  const unknownGeo = api.compareLI({ fields: { region: '東京都' } }, unknownDownload)
    .find(item => item.label === '地域 / Geography Targeting');
  assert.equal(unknownGeo.result, 'warning');
  assert.match(unknownGeo.dVal, /999999/);
});

test('地域显示优化仅作用于 YouTube LI，不改变 OTT/Display 与地域比较结果', async () => {
  await api.ensureGeoMasterLoaded();
  const setting = { fields: { region: '埼玉県・千葉県' } };
  const download = { name: 'geo-test', rawFields: {}, rawFieldOrder: [], fields: {
    geographyTargeting: '20634;20635;', geographyExclude: '',
  } };
  api.setMediaType('youtube');
  const youtube = api.compareLI(setting, download).find(item => item.label === '地域 / Geography Targeting');
  api.setMediaType('ott');
  const ottItems = api.compareLI_OTT_Base(setting, download);
  api.setMediaType('display');
  const display = api.compareLI_Display_Geography({ fields: { geography: setting.fields.region } }, {
    rawFields: { 'Geography Targeting - Include': '20634;20635;', 'Geography Targeting - Exclude': '' },
    rawFieldOrder: ['Geography Targeting - Include', 'Geography Targeting - Exclude'],
    fields: { geographyTargetingInclude: '20634;20635;', geographyTargetingExclude: '' },
  })[0];
  assert.equal(youtube.result, display.result);
  assert.doesNotMatch(youtube.dVal, /Code/i);
  assert.match(display.dVal, /Code/i);
  assert.equal(ottItems.some(item => item.label === '地域 / Geography Targeting'), false);
});

test('CR 比较增加唯一 Business Name 字段，未知设置值显示要確認并消费 SDF 字段', () => {
  api.setMediaType('youtube');
  const download = { name: 'CR', id: '1', rawFields: { 'Business Name': 'イオンリテール株式会社' },
    rawFieldOrder: ['Business Name'], fields: { videoId: '', businessName: 'イオンリテール株式会社' } };
  const own = api.compareCR({ fields: { businessName: 'イオンリテール株式会社' } }, download);
  const item = findCrBusinessItem(own);
  assert.ok(item);
  assert.equal(item.result, 'ok');
  assert.equal(item.sVal, 'イオンリテール株式会社');
  assert.equal(item.dVal, 'イオンリテール株式会社');
  assert.deepEqual(Array.from(item.sourceSdfFields), ['Business Name']);
  assert.equal(own.filter(entry => /Business Name|ビジネス名/.test(entry.label)).length, 1);
  assert.ok(api.getCoreLevelColumns('CR', true).some(column => column.key === 'ビジネス名'));

  const unknown = findCrBusinessItem(api.compareCR({ fields: {} }, download));
  assert.equal(unknown.result, 'warning');
  assert.equal(unknown.sVal, '要確認');
  const different = findCrBusinessItem(api.compareCR({ fields: { businessName: '別の会社名' } }, download));
  assert.equal(different.result, 'mismatch');
  assert.equal(api.appendDownloadOnlyItems('CR', download, own).some(entry => entry.label === 'Business Name'), false);
});

test('真实案件：七个 YouTube LI 地域按 32 / 7 / 24 / 1 完整集合一致', { skip: !hasRealCase }, async () => {
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const { workbook, sheets, sheetNames } = parseWorkbook(settingPath);
  const setting = parseSettingCase(sheets, sheetNames, workbook.Sheets);
  const sdf = api.parseSdfData(await parseSdfZip(sdfPath));
  assert.equal(setting.liList.length, 7);
  const expectedCounts = [32, 7, 24, 1, 7, 24, 1];
  for (const [index, li] of setting.liList.entries()) {
    const parsed = api.parseSettingGeography(li.fields.region, li.fields.regionReference);
    assert.equal(parsed.include.length, expectedCounts[index], `${li.name}: setting region count`);
    const download = sdf.liList.find(record => record.name === li.name);
    assert.ok(download, `SDF LI found for ${li.name}`);
    const geo = api.compareLI(li, download).find(item => item.label === '地域 / Geography Targeting');
    assert.equal(geo.result, 'ok', `${li.name}: ${geo.detail}`);
    assert.deepEqual(Array.from(geo.includeMissing), []);
    assert.deepEqual(Array.from(geo.includeExtra), []);
    const displayList = geo.dVal.split(' / 除外：')[0].replace('配信：', '').split('・');
    assert.equal(displayList.length, expectedCounts[index], `${li.name}: simplified display region count`);
    assert.deepEqual([...displayList].sort(), [...parsed.include].sort(), `${li.name}: Japanese display names`);
    assert.doesNotMatch(geo.dVal, /Japan|Code|Saitama|Chiba/i);
    assert.equal(geo.result, api.compareGeography(li.fields.region, download.fields.geographyTargeting, download.fields.geographyExclude, li.fields.regionReference).result,
      `${li.name}: display-only change must preserve comparison result`);
  }
});

test('真实案件 CR：CR行名称优先；空CR回退当前 LI 所属设置表且标题和值位置动态', { skip: !hasRealCase }, () => {
  api.setMediaType('youtube');
  const { workbook, sheets, sheetNames } = parseWorkbook(settingPath);
  const crRows = sheets['入稿物管理表（VRC・VVC・VRC(FQ))'];
  assert.ok(crRows, 'current setting sheet references this material sheet');
  const headerIndex = crRows.findIndex(row => row.some(value => String(value).includes('広告申込情報名')) && row.some(value => String(value).includes('広告名')));
  assert.ok(headerIndex >= 0);
  const header = crRows[headerIndex];
  const liCol = header.findIndex(value => String(value).includes('広告申込情報名'));
  const crCol = header.findIndex(value => String(value).includes('広告名'));
  const businessCol = header.findIndex(value => String(value).includes('ビジネスの名前'));
  assert.ok([liCol, crCol, businessCol].every(index => index >= 0));
  const targetRow = crRows.findIndex((row, index) => index > headerIndex && row[crCol] === '縦型①(肌触り)' && String(row[liCol]).includes('重点エリア'));
  assert.ok(targetRow > headerIndex);

  const operatorRows = sheets['※運用者用※設定シート'];
  const businessRow = operatorRows.find(row => row.some(value => String(value).includes('ビジネスの名前')));
  assert.ok(businessRow);
  const labelCol = businessRow.findIndex(value => String(value).includes('ビジネスの名前'));
  const originalHeader = businessRow[labelCol];
  businessRow[labelCol] = '';
  businessRow[4] = `${originalHeader}\n（別記説明）`;
  businessRow[7] = '設定表回退値株式会社';

  crRows[headerIndex][businessCol] = 'ビジネスの名前\n（CR階層優先）';
  crRows[targetRow][businessCol] = 'CR行優先値株式会社';
  let parsed = parseSettingCase(sheets, sheetNames, workbook.Sheets);
  let cr = parsed.crList.find(record => record.name === '縦型①(肌触り)' && record.lpName.includes('重点エリア'));
  assert.equal(cr.fields.businessName, 'CR行優先値株式会社');

  const fallbackSheets = cloneSheets(sheets);
  const fallbackRows = fallbackSheets['入稿物管理表（VRC・VVC・VRC(FQ))'];
  const fallbackHeaderIndex = fallbackRows.findIndex(row => row.some(value => String(value).includes('広告申込情報名')) && row.some(value => String(value).includes('広告名')));
  const fallbackHeader = fallbackRows[fallbackHeaderIndex];
  const fallbackLiCol = fallbackHeader.findIndex(value => String(value).includes('広告申込情報名'));
  const fallbackCrCol = fallbackHeader.findIndex(value => String(value).includes('広告名'));
  const fallbackBusinessCol = fallbackHeader.findIndex(value => String(value).includes('ビジネスの名前'));
  const fallbackTargetRow = fallbackRows.findIndex((row, index) => index > fallbackHeaderIndex && row[fallbackCrCol] === '縦型①(肌触り)' && String(row[fallbackLiCol]).includes('重点エリア'));
  const otherCrRow = fallbackRows.findIndex((row, index) => index > fallbackHeaderIndex && row[fallbackLiCol] === fallbackRows[fallbackTargetRow][fallbackLiCol] && row[fallbackCrCol] !== '縦型①(肌触り)');
  fallbackRows[fallbackTargetRow][fallbackBusinessCol] = '';
  if (otherCrRow > fallbackHeaderIndex) fallbackRows[otherCrRow][fallbackBusinessCol] = '別CR行の値株式会社';

  const fallbackOperatorRows = fallbackSheets['※運用者用※設定シート'];
  const fallbackBusinessRow = fallbackOperatorRows.find(row => row.some(value => String(value).includes('ビジネスの名前')));
  const fallbackLabelCol = fallbackBusinessRow.findIndex(value => String(value).includes('ビジネスの名前'));
  const fallbackLabel = fallbackBusinessRow[fallbackLabelCol];
  fallbackBusinessRow[fallbackLabelCol] = '';
  fallbackBusinessRow[4] = `${fallbackLabel}\n（動的タイトル）`;
  fallbackBusinessRow[7] = '設定表回退値株式会社';

  parsed = parseSettingCase(fallbackSheets, sheetNames, workbook.Sheets);
  cr = parsed.crList.find(record => record.name === '縦型①(肌触り)' && record.lpName.includes('重点エリア'));
  assert.equal(cr.fields.businessName, '設定表回退値株式会社');
});

test('真实案件：SDF Business Name 与当前 CR 的最终设置值一致且不重复展示', { skip: !hasRealCase }, async () => {
  api.setMediaType('youtube');
  const { workbook, sheets, sheetNames } = parseWorkbook(settingPath);
  const setting = parseSettingCase(sheets, sheetNames, workbook.Sheets);
  const sdf = api.parseSdfData(await parseSdfZip(sdfPath));
  assert.equal(setting.crList.length, 32);
  assert.equal(sdf.crList.length, 32);
  for (const cr of setting.crList) {
    const download = sdf.crList.find(record => record.name === cr.name && record.gpName === cr.gpName);
    assert.ok(download, `SDF CR found for ${cr.name} / ${cr.gpName}`);
    const item = findCrBusinessItem(api.compareCR(cr, download));
    assert.ok(item, 'Business Name is a core CR comparison field');
    assert.equal(item.result, 'ok', `${cr.name}: ${item.sVal} vs ${item.dVal}`);
    assert.equal(item.sVal, 'イオンリテール株式会社');
    assert.equal(item.dVal, 'イオンリテール株式会社');
    assert.equal(item.sourceSdfFields.includes('Business Name'), true);
  }
});
