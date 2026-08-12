// OTT Tree Builder Test (Phase2)
// 検証: buildComparisonTree — OTTの4層構造（GPなし）
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

function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadDv360Api(options = {}) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = '\n' +
'window.__ottTreeApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseSdfData: typeof parseSdfData === "function" ? parseSdfData : undefined,\n' +
'  buildComparisonTree: typeof buildComparisonTree === "function" ? buildComparisonTree : undefined,\n' +
'  updateNodeStatus: typeof updateNodeStatus === "function" ? updateNodeStatus : undefined,\n' +
'  getLevelColumns: typeof getLevelColumns === "function" ? getLevelColumns : undefined,\n' +
'  getVisibleLevels: typeof getVisibleLevels === "function" ? getVisibleLevels : undefined,\n' +
'  fmtDateVal: typeof fmtDateVal === "function" ? fmtDateVal : undefined,\n' +
'  normDate: typeof normDate === "function" ? normDate : undefined,\n' +
'  excelSerialToUtcDateParts: typeof excelSerialToUtcDateParts === "function" ? excelSerialToUtcDateParts : undefined,\n' +
'  detectAndDecodeCSV: typeof detectAndDecodeCSV === "function" ? detectAndDecodeCSV : undefined,\n' +
'  getEffectiveMediaType: typeof getEffectiveMediaType === "function" ? getEffectiveMediaType : undefined,\n' +
'  setSelectedMediaType: function(value) { selectedMediaType = value; },\n' +
'  setTreeRoots: function(v) { treeRoots = v; },\n' +
'  setMediaType: function(v) { mediaType = v; },\n' +
'  getMediaType: function() { return mediaType; },\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === "function" ? setSelectedDv360CaseType : undefined,\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
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
    Blob, DecompressionStream: globalThis.DecompressionStream,
    FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  if (options.encodingAvailable !== false) sandbox.Encoding = {};
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  sandbox.__ottTreeApi.__getElement = id => elements.get(id) || null;
  return sandbox.__ottTreeApi;
}

function parseWorkbook(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sname of wb.SheetNames) {
    sheets[sname] = XLSX.utils.sheet_to_json(wb.Sheets[sname], { header: 1, defval: '', raw: false });
  }
  return { sheets, sheetNames: wb.SheetNames };
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

const api = loadDv360Api();

// ── テスト ──

test('OTT tree builder functions exported', () => {
  assert.ok(typeof api.parseOttSetting === 'function', 'parseOttSetting');
  assert.ok(typeof api.parseSdfData === 'function', 'parseSdfData');
  assert.ok(typeof api.buildComparisonTree === 'function', 'buildComparisonTree');
});

test('media level tabs expose the intended hierarchy for each manual media selection', () => {
  assert.equal(typeof api.getVisibleLevels, 'function');
  for (const [mediaType, expected] of [
    ['youtube', ['CP', 'IO', 'LI', 'GP', 'CR']],
    ['ott', ['CP', 'IO', 'LI']],
    ['display', ['CP', 'IO', 'LI']],
  ]) {
    api.setMediaType(mediaType);
    assert.deepEqual(Array.from(api.getVisibleLevels()), expected, mediaType);
  }
});

test('automatic detection is used in auto mode and a manual media selection takes priority', () => {
  api.setSelectedMediaType('auto');
  assert.equal(api.getEffectiveMediaType('display'), 'display');
  api.setSelectedMediaType('ott');
  assert.equal(api.getEffectiveMediaType('youtube'), 'ott');
});

test('Excel serial dates use one UTC calendar-date conversion in display and normalization', () => {
  assert.equal(typeof api.excelSerialToUtcDateParts, 'function');
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.excelSerialToUtcDateParts(45292))),
    { year: 2024, month: 1, day: 1 },
  );
  assert.equal(api.fmtDateVal(45292), '2024/1/1');
  assert.equal(api.normDate(45292), '2024-01-01');
  assert.equal(api.fmtDateVal('01/02/2024'), '01/02/2024');
  assert.equal(api.normDate('01/02/2024'), '2024-01-02');
});

test('missing Encoding keeps UTF-8 CSV usable and shows a user-visible fallback warning', () => {
  const fallbackApi = loadDv360Api({ encodingAvailable: false });
  const csv = new TextEncoder().encode('Campaign Id,Name\n1,UTF-8案件');
  assert.equal(fallbackApi.detectAndDecodeCSV(csv), 'Campaign Id,Name\n1,UTF-8案件');
  const warning = fallbackApi.__getElement('encoding-warning');
  assert.ok(warning, 'fallback warning element should be rendered');
  assert.equal(warning.style.display, 'block');
  assert.match(warning.textContent, /UTF-8/i);
});

test('loaded Encoding does not show the fallback warning', () => {
  const warning = api.__getElement('encoding-warning');
  assert.ok(!warning || warning.style.display !== 'block');
});

// ═══════════════════════════════════════════
// Case 001: OTT tree 4-level structure
// ═══════════════════════════════════════════
test('Case 001: OTT tree has CP/IO/LI only (no GP or CR)', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  // Set mediaType to ott
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  // Parse setting
  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const settingRaw = api.parseOttSetting(sheets, sheetNames, xf);
  const setting = { cp: settingRaw.cpList, io: settingRaw.ioList, li: settingRaw.liList, gp: settingRaw.gpList, cr: settingRaw.crList };

  // Parse SDF
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const downloadRaw = api.parseSdfData(csvFiles);
  const download = { cp: downloadRaw.cpList, io: downloadRaw.ioList, li: downloadRaw.liList, gp: downloadRaw.gpList, cr: downloadRaw.crList };

  // Build tree
  const result = api.buildComparisonTree(setting, download);
  api.setTreeRoots(result.roots);

  assert.ok(result.roots.length > 0, 'should have root nodes');
  assert.equal(result.counts.gp, 0, 'setting GP count must be 0');
  assert.equal(result.mediaType, 'ott', 'mediaType should be ott');

  // Verify NO GP nodes exist in tree
  function collectNodes(node, nodes) {
    nodes.push(node);
    node.children.forEach(c => collectNodes(c, nodes));
  }
  const allNodes = [];
  result.roots.forEach(r => collectNodes(r, allNodes));
  const gpNodes = allNodes.filter(n => n.level === 'GP');
  assert.equal(gpNodes.length, 0, 'no GP nodes should exist in OTT tree');

  // OTT/Display は CR 比較対象外（2026-08-07）: CR ノードが一切存在しない
  const crNodes = allNodes.filter(n => n.level === 'CR');
  assert.equal(crNodes.length, 0, 'OTT CR nodes must not enter the tree or issue summary');
  // LI は葉ノード（子を持たない）
  const liNodes = allNodes.filter(n => n.level === 'LI');
  for (const li of liNodes) {
    assert.equal(li.children.length, 0, 'OTT LI must not have CR children');
    const targetBidItem = li.compItems.find(item => item.label === '目標単価の有無');
    assert.equal(targetBidItem, undefined,
      '未指定の目標単価 item は tree に残さない: ' + JSON.stringify(targetBidItem));
  }
  const liColumnKeys = Array.from(api.getLevelColumns('LI'), column => column.key);
  assert.equal(liColumnKeys.includes('目標単価の有無'), false,
    '全 LI が未指定なら目標単価の空列も残さない');

  // Verify no GP in SDF-only nodes
  const gpSdfOnly = allNodes.filter(n => n.level === 'GP' && n.fromSdf);
  assert.equal(gpSdfOnly.length, 0, 'no GP SDF-only nodes in OTT tree');
});

test('OTT CR records never enter the comparison tree', () => {
  api.setMediaType('ott');
  const setting = {
    cp: [{ name: 'CP-1', fields: {} }],
    io: [{ name: 'IO-1', cpName: 'CP-1', fields: {} }],
    li: [{ name: 'LI-1', ioName: 'IO-1', fields: {} }],
    gp: [],
    cr: [{ name: 'CR-1', liName: 'LI-1', fields: {
      changedName: 'CR-1', creativeFile: 'creative.mp4', clickUrl: 'https://example.test',
      startDate: '2026/01/01', endDate: '2026/01/31',
    } }],
  };
  const download = {
    cp: [{ name: 'CP-1', id: 'cp-1', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    io: [{ name: 'IO-1', id: 'io-1', cpId: 'cp-1', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    li: [{ name: 'LI-1', id: 'li-1', ioId: 'io-1', fields: {}, rawFields: {}, rawFieldOrder: [] }],
    gp: [],
    cr: [{ name: 'CR-1', id: 'cr-1', fields: {
      name: 'CR-1', landingPageUrl: 'https://example.test', startDate: '2026/01/01', endDate: '2026/01/31',
    }, rawFields: {}, rawFieldOrder: [] }],
  };
  const tree = api.buildComparisonTree(setting, download);
  const cr = tree.roots[0].children[0].children[0].children.find(node => node.level === 'CR');
  assert.equal(cr, undefined, 'an exact OTT CR match must not create a comparison node');
});

test('Case 001: counts reflect 4-level structure', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const settingRaw = api.parseOttSetting(sheets, sheetNames, xf);
  const setting = { cp: settingRaw.cpList, io: settingRaw.ioList, li: settingRaw.liList, gp: settingRaw.gpList, cr: settingRaw.crList };
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const downloadRaw = api.parseSdfData(csvFiles);
  const download = { cp: downloadRaw.cpList, io: downloadRaw.ioList, li: downloadRaw.liList, gp: downloadRaw.gpList, cr: downloadRaw.crList };
  const result = api.buildComparisonTree(setting, download);

  assert.equal(result.counts.gp, 0, 'gp=0');
  assert.ok(result.counts.cp >= 1, 'cp>=1');
  assert.ok(result.counts.cr >= 1, 'source CR data may remain parsed but must not be rendered');
  // SDF side should still have data (for informational purposes)
  assert.ok(result.counts.dgp >= 0, 'dgp count present');
});

// ═══════════════════════════════════════════
// Case 003: Minimal case
// ═══════════════════════════════════════════
test('Case 003: OTT tree no GP', async () => {
  const dir = path.join(ottRoot, '003');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const settingRaw = api.parseOttSetting(sheets, sheetNames, xf);
  const setting = { cp: settingRaw.cpList, io: settingRaw.ioList, li: settingRaw.liList, gp: settingRaw.gpList, cr: settingRaw.crList };
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const downloadRaw = api.parseSdfData(csvFiles);
  const download = { cp: downloadRaw.cpList, io: downloadRaw.ioList, li: downloadRaw.liList, gp: downloadRaw.gpList, cr: downloadRaw.crList };
  const result = api.buildComparisonTree(setting, download);

  assert.equal(result.counts.gp, 0, 'gp=0 for case 003');

  const allNodes = [];
  function collectNodes(node, nodes) {
    nodes.push(node);
    node.children.forEach(c => collectNodes(c, nodes));
  }
  result.roots.forEach(r => collectNodes(r, allNodes));
  assert.equal(allNodes.filter(n => n.level === 'GP').length, 0, 'no GP nodes');
});

// ═══════════════════════════════════════════
// All OTT cases: no GP in tree
// ═══════════════════════════════════════════
test('All OTT cases: tree has no GP nodes', async () => {
  for (const c of ['001', '003', '004', '005']) {
    const dir = path.join(ottRoot, c);
    const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
    if (!xf || !zf) continue;

    // Skip case 002 (XLSX unreadable)
    const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
    if (sheetNames.length === 0) continue;

    api.setMediaType('ott');
    if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

    const settingRaw = api.parseOttSetting(sheets, sheetNames, xf);
  const setting = { cp: settingRaw.cpList, io: settingRaw.ioList, li: settingRaw.liList, gp: settingRaw.gpList, cr: settingRaw.crList };
    const csvFiles = await parseSdfZip(path.join(dir, zf));
    const downloadRaw = api.parseSdfData(csvFiles);
  const download = { cp: downloadRaw.cpList, io: downloadRaw.ioList, li: downloadRaw.liList, gp: downloadRaw.gpList, cr: downloadRaw.crList };
    const result = api.buildComparisonTree(setting, download);

    assert.equal(result.counts.gp, 0, 'Case ' + c + ': gp count = 0');

    const allNodes = [];
    function collectNodes(node, nodes) {
      nodes.push(node);
      node.children.forEach(ch => collectNodes(ch, nodes));
    }
    result.roots.forEach(r => collectNodes(r, allNodes));
    const gpNodes = allNodes.filter(n => n.level === 'GP');
    assert.equal(gpNodes.length, 0, 'Case ' + c + ': no GP nodes in tree');

    // Verify tree has 4 levels max (CP→IO→LI→CR)
    const levels = new Set(allNodes.map(n => n.level));
    assert.ok(!levels.has('GP'), 'Case ' + c + ': GP level absent');
  }
});

// ═══════════════════════════════════════════
// OTT: CR children of LI (not GP)
// ═══════════════════════════════════════════
test('Case 001: OTT tree renders neither CR nor GP nodes', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));

  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
  const settingRaw = api.parseOttSetting(sheets, sheetNames, xf);
  const setting = { cp: settingRaw.cpList, io: settingRaw.ioList, li: settingRaw.liList, gp: settingRaw.gpList, cr: settingRaw.crList };
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const downloadRaw = api.parseSdfData(csvFiles);
  const download = { cp: downloadRaw.cpList, io: downloadRaw.ioList, li: downloadRaw.liList, gp: downloadRaw.gpList, cr: downloadRaw.crList };
  const result = api.buildComparisonTree(setting, download);

  // 全ノード走査して、CR は表示しつつ GP は生成しないことを検証
  function collectNodes(node, nodes) {
    nodes.push(node);
    node.children.forEach(c => collectNodes(c, nodes));
  }
  const allNodes = [];
  result.roots.forEach(r => collectNodes(r, allNodes));
  const crNodes = allNodes.filter(n => n.level === 'CR');
  assert.equal(crNodes.length, 0, 'CR nodes must be absent from the OTT tree');
  assert.equal(allNodes.filter(n => n.level === 'GP').length, 0, 'GP must remain absent');
});

// ═══════════════════════════════════════════
// YouTube non-regression: GP still exists
// ═══════════════════════════════════════════
test('YouTube: GP layer preserved (non-regression)', () => {
  api.setMediaType('youtube');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  // Create minimal YouTube-style data
  const setting = {
    cp: [{ name: 'Test CP', fields: {} }],
    io: [{ name: 'Test IO', cpName: 'Test CP', fields: {} }],
    li: [{ name: 'Test LI', ioName: 'Test IO', fields: {} }],
    gp: [{ name: 'Test GP', liName: 'Test LI', fields: {} }],
    cr: [{ name: 'Test CR', gpName: 'Test GP', lpName: 'Test LI', fields: {} }],
  };
  const download = {
    cp: [{ name: 'Test CP', id: 'cp1', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
    io: [{ name: 'Test IO', id: 'io1', cpId: 'cp1', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active', budgetSegments: '' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
    li: [{ name: 'Test LI', id: 'li1', ioId: 'io1', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
    gp: [{ name: 'Test GP', id: 'gp1', liId: 'li1', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active', videoAdFormat: 'Responsive', bidCost: '100' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
    cr: [{ name: 'Test CR', id: 'cr1', gpId: 'gp1', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active', adType: 'Responsive', videoId: '' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
  };

  const result = api.buildComparisonTree(setting, download);

  // YouTube tree must have GP nodes
  const allNodes = [];
  function collectNodes(node, nodes) {
    nodes.push(node);
    node.children.forEach(c => collectNodes(c, nodes));
  }
  result.roots.forEach(r => collectNodes(r, allNodes));
  const gpNodes = allNodes.filter(n => n.level === 'GP');
  assert.ok(gpNodes.length > 0, 'YouTube tree must have GP nodes');

  // Verify GP SDF-only also works
  const unmatchedGP = { name: 'Unmatched GP', id: 'gp99', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
    fields: { status: 'Active', videoAdFormat: '', bidCost: '' }, statusInfo: { found: true, normalizedValue: 'Active' } };
  const setting2 = {
    cp: [{ name: 'Test CP2', fields: {} }],
    io: [], li: [], gp: [], cr: [],
  };
  const download2 = {
    cp: [{ name: 'Test CP2', id: 'cp2', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
    io: [], li: [],
    gp: [unmatchedGP],
    cr: [],
  };
  const result2 = api.buildComparisonTree(setting2, download2);
  const allNodes2 = [];
  result2.roots.forEach(r => collectNodes(r, allNodes2));
  // YouTube should have GP as SDF-only node
  const gpSdfOnly = allNodes2.filter(n => n.level === 'GP' && n.fromSdf);
  assert.ok(gpSdfOnly.length > 0, 'YouTube should have GP SDF-only nodes');
});

// ═══════════════════════════════════════════
// OTT: GP SDF-only NOT created
// ═══════════════════════════════════════════
test('OTT: GP SDF-only nodes are not created', () => {
  api.setMediaType('ott');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const unmatchedGP = { name: 'Unmatched GP', id: 'gp99', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
    fields: { status: 'Active', videoAdFormat: '', bidCost: '' }, statusInfo: { found: true, normalizedValue: 'Active' } };

  const setting = {
    cp: [{ name: 'Test CP', fields: {} }],
    io: [], li: [], gp: [], cr: [],
  };
  const download = {
    cp: [{ name: 'Test CP', id: 'cp1', rawFields: { Status: 'Active' }, rawFieldOrder: ['Status'],
           fields: { status: 'Active' }, statusInfo: { found: true, normalizedValue: 'Active' } }],
    io: [], li: [],
    gp: [unmatchedGP],
    cr: [],
  };

  const result = api.buildComparisonTree(setting, download);

  const allNodes = [];
  function collectNodes(node, nodes) {
    nodes.push(node);
    node.children.forEach(c => collectNodes(c, nodes));
  }
  result.roots.forEach(r => collectNodes(r, allNodes));
  const gpNodes = allNodes.filter(n => n.level === 'GP');
  assert.equal(gpNodes.length, 0, 'OTT must not create GP SDF-only nodes');
});
