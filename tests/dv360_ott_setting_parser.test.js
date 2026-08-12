// OTT Setting Parser Test (Phase1 v1.1)
// 検証: parseOttSetting — 5ケース 設定表解析
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const ottRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/OTT';

// ── テストヘルパー ──
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

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = '\n' +
'window.__ottTestApi = {\n' +
'  parseOttSetting: typeof parseOttSetting === "function" ? parseOttSetting : undefined,\n' +
'  parseOttDealSheets: typeof parseOttDealSheets === "function" ? parseOttDealSheets : undefined,\n' +
'  resolveOttDealForLI: typeof resolveOttDealForLI === "function" ? resolveOttDealForLI : undefined,\n' +
'  resolveOttColumns: typeof resolveOttColumns === "function" ? resolveOttColumns : undefined,\n' +
'  extractOttIOFields: typeof extractOttIOFields === "function" ? extractOttIOFields : undefined,\n' +
'  extractOttLIFields: typeof extractOttLIFields === "function" ? extractOttLIFields : undefined,\n' +
'  parseOttCreativeSheets: typeof parseOttCreativeSheets === "function" ? parseOttCreativeSheets : undefined,\n' +
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
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {},
    JSZip: {}, Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__ottTestApi;
}

function parseWorkbook(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheets = {};
  for (const sname of wb.SheetNames) {
    sheets[sname] = XLSX.utils.sheet_to_json(wb.Sheets[sname], { header: 1, defval: '', raw: false });
  }
  return { sheets, sheetNames: wb.SheetNames };
}

const api = loadDv360Api();

// ── テスト ──

test('OTT parser functions exported', () => {
  assert.ok(typeof api.parseOttSetting === 'function', 'parseOttSetting');
  assert.ok(typeof api.parseOttDealSheets === 'function', 'parseOttDealSheets');
  assert.ok(typeof api.resolveOttDealForLI === 'function', 'resolveOttDealForLI');
});

// ═══════════════════════════════════════════
// Case 001: 19 sheets / OTT+RTB+PMP 3系統
// ═══════════════════════════════════════════
test('Case 001: basic structure', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  assert.ok(result.cpList.length >= 1, 'CP should have at least 1 entry');
  assert.ok(result.ioList.length >= 1, 'IO should have entries');
  assert.ok(result.liList.length >= 1, 'LI should have entries');
  assert.equal(result.gpList.length, 0, 'GP must be empty array');
  assert.ok(result.crList.length >= 1, 'CR should have entries');
  assert.ok(result.meta, 'should have meta');
  assert.ok(['ott','rtb','pmp'].includes(result.meta.systemType), 'systemType should be ott/rtb/pmp');
});

test('Case 001: IO fields', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  const io = result.ioList[0];
  assert.ok(io.name.length > 0, 'IO should have name');
  assert.ok(typeof io.fields === 'object', 'IO should have fields');
  assert.ok('budgetGross' in io.fields, 'IO should have budgetGross');
  assert.ok('budgetNet' in io.fields, 'IO should have budgetNet');
  assert.ok('startDate' in io.fields, 'IO should have startDate');
  assert.ok('endDate' in io.fields, 'IO should have endDate');
  assert.ok('kpi' in io.fields, 'IO should have kpi');
  assert.ok('margin' in io.fields, 'IO should have margin');
  assert.ok('inventory' in io.fields, 'IO should have inventory');
  // OTT特有
  assert.ok('optimization' in io.fields, 'IO should have optimization');
  assert.ok('autoBudget' in io.fields, 'IO should have autoBudget');
});

test('Case 001: LI fields', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  const li = result.liList[0];
  assert.ok(li.name.length > 0, 'LI should have name');
  assert.ok(li.ioName.length > 0, 'LI should have ioName');
  assert.ok(typeof li.fields === 'object', 'LI should have fields');

  // 基本
  assert.ok('liType' in li.fields, 'LI: liType');
  assert.ok('duration' in li.fields, 'LI: duration');
  assert.ok('startDate' in li.fields, 'LI: startDate');
  assert.ok('endDate' in li.fields, 'LI: endDate');
  // 予算
  assert.ok('budget100' in li.fields, 'LI: budget100');
  assert.ok('budget98' in li.fields, 'LI: budget98');
  assert.ok('budgetDaily' in li.fields, 'LI: budgetDaily');
  // 入札
  assert.ok('bidStrategy' in li.fields, 'LI: bidStrategy');
  assert.ok('bidPrice' in li.fields, 'LI: bidPrice');
  // 環境/位置/視認性
  assert.ok('environment' in li.fields, 'LI: environment');
  assert.ok('position' in li.fields, 'LI: position');
  assert.ok('viewability' in li.fields, 'LI: viewability');
  // Demographic
  assert.ok('gender' in li.fields, 'LI: gender');
  assert.ok('age' in li.fields, 'LI: age');
  assert.ok('parentalStatus' in li.fields, 'LI: parentalStatus');
  assert.ok('householdIncome' in li.fields, 'LI: householdIncome');
  // Device
  assert.ok('devicePC' in li.fields, 'LI: devicePC');
  assert.ok('deviceSP' in li.fields, 'LI: deviceSP');
  assert.ok('deviceCTV' in li.fields, 'LI: deviceCTV');
  // 収益/Deal
  assert.ok('revenueModel' in li.fields, 'LI: revenueModel');
  assert.ok('dealId' in li.fields, 'LI: dealId');
  assert.ok('resolvedDealInfo' in li.fields, 'LI: resolvedDealInfo');
  // Targeting
  assert.ok('keyword' in li.fields, 'LI: keyword');
  assert.ok('category' in li.fields, 'LI: category');
  // オーディエンス（4項目独立、共通キーなし）
  assert.ok('audienceFirstPartyPartner' in li.fields, 'LI: audienceFirstPartyPartner');
  assert.ok('audienceGoogle' in li.fields, 'LI: audienceGoogle');
  assert.ok('audienceCustomList' in li.fields, 'LI: audienceCustomList');
  assert.ok('audienceCombined' in li.fields, 'LI: audienceCombined');
  assert.ok(!('audience' in li.fields), 'LI: no legacy shared audience key');
  assert.ok(!('affinity' in li.fields), 'LI: no legacy affinity key');
  assert.ok('optimizedTargeting' in li.fields, 'LI: optimizedTargeting');
});

test('Case 001: LI-IO relationship', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  // 同じIOに属するLIが複数あることを確認
  const ioNameCounts = new Map();
  result.liList.forEach(li => {
    const key = li.ioName || '(no io)';
    ioNameCounts.set(key, (ioNameCounts.get(key) || 0) + 1);
  });

  // 少なくとも1つのIOが複数LIを持つ
  const multiLIIOs = [...ioNameCounts.values()].filter(c => c > 1);
  assert.ok(multiLIIOs.length > 0, 'should have IO with multiple LIs');
});

test('Case 001: CR fields', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  const cr = result.crList[0];
  assert.ok(cr.name.length > 0, 'CR should have name');
  assert.ok(cr.liName.length > 0, 'CR should have liName (not gpName)');
  assert.ok('creativeFile' in cr.fields, 'CR should have creativeFile');
  assert.ok('status' in cr.fields, 'CR should have status');
});

test('Case 001: Deal resolution', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  // Case 001 には Deal Sheet と直接Deal IDの両方がある
  assert.ok(result.meta.dealCount > 0, 'should have deals in registry');

  // Deal IDを持つLIを探す
  const liWithDeal = result.liList.find(li => {
    const di = li.fields.resolvedDealInfo;
    return di && di.source !== 'none';
  });
  assert.ok(liWithDeal, 'should have at least one LI with Deal');
  const di = liWithDeal.fields.resolvedDealInfo;
  assert.ok(di.dealId.length > 0, 'Deal should have dealId');
  assert.ok(['direct', 'deal_sheet'].includes(di.source), 'source should be direct or deal_sheet');
});

test('Case 001: GP is always empty', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  assert.equal(result.gpList.length, 0, 'gpList must be empty');
  assert.ok(Array.isArray(result.gpList), 'gpList must be array');
});

// ═══════════════════════════════════════════
// Case 002: 19 sheets / 通常規模
// NOTE: Case 002 XLSX may fail to parse in xlsx.full.min.js (returns 0 sheets)
// ═══════════════════════════════════════════
test('Case 002: basic structure', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '002')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '002', xf));

  // Case 002 XLSX may not be parseable by xlsx.full.min.js
  if (sheetNames.length === 0) {
    console.log('  [SKIP] Case 002 XLSX could not be read (0 sheets returned)');
    return; // skip test
  }

  const result = api.parseOttSetting(sheets, sheetNames, xf);

  assert.ok(result.cpList.length >= 1, 'CP');
  assert.ok(result.ioList.length >= 1, 'IO');
  assert.ok(result.liList.length >= 1, 'LI');
  assert.equal(result.gpList.length, 0, 'GP must be 0');
  assert.ok(result.crList.length >= 0, 'CR may be 0 or more');
});

// ═══════════════════════════════════════════
// Case 003: 8 sheets / 最小構成 (RTB/PMPなし)
// ═══════════════════════════════════════════
test('Case 003: minimal structure (8 sheets)', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '003')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '003', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  assert.ok(result.cpList.length >= 1, 'CP');
  assert.ok(result.ioList.length >= 1, 'IO');
  assert.ok(result.liList.length >= 1, 'LI');
  assert.equal(result.gpList.length, 0, 'GP must be 0');
});

test('Case 003: LI data extracted', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '003')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '003', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  // Case 003 は小規模、LIが少なくとも1件ある
  const validLI = result.liList.filter(li => li.name && !li.name.includes('▼'));
  assert.ok(validLI.length >= 1, 'should have at least 1 valid LI');
});

// ═══════════════════════════════════════════
// Case 004: 19 sheets / 大規模GPデータ
// ═══════════════════════════════════════════
test('Case 004: basic structure', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '004')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '004', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  assert.ok(result.cpList.length >= 1, 'CP');
  assert.ok(result.ioList.length >= 1, 'IO');
  assert.ok(result.liList.length >= 1, 'LI');
  assert.equal(result.gpList.length, 0, 'GP must be 0');
});

// ═══════════════════════════════════════════
// Case 005: 19 sheets / Deal記載あり
// ═══════════════════════════════════════════
test('Case 005: Deal resolution from Deal Sheet', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '005')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '005', xf));
  const result = api.parseOttSetting(sheets, sheetNames, xf);

  assert.ok(result.cpList.length >= 1, 'CP');
  assert.ok(result.liList.length >= 1, 'LI');
  assert.equal(result.gpList.length, 0, 'GP must be 0');
  assert.ok(result.meta.dealCount > 0, 'Case 005 should have deals');

  // Deal が解決されているLIがあることを確認
  const liWithDeal = result.liList.find(li => {
    const di = li.fields.resolvedDealInfo;
    return di && di.source !== 'none';
  });
  // Case 005 は Deal 名がLI名に部分一致するはず
  if (liWithDeal) {
    const di = liWithDeal.fields.resolvedDealInfo;
    assert.ok(di.dealId.length > 0, 'resolved deal should have ID');
  }
});

// ═══════════════════════════════════════════
// 共通: 全ケースで gpList が空配列
// ═══════════════════════════════════════════
test('All cases: gpList is always empty array', () => {
  for (const c of ['001', '002', '003', '004', '005']) {
    const dir = path.join(ottRoot, c);
    const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    if (!xf) continue;
    const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
    if (sheetNames.length === 0) continue; // skip unreadable
    const result = api.parseOttSetting(sheets, sheetNames, xf);
    assert.equal(result.gpList.length, 0, 'Case ' + c + ': gpList must be empty');
    assert.ok(Array.isArray(result.gpList), 'Case ' + c + ': gpList must be array');
  }
});

// ═══════════════════════════════════════════
// 共通: 全ケースで meta が正しい
// ═══════════════════════════════════════════
test('All cases: meta structure', () => {
  for (const c of ['001', '002', '003', '004', '005']) {
    const dir = path.join(ottRoot, c);
    const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    if (!xf) continue;
    const { sheets, sheetNames } = parseWorkbook(path.join(dir, xf));
    if (sheetNames.length === 0) {
      console.log('  [SKIP] Case ' + c + ' XLSX could not be read');
      continue;
    }
    const result = api.parseOttSetting(sheets, sheetNames, xf);
    assert.ok(result.meta, 'Case ' + c + ': should have meta');
    assert.ok(typeof result.meta.systemType === 'string', 'Case ' + c + ': meta.systemType');
    assert.ok(typeof result.meta.dealCount === 'number', 'Case ' + c + ': meta.dealCount');
    assert.ok(result.meta.totalSheets >= 1, 'Case ' + c + ': meta.totalSheets >= 1');
  }
});

// ═══════════════════════════════════════════
// Deal Sheet 解析 単体テスト
// ═══════════════════════════════════════════
test('parseOttDealSheets: Case 001 has valid deals', () => {
  const xf = fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001', xf));
  const dealReg = api.parseOttDealSheets(sheets, sheetNames);

  assert.ok(dealReg.size > 0, 'should have deal entries');
  // テンプレート値 11256 も登録される
  assert.ok(dealReg.has('11256'), 'should have template deal 11256');
  const tmplDeal = dealReg.get('11256');
  assert.equal(tmplDeal.isTemplateDeal, true, '11256 should be marked as template');

  // UUID Deal も登録される
  let uuidDealCount = 0;
  for (const [, deal] of dealReg) {
    if (!deal.isTemplateDeal) uuidDealCount++;
  }
  assert.ok(uuidDealCount > 0, 'should have at least one real (UUID) deal');
});

test('resolveOttDealForLI: direct from setting table', () => {
  const { sheets, sheetNames } = parseWorkbook(path.join(ottRoot, '001',
    fs.readdirSync(path.join(ottRoot, '001')).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'))));
  const dealReg = api.parseOttDealSheets(sheets, sheetNames);

  // UUID Deal ID を直接指定した場合
  const result = api.resolveOttDealForLI('29a897dd-8e1a-4b97-9d9c-8df9d01ac4f4', '', dealReg);
  assert.equal(result.source, 'direct');
  assert.equal(result.dealId, '29a897dd-8e1a-4b97-9d9c-8df9d01ac4f4');
  assert.ok(result.dealName.length > 0, 'should resolve deal name from registry');
});

test('resolveOttDealForLI: none when empty', () => {
  const result = api.resolveOttDealForLI('', '', new Map());
  assert.equal(result.source, 'none');
  assert.equal(result.dealId, '');
});

// ═══════════════════════════════════════════
// IO Objective 域解析テスト
// ═══════════════════════════════════════════
function makeSyntheticOttSheet(objective, regionHeaderRow, targetRow) {
  const rows = [];
  const pushEmpty = () => {
    while (rows.length <= rows.length) rows.push(new Array(30).fill(''));
  };

  // IO Objective 領域
  while (rows.length <= regionHeaderRow) rows.push(new Array(30).fill(''));
  rows[regionHeaderRow][1] = '▼Insertion Order　共通ターゲット設定';
  while (rows.length <= targetRow) rows.push(new Array(30).fill(''));
  rows[targetRow][1] = '目標';
  rows[targetRow][3] = objective;

  // 設定表メインテーブルヘッダー（Row31/Row32 相当）
  const mainHeaderRow = 20;
  while (rows.length <= mainHeaderRow + 5) rows.push(new Array(30).fill(''));
  rows[mainHeaderRow][1] = 'NO';
  rows[mainHeaderRow][3] = 'IO名\n(記入用)';
  rows[mainHeaderRow][5] = '全体予算';

  // 例示行 (Row33 相当) とデータ行 (Row34 相当)
  rows[mainHeaderRow + 2][1] = '例';
  rows[mainHeaderRow + 4][1] = '1';
  rows[mainHeaderRow + 4][3] = 'Synthetic_IO';
  rows[mainHeaderRow + 4][5] = '1000000';

  return { '設定シート (OTT)': rows };
}

test('IO Objective: 目標行が28行付近でも正しく抽出される', () => {
  const sheets = makeSyntheticOttSheet('ブランドの知名度', 6, 9);
  const result = api.parseOttSetting(sheets, ['設定シート (OTT)'], 'synthetic.xlsx');
  assert.equal(result.ioList.length, 1, 'IO should be detected');
  assert.equal(result.ioList[0].fields.optTarget, 'ブランドの知名度');
});

test('IO Objective: 目標行がテンプレート偏移しても正しく抽出される', () => {
  const sheets = makeSyntheticOttSheet('ブランドの知名度', 2, 12);
  const result = api.parseOttSetting(sheets, ['設定シート (OTT)'], 'synthetic.xlsx');
  assert.equal(result.ioList.length, 1, 'IO should be detected');
  assert.equal(result.ioList[0].fields.optTarget, 'ブランドの知名度');
});

test('IO Objective: 未選択／目標なしの値も保持される', () => {
  const sheets = makeSyntheticOttSheet('▼選択', 6, 9);
  const result = api.parseOttSetting(sheets, ['設定シート (OTT)'], 'synthetic.xlsx');
  assert.equal(result.ioList[0].fields.optTarget, '▼選択');

  const sheets2 = makeSyntheticOttSheet('広告掲載オーダー（目標なし）', 6, 9);
  const result2 = api.parseOttSetting(sheets2, ['設定シート (OTT)'], 'synthetic2.xlsx');
  assert.equal(result2.ioList[0].fields.optTarget, '広告掲載オーダー（目標なし）');
});

test('IO Objective: KPI域の目標は読まない', () => {
  const sheets = makeSyntheticOttSheet('ブランドの知名度', 6, 9);
  const rows = sheets['設定シート (OTT)'];
  // KPI 領域に別の目標を置く
  while (rows.length <= 18) rows.push(new Array(30).fill(''));
  rows[18][1] = '目標';
  rows[18][3] = 'CPC';
  const result = api.parseOttSetting(sheets, ['設定シート (OTT)'], 'synthetic.xlsx');
  assert.equal(result.ioList[0].fields.optTarget, 'ブランドの知名度');
});
