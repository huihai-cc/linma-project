// DV360 Display Phase 1
// 媒体判定、SDF schema、設定表 parser、三層 tree の実案件回帰。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const displayRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/Display';

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {}, closest() { return null; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; },
    scrollIntoView() {}, style: { display: '', setProperty() {} },
    textContent: '', value: initialValue,
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');
  const exportBlock = `
window.__displayPhase1Api = {
  detectMediaType: typeof detectMediaType === 'function' ? detectMediaType : undefined,
  detectSdfSchema: typeof detectSdfSchema === 'function' ? detectSdfSchema : undefined,
  parseDisplaySetting: typeof parseDisplaySetting === 'function' ? parseDisplaySetting : undefined,
  findDisplayHeaderRows: typeof findDisplayHeaderRows === 'function' ? findDisplayHeaderRows : undefined,
  resolveDisplayColumns: typeof resolveDisplayColumns === 'function' ? resolveDisplayColumns : undefined,
  parseSdfData: typeof parseSdfData === 'function' ? parseSdfData : undefined,
  buildComparisonTree: typeof buildComparisonTree === 'function' ? buildComparisonTree : undefined,
  compareCP: typeof compareCP === 'function' ? compareCP : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  compareIO_Display: typeof compareIO_Display === 'function' ? compareIO_Display : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareLI_Display: typeof compareLI_Display === 'function' ? compareLI_Display : undefined,
  compareLI_Display_Base: typeof compareLI_Display_Base === 'function' ? compareLI_Display_Base : undefined,
  compareLI_Display_Targeting: typeof compareLI_Display_Targeting === 'function' ? compareLI_Display_Targeting : undefined,
  compareLI_Display_Geography: typeof compareLI_Display_Geography === 'function' ? compareLI_Display_Geography : undefined,
  compareLI_Display_Demographic: typeof compareLI_Display_Demographic === 'function' ? compareLI_Display_Demographic : undefined,
  compareLI_Display_SiteAppTargeting: typeof compareLI_Display_SiteAppTargeting === 'function' ? compareLI_Display_SiteAppTargeting : undefined,
  compareLI_Display_WarningFields: typeof compareLI_Display_WarningFields === 'function' ? compareLI_Display_WarningFields : undefined,
  compareNormalizedRevenueRate: typeof compareNormalizedRevenueRate === 'function' ? compareNormalizedRevenueRate : undefined,
  detectDisplayCaseType: typeof detectDisplayCaseType === 'function' ? detectDisplayCaseType : undefined,
  parseDisplayIoFields: typeof parseDisplayIoFields === 'function' ? parseDisplayIoFields : undefined,
  parseBudgetSegments: typeof parseBudgetSegments === 'function' ? parseBudgetSegments : undefined,
  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === 'function' ? appendDownloadOnlyItems : undefined,
  classifySdfDownloadField: typeof classifySdfDownloadField === 'function' ? classifySdfDownloadField : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  getLevelColumns: typeof getLevelColumns === 'function' ? getLevelColumns : undefined,
  setTreeRoots(value) { treeRoots = value; },
  setMediaType(value) { mediaType = value; },
  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === 'function' ? setSelectedDv360CaseType : undefined,
};
`;
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
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response,
    Set, TextDecoder, Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__displayPhase1Api;
}

function getWorkbookVisibility(wb) {
  const entries = wb.Workbook && Array.isArray(wb.Workbook.Sheets) ? wb.Workbook.Sheets : [];
  const byName = new Map(entries.map(entry => [entry.name || entry.Name, Number(entry.Hidden || 0)]));
  return Object.fromEntries(wb.SheetNames.map(name => [name, byName.get(name) || 0]));
}

function parseWorkbook(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellStyles: true, cellDates: true });
  const sheets = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    sheets[name] = ws && ws['!ref']
      ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
      : [];
  }
  return {
    sheetNames: wb.SheetNames,
    sheets,
    worksheets: wb.Sheets,
    sheetVisibility: getWorkbookVisibility(wb),
  };
}

async function parseSdfZip(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !name.toLowerCase().endsWith('.csv')) continue;
    const text = await entry.async('string');
    const wb = XLSX.read(text, { type: 'string' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      header: 1, defval: '', raw: false,
    });
    csvFiles.push({ name: path.basename(name), path: name, rows });
  }
  return csvFiles;
}

function listDisplayUnits() {
  const units = [];
  for (const caseName of ['001', '002', '003', '004']) {
    const dir = path.join(displayRoot, caseName);
    const xlsx = fs.readdirSync(dir).find(name => name.endsWith('.xlsx') && !name.startsWith('~$'));
    units.push({ key: caseName, xlsx: path.join(dir, xlsx), zip: path.join(dir, 'SDF.zip') });
  }
  const case005 = path.join(displayRoot, '005');
  for (const suffix of ['87', '91']) {
    const xlsx = fs.readdirSync(case005).find(name =>
      name.endsWith('.xlsx') && !name.startsWith('~$') && name.includes(`_${suffix}_`));
    units.push({ key: `005-${suffix}`, xlsx: path.join(case005, xlsx), zip: path.join(case005, `${suffix}SDF.zip`) });
  }
  return units;
}

const api = loadDv360Api();
const displayUnits = listDisplayUnits();

const DISPLAY_CP_EXPECTATIONS = new Map([
  ['001', {
    name: '|2606_新型車_PU_20/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/SUV関心',
    goal: 'ブランドや商品の認知度向上', kpi: 'CPC', kpiVal: '¥3',
    startDate: '2026/6/18', endDate: '終了日設定無し',
  }],
  ['002', {
    name: '|2607_CCL_01/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/軽関心+ミニバン関心',
    goal: 'ブランドや商品の認知度向上', kpi: 'CPC', kpiVal: '10円',
    startDate: '2026/7/8', endDate: '終了日設定無し',
  }],
  ['003', {
    name: '06907703_Marcom_iPhone_Sweetener_Privacy 7.0_FY26_Q4_Q426_DV360',
    goal: 'オンラインでの特定の行動やアクセスの促進', kpi: 'CPC', kpiVal: '110円',
    startDate: '2026/7/7', endDate: '終了日設定無し',
  }],
  ['004', {
    name: '07010479_Marcom_iPhone_NA_FY26 iPhone Switchers MNC_FY26_Q4_Q426_Android_DV360',
    goal: 'オンラインでの特定の行動やアクセスの促進', kpi: 'CPC', kpiVal: '¥4',
    startDate: '2026/7/15', endDate: '終了日設定無し',
  }],
  ['005-87', {
    name: '|2607_新型車_M5_87/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/セレナVLPリタゲ',
    goal: 'ブランドや商品の認知度向上', kpi: 'CPC', kpiVal: '¥59',
    startDate: '2026/7/17', endDate: '終了日設定無し',
  }],
  ['005-91', {
    name: '|2607_新型車_M5_91/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/エクストレイルVLPリタゲ',
    goal: 'ブランドや商品の認知度向上', kpi: 'CPC', kpiVal: '¥59',
    startDate: '2026/7/17', endDate: '終了日設定無し',
  }],
]);

function setWorkbookCell(workbook, address, value) {
  const sheet = workbook.worksheets['設定シート'];
  const position = XLSX.utils.decode_cell(address);
  const refStart = XLSX.utils.decode_range(sheet['!ref']).s;
  sheet[address] = { ...(sheet[address] || {}), t: 's', v: value, w: value };
  delete sheet[address].f;
  while (workbook.sheets['設定シート'].length <= position.r) workbook.sheets['設定シート'].push([]);
  const row = workbook.sheets['設定シート'][position.r];
  const rowColumn = position.c - refStart.c;
  while (row.length <= rowColumn) row.push('');
  row[rowColumn] = value;
}

test('6个真实 Display 設定表即使含隐藏 OTT 模板也全部自动识别为 display', () => {
  assert.equal(displayUnits.length, 6);
  for (const unit of displayUnits) {
    const workbook = parseWorkbook(unit.xlsx);
    const actual = api.detectMediaType(workbook.sheetNames, [{ ...workbook, fileName: path.basename(unit.xlsx) }]);
    assert.equal(actual, 'display', unit.key);
  }
});

test('6个真实 SDF 通过 header fingerprint 识别为 v9 且核心列数一致', async () => {
  assert.equal(typeof api.detectSdfSchema, 'function');
  const fingerprints = [];
  for (const unit of displayUnits) {
    const csvFiles = await parseSdfZip(unit.zip);
    const schema = api.detectSdfSchema(csvFiles);
    assert.equal(schema.version, 'v9', unit.key);
    assert.deepEqual(
      { Campaigns: schema.fileTypes.Campaigns.columnCount,
        InsertionOrders: schema.fileTypes.InsertionOrders.columnCount,
        LineItems: schema.fileTypes.LineItems.columnCount },
      { Campaigns: 40, InsertionOrders: 91, LineItems: 129 },
      unit.key,
    );
    fingerprints.push(schema.fingerprint);
  }
  assert.equal(new Set(fingerprints).size, 1, 'all six samples use one SDF header signature');
});

test('Display 独立 parser 对6个真实設定表解析出 6 CP / 6 IO / 13 LI', () => {
  const expectedLiCounts = new Map([
    ['001', 2], ['002', 2], ['003', 1], ['004', 4], ['005-87', 2], ['005-91', 2],
  ]);
  let cpCount = 0, ioCount = 0, liCount = 0;
  for (const unit of displayUnits) {
    const workbook = parseWorkbook(unit.xlsx);
    const result = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    );
    assert.equal(result.meta.parser, 'display', unit.key);
    assert.equal(result.meta.sourceSheet, '設定シート', unit.key);
    assert.equal(result.cpList.length, 1, `${unit.key} CP`);
    assert.equal(result.ioList.length, 1, `${unit.key} IO`);
    assert.equal(result.liList.length, expectedLiCounts.get(unit.key), `${unit.key} LI`);
    assert.equal(result.gpList.length, 0, `${unit.key} GP`);
    assert.equal(result.crList.length, 0, `${unit.key} CR`);
    cpCount += result.cpList.length;
    ioCount += result.ioList.length;
    liCount += result.liList.length;
  }
  assert.deepEqual({ cpCount, ioCount, liCount }, { cpCount: 6, ioCount: 6, liCount: 13 });
});

test('Display LI parser 从真实设置表取得第一阶段字段并输出003代表行', () => {
  const requiredKeys = [
    'liType', 'startDate', 'endDate', 'budgetPacing', 'pacingMode', 'budgetGross', 'budgetNet',
    'bidStrategy', 'bidTarget', 'bidPrice', 'fqTiming', 'fqCount', 'language', 'geography',
    'devicePC', 'deviceSP', 'deviceTablet', 'deviceCTV',
  ];
  for (const unit of displayUnits) {
    const workbook = parseWorkbook(unit.xlsx);
    const result = api.parseDisplaySetting(workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets);
    for (const li of result.liList) {
      for (const key of requiredKeys) assert.ok(Object.hasOwn(li.fields, key), `${unit.key} ${li.name} ${key}`);
    }
  }
  const unit = displayUnits.find(item => item.key === '003');
  const workbook = parseWorkbook(unit.xlsx);
  const li = api.parseDisplaySetting(workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets).liList[0];
  assert.equal(li.name, 'DV360_Q426_iPhone_Phone Over Face_Privacy 7.0');
  assert.equal(li.fields.liType, 'ディスプレイ');
  assert.equal(li.fields.startDate, '2026/7/7');
  assert.equal(li.fields.endDate, '2026/8/3');
  assert.equal(String(li.fields.budgetGross), '15000000');
  assert.equal(String(li.fields.budgetNet), '14700000');
  assert.equal(li.fields.bidStrategy, '固定入札');
  assert.equal(String(li.fields.bidPrice), '3000');
  assert.equal(li.fields.language, 'Japanese');
  assert.equal(li.fields.geography, 'Japan');
  assert.deepEqual(
    [li.fields.devicePC, li.fields.deviceSP, li.fields.deviceTablet, li.fields.deviceCTV],
    ['●', '●', '●', ''],
  );
  console.log('[Display LI parser 003]', JSON.stringify({
    name: li.name, type: li.fields.liType,
    startDate: li.fields.startDate, endDate: li.fields.endDate,
    budgetPacing: li.fields.budgetPacing, pacingMode: li.fields.pacingMode,
    budgetGross: li.fields.budgetGross, budgetNet: li.fields.budgetNet,
    bidStrategy: li.fields.bidStrategy, bidTarget: li.fields.bidTarget, bidPrice: li.fields.bidPrice,
    fqTiming: li.fields.fqTiming, fqCount: li.fields.fqCount,
    language: li.fields.language, geography: li.fields.geography,
    devices: [li.fields.devicePC, li.fields.deviceSP, li.fields.deviceTablet, li.fields.deviceCTV],
  }));
});

test('002 Display CP 从 Campaign 区域读取名称、目标、KPI、日期和 Frequency 原文', () => {
  const unit = displayUnits.find(item => item.key === '002');
  const workbook = parseWorkbook(unit.xlsx);
  const result = api.parseDisplaySetting(
    workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
  );
  const cp = result.cpList[0];
  assert.deepEqual(
    {
      name: cp.name,
      goal: cp.fields.goal,
      kpi: cp.fields.kpi,
      kpiVal: cp.fields.kpiVal,
      startDate: cp.fields.startDate,
      endDate: cp.fields.endDate,
      frequency: cp.fields.frequency,
      thirdPartyDelivery: cp.fields.thirdPartyDelivery,
    },
    {
      ...DISPLAY_CP_EXPECTATIONS.get('002'),
      frequency: '●回 / ▼選択',
      thirdPartyDelivery: '無',
    },
  );
});

test('6个真实 Display CP 都保留 Campaign 区域的业务字段', () => {
  for (const unit of displayUnits) {
    const workbook = parseWorkbook(unit.xlsx);
    const result = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    );
    const cp = result.cpList[0];
    const expected = DISPLAY_CP_EXPECTATIONS.get(unit.key);
    assert.deepEqual({
      name: cp.name,
      goal: cp.fields.goal,
      kpi: cp.fields.kpi,
      kpiVal: cp.fields.kpiVal,
      startDate: cp.fields.startDate,
      endDate: cp.fields.endDate,
    }, expected, unit.key);
  }
});

test('Display CP 即使与首个 IO 名称和日期不同也只读取 Campaign 区域', () => {
  const unit = displayUnits.find(item => item.key === '002');
  const workbook = parseWorkbook(unit.xlsx);
  setWorkbookCell(workbook, 'D16', 'CP-only-name');
  setWorkbookCell(workbook, 'D20', '7/15/26');
  setWorkbookCell(workbook, 'E20', '終了日設定無し');
  setWorkbookCell(workbook, 'C40', 'IO-only-name');
  setWorkbookCell(workbook, 'F40', '7/8/26');
  setWorkbookCell(workbook, 'G40', '7/31/26');
  const result = api.parseDisplaySetting(
    workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
  );
  assert.equal(result.cpList[0].name, 'CP-only-name');
  assert.equal(result.cpList[0].fields.startDate, '2026/7/15');
  assert.equal(result.cpList[0].fields.endDate, '終了日設定無し');
  assert.equal(result.ioList[0].name, 'IO-only-name');
  assert.equal(result.ioList[0].cpName, 'CP-only-name');
  assert.equal(result.ioList[0].fields.startDate, '2026/7/8');
  assert.equal(result.ioList[0].fields.endDate, '2026/7/31');
});

test('004 使用管理画面登録用名称 exact 值，変更後名称只保留为辅助信息', () => {
  const unit = displayUnits.find(item => item.key === '004');
  const workbook = parseWorkbook(unit.xlsx);
  const result = api.parseDisplaySetting(
    workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
  );
  const hospital = result.liList.find(li => li.name === 'DV360_Q426_Hospital');
  assert.ok(hospital, '管理画面登録用名称 must be the LI name');
  assert.equal(hospital.fields.nameAfter, 'DV360_Odin Design & Performance_Android_250928-251227');
  assert.notEqual(hospital.name, hospital.fields.nameAfter, '変更後名称 must not override the matching name');
  assert.deepEqual(
    Array.from(result.liList, li => li.name),
    ['DV360_Q426_Hospital', 'DV360_Q426_Hospita_Anchor',
      'DV360_Q426_Convenience Store', 'DV360_Q426_Convenience Store_Anchor'],
  );
});

test('005-87/91 从模板输入重建名称、日期和预算并保留公式证据', () => {
  const expectations = new Map([
    ['005-87', {
      ioName: '|2607_新型車_M5_87/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/セレナVLPリタゲ',
      liPrefix: '2607_新型車_M5_87/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無|',
    }],
    ['005-91', {
      ioName: '|2607_新型車_M5_91/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/エクストレイルVLPリタゲ',
      liPrefix: '2607_新型車_M5_91/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無|',
    }],
  ]);
  for (const [key, expected] of expectations) {
    const unit = displayUnits.find(item => item.key === key);
    const workbook = parseWorkbook(unit.xlsx);
    const result = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    );
    const io = result.ioList[0];
    assert.equal(result.cpList[0].name, expected.ioName, `${key} campaign name`);
    assert.equal(io.name, expected.ioName, `${key} IO name`);
    assert.equal(io.fields.budgetGross, 263450, `${key} gross budget`);
    assert.equal(io.fields.budgetNet, 258181, `${key} net budget`);
    assert.equal(io.fields.startDate, '2026/7/17', `${key} start date`);
    assert.equal(io.fields.endDate, '2026/7/31', `${key} end date`);
    assert.deepEqual(Array.from(result.liList, li => li.name), [expected.liPrefix + 'PC', expected.liPrefix + 'SP']);
    assert.ok(result.liList.every(li => li.fields.startDate === '2026/7/17'));
    assert.ok(result.liList.every(li => li.fields.endDate === '2026/7/31'));

    const evidence = io.reconstruction.name;
    assert.equal(evidence.formula, '$D$16');
    assert.equal(evidence.rawValue, 0);
    assert.equal(evidence.reconstructedValue, expected.ioName);
    assert.deepEqual(Array.from(evidence.sourceCells), ['B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'D16', 'C40']);
    assert.equal(evidence.reconstructionRule, 'display-standard-io-name-v1');
    assert.equal(result.liList[0].reconstruction.name.reconstructionRule, 'display-standard-li-name-v1');
  }
});

test('005-87/91 BY列収益モデル从陈旧公式缓存重建为42.857%并与TMCM判定OK', async () => {
  api.setMediaType('display');
  for (const key of ['005-87', '005-91']) {
    const unit = displayUnits.find(item => item.key === key);
    const workbook = parseWorkbook(unit.xlsx);
    const worksheet = workbook.worksheets['設定シート'];
    const headerRows = api.findDisplayHeaderRows(workbook.sheets['設定シート']);
    const columns = api.resolveDisplayColumns(workbook.sheets['設定シート'], headerRows);
    assert.equal(headerRows.top, 35, `${key} header row`);
    assert.equal(columns.liRevenue, 75, `${key} revenue array index`);
    assert.equal(worksheet.BY36.v, '収益モデル', `${key} BY header`);

    const setting = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    );
    const download = api.parseSdfData(await parseSdfZip(unit.zip));
    assert.deepEqual(Array.from(setting.liList, li => li.sourceRow), [40, 41], `${key} LI source rows`);
    for (const settingLi of setting.liList) {
      const address = `BY${settingLi.sourceRow}`;
      const marginAddress = `T${settingLi.sourceRow}`;
      const cell = worksheet[address];
      assert.equal(cell.v, 0, `${key} ${address} stale raw cache`);
      assert.equal(cell.w, undefined, `${key} ${address} formatted cache`);
      assert.equal(cell.z, '0.000%', `${key} ${address} number format`);
      assert.equal(cell.f, `IF(${marginAddress}="","未入力",1/(1-${marginAddress})-1)`, `${key} ${address} formula`);
      assert.equal(worksheet[marginAddress].v, 0, `${key} ${marginAddress} stale raw cache`);
      assert.equal(worksheet[marginAddress].f, 'IF($G$4="有","35%","30%")', `${key} ${marginAddress} formula`);
      assert.equal(worksheet.G4.v, '無', `${key} G4 selector`);
      assert.equal(settingLi.fields.revenueModel, '42.857%', `${key} ${settingLi.name} parsed revenue`);
      const evidence = settingLi.reconstruction.revenueModel;
      assert.equal(evidence.rawValue, 0, `${key} reconstruction raw value`);
      assert.equal(evidence.reconstructedValue, '42.857%', `${key} reconstruction value`);
      assert.equal(evidence.formula, cell.f, `${key} reconstruction formula`);
      assert.deepEqual(Array.from(evidence.sourceCells), ['G4', marginAddress, address], `${key} reconstruction source cells`);
      assert.equal(evidence.reconstructionRule, 'display-standard-li-revenue-v1', `${key} reconstruction rule`);

      const downloadLi = download.liList.find(li => li.name === settingLi.name);
      assert.ok(downloadLi, `${key} ${settingLi.name} SDF match`);
      const item = api.compareLI_Display_Base(settingLi, downloadLi)
        .find(entry => entry.label === '収益モデル');
      assert.deepEqual(
        { sVal: item.sVal, dVal: item.dVal, result: item.result },
        { sVal: '42.857%', dVal: 'TMCM / 42.857', result: 'ok' },
        `${key} ${settingLi.name} revenue comparison`,
      );
    }
  }
});

test('005-87/91 Display 多层用户属性 header 按语义解析到 BH:BP 并生成独立 parser 字段', () => {
  const expectedColumns = {
    liDemoGender: 'BH', liDemoGenderUnknown: 'BI',
    liDemoAgeStart: 'BJ', liDemoAgeEnd: 'BK', liDemoAgeUnknown: 'BL',
    liDemoParental: 'BM',
    liDemoIncomeUpper: 'BN', liDemoIncomeLower: 'BO', liDemoIncomeUnknown: 'BP',
  };
  const expectedCells = {
    BH: { raw: 'すべて', formatted: 'すべて', subHeader: '性別', detailHeader: '' },
    BI: { raw: 'すべて', formatted: 'すべて', subHeader: '', detailHeader: '不明' },
    BJ: { raw: null, formatted: null, subHeader: '年齢', detailHeader: '' },
    BK: { raw: null, formatted: null, subHeader: '', detailHeader: '' },
    BL: { raw: 'は不明なし', formatted: 'は不明なし', subHeader: '', detailHeader: '不明' },
    BM: { raw: 'ALL(不明あり)', formatted: 'ALL(不明あり)', subHeader: '子供の有無', detailHeader: '' },
    BN: { raw: 'ALL', formatted: 'ALL', subHeader: '世帯収入', detailHeader: 'ALL or 上位' },
    BO: { raw: '▼選択', formatted: '▼選択', subHeader: '', detailHeader: '下位' },
    BP: { raw: '不明あり', formatted: '不明あり', subHeader: '', detailHeader: '不明' },
  };
  const expectedFields = {
    gender: 'すべて', genderUnknown: 'すべて',
    age: '', ageUnknown: 'は不明なし',
    parentalStatus: 'ALL(不明あり)',
    householdIncome: 'ALL', householdIncomeUnknown: '不明あり',
  };
  for (const key of ['005-87', '005-91']) {
    const unit = displayUnits.find(item => item.key === key);
    const workbook = parseWorkbook(unit.xlsx);
    const rows = workbook.sheets['設定シート'];
    const worksheet = workbook.worksheets['設定シート'];
    const headerRows = api.findDisplayHeaderRows(rows);
    const columns = api.resolveDisplayColumns(rows, headerRows);
    const startColumn = XLSX.utils.decode_range(worksheet['!ref']).s.c;
    for (const [columnKey, addressColumn] of Object.entries(expectedColumns)) {
      assert.equal(XLSX.utils.encode_col(startColumn + columns[columnKey]), addressColumn, `${key} ${columnKey}`);
    }
    const parsed = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    );
    assert.equal(parsed.liList.length, 2, key);
    for (const li of parsed.liList) {
      assert.deepEqual(
        Object.fromEntries(Object.keys(expectedFields).map(field => [field, li.fields[field]])),
        expectedFields,
        `${key} ${li.name} demographic fields`,
      );
      for (const [column, expected] of Object.entries(expectedCells)) {
        const cell = worksheet[`${column}${li.sourceRow}`];
        assert.deepEqual({
          raw: cell && cell.v !== undefined ? cell.v : null,
          formatted: cell && cell.w !== undefined ? cell.w : null,
          subHeader: worksheet[`${column}37`]?.v || '',
          detailHeader: worksheet[`${column}38`]?.v || '',
        }, expected, `${key} ${column}${li.sourceRow}`);
      }
    }
  }
});

test('Display 用户属性 parser 将年龄起止列和世帯收入上下限组合，Unknown 保持独立', () => {
  const unit = displayUnits.find(item => item.key === '005-87');
  const workbook = parseWorkbook(unit.xlsx);
  const rows = workbook.sheets['設定シート'];
  const worksheet = workbook.worksheets['設定シート'];
  const rowIndex = 39;
  const values = { BJ: '25', BK: '34', BL: '不明なし', BN: '上位10%', BO: '40%', BP: '不明なし' };
  for (const [column, value] of Object.entries(values)) {
    worksheet[`${column}40`] = { ...(worksheet[`${column}40`] || {}), t: 's', v: value, w: value };
    rows[rowIndex][XLSX.utils.decode_col(column) - XLSX.utils.decode_range(worksheet['!ref']).s.c] = value;
  }
  const parsed = api.parseDisplaySetting(
    workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
  );
  assert.deepEqual({
    age: parsed.liList[0].fields.age,
    ageUnknown: parsed.liList[0].fields.ageUnknown,
    householdIncome: parsed.liList[0].fields.householdIncome,
    householdIncomeUnknown: parsed.liList[0].fields.householdIncomeUnknown,
  }, {
    age: '25-34', ageUnknown: '不明なし',
    householdIncome: '上位10%～40%', householdIncomeUnknown: '不明なし',
  });
});

async function buildDisplayTree(unit) {
  const workbook = parseWorkbook(unit.xlsx);
  const settingRaw = api.parseDisplaySetting(
    workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
  );
  const csvFiles = await parseSdfZip(unit.zip);
  const downloadRaw = api.parseSdfData(csvFiles);
  api.setMediaType('display');
  if (api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const tree = api.buildComparisonTree(
    { cp: settingRaw.cpList, io: settingRaw.ioList, li: settingRaw.liList, gp: [], cr: [] },
    { cp: downloadRaw.cpList, io: downloadRaw.ioList, li: downloadRaw.liList, gp: [], cr: [] },
  );
  return { tree, settingRaw, downloadRaw };
}

function collectTreeNodes(roots) {
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    for (const child of node.children || []) visit(child);
  };
  for (const root of roots) visit(root);
  return nodes;
}

test('002 Display CP compare 使用 Campaign 区域值并正确判断无结束日与 Frequency', async () => {
  const unit = displayUnits.find(item => item.key === '002');
  const { tree } = await buildDisplayTree(unit);
  const cp = tree.roots.find(node => node.level === 'CP');
  const byLabel = new Map(cp.compItems.map(item => [item.label, item]));
  assert.deepEqual(
    ['全体目標', 'Campaign Goal KPI', 'KPI値', '開始日', '終了日', 'FQ'].map(label => ({
      label,
      sVal: byLabel.get(label)?.sVal,
      dVal: byLabel.get(label)?.dVal,
      result: byLabel.get(label)?.result,
    })),
    [
      { label: '全体目標', sVal: 'ブランドや商品の認知度向上', dVal: 'Raise awareness of my brand or product', result: 'ok' },
      { label: 'Campaign Goal KPI', sVal: 'CPC', dVal: 'CPC', result: 'ok' },
      { label: 'KPI値', sVal: '10円', dVal: '10', result: 'ok' },
      { label: '開始日', sVal: '2026/7/8', dVal: '2026/07/08', result: 'ok' },
      { label: '終了日', sVal: '終了日設定無し', dVal: '(空欄)', result: 'ok' },
      { label: 'FQ', sVal: '●回 / ▼選択', dVal: 'False / 0 / Minutes / 0', result: 'ok' },
    ],
  );
});

test('6个真实 Display Campaign Goal 只按已确认的两组原文对应关系比较', async () => {
  const expectedDownloadGoals = new Map([
    ['001', 'Raise awareness of my brand or product'],
    ['002', 'Raise awareness of my brand or product'],
    ['003', 'Drive online action or visits'],
    ['004', 'Drive online action or visits'],
    ['005-87', 'Raise awareness of my brand or product'],
    ['005-91', 'Raise awareness of my brand or product'],
  ]);
  for (const unit of displayUnits) {
    const { tree } = await buildDisplayTree(unit);
    const cp = tree.roots.find(node => node.level === 'CP');
    const goal = cp.compItems.find(item => item.label === '全体目標');
    assert.deepEqual({ sVal: goal.sVal, dVal: goal.dVal, result: goal.result }, {
      sVal: DISPLAY_CP_EXPECTATIONS.get(unit.key).goal,
      dVal: expectedDownloadGoals.get(unit.key),
      result: 'ok',
    }, unit.key);
  }
});

test('6个 Display 单元保持 CP→IO→LI 三层结构且不生成 GP/CR', async () => {
  for (const unit of displayUnits) {
    const { tree, settingRaw } = await buildDisplayTree(unit);
    assert.deepEqual(
      { cp: tree.counts.cp, io: tree.counts.io, li: tree.counts.li },
      { cp: 1, io: 1, li: settingRaw.liList.length },
      unit.key,
    );
    const nodes = collectTreeNodes(tree.roots);
    assert.equal(nodes.some(node => node.level === 'GP'), false, `${unit.key} GP`);
    assert.equal(nodes.some(node => node.level === 'CR'), false, `${unit.key} CR`);
    const settingRoot = tree.roots.find(node => node.level === 'CP' && node.name === settingRaw.cpList[0].name);
    assert.ok(settingRoot, `${unit.key} setting CP root`);
    assert.ok(settingRoot.children.some(node => node.level === 'IO'), `${unit.key} nested IO`);
    assert.ok(settingRoot.children.flatMap(node => node.children).some(node => node.level === 'LI'), `${unit.key} nested LI`);
  }
});

test('002 IO 名称错误仍在 Campaign scope 内唯一绑定并只把 IO名判为 mismatch', async () => {
  const unit = displayUnits.find(item => item.key === '002');
  const { tree, settingRaw } = await buildDisplayTree(unit);
  const root = tree.roots.find(node => node.level === 'CP' && node.name === settingRaw.cpList[0].name);
  assert.equal(root.found, true, 'Campaign exact match');
  const io = root.children.find(node => node.level === 'IO');
  assert.equal(io.found, true, 'unique IO must remain comparable');
  assert.equal(io.matchedId, '1029239522');
  assert.equal(io.matchedName,
    '|2607_CCL_01/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/軽関心+ミニバン関心＋EV関心');
  const nameItem = io.compItems.find(item => item.label === 'IO名');
  assert.ok(nameItem, 'IO name comparison item');
  assert.equal(nameItem.result, 'mismatch');
  assert.equal(nameItem.sVal, settingRaw.ioList[0].name);
  assert.equal(nameItem.dVal, io.matchedName);
  assert.equal(io.children.filter(node => node.level === 'LI' && node.found).length, 2,
    'other LI comparisons continue after IO name mismatch');
  assert.equal(io.status, 'mismatch');
});

test('004 tree 使用管理画面登録用名称完成4个 LI exact match', async () => {
  const unit = displayUnits.find(item => item.key === '004');
  const { tree, settingRaw } = await buildDisplayTree(unit);
  const nodes = collectTreeNodes(tree.roots);
  const settingNames = new Set(settingRaw.liList.map(li => li.name));
  const matched = nodes.filter(node => node.level === 'LI' && settingNames.has(node.name));
  assert.equal(matched.length, 4);
  assert.ok(matched.every(node => node.found && node.matchedName === node.name));
  const hospital = matched.find(node => node.name === 'DV360_Q426_Hospital');
  assert.ok(hospital);
  assert.equal(hospital.compItems.some(item =>
    item.result === 'mismatch' && String(item.sVal).includes('Odin Design & Performance')), false);
});

test('005-87/91 重建值用于 tree exact match，全部 CP/IO/LI 成功绑定', async () => {
  for (const key of ['005-87', '005-91']) {
    const unit = displayUnits.find(item => item.key === key);
    const { tree, settingRaw } = await buildDisplayTree(unit);
    const nodes = collectTreeNodes(tree.roots);
    const cp = nodes.find(node => node.level === 'CP' && node.name === settingRaw.cpList[0].name);
    const io = nodes.find(node => node.level === 'IO' && node.name === settingRaw.ioList[0].name);
    const liNodes = nodes.filter(node => node.level === 'LI' && settingRaw.liList.some(li => li.name === node.name));
    assert.equal(cp.found, true, `${key} CP`);
    assert.equal(io.found, true, `${key} IO`);
    assert.equal(liNodes.length, 2, `${key} LI count`);
    assert.ok(liNodes.every(node => node.found && node.matchedName === node.name), `${key} LI exact`);
  }
});

const DISPLAY_IO_EXPECTATIONS = new Map([
  ['001', {
    name: '|2606_新型車_PU_20/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/SUV関心',
    budgetGross: '4379780', budgetNet: '4292184', startDate: '2026/6/18', endDate: '2026/6/30',
    kpi: 'クリック単価（CPC）', kpiValue: '10', optimization: '広告掲載オーダー単位で入札単価と予算を自動で管理する',
    objective: 'クリック数を最大化', autoBudget: '▼選択', margin: '30%',
  }],
  ['002', {
    name: '|2607_CCL_01/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/軽関心+ミニバン関心',
    budgetGross: '7157270', budgetNet: '7014124', startDate: '2026/7/8', endDate: '2026/7/31',
    kpi: 'クリック単価（CPC）', kpiValue: '10', optimization: '広告掲載オーダー単位で入札単価と予算を自動で管理する',
    objective: 'クリック数を最大化', autoBudget: '▼選択', margin: '30%',
  }],
  ['003', {
    name: '06907703_Marcom_iPhone_Sweetener_Privacy 7.0_FY26_Q4_Q426_DV360',
    budgetGross: '15000000', budgetNet: '14700000', startDate: '2026/7/7', endDate: '2026/8/3',
    kpi: 'CPC', kpiValue: '12', optimization: '広告申込情報単位で入札単価と予算を手動で管理する',
    objective: '▼選択', autoBudget: 'OFF', margin: '0%',
  }],
  ['004', {
    name: '07010479_Marcom_iPhone_NA_FY26 iPhone Switchers MNC_FY26_Q4_Q426_Android_DV360',
    budgetGross: '10000000', budgetNet: '9800000', startDate: '2026/7/15', endDate: '2026/8/2',
    kpi: 'CPC', kpiValue: '4', optimization: '広告申込情報単位で入札単価と予算を手動で管理する',
    objective: '▼選択', autoBudget: 'OFF', margin: '0%',
  }],
  ['005-87', {
    name: '|2607_新型車_M5_87/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/セレナVLPリタゲ',
    budgetGross: '263450', budgetNet: '258181', startDate: '2026/7/17', endDate: '2026/7/31',
    kpi: 'クリック単価（CPC）', kpiValue: '10', optimization: '広告掲載オーダー単位で入札単価と予算を自動で管理する',
    objective: 'クリック数を最大化', autoBudget: '▼選択', margin: '0',
  }],
  ['005-91', {
    name: '|2607_新型車_M5_91/リーチ/Banner/DV360._ターゲ_bn/Aone無/Aflow無-seg/エクストレイルVLPリタゲ',
    budgetGross: '263450', budgetNet: '258181', startDate: '2026/7/17', endDate: '2026/7/31',
    kpi: 'クリック単価（CPC）', kpiValue: '10', optimization: '広告掲載オーダー単位で入札単価と予算を自動で管理する',
    objective: 'クリック数を最大化', autoBudget: '▼選択', margin: '0',
  }],
]);

test('Display IO 独立 parser 契约覆盖6个真实設定表字段与 raw provenance', () => {
  assert.equal(typeof api.parseDisplayIoFields, 'function');
  for (const unit of displayUnits) {
    const workbook = parseWorkbook(unit.xlsx);
    const result = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    );
    const io = result.ioList[0];
    const expected = DISPLAY_IO_EXPECTATIONS.get(unit.key);
    assert.equal(io.cpName, result.cpList[0].name, `${unit.key} CP parent`);
    assert.deepEqual({
      name: io.name,
      ioType: io.fields.ioType,
      objective: io.fields.objective,
      budgetGross: String(io.fields.budgetGross),
      budgetNet: String(io.fields.budgetNet),
      budgetType: io.fields.budgetType,
      startDate: io.fields.startDate,
      startTime: io.fields.startTime,
      endDate: io.fields.endDate,
      endTime: io.fields.endTime,
      pacing: io.fields.pacing,
      pacingRate: io.fields.pacingRate,
      pacingAmount: io.fields.pacingAmount,
      kpi: io.fields.kpi,
      kpiValue: String(io.fields.kpiValue),
      optimization: io.fields.optimization,
      target: io.fields.target,
      autoBudget: io.fields.autoBudget,
      fqTiming: io.fields.fqTiming,
      fqCount: io.fields.fqCount,
      margin: io.fields.margin,
      inventory: io.fields.inventory,
    }, {
      name: expected.name,
      ioType: '', objective: expected.objective,
      budgetGross: expected.budgetGross, budgetNet: expected.budgetNet, budgetType: '',
      startDate: expected.startDate, startTime: '00:00', endDate: expected.endDate, endTime: '23:59',
      pacing: '掲載期間', pacingRate: '均等', pacingAmount: '',
      kpi: expected.kpi, kpiValue: expected.kpiValue,
      optimization: expected.optimization, target: expected.objective, autoBudget: expected.autoBudget,
      fqTiming: '▼選択', fqCount: '●回', margin: expected.margin,
      inventory: unit.key === '003' || unit.key === '004'
        ? '認定直接販売者と認定販売パートナー'
        : '認定販売者と未参加のパブリッシャー',
    }, unit.key);
    assert.ok(io.rawFields && Object.prototype.hasOwnProperty.call(io.rawFields, 'budgetNet'), `${unit.key} raw fields`);
  }
});

test('parseBudgetSegments 对多段预算求和并取最早开始与最晚结束', () => {
  const parsed = api.parseBudgetSegments(
    '(7014124.0; 07/08/2026; 07/31/2026; ; なし;); (7014121.0; 08/01/2026; 08/31/2026; ; ;);',
  );
  assert.deepEqual({
    budget: parsed.budget,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    count: parsed.segments.length,
  }, { budget: '14028245', startDate: '2026-07-08', endDate: '2026-08-31', count: 2 });
});

const DISPLAY_IO_RESULT_EXPECTATIONS = new Map([
  ['001', { name: 'ok', objective: 'ok', budget: 'ok', endDate: 'ok', kpiValue: 'ok', autoBudget: 'mismatch', optimization: 'ok' }],
  ['002', { name: 'mismatch', objective: 'ok', budget: 'mismatch', endDate: 'mismatch', kpiValue: 'ok', autoBudget: 'ok', optimization: 'mismatch' }],
  ['003', { name: 'ok', objective: 'ok', budget: 'ok', endDate: 'ok', kpiValue: 'ok', autoBudget: 'ok', optimization: 'mismatch' }],
  ['004', { name: 'ok', objective: 'ok', budget: 'ok', endDate: 'ok', kpiValue: 'mismatch', autoBudget: 'ok', optimization: 'ok' }],
  ['005-87', { name: 'ok', objective: 'ok', budget: 'mismatch', endDate: 'mismatch', kpiValue: 'ok', autoBudget: 'ok', optimization: 'mismatch' }],
  ['005-91', { name: 'ok', objective: 'ok', budget: 'mismatch', endDate: 'mismatch', kpiValue: 'ok', autoBudget: 'ok', optimization: 'mismatch' }],
]);

test('Display IO 独立 comparison contract 对6个真实案件输出稳定判定', async () => {
  assert.equal(typeof api.compareIO_Display, 'function');
  for (const unit of displayUnits) {
    const workbook = parseWorkbook(unit.xlsx);
    const setting = api.parseDisplaySetting(
      workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets,
    ).ioList[0];
    const download = api.parseSdfData(await parseSdfZip(unit.zip)).ioList[0];
    api.setMediaType('display');
    const items = api.compareIO(setting, download);
    const byLabel = new Map(items.map(item => [item.label, item]));
    const expected = DISPLAY_IO_RESULT_EXPECTATIONS.get(unit.key);
    assert.deepEqual({
      name: byLabel.get('IO名')?.result,
      type: byLabel.get('IOタイプ')?.result,
      objective: byLabel.get('目標指標')?.result,
      budgetType: byLabel.get('予算タイプ')?.result,
      budget: byLabel.get('予算')?.result,
      startDate: byLabel.get('開始日')?.result,
      startTime: byLabel.get('開始時間')?.result,
      endDate: byLabel.get('終了日')?.result,
      endTime: byLabel.get('終了時間')?.result,
      pacing: byLabel.get('ペース')?.result,
      pacingRate: byLabel.get('ペース配分')?.result,
      kpi: byLabel.get('KPI')?.result,
      kpiValue: byLabel.get('KPI値')?.result,
      fq: byLabel.get('FQ')?.result,
      autoBudget: byLabel.get('予算の自動割り当て')?.result,
      optimization: byLabel.get('最適化')?.result,
    }, {
      name: expected.name, type: 'ok', objective: expected.objective, budgetType: 'ok',
      budget: expected.budget, startDate: 'ok', startTime: 'ok', endDate: expected.endDate, endTime: 'ok',
      pacing: 'ok', pacingRate: 'ok', kpi: 'ok', kpiValue: expected.kpiValue, fq: 'ok',
      autoBudget: expected.autoBudget, optimization: expected.optimization,
    }, unit.key);
  }
});

test('Display IO Pacing/KPI/FQ 使用结构化归一化而不是字符串猜测', () => {
  api.setMediaType('display');
  const setting = { name: 'IO', fields: {
    ioType: '', objective: 'クリック数を最大化', budgetNet: '1000', budgetType: '',
    startDate: '2026/7/1', startTime: '00:00', endDate: '2026/7/31', endTime: '23:59',
    pacing: '掲載期間', pacingRate: '前倒し', pacingAmount: '', kpi: 'クリック単価（CPC）', kpiValue: '¥10',
    fqTiming: '1か月', fqCount: '2回', autoBudget: 'OFF', optimization: '広告申込情報単位で入札単価と予算を手動で管理する',
  } };
  const download = { name: 'IO', rawFields: {
    'Budget Type': 'Amount', 'Auto Budget Allocation': 'False', 'Insertion Order Optimization': 'False',
  }, fields: {
    ioType: 'Standard', ioSubtype: 'Default', objective: 'Click', budgetType: 'Amount',
    budgetSegments: '(1000; 07/01/2026; 07/31/2026; ; なし;);', pacing: 'Flight', pacingRate: 'Ahead', pacingAmount: '0',
    kpiType: 'CPC', kpiValue: '10.0', frequencyEnabled: 'True', frequencyExposures: '2',
    frequencyPeriod: 'Months', frequencyAmount: '1', daypartTargeting: '', daypartTimeZone: '',
  } };
  const byLabel = new Map(api.compareIO(setting, download).map(item => [item.label, item]));
  for (const label of ['ペース', 'ペース配分', 'KPI', 'KPI値', 'FQ']) assert.equal(byLabel.get(label).result, 'ok', label);
});

test('Display IO 空設定只接受已确认默认值，异常默认与未知非空字段继续警告', () => {
  api.setMediaType('display');
  const normal = { name: 'IO', rawFields: {
    'Budget Type': 'Amount', 'Auto Budget Allocation': 'False', 'Insertion Order Optimization': 'False',
  }, rawFieldOrder: ['Budget Type', 'Auto Budget Allocation', 'Insertion Order Optimization'], fields: {
    ioType: 'Standard', ioSubtype: 'Default', objective: 'No Objective', budgetType: 'Amount',
    budgetSegments: '', pacing: '', pacingRate: '', pacingAmount: '0', kpiType: '', kpiValue: '',
    frequencyEnabled: 'False', frequencyExposures: '0', frequencyPeriod: 'Minutes', frequencyAmount: '0',
  } };
  const normalItems = api.compareIO({ name: 'IO', fields: {} }, normal);
  assert.equal(normalItems.find(item => item.label === 'IOタイプ').result, 'ok');
  assert.equal(normalItems.find(item => item.label === 'IOタイプ').hiddenWhenOk, true);
  assert.equal(normalItems.find(item => item.label === '予算タイプ').result, 'ok');

  const abnormal = structuredClone(normal);
  abnormal.fields.ioType = 'Guaranteed';
  abnormal.fields.ioSubtype = 'Programmatic Guaranteed';
  abnormal.rawFields['Future IO Switch'] = 'Enabled';
  abnormal.rawFieldOrder.push('Future IO Switch');
  const abnormalCore = api.compareIO({ name: 'IO', fields: {} }, abnormal);
  assert.equal(abnormalCore.find(item => item.label === 'IOタイプ').result, 'warning');
  const withFallback = api.appendDownloadOnlyItems('IO', abnormal, abnormalCore);
  const fallback = withFallback.find(item => item.rawFieldName === 'Future IO Switch');
  assert.ok(fallback);
  assert.equal(fallback.result, 'download-only');
});

test('Display IO 正式前端列与独立 comparison labels 对齐', () => {
  api.setMediaType('display');
  const keys = api.getCoreLevelColumns('IO', false).map(column => column.key);
  for (const key of ['IO名', 'ステータス', 'IOタイプ', '目標指標', '予算タイプ', '予算', '開始日', '開始時間',
    '終了日', '終了時間', 'ペース', 'ペース配分', 'KPI', 'KPI値', 'FQ', '予算の自動割り当て', '最適化']) {
    assert.ok(keys.includes(key), key);
  }
});

function compareDisplayOptimizationAndAutoBudget(optimization, sdfOptimization, autoBudget = 'OFF', sdfAutoBudget = 'False') {
  api.setMediaType('display');
  const setting = { name: 'IO', fields: { optimization, autoBudget } };
  const download = {
    name: 'IO',
    rawFields: {
      'Insertion Order Optimization': sdfOptimization,
      'Auto Budget Allocation': sdfAutoBudget,
    },
    fields: { optimization: sdfOptimization, autoBudget: sdfAutoBudget },
  };
  return new Map(api.compareIO(setting, download).map(item => [item.label, item]));
}

test('Display IO 最適化严格采用官方确认的自动 True / 手动 False 映射', () => {
  const manual = '広告申込情報単位で入札単価と予算を手動で管理する';
  const automatic = '広告掲載オーダー単位で入札単価と予算を自動で管理する';
  assert.equal(compareDisplayOptimizationAndAutoBudget(automatic, 'True').get('最適化').result, 'ok');
  assert.equal(compareDisplayOptimizationAndAutoBudget(automatic, 'False').get('最適化').result, 'mismatch');
  assert.equal(compareDisplayOptimizationAndAutoBudget(manual, 'False').get('最適化').result, 'ok');
  assert.equal(compareDisplayOptimizationAndAutoBudget(manual, 'True').get('最適化').result, 'mismatch');
  const unknown = compareDisplayOptimizationAndAutoBudget('第三の未知管理方式', 'True').get('最適化');
  assert.equal(unknown.result, 'warning');
  assert.equal(unknown.sVal, '第三の未知管理方式');
  assert.equal(unknown.dVal, 'True');
});

test('Display IO Auto Budget 的 ▼選択 正式映射为 True', () => {
  const trueItem = compareDisplayOptimizationAndAutoBudget('', 'False', '▼選択', 'True').get('予算の自動割り当て');
  const falseItem = compareDisplayOptimizationAndAutoBudget('', 'False', '▼選択', 'False').get('予算の自動割り当て');
  assert.equal(trueItem.result, 'ok');
  assert.equal(falseItem.result, 'mismatch');
});

const DISPLAY_IO_SDF_DEFAULTS = new Map([
  ['Bid Strategy Unit', { expected: 'CPC', abnormal: 'CPM' }],
  ['Bid Strategy Do Not Exceed', { expected: '0', abnormal: '10' }],
  ['Apply Floor Price For Deals', { expected: 'False', abnormal: 'True' }],
  ['Algorithm Id', { expected: '0', abnormal: '12345' }],
]);

test('6个真实 Display IO 只在001/003出现4个已确认默认字段且值完全一致', async () => {
  const nonEmptyCases = [];
  for (const unit of displayUnits) {
    const download = api.parseSdfData(await parseSdfZip(unit.zip)).ioList[0];
    const values = Object.fromEntries(Array.from(DISPLAY_IO_SDF_DEFAULTS, ([field]) => [field, String(download.rawFields[field] || '')]));
    if (Object.values(values).some(Boolean)) nonEmptyCases.push(unit.key);
    for (const [field, rule] of DISPLAY_IO_SDF_DEFAULTS) {
      assert.ok(values[field] === '' || values[field] === rule.expected, `${unit.key} ${field}`);
    }
  }
  assert.deepEqual(nonEmptyCases, ['001', '003']);
});

test('Display IO 4个正常默认字段归类为 default-hidden 且不生成前端 item', () => {
  api.setMediaType('display');
  const rawFields = Object.fromEntries(Array.from(DISPLAY_IO_SDF_DEFAULTS, ([field, rule]) => [field, rule.expected]));
  const download = { rawFields, rawFieldOrder: Array.from(DISPLAY_IO_SDF_DEFAULTS.keys()), fields: {} };
  for (const [field] of DISPLAY_IO_SDF_DEFAULTS) {
    assert.equal(api.classifySdfDownloadField('IO', field, rawFields[field], []), 'default-hidden', field);
  }
  assert.equal(api.appendDownloadOnlyItems('IO', download, []).length, 0);
});

test('Display IO 4个默认字段各自偏离时均为 warning 并显示默认期待值', () => {
  api.setMediaType('display');
  for (const [field, rule] of DISPLAY_IO_SDF_DEFAULTS) {
    const download = { rawFields: { [field]: rule.abnormal }, rawFieldOrder: [field], fields: {} };
    const items = api.appendDownloadOnlyItems('IO', download, []);
    assert.equal(items.length, 1, field);
    assert.equal(items[0].rawFieldName, field);
    assert.equal(items[0].sVal, `(デフォルト) ${rule.expected}`);
    assert.equal(items[0].dVal, rule.abnormal);
    assert.equal(items[0].result, 'warning');
  }
});

test('Display IO 4个默认字段为空时隐藏，且规则不扩散到 YouTube/OTT/LI', () => {
  for (const [field, rule] of DISPLAY_IO_SDF_DEFAULTS) {
    api.setMediaType('display');
    assert.equal(api.classifySdfDownloadField('IO', field, '', []), 'empty', `${field} empty`);
    assert.equal(api.appendDownloadOnlyItems('IO', { rawFields: { [field]: '' }, rawFieldOrder: [field] }, []).length, 0);

    for (const [media, level] of [['youtube', 'IO'], ['ott', 'IO']]) {
      api.setMediaType(media);
      assert.notEqual(api.classifySdfDownloadField(level, field, rule.expected, []), 'default-hidden', `${media}/${level}/${field}`);
    }
  }
});

test('Display IO 其他未来非空字段仍走 download-only fallback', () => {
  api.setMediaType('display');
  const field = 'Future Display IO Control';
  const items = api.appendDownloadOnlyItems('IO', { rawFields: { [field]: 'Enabled' }, rawFieldOrder: [field] }, []);
  assert.equal(items.length, 1);
  assert.equal(items[0].result, 'download-only');
});

function makeDisplayLiFixture(settingFields = {}, downloadFields = {}, rawFields = {}) {
  const setting = { name: 'Display LI', fields: {
    liType: 'ディスプレイ', startDate: '2026/7/7', endDate: '2026/8/3',
    ...settingFields,
  } };
  const raw = { Status: 'Paused', Type: 'Display', Subtype: 'Simple',
    'Start Date': '2026/07/07', 'End Date': '2026/08/03', ...rawFields };
  const download = {
    name: 'Display LI', rawFields: raw, rawFieldOrder: Object.keys(raw),
    statusInfo: { found: true, rawValue: raw.Status, normalizedValue: raw.Status },
    resolvedIo: { startDate: '2026/07/07', endDate: '2026/08/03' },
    fields: {
      status: raw.Status, type: raw.Type, subtype: raw.Subtype,
      startDate: raw['Start Date'], endDate: raw['End Date'],
      ...downloadFields,
    },
  };
  return { setting, download };
}

test('Display LI 独立路由不再返回 OTT 的動画タイプ和默认字段', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture();
  const labels = api.compareLI(setting, download).map(item => item.label);
  assert.ok(labels.includes('LIタイプ'));
  assert.ok(labels.includes('Subtype'));
  assert.ok(!labels.includes('動画タイプ'));
  assert.ok(!labels.includes('Deal ID'));
  assert.ok(!labels.includes('Inventory Source Targeting - Exclude'));
});

test('Display LI Base 比较使用普通 Bid 字段并覆盖日期预算Pacing与Revenue', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({
    budgetPacing: '掲載期間', pacingMode: '均等', budgetGross: '1000', budgetNet: '980',
    bidStrategy: '固定入札', bidTarget: '▼選択', bidPrice: '100', revenueModel: '10%',
  }, {
    startDate: 'Same as Insertion Order', endDate: 'Same as Insertion Order',
    budgetType: 'Amount', budgetAmount: '980', pacing: 'Flight', pacingRate: 'Even', pacingAmount: '0',
    bidStrategyType: 'Minimize', bidStrategyValue: '999', bidStrategyUnit: 'CPC',
    bidStrategyDoNotExceed: '0', partnerRevenueModel: 'Markup', partnerRevenueAmount: '10',
  }, {
    'Budget Type': 'Amount', 'Budget Amount': '980', 'Pacing': 'Flight', 'Pacing Rate': 'Even', 'Pacing Amount': '0',
    'Bid Strategy Type': 'Fixed', 'Bid Strategy Value': '100', 'Bid Strategy Unit': 'CPM',
    'Bid Strategy Do Not Exceed': '0',
    'TrueView Bid Strategy Type': 'Minimize', 'TrueView Bid Strategy Value': '999',
    'Partner Revenue Model': 'Markup', 'Partner Revenue Amount': '10',
  });
  const items = new Map(api.compareLI_Display_Base(setting, download).map(item => [item.label, item]));
  assert.equal(items.get('LIタイプ').result, 'ok');
  assert.equal(items.get('Subtype').result, 'ok');
  assert.equal(items.get('Subtype').hiddenWhenOk, true);
  assert.equal(items.get('開始日').result, 'ok');
  assert.equal(items.get('終了日').result, 'ok');
  assert.equal(items.get('予算期間 / Budget Type').result, 'ok');
  assert.equal(items.get('予算').result, 'ok');
  assert.equal(items.get('配信ペース / Pacing').result, 'ok');
  assert.equal(items.get('入札形式').result, 'ok');
  assert.match(items.get('入札形式').dVal, /Fixed/);
  assert.doesNotMatch(items.get('入札形式').dVal, /Minimize/);
  assert.equal(items.get('目標単価').result, 'ok');
  assert.equal(items.get('入札単価').result, 'ok');
  assert.equal(items.get('入札単価').dVal, '100');
  assert.equal(items.get('収益モデル').result, 'ok');
});

test('Display LI Status 只保留案件区分列且初期案件 Draft/Paused=OK、Active=mismatch', () => {
  api.setMediaType('display');
  api.setSelectedDv360CaseType('initial');
  for (const [status, expected] of [['Draft', 'ok'], ['Paused', 'ok'], ['Active', 'mismatch']]) {
    const { setting, download } = makeDisplayLiFixture({}, { status }, { Status: status });
    download.statusInfo = { found: true, rawValue: status, normalizedValue: status };
    download.fields.status = status;
    const items = api.compareLI_Display_Base(setting, download);
    assert.equal(items.find(item => item.label === 'ステータス').result, expected, status);
    assert.equal(items.some(item => item.key === 'raw_sdf__status'), false, status);
  }
  assert.equal(api.getCoreLevelColumns('LI', false).some(column => column.key === 'raw_sdf__status'), false);
});

test('Display LI Subtype 未指定时 Simple 是隐藏默认，非 Simple 保留实际值并 warning', () => {
  api.setMediaType('display');
  const simple = makeDisplayLiFixture({}, { subtype: 'Simple' }, { Subtype: 'Simple' });
  const simpleItem = api.compareLI_Display_Base(simple.setting, simple.download)
    .find(item => item.label === 'Subtype');
  assert.deepEqual(
    { dVal: simpleItem.dVal, result: simpleItem.result, hiddenWhenOk: simpleItem.hiddenWhenOk },
    { dVal: 'Simple', result: 'ok', hiddenWhenOk: true },
  );

  const nonSimple = makeDisplayLiFixture({}, { subtype: 'Exchange' }, { Subtype: 'Exchange' });
  const nonSimpleItem = api.compareLI_Display_Base(nonSimple.setting, nonSimple.download)
    .find(item => item.label === 'Subtype');
  assert.equal(nonSimpleItem.dVal, 'Exchange');
  assert.equal(nonSimpleItem.result, 'warning');
  assert.notEqual(nonSimpleItem.hiddenWhenOk, true);
});

test('Display LI Pacing 使用正式映射并接受 ▼選択 默认 Flight/Ahead/0', () => {
  api.setMediaType('display');
  const cases = [
    ['掲載期間', 'できるだけ早く', 'Flight', 'ASAP'],
    ['日次', '均等', 'Daily', 'Even'],
    ['掲載期間', '前倒し', 'Flight', 'Ahead'],
  ];
  for (const [settingPacing, settingRate, sdfPacing, sdfRate] of cases) {
    const { setting, download } = makeDisplayLiFixture(
      { budgetPacing: settingPacing, pacingMode: settingRate },
      { pacing: sdfPacing, pacingRate: sdfRate, pacingAmount: '0' },
      { Pacing: sdfPacing, 'Pacing Rate': sdfRate, 'Pacing Amount': '0' },
    );
    const item = api.compareLI_Display_Base(setting, download)
      .find(entry => entry.label === '配信ペース / Pacing');
    assert.equal(item.result, 'ok', `${settingPacing}/${settingRate}`);
  }

  const standard = makeDisplayLiFixture(
    { budgetPacing: '▼選択', pacingMode: '▼選択' },
    { pacing: 'Flight', pacingRate: 'Ahead', pacingAmount: '0' },
    { Pacing: 'Flight', 'Pacing Rate': 'Ahead', 'Pacing Amount': '0' },
  );
  const standardItem = api.compareLI_Display_Base(standard.setting, standard.download)
    .find(entry => entry.label === '配信ペース / Pacing');
  assert.equal(standardItem.result, 'ok');
  assert.equal(standardItem.mpDetail, '');

  const unconfirmed = makeDisplayLiFixture(
    { budgetPacing: '▼選択', pacingMode: '▼選択' },
    { pacing: 'Flight', pacingRate: 'ASAP', pacingAmount: '0' },
    { Pacing: 'Flight', 'Pacing Rate': 'ASAP', 'Pacing Amount': '0' },
  );
  assert.equal(api.compareLI_Display_Base(unconfirmed.setting, unconfirmed.download)
    .find(entry => entry.label === '配信ペース / Pacing').result, 'warning');
});

test('Display LI Bid Strategy 按 Type/Unit 正式映射并接受标准默认组合', () => {
  api.setMediaType('display');
  const cases = [
    ['固定入札', 'Fixed', 'CPM'],
    ['コンバージョン数を最大化', 'Minimize', 'CPA'],
    ['クリック数を最大化', 'Minimize', 'CPC'],
    ['視認範囲のインプレッションを最大化', 'Optimize vCPM', ''],
  ];
  for (const [settingBid, sdfType, sdfUnit] of cases) {
    const { setting, download } = makeDisplayLiFixture(
      { bidStrategy: settingBid, bidTarget: '▼選択', bidPrice: settingBid === '固定入札' ? '100' : '' },
      { bidStrategyType: sdfType, bidStrategyUnit: sdfUnit, bidStrategyDoNotExceed: '0', bidStrategyValue: settingBid === '固定入札' ? '100' : '0' },
      { 'Bid Strategy Type': sdfType, 'Bid Strategy Unit': sdfUnit, 'Bid Strategy Do Not Exceed': '0', 'Bid Strategy Value': settingBid === '固定入札' ? '100' : '0' },
    );
    const items = new Map(api.compareLI_Display_Base(setting, download).map(item => [item.label, item]));
    assert.equal(items.get('入札形式').result, 'ok', settingBid);
    if (settingBid === '固定入札') assert.equal(items.get('入札単価').result, 'ok');
  }

  const standard = makeDisplayLiFixture(
    { bidStrategy: '▼選択', bidTarget: '▼選択' },
    { bidStrategyType: 'Minimize', bidStrategyUnit: 'CPC', bidStrategyDoNotExceed: '0', bidStrategyValue: '0' },
    { 'Bid Strategy Type': 'Minimize', 'Bid Strategy Unit': 'CPC', 'Bid Strategy Do Not Exceed': '0', 'Bid Strategy Value': '0' },
  );
  assert.equal(api.compareLI_Display_Base(standard.setting, standard.download)
    .find(item => item.label === '入札形式').result, 'ok');

  const unknown = makeDisplayLiFixture(
    { bidStrategy: '▼選択', bidTarget: '▼選択' },
    { bidStrategyType: 'Future Strategy', bidStrategyUnit: 'CPC', bidStrategyDoNotExceed: '0' },
    { 'Bid Strategy Type': 'Future Strategy', 'Bid Strategy Unit': 'CPC', 'Bid Strategy Do Not Exceed': '0' },
  );
  assert.equal(api.compareLI_Display_Base(unknown.setting, unknown.download)
    .find(item => item.label === '入札形式').result, 'warning');
});

test('Display LI 固定入札仍正式比较 Bid Strategy Value', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture(
    { bidStrategy: '固定入札', bidTarget: '▼選択', bidPrice: '100' },
    { bidStrategyType: 'Fixed', bidStrategyUnit: 'CPM', bidStrategyDoNotExceed: '0', bidStrategyValue: '101' },
    { 'Bid Strategy Type': 'Fixed', 'Bid Strategy Unit': 'CPM', 'Bid Strategy Do Not Exceed': '0', 'Bid Strategy Value': '101' },
  );
  assert.equal(api.compareLI_Display_Base(setting, download)
    .find(item => item.label === '入札単価').result, 'mismatch');
});

test('Display LI Base 对未知 Type 和无法确认的金额关系保持 warning', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({
    liType: '第三种类型', budgetNet: '980', bidStrategy: '未知戦略', bidPrice: '100',
  }, {
    budgetType: 'Unlimited', budgetAmount: '', bidStrategyType: 'Minimize', bidStrategyValue: '0',
  }, {
    Type: 'Display', 'Budget Type': 'Unlimited', 'Budget Amount': '',
    'Bid Strategy Type': 'Minimize', 'Bid Strategy Value': '0',
  });
  const items = new Map(api.compareLI_Display_Base(setting, download).map(item => [item.label, item]));
  assert.equal(items.get('LIタイプ').result, 'warning');
  assert.equal(items.get('予算').result, 'warning');
  assert.equal(items.get('入札形式').result, 'warning');
  assert.equal(items.get('入札単価').result, 'warning');
});

test('Display LI Base Revenue 的数值 0 不得被当成空值', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ revenueModel: 0 }, {
    partnerRevenueModel: 'TMCM', partnerRevenueAmount: '0',
  }, { 'Partner Revenue Model': 'TMCM', 'Partner Revenue Amount': '0' });
  const item = api.compareLI_Display_Base(setting, download).find(entry => entry.label === '収益モデル');
  assert.equal(item.sVal, '0');
  assert.equal(item.result, 'ok');
});

test('Display LI Targeting 独立比较 Language Device Environment Daypart', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({
    language: 'Japanese', devicePC: '●', deviceSP: '●', deviceTablet: '●', deviceCTV: '',
    environment: 'ウェブ＆アプリ', daypart: '月曜日 10:00～24:00',
  }, {
    languageTargeting: '1005;', deviceTargetingInclude: '30000; 30001; 30002;',
    deviceTargetingExclude: '30004;', environmentTargeting: 'Web; App;',
    daypartTargeting: '304096;', daypartTimeZone: 'Advertiser',
  }, {
    'Language Targeting - Include': '1005;',
    'Device Targeting - Include': '30000; 30001; 30002;', 'Device Targeting - Exclude': '30004;',
    'Environment Targeting': 'Web; App;', 'Daypart Targeting': '304096;',
    'Daypart Targeting Time Zone': 'Advertiser',
  });
  const items = new Map(api.compareLI_Display_Targeting(setting, download).map(item => [item.label, item]));
  assert.equal(items.get('言語').result, 'ok');
  assert.equal(items.get('デバイス').result, 'ok');
  assert.equal(items.get('環境').result, 'ok');
  assert.equal(items.get('曜日と時間').result, 'ok');
  assert.equal(items.get('Daypart Time Zone').result, 'ok');
});

test('Display LI Device Targeting 将 630159 拆为 Android，Device 只比较 Smartphone', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({
    deviceSP: '●', osModel: 'Android',
  }, {
    deviceTargetingInclude: '30001; 630159;', deviceTargetingExclude: '30000; 30002; 30004;',
  }, {
    'Device Targeting - Include': '30001; 630159;',
    'Device Targeting - Exclude': '30000; 30002; 30004;',
  });
  const items = new Map(api.compareLI_Display_Targeting(setting, download).map(item => [item.label, item]));
  assert.equal(items.get('デバイス').result, 'ok');
  assert.doesNotMatch(items.get('デバイス').dVal, /630159|未識別/);
  assert.equal(items.get('OS / Model').result, 'ok');
  assert.match(items.get('OS / Model').dVal, /Android.*630159/);
});

test('Display LI 未知的非设备 ID 只在 OS / Model warning，不污染 Device 判定', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ deviceSP: '●', osModel: 'Android' }, {}, {
    'Device Targeting - Include': '30001; 999999;',
    'Device Targeting - Exclude': '30000; 30002; 30004;',
  });
  const items = new Map(api.compareLI_Display_Targeting(setting, download).map(item => [item.label, item]));
  assert.equal(items.get('デバイス').result, 'ok');
  assert.doesNotMatch(items.get('デバイス').dVal, /999999|未識別/);
  assert.equal(items.get('OS / Model').result, 'warning');
  assert.match(items.get('OS / Model').dVal, /999999.*未識別/);
});

test('Display LI OS / Model 不再把旧 Operating System Targeting 独立列作为来源', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ osModel: 'Android' }, {}, {
    'Operating System Targeting - Include': '630159;',
  });
  const item = api.compareLI_Display_Targeting(setting, download).find(entry => entry.label === 'OS / Model');
  assert.equal(item.result, 'warning');
  assert.doesNotMatch(item.dVal, /630159/);
  assert.equal(api.compareLI_Display_WarningFields(setting, download).some(item => item.label === 'OS / Model'), false);
});

test('Display LI ウェブ＆アプリ + Environment 空欄は隐藏 OK、明确限制继续正式比较', () => {
  api.setMediaType('display');
  const standard = makeDisplayLiFixture({ environment: 'ウェブ＆アプリ' }, {}, { 'Environment Targeting': '' });
  const standardItem = api.compareLI_Display_Targeting(standard.setting, standard.download)
    .find(item => item.label === '環境');
  assert.equal(standardItem.result, 'ok');
  assert.equal(standardItem.hiddenWhenOk, true);

  const webOnly = makeDisplayLiFixture({ environment: 'ウェブ' }, {}, { 'Environment Targeting': 'Web;' });
  const webOnlyItem = api.compareLI_Display_Targeting(webOnly.setting, webOnly.download)
    .find(item => item.label === '環境');
  assert.equal(webOnlyItem.result, 'ok');
  assert.notEqual(webOnlyItem.hiddenWhenOk, true);
});

test('Display LI Targeting 一侧缺失为 warning 且双方空不生成', () => {
  api.setMediaType('display');
  const oneSided = makeDisplayLiFixture({ language: 'Japanese' }, {}, {});
  const oneItems = new Map(api.compareLI_Display_Targeting(oneSided.setting, oneSided.download).map(item => [item.label, item]));
  assert.equal(oneItems.get('言語').result, 'warning');
  assert.ok(!oneItems.has('デバイス'));
  assert.ok(!oneItems.has('環境'));
  assert.ok(!oneItems.has('曜日と時間'));

  const empty = makeDisplayLiFixture({}, {}, {});
  assert.equal(api.compareLI_Display_Targeting(empty.setting, empty.download).length, 0);
});

test('Display LI Targeting 全天默认不要求 Daypart Time Zone', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ daypart: 'ALL' }, { daypartTargeting: '', daypartTimeZone: '' }, {
    'Daypart Targeting': '', 'Daypart Targeting Time Zone': '',
  });
  const items = new Map(api.compareLI_Display_Targeting(setting, download).map(item => [item.label, item]));
  assert.equal(items.get('曜日と時間').result, 'ok');
  assert.ok(!items.has('Daypart Time Zone'));
});

test('Display LI Geography 使用独立入口比较日本地域', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ geography: 'Japan' }, {
    geographyTargetingInclude: '2392;', geographyTargetingExclude: '',
  }, { 'Geography Targeting - Include': '2392;', 'Geography Targeting - Exclude': '' });
  const items = api.compareLI_Display_Geography(setting, download);
  assert.equal(items.length, 1);
  assert.equal(items[0].label, '地域 / Geography Targeting');
  assert.equal(items[0].result, 'ok');
});

test('Display LI Demographic 独立模块复用共通 helper，四项 OK 也保持前端可见', () => {
  api.setMediaType('display');
  assert.equal(typeof api.compareLI_Display_Demographic, 'function');
  const { setting, download } = makeDisplayLiFixture({
    gender: 'すべて', genderUnknown: '不明あり',
    age: '25-34', ageUnknown: '不明なし',
    parentalStatus: 'ALL(不明あり)',
    householdIncome: 'ALL', householdIncomeUnknown: '不明あり',
  }, {
    demographicGender: 'Male; Female; Unknown;', demographicAge: '25-34;',
    demographicParental: 'Not a parent; Parent; Unknown;',
    demographicIncome: 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;',
  }, {
    'Demographic Targeting Gender': 'Male; Female; Unknown;',
    'Demographic Targeting Age': '25-34;',
    'Demographic Targeting Parental Status': 'Not a parent; Parent; Unknown;',
    'Demographic Targeting Household Income': 'Top 10%; 11-20%; 21-30%; 31-40%; 41-50%; Lower 50%; Unknown;',
  });
  const items = api.compareLI_Display_Demographic(setting, download);
  assert.deepEqual(Array.from(items, item => item.label), ['性別', '年齢', '子供の有無', '世帯年収']);
  assert.ok(items.every(item => item.result === 'ok'));
  assert.ok(items.every(item => item.hiddenWhenOk !== true));
  assert.equal(items.find(item => item.label === '年齢').sVal, '25-34 / 年齢 不明: 不明なし');
  assert.deepEqual(Array.from(items.find(item => item.label === '年齢').normalizedSetting), ['25-34']);
  assert.deepEqual(Array.from(items.find(item => item.label === '年齢').normalizedDownload), ['25-34']);
});

test('Display LI 年齢 Unknown 不明なしは Download Unknown を extra mismatch 判定する', () => {
  api.setMediaType('display');
  const withoutUnknown = makeDisplayLiFixture({ age: '25-34', ageUnknown: '不明なし' }, {}, {
    'Demographic Targeting Age': '25-34;',
  });
  const normal = api.compareLI_Display_Demographic(withoutUnknown.setting, withoutUnknown.download)
    .find(item => item.label === '年齢');
  assert.equal(normal.result, 'ok');
  assert.equal(normal.unknownRequirement, 'exclude');
  assert.deepEqual(Array.from(normal.extra), []);

  const withUnknown = makeDisplayLiFixture({ age: '25-34', ageUnknown: '不明なし' }, {}, {
    'Demographic Targeting Age': '25-34; Unknown;',
  });
  const abnormal = api.compareLI_Display_Demographic(withUnknown.setting, withUnknown.download)
    .find(item => item.label === '年齢');
  assert.equal(abnormal.result, 'mismatch');
  assert.deepEqual(Array.from(abnormal.extra), ['unknown']);
  assert.match(abnormal.mpDetail, /追加：Unknown/);
});

test('Display LI SDF v10 年齢 18; +; False を全年齢かつ Unknown除外として正式比較する', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ age: '全年齢', ageUnknown: '不明なし' }, {}, {
    'Demographic Targeting Age': '18; +; False;',
  });
  const item = api.compareLI_Display_Demographic(setting, download).find(entry => entry.label === '年齢');
  assert.equal(item.sVal, '全年齢 / 年齢 不明: 不明なし');
  assert.equal(item.dVal, '18; +; False;');
  assert.equal(item.result, 'ok');
  assert.equal(item.unknownRequirement, 'exclude');
  assert.deepEqual(Array.from(item.normalizedDownload), ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']);
  assert.deepEqual(Array.from(item.extra), []);
});

test('Display LI Demographic 双方无值不生成，任一侧有值必须生成正式业务 item', () => {
  api.setMediaType('display');
  const empty = makeDisplayLiFixture();
  const emptyItems = api.compareLI_Display_Demographic(empty.setting, empty.download);
  assert.equal(emptyItems.length, 4);
  assert.ok(emptyItems.every(item => item.alwaysDisplay === true));

  const settingOnly = makeDisplayLiFixture({ parentalStatus: 'ALL(不明あり)' });
  const settingOnlyItem = api.compareLI_Display_Demographic(settingOnly.setting, settingOnly.download)
    .find(item => item.label === '子供の有無');
  assert.ok(settingOnlyItem);
  assert.equal(settingOnlyItem.result, 'ok');

  const downloadOnly = makeDisplayLiFixture({}, {}, { 'Demographic Targeting Gender': 'Male;' });
  const downloadOnlyItem = api.compareLI_Display_Demographic(downloadOnly.setting, downloadOnly.download)
    .find(item => item.label === '性別');
  assert.ok(downloadOnlyItem);
  assert.equal(downloadOnlyItem.result, 'warning');
});

test('Display LI warning-only 字段逐项显示原始 S/D 且不判 mismatch', () => {
  api.setMediaType('display');
  const cases = [
    ['Browser', 'browser', 'Safari', 'Browser Targeting - Include', '500000;'],
    ['Connection Speed', 'connectionSpeed', 'すべて', 'Connection Speed Targeting', 'Broadband;'],
    ['Carrier', 'carrier', '指定なし', 'Carrier and ISP Targeting - Include', '123;'],
    ['Position', 'position', 'ALL', 'Position Targeting - On Screen', 'Above the fold;'],
    ['Category', 'category', 'カテゴリA', 'Category Targeting - Include', '10;'],
  ];
  for (const [label, settingKey, settingValue, rawHeader, downloadValue] of cases) {
    const { setting, download } = makeDisplayLiFixture({ [settingKey]: settingValue }, {}, { [rawHeader]: downloadValue });
    const items = api.compareLI_Display_WarningFields(setting, download);
    const item = items.find(entry => entry.label === label);
    assert.ok(item, label);
    assert.equal(item.sVal, settingValue);
    assert.equal(item.dVal, downloadValue);
    assert.equal(item.result, 'warning');
  }
});

test('Display LI Carrier 消费 SDF v10 Carrier Targeting Include/Exclude header', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({ carrier: 'キャリアA' }, {}, {
    'Carrier Targeting - Include': '123;', 'Carrier Targeting - Exclude': '456;',
  });
  const item = api.compareLI_Display_WarningFields(setting, download)
    .find(entry => entry.label === 'Carrier');
  assert.ok(item);
  assert.equal(item.sVal, 'キャリアA');
  assert.equal(item.dVal, '123; / 456;');
  assert.equal(item.result, 'warning');
  assert.deepEqual(Array.from(item.sourceSdfFields), [
    'Carrier Targeting - Include', 'Carrier Targeting - Exclude',
    'Carrier and ISP Targeting - Include', 'Carrier and ISP Targeting - Exclude',
  ]);
});

test('Display LI Viewability 百分比只比较 Active View，Omid=True 作为辅助值', () => {
  api.setMediaType('display');
  for (const [settingValue, activeView] of [['10%以上', '0.1'], ['40%以上', '0.4'], ['90%以上', '0.9']]) {
    const { setting, download } = makeDisplayLiFixture({ viewability: settingValue }, {}, {
      'Viewability Omid Targeting Enabled': 'True',
      'Viewability Targeting Active View': activeView,
    });
    const item = api.compareLI_Display_WarningFields(setting, download).find(entry => entry.label === 'Viewability');
    assert.equal(item.result, 'ok', settingValue);
    assert.match(item.dVal, new RegExp(activeView.replace('.', '\\.')));
  }
  const omidOnly = makeDisplayLiFixture({ viewability: '40%以上' }, {}, {
    'Viewability Omid Targeting Enabled': 'True', 'Viewability Targeting Active View': '',
  });
  assert.equal(api.compareLI_Display_WarningFields(omidOnly.setting, omidOnly.download)
    .find(item => item.label === 'Viewability').result, 'warning');
});

test('Display LI six Site/App targeting checks remain visible and four default-to-empty fields ignore App URL', () => {
  api.setMediaType('display');
  const emptyTargeting = {
    'Site Targeting - Include': '', 'Site Targeting - Exclude': '',
    'App Targeting - Include': '', 'App Targeting - Exclude': '',
    'App Collection Targeting - Include': '', 'App Collection Targeting - Exclude': '',
  };
  for (const settingValue of ['指定無し', '設定なし', '']) {
    const { setting, download } = makeDisplayLiFixture({ appUrl: settingValue }, {}, emptyTargeting);
    const item = api.compareLI_Display_SiteAppTargeting(setting, download).find(entry => entry.label === 'Site Targeting - Include');
    assert.equal(item.result, 'ok', settingValue || '(空)');
    assert.equal(item.alwaysDisplay, true, settingValue || '(空)');
  }
  const specified = makeDisplayLiFixture({ appUrl: 'example.com' }, {}, { 'Site Targeting - Include': 'example.com;' });
  const specifiedItem = api.compareLI_Display_SiteAppTargeting(specified.setting, specified.download)
    .find(item => item.label === 'Site Targeting - Include');
  assert.equal(specifiedItem.result, 'mismatch');
  assert.equal(specifiedItem.alwaysDisplay, true);
});

test('Display LI Optimized Targeting 未指定/チェックなし + False 隐藏，True 继续 warning', () => {
  api.setMediaType('display');
  for (const settingValue of ['設定なし', '未指定', 'チェックなし', '']) {
    const normal = makeDisplayLiFixture({ optimizedTargeting: settingValue }, {}, { 'Optimized Targeting': 'False' });
    const item = api.compareLI_Display_WarningFields(normal.setting, normal.download)
      .find(entry => entry.label === 'Optimized Targeting');
    assert.equal(item.result, 'ok', settingValue || '(空)');
    assert.equal(item.hiddenWhenOk, true, settingValue || '(空)');
  }
  const abnormal = makeDisplayLiFixture({ optimizedTargeting: '設定なし' }, {}, { 'Optimized Targeting': 'True' });
  assert.equal(api.compareLI_Display_WarningFields(abnormal.setting, abnormal.download)
    .find(item => item.label === 'Optimized Targeting').result, 'warning');
  const checkedAbnormal = makeDisplayLiFixture({ optimizedTargeting: 'チェックなし' }, {}, { 'Optimized Targeting': 'True' });
  assert.equal(api.compareLI_Display_WarningFields(checkedAbnormal.setting, checkedAbnormal.download)
    .find(item => item.label === 'Optimized Targeting').result, 'warning');
});

test('Display LI Browser/Connection Speed/Viewability/Position 业务默认正确时 ok + hiddenWhenOk', () => {
  api.setMediaType('display');
  const cases = [
    ['Browser', 'browser', 'ALL', {}],
    ['Connection Speed', 'connectionSpeed', 'すべての接続速度', {}],
    ['Viewability', 'viewability', 'すべてのインプレッション', { 'Viewability Omid Targeting Enabled': 'True' }],
    ['Position', 'position', 'ALL', {}],
  ];
  for (const [label, settingKey, settingValue, rawFields] of cases) {
    const { setting, download } = makeDisplayLiFixture({ [settingKey]: settingValue }, {}, rawFields);
    const item = api.compareLI_Display_WarningFields(setting, download).find(entry => entry.label === label);
    assert.ok(item, label);
    assert.equal(item.result, 'ok', label);
    assert.equal(item.hiddenWhenOk, true, label);
  }
});

const DISPLAY_LI_RAW_DEFAULTS = new Map([
  ['Frequency Period', { expected: 'Minutes', abnormal: 'Days' }],
  ['Frequency Amount', { expected: '0', abnormal: '2' }],
  ['Apply Floor Price For Deals', { expected: 'False', abnormal: 'True' }],
  ['Inventory Source Targeting - Target New Exchanges', { expected: 'True', abnormal: 'False' }],
  ['TrueView Category Exclusions Targeting', { expected: '', abnormal: 'Politics;' }],
  ['Algorithm Id', { expected: '0', abnormal: 'Minutes' }],
]);

test('Display LI 专用 raw 默认规则正确值为 ok + hiddenWhenOk，偏离为 warning', () => {
  api.setMediaType('display');
  for (const [field, rule] of DISPLAY_LI_RAW_DEFAULTS) {
    const normal = api.appendDownloadOnlyItems('LI', {
      rawFields: { [field]: rule.expected }, rawFieldOrder: [field], fields: {},
    }, []);
    const normalItem = normal.find(item => item.rawFieldName === field);
    assert.ok(normalItem, `${field} default item`);
    assert.equal(normalItem.result, 'ok', field);
    assert.equal(normalItem.hiddenWhenOk, true, field);

    const abnormal = api.appendDownloadOnlyItems('LI', {
      rawFields: { [field]: rule.abnormal }, rawFieldOrder: [field], fields: {},
    }, []);
    const abnormalItem = abnormal.find(item => item.rawFieldName === field);
    assert.ok(abnormalItem, `${field} abnormal item`);
    assert.equal(abnormalItem.result, 'warning', field);
    assert.equal(abnormalItem.dVal, rule.abnormal, field);
  }
});

test('Display LI Fees 仅将已确认的零金额组合作为隐藏补足字段', () => {
  api.setMediaType('display');
  const confirmed = [
    '(Media; 0.0; Display & Video 360 Fee; True;);',
    '(CPM; 0; DoubleVerify Pre-Bid; True;); (Media; 0.0; Display & Video 360 Fee; True;);',
  ];
  for (const value of confirmed) {
    const items = api.appendDownloadOnlyItems('LI', {
      rawFields: { Fees: value }, rawFieldOrder: ['Fees'], fields: {},
    }, []);
    const item = items.find(entry => entry.rawFieldName === 'Fees');
    assert.equal(item.result, 'ok', value);
    assert.equal(item.hiddenWhenOk, true, value);
  }
  for (const value of [
    '(CPM; 5; DoubleVerify Pre-Bid; True;); (Media; 0.0; Display & Video 360 Fee; True;);',
    '(CPM; 0; Unconfirmed Fee; True;); (Media; 0.0; Display & Video 360 Fee; True;);',
  ]) {
    const items = api.appendDownloadOnlyItems('LI', {
      rawFields: { Fees: value }, rawFieldOrder: ['Fees'], fields: {},
    }, []);
    const item = items.find(entry => entry.rawFieldName === 'Fees');
    assert.equal(item.result, 'warning', value);
    assert.equal(item.dVal, value);
  }
});

test('Display LI Inventory 补足字段保留实际值但不借用 OTT 默认集合', () => {
  api.setMediaType('display');
  const authorized = 'Authorized Direct Sellers And Resellers';
  const exclude = '79; 112; 101; 104; 105; 110; 114; 120; 122; 123;';
  const record = {
    rawFields: {
      'Inventory Source Targeting - Authorized Seller Options': authorized,
      'Inventory Source Targeting - Exclude': exclude,
    },
    rawFieldOrder: [
      'Inventory Source Targeting - Authorized Seller Options',
      'Inventory Source Targeting - Exclude',
    ], fields: {},
  };
  const items = api.appendDownloadOnlyItems('LI', record, []);
  const authorizedItem = items.find(item => item.rawFieldName === 'Inventory Source Targeting - Authorized Seller Options');
  assert.equal(authorizedItem.dVal, authorized);
  assert.notEqual(authorizedItem.source, 'raw-sdf-ott-default');
  assert.equal(items.some(item => item.rawFieldName === 'Inventory Source Targeting - Exclude'), false);
  assert.equal(record.rawFields['Inventory Source Targeting - Exclude'], exclude);
});

test('Display LI 专用默认规则不扩散到 YouTube / OTT', () => {
  api.setMediaType('youtube');
  assert.equal(api.classifySdfDownloadField(
    'LI', 'Inventory Source Targeting - Target New Exchanges', 'True', [],
  ), 'dynamic');
  api.setMediaType('ott');
  assert.equal(api.classifySdfDownloadField(
    'LI', 'Inventory Source Targeting - Target New Exchanges', 'True', [],
  ), 'ott-default-warning');
  assert.equal(api.classifySdfDownloadField('LI', 'Algorithm Id', '0', []), 'default-hidden');
});

test('Display LI Keyword and Brand Safety stay visible even when empty; Audience remains out of comparison', () => {
  api.setMediaType('display');
  const empty = makeDisplayLiFixture();
  assert.equal(
    Array.from(api.compareLI_Display_WarningFields(empty.setting, empty.download), item => item.label).sort().join('|'),
    'Brand Safety|Keyword',
  );
  const audience = makeDisplayLiFixture({
    audienceFirstPartyPartner: 'Audience A', audienceGoogle: 'Affinity A',
    audienceCustomList: 'Custom A', audienceCombined: 'Combined A',
  }, {}, {
    'Audience Targeting - Include': '1;', 'Affinity & In Market Targeting - Include': '2;',
    'Custom List Targeting': '3;', 'Combined Audience Targeting': '4;',
  });
  assert.equal(
    Array.from(api.compareLI_Display_WarningFields(audience.setting, audience.download), item => item.label).sort().join('|'),
    'Brand Safety|Keyword',
  );
});

test('Display LI 前端列采用独立顺序并删除旧 OTT 风格列', () => {
  api.setMediaType('display');
  const keys = Array.from(api.getCoreLevelColumns('LI', false), column => column.key);
  assert.deepEqual(keys, [
    'ステータス', 'LIタイプ', 'Subtype', '開始日', '終了日',
    '予算期間 / Budget Type', '配信ペース / Pacing', '予算', '入札形式', '目標単価', '入札単価',
    '収益モデル', '言語', 'デバイス', '環境', '曜日と時間', 'Daypart Time Zone',
    '地域 / Geography Targeting', '性別', '年齢', '子供の有無', '世帯年収',
    'Brand Safety', 'Browser', 'OS / Model', 'Connection Speed',
    'Carrier', 'Viewability', 'Position', 'Keyword', 'Category',
    'Site Targeting - Include', 'Site Targeting - Exclude',
    'App Targeting - Include', 'App Targeting - Exclude',
    'App Collection Targeting - Include', 'App Collection Targeting - Exclude', 'Optimized Targeting',
  ]);
  assert.ok(!keys.includes('動画タイプ'));
  assert.ok(!keys.includes('課金形態'));
  assert.ok(!keys.includes('広告枠ソース'));
});

test('Display LI 前端列只保留实际存在 compItem 的列', () => {
  api.setMediaType('display');
  api.setTreeRoots([{ level: 'LI', name: 'LI', found: true, status: 'ok', children: [], compItems: [
    { label: 'LIタイプ', sVal: 'ディスプレイ', dVal: 'Display', result: 'ok' },
  ] }]);
  assert.deepEqual(Array.from(api.getLevelColumns('LI'), column => column.key), ['LIタイプ']);
  api.setTreeRoots([]);
});

test('001 当前两个 Display 实案件隐藏业务默认且保留 Active 异常', async () => {
  const unit = displayUnits.find(item => item.key === '001');
  const { tree } = await buildDisplayTree(unit);
  const liNodes = collectTreeNodes(tree.roots).filter(node => node.level === 'LI' && node.found);
  assert.equal(liNodes.length, 2);
  for (const node of liNodes) {
    assert.equal(node.compItems.some(item => item.key === 'raw_sdf__status'), false, node.name);
    assert.equal(node.compItems.some(item => item.label === 'Subtype'), false, node.name);
    for (const label of ['Browser', 'Connection Speed', 'Viewability', 'Position']) {
      assert.equal(node.compItems.some(item => item.label === label), false, `${node.name} ${label}`);
    }
    for (const field of DISPLAY_LI_RAW_DEFAULTS.keys()) {
      assert.equal(node.compItems.some(item => item.rawFieldName === field), false, `${node.name} ${field}`);
    }
    assert.equal(node.compItems.find(item => item.label === 'ステータス').result, 'mismatch', node.name);
    assert.notEqual(node.compItems.find(item => item.label === '収益モデル').result, 'warning', node.name);
  }
});

test('004 四个 Display LI 将 Smartphone 与 Android 拆分并消除确认済み默认 warning', async () => {
  const unit = displayUnits.find(item => item.key === '004');
  const { tree, settingRaw, downloadRaw } = await buildDisplayTree(unit);
  assert.equal(settingRaw.liList.length, 4);
  assert.equal(downloadRaw.liList.length, 4);
  for (const settingLi of settingRaw.liList) {
    assert.equal(settingLi.fields.deviceSP, '●', settingLi.name);
    assert.equal(settingLi.fields.osModel, 'Android (Operating System)', settingLi.name);
    assert.equal(settingLi.fields.budgetPacing, '掲載期間', settingLi.name);
    assert.equal(settingLi.fields.environment, 'ウェブ＆アプリ', settingLi.name);
    assert.equal(settingLi.fields.viewability, '40%以上', settingLi.name);
  }
  for (const downloadLi of downloadRaw.liList) {
    assert.match(downloadLi.rawFields['Device Targeting - Include'], /30001; 630159;/, downloadLi.name);
    assert.equal(downloadLi.rawFields['Viewability Targeting Active View'], '0.4', downloadLi.name);
    assert.equal(downloadLi.rawFields['Inventory Source Targeting - Authorized Seller Options'],
      'Authorized Direct Sellers And Resellers', downloadLi.name);
  }
  const liNodes = collectTreeNodes(tree.roots).filter(node => node.level === 'LI' && node.found);
  assert.equal(liNodes.length, 4);
  for (const node of liNodes) {
    const byLabel = new Map(node.compItems.map(item => [item.label, item]));
    assert.equal(byLabel.get('予算期間 / Budget Type').result, 'ok', node.name);
    assert.equal(byLabel.get('デバイス').result, 'ok', node.name);
    assert.doesNotMatch(byLabel.get('デバイス').dVal, /630159|未識別/, node.name);
    assert.equal(byLabel.get('OS / Model').result, 'ok', node.name);
    assert.match(byLabel.get('OS / Model').dVal, /Android.*630159/, node.name);
    assert.equal(byLabel.get('Viewability').result, 'ok', node.name);
    assert.equal(node.compItems.some(item => ['環境', 'App URL', 'Optimized Targeting'].includes(item.label)), false, node.name);
    assert.equal(node.compItems.some(item => item.rawFieldName === 'Fees'), false, node.name);
    assert.equal(node.compItems.some(item => item.rawFieldName === 'Inventory Source Targeting - Exclude'), false, node.name);
  }
});

test('005-87/91 两个 Display LI 隐藏确认済み默认并保留真实 targeting 警告', async () => {
  for (const key of ['005-87', '005-91']) {
    const unit = displayUnits.find(item => item.key === key);
    const { tree, settingRaw } = await buildDisplayTree(unit);
    assert.equal(settingRaw.liList.length, 2, key);
    for (const settingLi of settingRaw.liList) {
      assert.equal(settingLi.fields.browser, 'ALL', `${key} ${settingLi.name} Browser`);
      assert.equal(settingLi.fields.connectionSpeed, 'すべての接続速度', `${key} ${settingLi.name} Connection Speed`);
      assert.equal(settingLi.fields.optimizedTargeting, 'チェックなし', `${key} ${settingLi.name} Optimized Targeting`);
      assert.equal(settingLi.fields.revenueModel, '42.857%', `${key} ${settingLi.name} Revenue`);
    }
    const liNodes = collectTreeNodes(tree.roots).filter(node => node.level === 'LI' && node.found);
    assert.equal(liNodes.length, 2, key);
    for (const node of liNodes) {
      const byLabel = new Map(node.compItems.map(item => [item.label, item]));
      for (const hiddenLabel of [
        'Browser', 'Connection Speed', 'Optimized Targeting', 'Viewability', 'Position', '環境',
      ]) {
        assert.equal(byLabel.has(hiddenLabel), false, `${key} ${node.name} ${hiddenLabel}`);
      }
      assert.equal(node.compItems.some(item => item.rawFieldName === 'Fees'), false, `${key} ${node.name} Fees`);
      assert.equal(byLabel.get('デバイス').result, 'ok', `${key} ${node.name} Device`);
      assert.equal(byLabel.get('収益モデル').result, 'ok', `${key} ${node.name} Revenue`);
      assert.deepEqual(
        { sVal: byLabel.get('収益モデル').sVal, dVal: byLabel.get('収益モデル').dVal },
        { sVal: '42.857%', dVal: 'TMCM / 42.857' },
        `${key} ${node.name} Revenue values`,
      );
      assert.ok(byLabel.has('Site Targeting - Include'), `${key} ${node.name} Site Targeting - Include`);
      assert.ok(byLabel.has('Site Targeting - Exclude'), `${key} ${node.name} Site Targeting - Exclude`);
      for (const label of ['性別', '年齢', '世帯年収', 'Site Targeting - Exclude', 'App Targeting - Exclude']) {
        assert.equal(byLabel.get(label).result, 'ok', `${key} ${node.name} ${label}`);
        assert.equal(byLabel.get(label).alwaysDisplay, true, `${key} ${node.name} ${label} visible`);
      }
      assert.equal(byLabel.get('Keyword').result, 'ok', `${key} ${node.name} Keyword`);
      assert.equal(byLabel.get('Keyword').alwaysDisplay, true, `${key} ${node.name} Keyword visible`);
      for (const label of ['性別', '年齢', '子供の有無', '世帯年収']) {
        assert.equal(byLabel.get(label).alwaysDisplay, true, `${key} ${node.name} ${label} visible`);
        assert.notEqual(byLabel.get(label).hiddenWhenOk, true, `${key} ${node.name} ${label} visible`);
      }
      assert.equal(byLabel.get('年齢').result, 'ok', `${key} ${node.name} 年齢`);
      const age = byLabel.get('年齢');
      assert.equal(age.sVal, '(設定表なし) / 年齢 不明: は不明なし', `${key} ${node.name} age setting`);
      assert.equal(age.dVal, '18; +; False;', `${key} ${node.name} age download`);
      assert.equal(age.unknownRequirement, 'exclude', `${key} ${node.name} age unknown requirement`);
      assert.deepEqual(Array.from(age.normalizedSetting), ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'], `${key} ${node.name} age normalized setting`);
      assert.deepEqual(Array.from(age.normalizedDownload), ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'], `${key} ${node.name} age normalized download`);
      assert.deepEqual(Array.from(age.missing), [], `${key} ${node.name} age missing`);
      assert.deepEqual(Array.from(age.extra), [], `${key} ${node.name} age extra`);
      for (const absentLabel of ['OS / Model', 'Carrier', 'Category']) {
        assert.equal(byLabel.has(absentLabel), false, `${key} ${node.name} ${absentLabel}`);
      }
    }
    api.setMediaType('display');
    api.setTreeRoots(tree.roots);
    const finalColumns = Array.from(api.getLevelColumns('LI'), column => column.key);
    assert.deepEqual(
      finalColumns.filter(keyName => ['性別', '年齢', '子供の有無', '世帯年収'].includes(keyName)),
      ['性別', '年齢', '子供の有無', '世帯年収'],
      `${key} final demographic columns`,
    );
    api.setTreeRoots([]);
  }
});

test('003 真实案件 Display IO 与 LI 第一阶段结果可追踪', async () => {
  api.setMediaType('display');
  const unit = displayUnits.find(item => item.key === '003');
  const workbook = parseWorkbook(unit.xlsx);
  const setting = api.parseDisplaySetting(workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets);
  const download = api.parseSdfData(await parseSdfZip(unit.zip));
  const ioItems = new Map(api.compareIO(setting.ioList[0], download.ioList[0]).map(item => [item.label, item]));
  assert.equal(ioItems.get('最適化').result, 'mismatch');
  assert.equal(ioItems.get('予算の自動割り当て').result, 'ok');

  const liItems = api.compareLI(setting.liList[0], download.liList[0]);
  const byLabel = new Map(liItems.map(item => [item.label, item]));
  assert.equal(byLabel.get('LIタイプ').result, 'ok');
  assert.equal(byLabel.get('Subtype').result, 'ok');
  assert.equal(byLabel.get('開始日').result, 'ok');
  assert.equal(byLabel.get('終了日').result, 'ok');
  assert.equal(byLabel.get('言語').result, 'ok');
  assert.equal(byLabel.get('デバイス').result, 'ok');
  assert.equal(byLabel.get('地域 / Geography Targeting').result, 'ok');
  assert.ok(!liItems.some(item => /オーディエンス/.test(item.label)));
  assert.ok(!liItems.some(item => ['Deal ID', '動画タイプ'].includes(item.label)));
  console.log('[Display 003 compare]', JSON.stringify(Object.fromEntries(liItems.map(item => [item.label, item.result]))));
});

test('003 Q426 iPhone Privacy LI strips the SDF LI_ prefix and joins its formal IO', async () => {
  api.setMediaType('display');
  const unit = displayUnits.find(item => item.key === '003');
  const { tree } = await buildDisplayTree(unit);
  const settingName = 'DV360_Q426_iPhone_Phone Over Face_Privacy 7.0';
  const sdfName = 'LI_DV360_Q426_iPhone_Phone Over Face_Privacy 7.0';
  const settingLi = collectTreeNodes(tree.roots).find(node =>
    node.level === 'LI' && !node.fromSdf && node.name === settingName);
  assert.ok(settingLi);
  assert.equal(settingLi.found, true);
  assert.equal(settingLi.matchedName, sdfName);
  assert.equal(settingLi.candidate, false);
  assert.ok(settingLi.compItems.length > 1, 'formal LI comparison runs');
  assert.equal(collectTreeNodes(tree.roots).some(node =>
    node.level === 'LI' && node.fromSdf && node.name === sdfName), false);
});

test('Display LI demographic defaults remain visible and accept an empty SDF field', () => {
  api.setMediaType('display');
  const { setting, download } = makeDisplayLiFixture({
    gender: 'すべて', parentalStatus: 'ALL(不明あり)', householdIncome: 'ALL',
  }, {}, {
    'Demographic Targeting Gender': '',
    'Demographic Targeting Parental Status': '',
    'Demographic Targeting Household Income': '',
  });
  const items = new Map(api.compareLI_Display_Demographic(setting, download).map(item => [item.label, item]));
  for (const label of ['性別', '年齢', '子供の有無', '世帯年収']) {
    assert.ok(items.has(label), `${label} is always present`);
    assert.notEqual(items.get(label).hiddenWhenOk, true, `${label} is not hidden`);
    assert.equal(items.get(label).alwaysDisplay, true, `${label} is always displayed`);
  }
  assert.equal(items.get('性別').result, 'ok');
  assert.equal(items.get('子供の有無').result, 'ok');
  assert.equal(items.get('世帯年収').result, 'ok');
});

test('Display LI all ages maps 18;+;false and 18;+;true to unknown choice', () => {
  api.setMediaType('display');
  for (const [unknown, sdfAge] of [['不明なし', '18; +; False;'], ['不明あり', '18; +; True;']]) {
    const { setting, download } = makeDisplayLiFixture({ age: 'すべて', ageUnknown: unknown }, {}, {
      'Demographic Targeting Age': sdfAge,
    });
    const item = api.compareLI_Display_Demographic(setting, download).find(entry => entry.label === '年齢');
    assert.ok(item, `${unknown} item`);
    assert.equal(item.result, 'ok', `${unknown} result`);
    assert.equal(item.alwaysDisplay, true, `${unknown} always display`);
    assert.notEqual(item.hiddenWhenOk, true, `${unknown} not hidden`);
  }
});

test('Display LI splits Site and App targeting into six always-visible comparison items', () => {
  api.setMediaType('display');
  assert.equal(typeof api.compareLI_Display_SiteAppTargeting, 'function');
  const itemFor = (settingValue, rawFields, label) => {
    const { setting, download } = makeDisplayLiFixture({ appUrl: settingValue }, {}, rawFields);
    return api.compareLI_Display_SiteAppTargeting(setting, download).find(item => item.label === label);
  };
  const defaultSiteExclude = itemFor('play.google.com; youtube.com;', {
    'Site Targeting - Exclude': 'youtube.com, play.google.com;',
  }, 'Site Targeting - Exclude');
  assert.equal(defaultSiteExclude.result, 'ok');
  assert.equal(defaultSiteExclude.alwaysDisplay, true);
  assert.notEqual(defaultSiteExclude.hiddenWhenOk, true);

  for (const value of ['play.google.com;', 'play.google.com; youtube.com; example.com;']) {
    assert.equal(itemFor('play.google.com; youtube.com;', { 'Site Targeting - Exclude': value },
      'Site Targeting - Exclude').result, 'mismatch', value);
  }

  const siteIncludeWarning = itemFor('', { 'Site Targeting - Include': 'example.com;' }, 'Site Targeting - Include');
  assert.equal(siteIncludeWarning.result, 'mismatch');
  assert.equal(siteIncludeWarning.alwaysDisplay, true);
  const siteIncludeNonDefault = itemFor('example.com', { 'Site Targeting - Include': 'example.com;' }, 'Site Targeting - Include');
  assert.equal(siteIncludeNonDefault.result, 'mismatch');
  assert.equal(siteIncludeNonDefault.alwaysDisplay, true);

  for (const [label, header] of [
    ['App Targeting - Include', 'App Targeting - Include'],
    ['App Collection Targeting - Include', 'App Collection Targeting - Include'],
  ]) {
    const item = itemFor('', { [header]: 'com.example.app;' }, label);
    assert.ok(item, label);
    assert.equal(item.result, 'mismatch', label);
    assert.equal(item.alwaysDisplay, true, label);
  }
  const keys = Array.from(api.getCoreLevelColumns('LI', false), column => column.key);
  assert.ok(!keys.includes('App URL'));
  assert.deepEqual(keys.slice(-7, -1), [
    'Site Targeting - Include', 'Site Targeting - Exclude',
    'App Targeting - Include', 'App Targeting - Exclude',
    'App Collection Targeting - Include', 'App Collection Targeting - Exclude',
  ]);
});

test('Display LI five focus checks use Display defaults without reusing sf.appUrl for excludes', () => {
  api.setMediaType('display');
  const defaultApps = [
    'APP:1299029553', 'APP:1514347338', 'APP:1522452706', 'APP:1544762499',
    'APP:333903271', 'APP:avnYQjXG', 'APP\\:com.twitter.android', 'APPLE_TV_APP:333903271',
  ];
  const fixture = makeDisplayLiFixture({
    gender: 'すべて', genderUnknown: 'すべて', age: '', ageUnknown: '不明なし',
    householdIncome: 'ALL', householdIncomeUnknown: '不明あり', appUrl: 'unrelated-setting-value',
  }, {}, {
    'Demographic Targeting Gender': '',
    'Demographic Targeting Age': '18; +; False;',
    'Demographic Targeting Household Income': '',
    'Site Targeting - Exclude': 'youtube.com; play.google.com;',
    'App Targeting - Exclude': defaultApps.slice().reverse().join('; ') + ';',
  });
  const items = new Map(api.compareLI_Display(fixture.setting, fixture.download).map(item => [item.label, item]));
  for (const label of ['性別', '年齢', '世帯年収', 'Site Targeting - Exclude', 'App Targeting - Exclude']) {
    assert.equal(items.get(label).result, 'ok', label);
    assert.equal(items.get(label).alwaysDisplay, true, `${label} visible`);
    assert.notEqual(items.get(label).hiddenWhenOk, true, `${label} not hidden`);
  }

  const genderMismatch = makeDisplayLiFixture({ gender: 'Male' }, {}, { 'Demographic Targeting Gender': '' });
  assert.notEqual(api.compareLI_Display_Demographic(genderMismatch.setting, genderMismatch.download)
    .find(item => item.label === '性別').result, 'ok');
  const ageMismatch = makeDisplayLiFixture({ age: '全年齢', ageUnknown: '不明あり' }, {}, {
    'Demographic Targeting Age': '18; +; False;',
  });
  assert.notEqual(api.compareLI_Display_Demographic(ageMismatch.setting, ageMismatch.download)
    .find(item => item.label === '年齢').result, 'ok');
  const incomeMismatch = makeDisplayLiFixture({ householdIncome: 'Top 10%' }, {}, {
    'Demographic Targeting Household Income': '',
  });
  assert.notEqual(api.compareLI_Display_Demographic(incomeMismatch.setting, incomeMismatch.download)
    .find(item => item.label === '世帯年収').result, 'ok');

  const targeting = (header, value, label) => api.compareLI_Display_SiteAppTargeting(
    makeDisplayLiFixture({ appUrl: 'unrelated-setting-value' }, {}, { [header]: value }).setting,
    makeDisplayLiFixture({ appUrl: 'unrelated-setting-value' }, {}, { [header]: value }).download,
  ).find(item => item.label === label);
  for (const [value, expected] of [
    ['play.google.com;', 'mismatch'],
    ['play.google.com; youtube.com; example.com;', 'mismatch'],
  ]) assert.equal(targeting('Site Targeting - Exclude', value, 'Site Targeting - Exclude').result, expected);
  assert.equal(targeting('App Targeting - Exclude', defaultApps.map(value => value.replace('\\:', ':')).join('; ') + ';',
    'App Targeting - Exclude').result, 'ok');
  assert.equal(targeting('App Targeting - Exclude', defaultApps.slice(1).join('; ') + ';',
    'App Targeting - Exclude').result, 'mismatch');
  assert.equal(targeting('App Targeting - Exclude', defaultApps.concat('APP:extra').join('; ') + ';',
    'App Targeting - Exclude').result, 'mismatch');
});

test('Display LI default revenue, targeting, keyword, brand safety, and budget controls use the Display rules', () => {
  api.setMediaType('display');
  const revenueLabel = '\u53ce\u76ca\u30e2\u30c7\u30eb';
  const budgetTypeLabel = '\u4e88\u7b97\u671f\u9593 / Budget Type';
  const fixture = makeDisplayLiFixture({
    revenueModel: '0.4285714285714286', budgetPacing: '\u25bc\u9078\u629e', appUrl: 'must-not-be-used',
  }, {
    partnerRevenueModel: 'TCMC', partnerRevenueAmount: '42.857', budgetType: 'Automatic',
  }, {
    'Partner Revenue Model': 'TCMC', 'Partner Revenue Amount': '42.857', 'Budget Type': 'Automatic',
    'Site Targeting - Include': '', 'App Targeting - Include': '',
    'App Collection Targeting - Include': '', 'App Collection Targeting - Exclude': '',
    'Keyword Targeting - Include': '11427670866;11499670852;',
    'Brand Safety Sensitivity Setting': 'Use custom',
    'Brand Safety Custom Settings': 'Derogatory; Downloads & Sharing; Drugs; Gambling; Politics; Profanity; Religion; Sensitive social issues; Sexual; Shocking; Suggestive; Tragedy; Transportation Accidents; Violence; Weapons;',
    'Digital Content Labels - Exclude': 'MA; ?;',
    'Third Party Verification Services': 'None',
    'Third Party Verification Labels': '',
  });
  const items = new Map(api.compareLI_Display(fixture.setting, fixture.download).map(item => [item.label, item]));
  for (const label of [revenueLabel, budgetTypeLabel, 'Site Targeting - Include', 'Site Targeting - Exclude',
    'App Targeting - Include', 'App Targeting - Exclude', 'App Collection Targeting - Include',
    'App Collection Targeting - Exclude', 'Keyword', 'Brand Safety']) {
    assert.ok(items.has(label), `${label} exists`);
    assert.notEqual(items.get(label).hiddenWhenOk, true, `${label} remains visible`);
  }
  assert.equal(items.get(revenueLabel).result, 'ok');
  assert.equal(items.get(revenueLabel).dVal, 'TCMC / 42.857');
  assert.equal(items.get(budgetTypeLabel).result, 'ok');
  for (const label of ['Site Targeting - Include', 'App Targeting - Include',
    'App Collection Targeting - Include', 'App Collection Targeting - Exclude']) {
    assert.equal(items.get(label).result, 'ok', label);
  }
  assert.equal(items.get('Keyword').result, 'ok');
  assert.equal(items.get('Brand Safety').result, 'ok');

  for (const [value, expected] of [
    ['11427670866;', 'mismatch'],
    ['11427670866;11499670852;999;', 'mismatch'],
  ]) {
    const keywordFixture = makeDisplayLiFixture({}, {}, { 'Keyword List Targeting - Exclude': value });
    assert.equal(api.compareLI_Display_WarningFields(keywordFixture.setting, keywordFixture.download)
      .find(item => item.label === 'Keyword').result, expected, value);
  }
  const alteredBrandSafety = makeDisplayLiFixture({}, {}, {
    'Brand Safety Sensitivity Setting': 'Use custom',
    'Brand Safety Custom Settings': 'Derogatory;',
    'Digital Content Labels - Exclude': 'MA; ?;',
    'Third Party Verification Services': 'None',
  });
  assert.equal(api.compareLI_Display_WarningFields(alteredBrandSafety.setting, alteredBrandSafety.download)
    .find(item => item.label === 'Brand Safety').result, 'mismatch');

  for (const [settingValue, downloadValue, expected] of [
    ['0.15', '15', 'ok'], ['15', '15', 'ok'], ['0.2', '20', 'ok'], ['0.2', '25', 'mismatch'],
  ]) assert.equal(api.compareNormalizedRevenueRate(settingValue, downloadValue), expected);

  for (const [header, label] of [
    ['Site Targeting - Include', 'Site Targeting - Include'],
    ['App Targeting - Include', 'App Targeting - Include'],
    ['App Collection Targeting - Include', 'App Collection Targeting - Include'],
    ['App Collection Targeting - Exclude', 'App Collection Targeting - Exclude'],
  ]) {
    const nonDefault = makeDisplayLiFixture({ appUrl: 'must-not-be-used' }, {}, { [header]: 'unexpected-target;' });
    assert.notEqual(api.compareLI_Display_SiteAppTargeting(nonDefault.setting, nonDefault.download)
      .find(item => item.label === label).result, 'ok', label);
  }
});

test('2607_CCL_01 PC and SP retain all ten Display QC controls as OK', async () => {
  const unit = displayUnits.find(item => item.key === '002');
  const { tree } = await buildDisplayTree(unit);
  const revenueLabel = '\u53ce\u76ca\u30e2\u30c7\u30eb';
  const budgetTypeLabel = '\u4e88\u7b97\u671f\u9593 / Budget Type';
  const liNodes = collectTreeNodes(tree.roots).filter(node =>
    node.level === 'LI' && node.found && /2607_CCL_01/.test(node.name));
  assert.equal(liNodes.length, 2);
  const expectedLabels = [revenueLabel, budgetTypeLabel, 'Site Targeting - Include', 'Site Targeting - Exclude',
    'App Targeting - Include', 'App Targeting - Exclude', 'App Collection Targeting - Include',
    'App Collection Targeting - Exclude', 'Keyword', 'Brand Safety'];
  for (const node of liNodes) {
    const items = new Map(node.compItems.map(item => [item.label, item]));
    for (const label of expectedLabels) {
      assert.ok(items.has(label), `${node.name} ${label}`);
      assert.equal(items.get(label).result, 'ok', `${node.name} ${label}`);
      assert.notEqual(items.get(label).hiddenWhenOk, true, `${node.name} ${label} visible`);
    }
    assert.equal(items.get(revenueLabel).sVal, '0.4285714285714286');
    assert.equal(items.get(revenueLabel).dVal, 'TMCM / 42.857');
    assert.equal(items.get(budgetTypeLabel).sVal, '\u25bc\u9078\u629e');
    assert.equal(items.get(budgetTypeLabel).dVal, 'Automatic');
  }
});

test('Display case type is determined only from the setting-sheet account name', () => {
  assert.equal(typeof api.detectDisplayCaseType, 'function');
  const accountLabel = '\u30a2\u30ab\u30a6\u30f3\u30c8\u540d';
  for (const accountName of ['Apple_iPhone_xxx', 'APPLE_xxx', 'apple_xxx']) {
    assert.equal(api.detectDisplayCaseType([[accountLabel, '', accountName]], null), 'apple', accountName);
  }
  assert.equal(api.detectDisplayCaseType([[accountLabel, '', 'Toyota_xxx']], null), 'normal');
  assert.equal(api.detectDisplayCaseType([['Campaign Apple'], ['LI Apple']], null), 'normal');
  assert.equal(api.detectDisplayCaseType([], { D6: { v: 'Apple_D6_fallback' } }), 'apple');
});

test('Display Apple LI uses only its four Apple defaults', () => {
  api.setMediaType('display');
  const appleBrandSafety = 'Alcohol; Derogatory; Downloads & Sharing; Drugs; Gambling; Politics; Profanity; Religion; Sensitive social issues; Sexual; Shocking; Suggestive; Tobacco; Tragedy; Transportation Accidents; Violence; Weapons;';
  const { setting, download } = makeDisplayLiFixture({}, {}, {
    'Brand Safety Sensitivity Setting': 'Use custom',
    'Brand Safety Custom Settings': appleBrandSafety,
    'Digital Content Labels - Exclude': 'MA; ?;',
    'Third Party Verification Services': 'DoubleVerify',
    'Third Party Verification Labels': '51006359;',
    'Keyword List Targeting - Exclude': '12085491123; 11429640758;',
    'Site Targeting - Exclude': '', 'App Targeting - Exclude': '',
  });
  setting.displayCaseType = 'apple';
  const items = new Map(api.compareLI_Display(setting, download).map(item => [item.label, item]));
  for (const label of ['Brand Safety', 'Keyword', 'Site Targeting - Exclude', 'App Targeting - Exclude']) {
    assert.equal(items.get(label).result, 'ok', label);
  }
  const missingKeyword = makeDisplayLiFixture({}, {}, { 'Keyword List Targeting - Exclude': '11429640758;' });
  missingKeyword.setting.displayCaseType = 'apple';
  assert.equal(api.compareLI_Display(missingKeyword.setting, missingKeyword.download)
    .find(item => item.label === 'Keyword').result, 'mismatch');
  const unexpectedExclude = makeDisplayLiFixture({}, {}, {
    'Site Targeting - Exclude': 'youtube.com;',
    'App Targeting - Exclude': 'APP:1299029553;',
  });
  unexpectedExclude.setting.displayCaseType = 'apple';
  const unexpectedItems = new Map(api.compareLI_Display(unexpectedExclude.setting, unexpectedExclude.download)
    .map(item => [item.label, item]));
  assert.equal(unexpectedItems.get('Site Targeting - Exclude').result, 'mismatch');
  assert.equal(unexpectedItems.get('App Targeting - Exclude').result, 'mismatch');
});

test('003 and 004 parser metadata identifies their Apple account name', async () => {
  for (const key of ['003', '004']) {
    const unit = displayUnits.find(item => item.key === key);
    const workbook = parseWorkbook(unit.xlsx);
    const parsed = api.parseDisplaySetting(workbook.sheets, workbook.sheetNames, path.basename(unit.xlsx), workbook.worksheets);
    assert.equal(parsed.meta.displayCaseType, 'apple', key);
    assert.match(parsed.meta.accountName, /^Apple_iPhone_/i, key);
    assert.ok(parsed.liList.every(li => li.displayCaseType === 'apple'), key);
  }
});

test('003 and 004 apply the Apple profile only to the four scoped LI defaults', async () => {
  const labels = ['Brand Safety', 'Keyword', 'Site Targeting - Exclude', 'App Targeting - Exclude'];
  for (const key of ['003', '004']) {
    const unit = displayUnits.find(item => item.key === key);
    const { tree } = await buildDisplayTree(unit);
    const liNodes = collectTreeNodes(tree.roots).filter(node => node.level === 'LI' && node.found);
    assert.ok(liNodes.length, `${key} matched LI`);
    for (const node of liNodes) {
      const items = new Map(node.compItems.map(item => [item.label, item]));
      assert.equal(items.get('Brand Safety').result, 'ok', `${key} Brand Safety`);
      assert.equal(items.get('Site Targeting - Exclude').result, 'ok', `${key} Site Exclude`);
      assert.equal(items.get('App Targeting - Exclude').result, 'ok', `${key} App Exclude`);
      assert.equal(items.get('Keyword').result, key === '003' ? 'mismatch' : 'ok', `${key} Keyword`);
      for (const label of labels) assert.notEqual(items.get(label).hiddenWhenOk, true, `${key} ${label} visible`);
    }
  }
});
