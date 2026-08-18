const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { EXPECTED_HEADERS, validateGeoRows, buildGeoMaster } = require('./build_dv360_geo_master');

function createClassList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
  };
}

function createElement() {
  return {
    addEventListener() {},
    appendChild() {},
    classList: createClassList(),
    closest() { return null; },
    dataset: {},
    innerHTML: '',
    scrollIntoView() {},
    style: { setProperty() {} },
    textContent: '',
    value: '',
  };
}

function loadDv360Api() {
  const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');

  const exportBlock = `
window.__dv360TestApi = {
  hasMeaningfulDownloadValue: typeof hasMeaningfulDownloadValue === 'function' ? hasMeaningfulDownloadValue : undefined,
  normalizeSdfFieldName: typeof normalizeSdfFieldName === 'function' ? normalizeSdfFieldName : undefined,
  parseSdfData,
  appendDownloadOnlyItems: typeof appendDownloadOnlyItems === 'function' ? appendDownloadOnlyItems : undefined,
  appendDynamicDownloadColumns: typeof appendDynamicDownloadColumns === 'function' ? appendDynamicDownloadColumns : undefined,
  createSdfOnlyNode: typeof createSdfOnlyNode === 'function' ? createSdfOnlyNode : undefined,
  buildComparisonTree: typeof buildComparisonTree === 'function' ? buildComparisonTree : undefined,
  getCoreLevelColumns: typeof getCoreLevelColumns === 'function' ? getCoreLevelColumns : undefined,
  buildResultTableColumns: typeof buildResultTableColumns === 'function' ? buildResultTableColumns : undefined,
  getResultColumnWidth: typeof getResultColumnWidth === 'function' ? getResultColumnWidth : undefined,
  setResultColumnWidth: typeof setResultColumnWidth === 'function' ? setResultColumnWidth : undefined,
  removeFileIsExposed: typeof window.dvRemoveFile === 'function',
  calcOwnStatus,
  downloadFieldExclude: typeof DOWNLOAD_FIELD_EXCLUDE !== 'undefined' ? DOWNLOAD_FIELD_EXCLUDE : undefined,
  hydrateGeoTargetMaster: typeof hydrateGeoTargetMaster === 'function' ? hydrateGeoTargetMaster : undefined,
  getDv360GeoTargetByCode: typeof getDv360GeoTargetByCode === 'function' ? getDv360GeoTargetByCode : undefined,
  parseDv360GeoCodes: typeof parseDv360GeoCodes === 'function' ? parseDv360GeoCodes : undefined,
  formatDv360GeoTarget: typeof formatDv360GeoTarget === 'function' ? formatDv360GeoTarget : undefined,
  evaluateDv360GeoTargeting: typeof evaluateDv360GeoTargeting === 'function' ? evaluateDv360GeoTargeting : undefined,
  getSdfFieldDisplayLabel: typeof getSdfFieldDisplayLabel === 'function' ? getSdfFieldDisplayLabel : undefined,
  sdfFieldDisplayLabels: typeof SDF_FIELD_DISPLAY_LABELS !== 'undefined' ? SDF_FIELD_DISPLAY_LABELS : undefined,
  downloadFieldDefaultRules: typeof DOWNLOAD_FIELD_DEFAULT_RULES !== 'undefined' ? DOWNLOAD_FIELD_DEFAULT_RULES : undefined,
  classifySdfDownloadField: typeof classifySdfDownloadField === 'function' ? classifySdfDownloadField : undefined,
  compareCP: typeof compareCP === 'function' ? compareCP : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  compareGP: typeof compareGP === 'function' ? compareGP : undefined,
  compareCR: typeof compareCR === 'function' ? compareCR : undefined,
  compareLI: typeof compareLI === 'function' ? compareLI : undefined,
  compareStatus: typeof compareStatus === 'function' ? compareStatus : undefined,
  statusValuesEquivalent: typeof statusValuesEquivalent === 'function' ? statusValuesEquivalent : undefined,
  normCampaignGoalKpi: typeof normCampaignGoalKpi === 'function' ? normCampaignGoalKpi : undefined,
  parseSetTokens: typeof parseSetTokens === 'function' ? parseSetTokens : undefined,
  parseUrlTokens: typeof parseUrlTokens === 'function' ? parseUrlTokens : undefined,
  compareMasterSet: typeof compareMasterSet === 'function' ? compareMasterSet : undefined,
  parseUnknownIntent: typeof parseUnknownIntent === 'function' ? parseUnknownIntent : undefined,
  checkUnknownInSet: typeof checkUnknownInSet === 'function' ? checkUnknownInSet : undefined,
  formatDiffSummary: typeof formatDiffSummary === 'function' ? formatDiffSummary : undefined,
  gpMpUnifiedRules: typeof GP_MP_UNIFIED_RULES !== 'undefined' ? GP_MP_UNIFIED_RULES : undefined,
  gpMpDefaultRules: typeof DOWNLOAD_FIELD_DEFAULT_RULES !== 'undefined' ? DOWNLOAD_FIELD_DEFAULT_RULES : undefined,
  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === 'function' ? setSelectedDv360CaseType : undefined,
  setMediaType: function(value) { mediaType=value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
  const document = {
    body: createElement(),
    documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob,
    DecompressionStream: globalThis.DecompressionStream,
    Encoding: {},
    FileReader: function FileReader() {},
    JSZip: {},
    Map,
    Promise,
    Response,
    Set,
    TextDecoder,
    Uint8Array,
    URL,
    XLSX: {},
    alert() {},
    atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__dv360TestApi;
}

const api = loadDv360Api();
api.setMediaType('youtube');

test('D1-D10 generated Geo Master is marked, deterministic, and stores official target metadata', t => {
  const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
  const csvPath = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\dv360_jp_geo_targets_2026-07-06.csv';
  if (!fs.existsSync(csvPath)) return t.skip('DV360 Geo source CSV is unavailable on this machine');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const csvHeader = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/, 1)[0].replace(/^\uFEFF/, '').split(',');
  const expectedHeader = [
    'criteria_id', 'name_en', 'canonical_name', 'parent_id', 'country_code', 'target_type',
    'status', 'level_hint', 'prefecture_id', 'prefecture_en', 'prefecture_ja',
    'dv360_sdf_field', 'source_version',
  ];
  assert.deepEqual(csvHeader, expectedHeader);

  const blocks = [...html.matchAll(/\/\/ BEGIN GENERATED DV360 GEO MASTER\r?\n([\s\S]*?)\/\/ END GENERATED DV360 GEO MASTER/g)];
  assert.equal(blocks.length, 1, 'Geo Master must have exactly one generated block');
  const base64 = blocks[0][1].match(/GZIP_BASE64\s*=\s*'([^']+)'/)[1];
  const entries = JSON.parse(zlib.gunzipSync(Buffer.from(base64, 'base64')).toString('utf8'));
  assert.equal(entries.length, 27870);
  assert.equal(new Set(entries.map(entry => entry[0])).size, 27870, 'official Geo Codes must be unique');
  assert.deepEqual(entries[0], ['2392', 'Japan', 'Country', '', '', 'JP']);

  const validRow = (overrides = {}) => EXPECTED_HEADERS.map(header => ({
    criteria_id: '100', name_en: 'Example', canonical_name: 'Example Japan', parent_id: '', country_code: 'JP',
    target_type: 'City', status: 'Active', level_hint: 'below_prefecture', prefecture_id: '1',
    prefecture_en: 'Hokkaido', prefecture_ja: '北海道', dv360_sdf_field: '', source_version: 'test',
    ...overrides,
  })[header]);
  const rows = [EXPECTED_HEADERS, validRow(), validRow({ criteria_id: '200', target_type: 'Country', level_hint: 'country', prefecture_id: '', prefecture_en: '', prefecture_ja: '' })];
  assert.equal(validateGeoRows(rows).length, 2, 'valid Country and lower-level rows are accepted');
  assert.throws(() => validateGeoRows([EXPECTED_HEADERS, validRow({ criteria_id: '10.0' })]), /invalid Code/i);
  assert.throws(() => validateGeoRows([EXPECTED_HEADERS, validRow(), validRow()]), /duplicate Code/i);
  assert.throws(() => validateGeoRows([EXPECTED_HEADERS, validRow({ name_en: '' })]), /missing English/i);
  assert.throws(() => validateGeoRows([EXPECTED_HEADERS, validRow({ target_type: 'Prefecture', level_hint: 'prefecture', prefecture_ja: '' })]), /missing direct Japanese/i);
  assert.throws(() => validateGeoRows([EXPECTED_HEADERS, validRow({ level_hint: 'country' })]), /abnormal target level/i);

  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv360-geo-master-'));
  const invalidCsv = path.join(temporaryDir, 'invalid.csv');
  const temporaryHtml = path.join(temporaryDir, 'dv360_check.html');
  const originalHtml = "const GEO_TARGET_MASTER_GZIP_BASE64 = 'placeholder';\n";
  try {
    fs.writeFileSync(invalidCsv, `${EXPECTED_HEADERS.join(',')}\n${validRow({ criteria_id: 'broken' }).join(',')}\n`, 'utf8');
    fs.writeFileSync(temporaryHtml, originalHtml, 'utf8');
    assert.throws(() => buildGeoMaster({ inputPath: invalidCsv, htmlPath: temporaryHtml }), /invalid Code/i);
    assert.equal(fs.readFileSync(temporaryHtml, 'utf8'), originalHtml, 'failed validation must not write HTML');
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
});

test('D11-D31 Geo APIs preserve Code strings and format country, prefecture, city, and unknown targets', () => {
  assert.equal(typeof api.hydrateGeoTargetMaster, 'function');
  assert.equal(typeof api.getDv360GeoTargetByCode, 'function');
  assert.equal(typeof api.parseDv360GeoCodes, 'function');
  assert.equal(typeof api.formatDv360GeoTarget, 'function');
  assert.equal(typeof api.evaluateDv360GeoTargeting, 'function');
  api.hydrateGeoTargetMaster([
    ['2392', 'Japan', 'Country', '', '', 'JP'],
    ['20624', 'Hokkaido,Japan', 'Prefecture', '北海道', '北海道', 'JP'],
    ['1009023', 'Abashiri,Hokkaido,Japan', 'City', '', '北海道', 'JP'],
    ['00123', 'Test Ward,Japan', 'Neighborhood', '', '', 'JP'],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getDv360GeoTargetByCode('2392'))), {
    code: '2392', englishName: 'Japan', level: 'Country', directJapaneseName: '日本',
    prefectureJapaneseName: '', countryCode: 'JP',
  });
  assert.equal(api.formatDv360GeoTarget('2392'), '日本 / Japan（Code：2392）');
  assert.equal(api.formatDv360GeoTarget('20624'), '北海道 / Hokkaido, Japan（Code：20624）');
  assert.equal(api.formatDv360GeoTarget('1009023'), 'Abashiri, Hokkaido, Japan（都道府県：北海道／Code：1009023）');
  assert.equal(api.formatDv360GeoTarget('00123'), 'Test Ward, Japan（Code：00123）');
  assert.equal(api.formatDv360GeoTarget('99999'), '未登録地域Code：99999');
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseDv360GeoCodes('2392;'))), { ok: true, codes: ['2392'], error: '' });
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseDv360GeoCodes('2392 20624'))), { ok: true, codes: ['2392', '20624'], error: '' });
  assert.equal(api.parseDv360GeoCodes('2392 Japan').ok, false);
  assert.equal(api.parseDv360GeoCodes('2392.0').ok, false);
  assert.equal(api.parseDv360GeoCodes('Code:2392').ok, false);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseDv360GeoCodes('00123 | 2392'))), { ok: true, codes: ['00123', '2392'], error: '' });
  assert.equal(api.evaluateDv360GeoTargeting('2392;').result, 'ok');
  assert.equal(api.evaluateDv360GeoTargeting('1009023').result, 'warning');
  assert.equal(api.evaluateDv360GeoTargeting('2392;1009023').result, 'warning');
  assert.equal(api.evaluateDv360GeoTargeting('99999').result, 'warning');
});

test('meaningful download values retain zero and false but reject blank values', () => {
  assert.equal(typeof api.hasMeaningfulDownloadValue, 'function');
  assert.equal(api.hasMeaningfulDownloadValue('ABC'), true);
  assert.equal(api.hasMeaningfulDownloadValue(0), true);
  assert.equal(api.hasMeaningfulDownloadValue(false), true);
  assert.equal(api.hasMeaningfulDownloadValue('0'), true);
  assert.equal(api.hasMeaningfulDownloadValue('false'), true);
  assert.equal(api.hasMeaningfulDownloadValue('No'), true);
  assert.equal(api.hasMeaningfulDownloadValue('Off'), true);
  assert.equal(api.hasMeaningfulDownloadValue('   '), false);
  assert.equal(api.hasMeaningfulDownloadValue(null), false);
  assert.equal(api.hasMeaningfulDownloadValue(undefined), false);
});

test('field normalization removes harmless header differences without changing display labels', () => {
  assert.equal(typeof api.normalizeSdfFieldName, 'function');
  assert.equal(api.normalizeSdfFieldName('\uFEFFCustom　Field'), 'customfield');
  assert.equal(api.normalizeSdfFieldName('custom_field'), 'customfield');
  assert.equal(api.normalizeSdfFieldName('CUSTOM--FIELD'), 'customfield');
});

test('SDF parsing retains original headers and values for every supported level', () => {
  const fixtures = [
    ['SDF-Campaigns.csv', 'Campaign Id', 'CP'],
    ['SDF-InsertionOrders.csv', 'Io Id', 'IO'],
    ['SDF-LineItems.csv', 'Line Item Id', 'LI'],
    ['SDF-AdGroups.csv', 'Ad Group Id', 'GP'],
    ['SDF-AdGroupAds.csv', 'Ad Id', 'CR'],
  ];
  const parsed = api.parseSdfData(fixtures.map(([name, idHeader, level]) => ({
    name,
    rows: [
      ['Name', idHeader, `${level} Extra`, 'Numeric Field', 'Boolean Field'],
      [`${level} name`, `${level}-1`, `${level} value`, 0, false],
    ],
  })));
  const lists = [parsed.cpList, parsed.ioList, parsed.liList, parsed.gpList, parsed.crList];
  lists.forEach((records, index) => {
    const level = fixtures[index][2];
    assert.equal(records.length, 1);
    assert.deepEqual(
      JSON.parse(JSON.stringify(records[0].rawFieldOrder)),
      ['Name', fixtures[index][1], `${level} Extra`, 'Numeric Field', 'Boolean Field'],
    );
    assert.equal(records[0].rawFields[`${level} Extra`], `${level} value`);
    assert.equal(records[0].rawFields['Numeric Field'], 0);
    assert.equal(records[0].rawFields['Boolean Field'], false);
  });
});

test('non-empty unmapped fields become download-only items while blank fields stay hidden', () => {
  assert.equal(typeof api.appendDownloadOnlyItems, 'function');
  const items = api.appendDownloadOnlyItems('CP', {
    rawFieldOrder: ['Custom Field', 'Numeric Field', 'Boolean Field', 'Empty Field'],
    rawFields: {
      'Custom Field': 'ABC',
      'Numeric Field': 0,
      'Boolean Field': false,
      'Empty Field': '   ',
    },
  }, []);
  assert.deepEqual(
    JSON.parse(JSON.stringify(items.map(item => [item.label, item.dVal, item.result]))),
    [
      ['Custom Field', 'ABC', 'download-only'],
      ['Numeric Field', 0, 'download-only'],
      ['Boolean Field', false, 'download-only'],
    ],
  );
});

test('core-mapped SDF fields are not added a second time', () => {
  const core = [{ label: 'ステータス', sVal: 'Paused', dVal: 'Paused', result: 'ok' }];
  const items = api.appendDownloadOnlyItems('CP', {
    rawFieldOrder: ['Status', 'Custom Field'],
    rawFields: { Status: 'Paused', 'Custom Field': 'ABC' },
  }, core);
  assert.equal(items.filter(item => item.label === 'ステータス').length, 1);
  assert.equal(items.some(item => item.label === 'Status' && item.isAutoAdded), false);
  assert.equal(items.some(item => item.label === 'Custom Field' && item.isAutoAdded), true);
});

test('central exclusion list is honored for non-empty fields', () => {
  assert.ok(api.downloadFieldExclude);
  api.downloadFieldExclude.CP.add('Excluded Field');
  try {
    const items = api.appendDownloadOnlyItems('CP', {
      rawFieldOrder: ['Excluded Field', 'Visible Field'],
      rawFields: { 'Excluded Field': 'secret', 'Visible Field': 'shown' },
    }, []);
    assert.equal(items.some(item => item.label === 'Excluded Field'), false);
    assert.equal(items.some(item => item.label === 'Visible Field'), true);
  } finally {
    api.downloadFieldExclude.CP.delete('Excluded Field');
  }
});

test('only the explicitly configured hierarchy and attribution IDs are hidden per level', () => {
  const fixtures = {
    CP: ['Campaign Id', 'Advertiser Id'],
    IO: ['Io Id', 'Campaign Id'],
    LI: ['Line Item Id', 'Io Id', 'Primary Attribution Model Id', 'Conversion Floodlight Activity Ids'],
    GP: ['Ad Group Id', 'Line Item Id'],
    CR: ['Ad Id', 'Ad Group Id'],
  };
  for (const [level, excludedFields] of Object.entries(fixtures)) {
    const rawFieldOrder = [...excludedFields, 'Video Id', 'Unknown Business Id'];
    const rawFields = Object.fromEntries(rawFieldOrder.map(field => [field, `${level}-${field}`]));
    const items = api.appendDownloadOnlyItems(level, { rawFieldOrder, rawFields }, []);
    for (const field of excludedFields) {
      assert.equal(items.some(item => item.label === field), false, `${level} ${field} should be excluded`);
    }
    if (level !== 'CR') {
      assert.equal(items.some(item => item.label === 'Video Id'), true, `${level} Video Id must not be excluded by fuzzy ID matching`);
    }
    assert.equal(items.some(item => item.label === 'Unknown Business Id'), true, `${level} unknown business IDs remain visible`);
  }
});

test('core source-field declarations suppress Status and all four frequency source fields', () => {
  const sourceFields = [
    'Status',
    'Frequency Enabled',
    'Frequency Exposures',
    'Frequency Period',
    'Frequency Amount',
  ];
  const items = api.appendDownloadOnlyItems('IO', {
    rawFieldOrder: [...sourceFields, 'Timestamp'],
    rawFields: Object.fromEntries([...sourceFields, 'Timestamp'].map(field => [field, field === 'Timestamp' ? '2026-07-29' : '1'])),
  }, [
    {
      label: 'FQ',
      sVal: '1回 / Days',
      dVal: '1回 / Days',
      result: 'ok',
      sourceSdfFields: sourceFields,
    },
  ]);
  sourceFields.forEach(field => {
    assert.equal(items.some(item => item.label === field && item.isAutoAdded), false, `${field} should be consumed by the core item`);
  });
  assert.equal(items.some(item => item.label === 'Timestamp' && item.isAutoAdded), false);
});

test('D32-D49 labels and CP/IO/LI defaults are centralized, hidden when standard, and warnings when changed', () => {
  assert.equal(typeof api.getSdfFieldDisplayLabel, 'function');
  assert.ok(api.sdfFieldDisplayLabels);
  assert.ok(api.downloadFieldDefaultRules);
  const syntheticKey = api.normalizeSdfFieldName('Synthetic Katakana Field');
  api.sdfFieldDisplayLabels[syntheticKey] = { ja: 'テスト', zh: '测试字段', en: 'Synthetic Katakana Field' };
  try {
    assert.equal(api.getSdfFieldDisplayLabel('Frequency Enabled'), '配信頻度有効');
    assert.equal(api.getSdfFieldDisplayLabel('Synthetic Katakana Field'), 'テスト');
    assert.equal(api.getSdfFieldDisplayLabel('Unconfirmed Field'), 'Unconfirmed Field');
  } finally {
    delete api.sdfFieldDisplayLabels[syntheticKey];
  }

  const cpStandard = api.appendDownloadOnlyItems('CP', {
    rawFieldOrder: ['Frequency Enabled', 'Frequency Exposures', 'Frequency Period', 'Frequency Amount', 'Timestamp'],
    rawFields: { 'Frequency Enabled': 'false', 'Frequency Exposures': '0.0', 'Frequency Period': 'Minutes', 'Frequency Amount': 0, Timestamp: '2026-07-30' },
  }, []);
  assert.equal(cpStandard.length, 0);
  const cpDeviation = api.appendDownloadOnlyItems('CP', {
    rawFieldOrder: ['Frequency Enabled'], rawFields: { 'Frequency Enabled': 'True' },
  }, []);
  assert.deepEqual(JSON.parse(JSON.stringify(cpDeviation.map(item => [item.rawFieldName, item.dVal, item.result]))), [['Frequency Enabled', 'True', 'warning']]);

  const ioStandard = api.appendDownloadOnlyItems('IO', {
    rawFieldOrder: ['Fees', 'Pacing Amount', 'Measure DAR', 'Budget Type', 'Auto Budget Allocation', 'Insertion Order Optimization'],
    rawFields: {
      Fees: ' (Media; 0.0; Display & Video 360 Fee; True;); ', 'Pacing Amount': 0, 'Measure DAR': 'FALSE',
      'Budget Type': 'Amount', 'Auto Budget Allocation': false, 'Insertion Order Optimization': 'false',
    },
  }, []);
  assert.equal(ioStandard.length, 0);
  const ioDeviation = api.appendDownloadOnlyItems('IO', {
    rawFieldOrder: ['Fees'], rawFields: { Fees: '(Media; 0.0; Display & Video 360 Fee; False;);' },
  }, []);
  assert.equal(ioDeviation[0].result, 'warning');

  const liStandard = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Status', 'Conversion Counting Type', 'TrueView Bid Strategy Value', 'Contains EU Political Ads', 'TrueView Third-Party Viewability Vendor', 'TrueView Third-Party Brand Safety Vendor', 'TrueView Third-Party Reach Vendor', 'TrueView Third-Party Brand Lift Vendor'],
    rawFields: { Status: 'Draft', 'Conversion Counting Type': 'Count all', 'TrueView Bid Strategy Value': '0', 'Contains EU Political Ads': 'No', 'TrueView Third-Party Viewability Vendor': 'None', 'TrueView Third-Party Brand Safety Vendor': 'None', 'TrueView Third-Party Reach Vendor': 'None', 'TrueView Third-Party Brand Lift Vendor': 'None' },
  }, []);
  assert.equal(liStandard.filter(item => item.source !== 'raw-sdf-validation').length, 0);
  const liDeviation = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Status'], rawFields: { Status: 'Active' },
  }, []);
  assert.equal(liDeviation.some(item => item.rawFieldName === 'Status'), false);

  for (const level of ['CP', 'IO', 'LI']) {
    for (const rule of Object.values(api.downloadFieldDefaultRules[level])) {
      const standard = api.appendDownloadOnlyItems(level, {
        rawFieldOrder: [rule.field], rawFields: { [rule.field]: rule.expected },
      }, []);
      assert.equal(standard.some(item => item.rawFieldName === rule.field), false, `${level} ${rule.field} should hide its default`);
      const changed = rule.type === 'boolean' ? 'True' : rule.type === 'zero' ? '1' : '__changed__';
      const deviation = api.appendDownloadOnlyItems(level, {
        rawFieldOrder: [rule.field], rawFields: { [rule.field]: changed },
      }, []);
      const matching = deviation.filter(item => item.rawFieldName === rule.field);
      if (level === 'IO' && rule.field === 'Auto Budget Allocation') {
        assert.deepEqual(JSON.parse(JSON.stringify(matching)), [], 'IO auto budget allocation is consumed by the YouTube core comparison');
        continue;
      }
      assert.deepEqual(JSON.parse(JSON.stringify(matching.map(item => item.result))), ['warning'], `${level} ${rule.field} should expose one warning`);
    }
  }
});

test('D50-D64 LI geography is core-consumed while legacy Category Exclusions is informational only', () => {
  const standardCategory = [
    'Embedded Videos', 'Live Streaming', 'Mature Games', 'Not Yet Determined Health Sources',
    'Not Yet Determined News Sources', 'Politics', 'Recent News', 'Religion',
    'Unpleasant Health Content', 'Unpleasant News',
  ].join('; ') + ';';
  const standardItems = api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Geography Targeting - Include', 'TrueView Category Exclusions Targeting'],
    rawFields: { 'Geography Targeting - Include': '2392;', 'TrueView Category Exclusions Targeting': standardCategory },
  }, []);
  const byField = field => standardItems.filter(item => item.rawFieldName === field);
  assert.equal(byField('Geography Targeting - Include').length, 0);
  // 2026-08-18: 旧カテゴリ除外は LI の検証項目ではなくなった。
  // 残留値は legacy 情報（download-only）としてのみ表示され、warning / mismatch を生まない。
  const legacy = byField('TrueView Category Exclusions Targeting');
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].result, 'download-only');
  assert.equal(legacy[0].isAutoAdded, true);

  // 空欄は何も表示しない（不報錯・不 warning）
  const missingItems = api.appendDownloadOnlyItems('LI', { rawFieldOrder: [], rawFields: {} }, []);
  assert.deepEqual(
    JSON.parse(JSON.stringify(missingItems.map(item => [item.rawFieldName, item.result]))),
    [],
  );
  const category = field => api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['TrueView Category Exclusions Targeting'],
    rawFields: { 'TrueView Category Exclusions Targeting': field },
  }, []).find(item => item.rawFieldName === 'TrueView Category Exclusions Targeting');
  assert.equal(category(''), undefined);
  assert.equal(category(standardCategory.replace('Politics;', 'Different Politics;')).result, 'download-only');
  assert.equal(category(standardCategory.replace('Politics; Recent News;', 'Recent News; Politics;')).result, 'download-only');
  assert.equal(api.calcOwnStatus([{ result: 'download-only' }]), 'ok');
});

test('record Name is consumed by the fixed name column while a truly unknown field remains dynamic', () => {
  const items = api.appendDownloadOnlyItems('GP', {
    rawFieldOrder: ['Name', 'Experimental Field'],
    rawFields: { Name: 'Ad Group A', 'Experimental Field': 'keep me' },
  }, []);
  assert.equal(items.some(item => item.label === 'Name'), false);
  assert.equal(items.some(item => item.label === 'Experimental Field' && item.isAutoAdded), true);
});

test('hierarchy IDs remain available internally after front-end exclusion', () => {
  const parsed = api.parseSdfData([
    {
      name: 'SDF-InsertionOrders.csv',
      rows: [
        ['Io Id', 'Campaign Id', 'Name'],
        ['io-1', 'cp-1', 'IO A'],
      ],
    },
    {
      name: 'SDF-LineItems.csv',
      rows: [
        ['Line Item Id', 'Io Id', 'Io Name', 'Name'],
        ['li-1', 'io-1', 'IO A', 'LI A'],
      ],
    },
    {
      name: 'SDF-AdGroups.csv',
      rows: [
        ['Ad Group Id', 'Line Item Id', 'Line Item Name', 'Name'],
        ['gp-1', 'li-1', 'LI A', 'GP A'],
      ],
    },
    {
      name: 'SDF-AdGroupAds.csv',
      rows: [
        ['Ad Id', 'Ad Group Id', 'Ad Group Name', 'Name'],
        ['cr-1', 'gp-1', 'GP A', 'CR A'],
      ],
    },
  ]);
  assert.equal(parsed.ioList[0].id, 'io-1');
  assert.equal(parsed.ioList[0].cpId, 'cp-1');
  assert.equal(parsed.liList[0].id, 'li-1');
  assert.equal(parsed.liList[0].ioId, 'io-1');
  assert.equal(parsed.gpList[0].id, 'gp-1');
  assert.equal(parsed.gpList[0].liId, 'li-1');
  assert.equal(parsed.crList[0].id, 'cr-1');
  assert.equal(parsed.crList[0].gpId, 'gp-1');
});

test('the inline upload-list remove button can reach its handler', () => {
  assert.equal(api.removeFileIsExposed, true);
});

test('result column widths clamp to safe bounds and persist by stable column key across levels', () => {
  assert.equal(typeof api.buildResultTableColumns, 'function');
  assert.equal(typeof api.getResultColumnWidth, 'function');
  assert.equal(typeof api.setResultColumnWidth, 'function');

  api.setResultColumnWidth('__no', 20);
  api.setResultColumnWidth('__name', 80);
  api.setResultColumnWidth('ステータス', 900);
  const cpColumns = api.buildResultTableColumns('CP', [{ key: 'ステータス', label: 'ステータス' }]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(cpColumns.map(column => [column.key, column.width]))),
    [
      ['__no', 60],
      ['__name', 120],
      ['__status', 85],
      ['ステータス', 600],
    ],
  );

  api.setResultColumnWidth('__no', 144);
  const ioColumns = api.buildResultTableColumns('IO', [{ key: 'FQ', label: 'FQ' }]);
  assert.equal(ioColumns.find(column => column.key === '__no').width, 144);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ioColumns.map(column => column.key))),
    ['__no', '__name', '__status', 'FQ'],
  );
});

test('dynamic column union uses the first CSV order and is stable across repeated runs', () => {
  assert.equal(typeof api.appendDynamicDownloadColumns, 'function');
  const coreColumns = [{ key: 'ステータス', label: 'ステータス' }];
  const rows = [
    { compItems: api.appendDownloadOnlyItems('IO', {
      rawFieldOrder: ['First Field', 'Shared Field'],
      rawFields: { 'First Field': '', 'Shared Field': '' },
    }, []) },
    { compItems: api.appendDownloadOnlyItems('IO', {
      rawFieldOrder: ['First Field', 'Shared Field', 'Last Field'],
      rawFields: { 'First Field': '1', 'Shared Field': '2', 'Last Field': '3' },
    }, []) },
  ];
  const first = api.appendDynamicDownloadColumns('IO', coreColumns, rows);
  const second = api.appendDynamicDownloadColumns('IO', coreColumns, rows);
  assert.deepEqual(
    JSON.parse(JSON.stringify(first.map(column => column.label))),
    ['ステータス', 'First Field', 'Shared Field', 'Last Field'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(first)));
});

test('download-only fields are generated for CP, IO, LI, GP, and CR', () => {
  for (const level of ['CP', 'IO', 'LI', 'GP', 'CR']) {
    const items = api.appendDownloadOnlyItems(level, {
      rawFieldOrder: [`${level} Extra`],
      rawFields: { [`${level} Extra`]: `${level} value` },
    }, []);
    const dynamicItems = items.filter(item => item.rawFieldName === `${level} Extra`);
    assert.equal(dynamicItems.length, 1, `${level} should expose its extra field`);
    assert.equal(dynamicItems[0].label, `${level} Extra`);
  }
});

test('SDF-only records remain renderable instead of existing only in the unmatched summary', () => {
  assert.equal(typeof api.createSdfOnlyNode, 'function');
  const node = api.createSdfOnlyNode('LI', {
    name: 'Unmatched LI',
    id: 'li-1',
    rawFieldOrder: ['Name', 'Custom Field'],
    rawFields: { Name: 'Unmatched LI', 'Custom Field': 'ABC' },
  });
  assert.equal(node.level, 'LI');
  assert.equal(node.fromSdf, true);
  assert.equal(node.found, true);
  assert.equal(node.compItems.some(item => item.label === 'Custom Field'), true);
});

test('SDF-only records reuse core columns and add only genuinely unmapped dynamic columns', () => {
  const node = api.createSdfOnlyNode('CR', {
    name: 'Unmatched CR',
    id: 'cr-1',
    fields: {
      status: 'Active',
      videoId: 'abcdefghijk',
      displayUrl: '',
      landingPageUrl: '',
      callToAction: '',
      headline: '',
    },
    rawFieldOrder: ['Status', 'Video Id', 'Custom Field'],
    rawFields: {
      Status: 'Active',
      'Video Id': 'abcdefghijk',
      'Custom Field': 'ABC',
    },
  });
  const columns = api.appendDynamicDownloadColumns('CR', [
    { key: '動画ID', label: '動画ID' },
    { key: 'ステータス', label: 'ステータス' },
    { key: 'raw_sdf__status', label: '📥 状态 Status' },
  ], [{ compItems: node.compItems }]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(columns.map(column => column.label))),
    ['動画ID', 'ステータス', '📥 状态 Status', 'Custom Field'],
  );
  const statusItem = node.compItems.find(item => item.label === 'ステータス');
  assert.equal(statusItem.dVal, 'Active');
  assert.equal(statusItem.result, 'ok');
  const rawStatusItem = node.compItems.find(item => item.key === 'raw_sdf__status');
  assert.equal(rawStatusItem.dVal, 'Active');
});

test('download-only items do not increase mismatch statistics', () => {
  const status = api.calcOwnStatus([
    { label: 'Core', result: 'ok' },
    { label: 'Custom Field', result: 'download-only', isAutoAdded: true },
  ]);
  assert.equal(status, 'ok');
});

// ── 2026-08-03 追加: Campaign Goal KPI その他=Other / 各階層 Draft=Paused 等価 / LI Conversion Counting Pct ──
function findCompareItem(items, label) {
  return items.find(item => item.label === label);
}

test('Campaign Goal KPI: 設定表その他 と SDF Other を同義扱い（他フィールドに波及しない）', () => {
  const cpKpiResult = (sKpi, dKpi) => findCompareItem(
    api.compareCP({ fields: { kpi: sKpi } }, { fields: { goalKpi: dKpi } }, ''), 'Campaign Goal KPI',
  ).result;
  assert.equal(cpKpiResult('その他', 'Other'), 'ok');        // 场景1
  assert.equal(cpKpiResult('Other', 'Other'), 'ok');         // 场景2
  assert.equal(cpKpiResult('その他', 'Other'), 'ok');        // 场景1
  assert.equal(cpKpiResult('Other', 'Other'), 'ok');         // 场景2
  assert.equal(cpKpiResult('その他', 'CPC'), 'mismatch');    // 场景3
  // normKpi 自体は変更していないため、IO の KPI 比較では その他/Other は不一致のまま
  const ioKpiResult = findCompareItem(
    api.compareIO({ fields: { kpi: 'その他' } }, { fields: { trueViewKpiType: 'Other' } }, ''), 'KPI',
  ).result;
  assert.equal(ioKpiResult, 'mismatch');
});

test('Status: 初期案件の CP～CR 規則を現在案件区分から統一取得する', () => {
  api.setSelectedDv360CaseType('initial');
  const statusResult = (level, actual) => {
    const fn = { CP: api.compareCP, IO: api.compareIO, GP: api.compareGP, CR: api.compareCR }[level];
    return findCompareItem(fn({ fields: {} }, { fields: { status: actual } }), 'ステータス').result;
  };
  assert.equal(statusResult('CP', 'Paused'), 'ok');
  assert.equal(statusResult('IO', 'Draft'), 'ok');
  assert.equal(statusResult('GP', 'Draft'), 'mismatch');
  assert.equal(statusResult('CR', 'Paused'), 'mismatch');
  assert.equal(statusResult('GP', 'Active'), 'ok');
  assert.equal(statusResult('CR', 'Active'), 'ok');
  // 統一的判断関数の直接検証
  assert.equal(api.statusValuesEquivalent('Draft', 'Paused'), true);
  assert.equal(api.statusValuesEquivalent('Paused', 'Draft'), true);
  assert.equal(api.statusValuesEquivalent('Active', 'Paused'), false);
  assert.equal(api.statusValuesEquivalent('Active', 'Draft'), false);
  assert.equal(api.compareStatus('Draft', 'Paused'), 'ok');
  assert.equal(api.compareStatus('Active', 'Paused'), 'mismatch');
});

test('Status(LI): 业务状态と固定原始 Status を案件区分規則で判定する', () => {
  const download = actual => ({ fields: { status: actual }, rawFields: { Status: actual }, rawFieldOrder: ['Status'] });
  api.setSelectedDv360CaseType('initial');
  assert.equal(findCompareItem(api.compareLI({ fields: {} }, download('Paused')), 'ステータス').result, 'ok');
  assert.equal(findCompareItem(api.compareLI({ fields: {} }, download('Active')), 'ステータス').result, 'mismatch');
  const rawStatus = api.compareLI({ fields: {} }, download('Active')).find(item => item.key === 'raw_sdf__status');
  assert.equal(rawStatus.dVal, 'Active');
  api.setSelectedDv360CaseType('crAdditional');
  const skipped = findCompareItem(api.compareLI({ fields: {} }, download('Active')), 'ステータス');
  assert.equal(skipped.result, 'ok');
  assert.equal(skipped.skipped, true);
});

test('LI Conversion Counting Pct: 100/100.0/100% は正常非表示、それ以外は warning 表示、空は現状維持', () => {
  const pctItem = value => api.appendDownloadOnlyItems('LI', {
    rawFieldOrder: ['Conversion Counting Pct'],
    rawFields: { 'Conversion Counting Pct': value },
  }, []).find(item => item.rawFieldName === 'Conversion Counting Pct');
  assert.equal(pctItem('100'), undefined);      // 场景11: 正常 → 非表示
  assert.equal(pctItem('100.0'), undefined);    // 场景12
  assert.equal(pctItem('100%'), undefined);     // 场景13
  assert.equal(pctItem('99').result, 'warning');  // 场景14: 要確認・表示
  assert.equal(pctItem('50').result, 'warning');  // 场景15
  assert.equal(pctItem(''), undefined);           // 场景16: 空値は現状の非表示ルール維持
  assert.equal(pctItem('1').result, 'warning');   // 比例値1は100%と確認されていないため100とみなさない
  // 场景17: 設定表に該当フィールドが無くても（coreItems=[]）非100値は warning 表示される
  assert.equal(pctItem('75').result, 'warning');
});
