// YouTube 012 regression: LI Daypart inherited by IO, long-flight end time,
// Geography country-prefix tokens, and open-ended GP age ranges.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

function loadApi() {
  const scripts = [...rawHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');
  const exportBlock = `
window.__youtube012 = {
  setMediaType(value) { mediaType = value; },
  parseYoutubeSetting: typeof parseYoutubeSetting === 'function' ? parseYoutubeSetting : undefined,
  parseSdfData: typeof parseSdfData === 'function' ? parseSdfData : undefined,
  buildComparisonTree: typeof buildComparisonTree === 'function' ? buildComparisonTree : undefined,
  resolveIoLiDaypart: typeof resolveIoLiDaypart === 'function' ? resolveIoLiDaypart : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  ensureGeoMasterLoaded: typeof ensureGeoMasterLoaded === 'function' ? ensureGeoMasterLoaded : undefined,
  compareGeography: typeof compareGeography === 'function' ? compareGeography : undefined,
  getDemographicExpectedTokens: typeof getDemographicExpectedTokens === 'function' ? getDemographicExpectedTokens : undefined,
  compareAgeDemographicTargeting: typeof compareAgeDemographicTargeting === 'function' ? compareAgeDemographicTargeting : undefined,
};`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const makeElement = () => ({ addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, contains() { return false; } }, closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '', querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {}, style: { setProperty() {} }, textContent: '', value: 'initial' });
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document: { body: makeElement(), documentElement: makeElement(), getElementById() { return makeElement(); }, querySelector() { return null; }, querySelectorAll() { return []; } },
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__youtube012;
}

const api = loadApi();

function sdfIo(id, name, overrides = {}) {
  return { id, name, fields: { budgetSegments: '(08/17/2026 00:00;08/30/2026 11:59;100000;)', ...overrides } };
}
function sdfLi(ioId, name, daypart = '300096;310096;320096;330096;340096;350096;360096;', timeZone = 'Asia/Tokyo') {
  return { ioId, ioName: 'IO-012', name, fields: { daypartTargeting: daypart, daypartTimeZone: timeZone } };
}
function settingIo(overrides = {}) {
  return { fields: { ioType: '', goal: '', budget: '100000', startDate: '2026/08/17', endDate: '2026/08/30', startTime: '00:00', endTime: '23:59', pacing: '', pacingRate: '', kpi: '', kpiVal: '', fq: '', ...overrides } };
}

function readCsvRows(filePath) {
  const bytes = fs.readFileSync(filePath);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder('shift_jis').decode(bytes); }
  const workbook = XLSX.read(text, { type: 'string' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false });
}

function readYoutubeSetting(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true, cellStyles: true });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  }
  return api.parseYoutubeSetting(sheets, workbook.SheetNames, path.basename(filePath), workbook.Sheets);
}

function flattenNodes(roots) {
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.children || []) visit(child); };
  for (const root of roots || []) visit(root);
  return nodes;
}

test('012 IO: child LI Daypart is the formal IO time source, not Budget Segments time', () => {
  api.setMediaType('youtube');
  assert.equal(typeof api.resolveIoLiDaypart, 'function');
  const io = sdfIo('io-012', 'IO-012');
  io.resolvedLiDaypart = api.resolveIoLiDaypart(io, [sdfLi('io-012', 'LI-012')]);
  const items = api.compareIO(settingIo(), io);
  const start = items.find(item => item.label === '開始時間');
  const end = items.find(item => item.label === '終了時間');
  assert.equal(io.resolvedLiDaypart.status, 'resolved');
  assert.equal(start.dVal, '00:00 (Asia/Tokyo)');
  assert.equal(start.result, 'ok');
  assert.equal(end.dVal, '23:59 (Asia/Tokyo)');
  assert.equal(end.result, 'ok');
});

test('012 IO: conflicting child LI Daypart gives an explicit warning and does not pick one', () => {
  api.setMediaType('youtube');
  const io = sdfIo('io-012', 'IO-012');
  io.resolvedLiDaypart = api.resolveIoLiDaypart(io, [
    sdfLi('io-012', 'LI-A'),
    sdfLi('io-012', 'LI-B', '304096;314096;324096;334096;344096;354096;364096;'),
  ]);
  const time = api.compareIO(settingIo(), io).find(item => item.label === '開始時間');
  assert.equal(io.resolvedLiDaypart.status, 'conflict');
  assert.equal(time.result, 'warning');
  assert.equal(time.detail, '同一IO配下のLIでDaypartが一致していません');
});

function longFlightEndItem(mediaType, settingEnd, downloadEnd) {
  api.setMediaType(mediaType);
  const io = sdfIo('io-012', 'IO-012');
  io.resolvedLiDaypart = { status: 'resolved', startTime: '00:00', endTime: downloadEnd, timeZone: 'Asia/Tokyo', liNames: ['LI-012'] };
  return api.compareIO(settingIo({ endTime: settingEnd }), io).find(item => item.label === '終了時間');
}

test('long-flight IO end time grades platform-correct download separately from an invalid setting sheet', () => {
  for (const mediaType of ['youtube', 'ott', 'display']) {
    // Case 1: 設定表だけが不正、ダウンロードは正しい → warning。
    const settingInvalid = longFlightEndItem(mediaType, '11:59', '23:59');
    assert.equal(settingInvalid.result, 'warning', mediaType);
    assert.equal(settingInvalid.detail, '掲載期間が7日を超えるため、設定表の終了時間指定は無効です。ダウンロードの23:59は正しい設定です。');
    // Case 2/3: 設定表の空欄・23:59 と正しいダウンロード → ok。
    assert.equal(longFlightEndItem(mediaType, '23:59', '23:59').result, 'ok', mediaType);
    assert.equal(longFlightEndItem(mediaType, '', '23:59').result, 'ok', mediaType);
    // Case 4/5: S/D が同じでも、ダウンロード自体が不正なら mismatch。
    const downloadInvalid = longFlightEndItem(mediaType, '11:59', '11:59');
    assert.equal(downloadInvalid.result, 'mismatch', mediaType);
    assert.equal(downloadInvalid.detail, '掲載期間が7日を超えるため、終了時間は23:59である必要があります。');
    assert.equal(longFlightEndItem(mediaType, '23:59', '11:59').result, 'mismatch', mediaType);
  }
});

test('012 IO: 17th through 23rd remains under the existing end-time comparison rule', () => {
  api.setMediaType('youtube');
  const io = sdfIo('io-012', 'IO-012', { budgetSegments: '(08/17/2026 00:00;08/23/2026 11:59;100000;)' });
  io.resolvedLiDaypart = api.resolveIoLiDaypart(io, [sdfLi('io-012', 'LI-012', '300048;310048;320048;330048;340048;350048;360048;')]);
  const time = api.compareIO(settingIo({ endDate: '2026/08/23', endTime: '12:00' }), io).find(item => item.label === '終了時間');
  assert.equal(time.result, 'ok');
});

test('012 Geography: Japan-prefixed prefectures resolve exactly through the GEO master', async () => {
  assert.equal(await api.ensureGeoMasterLoaded(), true);
  assert.equal(api.compareGeography('配信：Japan / 除外：Japan熊本県', '2392;', '20666;').result, 'ok');
  assert.equal(api.compareGeography('配信：日本 / 除外：日本熊本県', '2392;', '20666;').result, 'ok');
  assert.equal(api.compareGeography('Japan埼玉県', '20634;', '').result, 'ok');
  assert.equal(api.compareGeography('Japan', '2392;', '').result, 'ok');
});

test('012 GP age: 18+ includes every age bucket and Unknown when requested', () => {
  const forms = ['18歳～', '18歳以上', '18～', '18以上', '18歳～ / 以上すべて', '65歳以上'];
  for (const form of forms) {
    const expected = api.getDemographicExpectedTokens(form, 'age').tokens;
    assert.ok(expected.includes('65+'), form);
  }
  const matched = api.compareAgeDemographicTargeting(
    '18歳～ / 以上すべて', '不明あり',
    '18-24;25-34;35-44;45-54;55-64;65+;Unknown;', 'mismatch');
  assert.equal(matched.result, 'ok');
  assert.equal(api.getDemographicExpectedTokens('～34歳', 'age').tokens.join(';'), '18-24;25-34');
  assert.equal(api.getDemographicExpectedTokens('25～54', 'age').tokens.join(';'), '25-34;35-44;45-54');
});

test('012 real case: IO, LI Geography, and GP age use the corrected rules', async t => {
  const caseRoot = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\Youtube\\012';
  if (!fs.existsSync(caseRoot)) t.skip('012 local regression case is unavailable');
  api.setMediaType('youtube');
  await api.ensureGeoMasterLoaded();
  const settingPath = fs.readdirSync(caseRoot)
    .map(name => path.join(caseRoot, name))
    .find(filePath => /\.xlsx$/i.test(filePath) && !path.basename(filePath).startsWith('~$'));
  const sdfRoot = path.join(caseRoot, 'SDF (1)');
  const setting = readYoutubeSetting(settingPath);
  const download = api.parseSdfData(fs.readdirSync(sdfRoot)
    .filter(name => /\.csv$/i.test(name))
    .map(name => ({ name, rows: readCsvRows(path.join(sdfRoot, name)) })));
  const comparison = api.buildComparisonTree(
    { cp: setting.cpList, io: setting.ioList, li: setting.liList, gp: setting.gpList, cr: setting.crList, audience: setting.audience },
    { cp: download.cpList, io: download.ioList, li: download.liList, gp: download.gpList, cr: download.crList },
  );
  const nodes = flattenNodes(comparison.roots);
  const io = nodes.find(node => node.level === 'IO' && node.found);
  const li = nodes.find(node => node.level === 'LI' && node.found);
  const gp = nodes.find(node => node.level === 'GP' && node.found);
  const ioStart = io.compItems.find(item => item.label === '開始時間');
  const ioEnd = io.compItems.find(item => item.label === '終了時間');
  assert.equal(ioStart.dVal, '10:00 (Advertiser)');
  assert.equal(ioEnd.dVal, '23:59 (Advertiser)');
  assert.equal(ioEnd.result, 'mismatch');
  assert.equal(li.compItems.find(item => item.label === '地域 / Geography Targeting').result, 'ok');
  assert.equal(gp.compItems.find(item => item.label === '年齢').result, 'ok');
});
