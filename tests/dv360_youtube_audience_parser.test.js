'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const case011Workbook = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube\\011\\011-selected\\v2_260803_TrueView【設定シート】SCSK_FY2608.xlsx';

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
window.__dv360TestApi = {
  youtubeAudienceStyleSignature,
  isYoutubeAudienceExcludeRed,
  classifyYoutubeAudienceVisibleRow,
  parseYoutubeAudienceSheets,
  parseYoutubeSetting,
  YOUTUBE_AUDIENCE_SDF_FIELDS,
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
  return sandbox.__dv360TestApi;
}

const api = loadDv360Api();

const yellowStyle = { patternType: 'solid', fgColor: { rgb: 'FFFF00' }, bgColor: { indexed: 64 } };
const noFillStyle = {};
const otherStyle = { patternType: 'solid', fgColor: { rgb: '00B050' }, bgColor: { indexed: 64 } };
const syntheticConfirmedRedStyle = { patternType: 'solid', fgColor: { rgb: 'C00000' }, bgColor: { indexed: 64 } };
const confirmedRedSignatures = [api.youtubeAudienceStyleSignature(syntheticConfirmedRedStyle)];

function makeWorksheet(rows, { effectiveFilter = true, includeAutoFilter = true } = {}) {
  const dataRowCount = rows.length + (effectiveFilter ? 1 : 0);
  const ws = {
    '!ref': `A1:B${dataRowCount + 5}`,
    '!rows': [],
    A5: { t: 's', v: 'NO' },
    B5: { t: 's', v: 'セグメント名' },
  };
  if (includeAutoFilter) ws['!autofilter'] = { ref: `A5:B${dataRowCount + 5}` };
  rows.forEach((row, index) => {
    const rowNumber = index + 6;
    ws[`A${rowNumber}`] = { t: 'n', v: index + 1, s: row.style, styleId: row.styleId ?? index + 10 };
    ws[`B${rowNumber}`] = { t: 's', v: row.name, s: row.style, styleId: row.styleId ?? index + 10 };
    if (row.hidden) ws['!rows'][rowNumber - 1] = { hidden: true };
  });
  // 有効な保存済み漏斗を表現する未選択 master 行。色は選択判定に使わず、hidden なので必ず無視される。
  if (effectiveFilter) {
    const rowNumber = rows.length + 6;
    ws[`A${rowNumber}`] = { t: 'n', v: 999999 };
    ws[`B${rowNumber}`] = { t: 's', v: '未選択 master 行', s: noFillStyle };
    ws['!rows'][rowNumber - 1] = { hidden: true };
  }
  return ws;
}

function parseAffinity(rows) {
  return api.parseYoutubeAudienceSheets(
    { 'アフィニティカテゴリ': makeWorksheet(rows) },
    ['アフィニティカテゴリ'],
    { confirmedExcludeStyleSignatures: confirmedRedSignatures },
  ).affinity;
}

test('Filter 1: 可见黄色行进入 Include', () => {
  const result = parseAffinity([{ name: 'A 黄色', style: yellowStyle }]);
  assert.deepEqual(Array.from(result.include, item => item.name), ['A 黄色']);
  assert.equal(result.exclude.length, 0);
});

test('Filter 2: 可见无填充行默认进入 Include', () => {
  const result = parseAffinity([{ name: 'B 无色', style: noFillStyle }]);
  assert.deepEqual(Array.from(result.include, item => item.name), ['B 无色']);
  assert.equal(result.exclude.length, 0);
});

test('Filter 3: 可见其他非红行进入 Include', () => {
  const result = parseAffinity([{ name: 'C 其他色', style: otherStyle }]);
  assert.deepEqual(Array.from(result.include, item => item.name), ['C 其他色']);
  assert.equal(result.exclude.length, 0);
});

test('Filter 4: 可见且样式已被真实样本确认红色时进入 Exclude', () => {
  const result = parseAffinity([{ name: 'D 红色', style: syntheticConfirmedRedStyle, styleId: 77 }]);
  assert.deepEqual(Array.from(result.exclude, item => item.name), ['D 红色']);
  assert.equal(result.include.length, 0);
  assert.equal(result.exclude[0].bucket, 'exclude');
  assert.equal(result.exclude[0].styleId, 77);
});

test('Filter 5: 隐藏黄色行被忽略', () => {
  const result = parseAffinity([{ name: 'E 隐藏黄色', style: yellowStyle, hidden: true }]);
  assert.equal(result.include.length, 0);
  assert.equal(result.exclude.length, 0);
});

test('Filter 6: 隐藏红色行被忽略', () => {
  const result = parseAffinity([{ name: 'F 隐藏红色', style: syntheticConfirmedRedStyle, hidden: true }]);
  assert.equal(result.include.length, 0);
  assert.equal(result.exclude.length, 0);
});

test('Filter 7: 隐藏无填充行被忽略', () => {
  const result = parseAffinity([{ name: 'G 隐藏无色', style: noFillStyle, hidden: true }]);
  assert.equal(result.include.length, 0);
  assert.equal(result.exclude.length, 0);
});

test('混合筛选结果只保留可见行，再按已确认红色分类', () => {
  const result = parseAffinity([
    { name: 'A 黄色', style: yellowStyle },
    { name: 'B 无色', style: noFillStyle },
    { name: 'C 红色', style: syntheticConfirmedRedStyle },
    { name: 'D 黄色 hidden', style: yellowStyle, hidden: true },
    { name: 'E 红色 hidden', style: syntheticConfirmedRedStyle, hidden: true },
  ]);
  assert.deepEqual(Array.from(result.include, item => item.name), ['A 黄色', 'B 无色']);
  assert.deepEqual(Array.from(result.exclude, item => item.name), ['C 红色']);
});

test('红色样式尚未取得真实样本时不猜 RGB，visible non-red 仍进入 Include', () => {
  const result = api.parseYoutubeAudienceSheets(
    { 'アフィニティカテゴリ': makeWorksheet([{ name: '未确认红色', style: syntheticConfirmedRedStyle }]) },
    ['アフィニティカテゴリ'],
  ).affinity;
  assert.deepEqual(Array.from(result.include, item => item.name), ['未确认红色']);
  assert.equal(result.exclude.length, 0);
});

test('三类 SDF 字段映射保持 Include / Exclude', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.YOUTUBE_AUDIENCE_SDF_FIELDS)), {
    affinity: {
      include: 'Affinity & In Market Targeting - Include',
      exclude: 'Affinity & In Market Targeting - Exclude',
    },
    lifeEvent: {
      include: 'Life Event Targeting - Include',
      exclude: 'Life Event Targeting - Exclude',
    },
    detailedDemo: {
      include: 'Detailed Demo Targeting - Include',
      exclude: 'Detailed Demo Targeting - Exclude',
    },
  });
});

test('AutoFilter が存在しても全データ行が可視なら有効な漏斗ではなく Audience は空', () => {
  const result = api.parseYoutubeAudienceSheets(
    { 'アフィニティカテゴリ': makeWorksheet([{ name: 'master 全件可視', style: yellowStyle }], { effectiveFilter: false }) },
    ['アフィニティカテゴリ'],
  ).affinity;
  assert.equal(result.include.length, 0);
  assert.equal(result.exclude.length, 0);
});

test('AutoFilter 自体が保存されていない場合も Audience は空', () => {
  const result = api.parseYoutubeAudienceSheets(
    { 'アフィニティカテゴリ': makeWorksheet([{ name: 'filter なし', style: yellowStyle }], { effectiveFilter: false, includeAutoFilter: false }) },
    ['アフィニティカテゴリ'],
  ).affinity;
  assert.equal(result.include.length, 0);
  assert.equal(result.exclude.length, 0);
});

test('011 真实 workbook：只解析保存状态中的可见行，当前全部为 Include', () => {
  const wb = XLSX.read(fs.readFileSync(case011Workbook), { type: 'buffer', cellStyles: true, cellNF: true });
  const result = api.parseYoutubeAudienceSheets(wb.Sheets, wb.SheetNames);
  assert.equal(result.affinity.include.length, 19);
  assert.equal(result.lifeEvent.include.length, 6);
  assert.equal(result.detailedDemo.include.length, 11);
  assert.equal(result.affinity.exclude.length, 0);
  assert.equal(result.lifeEvent.exclude.length, 0);
  assert.equal(result.detailedDemo.exclude.length, 0);
  for (const item of [...result.affinity.include, ...result.lifeEvent.include, ...result.detailedDemo.include]) {
    assert.equal(item.visible, true);
    assert.equal(item.bucket, 'include');
    assert.ok(item.sourceSheet);
    assert.ok(item.sourceRow >= 6);
    assert.ok(item.styleId !== undefined);
    assert.ok(item.fill && typeof item.fill === 'object');
  }
});

test('YouTube setting 上传链路保留 raw worksheet，并公开 Audience 诊断结果', () => {
  const sheetName = 'アフィニティカテゴリ';
  const worksheet = makeWorksheet([
    { name: '链路可见无色', style: noFillStyle },
    { name: '链路隐藏黄色', style: yellowStyle, hidden: true },
  ]);
  const result = api.parseYoutubeSetting(
    { [sheetName]: [] },
    [sheetName],
    'audience-fixture.xlsx',
    { [sheetName]: worksheet },
  );
  assert.deepEqual(Array.from(result.audience.affinity.include, item => item.name), ['链路可见无色']);
  assert.equal(result.audience.affinity.exclude.length, 0);
});
