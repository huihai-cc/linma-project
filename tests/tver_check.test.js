'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  EDIT_HEADERS,
  REGISTER_HEADERS,
  makeEditCsv,
  makeRegisterCsv,
  makeSettingWorkbook,
  makeStructuredSettingWorkbook,
  makeMinimalSettingWorkbookBuffer,
} = require('./fixtures/tver-fixtures.js');
const tverVerify = require('./tver_real_file.verify.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'tver_check.html');

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} },
    dataset: {}, files: [], innerHTML: '', style: {}, textContent: '', value: initialValue,
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

function loadTverApi() {
  if (!fs.existsSync(htmlPath)) return {};
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('TVER_APP_MARKER'));
  if (!source) return {};

  const exportBlock = `\nwindow.__tverTestApi = {\n` +
    `  parseCsvText: typeof parseCsvText === 'function' ? parseCsvText : undefined,\n` +
    `  detectTverCsvSchema: typeof detectTverCsvSchema === 'function' ? detectTverCsvSchema : undefined,\n` +
    `  findSettingHeaderCandidates: typeof findSettingHeaderCandidates === 'function' ? findSettingHeaderCandidates : undefined,\n` +
    `  expandMergedRows: typeof expandMergedRows === 'function' ? expandMergedRows : undefined,\n` +
    `  findSectionMarker: typeof findSectionMarker === 'function' ? findSectionMarker : undefined,\n` +
    `  locateSection: typeof locateSection === 'function' ? locateSection : undefined,\n` +
    `  findTargetingGroupAnchors: typeof findTargetingGroupAnchors === 'function' ? findTargetingGroupAnchors : undefined,\n` +
    `  parseTverSettingWorkbook: typeof parseTverSettingWorkbook === 'function' ? parseTverSettingWorkbook : undefined,\n` +
    `  buildEditTree: typeof buildEditTree === 'function' ? buildEditTree : undefined,\n` +
    `  buildRegisterTree: typeof buildRegisterTree === 'function' ? buildRegisterTree : undefined,\n` +
    `  collectFieldEvidence: typeof collectFieldEvidence === 'function' ? collectFieldEvidence : undefined,\n` +
    `  selectPrimaryEvidenceForRawValue: typeof selectPrimaryEvidenceForRawValue === 'function' ? selectPrimaryEvidenceForRawValue : undefined,\n` +
    `  matchTverEntities: typeof matchTverEntities === 'function' ? matchTverEntities : undefined,\n` +
    `  getTverIdDictionaries: typeof getTverIdDictionaries === 'function' ? getTverIdDictionaries : undefined,\n` +
    `  validateIdDictionaries: typeof validateIdDictionaries === 'function' ? validateIdDictionaries : undefined,\n` +
    `  normalizeTverDevice: typeof normalizeTverDevice === 'function' ? normalizeTverDevice : undefined,\n` +
    `  normalizeTverVideoDuration: typeof normalizeTverVideoDuration === 'function' ? normalizeTverVideoDuration : undefined,\n` +
    `  resolveSettingAdGroupDevice: typeof resolveSettingAdGroupDevice === 'function' ? resolveSettingAdGroupDevice : undefined,\n` +
    `  resolveSettingTargetingField: typeof resolveSettingTargetingField === 'function' ? resolveSettingTargetingField : undefined,\n` +
  `  resolveSettingTargetingForComparison: typeof resolveSettingTargetingForComparison === 'function' ? resolveSettingTargetingForComparison : undefined,\n` +
    `  tverC344UidSuffixSettingCanonical: typeof tverC344UidSuffixSettingCanonical === 'function' ? tverC344UidSuffixSettingCanonical : undefined,\n` +
    `  tverC344UidSuffixCsvCanonical: typeof tverC344UidSuffixCsvCanonical === 'function' ? tverC344UidSuffixCsvCanonical : undefined,\n` +
    `  parseTverAgeExpression: typeof parseTverAgeExpression === 'function' ? parseTverAgeExpression : undefined,\n` +
    `  resolveSettingAdGroupStatus: typeof resolveSettingAdGroupStatus === 'function' ? resolveSettingAdGroupStatus : undefined,\n` +
    `  resolveSettingAdGroupAuctionType: typeof resolveSettingAdGroupAuctionType === 'function' ? resolveSettingAdGroupAuctionType : undefined,\n` +
    `  resolveSettingDmpExpansionForComparison: typeof resolveSettingDmpExpansionForComparison === 'function' ? resolveSettingDmpExpansionForComparison : undefined,\n` +
    `  buildTverA173ExpansionComparisonInputs: typeof buildTverA173ExpansionComparisonInputs === 'function' ? buildTverA173ExpansionComparisonInputs : undefined,\n` +
    `  buildTverA17TargetingComparisonInputs: typeof buildTverA17TargetingComparisonInputs === 'function' ? buildTverA17TargetingComparisonInputs : undefined,\n` +
    `  readTverA17TargetingCsvValue: typeof readTverA17TargetingCsvValue === 'function' ? readTverA17TargetingCsvValue : undefined,\n` +
    `  resolveTverDeviceFromTagAppeal: typeof resolveTverDeviceFromTagAppeal === 'function' ? resolveTverDeviceFromTagAppeal : undefined,\n` +
    `  resolveTverDeviceFromTargeting: typeof resolveTverDeviceFromTargeting === 'function' ? resolveTverDeviceFromTargeting : undefined,\n` +
    `  normalizeTverPriceForMatching: typeof normalizeTverPriceForMatching === 'function' ? normalizeTverPriceForMatching : undefined,\n` +
    `  normalizeTverNameForMatching: typeof normalizeTverNameForMatching === 'function' ? normalizeTverNameForMatching : undefined,\n` +
    `  resolveSettingDmpProfile: typeof resolveSettingDmpProfile === 'function' ? resolveSettingDmpProfile : undefined,\n` +
    `  resolveCsvDmpProfile: typeof resolveCsvDmpProfile === 'function' ? resolveCsvDmpProfile : undefined,\n` +
    `  resolveSettingRetargetProfile: typeof resolveSettingRetargetProfile === 'function' ? resolveSettingRetargetProfile : undefined,\n` +
    `  resolveCsvRetargetProfile: typeof resolveCsvRetargetProfile === 'function' ? resolveCsvRetargetProfile : undefined,\n` +
    `  createTverConversionContext: typeof createTverConversionContext === 'function' ? createTverConversionContext : undefined,\n` +
    `  structuralProfilesMatch: typeof structuralProfilesMatch === 'function' ? structuralProfilesMatch : undefined,\n` +
    `  resolvedStructuralProfile: typeof resolvedStructuralProfile === 'function' ? resolvedStructuralProfile : undefined,\n` +
    `  settingParseBlockingIssue: typeof settingParseBlockingIssue === 'function' ? settingParseBlockingIssue : undefined,\n` +
    `  compareTverIdSets: typeof compareTverIdSets === 'function' ? compareTverIdSets : undefined,\n` +
    `  parseTverIdSet: typeof parseTverIdSet === 'function' ? parseTverIdSet : undefined,\n` +
    `  validateEmbeddedIdDictionaries: typeof validateEmbeddedIdDictionaries === 'function' ? validateEmbeddedIdDictionaries : undefined,\n` +
    `  parseTverVideoDuration: typeof parseTverVideoDuration === 'function' ? parseTverVideoDuration : undefined,\n` +
    `  resolveSettingOperationalTargetingForComparison: typeof resolveSettingOperationalTargetingForComparison === 'function' ? resolveSettingOperationalTargetingForComparison : undefined,\n` +
    `  resolveCreativeFields: typeof resolveCreativeFields === 'function' ? resolveCreativeFields : undefined,\n` +
    `  validateField: typeof validateField === 'function' ? validateField : undefined,\n` +
    `  compareField: typeof compareField === 'function' ? compareField : undefined,\n` +
    `  buildRunFromModels: typeof buildRunFromModels === 'function' ? buildRunFromModels : undefined,\n` +
    `  buildTverDisplayTree: typeof buildTverDisplayTree === 'function' ? buildTverDisplayTree : undefined,\n` +
    `  buildTverDisplayLabel: typeof buildTverDisplayLabel === 'function' ? buildTverDisplayLabel : undefined,\n` +
    `  resolveAdGroupShortDisplayName: typeof resolveAdGroupShortDisplayName === 'function' ? resolveAdGroupShortDisplayName : undefined,\n` +
    `  buildTverEntryDisplayLabelIndex: typeof buildTverEntryDisplayLabelIndex === 'function' ? buildTverEntryDisplayLabelIndex : undefined,\n` +
    `  buildTverEntityFieldTableHtml: typeof buildTverEntityFieldTableHtml === 'function' ? buildTverEntityFieldTableHtml : undefined,\n` +
    `  deriveDisplayStatus: typeof deriveDisplayStatus === 'function' ? deriveDisplayStatus : undefined,\n` +
    `  buildComparisonRun: typeof buildComparisonRun === 'function' ? buildComparisonRun : undefined,\n` +
    `  summarizeValidationRun: typeof summarizeValidationRun === 'function' ? summarizeValidationRun : undefined,\n` +
    `  applyConservativeRules: typeof applyConservativeRules === 'function' ? applyConservativeRules : undefined,\n` +
    `  getChangeOverrideWhitelist: typeof getChangeOverrideWhitelist === 'function' ? getChangeOverrideWhitelist : undefined,\n` +
    `  runTverCheck: typeof runTverCheck === 'function' ? runTverCheck : undefined,\n` +
  `  renderTverRun: typeof renderTverRun === 'function' ? renderTverRun : undefined,\n` +
    `  renderTverDisplayTree: typeof renderTverDisplayTree === 'function' ? renderTverDisplayTree : undefined,\n` +
    `  buildTverDisplayTreeHtml: typeof buildTverDisplayTreeHtml === 'function' ? buildTverDisplayTreeHtml : undefined,\n` +
    `  toggleTverTreeNode: typeof toggleTverTreeNode === 'function' ? toggleTverTreeNode : undefined,\n` +
    `  setAllTverTreeExpanded: typeof setAllTverTreeExpanded === 'function' ? setAllTverTreeExpanded : undefined,\n` +
    `  buildExceptionCsv: typeof buildExceptionCsv === 'function' ? buildExceptionCsv : undefined,\n` +
    `  copyVisibleExceptions: typeof copyVisibleExceptions === 'function' ? copyVisibleExceptions : undefined,\n` +
    `  clearTverPage: typeof clearTverPage === 'function' ? clearTverPage : undefined,\n` +
    `  filterTverEntries: typeof filterTverEntries === 'function' ? filterTverEntries : undefined,\n` +
  `  buildTverHorizontalFieldLabel: typeof buildTverHorizontalFieldLabel === 'function' ? buildTverHorizontalFieldLabel : undefined,\n` +
    `  resolveTverHorizontalFieldLabel: typeof resolveTverHorizontalFieldLabel === 'function' ? resolveTverHorizontalFieldLabel : undefined,\n` +
    `  collectTverDisplayNodesByLevel: typeof collectTverDisplayNodesByLevel === 'function' ? collectTverDisplayNodesByLevel : undefined,\n` +
    `  buildTverHorizontalColumns: typeof buildTverHorizontalColumns === 'function' ? buildTverHorizontalColumns : undefined,\n` +
  `  buildTverHorizontalViewModel: typeof buildTverHorizontalViewModel === 'function' ? buildTverHorizontalViewModel : undefined,\n` +
    `  buildTverHorizontalTableHtml: typeof buildTverHorizontalTableHtml === 'function' ? buildTverHorizontalTableHtml : undefined,\n` +
    `  bindTverHorizontalInteractions: typeof bindTverHorizontalInteractions === 'function' ? bindTverHorizontalInteractions : undefined,\n` +
    `  syncTverHorizontalScrollAccess: typeof syncTverHorizontalScrollAccess === 'function' ? syncTverHorizontalScrollAccess : undefined,\n` +
    `  syncTverHorizontalHeaderHeights: typeof syncTverHorizontalHeaderHeights === 'function' ? syncTverHorizontalHeaderHeights : undefined,\n` +
    `  syncTverHorizontalStickyPresentation: typeof syncTverHorizontalStickyPresentation === 'function' ? syncTverHorizontalStickyPresentation : undefined,\n` +
    `  scheduleTverHorizontalStickySync: typeof scheduleTverHorizontalStickySync === 'function' ? scheduleTverHorizontalStickySync : undefined,\n` +
    `  projectTverDisplayStatus: typeof projectTverDisplayStatus === 'function' ? projectTverDisplayStatus : undefined,\n` +
    `  projectTverEntityDisplayStatus: typeof projectTverEntityDisplayStatus === 'function' ? projectTverEntityDisplayStatus : undefined,\n` +
    `  getTverDisplayReason: typeof getTverDisplayReason === 'function' ? getTverDisplayReason : undefined,\n` +
    `  buildTverPrefDiffDisplay: typeof buildTverPrefDiffDisplay === 'function' ? buildTverPrefDiffDisplay : undefined,\n` +
    `  buildTverHorizontalDetailViewModel: typeof buildTverHorizontalDetailViewModel === 'function' ? buildTverHorizontalDetailViewModel : undefined,\n` +
    `  buildTverHorizontalDetailRowHtml: typeof buildTverHorizontalDetailRowHtml === 'function' ? buildTverHorizontalDetailRowHtml : undefined,\n` +
    `  setTverHorizontalDetailExpanded: typeof setTverHorizontalDetailExpanded === 'function' ? setTverHorizontalDetailExpanded : undefined,\n` +
    `  projectTverStatusCounts: typeof projectTverStatusCounts === 'function' ? projectTverStatusCounts : undefined,\n` +
    `  matchesTverEntryFilters: typeof matchesTverEntryFilters === 'function' ? matchesTverEntryFilters : undefined,\n` +
    `  matchesTverDisplayEntryFilters: typeof matchesTverDisplayEntryFilters === 'function' ? matchesTverDisplayEntryFilters : undefined,\n` +
    `  getTverColumnWidth: typeof getTverColumnWidth === 'function' ? getTverColumnWidth : undefined,\n` +
    `  resolveTverHorizontalWidths: typeof resolveTverHorizontalWidths === 'function' ? resolveTverHorizontalWidths : undefined,\n` +
    `  setTverColumnWidth: typeof setTverColumnWidth === 'function' ? setTverColumnWidth : undefined,\n` +
    `  resetTverColumnWidths: typeof resetTverColumnWidths === 'function' ? resetTverColumnWidths : undefined,\n` +
    `  TVER_COLUMN_WIDTH_STORAGE_KEY: typeof TVER_COLUMN_WIDTH_STORAGE_KEY === 'string' ? TVER_COLUMN_WIDTH_STORAGE_KEY : undefined,\n` +
    `  formatTverSource: typeof formatTverSource === 'function' ? formatTverSource : undefined,\n` +
    `  formatTverDisplayValue: typeof formatTverDisplayValue === 'function' ? formatTverDisplayValue : undefined,\n` +
    `  getTverPageState: typeof getTverPageState === 'function' ? getTverPageState : undefined,\n` +
    `  updateActionButtons: typeof updateActionButtons === 'function' ? updateActionButtons : undefined,\n` +
    `  identifyTverSettingWorkbook: typeof identifyTverSettingWorkbook === 'function' ? identifyTverSettingWorkbook : undefined,\n` +
    `  identifyTverCsvText: typeof identifyTverCsvText === 'function' ? identifyTverCsvText : undefined,\n` +
    `  identifyTverFiles: typeof identifyTverFiles === 'function' ? identifyTverFiles : undefined,\n` +
    `  setPageFiles: typeof setPageFiles === 'function' ? setPageFiles : undefined,\n` +
    `  hasRecognizedTverFiles: typeof hasRecognizedTverFiles === 'function' ? hasRecognizedTverFiles : undefined,\n` +
    `  triggerExceptionDownload: typeof triggerExceptionDownload === 'function' ? triggerExceptionDownload : undefined,\n` +
    `};\n`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById() { return createElement(); }, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, Map, Set, TextDecoder, Uint8Array, URL, console,
    document, window: null,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__tverTestApi;
}

const api = loadTverApi();

function c342Setting({ names = ['M1', 'M1_DMP'], tags = ['SPPC', 'CTV', 'SPPC', 'CTV'], campaigns } = {}) {
  const mainRows = tags.map((tag, i) => ({
    '発注CPN名': campaigns ? campaigns[i] : 'Identity Campaign',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    'ターゲティング番号': String(i < 2 ? 1 : 2), '素材名': 'synthetic-creative.mp4', 'タグ訴求': tag,
  }));
  const workbook = makeStructuredSettingWorkbook({ mainRows, targetingBatches: [[
    { number: '1', device: 'SP／PC／CTV', price: '11', segment: '' },
    { number: '2', device: 'SP／PC／CTV', price: '11', segment: '68' },
  ]] });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rowIndex = sheet.findIndex(row => row[1] === 'ターゲティング名');
  // fixture仅在内存补充真实模板相对槽位：状态 / 编号 / 名称 / 注释。
  sheet[rowIndex][2] = ''; sheet[rowIndex][4] = names[0]; sheet[rowIndex][5] = '※説明';
  sheet[rowIndex][8] = '初動OFF'; sheet[rowIndex][10] = names[1]; sheet[rowIndex][11] = '※消化用';
  return { model: api.parseTverSettingWorkbook(workbook, { fileName: 'identity-setting.xlsx' }), rowNumber: rowIndex + 1 };
}

test('C3-C4-2: 四GP标签严格来自Setting名称和设备分支', () => {
  const { model } = c342Setting();
  assert.deepEqual(Array.from(model.adGroups, gp => api.buildTverDisplayLabel('Ad Group', gp, { fields: { adgroup_name: 'WRONG_CSV_NAME' } })),
    ['M1_SPPC', 'M1_CTV', 'M1_DMP_SPPC', 'M1_DMP_CTV']);
});

test('C3-C4-2: slots名称与初動OFF分离且primary定位正确Setting单元格', () => {
  const { model, rowNumber } = c342Setting();
  const identity = model.sourceIndex.targetingByNumber['2'].identity;
  assert.equal(identity?.targetingName, 'M1_DMP');
  assert.equal(identity.statusHint, '初動OFF');
  assert.equal(identity.targetingNumber, '2');
  assert.equal(identity.sourceRefs.targetingName.fileName, 'identity-setting.xlsx');
  assert.equal(identity.sourceRefs.targetingName.rowNumber, rowNumber);
  assert.equal(identity.sourceRefs.targetingName.columnNumber, 11);
  assert.equal(identity.sourceRefs.statusHint.columnNumber, 9);
  const label = api.buildTverDisplayLabel('Ad Group', model.adGroups[2], null);
  assert.equal(label, 'M1_DMP_SPPC');
  assert.doesNotMatch(label, /初動OFF|消化用|説明/);
});

test('C3-C4-2: 无targetingName时使用Setting业务tag标签', () => {
  const tags = ['No1_特定_SPPC', 'No1_特定_CTV', 'Taste_A_SPPC', 'Taste_A_CTV', 'localize_SPPC', 'localize_CTV'];
  const { model } = c342Setting({ names: ['', ''], tags });
  assert.deepEqual(Array.from(model.adGroups, gp => api.buildTverDisplayLabel('Ad Group', gp, { fields: { adGroupName: 'WRONG_CSV_NAME' } })), tags);
});

test('C3-C4-2: WRONG_CSV_NAME仍结构匹配且横向対象名保持Setting身份，不新增名称QC', () => {
  const { model } = c342Setting();
  const parsed = api.parseCsvText(makeRegisterCsv(model.adGroups.map((gp, i) => ({
    campaign_name: model.campaigns[0].expectedName, adgroup_name: i === 0 ? 'WRONG_CSV_NAME' : `CSV-${i}`,
    device: i % 2 ? 'ctv' : 'android ios pc', price: '11', dmp_segment: i < 2 ? '' : '68',
  }))));
  const tree = api.buildRegisterTree(parsed);
  const matching = api.matchTverEntities(model, tree, { schemaKind: parsed.schema.kind, conversionContext: api.createTverConversionContext(parsed.schema.kind, tree) });
  assert.equal(matching.matches.filter(m => m.level === 'Ad Group' && m.status === 'matched').length, 4);
  const before = JSON.stringify({ model, tree, matching });
  const run = api.buildRunFromModels(model, tree, matching, parsed);
  const view = api.buildTverHorizontalViewModel(run, 'Ad Group');
  assert.deepEqual(Array.from(view.rows, row => row.displayLabel), ['M1_SPPC', 'M1_CTV', 'M1_DMP_SPPC', 'M1_DMP_CTV']);
  assert.equal(run.entries.some(e => e.field === 'adgroup_name'), false);
  assert.equal(JSON.stringify({ model, tree, matching }), before);
  const html = api.buildTverHorizontalTableHtml(view);
  assert.match(html, /M1_SPPC/);
  assert.doesNotMatch(html, />WRONG_CSV_NAME</);
});

test('C3-C4-2: 相同targetingName跨Campaign不串线，identity来源均为Setting', () => {
  const { model } = c342Setting({ names: ['Shared', 'Shared'], campaigns: ['CP-A', 'CP-A', 'CP-B', 'CP-B'] });
  assert.equal(typeof api.resolveAdGroupShortDisplayName, 'function');
  const labels = Array.from(model.adGroups, gp => api.resolveAdGroupShortDisplayName(gp));
  assert.deepEqual(labels.map(x => x.value), ['Shared_SPPC', 'Shared_CTV', 'Shared_SPPC', 'Shared_CTV']);
  assert.notEqual(model.adGroups[0].parentKey, model.adGroups[2].parentKey);
  assert.notEqual(labels[0].primarySource.columnNumber, labels[2].primarySource.columnNumber);
  assert.ok(labels.every(x => x.sourceEvidence.every(s => s.fileName === 'identity-setting.xlsx')));
});

test('C3-C4-2: CSV-only明确标记且Setting缺身份不回退CSV', () => {
  assert.equal(api.buildTverDisplayLabel('Ad Group', { fields: {}, sourceRefs: {} }, { fields: { adgroup_name: 'WRONG_CSV_NAME' } }), '広告グループ');
  const label = api.buildTverDisplayLabel('Ad Group', null, { fields: { adgroup_name: 'CSV orphan' } });
  assert.match(label, /CSV側未匹配/);
});

test('C3-C4-2: 新identity字段不改变旧targeting semanticSignature', () => {
  const { model } = c342Setting();
  for (const group of Object.values(model.sourceIndex.targetingByNumber)) {
    assert.equal(group.semanticSignature, JSON.stringify(group.fields));
    assert.equal(Object.hasOwn(group.fields, 'targetingName'), false);
    assert.equal(Object.hasOwn(group.fields, 'statusHint'), false);
  }
});

test('C3-C4-2: GP対象名改变时Ad tab父组标题保持原有上下文', () => {
  const fixture = makeA181CFixture({ settingFields: { tagAppeal: 'Setting identity' }, csvFields: { adgroup_name: 'Original CSV context' } });
  const run = { entries: fixture.entries, displayTree: api.buildTverDisplayTree(fixture) };
  const gp = api.buildTverHorizontalViewModel(run, 'Ad Group');
  const ad = api.buildTverHorizontalViewModel(run, 'Ad');
  assert.equal(gp.rows[0].displayLabel, 'Setting identity');
  assert.equal(ad.rows[0].parentDisplayLabel, 'Original CSV context');
});

// ===== C3-C4-3 Red：已确认 GP operational/targeting contract =====
function c343Source(columnName, rawValue, rowNumber = 66) {
  return {
    fileName: 'c343-setting.xlsx', sheetName: '設定', rowNumber, columnName,
    rawValue: String(rawValue ?? ''),
  };
}

function c343Entity({ statusHint = '', targetingName = 'M1', gender = '', broadcaster = '', dmp = '', otherSettings = '' } = {}) {
  const statusSource = c343Source('ターゲティング名', statusHint, 66);
  const nameSource = c343Source('ターゲティング名', targetingName, 66);
  const targeting = {
    'ターゲティング名': [statusSource, nameSource],
    '性別●': gender === '' ? [] : [c343Source('性別●', gender)],
    '放送局●': broadcaster === '' ? [] : [c343Source('放送局●', broadcaster)],
    'DMPセグメント': dmp === '' ? [] : [c343Source('DMPセグメント', dmp)],
    'その他設定(ADG)': otherSettings === '' ? [] : [c343Source('その他設定(ADG)', otherSettings)],
  };
  return {
    key: 'c343-setting-adgroup', level: 'Ad Group', fields: { adgroupName: 'GP', targeting: {} },
    displayIdentity: { targetingNumber: '1', targetingName, statusHint, sourceRefs: { targetingName: nameSource, statusHint: statusSource } },
    sourceEvidence: { targeting, fields: {} },
  };
}

function c343Fix1DevicePriceEntity({ tagAppeal = 'SPPC', price = '- ¥1,500 ¥1,500' } = {}) {
  const genericDevice = c343Source('配信デバイス●', '- SP／PC／CTV ※OS指定ある場合はここに記入');
  const tagSource = c343Source('タグ訴求', tagAppeal);
  const placeholderPrice = c343Source('CPM●', '-');
  const actualPrice = c343Source('CPM●', '¥1,500');
  return {
    key: `c343-fix1-${tagAppeal}`,
    level: 'Ad Group',
    fields: {
      targetingNumber: tagAppeal.includes('DMP') ? '2' : '1',
      tagAppeal,
      device: genericDevice.rawValue,
      targeting: { device: genericDevice.rawValue, price },
    },
    sourceRefs: { device: genericDevice, tagAppeal: tagSource },
    sourceEvidence: {
      fields: { price: [placeholderPrice, actualPrice], device: [genericDevice], tagAppeal: [tagSource] },
      derived: { device: { derivedFrom: [genericDevice, tagSource] } },
    },
  };
}

function c343Fix2DeviceFallback2495Entity({ tagAppeal = '', deviceValues = ['-', 'CTV', '※OS指定ある場合はここに記入'] } = {}) {
  const deviceSources = deviceValues.map(rawValue => c343Source('配信デバイス●', rawValue, 50));
  const deviceAggregate = deviceValues.filter(rawValue => String(rawValue ?? '') !== '').join(' ');
  const tagSource = c343Source('タグ訴求', tagAppeal, 28);
  return {
    key: 'c343-fix2-2495-fallback', level: 'Ad Group',
    fields: { tagAppeal, device: deviceAggregate, targeting: { device: deviceAggregate } },
    sourceRefs: { device: deviceSources[0], tagAppeal: tagSource },
    sourceEvidence: {
      fields: { device: deviceSources, tagAppeal: [tagSource] },
      targeting: { '配信デバイス●': deviceSources },
      derived: { device: { derivedFrom: [...deviceSources, tagSource] } },
    },
  };
}

test('C3-C4-3-Fix1 Red: 2431 Device raw/source使用既有关联GP的タグ訴求且四GP canonical一致', () => {
  const cases = [
    ['M1_SPPC', 'SPPC', 'android ios pc'],
    ['M1_CTV', 'CTV', 'ctv'],
    ['M1_DMP_SPPC', 'SPPC', 'android ios pc'],
    ['M1_DMP_CTV', 'CTV', 'ctv'],
  ];
  cases.forEach(([label, tagAppeal, csvValue]) => {
    const setting = c343Fix1DevicePriceEntity({ tagAppeal });
    const device = api.resolveSettingAdGroupDevice(setting);
    assert.equal(device.rawValue, tagAppeal, label);
    assert.equal(device.comparisonSource.columnName, 'タグ訴求', label);
    assert.equal(device.comparisonSource.rawValue, tagAppeal, label);
    assert.notEqual(device.rawValue, device.device, label);
    const comparison = api.compareField({
      field: 'device', settingValue: device.rawValue, csvValue,
      settingCanonical: { value: device.device, ruleId: device.ruleBasis, evidenceState: 'available' },
      csvCanonical: { value: csvValue, ruleId: 'TVER_A16_DEVICE_CSV', evidenceState: 'available' },
      settingSource: device.comparisonSource, csvSource: c343Source('device', csvValue, 2),
      ruleBasis: device.ruleBasis,
    });
    assert.equal(api.projectTverDisplayStatus(comparison.displayStatus), '一致', label);
  });
});

test('C3-C4-3-Fix1 Red: Device不使用旧通用配信デバイス说明且Setting raw不替换为canonical', () => {
  const device = api.resolveSettingAdGroupDevice(c343Fix1DevicePriceEntity({ tagAppeal: 'SPPC' }));
  assert.equal(device.rawValue, 'SPPC');
  assert.equal(device.comparisonSource.columnName, 'タグ訴求');
  assert.equal(device.comparisonSource.rawValue, 'SPPC');
  assert.notEqual(device.comparisonSource.rawValue, '-');
  assert.notEqual(device.rawValue, 'android ios pc');
});

test('C3-C4-3-Fix1 Red: CPM Setting只返回一个真实值，排除placeholder与重复aggregate并与1500 canonical一致', () => {
  const fixture = c343Fix1DevicePriceEntity();
  const price = api.resolveSettingTargetingField(fixture, 'price');
  assert.equal(price.value, '¥1,500');
  assert.equal(price.primarySource.rawValue, '¥1,500');
  assert.equal(price.value.includes('-'), false);
  assert.equal(price.value, '¥1,500');
  const comparison = api.compareField({
    field: 'price', settingValue: price.value, csvValue: '1500',
    settingSource: price.primarySource, csvSource: c343Source('price', '1500', 2),
    ruleBasis: 'TVER_C3_C4_3_PRICE_FROM_CPM',
  });
  assert.equal(api.projectTverDisplayStatus(comparison.displayStatus), '一致');
  ['¥1,500', '1500', '1,500'].forEach(raw => assert.equal(api.normalizeTverPriceForMatching(raw).value, '1500'));
});

function c343CsvEntity({ status = '', auction = '', gender = '', local = '', expansion = '' } = {}) {
  const fields = { adgroup_status: status, auction_type: auction, gender, local_broadcaster: local, dmp_segment_expansion_threshold: expansion };
  const sourceEvidence = { fields: {} };
  Object.entries(fields).forEach(([field, value]) => {
    if (value !== '') sourceEvidence.fields[field] = [c343Source(field, value, 2)];
  });
  return { key: 'c343-csv-adgroup', level: 'Ad Group', fields, sourceEvidence, rawRows: [] };
}

test('C3-C4-3 Red: status 默认1、初動OFF为0，且不从targetingName误读状态', () => {
  assert.equal(typeof api.resolveSettingAdGroupStatus, 'function');
  const cases = [
    ['', 'M1', '1'], ['初動OFF', 'M1', '0'], ['', '初動OFF', '1'], ['初動ＯＦＦ', 'M1', '0'],
  ];
  cases.forEach(([statusHint, targetingName, expected]) => {
    const result = api.resolveSettingAdGroupStatus(c343Entity({ statusHint, targetingName }));
    assert.equal(result.canonicalValue, expected);
    assert.equal(result.comparable, true);
    assert.equal(result.primarySource.columnName, 'ターゲティング名');
    assert.equal(result.ruleBasis, 'TVER_C3_C4_3_ADGROUP_STATUS_FROM_TARGETING_STATUS_HINT');
  });
});

test('C3-C4-3 Red: 2431 status 1/1/0/0 与 CSV 原值逐条比较', () => {
  const settingValues = ['', '', '初動OFF', '初動OFF'];
  const csvValues = ['1', '1', '0', '0'];
  const statuses = settingValues.map((statusHint, index) => {
    const setting = api.resolveSettingAdGroupStatus(c343Entity({ statusHint }));
    return api.compareField({ field: 'adgroup_status', settingValue: setting.rawValue, csvValue: csvValues[index],
      settingCanonical: { value: setting.canonicalValue, ruleId: setting.ruleBasis, evidenceState: setting.evidenceState },
      csvCanonical: { value: csvValues[index], ruleId: 'CSV_STATUS', evidenceState: 'available' },
      settingEvidenceState: setting.evidenceState, csvEvidenceState: 'available', comparable: true,
      schemaKind: 'register-without-ids', currentStatusRequired: false, ruleBasis: setting.ruleBasis,
      settingSource: setting.primarySource, csvSource: c343Source('adgroup_status', csvValues[index], index + 2),
    }).comparisonStatus;
  });
  assert.deepEqual(statuses, ['一致', '一致', '一致', '一致']);
});

test('C3-C4-4B-Fix2 Red: status display label不应触发canonical equal的要確認且真实不一致仍保留', () => {
  const compareStatus = (settingDisplay, settingCanonical, csvRaw, csvCanonical) => api.compareField({
    field: 'adgroup_status', level: 'Ad Group', settingValue: settingDisplay, csvValue: csvRaw,
    settingCanonical: { value: settingCanonical, ruleId: 'TVER_C3_C4_3_ADGROUP_STATUS_FROM_TARGETING_STATUS_HINT', evidenceState: 'available' },
    csvCanonical: { value: csvCanonical, ruleId: 'TVER_C3_C4_3_STATUS_CSV', evidenceState: 'available' },
    settingEvidenceState: 'available', csvEvidenceState: 'available', comparable: true, alwaysDisplay: true,
    currentStatusRequired: true, ruleBasis: 'TVER_C3_C4_3_ADGROUP_STATUS_FROM_TARGETING_STATUS_HINT',
    comparisonStatus: String(settingCanonical) === String(csvCanonical) ? '一致' : null,
    settingSource: c343Source('ターゲティング名', settingDisplay), csvSource: c343Source('adgroup_status', csvRaw, 2),
  });
  const normal = api.resolveSettingAdGroupStatus(c343Entity());
  const initialOff = api.resolveSettingAdGroupStatus(c343Entity({ statusHint: '初動OFF' }));
  assert.equal(normal.displayValue, '通常');
  assert.equal(normal.canonicalValue, '1');
  assert.equal(initialOff.displayValue, '初動OFF');
  assert.equal(initialOff.canonicalValue, '0');

  const normalEqual = compareStatus(normal.displayValue, normal.canonicalValue, '1', '1');
  assert.equal(normalEqual.comparisonStatus, '一致');
  assert.equal(normalEqual.displayStatus, '一致');
  assert.equal(normalEqual.validationIssues.length, 0);

  const initialOffEqual = compareStatus(initialOff.displayValue, initialOff.canonicalValue, '0', '0');
  assert.equal(initialOffEqual.comparisonStatus, '一致');
  assert.equal(initialOffEqual.displayStatus, '一致');
  assert.equal(initialOffEqual.validationIssues.length, 0);

  const mismatch = compareStatus(normal.displayValue, normal.canonicalValue, '0', '0');
  assert.equal(mismatch.comparisonStatus, '不一致');
  assert.equal(mismatch.displayStatus, '不一致');
});

test('C3-C4-4B-Fix2 Red: 2495 Device fallback选择CTV cell并忽略dash与模板说明', () => {
  const fallback = api.resolveSettingAdGroupDevice(c343Fix2DeviceFallback2495Entity());
  assert.equal(fallback.resolved, true);
  assert.equal(fallback.rawValue, 'CTV');
  assert.equal(fallback.primarySource.rawValue, 'CTV');
  assert.equal(fallback.comparisonSource.rawValue, 'CTV');
  assert.equal(fallback.device, 'ctv');
  assert.notEqual(fallback.rawValue, '- CTV ※OS指定ある場合はここに記入');
  assert.notEqual(fallback.rawValue, '-');
  assert.notEqual(fallback.rawValue, '※OS指定ある場合はここに記入');
  const comparison = api.compareField({
    field: 'device', settingValue: fallback.rawValue, csvValue: 'ctv',
    settingCanonical: { value: fallback.device, ruleId: 'TVER_A16_DEVICE_DERIVED', evidenceState: 'available' },
    csvCanonical: { value: 'ctv', ruleId: 'TVER_A16_DEVICE_CSV', evidenceState: 'available' },
    settingSource: fallback.comparisonSource, csvSource: c343Source('device', 'ctv', 2), ruleBasis: 'TVER_A16_DEVICE_DERIVED',
  });
  assert.equal(comparison.canonicalValues.setting, 'ctv');
  assert.equal(comparison.canonicalValues.csv, 'ctv');
  assert.equal(api.projectTverDisplayStatus(comparison.displayStatus), '一致');
  assert.equal(api.resolveSettingAdGroupDevice(c343Fix1DevicePriceEntity({ tagAppeal: 'SPPC' })).rawValue, 'SPPC');
  assert.equal(api.resolveSettingAdGroupDevice(c343Fix1DevicePriceEntity({ tagAppeal: 'CTV' })).rawValue, 'CTV');
});

test('C3-C4-4B-Fix1 Red: GP Status Setting display使用业务标签且canonical与CSV raw保持不变', () => {
  const { model } = c342Setting();
  const parsed = api.parseCsvText(makeRegisterCsv(model.adGroups.map((group, index) => ({
    campaign_name: model.campaigns[0].expectedName,
    adgroup_name: `CSV-GP-${index}`,
    device: index % 2 ? 'ctv' : 'android ios pc',
    price: '11',
    dmp_segment: index < 2 ? '' : '68',
    adgroup_status: index < 2 ? '1' : '0',
  }))));
  const tree = api.buildRegisterTree(parsed);
  const matching = api.matchTverEntities(model, tree, {
    schemaKind: parsed.schema.kind,
    conversionContext: api.createTverConversionContext(parsed.schema.kind, tree),
  });
  const run = api.buildRunFromModels(model, tree, matching, parsed);
  const entries = run.entries.filter(entry => entry.level === 'Ad Group' && entry.field === 'adgroup_status');

  assert.equal(entries.length, 4);
  assert.deepEqual(Array.from(entries, entry => entry.settingRawValue), ['通常', '通常', '初動OFF', '初動OFF']);
  assert.deepEqual(Array.from(entries, entry => entry.csvRawValue), ['1', '1', '0', '0']);
  assert.deepEqual(Array.from(entries, entry => entry.canonicalValues.setting), ['1', '1', '0', '0']);
  assert.deepEqual(Array.from(entries, entry => entry.canonicalValues.csv), ['1', '1', '0', '0']);
  assert.deepEqual(Array.from(entries, entry => entry.comparisonStatus), ['一致', '一致', '一致', '一致']);
});

test('C3-C4-3 Red: auction 默认1，未知特殊入札设定只能需确认', () => {
  assert.equal(typeof api.resolveSettingAdGroupAuctionType, 'function');
  const normal = api.resolveSettingAdGroupAuctionType(c343Entity());
  assert.equal(normal.canonicalValue, '1');
  assert.equal(normal.comparable, true);
  const legalTwo = c343Entity();
  legalTwo.sourceEvidence.fields.auction_type = [c343Source('auction_type', '2')];
  assert.equal(api.resolveSettingAdGroupAuctionType(legalTwo).canonicalValue, '2');
  const unknown = api.resolveSettingAdGroupAuctionType(c343Entity({ otherSettings: 'オークション設定: unknown' }));
  assert.equal(unknown.canonicalValue, null);
  assert.equal(unknown.evidenceState, 'ambiguous');
  assert.equal(unknown.shouldGenerate, true);
});

test('C3-C4-3 Red: 性別 男性/女性/その他 映射 1/2/3，双方空值不生成', () => {
  [['男性', '1'], ['女性', '2'], ['その他', '3']].forEach(([raw, expected]) => {
    const result = api.resolveSettingTargetingForComparison(c343Entity({ gender: raw }), 'gender');
    assert.equal(result.canonicalValue, expected);
    assert.equal(result.comparable, true);
    assert.equal(result.primarySource.columnName, '性別●');
    assert.equal(result.ruleBasis, 'TVER_C3_C4_3_GENDER_MAPPING');
  });
  const empty = api.resolveSettingTargetingForComparison(c343Entity(), 'gender');
  assert.equal(empty.shouldGenerate, false);
  assert.equal(api.buildTverA17TargetingComparisonInputs(c343Entity(), c343CsvEntity(), 'register-without-ids', {}).some(input => input.field === 'gender'), false);
});

test('C3-C4-3 Red: 放送局●的精确○表示139个local_broadcaster，其他字段○不得借用', () => {
  const full = api.resolveSettingTargetingForComparison(c343Entity({ broadcaster: '○' }), 'local_broadcaster');
  const dictionary = api.getTverIdDictionaries().local_broadcaster;
  assert.equal(dictionary.length, 139);
  assert.equal(full.canonicalValue.split(' ').length, 139);
  assert.equal(full.comparable, true);
  const arbitrary = api.resolveSettingTargetingForComparison(c343Entity({ gender: '○' }), 'local_broadcaster');
  assert.equal(arbitrary.shouldGenerate, false);
});

test('C3-C4-3 Red: DMP 有则扩展默认10，明确DMP拡張値0覆盖；无DMP不生成', () => {
  assert.equal(typeof api.resolveSettingDmpExpansionForComparison, 'function');
  const defaultResult = api.resolveSettingDmpExpansionForComparison(c343Entity({ dmp: '68' }));
  assert.equal(defaultResult.canonicalValue, '10');
  assert.equal(defaultResult.comparable, true);
  assert.equal(defaultResult.ruleBasis, 'TVER_C3_C4_3_DMP_EXPANSION_DEFAULT_10');
  assert.ok(defaultResult.derivedFrom.some(source => source.columnName === 'DMPセグメント'));
  const override = api.resolveSettingDmpExpansionForComparison(c343Entity({ dmp: '68', otherSettings: 'DMP拡張値0で設定' }));
  assert.equal(override.canonicalValue, '0');
  assert.equal(override.primarySource.rawValue, 'DMP拡張値0で設定');
  assert.equal(override.ruleBasis, 'TVER_C3_C4_3_DMP_EXPANSION_EXPLICIT');
  const absent = api.resolveSettingDmpExpansionForComparison(c343Entity());
  assert.equal(absent.shouldGenerate, false);
  assert.equal(api.buildTverA173ExpansionComparisonInputs(c343Entity(), c343CsvEntity(), 'register-without-ids', {}).length, 0);
});

test('C3-C4-3 Red: DMP扩展 Edit schema仍可比较10/0，不受dmp_segment unavailable影响', () => {
  const setting = c343Entity({ dmp: '68' });
  const csv = c343CsvEntity({ expansion: '10' });
  const inputs = api.buildTverA173ExpansionComparisonInputs(setting, csv, 'edit-with-ids', { level: 'Ad Group', entityKey: setting.key });
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].settingCanonical.value, '10');
  assert.equal(inputs[0].csvCanonical.value, '10');
  assert.equal(inputs[0].comparisonStatus, '一致');
});

// C3-C4-1：聚合测试以CSV schema为边界，不使用生产signature字段清单生成预期。
const C341_GP_FIELDS = REGISTER_HEADERS.slice(REGISTER_HEADERS.indexOf('tver_video_duration'), REGISTER_HEADERS.indexOf('creative_id'));
const C341_AD_FIELDS = REGISTER_HEADERS.slice(REGISTER_HEADERS.indexOf('creative_id'));
function c341Tree(rows) {
  const parsed = api.parseCsvText(makeRegisterCsv(rows.map(row => ({
    campaign_name: 'Contract Campaign', adgroup_name: 'Contract GP', device: 'ctv', price: '11',
    creative_name: 'first.mp4', ...row,
  }))), { fileName: 'c341-register.csv' });
  return { parsed, tree: api.buildRegisterTree(parsed) };
}

for (const field of C341_GP_FIELDS) {
  test(`C3-C4-1: GP配置差异不得合并 ${field}`, () => {
    const { tree } = c341Tree([{ [field]: '1' }, { [field]: '2' }]);
    assert.equal(tree.adGroups.length, 2, `${field} 不同必须形成独立GP`);
    assert.equal(new Set(tree.adGroups.map(g => g.key)).size, 2);
    assert.equal(new Set(tree.ads.map(ad => ad.parentKey)).size, 2);
    assert.deepEqual(Array.from(tree.adGroups, g => Array.from(g.rawRows, row => row.rowNumber)), [[2], [3]]);
  });
}

for (const field of C341_AD_FIELDS) {
  test(`C3-C4-1: Ad差异保持一个GP及两个Ad ${field}`, () => {
    const { tree } = c341Tree([{ [field]: 'first' }, { [field]: 'second' }]);
    assert.equal(tree.adGroups.length, 1);
    assert.equal(tree.ads.length, 2);
    assert.ok(tree.ads.every(ad => ad.parentKey === tree.adGroups[0].key));
  });
}

test('C3-C4-1: 全GP原始字段及多Ad provenance保留，primary对应真实值', () => {
  const values = Object.fromEntries(C341_GP_FIELDS.map(field => [field, `raw-${field}`]));
  const { tree } = c341Tree([values, { ...values, creative_name: 'second.mp4' }]);
  const gp = tree.adGroups[0];
  assert.equal(tree.adGroups.length, 1);
  for (const field of C341_GP_FIELDS) {
    assert.equal(gp.fields[field], values[field]);
    assert.deepEqual(Array.from(gp.sourceEvidence.fields[field], s => s.rowNumber), [2, 3]);
    assert.equal(gp.sourceRefs[field].rawValue, values[field]);
    assert.ok(gp.sourceEvidence.fields[field].includes(gp.sourceRefs[field]));
  }
});

test('C3-C4-1: 拆分GP的全部scope evidence不得跨实体', () => {
  const { tree } = c341Tree([
    { dmp_segment: '68', dmp_segment_expansion_threshold: '10' },
    { dmp_segment: '68', dmp_segment_expansion_threshold: '0' },
    { dmp_segment: '68', dmp_segment_expansion_threshold: '10', creative_name: 'second.mp4' },
  ]);
  assert.equal(tree.adGroups.length, 2);
  tree.adGroups.forEach((gp, index) => {
    const ownedRows = index === 0 ? [2, 4] : [3];
    for (const field of C341_GP_FIELDS) {
      assert.deepEqual(Array.from(gp.sourceEvidence.fields[field], s => s.rowNumber), ownedRows);
      assert.ok(ownedRows.includes(gp.sourceRefs[field].rowNumber));
    }
  });
});

test('C3-C4-1: aggregation identity独立于旧candidate及matchingFields', () => {
  const { tree } = c341Tree([{ dmp_segment_expansion_threshold: '10' }, { dmp_segment_expansion_threshold: '0' }]);
  assert.equal(tree.adGroups.length, 2);
  const [a, b] = tree.adGroups;
  assert.notEqual(a.aggregationSignature, b.aggregationSignature);
  assert.equal(a.candidateSignature, b.candidateSignature);
  assert.deepEqual(a.matchingFields, b.matchingFields);
  assert.equal(a.candidateSignature, JSON.stringify(a.matchingFields));
  assert.equal(Object.hasOwn(a.matchingFields, 'adgroup_status'), false);
  assert.equal(Object.hasOwn(a.matchingFields, 'dmp_segment_expansion_threshold'), false);
  assert.equal(tree.ads[0].candidateSignature, tree.ads[1].candidateSignature);
  assert.notEqual(tree.ads[0].parentKey, tree.ads[1].parentKey);
});

function c341Run(rows, retargetField) {
  const { parsed, tree } = c341Tree(rows);
  const campaign = { key: 'setting-cp', level: 'Campaign', expectedName: 'Contract Campaign', fields: {}, sourceRefs: {} };
  const groups = tree.adGroups.map((gp, i) => {
    const source = makeA173RetargetAdGroup({
      key: `setting-gp-${i}`, dataValues: retargetField === 'store_segment' ? ['○', '6543'] : [],
      bidValues: retargetField === 'bid_segment' ? ['○', '6543'] : [],
    });
    return { ...source, parentKey: campaign.key, expectedName: gp.fields.adGroupName,
      fields: { ...source.fields, targeting: { ...source.fields.targeting, price: '11', device: 'CTV' } } };
  });
  const model = { campaigns: [campaign], adGroups: groups, ads: [], diagnostics: [], sourceIndex: {} };
  const matching = api.matchTverEntities(model, tree, {
    schemaKind: parsed.schema.kind, conversionContext: api.createTverConversionContext(parsed.schema.kind, tree),
  });
  return { tree, run: api.buildRunFromModels(model, tree, matching, parsed) };
}

test('C3-C4-1: Register status comparison保留1/1/0/0，不派生Setting状态', () => {
  const { run } = c341Run(['1', '1', '0', '0'].map((status, i) => ({ adgroup_name: `GP-${i}`, adgroup_status: status })));
  const entries = run.entries.filter(e => e.level === 'Ad Group' && e.field === 'adgroup_status');
  assert.deepEqual(Array.from(entries, e => e.csvRawValue), ['1', '1', '0', '0']);
  assert.ok(entries.every(e => e.settingRawValue === '' && e.comparisonStatus === '需确认'));
  entries.forEach((e, i) => assert.equal(e.sourceEvidence.csv[0].rowNumber, i + 2));
});

for (const field of ['store_segment', 'bid_segment']) {
  test(`C3-C4-1: Register matcher与comparison读取同一Retarget ${field}`, () => {
    const { tree, run } = c341Run([{ [field]: '6543' }], field);
    const profile = api.createTverConversionContext('register-without-ids', tree).getCsvAdGroupProfile(tree.adGroups[0]);
    assert.equal(profile.fields.retargetKind, field === 'store_segment' ? 'store' : 'bid');
    assert.equal(profile.fields.retargetSegmentId, '6543');
    const entry = run.entries.find(e => e.level === 'Ad Group' && e.field === field);
    assert.equal(entry.csvRawValue, profile.fields.retargetSegmentId);
    assert.equal(entry.comparisonStatus, '一致');
  });
}

test('CSV: edit 的 61 列及三层 ID 被识别为 edit-with-ids', () => {
  const result = api.parseCsvText(makeEditCsv([{ campaign_id: '101', adgroup_id: '201', ad_id: '301' }], { bom: true }), { fileName: 'synthetic-edit.csv' });
  assert.equal(result.schema.kind, 'edit-with-ids');
  assert.equal(result.schema.businessRole, '下载时点的后台当前状态');
  assert.equal(result.headers.length, 61);
  assert.deepEqual(Array.from(result.schema.unavailableFields), ['budget_type', 'tver_video_duration', 'dmp_segment']);
});

test('CSV: register 的 61 列且无三层 ID 被识别为 register-without-ids', () => {
  const result = api.parseCsvText(makeRegisterCsv([{ budget_type: 'fixed', tver_video_duration: '15', dmp_segment: 'none' }], { bom: true }), { fileName: 'synthetic-register.csv' });
  assert.equal(result.schema.kind, 'register-without-ids');
  assert.equal(result.schema.businessRole, '入稿内容一致性检查：不能证明后台已经正确登记');
  assert.equal(result.headers.length, 61);
});

test('CSV: BOM、引号内换行和末尾空列保留原始值与 CSV 行号', () => {
  const result = api.parseCsvText(makeEditCsv([{
    campaign_id: '101', adgroup_id: '201', ad_id: '301',
    campaign_name: 'Synthetic\nCampaign', tracking_url_complete: '',
  }], { bom: true }), { fileName: 'quoted.csv' });
  assert.equal(result.rows[0].values.campaign_name, 'Synthetic\nCampaign');
  assert.equal(result.rows[0].values.tracking_url_complete, '');
  assert.equal(result.rows[0].source.rowNumber, 2);
  assert.equal(result.rows[0].source.fileName, 'quoted.csv');
});

test('CSV: 61 列但缺关键字段或 ID 混合时拒绝 Schema', () => {
  const mixed = [...EDIT_HEADERS];
  mixed[mixed.indexOf('ad_id')] = 'dmp_segment';
  const missing = [...REGISTER_HEADERS];
  missing[missing.indexOf('campaign_name')] = 'unknown_campaign_column';
  const mixedResult = api.detectTverCsvSchema(mixed);
  const missingResult = api.detectTverCsvSchema(missing);
  assert.equal(mixedResult.kind, null);
  assert.ok(mixedResult.missingHeaders.length > 0);
  assert.equal(missingResult.kind, null);
  assert.ok(missingResult.missingHeaders.includes('campaign_name'));
});

test('CSV: 完整 edit/register 字段集合分别被接受，列顺序不作为条件', () => {
  const reorderedEdit = [...EDIT_HEADERS].reverse();
  const reorderedRegister = [...REGISTER_HEADERS].reverse();
  const edit = api.detectTverCsvSchema(reorderedEdit);
  const register = api.detectTverCsvSchema(reorderedRegister);
  assert.equal(edit.kind, 'edit-with-ids');
  assert.equal(register.kind, 'register-without-ids');
  assert.deepEqual(Array.from(edit.missingHeaders), []);
  assert.deepEqual(Array.from(register.unexpectedHeaders), []);
});

test('CSV: 普通正式字段被虚构字段替换时拒绝，并返回缺失与意外字段', () => {
  const headers = [...EDIT_HEADERS];
  headers[headers.indexOf('annual_income')] = 'invented_normal_field';
  const result = api.detectTverCsvSchema(headers);
  assert.equal(result.kind, null);
  assert.deepEqual(Array.from(result.missingHeaders), ['annual_income']);
  assert.deepEqual(Array.from(result.unexpectedHeaders), ['invented_normal_field']);
  assert.deepEqual(Array.from(result.duplicateHeaders), []);
});

test('CSV: 重复表头导致正式字段缺失时拒绝，并返回 duplicateHeaders', () => {
  const headers = [...REGISTER_HEADERS];
  headers[headers.indexOf('annual_income')] = 'campaign_name';
  const result = api.detectTverCsvSchema(headers);
  assert.equal(result.kind, null);
  assert.deepEqual(Array.from(result.missingHeaders), ['annual_income']);
  assert.deepEqual(Array.from(result.unexpectedHeaders), []);
  assert.deepEqual(Array.from(result.duplicateHeaders), ['campaign_name']);
});

test('CSV: 每个字段保留独立 SourceRef 与未规范化 rawValue', () => {
  const result = api.parseCsvText(makeEditCsv([{
    campaign_id: '101', adgroup_id: '201', ad_id: '301',
    campaign_name: '  Synthetic Campaign  ', adgroup_name: ' Group ', creative_name: ' creative.mp4 ',
  }]), { fileName: 'field-sources.csv' });
  for (const field of ['campaign_name', 'adgroup_name', 'creative_name']) {
    const source = result.rows[0].sourceRefs[field];
    assert.equal(source.fileName, 'field-sources.csv');
    assert.equal(source.sheetName, null);
    assert.equal(source.rowNumber, 2);
    assert.equal(source.columnName, field);
  }
  assert.equal(result.rows[0].sourceRefs.campaign_name.rawValue, '  Synthetic Campaign  ');
});

test('CSV: 未闭合引号和结束引号后的非法字符形成 parseIssues', () => {
  const unclosed = api.parseCsvText(`campaign_name\n"unterminated`, { fileName: 'unclosed.csv' });
  const illegalSuffix = api.parseCsvText(`campaign_name\n"quoted"x`, { fileName: 'illegal-suffix.csv' });
  assert.ok(unclosed.parseIssues.some(issue => issue.code === 'CSV_UNCLOSED_QUOTE'));
  assert.ok(illegalSuffix.parseIssues.some(issue => issue.code === 'CSV_ILLEGAL_CHARACTER_AFTER_CLOSING_QUOTE'));
});

test('Setting: 表头位于第 27 行时唯一定位并记录来源行', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 27 }), { fileName: 'synthetic-27.xlsx' });
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.campaigns[0].sourceRefs.campaignName.rowNumber, 28);
  assert.equal(result.campaigns[0].sourceRefs.campaignName.fileName, 'synthetic-27.xlsx');
});

test('Setting: 表头移动到第 19 行时仍唯一定位并解析', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19 }), { fileName: 'synthetic-19.xlsx' });
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.campaigns[0].sourceRefs.campaignName.rowNumber, 20);
});

test('Setting: 两个 Sheet 都有候选表头时需确认且不选择任何 Sheet', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19, duplicateSheet: true }), { fileName: 'ambiguous.xlsx' });
  assert.equal(result.campaigns.length, 0);
  assert.equal(result.adGroups.length, 0);
  assert.equal(result.ads.length, 0);
  assert.equal(result.diagnostics[0].code, 'SETTING_HEADER_AMBIGUOUS');
});

test('Setting: 零候选时返回诊断且不默认选择第一个 Sheet', () => {
  const workbook = { SheetNames: ['NoHeader'], Sheets: { NoHeader: [['x'], ['y']] } };
  const result = api.parseTverSettingWorkbook(workbook, { fileName: 'no-header.xlsx' });
  assert.equal(result.campaigns.length, 0);
  assert.equal(result.diagnostics[0].code, 'SETTING_HEADER_NOT_FOUND');
});

test('Setting: 配信設計在第一个后续 ★ 区块前停止，不吞入辅助区块', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19 }), { fileName: 'blocks.xlsx' });
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.ads.length, 1);
  assert.equal(result.ads[0].fields.materialName, 'synthetic.mp4');
});

test('Setting: 配信設計的诉求、预算、日期时间、标签、初期日预算和备注均被读取并保留来源', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19 }), { fileName: 'setting-fields.xlsx' });
  const campaign = result.campaigns[0];
  const adGroup = result.adGroups[0];
  const ad = result.ads[0];
  assert.equal(campaign.fields.campaignAppeal, 'Synthetic Appeal');
  assert.equal(campaign.fields.campaignBudget, '900');
  assert.equal(campaign.fields.startDateTime, '2026/01/01 00:00');
  assert.equal(campaign.fields.endDateTime, '2026/01/31 23:30');
  assert.equal(adGroup.fields.targetingNumber, 'T-001');
  assert.equal(adGroup.fields.startDateTime, '2026/01/01 00:00');
  assert.equal(ad.fields.landingPageName, 'Synthetic LP');
  assert.equal(ad.fields.tagAppeal, 'Synthetic Tag');
  assert.equal(campaign.fields.initialDailyBudget, '30');
  assert.equal(campaign.fields.otherSettings, 'Synthetic Other Setting');
  assert.equal(campaign.fields.changeHistory, 'Synthetic Change History');
  for (const source of [campaign.sourceRefs.campaignBudget, campaign.sourceRefs.startDateTime, ad.sourceRefs.tagAppeal]) {
    assert.equal(source.fileName, 'setting-fields.xlsx');
    assert.equal(source.sheetName, 'Synthetic');
    assert.equal(source.rowNumber, 20);
  }
});

test('Setting: Targeting 与 Creative 辅助区块建立可追踪索引', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19 }), { fileName: 'indexes.xlsx' });
  const targeting = result.sourceIndex.targetingByNumber['T-001'];
  const creative = result.sourceIndex.creativeByMaterial['synthetic.mp4'];
  assert.equal(targeting.fields.device, 'CTV');
  assert.equal(targeting.sourceRefs.device.columnName, 'device');
  assert.equal(creative.fileName, 'synthetic.mp4');
  assert.equal(creative.landingPageUrl, 'https://example.invalid/lp');
  assert.equal(creative.sourceRefs.fileName.columnName, 'ファイル名');
  assert.ok(result.sourceIndex.evidenceBlocks.changeHistory.length > 0);
});

test('Setting: 同一素材多个不同 Creative 映射时返回歧义诊断', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19, ambiguousCreative: true }), { fileName: 'creative-ambiguous.xlsx' });
  assert.ok(result.diagnostics.some(issue => issue.code === 'SETTING_CREATIVE_MAPPING_AMBIGUOUS'));
  assert.equal(result.sourceIndex.creativeByMaterial['synthetic.mp4'].state, 'ambiguous');
});

test('Setting: 配信設計的 Targeting 编号在辅助区块缺失时返回诊断', () => {
  const result = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19, omitTargetingBlock: true }), { fileName: 'targeting-missing.xlsx' });
  assert.ok(result.diagnostics.some(issue => issue.code === 'SETTING_TARGETING_REFERENCE_NOT_FOUND'));
  assert.equal(result.campaigns.length, 1);
});

test('Setting: 必需业务表头缺失或重复时返回表头诊断，不把数据行泛化为必填值缺失', () => {
  const missing = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19, missingBusinessHeader: true }), { fileName: 'missing-business-header.xlsx' });
  const duplicate = api.parseTverSettingWorkbook(makeSettingWorkbook({ headerRow: 19, duplicateBusinessHeader: true }), { fileName: 'duplicate-business-header.xlsx' });
  assert.equal(missing.diagnostics[0].code, 'SETTING_BUSINESS_HEADER_MISSING');
  assert.equal(duplicate.diagnostics[0].code, 'SETTING_BUSINESS_HEADER_DUPLICATE');
  assert.ok(!missing.diagnostics.some(issue => issue.code === 'SETTING_REQUIRED_VALUE_MISSING'));
  assert.ok(!duplicate.diagnostics.some(issue => issue.code === 'SETTING_REQUIRED_VALUE_MISSING'));
});

test('Setting: 分列 ★ 与区块名仍能按语义定位', () => {
  const workbook = makeStructuredSettingWorkbook({ sectionMarkerStyle: 'split' });
  const result = api.parseTverSettingWorkbook(workbook, { fileName: 'structured-split.xlsx' });
  assert.equal(typeof api.findSectionMarker, 'function');
  assert.ok(result.sourceIndex.targetingByNumber['TG-01']);
  assert.ok(result.sourceIndex.creativeByMaterial['synthetic-creative.mp4']);
});

test('Setting: 单格 ★クリエイティブ 标记仍由语义定位器兼容', () => {
  const workbook = makeStructuredSettingWorkbook({ sectionMarkerStyle: 'single' });
  const rows = workbook.Sheets['Structured Synthetic'];
  assert.equal(typeof api.findSectionMarker, 'function');
  assert.equal(api.findSectionMarker(rows, 'クリエイティブ').style, 'combined');
});

test('Setting: 合并单元格展开后仍由同一行语义定位区块', () => {
  assert.equal(typeof api.expandMergedRows, 'function');
  const rows = api.expandMergedRows([['★クリエイティブ', '']], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]);
  assert.equal(rows[0][1], '★クリエイティブ');
  assert.equal(api.findSectionMarker(rows, 'クリエイティブ').style, 'combined');
});

test('Setting: Creative 标记后的说明行不会被误当正式表头', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ creativeExplanationRows: 2 }), { fileName: 'creative-note.xlsx' });
  assert.equal(result.sourceIndex.creativeByMaterial['synthetic-creative.mp4'].fileName, 'synthetic-creative.mp4');
  assert.ok(!result.diagnostics.some(issue => issue.code === 'SETTING_CREATIVE_HEADER_NOT_FOUND'));
});

test('Setting: Creative 正式表头零候选或多候选均返回诊断', () => {
  const missing = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ creativeHeaderMode: 'missing' }), { fileName: 'creative-header-missing.xlsx' });
  const multiple = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ creativeHeaderMode: 'multiple' }), { fileName: 'creative-header-multiple.xlsx' });
  assert.ok(missing.diagnostics.some(issue => issue.code === 'SETTING_CREATIVE_HEADER_NOT_FOUND'));
  assert.ok(multiple.diagnostics.some(issue => issue.code === 'SETTING_CREATIVE_HEADER_AMBIGUOUS'));
});

test('Setting: 横向两个 Targeting group 分别建立编号索引', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'targeting-horizontal.xlsx' });
  assert.equal(result.sourceIndex.targetingByNumber['TG-01'].fields.device, 'Synthetic Device A');
  assert.equal(result.sourceIndex.targetingByNumber['TG-02'].fields.media, 'Synthetic Media B');
});

test('Setting: Targeting 编号取同组ターゲティング名锚点后的第2个组成单元', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    targetingBatches: [[{ displayName: 'Synthetic Target Label', number: 'TG-SECOND', device: 'Synthetic Device' }]],
    mainRows: [{
      '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
      '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
      'ターゲティング番号': 'TG-SECOND', 'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
      'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', '素材名': 'synthetic-creative.mp4',
      'LP名': 'Synthetic LP', 'タグ訴求': 'Synthetic Tag', '初期設定日予算': '30',
      'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
    }],
  }), { fileName: 'targeting-number-position.xlsx' });
  assert.ok(result.sourceIndex.targetingByNumber['TG-SECOND']);
  assert.ok(!result.diagnostics.some(issue => issue.code === 'SETTING_TARGETING_REFERENCE_NOT_FOUND'));
});

test('Setting: Targeting 名称后的第1个组成单元为空时仍从第2个单元取得编号', () => {
  const main = {
    '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    'ターゲティング番号': 'TG-GAP', 'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
    'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', '素材名': 'synthetic-creative.mp4',
    'LP名': 'Synthetic LP', 'タグ訴求': 'Synthetic Tag', '初期設定日予算': '30',
    'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
  };
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    targetingBatches: [[{ displayName: '', number: 'TG-GAP', device: 'Synthetic Device' }]], mainRows: [main],
  }), { fileName: 'targeting-number-gap.xlsx' });
  assert.ok(result.sourceIndex.targetingByNumber['TG-GAP']);
  assert.ok(!result.diagnostics.some(issue => issue.code === 'SETTING_TARGETING_NUMBER_MISSING'));
});

test('Setting: Targeting group 数量变化与起始列移动不改变解析', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    targetingStartColumns: [3, 11, 19],
    targetingBatches: [[
      { number: 'TG-11', device: 'Synthetic Device 1' },
      { number: 'TG-12', device: 'Synthetic Device 2' },
      { number: 'TG-13', device: 'Synthetic Device 3' },
    ]],
  }), { fileName: 'targeting-moved.xlsx' });
  assert.deepEqual(Object.keys(result.sourceIndex.targetingByNumber).sort(), ['TG-11', 'TG-12', 'TG-13']);
  assert.equal(result.sourceIndex.targetingByNumber['TG-13'].fields.device, 'Synthetic Device 3');
});

test('Setting: 空白、重复及内容冲突的 Targeting 编号均返回诊断', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    targetingBatches: [[
      { number: '', device: 'Synthetic Device Blank' },
      { number: 'TG-DUP', device: 'Synthetic Device A' },
    ], [
      { number: 'TG-DUP', device: 'Synthetic Device B' },
    ]],
  }), { fileName: 'targeting-invalid.xlsx' });
  const codes = result.diagnostics.map(issue => issue.code);
  assert.ok(codes.includes('SETTING_TARGETING_NUMBER_MISSING'));
  assert.ok(codes.includes('SETTING_TARGETING_NUMBER_DUPLICATE'));
  assert.ok(codes.includes('SETTING_TARGETING_NUMBER_CONFLICT'));
});

test('Setting: 主表変更履歴与その他設定进入证据索引', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'main-evidence.xlsx' });
  const evidence = result.sourceIndex.evidenceBlocks;
  assert.equal(evidence.changeHistory[0].columnName, '変更履歴');
  assert.equal(evidence.changeHistory[0].rawValue, 'Synthetic Change History');
  assert.equal(evidence.otherSettings[0].columnName, 'その他設定');
});

test('Setting: 主表上方 ▼運用メモ欄被定位并保留来源', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'operation-memo.xlsx' });
  const memo = result.sourceIndex.evidenceBlocks.operationMemo.find(source => source.rawValue === 'Synthetic Operation Memo');
  assert.equal(memo.columnName, '▼運用メモ欄');
  assert.equal(memo.sheetName, 'Structured Synthetic');
});

test('Setting: 相同発注CPN名但不同CPN訴求形成独立 Campaign', () => {
  const base = {
    '発注CPN名': 'Synthetic Campaign', 'CPN予算': '900', '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
    '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', 'ターゲティング番号': 'TG-01',
    'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', 'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    '素材名': 'synthetic-creative.mp4', 'LP名': 'Synthetic LP', 'タグ訴求': 'Synthetic Tag', '初期設定日予算': '30',
    'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
  };
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ mainRows: [
    { ...base, 'CPN訴求': 'Synthetic Appeal A' },
    { ...base, 'CPN訴求': 'Synthetic Appeal B', '素材名': 'synthetic-creative-b.mp4' },
  ] }), { fileName: 'campaign-semantic.xlsx' });
  assert.equal(result.campaigns.length, 2);
  assert.notEqual(result.campaigns[0].expectedName, result.campaigns[1].expectedName);
  assert.ok(result.campaigns.every(entity => entity.nameRuleId === 'TVER_260605_CAMPAIGN_NAME'));
});

test('Setting: 同一 Campaign 与 Targeting 编号下不同タグ訴求形成独立 Ad Group', () => {
  const base = {
    '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    'ターゲティング番号': 'TG-01', 'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
    'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', 'LP名': 'Synthetic LP', '初期設定日予算': '30',
    'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
  };
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ mainRows: [
    { ...base, '素材名': 'synthetic-creative-a.mp4', 'タグ訴求': 'Synthetic Tag A' },
    { ...base, '素材名': 'synthetic-creative-b.mp4', 'タグ訴求': 'Synthetic Tag B' },
  ] }), { fileName: 'adgroup-semantic.xlsx' });
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.adGroups.length, 2);
  assert.notEqual(result.adGroups[0].semanticSignature, result.adGroups[1].semanticSignature);
  assert.equal(result.adGroups[0].nameRuleId, 'TVER_260605_ADGROUP_STRUCTURE');
});

test('Setting: 改变行号和区块位置不改变实体语义', () => {
  const first = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ headerRow: 19, targetingStartColumns: [1, 7] }), { fileName: 'semantic-first.xlsx' });
  const moved = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ headerRow: 27, targetingStartColumns: [4, 12] }), { fileName: 'semantic-moved.xlsx' });
  assert.equal(typeof first.campaigns[0].expectedName, 'string');
  assert.equal(typeof first.adGroups[0].semanticSignature, 'string');
  assert.deepEqual(Array.from(first.campaigns, entity => entity.expectedName), Array.from(moved.campaigns, entity => entity.expectedName));
  assert.deepEqual(Array.from(first.adGroups, entity => entity.semanticSignature), Array.from(moved.adGroups, entity => entity.semanticSignature));
});

test('Setting: 合成工作簿的解析结果不注入真实案件标识或业务值', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'synthetic-only.xlsx' });
  const serialized = JSON.stringify(result);
  assert.match(serialized, /Synthetic Campaign/);
  assert.doesNotMatch(serialized, /[②③④⑤⑥⑦⑧⑨]/);
  assert.equal(result.campaigns[0].sourceRefs.campaignName.fileName, 'synthetic-only.xlsx');
});

test('Edit tree: 重复 campaign/adgroup ID 合并并保留全部来源行', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'creative-a.mp4' },
    { campaign_id: '101', adgroup_id: '201', ad_id: '302', campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'creative-b.mp4' },
  ]), { fileName: 'edit-tree.csv' });
  const tree = api.buildEditTree(parsed);
  assert.equal(tree.campaigns.length, 1);
  assert.equal(tree.adGroups.length, 1);
  assert.equal(tree.ads.length, 2);
  assert.equal(tree.campaigns[0].rawRows.length, 2);
  assert.equal(tree.rowLedger[2].disposition, 'normal-leaf');
  assert.equal(tree.rowLedger[3].disposition, 'normal-leaf');
});

test('Edit tree: 重复 ID 字段与父 campaign_id 冲突均可见', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'creative-a.mp4' },
    { campaign_id: '101', adgroup_id: '201', ad_id: '302', campaign_name: 'Conflicting Campaign', adgroup_name: 'Synthetic Group', creative_name: 'creative-b.mp4' },
    { campaign_id: '999', adgroup_id: '201', ad_id: '303', campaign_name: 'Second Campaign', adgroup_name: 'Synthetic Group', creative_name: 'creative-c.mp4' },
  ]), { fileName: 'conflict.csv' });
  const tree = api.buildEditTree(parsed);
  assert.ok(tree.diagnostics.some(issue => issue.code === 'DUPLICATE_ID_FIELD_CONFLICT'));
  assert.ok(tree.diagnostics.some(issue => issue.code === 'EDIT_PARENT_ID_CONFLICT'));
  assert.ok(tree.adGroups[0].conflictIssues.length > 0);
});

test('Edit tree: 空或无效 ID 行保留为 orphan，保存原始值、CSV 行号和格式问题', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '', adgroup_id: '201', ad_id: '301', campaign_name: 'Missing Campaign ID' },
    { campaign_id: '101', adgroup_id: 'invalid-id', ad_id: '302', campaign_name: 'Invalid Group ID' },
    { campaign_id: '101', adgroup_id: '201', ad_id: '', campaign_name: 'Missing Ad ID' },
  ]), { fileName: 'orphans.csv' });
  const tree = api.buildEditTree(parsed);
  assert.equal(tree.orphans.length, 3);
  assert.deepEqual(Array.from(tree.orphans, orphan => orphan.key), [
    'orphan:2:Campaign', 'orphan:3:Ad Group', 'orphan:4:Ad',
  ]);
  assert.equal(tree.orphans[1].rawRows[0].values.adgroup_id, 'invalid-id');
  assert.equal(tree.orphans[1].sourceRefs.csv.rowNumber, 3);
  assert.equal(tree.orphans[1].validationIssues[0].code, 'INVALID_ID');
});

test('Edit tree: rowLedger 将每一 CSV 原始行恰好覆盖一次，不允许 diagnostics-only 丢行', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Valid' },
    { campaign_id: '', adgroup_id: '202', ad_id: '302', campaign_name: 'Orphan' },
  ]), { fileName: 'ledger.csv' });
  const tree = api.buildEditTree(parsed);
  assert.deepEqual(Object.keys(tree.rowLedger), ['2', '3']);
  assert.equal(tree.rowLedger[2].disposition, 'normal-leaf');
  assert.equal(tree.rowLedger[3].disposition, 'orphan');
});

test('Edit tree: orphan 在 comparisonInputs 的 CSV側未匹配输入中可见，绝不被丢弃', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '', adgroup_id: '201', ad_id: '301', campaign_name: 'Orphan' },
  ]), { fileName: 'comparison-input.csv' });
  const tree = api.buildEditTree(parsed);
  assert.equal(tree.comparisonInputs.csvOnly.length, 1);
  assert.equal(tree.comparisonInputs.csvOnly[0].key, 'orphan:2:Campaign');
  assert.equal(tree.comparisonInputs.csvOnly[0].displayHint, 'CSV側未匹配');
});

test('Edit tree: 相同 Campaign ID 的 budget 与 campaign_status 差异均记录字段冲突', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Campaign', budget: '100', campaign_status: '1' },
    { campaign_id: '101', adgroup_id: '202', ad_id: '302', campaign_name: 'Campaign', budget: '200', campaign_status: '0' },
  ]), { fileName: 'campaign-conflict.csv' });
  const tree = api.buildEditTree(parsed);
  const fields = Array.from(tree.campaigns[0].conflictIssues, issue => issue.field).sort();
  assert.deepEqual(fields, ['budget', 'campaign_status']);
  assert.equal(tree.campaigns[0].rawRows.length, 2);
});

test('Edit tree: 相同 Ad Group ID 的 price、device 与 media 差异均记录字段冲突', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', adgroup_name: 'Group', price: '10', device: 'ctv', media: 'media-a' },
    { campaign_id: '101', adgroup_id: '201', ad_id: '302', adgroup_name: 'Group', price: '20', device: 'android', media: 'media-b' },
  ]), { fileName: 'adgroup-conflict.csv' });
  const tree = api.buildEditTree(parsed);
  const fields = Array.from(tree.adGroups[0].conflictIssues, issue => issue.field).sort();
  assert.deepEqual(fields, ['device', 'media', 'price']);
  assert.equal(tree.adGroups[0].rawRows.length, 2);
});

test('Edit tree: 相同 Ad ID 的 url 与 Tracking URL 差异均记录字段冲突', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', creative_name: 'creative.mp4', url: 'https://example.invalid/a', tracking_url_start: 'https://tracker.invalid/a' },
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', creative_name: 'creative.mp4', url: 'https://example.invalid/b', tracking_url_start: 'https://tracker.invalid/b' },
  ]), { fileName: 'ad-conflict.csv' });
  const tree = api.buildEditTree(parsed);
  const fields = Array.from(tree.ads[0].conflictIssues, issue => issue.field).sort();
  assert.deepEqual(fields, ['tracking_url_start', 'url']);
  assert.equal(tree.ads[0].rawRows.length, 2);
});

test('Edit tree: 空值与非空值冲突不覆盖先出现原始字段值', () => {
  const parsed = api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Campaign', budget: '' },
    { campaign_id: '101', adgroup_id: '202', ad_id: '302', campaign_name: 'Campaign', budget: '200' },
  ]), { fileName: 'empty-conflict.csv' });
  const tree = api.buildEditTree(parsed);
  assert.equal(tree.campaigns[0].fields.budget, '');
  assert.ok(tree.campaigns[0].conflictIssues.some(issue => issue.field === 'budget'));
  assert.equal(tree.rowLedger[2].disposition, 'normal-leaf');
  assert.equal(tree.rowLedger[3].disposition, 'normal-leaf');
});

test('A17-1 Provenance: Register primary 只选择与当前 raw 值严格相同且最早的来源', () => {
  assert.equal(typeof api.collectFieldEvidence, 'function');
  assert.equal(typeof api.selectPrimaryEvidenceForRawValue, 'function');
  const rawRows = [
    { rowNumber: 2, sourceRefs: { budget: { fileName: 'register.csv', sheetName: null, rowNumber: 2, columnName: 'budget', rawValue: '' } } },
    { rowNumber: 3, sourceRefs: { budget: { fileName: 'register.csv', sheetName: null, rowNumber: 3, columnName: 'budget', rawValue: '200' } } },
    { rowNumber: 4, sourceRefs: { budget: { fileName: 'register.csv', sheetName: null, rowNumber: 4, columnName: 'budget', rawValue: '200' } } },
  ];
  const evidence = api.collectFieldEvidence(rawRows, 'budget');
  assert.deepEqual(JSON.parse(JSON.stringify(evidence.map(source => [source.rowNumber, source.rawValue]))), [[2, ''], [3, '200'], [4, '200']]);
  assert.equal(api.selectPrimaryEvidenceForRawValue(evidence, '200').rowNumber, 3);
  assert.equal(api.selectPrimaryEvidenceForRawValue(evidence, 'missing'), null);
});

test('A17-1 Provenance: Register evidence 保留空值但不改 fields、matchingFields 或 candidateSignature', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 10:00', budget: '200', adgroup_name: 'Synthetic Group', creative_name: 'a.mp4', device: 'ctv', price: '10', tracking_url_complete: '' },
    { campaign_name: 'Synthetic Campaign', start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 10:00', budget: '200', adgroup_name: 'Synthetic Group', creative_name: 'b.mp4', device: 'ctv', price: '10', tracking_url_complete: 'https://tracker.invalid/complete' },
  ]), { fileName: 'register-provenance.csv' });
  const tree = api.buildRegisterTree(parsed);
  const campaign = tree.campaigns[0];
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.fields)), {
    campaignName: 'Synthetic Campaign', startDateTime: '2026/08/01 10:00', endDateTime: '2026/08/31 10:00', budget: '200', dailyBudget: '', hourlyBidWeight: '', campaignStatus: '', consumptionType: '',
  });
  assert.equal(campaign.matchingFields.campaignName, 'Synthetic Campaign');
  assert.match(campaign.candidateSignature, /Synthetic Campaign/);
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.sourceEvidence.fields.daily_budget.map(source => [source.rowNumber, source.rawValue]))), [[2, ''], [3, '']]);
  assert.equal(Object.hasOwn(campaign.sourceEvidence.fields, 'tracking_url_complete'), false);
  assert.equal(campaign.sourceRefs.budget.rowNumber, 2);
});

test('A17-1C Provenance: Register evidence 严格按 Campaign／ADG／Ad 所有权分层且保留 owned 空值', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name:'Scope Campaign', start_datetime:'2026/08/01 10:00', end_datetime:'2026/08/31 10:00', budget:'200', daily_budget:'', adgroup_name:'Group A', device:'ctv', price:'10', daily_freq_cap:'', creative_name:'a.mp4', url:'https://example.invalid/a', tracking_url_start:'https://tracker.invalid/a/start', tracking_url_first_quartile:'https://tracker.invalid/a/25', tracking_url_midpoint:'https://tracker.invalid/a/50', tracking_url_third_quartile:'https://tracker.invalid/a/75', tracking_url_complete:'https://tracker.invalid/a/100' },
    { campaign_name:'Scope Campaign', start_datetime:'2026/08/01 10:00', end_datetime:'2026/08/31 10:00', budget:'200', daily_budget:'', adgroup_name:'Group A', device:'ctv', price:'10', daily_freq_cap:'', creative_name:'b.mp4', url:'https://example.invalid/b', tracking_url_start:'https://tracker.invalid/b/start', tracking_url_first_quartile:'https://tracker.invalid/b/25', tracking_url_midpoint:'https://tracker.invalid/b/50', tracking_url_third_quartile:'https://tracker.invalid/b/75', tracking_url_complete:'https://tracker.invalid/b/100' },
    { campaign_name:'Scope Campaign', start_datetime:'2026/08/01 10:00', end_datetime:'2026/08/31 10:00', budget:'200', daily_budget:'', adgroup_name:'Group B', device:'android ios', price:'20', daily_freq_cap:'', creative_name:'c.mp4', url:'https://example.invalid/c', tracking_url_start:'https://tracker.invalid/c/start', tracking_url_first_quartile:'https://tracker.invalid/c/25', tracking_url_midpoint:'https://tracker.invalid/c/50', tracking_url_third_quartile:'https://tracker.invalid/c/75', tracking_url_complete:'https://tracker.invalid/c/100' },
  ]), { fileName:'register-scope.csv' });
  const tree = api.buildRegisterTree(parsed);
  const campaign = tree.campaigns[0];
  const groupA = tree.adGroups.find(entity => entity.fields.adGroupName === 'Group A');
  const groupB = tree.adGroups.find(entity => entity.fields.adGroupName === 'Group B');
  const adA = tree.ads.find(entity => entity.fields.creativeName === 'a.mp4');
  const adB = tree.ads.find(entity => entity.fields.creativeName === 'b.mp4');

  assert.deepEqual(JSON.parse(JSON.stringify(campaign.fields)), { campaignName:'Scope Campaign', startDateTime:'2026/08/01 10:00', endDateTime:'2026/08/31 10:00', budget:'200', dailyBudget:'', hourlyBidWeight:'', campaignStatus:'', consumptionType:'' });
  assert.equal(campaign.matchingFields.campaignName, 'Scope Campaign');
  assert.match(campaign.candidateSignature, /Scope Campaign/);
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.sourceEvidence.fields.daily_budget.map(source => [source.rowNumber, source.rawValue]))), [[2, ''], [3, ''], [4, '']]);
  ['adgroup_name', 'price', 'creative_name', 'url', 'tracking_url_start', 'tracking_url_first_quartile', 'tracking_url_midpoint', 'tracking_url_third_quartile', 'tracking_url_complete'].forEach(field => assert.equal(Object.hasOwn(campaign.sourceEvidence.fields, field), false));

  assert.deepEqual(JSON.parse(JSON.stringify(groupA.sourceEvidence.fields.daily_freq_cap.map(source => [source.rowNumber, source.rawValue]))), [[2, ''], [3, '']]);
  ['creative_name', 'url', 'tracking_url_start', 'tracking_url_first_quartile', 'tracking_url_midpoint', 'tracking_url_third_quartile', 'tracking_url_complete'].forEach(field => assert.equal(Object.hasOwn(groupA.sourceEvidence.fields, field), false));
  assert.deepEqual(JSON.parse(JSON.stringify(groupA.sourceEvidence.fields.price.map(source => source.rowNumber))), [2, 3]);
  assert.deepEqual(JSON.parse(JSON.stringify(groupB.sourceEvidence.fields.price.map(source => source.rowNumber))), [4]);
  assert.notEqual(groupA.sourceEvidence.fields.price, groupB.sourceEvidence.fields.price);

  [adA, adB].forEach((ad, index) => {
    const rowNumber=index + 2;
    ['creative_name', 'url', 'tracking_url_start', 'tracking_url_first_quartile', 'tracking_url_midpoint', 'tracking_url_third_quartile', 'tracking_url_complete'].forEach(field => {
      assert.equal(Object.hasOwn(ad.sourceEvidence.fields, field), true);
      assert.deepEqual(JSON.parse(JSON.stringify(ad.sourceEvidence.fields[field].map(source => source.rowNumber))), [rowNumber]);
    });
    assert.equal(Object.hasOwn(ad.sourceEvidence.fields, 'campaign_name'), false);
    assert.equal(ad.sourceRefs.creative_name.rowNumber, rowNumber);
  });
  assert.equal(campaign.sourceRefs.budget.rowNumber, 2);
  assert.equal(groupA.sourceRefs.price.rowNumber, 2);
  assert.notEqual(adA.sourceEvidence.fields.creative_name, adB.sourceEvidence.fields.creative_name);
});

test('A17-1 Provenance: 派生值由 resolver 指定 primary 并保存完整组成证据', () => {
  const setting = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'derived-provenance.xlsx' });
  const campaign = setting.campaigns[0];
  const adGroup = setting.adGroups[0];
  const ad = setting.ads[0];
  const device = api.resolveSettingAdGroupDevice(adGroup);
  const creative = api.resolveCreativeFields(ad, setting.sourceIndex.creativeByMaterial, setting.sourceIndex.measurementTagByAppeal);
  assert.equal(campaign.sourceRefs.campaignName.columnName, '発注CPN名');
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.sourceEvidence.derived.expectedName.derivedFrom.map(source => source.columnName))), ['発注CPN名', '開始日時(yyyy/mm/dd hh:mm)', '終了日時(yyyy/mm/dd hh:mm)', 'CPN訴求']);
  assert.equal(device.primarySource.columnName, '配信デバイス●');
  assert.ok(device.sourceEvidence.some(source => source.columnName === 'タグ訴求'));
  assert.equal(creative.creative.sourceRef.columnName, 'ファイル名');
  assert.ok(creative.creative.derivedFrom.some(source => source.columnName === '素材名'));
});

test('A17-1 Provenance: Targeting 组合值由专用 resolver 选择实际值来源，不回退占位格', () => {
  assert.equal(typeof api.resolveSettingTargetingField, 'function');
  const adGroup = {
    fields:{ targeting:{ price:'11' } },
    sourceEvidence:{ fields:{ price:[
      { fileName:'setting.xlsx', sheetName:'Targeting', rowNumber:51, columnName:'CPM●', rawValue:'-' },
      { fileName:'setting.xlsx', sheetName:'Targeting', rowNumber:51, columnName:'CPM●', rawValue:'11' },
    ] } },
  };
  const price = api.resolveSettingTargetingField(adGroup, 'price');
  assert.equal(price.value, '11');
  assert.equal(price.primarySource.columnName, 'CPM●');
  assert.equal(price.primarySource.rawValue, '11');
  assert.deepEqual(JSON.parse(JSON.stringify(price.sourceEvidence.map(source => source.rawValue))), ['-', '11']);
});

test('A17-2 Red: Targeting comparison resolver 按明确证据生成六字段，且 Register／Edit 不跨字段回退', () => {
  assert.equal(typeof api.resolveSettingTargetingForComparison, 'function');
  assert.equal(typeof api.buildTverA17TargetingComparisonInputs, 'function');
  assert.equal(typeof api.readTverA17TargetingCsvValue, 'function');
  const dictionaries=api.getTverIdDictionaries();
  const mediaIds=dictionaries.media.slice(0, 2).map(item => item.id);
  const pref=dictionaries.pref[0];
  const subgenre=dictionaries.subgenre.slice(0, 2);
  const localIds=dictionaries.local_broadcaster.map(item => item.id).join(' ');
  const source=(columnName, rawValue, rowNumber=52) => ({ fileName:'targeting.xlsx', sheetName:'設定', rowNumber, columnName, rawValue });
  const setting={
    key:'setting-adg', level:'Ad Group', fields:{ targeting:{} },
    sourceEvidence:{ targeting:{
      '放送局●':[source('放送局●', '○'), source('放送局●', mediaIds.slice().reverse().join(',')), source('放送局●', 'media：各局オウンドメディア除外 (右記で設定) local_broadcaster(ローカル局)は全選択')],
      '都道府県/市区町村●':[source('都道府県/市区町村●', '○', 53), source('都道府県/市区町村●', pref.name, 53)],
      '性別●':[source('性別●', '男性', 54)],
      '年齢●':[source('年齢●', '20歳〜34歳', 55)],
      '番組サブジャンル●':[source('番組サブジャンル●', '除外', 56), source('番組サブジャンル●', subgenre.map(item => item.name).join(', '), 56)],
    } },
  };
  const csvSource=(field, rawValue) => ({ fileName:'edit.csv', sheetName:null, rowNumber:2, columnName:field, rawValue });
  const edit={
    key:'edit-adg', level:'Ad Group', fields:{ media:mediaIds.join(' '), local_broadcaster:localIds, pref:pref.id, gender:'1', start_age:'20', end_age:'34', subgenre_exclude:subgenre.map(item => item.id).join(' ') },
    rawRows:[{ sourceRefs:{ media:csvSource('media', mediaIds.join(' ')), local_broadcaster:csvSource('local_broadcaster', localIds), pref:csvSource('pref', pref.id), gender:csvSource('gender', '1'), start_age:csvSource('start_age', '20'), end_age:csvSource('end_age', '34'), subgenre_exclude:csvSource('subgenre_exclude', subgenre.map(item => item.id).join(' ')) } }],
    sourceRefs:{ media:csvSource('media', mediaIds.join(' ')), local_broadcaster:csvSource('local_broadcaster', localIds), pref:csvSource('pref', pref.id), gender:csvSource('gender', '1'), start_age:csvSource('start_age', '20'), end_age:csvSource('end_age', '34'), subgenre_exclude:csvSource('subgenre_exclude', subgenre.map(item => item.id).join(' ')) },
  };
  const registerSourceRefs={ ...edit.sourceRefs };
  const register={
    key:'register-adg', level:'Ad Group', fields:{ media:mediaIds.join(' '), localBroadcaster:localIds, pref:pref.id, gender:'1', startAge:'20', endAge:'34', subgenreExclude:subgenre.map(item => item.id).join(' ') },
    sourceEvidence:{ fields:Object.fromEntries(Object.entries(registerSourceRefs).map(([field, ref]) => [field, [ref]])) }, sourceRefs:registerSourceRefs,
  };
  assert.equal(api.readTverA17TargetingCsvValue({ fields:{ local_broadcaster:'', localBroadcaster:'must-not-fallback' } }, 'edit-with-ids', 'local_broadcaster'), '');
  assert.equal(api.readTverA17TargetingCsvValue({ fields:{ localBroadcaster:'' } }, 'register-without-ids', 'local_broadcaster'), '');
  const media=api.resolveSettingTargetingForComparison(setting, 'media');
  const local=api.resolveSettingTargetingForComparison(setting, 'local_broadcaster');
  const prefResolved=api.resolveSettingTargetingForComparison(setting, 'pref');
  const gender=api.resolveSettingTargetingForComparison(setting, 'gender');
  const age=api.resolveSettingTargetingForComparison(setting, 'age');
  const subgenreResolved=api.resolveSettingTargetingForComparison(setting, 'subgenre_exclude');
  assert.deepEqual(JSON.parse(JSON.stringify(media.canonicalValue)), mediaIds.slice().sort().join(' '));
  assert.equal(media.primarySource.rawValue, mediaIds.slice().reverse().join(','));
  assert.equal(local.comparable, true);
  assert.equal(local.primarySource.rawValue.includes('local_broadcaster(ローカル局)は全選択'), true);
  assert.equal(prefResolved.canonicalValue, pref.id);
  assert.equal(gender.comparable, true);
  assert.equal(gender.canonicalValue, '1');
  assert.equal(gender.ruleBasis, 'TVER_C3_C4_3_GENDER_MAPPING');
  assert.equal(age.canonicalValue, '20-34');
  assert.equal(subgenreResolved.canonicalValue, subgenre.map(item => item.id).sort().join(' '));
  assert.equal(subgenreResolved.derivedFrom.length, 2);
  const inputs=api.buildTverA17TargetingComparisonInputs(setting, edit, 'edit-with-ids', { level:'Ad Group', entityKey:setting.key, csvEntityKey:edit.key, targetName:'Synthetic ADG' });
  const registerInputs=api.buildTverA17TargetingComparisonInputs(setting, register, 'register-without-ids', { level:'Ad Group', entityKey:setting.key, csvEntityKey:register.key, targetName:'Synthetic ADG' });
  assert.deepEqual(JSON.parse(JSON.stringify(inputs.map(input => input.field))), ['media', 'local_broadcaster', 'pref', 'gender', 'age', 'subgenre_exclude']);
  assert.deepEqual(JSON.parse(JSON.stringify(registerInputs.map(input => input.csvValue))), JSON.parse(JSON.stringify(inputs.map(input => input.csvValue))));
  assert.equal(registerInputs.find(input => input.field==='local_broadcaster').csvSource.rawValue, localIds);
  assert.equal(registerInputs.find(input => input.field==='age').sourceEvidence.csv.length, 2);
  const run=api.buildComparisonRun({ fields:inputs });
  assert.deepEqual(JSON.parse(JSON.stringify(run.entries.map(entry => [entry.field, entry.displayStatus]))), [['media','表記ゆれ一致'], ['local_broadcaster','表記ゆれ一致'], ['pref','表記ゆれ一致'], ['gender','表記ゆれ一致'], ['age','表記ゆれ一致'], ['subgenre_exclude','表記ゆれ一致']]);
  const mediaExcluded=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '放送局●':[source('放送局●', 'EX除外')] } } }, 'media');
  const localMissing=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '放送局●':[source('放送局●', mediaIds.join(' '))] } } }, 'local_broadcaster');
  const ambiguousPref=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '都道府県/市区町村●':[source('都道府県/市区町村●', '熊本県除外→熊本県除外解除')] } } }, 'pref');
  const includedSubgenre=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '番組サブジャンル●':[source('番組サブジャンル●', subgenre[0].name)] } } }, 'subgenre_exclude');
  assert.deepEqual(JSON.parse(JSON.stringify([mediaExcluded.comparable, mediaExcluded.canonicalValue, localMissing.evidenceState, localMissing.primarySource, ambiguousPref.comparable, includedSubgenre.shouldGenerate])), [false, null, 'not_provided', null, false, false]);
});

test('C3-C4-4B Red: GP Age 支持 XX歳以上、保留原文，并按明确空值/不可用语义比较', () => {
  assert.equal(typeof api.parseTverAgeExpression, 'function');
  const source=(columnName, rawValue, rowNumber=80) => ({ fileName:'c34b-setting.xlsx', sheetName:'設定', rowNumber, columnName, rawValue:String(rawValue ?? '') });
  const csvSource=(field, rawValue, rowNumber=2) => ({ fileName:'c34b-register.csv', sheetName:null, rowNumber, columnName:field, rawValue:String(rawValue ?? '') });
  const settingFor=(rawValue) => ({ sourceEvidence:{ targeting:{ '年齢●':[source('年齢●', rawValue)] } } });
  const csvFor=(start, end, withEvidence=true) => ({
    fields:{ start_age:start, end_age:end },
    rawRows:withEvidence ? [{ sourceRefs:{ start_age:csvSource('start_age', start), end_age:csvSource('end_age', end) } }] : [{}],
  });
  const buildAge=(settingRaw, start, end, schemaKind='edit-with-ids', withEvidence=true) => {
    const input=api.buildTverA17TargetingComparisonInputs(settingFor(settingRaw), csvFor(start, end, withEvidence), schemaKind, { level:'Ad Group', entityKey:'setting-adg', csvEntityKey:'csv-adg' })
      .find(item => item.field==='age');
    assert.ok(input, `age input should exist for ${settingRaw} / ${start} / ${end}`);
    return input;
  };

  const parsed=api.parseTverAgeExpression('65歳以上');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), {
    canonicalValue:'65+', minAge:65, maxAge:null, upperOpen:true,
    ruleId:'TVER_C3_C4_4B_AGE_OPEN_UPPER_BOUND',
  });
  const closedParsed=api.parseTverAgeExpression('20歳〜34歳');
  assert.deepEqual(JSON.parse(JSON.stringify(closedParsed)), {
    canonicalValue:'20-34', minAge:20, maxAge:34, upperOpen:false,
    ruleId:'TVER_A17_2_AGE_EXACT_RANGE',
  });
  const setting=api.resolveSettingTargetingForComparison(settingFor('65歳以上'), 'age');
  assert.equal(setting.rawValue, '65歳以上');
  assert.equal(setting.canonicalValue, '65+');
  assert.deepEqual(JSON.parse(JSON.stringify(setting.ageShape)), { minAge:65, maxAge:null, upperOpen:true });
  assert.equal(setting.comparable, true);
  assert.equal(setting.ruleBasis, 'TVER_C3_C4_4B_AGE_OPEN_UPPER_BOUND');

  const equal=api.buildComparisonRun({ fields:[buildAge('65歳以上', '65', '')] }).entries[0];
  assert.equal(equal.settingRawValue, '65歳以上');
  assert.equal(equal.csvRawValue, '65 / ');
  assert.equal(equal.canonicalValues.setting, '65+');
  assert.equal(equal.canonicalValues.csv, '65+');
  assert.equal(equal.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(equal.displayStatus), '一致');
  assert.deepEqual(JSON.parse(JSON.stringify(equal.sourceEvidence.setting.map(item => item.rawValue))), ['65歳以上']);
  assert.deepEqual(JSON.parse(JSON.stringify(equal.sourceEvidence.csv.map(item => item.rawValue))), ['65', '']);

  const lowerBoundMismatch=api.buildComparisonRun({ fields:[buildAge('65歳以上', '60', '')] }).entries[0];
  assert.equal(lowerBoundMismatch.comparisonStatus, '不一致');
  assert.equal(api.projectTverDisplayStatus(lowerBoundMismatch.displayStatus), '不一致');

  const openVsClosedMismatch=api.buildComparisonRun({ fields:[buildAge('65歳以上', '65', '74')] }).entries[0];
  assert.equal(openVsClosedMismatch.comparisonStatus, '不一致');

  const oneSideEmpty=api.buildComparisonRun({ fields:[buildAge('65歳以上', '', '')] }).entries[0];
  assert.equal(oneSideEmpty.comparisonStatus, '不一致');
  assert.equal(oneSideEmpty.comparable, true);
  assert.equal(oneSideEmpty.neutral, false);
  assert.equal(api.projectTverEntityDisplayStatus([oneSideEmpty]), '不一致');

  const bothEmptyInput=api.buildTverA17TargetingComparisonInputs(
    { sourceEvidence:{ targeting:{ '年齢●':[source('年齢●', '')] } } },
    csvFor('', ''), 'edit-with-ids', { level:'Ad Group', entityKey:'empty-setting-adg', csvEntityKey:'empty-csv-adg' },
  ).find(item => item.field==='age');
  assert.ok(bothEmptyInput);
  const bothEmpty=api.buildComparisonRun({ fields:[bothEmptyInput] }).entries[0];
  assert.equal(bothEmpty.comparisonStatus, '一致');
  assert.equal(bothEmpty.comparable, true);
  assert.equal(bothEmpty.neutral, true);
  assert.equal(api.projectTverEntityDisplayStatus([bothEmpty]), '一致');
  assert.equal(bothEmpty.evidenceStates.csv, 'available');

  const sourceUnavailable=api.buildComparisonRun({ fields:[buildAge('65歳以上', '65', '', 'edit-with-ids', false)] }).entries[0];
  assert.equal(sourceUnavailable.evidenceStates.csv, 'unavailable');
  assert.equal(sourceUnavailable.comparisonStatus, '一致');
  assert.equal(sourceUnavailable.comparable, false);
  assert.equal(sourceUnavailable.neutral, true);
  assert.equal(api.projectTverEntityDisplayStatus([sourceUnavailable]), '一致');

  const schemaUnavailable=api.buildComparisonRun({ fields:[buildAge('65歳以上', '65', '', 'unknown')] }).entries[0];
  assert.equal(schemaUnavailable.evidenceStates.csv, 'unavailable');
  assert.equal(schemaUnavailable.comparisonStatus, '一致');
  assert.equal(schemaUnavailable.comparable, false);
  assert.equal(schemaUnavailable.neutral, true);

  const unknown=api.resolveSettingTargetingForComparison(settingFor('65歳以下'), 'age');
  assert.equal(unknown.rawValue, '65歳以下');
  assert.equal(unknown.canonicalValue, null);
  assert.equal(unknown.evidenceState, 'available');
  assert.equal(unknown.comparable, false);
  assert.equal(unknown.shouldGenerate, true);
  const unknownEntry=api.buildComparisonRun({ fields:[buildAge('65歳以下', '', '')] }).entries[0];
  assert.equal(unknownEntry.comparisonStatus, '需确认');
  assert.equal(unknownEntry.comparable, false);
  assert.equal(unknownEntry.neutral, false);
});

test('A17-2D Red: Evidence State 独立于 conversion，六字段 CSV-only 必须保守生成', () => {
  const dictionaries=api.getTverIdDictionaries();
  const mediaId=dictionaries.media[0].id;
  const prefName=dictionaries.pref[0].name;
  const subgenreId=dictionaries.subgenre[0].id;
  const source=(columnName, rawValue, rowNumber=52) => ({ fileName:'a17-2d.xlsx', sheetName:'設定', rowNumber, columnName, rawValue });
  const csvSource=(field, rawValue) => ({ fileName:'a17-2d.csv', sheetName:null, rowNumber:2, columnName:field, rawValue });
  const csvOnlyFields={ media:mediaId, local_broadcaster:'1', pref:'1', gender:'1', start_age:'20', end_age:'34', subgenre_exclude:subgenreId };
  const csvOnly={ fields:csvOnlyFields, rawRows:[{ sourceRefs:Object.fromEntries(Object.entries(csvOnlyFields).map(([field, value]) => [field, csvSource(field, value)])) }] };
  const csvOnlyInputs=api.buildTverA17TargetingComparisonInputs({ sourceEvidence:{ targeting:{} } }, csvOnly, 'edit-with-ids', {});
  assert.deepEqual(JSON.parse(JSON.stringify(csvOnlyInputs.map(input => input.field))), ['media', 'local_broadcaster', 'pref', 'gender', 'age', 'subgenre_exclude']);
  csvOnlyInputs.forEach(input => {
    assert.equal(input.settingEvidenceState, 'not_provided');
    assert.equal(input.csvEvidenceState, 'available');
    assert.equal(input.comparable, false);
  });
  assert.equal(api.buildTverA17TargetingComparisonInputs({ sourceEvidence:{ targeting:{} } }, { fields:{ media:'', local_broadcaster:'', pref:'', gender:'', start_age:'', end_age:'', subgenre_exclude:'' }, rawRows:[] }, 'edit-with-ids', {}).length, 0);

  const gender=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '性別●':[source('性別●', '男性')] } } }, 'gender');
  const ex=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '放送局●':[source('放送局●', '○'), source('放送局●', 'EX除外')] } } }, 'media');
  const unknownMedia=api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ '放送局●':[source('放送局●', '999999')] } } }, 'media');
  assert.deepEqual(JSON.parse(JSON.stringify([gender.evidenceState, gender.comparable, gender.canonicalValue, ex.evidenceState, ex.rawValue, ex.primarySource && ex.primarySource.rawValue, unknownMedia.evidenceState, unknownMedia.canonicalValue, unknownMedia.comparable])), ['available', true, '1', 'available', 'EX除外', 'EX除外', 'available', null, false]);

  const explicitEmpty={ fields:{ media:'' }, rawRows:[{ sourceRefs:{ media:csvSource('media', '') } }] };
  const emptyMediaInput=api.buildTverA17TargetingComparisonInputs({ sourceEvidence:{ targeting:{ '放送局●':[source('放送局●', mediaId)] } } }, explicitEmpty, 'edit-with-ids', {}).find(input => input.field==='media');
  assert.equal(emptyMediaInput.csvEvidenceState, 'available');
});

test('A17-2D Red: 多个不同业务来源不得取第一项，age 保留两个 CSV 端点 derivedFrom', () => {
  const dictionaries=api.getTverIdDictionaries();
  const media=[dictionaries.media[0].id, dictionaries.media[1].id];
  const pref=[dictionaries.pref[0].name, dictionaries.pref[1].name];
  const subgenre=[dictionaries.subgenre[0].name, dictionaries.subgenre[1].name];
  const source=(columnName, rawValue, rowNumber) => ({ fileName:'conflict.xlsx', sheetName:'設定', rowNumber, columnName, rawValue });
  const conflict=(label, values, field) => api.resolveSettingTargetingForComparison({ sourceEvidence:{ targeting:{ [label]:values.map((value, index) => source(label, value, 60 + index)) } } }, field);
  const mediaConflict=conflict('放送局●', [media[0], media[1]], 'media');
  const prefConflict=conflict('都道府県/市区町村●', pref, 'pref');
  const genderConflict=conflict('性別●', ['男性', '女性'], 'gender');
  const ageConflict=conflict('年齢●', ['20歳〜34歳', '25歳〜54歳'], 'age');
  const subgenreConflict=conflict('番組サブジャンル●', ['除外', subgenre[0], subgenre[1]], 'subgenre_exclude');
  [mediaConflict, prefConflict, genderConflict, ageConflict, subgenreConflict].forEach(result => {
    assert.equal(result.evidenceState, 'ambiguous');
    assert.equal(result.comparable, false);
    assert.equal(result.primarySource, null);
  });
  const duplicate=conflict('放送局●', [media[0], media[0]], 'media');
  assert.deepEqual(JSON.parse(JSON.stringify([duplicate.evidenceState, duplicate.comparable, duplicate.primarySource.rawValue])), ['available', true, media[0]]);

  const setting={ sourceEvidence:{ targeting:{ '年齢●':[source('年齢●', '20歳〜34歳', 70)] } } };
  const csv={ fields:{ start_age:'20', end_age:'34' }, rawRows:[{ sourceRefs:{ start_age:source('start_age', '20', 2), end_age:source('end_age', '34', 2) } }] };
  const age=api.buildTverA17TargetingComparisonInputs(setting, csv, 'edit-with-ids', {}).find(input => input.field==='age');
  assert.deepEqual(JSON.parse(JSON.stringify(age.sourceEvidence.derivedFrom.map(item => item.columnName).sort())), ['end_age', 'start_age']);
});

test('A17-1 Provenance: Compare 结果透传来源证据但不改变既有比较结论', () => {
  const sourceEvidence={
    setting:[{ fileName: 'setting.xlsx', sheetName: '配信設計', rowNumber: 28, columnName: 'CPN予算', rawValue: '200' }],
    csv:[{ fileName: 'register.csv', sheetName: null, rowNumber: 2, columnName: 'budget', rawValue: '200' }, { fileName: 'register.csv', sheetName: null, rowNumber: 3, columnName: 'budget', rawValue: '200' }],
    derivedFrom:[],
  };
  const run = api.buildComparisonRun({ fields:[{ field:'budget', settingValue:'200', csvValue:'200', ruleBasis:'strict', sourceEvidence }] });
  assert.equal(run.entries[0].comparisonStatus, '一致');
  assert.equal(run.entries[0].displayStatus, '一致');
  assert.deepEqual(JSON.parse(JSON.stringify(run.entries[0].sourceEvidence)), sourceEvidence);
});

test('A17-1 Provenance: Register 运行结果使用严格匹配的 primary 与完整 CSV evidence', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign_260801-0831', start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 10:00', budget: '200', adgroup_name: 'Group A', creative_name: 'a.mp4', device: 'ctv', price: '10' },
    { campaign_name: 'Synthetic Campaign_260801-0831', start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 10:00', budget: '200', adgroup_name: 'Group B', creative_name: 'b.mp4', device: 'ctv', price: '10' },
  ]), { fileName: 'register-run-evidence.csv' });
  const tree = api.buildRegisterTree(parsed);
  const settingSource={ fileName: 'setting.xlsx', sheetName: '配信設計', rowNumber: 28, columnName: 'CPN予算', rawValue: '200' };
  const settingCampaign={ key: 'setting-campaign', level: 'Campaign', expectedName: 'Synthetic Campaign_260801-0831', fields: { campaignName: 'Synthetic Campaign', startDateTime: '2026/08/01 10:00', endDateTime: '2026/08/31 10:00', campaignBudget: '200', initialDailyBudget: '' }, sourceRefs: { campaignName: settingSource, startDateTime: settingSource, endDateTime: settingSource, campaignBudget: settingSource, initialDailyBudget: settingSource }, sourceEvidence: { fields: { campaignBudget: [settingSource] }, derived: { expectedName: { derivedFrom: [settingSource] } } } };
  const run = api.buildRunFromModels({ campaigns:[settingCampaign], adGroups:[], ads:[], diagnostics:[] }, tree, { matches:[{ status:'matched', level:'Campaign', settingKey:'setting-campaign', csvKey:tree.campaigns[0].key, reasonCode:'TEST_MATCH' }], unmatched:{ csv:[] }, unassigned:{ csv:[] }, orphans:[], diagnostics:[] }, parsed);
  const budget = run.entries.find(entry => entry.field === 'budget');
  assert.equal(budget.comparisonStatus, '一致');
  assert.equal(budget.sourceRefs.csv.rowNumber, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(budget.sourceEvidence.csv.map(source => source.rowNumber))), [2, 3]);
});

test('Register tree: 字段完全相同的两行仍是两个 Ad candidate，occurrenceIndex 为 1/2', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'same.mp4', device: 'ctv', price: '10', targeting: 'T-001' },
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'same.mp4', device: 'ctv', price: '10', targeting: 'T-001' },
  ]), { fileName: 'register-duplicates.csv' });
  const tree = api.buildRegisterTree(parsed);
  assert.equal(tree.campaigns.length, 1);
  assert.equal(tree.adGroups.length, 1);
  assert.equal(tree.ads.length, 2);
  assert.deepEqual(Array.from(tree.ads, ad => ad.occurrenceIndex), [1, 2]);
  assert.equal(tree.ads[0].rawRows[0].rowNumber, 2);
  assert.equal(tree.ads[1].rawRows[0].rowNumber, 3);
});

test('Register tree: 相同 Campaign 候选聚合，不同 Ad Group 硬字段组合不合并', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'Group A', creative_name: 'a.mp4', device: 'ctv', price: '10', targeting: 'T-001' },
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'Group B', creative_name: 'b.mp4', device: 'android ios pc', price: '20', targeting: 'T-002' },
  ]), { fileName: 'register-groups.csv' });
  const tree = api.buildRegisterTree(parsed);
  assert.equal(tree.campaigns.length, 1);
  assert.equal(tree.adGroups.length, 2);
  assert.equal(tree.ads.length, 2);
});

test('Register tree: 行号与 occurrenceIndex 只保留在追踪字段，改变输入顺序不改变候选语义', () => {
  const first = {
    campaign_name: 'Synthetic Campaign', adgroup_name: 'Group A', creative_name: 'a.mp4',
    device: 'ctv', price: '10', targeting: 'T-001', landing_page_url: 'https://example.invalid/a',
  };
  const second = {
    campaign_name: 'Synthetic Campaign', adgroup_name: 'Group B', creative_name: 'b.mp4',
    device: 'android ios pc', price: '20', targeting: 'T-002', landing_page_url: 'https://example.invalid/b',
  };
  const forward = api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([first, second]), { fileName: 'forward.csv' }));
  const reversed = api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([second, first]), { fileName: 'reversed.csv' }));
  const forwardSignatures = Array.from(forward.ads, ad => ad.candidateSignature).sort();
  const reversedSignatures = Array.from(reversed.ads, ad => ad.candidateSignature).sort();
  assert.deepEqual(forwardSignatures, reversedSignatures);
  assert.ok(forward.ads.every(ad => !Object.hasOwn(ad.matchingFields, 'rowNumber')));
  assert.ok(forward.ads.every(ad => !Object.hasOwn(ad.matchingFields, 'occurrenceIndex')));
});

test('Register tree: rowLedger 为每个原始 CSV 行保留一个独立 Ad candidate', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'same.mp4', device: 'ctv', price: '10', targeting: 'T-001' },
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'Synthetic Group', creative_name: 'same.mp4', device: 'ctv', price: '10', targeting: 'T-001' },
  ]), { fileName: 'register-ledger.csv' });
  const tree = api.buildRegisterTree(parsed);
  assert.deepEqual(Object.keys(tree.rowLedger), ['2', '3']);
  assert.notEqual(tree.rowLedger[2].entityKey, tree.rowLedger[3].entityKey);
  assert.equal(tree.rowLedger[2].disposition, 'normal-leaf');
  assert.equal(tree.rowLedger[3].disposition, 'normal-leaf');
});

test('Register tree: 实例 key 仅标识原始行，完全相同行拥有不同 key 但相同 candidateSignature', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Campaign', adgroup_name: 'Group', creative_name: 'same.mp4', device: 'ctv', price: '10', media: 'media-a', url: 'https://example.invalid/a' },
    { campaign_name: 'Campaign', adgroup_name: 'Group', creative_name: 'same.mp4', device: 'ctv', price: '10', media: 'media-a', url: 'https://example.invalid/a' },
  ]), { fileName: 'instances.csv' });
  const tree = api.buildRegisterTree(parsed);
  assert.notEqual(tree.ads[0].key, tree.ads[1].key);
  assert.equal(tree.ads[0].candidateSignature, tree.ads[1].candidateSignature);
  assert.equal(tree.ads[0].rawRows[0].rowNumber, 2);
  assert.equal(tree.ads[1].rawRows[0].rowNumber, 3);
});

test('Register tree: candidateSignature 只由严格语义字段构成，不含实例 key、行号或 occurrenceIndex', () => {
  const parsed = api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Campaign', adgroup_name: 'Group', creative_name: 'creative.mp4', device: 'ctv', price: '10', media: 'media-a', url: 'https://example.invalid/a' },
  ]), { fileName: 'signature.csv' });
  const ad = api.buildRegisterTree(parsed).ads[0];
  assert.equal(ad.matchingFields.parentAdGroupSignature.includes('media-a'), true);
  assert.equal(ad.matchingFields.landingPageUrl, 'https://example.invalid/a');
  assert.ok(!Object.hasOwn(ad.matchingFields, 'key'));
  assert.ok(!Object.hasOwn(ad.matchingFields, 'rowNumber'));
  assert.ok(!Object.hasOwn(ad.matchingFields, 'occurrenceIndex'));
});

function makeMatchSettingModel({
  campaignName = 'Synthetic Campaign', campaignKey = 'setting-campaign:1',
  groupKey = 'setting-adgroup:1', adKey = 'setting-ad:1',
  groupExpectedName = null, creativeFileName = 'synthetic-creative.mp4',
  structuralProfile = {
    fields: { device: 'ctv', price: '11', media: 'media-1', localBroadcaster: 'station-1', targetingInclude: 'audience-1', targetingExclude: '' },
    requiredFields: ['device', 'price', 'media', 'localBroadcaster', 'targetingInclude', 'targetingExclude'],
  },
} = {}) {
  const campaign = { key: campaignKey, level: 'Campaign', expectedName: campaignName, fields: {} };
  const adGroup = { key: groupKey, level: 'Ad Group', parentKey: campaignKey, expectedName: groupExpectedName, fields: {}, structuralProfile };
  const ad = {
    key: adKey, level: 'Ad', parentKey: groupKey,
    fields: { creativeFileName, lpUrl: 'https://example.invalid/lp', trackingUrlStart: 'https://tracker.invalid/start' },
  };
  return { campaigns: [campaign], adGroups: [adGroup], ads: [ad] };
}

function makeStructuralConversionContext() {
  return {
    getSettingAdGroupProfile(entity) { return entity.structuralProfile; },
    getCsvAdGroupProfile(entity) { return entity.structuralProfile; },
  };
}

function attachRegisterStructuralProfile(tree, profile) {
  tree.adGroups.forEach(entity => { entity.structuralProfile = profile; });
  return tree;
}

test('Match: register 的唯一三层语义候选一对一匹配', () => {
  const csvTree = attachRegisterStructuralProfile(api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'CSV manual name', creative_name: 'synthetic-creative.mp4', url: 'https://example.invalid/lp', tracking_url_start: 'https://tracker.invalid/start' },
  ]), { fileName: 'unique-register.csv' })), makeMatchSettingModel().adGroups[0].structuralProfile);
  const result = api.matchTverEntities(makeMatchSettingModel(), csvTree, {
    schemaKind: 'register-without-ids', conversionContext: makeStructuralConversionContext(),
  });
  assert.deepEqual(Array.from(result.matches, match => [match.level, match.status]), [
    ['Campaign', 'matched'], ['Ad Group', 'matched'], ['Ad', 'matched'],
  ]);
  assert.equal(Object.keys(result.reservations.csvToSetting).length, 3);
  assert.equal(result.unmatched.setting.length, 0);
  assert.equal(result.unmatched.csv.length, 0);
});

test('Match: 两个设定对象争用同一 CSV entity 时双方均 ambiguous', () => {
  const csvTree = attachRegisterStructuralProfile(api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'CSV manual name', creative_name: 'synthetic-creative.mp4' },
  ]), { fileName: 'contention.csv' })), makeMatchSettingModel().adGroups[0].structuralProfile);
  const first = makeMatchSettingModel();
  const second = makeMatchSettingModel({ campaignKey: 'setting-campaign:2', groupKey: 'setting-adgroup:2', adKey: 'setting-ad:2' });
  const result = api.matchTverEntities({
    campaigns: [...first.campaigns, ...second.campaigns], adGroups: [], ads: [],
  }, csvTree, { schemaKind: 'register-without-ids', conversionContext: makeStructuralConversionContext() });
  const campaigns = result.matches.filter(match => match.level === 'Campaign');
  assert.equal(campaigns.length, 2);
  assert.ok(campaigns.every(match => match.status === 'ambiguous'));
  assert.ok(campaigns.every(match => match.reasonCode === 'CANDIDATE_CONTENTION'));
  assert.equal(Object.keys(result.reservations.csvToSetting).length, 0);
});

test('Match: 多个硬条件候选、零候选、必要字段缺失和父级冲突分别不强配', () => {
  const duplicateTree = attachRegisterStructuralProfile(api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', budget: '100', adgroup_name: 'manual-a', creative_name: 'creative-a.mp4' },
    { campaign_name: 'Synthetic Campaign', budget: '200', adgroup_name: 'manual-b', creative_name: 'creative-b.mp4' },
  ]), { fileName: 'multiple.csv' })), makeMatchSettingModel().adGroups[0].structuralProfile);
  const multiple = api.matchTverEntities({ campaigns: makeMatchSettingModel().campaigns, adGroups: [], ads: [] }, duplicateTree, { schemaKind: 'register-without-ids' });
  assert.equal(multiple.matches[0].status, 'ambiguous');
  assert.equal(multiple.matches[0].reasonCode, 'MULTIPLE_HARD_CANDIDATES');

  const zero = api.matchTverEntities(makeMatchSettingModel({ campaignName: 'Absent Campaign' }), duplicateTree, { schemaKind: 'register-without-ids' });
  assert.equal(zero.matches[0].status, 'unmatched');
  assert.equal(zero.matches[0].reasonCode, 'NO_HARD_CANDIDATE');

  const uniqueTree = attachRegisterStructuralProfile(api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'manual', creative_name: 'creative.mp4' },
  ]), { fileName: 'missing-profile.csv' })), makeMatchSettingModel().adGroups[0].structuralProfile);
  const missingProfile = makeMatchSettingModel({ structuralProfile: { fields: { device: 'ctv' }, requiredFields: ['device', 'price'] } });
  const missing = api.matchTverEntities(missingProfile, uniqueTree, { schemaKind: 'register-without-ids', conversionContext: makeStructuralConversionContext() });
  assert.equal(missing.matches.find(match => match.level === 'Ad Group').status, 'ambiguous');
  assert.equal(missing.matches.find(match => match.level === 'Ad Group').reasonCode, 'MISSING_ADGROUP_STRUCTURAL_FIELD');

  const parentConflict = api.matchTverEntities({ campaigns: makeMatchSettingModel({ campaignName: 'Absent Campaign' }).campaigns, adGroups: makeMatchSettingModel().adGroups, ads: [] }, uniqueTree, { schemaKind: 'register-without-ids', conversionContext: makeStructuralConversionContext() });
  assert.equal(parentConflict.matches.find(match => match.level === 'Ad Group').status, 'ambiguous');
  assert.equal(parentConflict.matches.find(match => match.level === 'Ad Group').reasonCode, 'PARENT_NOT_UNIQUELY_MATCHED');
});

test('Match: edit 的无 ID 设定侧关联也遵守占用表，不能重复分配', () => {
  const csvTree = api.buildEditTree(api.parseCsvText(makeEditCsv([
    { campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Synthetic Campaign', adgroup_name: 'CSV manual name', creative_name: 'synthetic-creative.mp4' },
  ]), { fileName: 'edit-reservation.csv' }));
  const first = makeMatchSettingModel();
  const second = makeMatchSettingModel({ campaignKey: 'setting-campaign:2', groupKey: 'setting-adgroup:2', adKey: 'setting-ad:2' });
  const result = api.matchTverEntities({ campaigns: [...first.campaigns, ...second.campaigns], adGroups: [], ads: [] }, csvTree, { schemaKind: 'edit-with-ids' });
  assert.ok(result.matches.filter(match => match.level === 'Campaign').every(match => match.status === 'ambiguous'));
  assert.equal(Object.keys(result.reservations.settingToCsv).length, 0);
});

test('Match: 行号、occurrenceIndex、实例 key 与 CSV 输入顺序均不成为候选依据', () => {
  const settingModel = makeMatchSettingModel();
  const profile = settingModel.adGroups[0].structuralProfile;
  const csvTree = attachRegisterStructuralProfile(api.buildRegisterTree(api.parseCsvText(makeRegisterCsv([
    { campaign_name: 'Synthetic Campaign', adgroup_name: 'manual', creative_name: 'synthetic-creative.mp4', url: 'https://example.invalid/lp', tracking_url_start: 'https://tracker.invalid/start' },
  ]), { fileName: 'trace-a.csv' })), profile);
  const first = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'register-without-ids', conversionContext: makeStructuralConversionContext() });
  csvTree.ads[0].key = 'register-ad:changed-instance-key';
  csvTree.ads[0].occurrenceIndex = 77;
  csvTree.ads[0].rawRows[0].rowNumber = 999;
  const second = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'register-without-ids', conversionContext: makeStructuralConversionContext() });
  assert.deepEqual(Array.from(first.matches, match => [match.level, match.status, match.reasonCode]), Array.from(second.matches, match => [match.level, match.status, match.reasonCode]));
  assert.ok(second.matches.every(match => !Object.hasOwn(match, 'score')));
});

test('Match: ambiguous 只进入 unassigned，不得与真正 unmatched 或 orphan 重复计数', () => {
  const csvTree = {
    campaigns: [{ key: 'campaign:101', fields: { campaign_name: 'Synthetic Campaign' } }],
    adGroups: [], ads: [],
    orphans: [{ key: 'orphan:2:Campaign', level: 'Campaign', displayHint: 'CSV側未匹配' }],
  };
  const first = makeMatchSettingModel();
  const second = makeMatchSettingModel({ campaignKey: 'setting-campaign:2', groupKey: 'setting-adgroup:2', adKey: 'setting-ad:2' });
  const result = api.matchTverEntities({ campaigns: [...first.campaigns, ...second.campaigns], adGroups: [], ads: [] }, csvTree, { schemaKind: 'edit-with-ids' });
  assert.equal(result.matches.filter(match => match.level === 'Campaign' && match.status === 'ambiguous').length, 2);
  assert.equal(result.unmatched.setting.length, 0);
  assert.equal(result.unmatched.csv.length, 0);
  assert.equal(result.unassigned.setting.length, 2);
  assert.equal(result.unassigned.csv.length, 1);
  assert.equal(result.orphans.length, 1);
  assert.equal(Object.keys(result.reservations.csvToSetting).length, 0);
});

// 阶段 A：Campaign 硬条件中的日期时间，在「值相同、仅零填充／表记不同」时应作为同值参与匹配。
test('Date match: 零填充差异的同一開始日時應作為同值參與 Campaign hard 匹配', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'CPN_X_260814-0828', fields: { startDateTime: '2026/08/14 10:00', endDateTime: '2026/08/20 00:00' } }],
    adGroups: [], ads: [], diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'CPN_X_260814-0828', start_datetime: '2026/8/14 10:0', end_datetime: '2026/8/20 0:0' } }],
    adGroups: [], ads: [], orphans: [],
  };
  const result = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() });
  const cp = result.matches.find(m => m.level === 'Campaign');
  assert.equal(cp.status, 'matched');
});

test('Date match: 零填充差異的同一終了日時應作為同值參與 Campaign hard 匹配', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'CPN_Y_260820-0930', fields: { startDateTime: '2026/08/01 00:00', endDateTime: '2026/08/20 00:00' } }],
    adGroups: [], ads: [], diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'CPN_Y_260820-0930', start_datetime: '2026/8/1 0:0', end_datetime: '2026/8/20 0:0' } }],
    adGroups: [], ads: [], orphans: [],
  };
  const result = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() });
  const cp = result.matches.find(m => m.level === 'Campaign');
  assert.equal(cp.status, 'matched');
});

test('Date match: 真正不同的日時即使經過歸一化仍不匹配', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'CPN_Z_260820-0828', fields: { startDateTime: '2026/08/20 00:00', endDateTime: '2026/08/28 00:00' } }],
    adGroups: [], ads: [], diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'CPN_Z_260820-0828', start_datetime: '2026/8/21 0:0', end_datetime: '2026/8/28 0:0' } }],
    adGroups: [], ads: [], orphans: [],
  };
  const result = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() });
  const cp = result.matches.find(m => m.level === 'Campaign');
  assert.equal(cp.status, 'unmatched');
  assert.equal(cp.reasonCode, 'NO_HARD_CANDIDATE');
});

// 阶段 A5：Ad Group structural 匹配的 device / price / DMP 三维 canonical 解析。
// Device 优先 tagAppeal，空时回退 targeting 配信デバイス清单唯一有效类别。
test('Device: tagAppeal=SPPC 解析为 android ios pc', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'SPPC', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});
test('Device: tagAppeal=SD/PC_M1 解析为 android ios pc', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'SD/PC_M1', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});
test('Device: tagAppeal=CTV_M1 解析为 ctv', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'CTV_M1', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'ctv');
});
test('Device: tagAppeal 为空时回退 targeting 单设备 CTV → ctv', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: '', device: '- CTV ※OS指定ある場合はここに記入', targeting: { device: '- CTV ※OS指定ある場合はここに記入' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'ctv');
});
test('Device: tagAppeal 为空且 targeting 为 SP／PC／CTV 多设备时 unresolved，不猜', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: '', device: '- SP／PC／CTV ※OS指定ある場合はここに記入', targeting: { device: '- SP／PC／CTV ※OS指定ある場合はここに記入' } } });
  assert.equal(r.resolved, false);
  assert.equal(r.device, null);
});

// 阶段 A6：案件⑦真实证据——tagAppeal「タグセット_SP / タグセット_CTV」→ 明确 device token。
test('Device: tagAppeal=タグセット_SP 解析为 android ios pc', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'タグセット_SP', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});
test('Device: tagAppeal=タグセット_CTV 解析为 ctv', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'タグセット_CTV', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'ctv');
});
test('Device: tagAppeal=タグセット_SPECIAL 不因含 SP 自动判 android（guard）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'タグセット_SPECIAL' } });
  assert.equal(r.resolved, false);
  assert.equal(r.device, null);
});
test('Device: tagAppeal=ABCCTV 不含下划线边界 token 不自动识别（guard）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'ABCCTV' } });
  assert.equal(r.resolved, false);
  assert.equal(r.device, null);
});

// 阶段 A8：device 由 配信デバイス● 清单 + tagAppeal 分支共同决定，SP 侧是否含 PC 由清单决定。
test('Device: targeting=SP／CTV + tagAppeal=SPPC_汎用_set → android ios（无 PC）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'SPPC_汎用_set', targeting: { device: 'SP／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios');
});
test('Device: targeting=SP／PC／CTV + tagAppeal=SPPC → android ios pc', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'SPPC', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});
test('Device: targeting=SP／CTV + tagAppeal=CTV_汎用 → ctv', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'CTV_汎用', targeting: { device: 'SP／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'ctv');
});
test('Device: targeting=SP／CTV + tagAppeal=UNKNOWN → unresolved（guard）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'UNKNOWN', targeting: { device: 'SP／CTV' } } });
  assert.equal(r.resolved, false);
  assert.equal(r.device, null);
});
test('Device: targeting=SP／PC／CTV + tagAppeal=タグセット_SP → android ios pc（⑦ 不回归 guard）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'タグセット_SP', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});
test('Device: targeting=SP／PC／CTV + tagAppeal=SD/PC_M1 → android ios pc（③④⑥ 不回归 guard）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'SD/PC_M1', targeting: { device: 'SP／PC／CTV' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});

// 阶段 A12：案件② device 后缀 token（tagAppeal = <appeal>_SPPC / <appeal>_CTV，device 清单无 CTV）。
test('Device: tagAppeal=No1_特定_SPPC + SP／PC → android ios pc（后缀 token）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'No1_特定_SPPC', targeting: { device: 'SP／PC' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'android ios pc');
});
test('Device: tagAppeal=No1_特定_CTV + SP／PC → ctv（后缀 token，清单无 CTV 仍解析）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'No1_特定_CTV', targeting: { device: 'SP／PC' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.device, 'ctv');
});
test('Device: tagAppeal=ABCSPPC 无下划线边界不自动识别（guard）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'ABCSPPC', targeting: { device: 'SP／PC' } } });
  assert.equal(r.resolved, false);
  assert.equal(r.device, null);
});
test('Device: tagAppeal=CTVVALUE 无下划线边界不自动识别（guard，证明非 contains CTV）', () => {
  const r = api.resolveSettingAdGroupDevice({ fields: { tagAppeal: 'CTVVALUE', targeting: { device: 'SP／PC' } } });
  assert.equal(r.resolved, false);
  assert.equal(r.device, null);
});

// 阶段 A8：retarget 维度（store = データ蓄積/store_segment，bid = 入札セグメント/bid_segment）。
test('Retarget Setting: データ蓄積=6543 → store', () => {
  const r = api.resolveSettingRetargetProfile({ fields: { targeting: { dataAccumulation: '○ 2608_シナリオ_メルカリ_汎用 6543', bidSegment: '※セグメント名 ※セグメントID' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.retargetKind, 'store');
  assert.equal(r.retargetSegmentId, '6543');
});
test('Retarget Setting: 入札セグメント=6543 → bid', () => {
  const r = api.resolveSettingRetargetProfile({ fields: { targeting: { dataAccumulation: '※セグメント名 ※セグメントID', bidSegment: '○ 2608_シナリオ_メルカリ_汎用 6543' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.retargetKind, 'bid');
  assert.equal(r.retargetSegmentId, '6543');
});
test('Retarget CSV: store_segment=6543 → store', () => {
  const r = api.resolveCsvRetargetProfile({ fields: { store_segment: '6543', bid_segment: '' } });
  assert.equal(r.resolved, true);
  assert.equal(r.retargetKind, 'store');
  assert.equal(r.retargetSegmentId, '6543');
});
test('Retarget CSV: bid_segment=6543 → bid', () => {
  const r = api.resolveCsvRetargetProfile({ fields: { store_segment: '', bid_segment: '6543' } });
  assert.equal(r.resolved, true);
  assert.equal(r.retargetKind, 'bid');
  assert.equal(r.retargetSegmentId, '6543');
});
test('Retarget CSV: store_segment 与 bid_segment 同时有值 → ambiguous（guard）', () => {
  const r = api.resolveCsvRetargetProfile({ fields: { store_segment: '6543', bid_segment: '6543' } });
  assert.equal(r.resolved, false);
});
test('Retarget Setting: 数据蓄积与入札セグメント同时有值 → ambiguous（guard）', () => {
  const r = api.resolveSettingRetargetProfile({ fields: { targeting: { dataAccumulation: '○ 6543', bidSegment: '○ 6543' } } });
  assert.equal(r.resolved, false);
});
function retargetProfile(kind) {
  return {
    fields: { device: 'android ios', price: '1530', dmpKind: 'regular', retargetKind: kind, retargetSegmentId: '6543' },
    requiredFields: ['device', 'price', 'dmpKind', 'retargetKind'],
    optionalFields: ['dmpSegmentId', 'retargetSegmentId'],
  };
}
test('Retarget match: store vs store 匹配', () => {
  assert.equal(api.structuralProfilesMatch(retargetProfile('store'), retargetProfile('store')), true);
});
test('Retarget match: bid vs bid 匹配', () => {
  assert.equal(api.structuralProfilesMatch(retargetProfile('bid'), retargetProfile('bid')), true);
});
test('Retarget match: store vs bid 不匹配', () => {
  assert.equal(api.structuralProfilesMatch(retargetProfile('store'), retargetProfile('bid')), false);
});

// 阶段 A10：名称标点归一化（仅 全角（）＆｜ → 半角 ()&|）。
test('Name: Campaign 全角/半角标点归一后匹配', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'ABC（15秒＆30秒）', fields: { startDateTime: '2026/01/01 00:00', endDateTime: '2026/01/31 00:00' } }],
    adGroups: [], ads: [], diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'ABC(15秒&30秒)', start_datetime: '2026/1/1 0:0', end_datetime: '2026/1/31 0:0' } }],
    adGroups: [], ads: [], orphans: [],
  };
  const cp = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() }).matches.find(m => m.level === 'Campaign');
  assert.equal(cp.status, 'matched');
});
test('Name: Creative 全角/半角标点归一后匹配', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'CPN', fields: {} }],
    adGroups: [{ key: 's-g-1', level: 'Ad Group', parentKey: 's-cp-1', expectedName: 'G1', fields: {} }],
    ads: [{ key: 's-a-1', level: 'Ad', parentKey: 's-g-1', expectedName: 'パナソニック（洗濯機）｜商品（ABC）', fields: { creativeFileName: 'パナソニック（洗濯機）｜商品（ABC）' } }],
    diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'CPN' } }],
    adGroups: [{ key: 'c-g-1', level: 'Ad Group', parentKey: 'c-cp-1', fields: { adgroup_name: 'G1' } }],
    ads: [{ key: 'c-a-1', level: 'Ad', parentKey: 'c-g-1', fields: { creative_name: 'パナソニック(洗濯機)|商品(ABC)' } }],
    orphans: [],
  };
  const ad = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() }).matches.find(m => m.level === 'Ad');
  assert.equal(ad.status, 'matched');
});
test('Name guard: 全角连字符 ー（ABC-A vs ABC－A）不自动一致', () => {
  assert.notEqual(api.normalizeTverNameForMatching('ABC-A'), api.normalizeTverNameForMatching('ABC－A'));
});
test('Name guard: 空格差异（ABC Test vs ABCTest）不自动一致', () => {
  assert.notEqual(api.normalizeTverNameForMatching('ABC Test'), api.normalizeTverNameForMatching('ABCTest'));
});
test('Name guard: 大小写差异（abc vs ABC）不自动一致', () => {
  assert.notEqual(api.normalizeTverNameForMatching('abc'), api.normalizeTverNameForMatching('ABC'));
});
test('Name guard: 归一后两个 CSV 候选 → MULTIPLE_HARD_CANDIDATES', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'ABC（テスト）', fields: {} }],
    adGroups: [], ads: [], diagnostics: [],
  };
  const csvTree = {
    campaigns: [
      { key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'ABC(テスト)' } },
      { key: 'c-cp-2', level: 'Campaign', fields: { campaign_name: 'ABC（テスト）' } },
    ],
    adGroups: [], ads: [], orphans: [],
  };
  const cp = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() }).matches.find(m => m.level === 'Campaign');
  assert.equal(cp.status, 'ambiguous');
  assert.equal(cp.reasonCode, 'MULTIPLE_HARD_CANDIDATES');
});

// 阶段 A14：仅允许下划线分隔的独立 Pre token → pre；禁止全名称忽略大小写。
test('Name A14: 独立 Pre token 仅规范为 pre', () => {
  assert.equal(api.normalizeTverNameForMatching('User_A_Pre'), 'User_A_pre');
  assert.equal(api.normalizeTverNameForMatching('abc_Pre_xyz'), 'abc_pre_xyz');
});
test('Name A14 guard: Premium、PremiumRate 与 ABCPre 保持原样', () => {
  assert.equal(api.normalizeTverNameForMatching('Premium'), 'Premium');
  assert.equal(api.normalizeTverNameForMatching('PremiumRate'), 'PremiumRate');
  assert.equal(api.normalizeTverNameForMatching('ABCPre'), 'ABCPre');
});
test('Name A14 guard: 普通大小写差异仍不自动一致', () => {
  assert.notEqual(api.normalizeTverNameForMatching('ABC'), api.normalizeTverNameForMatching('abc'));
});
test('Name A14: Pre→pre 后两个 Ad hard candidates 必须保持 ambiguous', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp-1', level: 'Campaign', expectedName: 'CPN', fields: {} }],
    adGroups: [{ key: 's-g-1', level: 'Ad Group', parentKey: 's-cp-1', expectedName: 'G1', fields: {} }],
    ads: [{ key: 's-a-1', level: 'Ad', parentKey: 's-g-1', expectedName: 'User_A_pre', fields: { creativeFileName: 'User_A_pre' } }],
    diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp-1', level: 'Campaign', fields: { campaign_name: 'CPN' } }],
    adGroups: [{ key: 'c-g-1', level: 'Ad Group', parentKey: 'c-cp-1', fields: { adgroup_name: 'G1' } }],
    ads: [
      { key: 'c-a-1', level: 'Ad', parentKey: 'c-g-1', fields: { creative_name: 'User_A_pre' } },
      { key: 'c-a-2', level: 'Ad', parentKey: 'c-g-1', fields: { creative_name: 'User_A_Pre' } },
    ],
    orphans: [],
  };
  const ad = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() }).matches.find(match => match.level === 'Ad');
  assert.equal(ad.status, 'ambiguous');
  assert.equal(ad.reasonCode, 'MULTIPLE_HARD_CANDIDATES');
});

// Price：CPM● 行安全 canonical 化，唯一数值集合才可 canonical，禁止取首个。
test('Price: "- ¥1,500 ¥1,500" canonical 为 1500', () => {
  const r = api.normalizeTverPriceForMatching('- ¥1,500 ¥1,500');
  assert.equal(r.resolved, true);
  assert.equal(r.value, '1500');
});
test('Price: "¥1,800/1,800" canonical 为 1800', () => {
  const r = api.normalizeTverPriceForMatching('¥1,800/1,800');
  assert.equal(r.resolved, true);
  assert.equal(r.value, '1800');
});
test('Price: "¥1,500 / ¥1,800" 为 ambiguous，不自动取 1500', () => {
  const r = api.normalizeTverPriceForMatching('¥1,500 / ¥1,800');
  assert.equal(r.resolved, false);
  assert.equal(r.value, null);
});

// DMP：Setting 侧 segment（DMPセグメント行）去 boilerplate 后 empty→regular，含真实段 ID→DMP。
test('DMP Setting: 纯模板 segment 去 boilerplate 后为 regular', () => {
  const r = api.resolveSettingDmpProfile({ fields: { targeting: { segment: '※セグメント名 ※セグメントID ADGをSPPC/CTVで分ける' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.dmpKind, 'regular');
  assert.equal(r.dmpSegmentId, null);
});
test('DMP Setting: 含真实段 ID 的 segment 为 DMP 且保留 segmentId=68', () => {
  const r = api.resolveSettingDmpProfile({ fields: { targeting: { segment: 'IM 「男性」and「20-34歳」 68 ADGをSPPC/CTVで分ける' } } });
  assert.equal(r.resolved, true);
  assert.equal(r.dmpKind, 'dmp');
  assert.equal(r.dmpSegmentId, '68');
});
// DMP：CSV 侧按 schema 分开。register 用 dmp_segment 字段，edit 用 _DMP_ 名称 token。
test('DMP register: dmp_segment=68 判 DMP', () => {
  const r = api.resolveCsvDmpProfile({ rawRows: [{ values: { dmp_segment: '68' } }] }, 'register-without-ids');
  assert.equal(r.resolved, true);
  assert.equal(r.dmpKind, 'dmp');
  assert.equal(r.dmpSegmentId, '68');
});
test('DMP register: dmp_segment 空判 regular', () => {
  const r = api.resolveCsvDmpProfile({ rawRows: [{ values: { dmp_segment: '' } }] }, 'register-without-ids');
  assert.equal(r.resolved, true);
  assert.equal(r.dmpKind, 'regular');
  assert.equal(r.dmpSegmentId, null);
});
test('DMP edit: 名称含 _DMP_ token 判 DMP，且不伪造 segment ID', () => {
  const r = api.resolveCsvDmpProfile({ fields: { adgroup_name: '2608_Fry M/L 250_260814-0828_M1_DMP_SPPC' } }, 'edit-with-ids');
  assert.equal(r.resolved, true);
  assert.equal(r.dmpKind, 'dmp');
  assert.equal(r.dmpSegmentId, null);
});
test('DMP edit: 普通名称与不含正式 _DMP_ token 的名称均判 regular', () => {
  assert.equal(api.resolveCsvDmpProfile({ fields: { adgroup_name: '2608_Fry M/L 250_260814-0828_M1_SPPC' } }, 'edit-with-ids').dmpKind, 'regular');
  assert.equal(api.resolveCsvDmpProfile({ fields: { adgroup_name: '2608_Fry M/L 250_260814-0828_M1_DMP' } }, 'edit-with-ids').dmpKind, 'regular');
  assert.equal(api.resolveCsvDmpProfile({ fields: { adgroup_name: 'some_DMPextra_SPPC' } }, 'edit-with-ids').dmpKind, 'regular');
});
// Profile 接线：register 双方都有 segment ID 时值级一致；edit 无 ID 仅比较 DMP/regular，不伪造 68。
test('Profile: register 双方 segment ID 值级一致，edit 无 ID 仅比较 DMP/regular', () => {
  const registerCtx = api.createTverConversionContext('register-without-ids');
  const editCtx = api.createTverConversionContext('edit-with-ids');
  const settingDmp = { fields: { tagAppeal: 'SPPC', targeting: { device: '- SP／PC／CTV ※OS指定ある場合はここに記入', price: '- ¥1,500 ¥1,500', segment: 'IM 「男性」and「20-34歳」 68 ADGをSPPC/CTVで分ける' } } };
  const registerCsvDmp = { fields: { device: 'android ios pc', price: '1500' }, rawRows: [{ values: { dmp_segment: '68' } }] };
  assert.equal(registerCtx.getCsvAdGroupProfile(registerCsvDmp).fields.dmpSegmentId, '68');
  assert.equal(api.structuralProfilesMatch(registerCtx.getSettingAdGroupProfile(settingDmp), registerCtx.getCsvAdGroupProfile(registerCsvDmp)), true);
  const editCsvDmp = { fields: { device: 'android ios pc', price: '1500', adgroup_name: '2608_Fry M/L 250_260814-0828_M1_DMP_SPPC' } };
  assert.equal(editCtx.getCsvAdGroupProfile(editCsvDmp).fields.dmpSegmentId, null);
  assert.equal(api.structuralProfilesMatch(editCtx.getSettingAdGroupProfile(settingDmp), editCtx.getCsvAdGroupProfile(editCsvDmp)), true);
});

// 阶段 A12：CSV DMP schema gap —— unavailable（edit schema 无 dmp_segment 且名称无 _DMP_）区别于 regular。
test('DMP register: dmp_segment=68 判 dmp（G1）', () => {
  const r = api.resolveCsvDmpProfile({ rawRows: [{ values: { dmp_segment: '68' } }] }, 'register-without-ids');
  assert.equal(r.dmpKind, 'dmp');
  assert.equal(r.dmpSegmentId, '68');
});
test('DMP register: dmp_segment 空判 regular（G2）', () => {
  const r = api.resolveCsvDmpProfile({ rawRows: [{ values: { dmp_segment: '' } }] }, 'register-without-ids');
  assert.equal(r.dmpKind, 'regular');
});
test('DMP edit: 名称含 _DMP_ 判 dmp（G3）', () => {
  const r = api.resolveCsvDmpProfile({ fields: { adgroup_name: 'xxx_DMP_SPPC' } }, 'edit-with-ids', false);
  assert.equal(r.dmpKind, 'dmp');
});
test('DMP edit: 名称无 _DMP_ 且 case 无 DMP 维度判 unavailable（G4）', () => {
  const r = api.resolveCsvDmpProfile({ fields: { adgroup_name: 'xxx_SPPC' } }, 'edit-with-ids', false);
  assert.equal(r.dmpKind, 'unavailable');
});

function dmpProfile(kind) {
  return {
    fields: { device: 'android ios pc', price: '1500', dmpKind: kind, dmpSegmentId: null, retargetKind: 'none', retargetSegmentId: null },
    requiredFields: ['device', 'price', 'dmpKind', 'retargetKind'],
    optionalFields: ['dmpSegmentId', 'retargetSegmentId'],
  };
}
test('DMP match: Setting dmp vs CSV unavailable 不因 dmpKind 排除（G5）', () => {
  assert.equal(api.structuralProfilesMatch(dmpProfile('dmp'), dmpProfile('unavailable')), true);
});
test('DMP match: Setting regular vs CSV unavailable 不因 dmpKind 排除（G6）', () => {
  assert.equal(api.structuralProfilesMatch(dmpProfile('regular'), dmpProfile('unavailable')), true);
});
test('DMP match: Setting dmp vs CSV 明确 regular 必须不匹配（G7）', () => {
  assert.equal(api.structuralProfilesMatch(dmpProfile('dmp'), dmpProfile('regular')), false);
});
test('DMP match: Setting regular vs CSV 明确 dmp 必须不匹配（G8）', () => {
  assert.equal(api.structuralProfilesMatch(dmpProfile('regular'), dmpProfile('dmp')), false);
});

// ===== 阶段 B2：measurement-tag 多 block / 空 targeting 模板 / verify 阻断与 schemaKind 对齐 =====

test('MTag: 同一 section 内两个 header block 的 tagAppeal 均进入索引', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    measurementTagBlocks: [
      { tags: [{ 'タグ訴求': 'AppealA', 'タグ': 'https://a.invalid/x', 'タグ提供元': 'V1', '計測地点': '100%', '新規/流用': '新規' }] },
      { tags: [{ 'タグ訴求': 'AppealB', 'タグ': 'https://b.invalid/y', 'タグ提供元': 'V2', '計測地点': '100%', '新規/流用': '新規' }] },
    ],
  }), { fileName: 'mtag-2block.xlsx' });
  const index = result.sourceIndex.measurementTagByAppeal;
  assert.equal(index['AppealA'].state, 'unique');
  assert.equal(index['AppealB'].state, 'unique');
  assert.ok(!result.diagnostics.some(issue => issue.code === 'SETTING_MEASUREMENT_TAG_HEADER_AMBIGUOUS'));
});

test('MTag: 三个独立 block 全部可解析', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    measurementTagBlocks: [
      { tags: [{ 'タグ訴求': 'A', 'タグ': 'https://a.invalid/x' }] },
      { tags: [{ 'タグ訴求': 'B', 'タグ': 'https://b.invalid/y' }] },
      { tags: [{ 'タグ訴求': 'C', 'タグ': 'https://c.invalid/z' }] },
    ],
  }), { fileName: 'mtag-3block.xlsx' });
  assert.equal(result.sourceIndex.measurementTagByAppeal['A'].state, 'unique');
  assert.equal(result.sourceIndex.measurementTagByAppeal['B'].state, 'unique');
  assert.equal(result.sourceIndex.measurementTagByAppeal['C'].state, 'unique');
});

test('MTag: 两个 block 相同 tagAppeal 相同 mapping 不误报冲突', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    measurementTagBlocks: [
      { tags: [{ 'タグ訴求': 'Dup', 'タグ': 'https://same.invalid/x', 'タグ提供元': 'V', '計測地点': '100%', '新規/流用': '新規' }] },
      { tags: [{ 'タグ訴求': 'Dup', 'タグ': 'https://same.invalid/x', 'タグ提供元': 'V', '計測地点': '100%', '新規/流用': '新規' }] },
    ],
  }), { fileName: 'mtag-same.xlsx' });
  const tag = result.sourceIndex.measurementTagByAppeal['Dup'];
  assert.equal(tag.state, 'unique');
  assert.equal(tag.mappings.length, 2);
  assert.ok(!result.diagnostics.some(issue => issue.code === 'SETTING_MEASUREMENT_TAG_MAPPING_AMBIGUOUS'));
});

test('MTag: 两个 block 相同 tagAppeal 不同 mapping 必须 ambiguous', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    measurementTagBlocks: [
      { tags: [{ 'タグ訴求': 'Dup', 'タグ': 'https://a.invalid/x', 'タグ提供元': 'V', '計測地点': '100%', '新規/流用': '新規' }] },
      { tags: [{ 'タグ訴求': 'Dup', 'タグ': 'https://b.invalid/y', 'タグ提供元': 'V', '計測地点': '100%', '新規/流用': '流用' }] },
    ],
  }), { fileName: 'mtag-conflict.xlsx' });
  assert.equal(result.sourceIndex.measurementTagByAppeal['Dup'].state, 'ambiguous');
  assert.ok(result.diagnostics.some(issue => issue.code === 'SETTING_MEASUREMENT_TAG_MAPPING_AMBIGUOUS'));
});

test('Targeting: 空模板 group（无编号且无业务值）不产生 MISSING', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    targetingBatches: [[{ number: 'TG-01', device: 'Synthetic Device A' }, { number: '' }]],
  }), { fileName: 'targeting-empty-template.xlsx' });
  assert.ok(!result.diagnostics.some(issue => issue.code === 'SETTING_TARGETING_NUMBER_MISSING'));
  assert.ok(result.sourceIndex.targetingByNumber['TG-01']);
});

test('Targeting: 空编号但存在 device 业务值仍必须 MISSING（guard）', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({
    targetingBatches: [[{ number: '', device: 'Synthetic Device Blank' }]],
  }), { fileName: 'targeting-blank-with-device.xlsx' });
  assert.ok(result.diagnostics.some(issue => issue.code === 'SETTING_TARGETING_NUMBER_MISSING'));
});

test('Verify: settingParseBlockingIssue 仅阻断 4 类主结构错误，非阻断诊断返回空', () => {
  assert.equal(api.settingParseBlockingIssue({ diagnostics: [{ code: 'SETTING_MEASUREMENT_TAG_HEADER_AMBIGUOUS' }] }), undefined);
  assert.equal(api.settingParseBlockingIssue({ diagnostics: [{ code: 'SETTING_TARGETING_NUMBER_MISSING' }] }), undefined);
  assert.equal(api.settingParseBlockingIssue({ diagnostics: [] }), undefined);
  assert.equal(api.settingParseBlockingIssue({ diagnostics: [{ code: 'SETTING_HEADER_AMBIGUOUS' }] }).code, 'SETTING_HEADER_AMBIGUOUS');
  assert.equal(api.settingParseBlockingIssue({ diagnostics: [{ code: 'SETTING_BUSINESS_HEADER_MISSING' }] }).code, 'SETTING_BUSINESS_HEADER_MISSING');
});

test('Verify: register schemaKind 使 conversionContext 走 dmp_segment 字段而非 edit 名称 fallback', () => {
  const verifyApi = tverVerify.getTverApi();
  const registerCtx = verifyApi.createTverConversionContext('register-without-ids');
  const csvDmpByName = { fields: { adgroup_name: 'foo_SPPC_no_dmp_token' }, rawRows: [{ values: { dmp_segment: '68' } }] };
  assert.equal(registerCtx.getCsvAdGroupProfile(csvDmpByName).fields.dmpKind, 'dmp');
  const editCtx = verifyApi.createTverConversionContext('edit-with-ids');
  assert.equal(editCtx.getCsvAdGroupProfile({ fields: { adgroup_name: 'foo_SPPC' } }).fields.dmpKind, 'regular');
});

test('Rules: 260605 固定 ID 主数据八类完整、唯一且具首尾 sentinel', () => {
  const dictionaries = api.getTverIdDictionaries();
  assert.deepEqual(Object.fromEntries(Object.entries(dictionaries).map(([type, entries]) => [type, entries.length])), {
    media: 240, local_broadcaster: 139, pref: 47, carrier: 5,
    genre: 6, subgenre: 44, contents_group: 10, affinity: 17,
  });
  assert.deepEqual([dictionaries.media[0].id, dictionaries.media.at(-1).id], ['1', '1567']);
  assert.deepEqual([dictionaries.local_broadcaster[0].id, dictionaries.local_broadcaster.at(-1).id], ['11', '150']);
  assert.deepEqual([dictionaries.pref[0].id, dictionaries.pref.at(-1).id], ['01', '47']);
  assert.deepEqual([dictionaries.affinity[0].id, dictionaries.affinity.at(-1).id], ['2', '18']);
  assert.equal(api.validateIdDictionaries(dictionaries).valid, true);
  assert.throws(() => api.validateIdDictionaries({ ...dictionaries, pref: [{ id: '01', name: 'One' }, { id: '01', name: '' }] }), /ID_DICTIONARY/);
});

test('Rules: 仅允许 SP／PC、CTV 与固定素材秒数的已确认转换', () => {
  assert.equal(api.normalizeTverDevice('SP／PC').value, 'android ios pc');
  assert.equal(api.normalizeTverDevice('CTV').value, 'ctv');
  assert.equal(api.normalizeTverDevice('sp/pc').value, 'sp/pc');
  assert.deepEqual([6, 10, 11, 22, 23, 37, 38, 52, 53, 60].map(api.normalizeTverVideoDuration), [
    '6', '6', '15', '15', '30', '30', '45', '45', '60', '60',
  ]);
  assert.equal(api.normalizeTverVideoDuration(5), null);
  assert.equal(api.normalizeTverVideoDuration(61), null);
});

test('Rules: Include／Exclude 独立比较，未知 ID 不自动相等且 city 不在字典内', () => {
  const equal = api.compareTverIdSets({ include: '1,2', exclude: '3' }, { include: '2,1', exclude: '3' }, 'media');
  assert.equal(equal.status, 'equal');
  const direction = api.compareTverIdSets({ include: '1', exclude: '2' }, { include: '2', exclude: '1' }, 'media');
  assert.equal(direction.status, 'different');
  const unknown = api.compareTverIdSets({ include: '999999', exclude: '' }, { include: '999999', exclude: '' }, 'media');
  assert.equal(unknown.status, 'unknown-id');
  assert.equal(api.compareTverIdSets({ include: '1', exclude: '' }, { include: '1', exclude: '' }, 'city').status, 'dictionary-unavailable');
});

test('ID dictionary: ID 集合仅按已确认逗号与空白分隔，去重排序且保留原始值', () => {
  const cases = [
    ['1 2 3', ['1', '2', '3']], ['1  2   1', ['1', '2']], ['1\t2\n3', ['1', '2', '3']],
    ['1,2,3', ['1', '2', '3']], [' 1, 2  3,1 ', ['1', '2', '3']], ['', []],
  ];
  cases.forEach(([rawValue, ids]) => {
    const result = api.parseTverIdSet(rawValue);
    assert.equal(result.rawValue, rawValue);
    assert.deepEqual(Array.from(result.ids), ids);
  });
  assert.deepEqual(Array.from(api.parseTverIdSet('mvno').ids), ['mvno']);
});

test('ID dictionary: 结构化校验报告原始ID、规范化冲突、数量和 sentinel 错误', () => {
  const dictionaries = api.getTverIdDictionaries();
  const expectedCounts = { media: 240, local_broadcaster: 139, pref: 47, carrier: 5, genre: 6, subgenre: 44, contents_group: 10, affinity: 17 };
  const expectedSentinels = { media: ['1', '1567'], local_broadcaster: ['11', '150'], pref: ['01', '47'], carrier: ['docomo', 'mvno'], genre: ['drama', 'other'], subgenre: ['romance', 'kids612'], contents_group: ['all', 'tts_mrs_ceremony'], affinity: ['2', '18'] };
  const valid = api.validateEmbeddedIdDictionaries(dictionaries, expectedCounts, expectedSentinels);
  assert.deepEqual(JSON.parse(JSON.stringify(valid)), { valid: true, templateVersion: '260605', counts: expectedCounts, issues: [] });
  const invalid = api.validateEmbeddedIdDictionaries({ ...dictionaries, carrier: [{ rawId: 'x', id: 'x', name: 'A' }, { rawId: 'x ', id: 'x', name: 'B' }] }, expectedCounts, expectedSentinels);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some(issue => issue.code === 'ID_DICTIONARY_NORMALIZED_ID_DUPLICATE'));
  assert.ok(invalid.issues.some(issue => issue.code === 'ID_DICTIONARY_COUNT_INVALID'));
});

test('Rules: 固定模板素材秒数格式保留原文，未知或矛盾形态不宽松抽取', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseTverVideoDuration('15秒(11-22秒)'))), { rawValue: '15秒(11-22秒)', value: '15', state: 'known', ruleId: 'TVER_260605_VIDEO_DURATION_11_22' });
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseTverVideoDuration('30秒(23-37秒)'))), { rawValue: '30秒(23-37秒)', value: '30', state: 'known', ruleId: 'TVER_260605_VIDEO_DURATION_23_37' });
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseTverVideoDuration('15'))), { rawValue: '15', value: '15', state: 'known', ruleId: 'TVER_260605_VIDEO_DURATION_DIRECT' });
  assert.equal(api.parseTverVideoDuration('15秒(23-37秒)').state, 'ambiguous');
  assert.equal(api.parseTverVideoDuration('creative-15sec.mp4').state, 'unknown');
  assert.equal(api.parseTverVideoDuration('61').state, 'unknown');
});

test('Rules: 固定模板素材秒数的五个已登记区间包含 6 秒区间', () => {
  const cases = [
    ['6秒(6-10秒)', '6', 'TVER_260605_VIDEO_DURATION_6_10'],
    ['15秒(11-22秒)', '15', 'TVER_260605_VIDEO_DURATION_11_22'],
    ['30秒(23-37秒)', '30', 'TVER_260605_VIDEO_DURATION_23_37'],
    ['45秒(38-52秒)', '45', 'TVER_260605_VIDEO_DURATION_38_52'],
    ['60秒(53-60秒)', '60', 'TVER_260605_VIDEO_DURATION_53_60'],
  ];
  cases.forEach(([rawValue, value, ruleId]) => {
    const result = api.parseTverVideoDuration(rawValue);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { rawValue, value, state: 'known', ruleId });
  });
  ['5秒', '61秒', '6秒(7-10秒)', '15秒(6-10秒)', '说明文字 15 秒'].forEach(rawValue => {
    assert.notEqual(api.parseTverVideoDuration(rawValue).state, 'known');
  });
});

test('Status: 同值格式异常保留一致 comparisonStatus，但 displayStatus 为需确认', () => {
  const result = api.compareField({ field: 'start_datetime', settingValue: '2026/01/01 10:15', csvValue: '2026/01/01 10:15', settingSource: { rowNumber: 2 }, csvSource: { rowNumber: 3 }, ruleBasis: 'strict' });
  assert.equal(result.comparisonStatus, '一致');
  assert.equal(result.displayStatus, '需确认');
  assert.equal(result.validationIssues.length, 2);
  assert.equal(result.settingRawValue, '2026/01/01 10:15');
  assert.equal(result.csvRawValue, '2026/01/01 10:15');
});

test('Status: 格式正确但值不同为不一致，格式问题不覆盖不一致或未匹配', () => {
  const different = api.compareField({ field: 'budget', settingValue: '1000', csvValue: '700', ruleBasis: 'strict' });
  assert.equal(different.comparisonStatus, '不一致');
  assert.equal(different.displayStatus, '不一致');
  assert.equal(api.deriveDisplayStatus({ comparisonStatus: '未匹配', validationIssues: [{ code: 'INVALID' }] }), '未匹配');
});

test('Status: URL、状态和 ID token 的格式异常不因字符相同而自动一致', () => {
  const status = api.compareField({ field: 'campaign_status', settingValue: 'invalid', csvValue: 'invalid', ruleBasis: 'strict' });
  const id = api.compareField({ field: 'campaign_id', settingValue: 'id-1', csvValue: 'id-1', ruleBasis: 'strict' });
  const url = api.compareField({ field: 'url', settingValue: 'not a url', csvValue: 'not a url', ruleBasis: 'strict' });
  [status, id, url].forEach(result => { assert.equal(result.comparisonStatus, '一致'); assert.equal(result.displayStatus, '需确认'); assert.ok(result.validationIssues.length > 0); });
});

test('Status: 固定模板仅接受 0/1 状态代码，任意其他数字仍是格式异常', () => {
  ['campaign_status', 'adgroup_status', 'status'].forEach(field => {
    assert.equal(api.validateField({ field, value: '0' }).length, 0);
    assert.equal(api.validateField({ field, value: '1' }).length, 0);
    assert.ok(api.validateField({ field, value: '2' }).some(issue => issue.code === 'INVALID_STATUS_CODE'));
  });
});

test('Status: Tracking URL 的合法宏仅通过格式校验，不改写原文且内容仍严格比较', () => {
  const same = api.compareField({ field: 'tracking_url_start', settingValue: 'https://tracker.invalid/?a={adid}&c={campaignid}', csvValue: 'https://tracker.invalid/?a={adid}&c={campaignid}', ruleBasis: 'strict' });
  const different = api.compareField({ field: 'tracking_url_start', settingValue: 'https://tracker.invalid/?a={adid}', csvValue: 'https://tracker.invalid/?a={campaignid}', ruleBasis: 'strict' });
  assert.equal(same.displayStatus, '一致');
  assert.equal(same.settingRawValue.includes('{adid}'), true);
  assert.equal(different.displayStatus, '不一致');
});

test('Status: 日期时间按层级校验，Ad 默认结束时间 23:59:00 合法且相同格式不同仍不一致', () => {
  const campaign = api.compareField({ field: 'campaign_start_datetime', settingValue: '2026/01/01 10:00', csvValue: '2026/01/01 10:30', ruleBasis: 'strict' });
  const adEnd = api.compareField({ field: 'end_time', settingValue: '23:59:00', csvValue: '23:59:00', ruleBasis: 'strict' });
  const invalidDate = api.compareField({ field: 'adgroup_end_datetime', settingValue: 'not-a-date', csvValue: 'not-a-date', ruleBasis: 'strict' });
  assert.equal(campaign.comparisonStatus, '不一致');
  assert.equal(campaign.validationIssues.length, 0);
  assert.equal(adEnd.displayStatus, '一致');
  assert.equal(adEnd.validationIssues.length, 0);
  assert.equal(invalidDate.displayStatus, '需确认');
  assert.ok(invalidDate.validationIssues.some(issue => issue.code === 'INVALID_DATETIME'));
});

test('Status: 只有登记的设备和素材秒数转换可为表記ゆれ一致，未登记名称变化必须需确认', () => {
  const device = api.compareField({ field: 'device', settingValue: 'SP／PC', csvValue: 'android ios pc', ruleBasis: 'TVER_260605_DEVICE_SP_PC' });
  const duration = api.compareField({ field: 'tver_video_duration', settingValue: '6秒(6-10秒)', csvValue: '6', ruleBasis: 'TVER_260605_VIDEO_DURATION_6_10' });
  const name = api.compareField({ field: 'campaign_name', settingValue: 'Example（A）', csvValue: 'example(A)', ruleBasis: null });
  assert.equal(device.comparisonStatus, '表記ゆれ一致');
  assert.equal(duration.comparisonStatus, '表記ゆれ一致');
  assert.equal(name.comparisonStatus, '需确认');
  assert.equal(name.displayStatus, '需确认');
});

test('Status: Tracking 未知宏为格式问题，buildComparisonRun 只计一次每项状态', () => {
  const unknownMacro = api.compareField({ field: 'tracking_url_complete', settingValue: 'https://tracker.invalid/?x={unknown_macro}', csvValue: 'https://tracker.invalid/?x={unknown_macro}', ruleBasis: 'strict' });
  const run = api.buildComparisonRun({ fields: [
    { field: 'budget', settingValue: '1000', csvValue: '700', ruleBasis: 'strict' },
    { field: 'campaign_name', settingValue: 'A', csvValue: '', ruleBasis: 'strict', comparisonStatus: '未匹配' },
    { field: 'campaign_name', settingValue: 'B', csvValue: '', ruleBasis: 'strict', comparisonStatus: '需确认' },
  ] });
  assert.equal(unknownMacro.displayStatus, '需确认');
  assert.ok(unknownMacro.validationIssues.some(issue => issue.code === 'UNKNOWN_TRACKING_MACRO'));
  assert.deepEqual(JSON.parse(JSON.stringify(run.statusCounts)), { '一致': 0, '表記ゆれ一致': 0, '不一致': 1, '需确认': 1, '未匹配': 1 });
});

test('Creative: 計測タグ区块以タグ訴求建立索引，保留字段来源并兼容分列标记', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'synthetic-tags.xlsx' });
  const tag = result.sourceIndex.measurementTagByAppeal['Synthetic Tag'];
  assert.equal(tag.state, 'unique');
  assert.equal(tag.tagUrl, 'https://tracker.invalid/complete?x={adid}');
  assert.equal(tag.measurementPoint, '100%');
  assert.equal(tag.sourceRefs.tagUrl.fileName, 'synthetic-tags.xlsx');
  assert.equal(tag.sourceRefs.measurementPoint.columnName, '計測地点');
});

test('Creative: 計測タグ表头零或多候选、不同标签映射重复必须诊断', () => {
  const missing = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ measurementTagHeaderMode: 'missing' }), { fileName: 'tag-missing.xlsx' });
  const multiple = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ measurementTagHeaderMode: 'multiple' }), { fileName: 'tag-multiple.xlsx' });
  const ambiguous = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ measurementTagRows: [
    { 'タグ訴求': 'Synthetic Tag', 'タグ': 'https://tracker.invalid/a', 'タグ提供元': 'Synthetic Vendor', '計測地点': '100%', '新規/流用': '新規' },
    { 'タグ訴求': 'Synthetic Tag', 'タグ': 'https://tracker.invalid/b', 'タグ提供元': 'Synthetic Vendor', '計測地点': '100%', '新規/流用': '流用' },
  ] }), { fileName: 'tag-ambiguous.xlsx' });
  assert.ok(missing.diagnostics.some(issue => issue.code === 'SETTING_MEASUREMENT_TAG_HEADER_NOT_FOUND'));
  assert.ok(multiple.diagnostics.some(issue => issue.code === 'SETTING_MEASUREMENT_TAG_HEADER_AMBIGUOUS'));
  assert.equal(ambiguous.sourceIndex.measurementTagByAppeal['Synthetic Tag'].state, 'ambiguous');
  assert.ok(ambiguous.diagnostics.some(issue => issue.code === 'SETTING_MEASUREMENT_TAG_MAPPING_AMBIGUOUS'));
});

test('Creative: 相同タグ訴求的相同计測标签不去重，完整保留全部来源', () => {
  const result = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook({ measurementTagRows: [
    { 'タグ訴求': 'Synthetic Tag', 'タグ': 'https://tracker.invalid/same', 'タグ提供元': 'Synthetic Vendor', '計測地点': '100%', '新規/流用': '新規' },
    { 'タグ訴求': 'Synthetic Tag', 'タグ': 'https://tracker.invalid/same', 'タグ提供元': 'Synthetic Vendor', '計測地点': '100%', '新規/流用': '新規' },
  ] }), { fileName: 'tag-same.xlsx' });
  const tag = result.sourceIndex.measurementTagByAppeal['Synthetic Tag'];
  assert.equal(tag.state, 'unique');
  assert.equal(tag.mappings.length, 2);
  assert.notEqual(tag.mappings[0].sourceRefs.tagUrl.rowNumber, tag.mappings[1].sourceRefs.tagUrl.rowNumber);
});

test('Creative: Creative、LP 与 100% complete Tracking 严格关联，缺失或歧义来源保守需确认', () => {
  const parsed = api.parseTverSettingWorkbook(makeStructuredSettingWorkbook(), { fileName: 'creative-link.xlsx' });
  const ad = parsed.ads[0];
  const resolved = api.resolveCreativeFields(ad, parsed.sourceIndex.creativeByMaterial, parsed.sourceIndex.measurementTagByAppeal);
  assert.equal(resolved.creative.state, 'unique');
  assert.equal(resolved.creative.fileName, 'synthetic-creative.mp4');
  assert.equal(resolved.landingPage.url, 'https://example.invalid/synthetic-lp');
  assert.equal(resolved.tracking.tracking_url_complete.state, 'unique');
  assert.equal(resolved.tracking.tracking_url_complete.value, 'https://tracker.invalid/complete?x={adid}');
  ['tracking_url_start', 'tracking_url_first_quartile', 'tracking_url_midpoint', 'tracking_url_third_quartile'].forEach(field => {
    assert.equal(resolved.tracking[field].state, 'missing');
    const compared = api.compareField({ field, settingValue: '', csvValue: '', settingSourceState: resolved.tracking[field].state, ruleBasis: 'strict' });
    assert.equal(compared.displayStatus, '需确认');
    assert.equal(compared.conservativeReason, 'SETTING_SOURCE_NOT_PROVIDED');
  });
  const missing = api.resolveCreativeFields({ fields: { materialName: 'Unknown Material', tagAppeal: 'Unknown Tag' }, sourceRefs: {} }, parsed.sourceIndex.creativeByMaterial, parsed.sourceIndex.measurementTagByAppeal);
  assert.equal(missing.creative.state, 'missing');
  assert.equal(missing.tracking.tracking_url_complete.state, 'missing');
});

test('Creative: 素材名不能代替文件名，LP 与 Tracking 的协议路径查询宏和末尾斜杠均严格比较，creative_id 仅保留 CSV 值', () => {
  const creative = api.compareField({ field: 'creative_name', settingValue: 'file.mp4', csvValue: 'material-name', ruleBasis: 'TVER_260605_AD_CREATIVE_LINK' });
  const lp = api.compareField({ field: 'url', settingValue: 'https://example.invalid/p?a=1', csvValue: 'http://example.invalid/p?a=1', ruleBasis: 'strict' });
  const tracking = api.compareField({ field: 'tracking_url_complete', settingValue: 'https://tracker.invalid/p/{adid}', csvValue: 'https://tracker.invalid/p/{adid}/', ruleBasis: 'strict' });
  const creativeId = api.compareField({ field: 'creative_id', settingValue: '', csvValue: '123', ruleBasis: null, comparisonStatus: '需确认' });
  assert.equal(creative.comparisonStatus, '不一致');
  assert.equal(lp.comparisonStatus, '不一致');
  assert.equal(tracking.comparisonStatus, '不一致');
  assert.equal(creativeId.settingRawValue, '');
  assert.equal(creativeId.csvRawValue, '123');
  assert.equal(creativeId.displayStatus, '需确认');
});

test('Conservative: edit 未提供的三个字段需确认，register 对同字段仍严格比较', () => {
  ['budget_type', 'tver_video_duration', 'dmp_segment'].forEach(field => {
    const edit = api.compareField({ field, settingValue: 'Synthetic Value', csvValue: '', schemaKind: 'edit-with-ids', ruleBasis: 'strict' });
    const register = api.compareField({ field, settingValue: 'Synthetic Value', csvValue: '', schemaKind: 'register-without-ids', ruleBasis: 'strict' });
    assert.equal(edit.displayStatus, '需确认');
    assert.equal(edit.conservativeReason, 'EDIT_CSV_FIELD_NOT_PROVIDED');
    assert.equal(register.displayStatus, '不一致');
  });
});

test('Conservative: city 与期间 FQ 仅在可证明时显示，不能推导或自动相等', () => {
  const city = api.compareField({ field: 'city', settingValue: 'Synthetic City', csvValue: 'Synthetic City', ruleBasis: 'strict' });
  const hiddenCity = api.compareField({ field: 'city', settingValue: '', csvValue: '', ruleBasis: 'strict' });
  const fq = api.compareField({ field: 'daily_freq_cap', settingValue: '3', csvValue: '', csvFieldProvided: false, isPeriodFreqCap: true, ruleBasis: 'strict' });
  const hiddenFq = api.compareField({ field: 'daily_freq_cap', settingValue: '', csvValue: '', csvFieldProvided: false, isPeriodFreqCap: true, ruleBasis: 'strict' });
  assert.equal(city.displayStatus, '需确认');
  assert.equal(city.conservativeReason, 'CITY_ID_MASTER_NOT_PROVIDED');
  assert.equal(hiddenCity.hidden, true);
  assert.equal(fq.displayStatus, '需确认');
  assert.equal(fq.conservativeReason, 'PERIOD_FQ_CSV_EVIDENCE_UNAVAILABLE');
  assert.equal(hiddenFq.hidden, true);
});

test('Conservative: Full 模式空 hourly_bid_weight 需确认，预算与 register 状态差异仍严格不一致', () => {
  const full = api.compareField({ field: 'hourly_bid_weight', settingValue: '', csvValue: '', consumptionType: '2', ruleBasis: 'strict' });
  const budget = api.compareField({ field: 'budget', settingValue: '1000', csvValue: '700', schemaKind: 'edit-with-ids', ruleBasis: 'strict' });
  const registerStatus = api.compareField({ field: 'status', settingValue: '1', csvValue: '0', schemaKind: 'register-without-ids', ruleBasis: 'strict' });
  assert.equal(full.displayStatus, '需确认');
  assert.equal(full.conservativeReason, 'FULL_MODE_HOURLY_BID_WEIGHT_UNCONFIRMED');
  assert.equal(budget.displayStatus, '不一致');
  assert.equal(registerStatus.displayStatus, '不一致');
});

test('Conservative: 无当前状态证据统一需确认，证据仅显示且白名单为空不覆盖预算', () => {
  const candidate = api.compareField({ field: 'campaign_status', settingValue: '1', csvValue: '0', schemaKind: 'edit-with-ids', currentStatusRequired: false, ruleBasis: 'strict' });
  const required = api.compareField({ field: 'campaign_status', settingValue: '1', csvValue: '0', schemaKind: 'edit-with-ids', currentStatusRequired: true, ruleBasis: 'strict' });
  const evidence = [{ rawValue: 'Synthetic free text evidence', rowNumber: 9 }];
  const budget = api.compareField({ field: 'budget', settingValue: '1000', csvValue: '700', schemaKind: 'edit-with-ids', evidence, ruleBasis: 'strict' });
  assert.equal(candidate.displayStatus, '需确认');
  assert.equal(candidate.conservativeReason, 'SETTING_CURRENT_STATUS_NOT_PROVIDED');
  assert.equal(required.displayStatus, '不一致');
  assert.equal(budget.displayStatus, '不一致');
  assert.deepEqual(JSON.parse(JSON.stringify(budget.evidence)), evidence);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getChangeOverrideWhitelist())), []);
});

function makeUiRun(schemaKind = 'edit-with-ids') {
  const run = api.buildComparisonRun({ fields: [
    { field: 'url', settingValue: 'https://example.invalid/planned', csvValue: 'https://example.invalid/downloaded', ruleBasis: 'strict' },
    { field: 'device', settingValue: 'SP／PC', csvValue: 'android ios pc', ruleBasis: 'TVER_260605_DEVICE_SP_PC' },
    { field: 'city', settingValue: 'Synthetic City', csvValue: 'Synthetic City', ruleBasis: 'strict' },
    { field: 'entity', settingValue: 'Synthetic unmatched setting', csvValue: '', ruleBasis: 'strict', comparisonStatus: '未匹配' },
  ] });
  run.entries.forEach((entry, index) => {
    entry.level = index < 2 ? 'Campaign' : 'Ad';
    entry.targetName = `Synthetic Target ${index + 1}`;
    entry.reason = index === 0 ? '値が一致しません' : entry.conservativeReason || '';
    entry.sourceRefs = {
      setting: { fileName: 'synthetic-setting.xlsx', sheetName: '配信設計', rowNumber: index + 2, columnName: 'CPN予算', rawValue: entry.settingRawValue },
      csv: { fileName: 'synthetic-download.csv', sheetName: null, rowNumber: index + 2, columnName: entry.field, rawValue: entry.csvRawValue },
    };
  });
  run.schemaKind = schemaKind;
  run.businessRole = schemaKind === 'register-without-ids'
    ? '入稿内容一致性チェック：管理画面に正しく登録済みであることを証明するものではありません。'
    : 'ダウンロード時点の管理画面の現在状態';
  return run;
}

test('A18-3C2 Red: 页面只有统一上传区、保留Schema业务角色且Level入口可见', () => {
  assert.equal(typeof api.renderTverRun, 'function');
  const html = fs.readFileSync(htmlPath, 'utf8');
  ['設定表', 'TVer 摺合せシート', 'TVer管理画面の登録／編集CSV', 'ID主データ：260605', 'ファイルは外部送信されません', 'チェック開始'].forEach(text => assert.ok(html.includes(text)));
  assert.equal((html.match(/class="upload-zone"/g) || []).length, 1);
  assert.match(html, /id="tver-file-input"[^>]*multiple/);
  ['例を表示', 'クリア', '異常をコピー', 'BOM CSV 出力'].forEach(text => assert.doesNotMatch(html, new RegExp(text)));
  ['一致', '不一致', '要確認'].forEach(text => assert.ok(html.includes(text)));
  assert.doesNotMatch(html, /\.tver-level-tabs\{[^}]*justify-content:center/);
});

test('UI: 未选择两个文件时禁止检查并显示明确提示', async () => {
  assert.equal(typeof api.runTverCheck, 'function');
  const result = await api.runTverCheck({});
  assert.equal(result.ok, false);
  assert.match(result.message, /設定表とCSV/);
});

test('UI: 未选择文件时检查按钮可显示提示但不会开始解析', () => {
  const buttons = { 'run-check': { disabled: null }, 'copy-exceptions': { disabled: null }, 'export-exceptions': { disabled: null } };
  api.updateActionButtons({ getElementById(id) { return buttons[id] || null; } });
  assert.equal(buttons['run-check'].disabled, true);
  assert.equal(buttons['copy-exceptions'].disabled, true);
  assert.equal(buttons['export-exceptions'].disabled, true);
});

test('UI: renderTverRun保留五状态统计并显示S/D原始值', () => {
  const run = makeA181BRun('ui');
  run.entries.forEach((entry, index) => {
    entry.settingRawValue = `setting-${index}`;
    entry.csvRawValue = `csv-${index}`;
  });
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' }, document: null });
  assert.equal(view.statusCounts['不一致'], 1);
  assert.equal(view.statusCounts['表記ゆれ一致'], 1);
  assert.match(view.html, /data-source-kind="setting">設定表<\/td>/);
  assert.match(view.html, /data-source-kind="csv">CSV<\/td>/);
  assert.doesNotMatch(view.html, /S: 設定表値|D: CSV値（ダウンロード）/);
  assert.doesNotMatch(view.html, /\[object Object\]/);
});

test('UI: 仅异常和层级／状态筛选只影响展示，不修改原始run', () => {
  const run = makeUiRun();
  const snapshot = JSON.stringify(run);
  const shown = api.filterTverEntries(run, { level: 'Campaign', status: 'all', abnormalOnly: true, keyword: 'planned' });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].displayStatus, '不一致');
  assert.equal(JSON.stringify(run), snapshot);
});

test('UI: clear清除文件、结果、错误和筛选状态', () => {
  assert.equal(typeof api.clearTverPage, 'function');
  const cleared = api.clearTverPage({ settingFile: { name: 'setting.xlsx' }, csvFile: { name: 'download.csv' }, run: makeUiRun(), error: 'Synthetic error', filters: { level: 'Ad', status: '不一致', abnormalOnly: true, keyword: 'x' }, objectUrl: 'blob:synthetic' }, { document: null, revokeObjectUrl() {} });
  assert.equal(cleared.settingFile, null);
  assert.equal(cleared.csvFile, null);
  assert.equal(cleared.run, null);
  assert.equal(cleared.error, '');
  assert.deepEqual(JSON.parse(JSON.stringify(cleared.filters)), { level: 'all', status: 'all', abnormalOnly: false, keyword: '' });
});

test('UI: synthetic设定表与CSV能经过完整控制器产生结果', async () => {
  const result = await api.runTverCheck({
    settingWorkbook: makeStructuredSettingWorkbook(),
    csvText: makeRegisterCsv([{ campaign_name: 'Synthetic Campaign_260201-0228_Synthetic Appeal', adgroup_name: 'Synthetic Group', creative_name: 'synthetic-creative.mp4', device: 'Synthetic Device A', price: '11', url: 'https://example.invalid/synthetic-lp' }]),
    settingFileName: 'synthetic-setting.xlsx', csvFileName: 'synthetic-register.csv', document: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.run.schemaKind, 'register-without-ids');
  assert.ok(result.run.entries.length > 0);
});

test('Export: 异常CSV以UTF-8 BOM开始并正确转义', () => {
  assert.equal(typeof api.buildExceptionCsv, 'function');
  const run = makeUiRun();
  run.entries[0].settingRawValue = 'Synthetic, "quoted"\nvalue';
  const csv = api.buildExceptionCsv(run);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Synthetic, ""quoted""\nvalue"/);
  assert.match(csv, /comparisonStatus/);
});

test('Export: register第一行明确不代表后台登记成功', () => {
  const csv = api.buildExceptionCsv(makeUiRun('register-without-ids'));
  assert.match(csv.split(/\r?\n/)[0], /管理画面に正しく登録済みであることを証明するものではありません/);
});

test('Export: 本地下载将链接连接到DOM，触发后才移除并延后释放Object URL', () => {
  assert.equal(typeof api.triggerExceptionDownload, 'function');
  const calls = [];
  const link = { click() { calls.push('click'); }, remove() { calls.push('remove'); } };
  const fakeDocument = { createElement() { return link; }, body: { appendChild(node) { assert.equal(node, link); calls.push('append'); } } };
  const fakeUrl = { createObjectURL() { calls.push('create'); return 'blob:synthetic'; }, revokeObjectURL(value) { calls.push(`revoke:${value}`); } };
  const result = api.triggerExceptionDownload('Synthetic CSV', { document: fakeDocument, BlobCtor: class { constructor(parts) { assert.equal(Array.from(parts).join(''), 'Synthetic CSV'); } }, URLApi: fakeUrl, schedule(callback, milliseconds) { calls.push(`schedule:${milliseconds}`); callback(); } });
  assert.equal(result, 'blob:synthetic');
  assert.deepEqual(calls, ['create', 'append', 'click', 'remove', 'schedule:1000', 'revoke:blob:synthetic']);
});

test('Export: 复制内容只包含当前显示的异常', async () => {
  const copied = [];
  const result = await api.copyVisibleExceptions(makeUiRun(), { filters: { level: 'Campaign', status: '不一致', abnormalOnly: true, keyword: '' }, writeText: async text => copied.push(text) });
  assert.equal(result.ok, true);
  assert.equal(copied.length, 1);
  assert.match(copied[0], /値が一致しません/);
  assert.doesNotMatch(copied[0], /SP／PC/);
});

test('Offline: 页面不存在CDN、fetch、XHR、WebSocket或外部上传', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  [/<script[^>]+src=["']https?:/i, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /<form[^>]+action=["']https?:/i].forEach(pattern => assert.doesNotMatch(html, pattern));
  assert.match(html, /<script src="xlsx\.full\.min\.js"><\/script>/);
  assert.match(html, /<script src="encoding\.min\.js"><\/script>/);
});

// ===== 任务 11：②～⑨批量真实文件验证工具（只读） =====

test('Batch summary: 输出 Schema、三层解析／匹配数、五类状态及代表性差异', () => {
  assert.equal(typeof api.summarizeValidationRun, 'function');
  const controlledRun = {
    schemaKind: 'edit-with-ids',
    businessRole: '編集CSV：ダウンロード時点の管理画面の現在状態と比較しています。',
    settingCounts: { Campaign: 2, 'Ad Group': 4, Ad: 8 },
    csvCounts: { Campaign: 2, 'Ad Group': 4, Ad: 8 },
    statusCounts: { '一致': 5, '表記ゆれ一致': 1, '不一致': 2, '需确认': 3, '未匹配': 1 },
    matching: { matches: [
      { level: 'Campaign', status: 'matched' },
      { level: 'Campaign', status: 'matched' },
      { level: 'Ad Group', status: 'unmatched' },
      { level: 'Ad', status: 'matched' },
    ] },
    entries: [
      { level: 'Campaign', targetName: 'C1', field: 'budget', comparisonStatus: '不一致', reason: 'R1' },
      { level: 'Campaign', targetName: 'C2', field: 'name', comparisonStatus: '一致', reason: '' },
      { level: 'Ad Group', targetName: 'G1', field: 'device', comparisonStatus: '需确认', reason: 'R2' },
      { level: 'Ad', targetName: 'A1', field: 'creative_name', comparisonStatus: '未匹配', reason: 'R3' },
      { level: 'Ad', targetName: 'A2', field: 'url', comparisonStatus: '表記ゆれ一致', reason: '' },
    ],
  };
  const summary = api.summarizeValidationRun(controlledRun);
  assert.equal(summary.schemaKind, 'edit-with-ids');
  assert.equal(summary.parsedCounts.setting.Campaign, 2);
  assert.equal(summary.parsedCounts.csv.Ad, 8);
  assert.equal(summary.matchedCounts.Campaign, 2);
  assert.equal(summary.matchedCounts['Ad Group'], 0);
  assert.equal(summary.matchedCounts.Ad, 1);
  assert.equal(summary.statusCounts['不一致'], 2);
  assert.equal(summary.statusCounts['需确认'], 3);
  // 仅 不一致 / 需确认 / 未匹配 进入代表性差异，且最多 3 条
  assert.equal(summary.representativeDifferences.length, 3);
  assert.deepEqual(
    summary.representativeDifferences.map(d => d.field),
    ['budget', 'device', 'creative_name'],
  );
  summary.representativeDifferences.forEach(d => {
    assert.ok('level' in d && 'targetName' in d && 'field' in d && 'comparisonStatus' in d && 'reason' in d);
  });
});

test('Batch summary: register 的业务角色明确为入稿一致性，未声称后台已登记', async () => {
  const result = await api.runTverCheck({
    settingWorkbook: makeStructuredSettingWorkbook(),
    csvText: makeRegisterCsv([{
      campaign_name: 'Synthetic Campaign_260201-0228_Synthetic Appeal',
      adgroup_name: 'Synthetic Group', creative_name: 'synthetic-creative.mp4',
      device: 'Synthetic Device A', price: '11', url: 'https://example.invalid/synthetic-lp',
    }]),
    settingFileName: 'synthetic-setting.xlsx', csvFileName: 'synthetic-register.csv', document: null,
  });
  assert.equal(result.ok, true);
  const summary = api.summarizeValidationRun(result.run);
  assert.equal(summary.schemaKind, 'register-without-ids');
  assert.match(summary.businessRole, /入稿内容の整合性/);
  assert.match(summary.businessRole, /証明するものではありません/);
});

test('Batch reader: 程序生成的最小 XLSX 经本地 SheetJS 二进制读取后可传给 parseTverSettingWorkbook', () => {
  const buffer = makeMinimalSettingWorkbookBuffer({ headerRow: 27 });
  assert.ok(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array);
  const tmp = path.join(os.tmpdir(), `tver-batch-${process.pid}-${Date.now()}.xlsx`);
  fs.writeFileSync(tmp, buffer);
  try {
    const workbook = tverVerify.readWorkbookFromPath(tmp);
    assert.ok(workbook && Array.isArray(workbook.SheetNames) && workbook.SheetNames.length >= 1);
    const verifyApi = tverVerify.getTverApi();
    assert.equal(typeof verifyApi.parseTverSettingWorkbook, 'function');
    const model = verifyApi.parseTverSettingWorkbook(workbook, { fileName: tmp });
    assert.ok(Array.isArray(model.campaigns));
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});

// ===== 阶段 A16：Compare Raw / Canonical / Evidence 基础修正 =====
function compareA16(field, settingValue, csvValue, extra = {}) {
  return api.compareField({ field, settingValue, csvValue, ruleBasis: 'TVER_A16_TEST', ...extra });
}

test('A16 Compare: Campaign 名称全角括号与＆仅作为表記ゆれ一致，保留 raw', () => {
  const result = compareA16('campaign_name', 'CP（15秒＆30秒）', 'CP(15秒&30秒)');
  assert.equal(result.comparisonStatus, '表記ゆれ一致');
  assert.equal(result.displayStatus, '表記ゆれ一致');
  assert.equal(result.settingRawValue, 'CP（15秒＆30秒）');
  assert.equal(result.csvRawValue, 'CP(15秒&30秒)');
  assert.equal(result.normalizedValues.setting, 'CP(15秒&30秒)');
});

test('A16 Compare: Creative 独立 Pre token 作为表記ゆれ一致', () => {
  const result = compareA16('creative_name', 'User_A_pre', 'User_A_Pre');
  assert.equal(result.comparisonStatus, '表記ゆれ一致');
  assert.equal(result.ruleBasis, 'TVER_A16_NAME_CANONICAL');
});

test('A16 Compare: ABC/abc、Premium 与非独立 Pre 不自动转换', () => {
  ['ABC/abc', 'Premium/premium', 'PremiumRate/premiumRate', 'ABCPre/ABCpre'].forEach(pair => {
    const [settingValue, csvValue] = pair.split('/');
    assert.equal(compareA16('campaign_name', settingValue, csvValue).comparisonStatus, '不一致');
  });
});

test('A16 Compare: 合法日期的零填充、分隔符和 :00 秒为表記ゆれ一致', () => {
  [
    ['2026/8/1 9:00', '2026/08/01 09:00'],
    ['2026/08/01 09:00', '2026-08-01 09:00'],
    ['2026/08/01 09:00:00', '2026-08-01 09:00'],
  ].forEach(([settingValue, csvValue]) => {
    const result = compareA16('start_datetime', settingValue, csvValue);
    assert.equal(result.comparisonStatus, '表記ゆれ一致');
    assert.equal(result.displayStatus, '表記ゆれ一致');
    assert.equal(result.validationIssues.length, 0);
  });
});

test('A16 Compare: 非法日期不 canonical 成一致，粒度不合法最终需确认', () => {
  const invalid = compareA16('start_datetime', '2026/02/30 09:00', '2026-02-30 09:00');
  assert.notEqual(invalid.comparisonStatus, '表記ゆれ一致');
  assert.equal(invalid.displayStatus, '需确认');
  const granularity = compareA16('end_datetime', '2026/07/01 23:45', '2026-07-01 23:45');
  assert.equal(granularity.comparisonStatus, '表記ゆれ一致');
  assert.equal(granularity.displayStatus, '需确认');
  const nonZeroSecond = compareA16('start_datetime', '2026/07/01 09:00:01', '2026-07-01 09:00:01');
  assert.equal(nonZeroSecond.displayStatus, '需确认');
  assert.ok(nonZeroSecond.validationIssues.some(issue => issue.code === 'DATETIME_SECOND_NOT_ZERO'));
});

test('A16 Compare: Campaign 金额的货币符号和千分位为表記ゆれ一致，不同金额仍不一致', () => {
  const equal = compareA16('budget', ' ¥1,000,000 ', '1000000');
  assert.equal(equal.comparisonStatus, '表記ゆれ一致');
  assert.equal(equal.normalizedValues.setting, '1000000');
  assert.equal(compareA16('daily_budget', '¥1,000,000', '1000001').comparisonStatus, '不一致');
  assert.equal(compareA16('budget', '1.5万円', '15000').comparisonStatus, '需确认');
});

test('A16 Compare: Price 仅在唯一金额时为表記ゆれ一致', () => {
  assert.equal(compareA16('price', '- ¥1,800 ¥1,800', '1800').comparisonStatus, '表記ゆれ一致');
  assert.equal(compareA16('price', '¥1,500 / ¥1,800', '1500').comparisonStatus, '需确认');
});

test('A16 Compare: Device 接收 Setting 派生 canonical 且保留说明文字 raw', () => {
  const result = compareA16('device', '- SP／PC ※OS指定ある場合はここに記入', 'android ios pc', {
    settingCanonical: { value: 'android ios pc', ruleId: 'TVER_A16_DEVICE_DERIVED', evidenceState: 'available' },
    csvCanonical: { value: 'android ios pc', ruleId: 'TVER_A16_DEVICE_CSV', evidenceState: 'available' },
  });
  assert.equal(result.comparisonStatus, '表記ゆれ一致');
  assert.equal(result.settingRawValue, '- SP／PC ※OS指定ある場合はここに記入');
  assert.equal(result.normalizedValues.setting, 'android ios pc');
});

test('A16 Compare: Device 无法唯一解析时为需确认', () => {
  const result = compareA16('device', 'SP／PC／CTV', 'android ios pc', {
    settingCanonical: { value: null, evidenceState: 'ambiguous' },
  });
  assert.equal(result.comparisonStatus, '需确认');
  assert.equal(result.conservativeReason, 'SETTING_EVIDENCE_AMBIGUOUS');
});

test('A16 Compare: 无 Setting 当前状态证据时 Register/Edit 与 CSV 值无关，均需确认', () => {
  ['', '0', '1'].forEach(csvValue => {
    ['register-without-ids', 'edit-with-ids'].forEach(schemaKind => {
      const result = compareA16('campaign_status', '', csvValue, {
        schemaKind, currentStatusRequired: false, settingEvidenceState: 'not_provided',
      });
      assert.equal(result.comparisonStatus, '需确认');
      assert.equal(result.displayStatus, '需确认');
      assert.equal(result.conservativeReason, 'SETTING_CURRENT_STATUS_NOT_PROVIDED');
    });
  });
});

test('A16 Compare: not_provided、unavailable、ambiguous 不得作为空值一致', () => {
  [
    ['not_provided', 'SETTING_EVIDENCE_NOT_PROVIDED'],
    ['unavailable', 'SETTING_EVIDENCE_UNAVAILABLE'],
    ['ambiguous', 'SETTING_EVIDENCE_AMBIGUOUS'],
  ].forEach(([settingEvidenceState, reason]) => {
    const result = compareA16('budget', '', '', { settingEvidenceState });
    assert.equal(result.comparisonStatus, '需确认');
    assert.equal(result.displayStatus, '需确认');
    assert.equal(result.conservativeReason, reason);
  });
});

test('A16 Compare: 结果保留日文显示名称、Entity Key 与 canonical 元数据', () => {
  const result = api.buildComparisonRun({ fields: [{
    field: 'campaign_name', settingValue: 'CP（A）', csvValue: 'CP(A)',
    entityKey: 'setting-campaign-1', csvEntityKey: 'csv-campaign-1', ruleBasis: 'strict',
  }] }).entries[0];
  assert.equal(result.fieldLabel, 'キャンペーン名');
  assert.equal(result.entityKey, 'setting-campaign-1');
  assert.equal(result.csvEntityKey, 'csv-campaign-1');
  assert.deepEqual(JSON.parse(JSON.stringify(result.canonicalValues)), { setting: 'CP(A)', csv: 'CP(A)' });
  assert.equal(result.alwaysDisplay, true);
});

test('A16 Compare: matcher 既有 Pre 规则与唯一候选结论保持不变', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp', level: 'Campaign', expectedName: 'CP', fields: {} }],
    adGroups: [{ key: 's-adg', level: 'Ad Group', parentKey: 's-cp', expectedName: 'ADG', fields: {} }],
    ads: [{ key: 's-ad', level: 'Ad', parentKey: 's-adg', expectedName: 'User_A_pre', fields: {} }], diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp', level: 'Campaign', fields: { campaign_name: 'CP' } }],
    adGroups: [{ key: 'c-adg', level: 'Ad Group', parentKey: 'c-cp', fields: { adgroup_name: 'ADG' } }],
    ads: [{ key: 'c-ad', level: 'Ad', parentKey: 'c-adg', fields: { creative_name: 'User_A_Pre' } }], orphans: [],
  };
  const matching = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() });
  assert.deepEqual(JSON.parse(JSON.stringify(matching.matches.filter(match => match.level === 'Ad').map(match => ({ level: match.level, status: match.status, reasonCode: match.reasonCode })))), [{ level: 'Ad', status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE' }]);
});

// ===== A17-3A Red：Register 视频秒数与 DMP Compare（仅测试契约） =====

function makeA173Source(columnName, rawValue, rowNumber = 2) {
  return { fileName: 'a173-setting.xlsx', sheetName: '設定', rowNumber, columnName, rawValue: String(rawValue ?? '') };
}

function makeA173AdGroup({ durationValues = [], dmpSources = [], adgroupName = '' } = {}) {
  const durationEvidence = durationValues.map((rawValue, index) => makeA173Source('広告再生時間●', rawValue, index + 2));
  const rawRows = durationValues.map((rawValue, index) => ({
    values: { tver_video_duration: String(rawValue ?? '') },
    sourceRefs: { tver_video_duration: makeA173Source('tver_video_duration', rawValue, index + 2) },
  }));
  return {
    key: 'a173-setting-adgroup', level: 'Ad Group', fields: { adgroupName, targeting: {} }, rawRows,
    sourceEvidence: { fields: { tver_video_duration: durationEvidence }, targeting: { 'DMPセグメント': dmpSources } },
  };
}

function makeA173RealSource(rawValue, rowNumber = 66) {
  return {
    fileName: 'real-structure-setting.xlsx', sheetName: '2608_Set 500 Re-hit', rowNumber,
    columnName: 'DMPセグメント', rawValue,
  };
}

function makeA173RealAdGroup({ key = 'real-structure-adgroup', dmpValues = [] } = {}) {
  const fieldsSources = dmpValues.map(rawValue => makeA173RealSource(rawValue));
  const targetingSources = fieldsSources.map(source => ({ ...source }));
  return {
    key, level: 'Ad Group', fields: { adgroupName: key, targeting: {} }, rawRows: [],
    sourceEvidence: {
      fields: { segment: fieldsSources },
      targeting: { 'DMPセグメント': targetingSources },
    },
  };
}

function resolveA173(entity, field) {
  assert.equal(typeof api.resolveSettingOperationalTargetingForComparison, 'function');
  return api.resolveSettingOperationalTargetingForComparison(entity, field);
}

async function runA173Register({ settingDuration = '', csvDuration = '', settingDmp = '', csvDmp = '' } = {}) {
  const settingWorkbook = makeStructuredSettingWorkbook({
    targetingBatches: [[{
      number: 'TG-01', device: 'Synthetic Device A', media: 'Synthetic Media A', price: '11',
      duration: settingDuration, segment: settingDmp,
    }]],
  });
  const csvText = makeRegisterCsv([{
    campaign_name: 'Synthetic Campaign_260201-0228_Synthetic Appeal', adgroup_name: 'Synthetic Group',
    creative_name: 'synthetic-creative.mp4', device: 'Synthetic Device A', price: '11',
    url: 'https://example.invalid/synthetic-lp', tver_video_duration: csvDuration, dmp_segment: csvDmp,
  }]);
  return api.runTverCheck({
    settingWorkbook, csvText, settingFileName: 'a173-setting.xlsx', csvFileName: 'a173-register.csv', document: null,
  });
}

test('A17-3A Red: 视频 15 秒格式按 parseTverVideoDuration 规范为 15', () => {
  const result = resolveA173(makeA173AdGroup({ durationValues: ['15秒(11-22秒)'] }), 'tver_video_duration');
  assert.equal(result.rawValue, '15秒(11-22秒)');
  assert.equal(result.canonicalValue, '15');
  assert.equal(result.comparable, true);
  assert.equal(result.evidenceState, 'available');
});

test('A17-3A Red: 视频 30 秒格式按 parseTverVideoDuration 规范为 30', () => {
  const result = resolveA173(makeA173AdGroup({ durationValues: ['30秒(23-37秒)'] }), 'tver_video_duration');
  assert.equal(result.canonicalValue, '30');
});

test('A17-3A Red: 视频 60 秒格式按 parseTverVideoDuration 规范为 60', () => {
  const result = resolveA173(makeA173AdGroup({ durationValues: ['60秒(53-60秒)'] }), 'tver_video_duration');
  assert.equal(result.canonicalValue, '60');
});

test('A17-3A Red: 视频 raw 不同但 canonical 相同生成表記ゆれ一致', async () => {
  const result = await runA173Register({ settingDuration: '15秒(11-22秒)', csvDuration: '15' });
  assert.equal(result.ok, true);
  const entry = result.run.entries.find(item => item.level === 'Ad Group' && item.field === 'tver_video_duration');
  assert.ok(entry, 'Register Ad Group 必须生成 tver_video_duration Compare');
  assert.equal(entry.comparisonStatus, '表記ゆれ一致');
  assert.equal(entry.settingRawValue, '15秒(11-22秒)');
  assert.equal(entry.csvRawValue, '15');
});

test('A17-3A Red: 视频 "-" 保留 evidence 但不得成为 primarySource', () => {
  const placeholder = makeA173Source('広告再生時間●', '-');
  const actual = makeA173Source('広告再生時間●', '15秒(11-22秒)', 3);
  const result = resolveA173(makeA173AdGroup({ durationValues: ['-', '15秒(11-22秒)'] }), 'tver_video_duration');
  assert.equal(result.primarySource.rawValue, '15秒(11-22秒)');
  assert.deepEqual(JSON.parse(JSON.stringify(result.sourceEvidence.map(source => source.rawValue))), ['-', '15秒(11-22秒)']);
  assert.ok(result.derivedFrom.some(source => source.rawValue === actual.rawValue));
  assert.notEqual(result.primarySource.rawValue, placeholder.rawValue);
});

test('A17-3A Red: 多个不同有效视频秒数为 ambiguous 且不选第一项', () => {
  const result = resolveA173(makeA173AdGroup({ durationValues: ['15秒(11-22秒)', '30秒(23-37秒)'] }), 'tver_video_duration');
  assert.equal(result.evidenceState, 'ambiguous');
  assert.equal(result.canonicalValue, null);
  assert.equal(result.comparable, false);
  assert.equal(result.shouldGenerate, true);
});

test('A17-3A Red: Register DMP 纯数字 68 以明确数字来源作为 primarySource', () => {
  const sources = [makeA173Source('DMPセグメント', '-'), makeA173Source('DMPセグメント', '68', 3)];
  const result = resolveA173(makeA173AdGroup({ dmpSources: sources }), 'dmp_segment');
  assert.equal(result.rawValue, '68');
  assert.equal(result.canonicalValue, '68');
  assert.equal(result.primarySource.rawValue, '68');
  assert.equal(result.comparable, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.sourceEvidence.map(source => source.rawValue))), ['-', '68']);
});

test('A17-3A Red: 案件名含 _DMP_ 时不推导 dmp_segment 数字 ID', () => {
  const result = resolveA173(makeA173AdGroup({ adgroupName: 'Synthetic_DMP_68', dmpSources: [] }), 'dmp_segment');
  assert.equal(result.canonicalValue, null);
  assert.equal(result.primarySource, null);
  assert.equal(result.shouldGenerate, false);
});

test('A17-3A Red: 多个不同 DMP ID 为 ambiguous 且不取首个 ID', () => {
  const result = resolveA173(makeA173AdGroup({ dmpSources: [
    makeA173Source('DMPセグメント', '68'), makeA173Source('DMPセグメント', '69', 3),
  ] }), 'dmp_segment');
  assert.equal(result.evidenceState, 'ambiguous');
  assert.equal(result.canonicalValue, null);
  assert.equal(result.comparable, false);
  assert.equal(result.shouldGenerate, true);
});

test('A17-3A Red: Register 视频与 DMP 双方空值不生成 Compare entry', async () => {
  const result = await runA173Register();
  assert.equal(result.ok, true);
  assert.equal(result.run.entries.some(item => ['tver_video_duration', 'dmp_segment'].includes(item.field)), false);
});

test('A17-3A Red: Edit 不生成视频或 DMP Compare', async () => {
  const settingWorkbook = makeStructuredSettingWorkbook();
  const csvText = makeEditCsv([{
    campaign_id: '101', adgroup_id: '201', ad_id: '301', campaign_name: 'Synthetic Campaign',
    adgroup_name: 'Synthetic Group', creative_name: 'synthetic-creative.mp4', device: 'Synthetic Device A',
    price: '11', url: 'https://example.invalid/synthetic-lp', dmp_segment: '68',
  }]);
  const result = await api.runTverCheck({ settingWorkbook, csvText, settingFileName: 'a173-edit-setting.xlsx', csvFileName: 'a173-edit.csv', document: null });
  assert.equal(result.ok, true);
  assert.equal(result.run.entries.some(item => ['tver_video_duration', 'dmp_segment'].includes(item.field)), false);
});

test('A17-3A Red: Register DMP 68 与 CSV 68 生成为一致', async () => {
  const result = await runA173Register({ settingDmp: '68', csvDmp: '68' });
  assert.equal(result.ok, true);
  const entry = result.run.entries.find(item => item.level === 'Ad Group' && item.field === 'dmp_segment');
  assert.ok(entry, 'Register Ad Group 必须生成 dmp_segment Compare');
  assert.equal(entry.comparisonStatus, '一致');
  assert.equal(entry.canonicalValues.setting, '68');
  assert.equal(entry.canonicalValues.csv, '68');
});

test('A17-3A-DMP-R2 Red: 68 被 IM、年龄说明与 ADG 说明包围时仍选唯一业务 ID', () => {
  const rawValues = ['IM', '「男性」and「20-34歳」', '68', 'ADGをSPPC/CTVで分ける'];
  const result = resolveA173(makeA173RealAdGroup({ dmpValues: rawValues }), 'dmp_segment');
  assert.equal(result.canonicalValue, '68');
  assert.equal(result.evidenceState, 'available');
  assert.equal(result.comparable, true);
  assert.equal(result.primarySource.rawValue, '68');
  assert.equal(result.shouldGenerate, true);
  assert.deepEqual(result.sourceEvidence.map(source => source.rawValue), rawValues);
  assert.deepEqual(result.derivedFrom.map(source => source.rawValue), rawValues);
  assert.notEqual(result.evidenceState, 'ambiguous');
});

test('A17-3A-DMP-R2 Red: 仅模板文本保留 Evidence/derivedFrom 但不生成业务候选', () => {
  const rawValues = ['※セグメント名', '※セグメントID', 'ADGをSPPC/CTVで分ける'];
  const result = resolveA173(makeA173RealAdGroup({ dmpValues: rawValues }), 'dmp_segment');
  assert.equal(result.shouldGenerate, false);
  assert.equal(result.primarySource, null);
  assert.equal(result.canonicalValue, null);
  assert.deepEqual(result.sourceEvidence.map(source => source.rawValue), rawValues);
  assert.deepEqual(result.derivedFrom.map(source => source.rawValue), rawValues);
});

test('A17-3A-DMP-R2 Red: Setting 模板来源与 CSV 空值不生成 dmp_segment entry', async () => {
  const result = await runA173Register({
    settingDmp: '※セグメント名 ※セグメントID ADGをSPPC/CTVで分ける', csvDmp: '',
  });
  assert.equal(result.ok, true);
  assert.equal(result.run.entries.some(item => item.field === 'dmp_segment'), false);
});

test('A17-3A-DMP-R2 Red: fields.segment 与 targeting DMP 别名同源时不重复计数且选 68', () => {
  const rawValues = ['IM', '「男性」and「20-34歳」', '68', 'ADGをSPPC/CTVで分ける'];
  const result = resolveA173(makeA173RealAdGroup({ dmpValues: rawValues }), 'dmp_segment');
  assert.equal(result.sourceEvidence.length, 4);
  assert.equal(new Set(result.sourceEvidence.map(source => `${source.fileName}|${source.sheetName}|${source.rowNumber}|${source.columnName}|${source.rawValue}`)).size, 4);
  assert.equal(result.canonicalValue, '68');
  assert.equal(result.primarySource.rawValue, '68');
  assert.equal(result.evidenceState, 'available');
  assert.equal(result.comparable, true);
  assert.notEqual(result.evidenceState, 'ambiguous');
});

test('A17-3A-DMP-R2 Red: 不同 ADG 的 DMP evidence 候选相互独立', () => {
  const first = makeA173RealAdGroup({ key: 'real-adgroup-68', dmpValues: ['IM', '68'] });
  const second = makeA173RealAdGroup({ key: 'real-adgroup-69', dmpValues: ['69'] });
  const firstResult = resolveA173(first, 'dmp_segment');
  const secondResult = resolveA173(second, 'dmp_segment');
  assert.notStrictEqual(first.sourceEvidence.fields.segment, second.sourceEvidence.fields.segment);
  assert.equal(firstResult.canonicalValue, '68');
  assert.equal(firstResult.primarySource.rawValue, '68');
  assert.equal(secondResult.canonicalValue, '69');
  assert.equal(secondResult.primarySource.rawValue, '69');
  assert.deepEqual(firstResult.sourceEvidence.map(source => source.rawValue), ['IM', '68']);
  assert.equal(firstResult.sourceEvidence.some(source => source.rawValue === '69'), false);
});

// ===== A17-3B Red：Register store_segment / bid_segment Compare（仅测试契约） =====

function makeA173RetargetSource(columnName, rawValue, rowNumber = 48, fileName = 'a173-retarget-setting.xlsx') {
  return {
    fileName, sheetName: '2608-09', rowNumber, columnName,
    rawValue: String(rawValue ?? ''),
  };
}

function makeA173RetargetAdGroup({
  key = 'a173-retarget-adgroup', dataValues = [], bidValues = [],
  dataRow = 48, bidRow = 59, fileName = 'a173-retarget-setting.xlsx',
} = {}) {
  const dataSources = dataValues.map(raw => makeA173RetargetSource('データ蓄積', raw, dataRow, fileName));
  const bidSources = bidValues.map(raw => makeA173RetargetSource('入札セグメント', raw, bidRow, fileName));
  const dataRaw = dataValues.join(' ');
  const bidRaw = bidValues.join(' ');
  return {
    key, level: 'Ad Group',
    fields: { adgroupName: key, targeting: { dataAccumulation: dataRaw, bidSegment: bidRaw } },
    rawRows: [],
    sourceEvidence: {
      fields: {
        dataAccumulation: dataSources,
        bidSegment: bidSources,
      },
      targeting: {
        'データ蓄積': dataSources.map(source => ({ ...source })),
        '入札セグメント': bidSources.map(source => ({ ...source })),
      },
    },
  };
}

function resolveA173Retarget(entity, field) {
  assert.equal(typeof api.resolveSettingOperationalTargetingForComparison, 'function');
  return api.resolveSettingOperationalTargetingForComparison(entity, field);
}

function makeA173RetargetRegisterRun() {
  const rows = [
    { adgroup_name: 'Retarget Store 6543 A', creative_name: 'retarget-store-6543-a.mp4', store_segment: '6543', bid_segment: '' },
    { adgroup_name: 'Retarget Store 6543 B', creative_name: 'retarget-store-6543-b.mp4', store_segment: '6543', bid_segment: '' },
    { adgroup_name: 'Retarget Bid 6543 A', creative_name: 'retarget-bid-6543-a.mp4', store_segment: '', bid_segment: '6543' },
    { adgroup_name: 'Retarget Bid 6543 B', creative_name: 'retarget-bid-6543-b.mp4', store_segment: '', bid_segment: '6543' },
    { adgroup_name: 'Retarget Store 6544 A', creative_name: 'retarget-store-6544-a.mp4', store_segment: '6544', bid_segment: '' },
    { adgroup_name: 'Retarget Store 6544 B', creative_name: 'retarget-store-6544-b.mp4', store_segment: '6544', bid_segment: '' },
    { adgroup_name: 'Retarget Bid 6544 A', creative_name: 'retarget-bid-6544-a.mp4', store_segment: '', bid_segment: '6544' },
    { adgroup_name: 'Retarget Bid 6544 B', creative_name: 'retarget-bid-6544-b.mp4', store_segment: '', bid_segment: '6544' },
  ].map(row => ({
    campaign_name: 'Synthetic Retarget Campaign_260801-0831',
    start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 23:30',
    budget: '900', daily_budget: '30', device: 'ctv', price: '11',
    url: 'https://example.invalid/retarget-lp', ...row,
  }));
  const parsed = api.parseCsvText(makeRegisterCsv(rows), { fileName: 'a173-retarget-register.csv' });
  const tree = api.buildRegisterTree(parsed);
  const campaignKey = 'a173-retarget-setting-campaign';
  const settingCampaign = {
    key: campaignKey, level: 'Campaign', expectedName: 'Synthetic Retarget Campaign_260801-0831',
    fields: {
      campaignName: 'Synthetic Retarget Campaign', startDateTime: '2026/08/01 10:00',
      endDateTime: '2026/08/31 23:30', campaignBudget: '900', initialDailyBudget: '30',
    }, sourceEvidence: { fields: {}, derived: {} },
  };
  const settingKeyByCsvKey = new Map();
  const settingAdGroups = tree.adGroups.map((csvAdGroup, index) => {
    const settingKey = `a173-retarget-setting-adgroup-${index + 1}`;
    settingKeyByCsvKey.set(csvAdGroup.key, settingKey);
    const isStore = index === 0 || index === 1 || index === 4 || index === 5;
    const id = index < 4 ? '6543' : '6544';
    const dataValues = isStore ? ['○', index < 4 ? '2608_シナリオ_メルカリ_汎用' : '2608_シナリオ_メルカリ_佐久間ファン用', id] : ['※セグメント名', '※セグメントID'];
    const bidValues = isStore ? ['※セグメント名', '※セグメントID'] : ['○', index < 4 ? '2608_シナリオ_メルカリ_汎用' : '2608_シナリオ_メルカリ_佐久間ファン用', id];
    const sourceGroup = makeA173RetargetAdGroup({
      key: settingKey, dataValues, bidValues,
      dataRow: index < 4 ? 48 : 73, bidRow: index < 4 ? 59 : 84,
      fileName: 'a173-retarget-setting.xlsx',
    });
    return { ...sourceGroup, parentKey: campaignKey, expectedName: csvAdGroup.fields.adGroupName, fields: {
      ...sourceGroup.fields, device: csvAdGroup.fields.device, price: csvAdGroup.fields.price,
    } };
  });
  const settingAdGroupByCsvKey = new Map(tree.adGroups.map((csvAdGroup, index) => [csvAdGroup.key, settingAdGroups[index]]));
  const settingAds = tree.ads.map((csvAd, index) => ({
    key: `a173-retarget-setting-ad-${index + 1}`, level: 'Ad',
    parentKey: settingKeyByCsvKey.get(csvAd.parentKey), expectedName: csvAd.fields.creativeName,
    fields: { creativeName: csvAd.fields.creativeName }, sourceEvidence: { fields: {}, derived: {} },
  }));
  const matches = [
    { status: 'matched', level: 'Campaign', settingKey: campaignKey, csvKey: tree.campaigns[0].key, reasonCode: 'TEST_MATCH' },
    ...tree.adGroups.map(csvAdGroup => ({
      status: 'matched', level: 'Ad Group', settingKey: settingKeyByCsvKey.get(csvAdGroup.key), csvKey: csvAdGroup.key, reasonCode: 'TEST_MATCH',
    })),
    ...tree.ads.map((csvAd, index) => ({
      status: 'matched', level: 'Ad', settingKey: settingAds[index].key, csvKey: csvAd.key, reasonCode: 'TEST_MATCH',
    })),
  ];
  // Keep this test setup on the public buildRunFromModels boundary; the retarget
  // implementation must consume sourceEvidence/rawRows and must not need matcher internals.
  return api.buildRunFromModels(
    { campaigns: [settingCampaign], adGroups: settingAdGroups, ads: settingAds, diagnostics: [] },
    tree,
    { matches, unmatched: { csv: [] }, unassigned: { csv: [] }, orphans: [], diagnostics: [] },
    parsed,
  );
}

function makeA173RetargetEditRun({ empty = false } = {}) {
  const definitions = empty ? [
    { adgroupId: '41490', adId: '51490', adgroupName: 'Retarget Empty', creativeName: 'retarget-empty.mp4', store: '', bid: '' },
  ] : [
    { adgroupId: '41479', adId: '51479', adgroupName: 'Retarget Store 6543 A', creativeName: 'retarget-store-6543-a.mp4', store: '6543', bid: '' },
    { adgroupId: '41480', adId: '51480', adgroupName: 'Retarget Store 6543 B', creativeName: 'retarget-store-6543-b.mp4', store: '6543', bid: '' },
    { adgroupId: '41481', adId: '51481', adgroupName: 'Retarget Bid 6543 A', creativeName: 'retarget-bid-6543-a.mp4', store: '', bid: '6543' },
    { adgroupId: '41482', adId: '51482', adgroupName: 'Retarget Bid 6543 B', creativeName: 'retarget-bid-6543-b.mp4', store: '', bid: '6543' },
    { adgroupId: '41483', adId: '51483', adgroupName: 'Retarget Store 6544 A', creativeName: 'retarget-store-6544-a.mp4', store: '6544', bid: '' },
    { adgroupId: '41484', adId: '51484', adgroupName: 'Retarget Store 6544 B', creativeName: 'retarget-store-6544-b.mp4', store: '6544', bid: '' },
    { adgroupId: '41485', adId: '51485', adgroupName: 'Retarget Bid 6544 A', creativeName: 'retarget-bid-6544-a.mp4', store: '', bid: '6544' },
    { adgroupId: '41486', adId: '51486', adgroupName: 'Retarget Bid 6544 B', creativeName: 'retarget-bid-6544-b.mp4', store: '', bid: '6544' },
  ];
  const rows = definitions.map((definition, index) => ({
    campaign_id: '1001', adgroup_id: definition.adgroupId, ad_id: definition.adId,
    campaign_name: 'Synthetic Retarget Campaign_260801-0831',
    start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 23:30',
    budget: '900', daily_budget: '30', device: 'ctv', price: '11',
    adgroup_name: definition.adgroupName, creative_name: definition.creativeName,
    url: 'https://example.invalid/retarget-lp',
    store_segment: definition.store, bid_segment: definition.bid,
    status: '1', row_index: String(index + 2),
  }));
  const parsed = api.parseCsvText(makeEditCsv(rows), { fileName: 'a173-retarget-edit.csv' });
  const tree = api.buildEditTree(parsed);
  const campaignKey = 'a173-retarget-edit-setting-campaign';
  const settingCampaign = {
    key: campaignKey, level: 'Campaign', expectedName: 'Synthetic Retarget Campaign_260801-0831',
    fields: {
      campaignName: 'Synthetic Retarget Campaign', startDateTime: '2026/08/01 10:00',
      endDateTime: '2026/08/31 23:30', campaignBudget: '900', initialDailyBudget: '30',
    }, sourceEvidence: { fields: {}, derived: {} },
  };
  const settingKeyByCsvKey = new Map();
  const settingAdGroups = tree.adGroups.map((csvAdGroup, index) => {
    const definition = definitions[index];
    const settingKey = `a173-retarget-edit-setting-adgroup-${index + 1}`;
    settingKeyByCsvKey.set(csvAdGroup.key, settingKey);
    const isStore = definition.store !== '';
    const id = definition.store || definition.bid;
    const dataValues = isStore ? ['○', '2608_シナリオ_メルカリ_汎用', id] : ['※セグメント名', '※セグメントID'];
    const bidValues = isStore ? ['※セグメント名', '※セグメントID'] : ['○', '2608_シナリオ_メルカリ_汎用', id];
    const sourceGroup = makeA173RetargetAdGroup({
      key: settingKey, dataValues, bidValues,
      dataRow: empty ? 48 : (index < 4 ? 48 : 73), bidRow: empty ? 59 : (index < 4 ? 59 : 84),
      fileName: 'a173-retarget-edit-setting.xlsx',
    });
    return {
      ...sourceGroup, parentKey: campaignKey, expectedName: csvAdGroup.fields.adGroupName,
      fields: {
        ...sourceGroup.fields, device: csvAdGroup.fields.device, price: csvAdGroup.fields.price,
        retargetKind: isStore ? 'store' : 'bid', retargetSegmentId: id || '999999',
      },
    };
  });
  const settingAds = tree.ads.map((csvAd, index) => ({
    key: `a173-retarget-edit-setting-ad-${index + 1}`, level: 'Ad',
    parentKey: settingKeyByCsvKey.get(csvAd.parentKey), expectedName: csvAd.fields.creativeName,
    fields: { creativeName: csvAd.fields.creativeName }, sourceEvidence: { fields: {}, derived: {} },
  }));
  const matches = [
    { status: 'matched', level: 'Campaign', settingKey: campaignKey, csvKey: tree.campaigns[0].key, reasonCode: 'TEST_MATCH' },
    ...tree.adGroups.map((csvAdGroup, index) => ({
      status: 'matched', level: 'Ad Group', settingKey: settingAdGroups[index].key, csvKey: csvAdGroup.key, reasonCode: 'TEST_MATCH',
    })),
    ...tree.ads.map((csvAd, index) => ({
      status: 'matched', level: 'Ad', settingKey: settingAds[index].key, csvKey: csvAd.key, reasonCode: 'TEST_MATCH',
    })),
  ];
  return api.buildRunFromModels(
    { campaigns: [settingCampaign], adGroups: settingAdGroups, ads: settingAds, diagnostics: [] },
    tree,
    { matches, unmatched: { csv: [] }, unassigned: { csv: [] }, orphans: [], diagnostics: [] },
    parsed,
  );
}

function makeA173SchemaNoticeSource(columnName, rawValue, rowNumber, fileName = 'a173-schema-notice-setting.xlsx') {
  return {
    fileName, sheetName: '2608-09', rowNumber, columnName,
    rawValue: String(rawValue ?? ''),
  };
}

function makeA173SchemaNoticeRun({ schema = 'edit-with-ids', definitions = [] } = {}) {
  const isEdit = schema === 'edit-with-ids';
  const rows = definitions.map((definition, index) => ({
    campaign_name: 'Synthetic Schema Notice Campaign_260801-0831',
    start_datetime: '2026/08/01 10:00', end_datetime: '2026/08/31 23:30',
    budget: '900', daily_budget: '30', device: 'ctv', price: '11',
    adgroup_name: definition.adgroupName || `Schema Notice ADG ${definition.adgroupId}`,
    creative_name: definition.creativeName || `schema-notice-${definition.adgroupId}.mp4`,
    url: 'https://example.invalid/schema-notice-lp',
    store_segment: definition.store || '', bid_segment: definition.bid || '',
    tver_video_duration: definition.videoCsv || '', dmp_segment: definition.dmpCsv || '',
    status: '1',
    ...(isEdit ? {
      campaign_id: '2001', adgroup_id: definition.adgroupId, ad_id: definition.adId || `5${definition.adgroupId}`,
    } : {}),
    row_index: String(index + 2),
  }));
  const parsed = api.parseCsvText(
    isEdit ? makeEditCsv(rows) : makeRegisterCsv(rows),
    { fileName: `a173-schema-notice-${isEdit ? 'edit' : 'register'}.csv` },
  );
  const tree = isEdit ? api.buildEditTree(parsed) : api.buildRegisterTree(parsed);
  const campaignKey = 'a173-schema-notice-setting-campaign';
  const settingCampaign = {
    key: campaignKey, level: 'Campaign', expectedName: 'Synthetic Schema Notice Campaign_260801-0831',
    fields: {
      campaignName: 'Synthetic Schema Notice Campaign', startDateTime: '2026/08/01 10:00',
      endDateTime: '2026/08/31 23:30', campaignBudget: '900', initialDailyBudget: '30',
    }, sourceEvidence: { fields: {}, derived: {} },
  };
  const settingKeyByCsvKey = new Map();
  const settingAdGroups = tree.adGroups.map((csvAdGroup, index) => {
    const definition = definitions[index];
    const settingKey = `a173-schema-notice-setting-adgroup-${index + 1}`;
    settingKeyByCsvKey.set(csvAdGroup.key, settingKey);
    const dataValues = definition.store
      ? ['○', '2608_シナリオ_メルカリ_汎用', definition.store]
      : ['※セグメント名', '※セグメントID'];
    const bidValues = definition.bid
      ? ['○', '2608_シナリオ_メルカリ_汎用', definition.bid]
      : ['※セグメント名', '※セグメントID'];
    const dataSources = dataValues.map((raw, valueIndex) => makeA173SchemaNoticeSource(
      'データ蓄積', raw, definition.dataRow || 48, 'a173-schema-notice-setting.xlsx',
    ));
    const bidSources = bidValues.map((raw, valueIndex) => makeA173SchemaNoticeSource(
      '入札セグメント', raw, definition.bidRow || 59, 'a173-schema-notice-setting.xlsx',
    ));
    const videoValues = definition.videoValues || [];
    const dmpValues = definition.dmpValues || [];
    const videoSources = videoValues.map(raw => makeA173SchemaNoticeSource(
      '広告再生時間●', raw, definition.videoRow || 48, 'a173-schema-notice-setting.xlsx',
    ));
    const dmpSources = dmpValues.map(raw => makeA173SchemaNoticeSource(
      'DMPセグメント', raw, definition.dmpRow || 48, 'a173-schema-notice-setting.xlsx',
    ));
    const targeting = {
      'データ蓄積': dataSources.map(source => ({ ...source })),
      '入札セグメント': bidSources.map(source => ({ ...source })),
    };
    if (videoSources.length) targeting['広告再生時間●'] = videoSources.map(source => ({ ...source }));
    if (dmpSources.length) targeting.DMPセグメント = dmpSources.map(source => ({ ...source }));
    return {
      key: settingKey, level: 'Ad Group', parentKey: campaignKey,
      expectedName: csvAdGroup.fields.adGroupName,
      fields: {
        adgroupName: csvAdGroup.fields.adGroupName, device: csvAdGroup.fields.device, price: csvAdGroup.fields.price,
        targeting: { dataAccumulation: dataValues.join(' '), bidSegment: bidValues.join(' ') },
        videoDuration: videoValues.join(' '), segment: dmpValues.join(' '),
        retargetKind: definition.store ? 'store' : definition.bid ? 'bid' : '',
        retargetSegmentId: definition.store || definition.bid || '',
      },
      sourceEvidence: {
        fields: {
          dataAccumulation: dataSources, bidSegment: bidSources,
          ...(videoSources.length ? { videoDuration: videoSources } : {}),
          ...(dmpSources.length ? { segment: dmpSources } : {}),
        },
        targeting, derived: {},
      },
    };
  });
  const settingAds = tree.ads.map((csvAd, index) => ({
    key: `a173-schema-notice-setting-ad-${index + 1}`, level: 'Ad',
    parentKey: settingKeyByCsvKey.get(csvAd.parentKey), expectedName: csvAd.fields.creativeName,
    fields: { creativeName: csvAd.fields.creativeName }, sourceEvidence: { fields: {}, derived: {} },
  }));
  const matches = [
    { status: 'matched', level: 'Campaign', settingKey: campaignKey, csvKey: tree.campaigns[0].key, reasonCode: 'TEST_MATCH' },
    ...tree.adGroups.map((csvAdGroup, index) => ({
      status: 'matched', level: 'Ad Group', settingKey: settingAdGroups[index].key,
      csvKey: csvAdGroup.key, reasonCode: 'TEST_MATCH',
    })),
    ...tree.ads.map((csvAd, index) => ({
      status: 'matched', level: 'Ad', settingKey: settingAds[index].key,
      csvKey: csvAd.key, reasonCode: 'TEST_MATCH',
    })),
  ];
  return api.buildRunFromModels(
    { campaigns: [settingCampaign], adGroups: settingAdGroups, ads: settingAds, diagnostics: [] },
    tree,
    { matches, unmatched: { csv: [] }, unassigned: { csv: [] }, orphans: [], diagnostics: [] },
    parsed,
  );
}

test('A17-3B Red: データ蓄積の○・segment name・6543はstore_segmentだけに解析し数字をprimaryにする', () => {
  const sourceValues = ['○', '2608_シナリオ_メルカリ_汎用', '6543'];
  const result = resolveA173Retarget(makeA173RetargetAdGroup({ dataValues: sourceValues }), 'store_segment');
  assert.equal(result.rawValue, '6543');
  assert.equal(result.canonicalValue, '6543');
  assert.equal(result.primarySource.rawValue, '6543');
  assert.equal(result.evidenceState, 'available');
  assert.equal(result.comparable, true);
  assert.equal(result.shouldGenerate, true);
  assert.deepEqual(result.sourceEvidence.map(source => source.rawValue), sourceValues);
  assert.deepEqual(result.derivedFrom.map(source => source.rawValue), sourceValues);
});

test('A17-3B Red: 入札セグメントの○・segment name・6543はbid_segmentだけに解析し数字をprimaryにする', () => {
  const sourceValues = ['○', '2608_シナリオ_メルカリ_汎用', '6543'];
  const result = resolveA173Retarget(makeA173RetargetAdGroup({ bidValues: sourceValues }), 'bid_segment');
  assert.equal(result.rawValue, '6543');
  assert.equal(result.canonicalValue, '6543');
  assert.equal(result.primarySource.rawValue, '6543');
  assert.equal(result.evidenceState, 'available');
  assert.equal(result.comparable, true);
  assert.equal(result.shouldGenerate, true);
  assert.deepEqual(result.sourceEvidence.map(source => source.rawValue), sourceValues);
  assert.deepEqual(result.derivedFrom.map(source => source.rawValue), sourceValues);
});

test('A17-3B Red: 6544のstore/bidも各列の数字IDを独立して解析する', () => {
  const store = resolveA173Retarget(makeA173RetargetAdGroup({ dataValues: ['○', '2608_シナリオ_メルカリ_佐久間ファン用', '6544'] }), 'store_segment');
  const bid = resolveA173Retarget(makeA173RetargetAdGroup({ bidValues: ['○', '2608_シナリオ_メルカリ_佐久間ファン用', '6544'] }), 'bid_segment');
  assert.deepEqual(JSON.parse(JSON.stringify([
    [store.canonicalValue, store.primarySource && store.primarySource.rawValue],
    [bid.canonicalValue, bid.primarySource && bid.primarySource.rawValue],
  ])), [['6544', '6544'], ['6544', '6544']]);
});

test('A17-3B Red: store/bid字段严格隔离，单侧来源不得互相替代', () => {
  const storeOnly = resolveA173Retarget(makeA173RetargetAdGroup({ dataValues: ['○', 'store-name', '6543'] }), 'store_segment');
  const storeAsBid = resolveA173Retarget(makeA173RetargetAdGroup({ dataValues: ['○', 'store-name', '6543'] }), 'bid_segment');
  const bidOnly = resolveA173Retarget(makeA173RetargetAdGroup({ bidValues: ['○', 'bid-name', '6543'] }), 'bid_segment');
  const bidAsStore = resolveA173Retarget(makeA173RetargetAdGroup({ bidValues: ['○', 'bid-name', '6543'] }), 'store_segment');
  assert.equal(storeOnly.canonicalValue, '6543');
  assert.equal(bidOnly.canonicalValue, '6543');
  assert.equal(storeAsBid.shouldGenerate, false);
  assert.equal(storeAsBid.canonicalValue, null);
  assert.equal(bidAsStore.shouldGenerate, false);
  assert.equal(bidAsStore.canonicalValue, null);
});

test('A17-3B Red: store/bid模板与CSV空值保留Evidence但不生成entry', () => {
  const result = resolveA173Retarget(makeA173RetargetAdGroup({
    dataValues: ['※セグメント名', '※セグメントID'],
    bidValues: ['※セグメント名', '※セグメントID'],
  }), 'store_segment');
  assert.equal(result.shouldGenerate, false);
  assert.equal(result.canonicalValue, null);
  assert.equal(result.primarySource, null);
  assert.equal(result.comparable, false);
  assert.deepEqual(result.sourceEvidence.map(source => source.rawValue), ['※セグメント名', '※セグメントID']);
  assert.deepEqual(result.derivedFrom.map(source => source.rawValue), ['※セグメント名', '※セグメントID']);
});

test('A17-3B Red: 同一字段的多个不同有效ID必须ambiguous而不取首项', () => {
  const result = resolveA173Retarget(makeA173RetargetAdGroup({ dataValues: ['6543', '6544'] }), 'store_segment');
  assert.equal(result.evidenceState, 'ambiguous');
  assert.equal(result.canonicalValue, null);
  assert.equal(result.primarySource, null);
  assert.equal(result.comparable, false);
  assert.equal(result.shouldGenerate, true);
});

test('A17-3B Red: 不同ADG的store evidence与候选相互独立', () => {
  const first = makeA173RetargetAdGroup({ key: 'retarget-adgroup-6543', dataValues: ['○', 'store-name', '6543'] });
  const second = makeA173RetargetAdGroup({ key: 'retarget-adgroup-6544', dataValues: ['○', 'store-name', '6544'] });
  const firstResult = resolveA173Retarget(first, 'store_segment');
  const secondResult = resolveA173Retarget(second, 'store_segment');
  assert.notStrictEqual(first.sourceEvidence.targeting['データ蓄積'], second.sourceEvidence.targeting['データ蓄積']);
  assert.equal(firstResult.canonicalValue, '6543');
  assert.equal(secondResult.canonicalValue, '6544');
  assert.equal(firstResult.sourceEvidence.some(source => source.rawValue === '6544'), false);
  assert.equal(secondResult.sourceEvidence.some(source => source.rawValue === '6543'), false);
});

test('A17-3B Red: 单一明确ID集合按既有规则去重并排序', () => {
  const result = resolveA173Retarget(makeA173RetargetAdGroup({ dataValues: ['6544 6543 6544'] }), 'store_segment');
  assert.equal(result.canonicalValue, '6543 6544');
  assert.equal(result.primarySource.rawValue, '6544 6543 6544');
  assert.equal(result.evidenceState, 'available');
  assert.equal(result.comparable, true);
});

test('A17-3B Red: Register八条retarget Compare按store 4条、bid 4条且全部一致', () => {
  const run = makeA173RetargetRegisterRun();
  const entries = run.entries.filter(entry => ['store_segment', 'bid_segment'].includes(entry.field));
  assert.equal(entries.length, 8);
  assert.equal(entries.filter(entry => entry.field === 'store_segment').length, 4);
  assert.equal(entries.filter(entry => entry.field === 'bid_segment').length, 4);
  assert.deepEqual(entries.map(entry => entry.comparisonStatus), Array(8).fill('一致'));
  assert.deepEqual(entries.map(entry => entry.canonicalValues.setting), ['6543', '6543', '6543', '6543', '6544', '6544', '6544', '6544']);
  assert.equal(run.entries.filter(entry => entry.field === 'store_segment').some(entry => entry.csvRawValue === ''), false);
  assert.equal(run.entries.filter(entry => entry.field === 'bid_segment').some(entry => entry.csvRawValue === ''), false);
});

test('A17-3B-E1 Red: edit-with-ids真实⑧形状生成store 4条与bid 4条且不读取retarget字段', () => {
  const run = makeA173RetargetEditRun();
  assert.equal(run.schemaKind, 'edit-with-ids');
  const entries = run.entries.filter(entry => ['store_segment', 'bid_segment'].includes(entry.field));
  assert.equal(entries.length, 8);
  assert.equal(entries.filter(entry => entry.field === 'store_segment').length, 4);
  assert.equal(entries.filter(entry => entry.field === 'bid_segment').length, 4);
  assert.deepEqual(entries.map(entry => ({
    field: entry.field,
    csvEntityKey: entry.csvEntityKey,
    canonicalSetting: entry.canonicalValues.setting,
    canonicalCsv: entry.canonicalValues.csv,
    settingRaw: entry.settingRawValue,
    csvRaw: entry.csvRawValue,
    comparisonStatus: entry.comparisonStatus,
  })), [
    { field: 'store_segment', csvEntityKey: 'adgroup:41479', canonicalSetting: '6543', canonicalCsv: '6543', settingRaw: '6543', csvRaw: '6543', comparisonStatus: '一致' },
    { field: 'store_segment', csvEntityKey: 'adgroup:41480', canonicalSetting: '6543', canonicalCsv: '6543', settingRaw: '6543', csvRaw: '6543', comparisonStatus: '一致' },
    { field: 'bid_segment', csvEntityKey: 'adgroup:41481', canonicalSetting: '6543', canonicalCsv: '6543', settingRaw: '6543', csvRaw: '6543', comparisonStatus: '一致' },
    { field: 'bid_segment', csvEntityKey: 'adgroup:41482', canonicalSetting: '6543', canonicalCsv: '6543', settingRaw: '6543', csvRaw: '6543', comparisonStatus: '一致' },
    { field: 'store_segment', csvEntityKey: 'adgroup:41483', canonicalSetting: '6544', canonicalCsv: '6544', settingRaw: '6544', csvRaw: '6544', comparisonStatus: '一致' },
    { field: 'store_segment', csvEntityKey: 'adgroup:41484', canonicalSetting: '6544', canonicalCsv: '6544', settingRaw: '6544', csvRaw: '6544', comparisonStatus: '一致' },
    { field: 'bid_segment', csvEntityKey: 'adgroup:41485', canonicalSetting: '6544', canonicalCsv: '6544', settingRaw: '6544', csvRaw: '6544', comparisonStatus: '一致' },
    { field: 'bid_segment', csvEntityKey: 'adgroup:41486', canonicalSetting: '6544', canonicalCsv: '6544', settingRaw: '6544', csvRaw: '6544', comparisonStatus: '一致' },
  ]);
  assert.equal(entries.some(entry => ['store', 'bid', '999999'].includes(entry.settingRawValue)), false);
  assert.equal(entries.some(entry => ['store', 'bid', '999999'].includes(entry.csvRawValue)), false);
  assert.ok(entries.every(entry => entry.sourceRefs.setting && /^654[34]$/.test(entry.sourceRefs.setting.rawValue)));
  assert.ok(entries.every(entry => entry.sourceRefs.csv && /^654[34]$/.test(entry.sourceRefs.csv.rawValue)));
});

test('A17-3B-E1 Red: edit-with-ids模板与空CSV不生成retarget、视频、DMP或schema notice', () => {
  const run = makeA173RetargetEditRun({ empty: true });
  const operationalFields = new Set(['store_segment', 'bid_segment', 'tver_video_duration', 'dmp_segment']);
  assert.equal(run.entries.some(entry => operationalFields.has(entry.field)), false);
  assert.equal(Object.prototype.hasOwnProperty.call(run, 'schemaNotices'), true);
  assert.equal(Array.isArray(run.schemaNotices), true);
  assert.equal(run.schemaNotices.length, 0);
});

test('A17-3C Red: edit-with-ids多个ADG真实视频Setting合并为一个schema notice', () => {
  const definitions = ['35361', '35362', '35363'].map((adgroupId, index) => ({
    adgroupId, videoValues: ['-', '15秒(11-22秒)'], videoRow: 48 + index,
  }));
  const run = makeA173SchemaNoticeRun({ schema: 'edit-with-ids', definitions });
  assert.equal(run.entries.some(entry => entry.field === 'tver_video_duration'), false);
  assert.equal(run.entries.filter(entry => entry.field === 'dmp_segment').length, 0);
  assert.equal(Object.values(run.statusCounts).reduce((sum, count) => sum + count, 0), run.entries.length);
  assert.ok(Array.isArray(run.schemaNotices));
  const notices = run.schemaNotices.filter(notice => notice.field === 'tver_video_duration');
  assert.equal(notices.length, 1);
  assert.equal(notices[0].level, 'Ad Group');
  assert.equal(notices[0].code, 'EDIT_SCHEMA_UNSUPPORTED_TVER_VIDEO_DURATION');
  assert.match(notices[0].message, /.+/);
  assert.deepEqual([...new Set(notices[0].affectedEntityKeys.map(key => String(key).replace(/^adgroup:/, '')))].sort(), ['35361', '35362', '35363']);
  assert.ok(notices[0].settingEvidence.length >= 3);
  assert.ok(notices[0].settingEvidence.every(source => source.fileName.includes('setting')));
  assert.ok(notices[0].settingEvidence.every(source => !source.fileName.includes('.csv')));
});

test('A17-3C Red: edit-with-ids真实DMP值仅对业务ADG生成一个notice且不生成Compare', () => {
  const run = makeA173SchemaNoticeRun({ schema: 'edit-with-ids', definitions: [
    { adgroupId: '35361', dmpValues: ['5180'], dmpRow: 66 },
    { adgroupId: '35362', dmpValues: ['5180'], dmpRow: 66 },
    { adgroupId: '35363', dmpValues: ['※セグメント名', '※セグメントID'], dmpRow: 67 },
  ] });
  assert.equal(run.entries.some(entry => entry.field === 'dmp_segment'), false);
  assert.equal(run.entries.some(entry => entry.field === 'tver_video_duration'), false);
  assert.ok(Array.isArray(run.schemaNotices));
  const notices = run.schemaNotices.filter(notice => notice.field === 'dmp_segment');
  assert.equal(notices.length, 1);
  assert.equal(notices[0].code, 'EDIT_SCHEMA_UNSUPPORTED_DMP_SEGMENT');
  assert.deepEqual([...new Set(notices[0].affectedEntityKeys.map(key => String(key).replace(/^adgroup:/, '')))].sort(), ['35361', '35362']);
  assert.ok(notices[0].settingEvidence.some(source => source.rawValue === '5180'));
  assert.ok(notices[0].settingEvidence.every(source => source.fileName.includes('setting')));
});

test('A17-3C Red: edit-with-ids模板-only与双方无业务值不生成schema notice', () => {
  const run = makeA173SchemaNoticeRun({ schema: 'edit-with-ids', definitions: [
    { adgroupId: '35361', videoValues: ['-'], dmpValues: ['※セグメント名', '※セグメントID'] },
    { adgroupId: '35362' },
  ] });
  const operationalEntries = run.entries.filter(entry => ['tver_video_duration', 'dmp_segment'].includes(entry.field));
  assert.equal(operationalEntries.length, 0);
  assert.deepEqual(run.schemaNotices || [], []);
});

test('A17-3C Red: register-without-ids不生成schema notice且保留视频/DMP Compare', () => {
  const run = makeA173SchemaNoticeRun({ schema: 'register-without-ids', definitions: [
    { adgroupId: 'register-1', videoValues: ['15秒(11-22秒)'], videoCsv: '15', dmpValues: ['68'], dmpCsv: '68' },
  ] });
  assert.deepEqual(run.schemaNotices || [], []);
  assert.equal(run.entries.filter(entry => entry.field === 'tver_video_duration').length, 1);
  assert.equal(run.entries.filter(entry => entry.field === 'dmp_segment').length, 1);
});

test('A17-3C 契约Red: register-without-ids无notice时仍明确持有空schemaNotices数组', () => {
  const run = makeA173SchemaNoticeRun({ schema: 'register-without-ids', definitions: [
    { adgroupId: 'register-empty-notice' },
  ] });
  assert.equal(Object.prototype.hasOwnProperty.call(run, 'schemaNotices'), true);
  assert.equal(Array.isArray(run.schemaNotices), true);
  assert.equal(run.schemaNotices.length, 0);
});

test('A17-3C 契约Red: edit-with-ids模板-only无业务值时明确持有空schemaNotices数组', () => {
  const run = makeA173SchemaNoticeRun({ schema: 'edit-with-ids', definitions: [
    { adgroupId: '35364', videoValues: ['-'], dmpValues: ['※セグメント名', '※セグメントID'] },
  ] });
  assert.equal(Object.prototype.hasOwnProperty.call(run, 'schemaNotices'), true);
  assert.equal(Array.isArray(run.schemaNotices), true);
  assert.equal(run.schemaNotices.length, 0);
});

test('A17-3C Red: notice与entries隔离且不吞掉A17-3B八条store/bid Compare', () => {
  const definitions = [
    { adgroupId: '41479', store: '6543', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41480', store: '6543', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41481', bid: '6543', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41482', bid: '6543', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41483', store: '6544', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41484', store: '6544', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41485', bid: '6544', videoValues: ['15秒(11-22秒)'] },
    { adgroupId: '41486', bid: '6544', videoValues: ['15秒(11-22秒)'] },
  ];
  const run = makeA173SchemaNoticeRun({ schema: 'edit-with-ids', definitions });
  const retarget = run.entries.filter(entry => ['store_segment', 'bid_segment'].includes(entry.field));
  assert.equal(retarget.length, 8);
  assert.deepEqual(retarget.map(entry => entry.comparisonStatus), Array(8).fill('一致'));
  assert.equal(run.entries.some(entry => ['tver_video_duration', 'dmp_segment'].includes(entry.field)), false);
  assert.equal(Object.values(run.statusCounts).reduce((sum, count) => sum + count, 0), run.entries.length);
  assert.ok(Array.isArray(run.schemaNotices));
  assert.equal(run.schemaNotices.filter(notice => notice.field === 'tver_video_duration').length, 1);
  assert.equal(run.schemaNotices.filter(notice => notice.field === 'dmp_segment').length, 0);
  const notice = run.schemaNotices.find(item => item.field === 'tver_video_duration');
  assert.equal(new Set(notice.affectedEntityKeys).size, notice.affectedEntityKeys.length);
  assert.ok(notice.settingEvidence.every(source => source.fileName.includes('setting')));
});

test('A17-3A Red: Entity Matching 结果与 A17-2 基线保持不变', () => {
  const settingModel = {
    campaigns: [{ key: 's-cp', level: 'Campaign', expectedName: 'CP', fields: {} }],
    adGroups: [{ key: 's-adg', level: 'Ad Group', parentKey: 's-cp', expectedName: 'ADG', fields: {} }],
    ads: [{ key: 's-ad', level: 'Ad', parentKey: 's-adg', expectedName: 'User_A_pre', fields: {} }], diagnostics: [],
  };
  const csvTree = {
    campaigns: [{ key: 'c-cp', level: 'Campaign', fields: { campaign_name: 'CP' } }],
    adGroups: [{ key: 'c-adg', level: 'Ad Group', parentKey: 'c-cp', fields: { adgroup_name: 'ADG' } }],
    ads: [{ key: 'c-ad', level: 'Ad', parentKey: 'c-adg', fields: { creative_name: 'User_A_Pre' } }], orphans: [],
  };
  const matching = api.matchTverEntities(settingModel, csvTree, { schemaKind: 'edit-with-ids', conversionContext: makeStructuralConversionContext() });
  assert.deepEqual(JSON.parse(JSON.stringify(matching.matches.map(match => ({ level: match.level, status: match.status, reasonCode: match.reasonCode })))), [
    { level: 'Campaign', status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE' },
    { level: 'Ad Group', status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE' },
    { level: 'Ad', status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE' },
  ]);
});

const TVER_DISPLAY_STATUSES = ['一致', '表記ゆれ一致', '不一致', '需确认', '未匹配'];

function makeDisplayEntity(key, level, parentKey, displayName) {
  return {
    key,
    level,
    parentKey: parentKey || null,
    expectedName: displayName,
    fields: level === 'Campaign'
      ? { campaignName: displayName }
      : level === 'Ad Group'
        ? { adgroupName: displayName }
        : { materialName: displayName },
    sourceRefs: {},
  };
}

function makeDisplayEntry(level, entityKey, csvEntityKey, status, field = 'test_field') {
  return {
    level,
    entityKey: entityKey || null,
    csvEntityKey: csvEntityKey || null,
    targetName: field,
    field,
    comparisonStatus: status,
    displayStatus: status,
  };
}

function makeDisplayMatching(matches = [], overrides = {}) {
  return {
    matches,
    unmatched: { setting: [], csv: [] },
    unassigned: { setting: [], csv: [] },
    orphans: [],
    diagnostics: [],
    ...overrides,
  };
}

function makeMatchedTriplet(prefix, names = {}) {
  const settingCampaign = makeDisplayEntity(`s-${prefix}-cp`, 'Campaign', null, names.campaign || 'Campaign');
  const settingAdGroup = makeDisplayEntity(`s-${prefix}-adg`, 'Ad Group', settingCampaign.key, names.adGroup || 'Ad Group');
  const settingAd = makeDisplayEntity(`s-${prefix}-ad`, 'Ad', settingAdGroup.key, names.ad || 'Ad');
  const csvCampaign = makeDisplayEntity(`c-${prefix}-cp`, 'Campaign', null, names.campaign || 'Campaign');
  const csvAdGroup = makeDisplayEntity(`c-${prefix}-adg`, 'Ad Group', csvCampaign.key, names.adGroup || 'Ad Group');
  const csvAd = makeDisplayEntity(`c-${prefix}-ad`, 'Ad', csvAdGroup.key, names.ad || 'Ad');
  const matches = [
    { level: 'Campaign', settingKey: settingCampaign.key, csvKey: csvCampaign.key, status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE', candidateKeys: [csvCampaign.key] },
    { level: 'Ad Group', settingKey: settingAdGroup.key, csvKey: csvAdGroup.key, status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE', candidateKeys: [csvAdGroup.key] },
    { level: 'Ad', settingKey: settingAd.key, csvKey: csvAd.key, status: 'matched', reasonCode: 'UNIQUE_HARD_CANDIDATE', candidateKeys: [csvAd.key] },
  ];
  return {
    settingModel: { campaigns: [settingCampaign], adGroups: [settingAdGroup], ads: [settingAd], diagnostics: [] },
    csvTree: { campaigns: [csvCampaign], adGroups: [csvAdGroup], ads: [csvAd], orphans: [] },
    matching: makeDisplayMatching(matches),
    setting: { campaign: settingCampaign, adGroup: settingAdGroup, ad: settingAd },
    csv: { campaign: csvCampaign, adGroup: csvAdGroup, ad: csvAd },
  };
}

test('A18-1A Red: 通过明确 parentKey 建立 Campaign → Ad Group → Ad 三层树', () => {
  const fixture = makeMatchedTriplet('hierarchy');
  const entries = [
    makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '一致'),
    makeDisplayEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, '一致'),
    makeDisplayEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, '一致'),
  ];
  const tree = api.buildTverDisplayTree({ ...fixture, entries });
  assert.equal(tree.roots.length, 1);
  assert.equal(tree.roots[0].level, 'Campaign');
  assert.equal(tree.roots[0].children.length, 1);
  assert.equal(tree.roots[0].children[0].level, 'Ad Group');
  assert.equal(tree.roots[0].children[0].children.length, 1);
  assert.equal(tree.roots[0].children[0].children[0].level, 'Ad');
});

test('A18-1A Red: 同名但 entityKey 与 parentKey 不同的实体保持独立', () => {
  const settingCampaigns = [
    makeDisplayEntity('s-cp-1', 'Campaign', null, '同名Campaign'),
    makeDisplayEntity('s-cp-2', 'Campaign', null, '同名Campaign'),
  ];
  const settingAdGroups = [
    makeDisplayEntity('s-adg-1', 'Ad Group', 's-cp-1', '同名AdGroup'),
    makeDisplayEntity('s-adg-2', 'Ad Group', 's-cp-2', '同名AdGroup'),
  ];
  const csvCampaigns = [
    makeDisplayEntity('c-cp-1', 'Campaign', null, '同名Campaign'),
    makeDisplayEntity('c-cp-2', 'Campaign', null, '同名Campaign'),
  ];
  const csvAdGroups = [
    makeDisplayEntity('c-adg-1', 'Ad Group', 'c-cp-1', '同名AdGroup'),
    makeDisplayEntity('c-adg-2', 'Ad Group', 'c-cp-2', '同名AdGroup'),
  ];
  const matches = [
    ['Campaign', 's-cp-1', 'c-cp-1'], ['Campaign', 's-cp-2', 'c-cp-2'],
    ['Ad Group', 's-adg-1', 'c-adg-1'], ['Ad Group', 's-adg-2', 'c-adg-2'],
  ].map(([level, settingKey, csvKey]) => ({ level, settingKey, csvKey, status: 'matched', candidateKeys: [csvKey] }));
  const tree = api.buildTverDisplayTree({
    settingModel: { campaigns: settingCampaigns, adGroups: settingAdGroups, ads: [] },
    csvTree: { campaigns: csvCampaigns, adGroups: csvAdGroups, ads: [], orphans: [] },
    matching: makeDisplayMatching(matches), entries: [],
  });
  assert.equal(tree.roots.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(tree.roots.map(node => node.entityKey))), ['s-cp-1', 's-cp-2']);
  assert.deepEqual(JSON.parse(JSON.stringify(tree.roots.map(node => node.children[0].entityKey))), ['s-adg-1', 's-adg-2']);
});

test('A18-1A Red: 没有明确 parentKey 时即使 key 看似有层级也进入 unattached', () => {
  const setting = makeDisplayEntity('campaign:cp|adgroup:adg', 'Ad Group', null, '看似有父级');
  const csv = makeDisplayEntity('csv:campaign:cp|adgroup:adg', 'Ad Group', null, '看似有父级');
  const tree = api.buildTverDisplayTree({
    settingModel: { campaigns: [], adGroups: [setting], ads: [] },
    csvTree: { campaigns: [], adGroups: [csv], ads: [], orphans: [] },
    matching: makeDisplayMatching([{ level: 'Ad Group', settingKey: setting.key, csvKey: csv.key, status: 'matched', candidateKeys: [csv.key] }]),
    entries: [],
  });
  assert.equal(tree.roots.length, 0);
  assert.equal(tree.unattached.length, 1);
  assert.equal(tree.unattached[0].entityKey, setting.key);
});

test('A18-1A Red: matched Setting/CSV 实体合并为一个展示节点', () => {
  const fixture = makeMatchedTriplet('merged');
  const tree = api.buildTverDisplayTree({ ...fixture, entries: [] });
  const campaignNodes = [...tree.roots, ...tree.unattached].filter(node => node.level === 'Campaign');
  assert.equal(campaignNodes.length, 1);
  assert.equal(campaignNodes[0].entityKey, fixture.setting.campaign.key);
  assert.equal(campaignNodes[0].csvEntityKey, fixture.csv.campaign.key);
  assert.equal(campaignNodes[0].children.length, 1);
});

test('A18-1A Red: Setting-only、CSV-only 与明确父级的 CSV 节点均被保留', () => {
  const settingCampaign = makeDisplayEntity('s-only-cp', 'Campaign', null, 'Setting Only');
  const settingAdGroup = makeDisplayEntity('s-only-adg', 'Ad Group', 'missing-parent', 'Setting Child Without Parent');
  const csvCampaign = makeDisplayEntity('c-only-cp', 'Campaign', null, 'CSV Only');
  const csvAdGroup = makeDisplayEntity('c-only-adg', 'Ad Group', csvCampaign.key, 'CSV Child');
  const csvOrphan = makeDisplayEntity('c-orphan-ad', 'Ad', 'missing-csv-parent', 'CSV Orphan');
  const tree = api.buildTverDisplayTree({
    settingModel: { campaigns: [settingCampaign], adGroups: [settingAdGroup], ads: [] },
    csvTree: { campaigns: [csvCampaign], adGroups: [csvAdGroup], ads: [], orphans: [csvOrphan] },
    matching: makeDisplayMatching([
      { level: 'Campaign', settingKey: settingCampaign.key, csvKey: null, status: 'unmatched', candidateKeys: [] },
      { level: 'Ad Group', settingKey: settingAdGroup.key, csvKey: null, status: 'unmatched', candidateKeys: [] },
    ], { unmatched: { setting: [settingCampaign, settingAdGroup], csv: [csvCampaign, csvAdGroup, csvOrphan] }, orphans: [csvOrphan] }),
    entries: [
      makeDisplayEntry('Campaign', settingCampaign.key, null, '未匹配'),
      makeDisplayEntry('Ad Group', settingAdGroup.key, null, '未匹配'),
      makeDisplayEntry('Campaign', null, csvCampaign.key, '未匹配'),
      makeDisplayEntry('Ad Group', null, csvAdGroup.key, '未匹配'),
      makeDisplayEntry('Ad', null, csvOrphan.key, '未匹配'),
    ],
  });
  assert.ok(tree.roots.some(node => node.entityKey === settingCampaign.key));
  assert.ok(tree.roots.some(node => node.csvEntityKey === csvCampaign.key && node.children.some(child => child.csvEntityKey === csvAdGroup.key)));
  assert.ok(tree.unattached.some(node => node.entityKey === settingAdGroup.key));
  assert.ok(tree.unattached.some(node => node.csvEntityKey === csvOrphan.key));
});

test('A18-1A Red: 每条 entry 只通过索引直接归属一个实体节点', () => {
  const fixture = makeMatchedTriplet('entry-ownership');
  const entries = [
    makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '一致'),
    makeDisplayEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, '不一致'),
    makeDisplayEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, '需确认'),
  ];
  const tree = api.buildTverDisplayTree({ ...fixture, entries });
  const nodes = [tree.roots[0], tree.roots[0].children[0], tree.roots[0].children[0].children[0]];
  assert.deepEqual(JSON.parse(JSON.stringify(nodes.map(node => node.entryIndexes))), [[0], [1], [2]]);
  assert.equal(nodes.every(node => !Object.prototype.hasOwnProperty.call(node, 'entries')), true);
  assert.equal(nodes[0].entryIndexes.includes(1), false);
  assert.equal(nodes[0].entryIndexes.includes(2), false);
});

test('A18-1A Red: directStatusCounts 与 subtreeStatusCounts 分层统计且五类状态不重分类', () => {
  const fixture = makeMatchedTriplet('status-counts');
  const csvOnly = makeDisplayEntity('c-unmatched-cp', 'Campaign', null, 'Unmatched');
  const entries = [
    makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '一致'),
    makeDisplayEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, '表記ゆれ一致'),
    makeDisplayEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, '不一致'),
    makeDisplayEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, '需确认', 'second_field'),
    makeDisplayEntry('Campaign', null, csvOnly.key, '未匹配'),
  ];
  const tree = api.buildTverDisplayTree({
    ...fixture,
    csvTree: { ...fixture.csvTree, campaigns: [...fixture.csvTree.campaigns, csvOnly] },
    matching: makeDisplayMatching(fixture.matching.matches, { unmatched: { setting: [], csv: [csvOnly] } }),
    entries,
  });
  const campaign = tree.roots.find(node => node.entityKey === fixture.setting.campaign.key);
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.directStatusCounts)), { '一致': 1, '表記ゆれ一致': 0, '不一致': 0, '需确认': 0, '未匹配': 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.subtreeStatusCounts)), { '一致': 1, '表記ゆれ一致': 1, '不一致': 1, '需确认': 1, '未匹配': 0 });
  const rawCounts = { '一致': 1, '表記ゆれ一致': 1, '不一致': 1, '需确认': 1, '未匹配': 1 };
  const aggregate = [...tree.roots, ...tree.unattached].reduce((result, node) => {
    TVER_DISPLAY_STATUSES.forEach(status => { result[status] += node.subtreeStatusCounts[status]; });
    return result;
  }, Object.fromEntries(TVER_DISPLAY_STATUSES.map(status => [status, 0])));
  assert.deepEqual(aggregate, rawCounts);
});

test('A18-1A Red: 构建展示树不改变原run业务对象内容', () => {
  const fixture = makeMatchedTriplet('immutability');
  const sourceEvidence = { setting: [{ fileName: 'setting.xlsx' }], csv: [{ fileName: 'download.csv' }], derivedFrom: [{ fileName: 'derived.xlsx' }] };
  const entries = [{ ...makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '需确认'), sourceEvidence, candidateSignature: 'candidate-signature', derivedFrom: sourceEvidence.derivedFrom }];
  const matching = makeDisplayMatching(fixture.matching.matches, { candidateSignature: 'matching-signature' });
  const input = {
    ...fixture,
    matching,
    entries,
    diagnostics: [{ code: 'DIAGNOSTIC' }],
    orphanEntities: [{ key: 'orphan' }],
    schemaNotices: [{ code: 'NOTICE' }],
  };
  const before = JSON.stringify(input);
  api.buildTverDisplayTree(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].comparisonStatus, '需确认');
  assert.equal(entries[0].candidateSignature, 'candidate-signature');
  assert.deepEqual(entries[0].sourceEvidence, sourceEvidence);
  assert.deepEqual(matching, input.matching);
});

test('A18-1A Red: 展示树只保存entryIndexes，不复制Evidence', () => {
  const fixture = makeMatchedTriplet('evidence');
  const entries = [{ ...makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '一致'), sourceEvidence: { setting: [], csv: [], derivedFrom: [] } }];
  const tree = api.buildTverDisplayTree({ ...fixture, entries });
  const node = tree.roots[0];
  assert.deepEqual(JSON.parse(JSON.stringify(node.entryIndexes)), [0]);
  assert.equal(Object.prototype.hasOwnProperty.call(node, 'sourceEvidence'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(node, 'entries'), false);
  assert.equal(node.entryIndexes === entries[0].sourceEvidence.setting, false);
});

test('A18-1A Red: 空run返回稳定空结构', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.buildTverDisplayTree({}))), { roots: [], unattached: [] });
});

function makeA181BRun(prefix = 'ui') {
  const fixture = makeMatchedTriplet(prefix);
  const entries = [
    makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '一致', 'campaign_field'),
    makeDisplayEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, '表記ゆれ一致', 'adgroup_field'),
    makeDisplayEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, '不一致', 'ad_field'),
  ];
  const displayTree = api.buildTverDisplayTree({ ...fixture, entries });
  return {
    entries,
    displayTree,
    statusCounts: { '一致': 1, '表記ゆれ一致': 1, '不一致': 1, '需确认': 0, '未匹配': 0 },
    businessRole: 'Synthetic UI test run',
    diagnostics: [],
    schemaNotices: [],
  };
}

test('A18-1B: 层级渲染函数存在并生成Campaign→Ad Group→Ad嵌套结构', () => {
  const run = makeA181BRun('nested');
  assert.equal(typeof api.renderTverDisplayTree, 'function');
  const html = api.renderTverDisplayTree(run);
  assert.match(html, /階層ビュー/);
  assert.match(html, /data-level="Campaign"[\s\S]*data-level="Ad Group"[\s\S]*data-level="Ad"/);
});

test('A18-1B: Campaign默认展开，Ad Group与Ad具有正确aria-expanded', () => {
  const run = makeA181BRun('expanded');
  const html = api.renderTverDisplayTree(run);
  const nodeFragment = nodeKey => html.slice(html.indexOf(`data-node-key="${nodeKey}"`), html.indexOf('</article>', html.indexOf(`data-node-key="${nodeKey}"`)) + 9);
  assert.match(nodeFragment(run.displayTree.roots[0].nodeKey), /aria-expanded="true"/);
  assert.match(nodeFragment(run.displayTree.roots[0].children[0].nodeKey), /aria-expanded="false"/);
  assert.match(nodeFragment(run.displayTree.roots[0].children[0].children[0].nodeKey), /aria-expanded="false"/);
});

test('A18-1B: 节点显示直接字段数与subtreeStatusCounts，零数量状态不显示', () => {
  const html = api.renderTverDisplayTree(makeA181BRun('counts'));
  assert.match(html, /直接項目：1/);
  assert.match(html, /status-一致/);
  assert.match(html, /status-表記ゆれ一致/);
  assert.match(html, /status-不一致/);
  assert.doesNotMatch(html, /status-需确认|status-未匹配/);
});

test('A18-1B: unattached节点显示在独立的未接続エンティティ区域', () => {
  const fixture = makeMatchedTriplet('unattached');
  const orphan = makeDisplayEntity('c-unattached', 'Ad Group', 'missing-parent', '未接続Ad Group');
  const entries = [
    makeDisplayEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, '一致'),
    makeDisplayEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, '表記ゆれ一致'),
    makeDisplayEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, '不一致'),
    makeDisplayEntry('Ad Group', null, orphan.key, '未匹配'),
  ];
  const displayTree = api.buildTverDisplayTree({
    ...fixture,
    csvTree: { ...fixture.csvTree, adGroups: [...fixture.csvTree.adGroups, orphan] },
    matching: makeDisplayMatching(fixture.matching.matches, { unmatched: { setting: [], csv: [orphan] } }),
    entries,
  });
  const html = api.renderTverDisplayTree({ entries, displayTree });
  assert.match(html, /未接続エンティティ/);
  assert.match(html, new RegExp(`data-node-key="${displayTree.unattached[0].nodeKey}"`));
});

test('A18-1B: 空displayTree安全渲染', () => {
  assert.doesNotThrow(() => api.renderTverDisplayTree({ displayTree: { roots: [], unattached: [] }, entries: [] }));
  assert.match(api.renderTverDisplayTree({ displayTree: { roots: [], unattached: [] } }), /階層ビュー/);
});

test('A18-1B: displayName与nodeKey中的HTML特殊字符被转义', () => {
  const setting = makeDisplayEntity('s-<bad>"', 'Campaign', null, '<img src="x" onerror="alert(1)">');
  const csv = makeDisplayEntity('c-<bad>"', 'Campaign', null, '<img src="x" onerror="alert(1)">');
  const displayTree = api.buildTverDisplayTree({
    settingModel: { campaigns: [setting], adGroups: [], ads: [] },
    csvTree: { campaigns: [csv], adGroups: [], ads: [], orphans: [] },
    matching: makeDisplayMatching([{ level: 'Campaign', settingKey: setting.key, csvKey: csv.key, status: 'matched' }]),
    entries: [makeDisplayEntry('Campaign', setting.key, csv.key, '一致')],
  });
  const html = api.renderTverDisplayTree({ displayTree });
  assert.match(html, /&lt;img src=&quot;x&quot; onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /data-node-key="s-&lt;bad&gt;&quot;::c-&lt;bad&gt;&quot;|data-node-key="match:s-&lt;bad&gt;&quot;::c-&lt;bad&gt;&quot;/);
  assert.doesNotMatch(html, /<img src="x"/);
});

test('A18-1B: 渲染前后run.displayTree与entries内容不变', () => {
  const run = makeA181BRun('immutable');
  const before = JSON.stringify(run);
  api.renderTverDisplayTree(run);
  assert.equal(JSON.stringify(run), before);
});

test('A18-3C1: 横向结果默认不生成详细扁平表容器', () => {
  const view = api.renderTverRun(makeA181BRun('flat-table'), { activeLevel: 'Campaign', document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="tver-horizontal-table"/);
  assert.doesNotMatch(view.html, /id="tver-display-tree"/);
  assert.doesNotMatch(view.html, /class="results-table"/);
  assert.doesNotMatch(view.html, /class="filter-bar"/);
  assert.ok(view.html.indexOf('class="tver-level-tabs"') < view.html.indexOf('class="tver-horizontal-table"'));
});

test('A18-1B: schemaNotices不进入层级状态徽标', () => {
  const run = makeA181BRun('notice');
  run.schemaNotices = [{ code: 'EDIT_SCHEMA_NOTICE_ONLY', message: 'notice must stay at run level' }];
  const html = api.renderTverDisplayTree(run);
  assert.doesNotMatch(html, /EDIT_SCHEMA_NOTICE_ONLY|notice must stay at run level/);
  assert.doesNotMatch(html, /schemaNotices/);
});

test('A18-1B: 全部展开/折叠与节点切换使用稳定data属性', () => {
  const run = makeA181BRun('actions');
  const html = api.renderTverDisplayTree(run);
  assert.equal(typeof api.toggleTverTreeNode, 'function');
  assert.equal(typeof api.setAllTverTreeExpanded, 'function');
  assert.match(html, /data-action="expand-all"/);
  assert.match(html, /data-action="collapse-all"/);
  assert.match(html, /data-action="toggle-node"/);
  assert.match(html, new RegExp(`data-node-key="${run.displayTree.roots[0].nodeKey}" data-level="Campaign"`));
  assert.doesNotMatch(html, /data-action="toggle-[^"]*s-actions-cp/);
});

test('A18-1B: 同名节点拥有不同nodeKey时DOM标识不冲突', () => {
  const settingCampaigns = [
    makeDisplayEntity('s-same-1', 'Campaign', null, '同名Campaign'),
    makeDisplayEntity('s-same-2', 'Campaign', null, '同名Campaign'),
  ];
  const displayTree = api.buildTverDisplayTree({
    settingModel: { campaigns: settingCampaigns, adGroups: [], ads: [] },
    csvTree: { campaigns: [], adGroups: [], ads: [], orphans: [] },
    matching: makeDisplayMatching(),
    entries: [],
  });
  const html = api.renderTverDisplayTree({ displayTree });
  displayTree.roots.forEach(node => assert.equal((html.match(new RegExp(`data-node-key="${node.nodeKey}"`, 'g')) || []).length, 2));
  assert.notEqual(displayTree.roots[0].nodeKey, displayTree.roots[1].nodeKey);
});

test('A18-3B: 重复调用横向结果渲染不会产生重复旧树容器', () => {
  const run = makeA181BRun('rerender');
  const first = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  const second = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((first.html.match(/class="tver-level-tab"/g) || []).length, 3);
  assert.equal((second.html.match(/class="tver-level-tab"/g) || []).length, 3);
  assert.doesNotMatch(first.html, /id="tver-display-tree"/);
  assert.doesNotMatch(second.html, /id="tver-display-tree"/);
});

function makeA181CFixture(options = {}) {
  const suffix = options.suffix || 'label';
  const settingCampaign = {
    key: `s-${suffix}-cp`, level: 'Campaign', parentKey: null, expectedName: 'Campaign Name',
    fields: { campaignName: 'Campaign Name' }, sourceRefs: {},
  };
  const settingAdGroup = {
    key: options.settingAdGroupKey || `s-${suffix}-adg`, level: 'Ad Group', parentKey: settingCampaign.key,
    expectedName: null, fields: { ...(options.settingFields || {}) }, sourceRefs: {},
  };
  const settingAd = {
    key: `s-${suffix}-ad`, level: 'Ad', parentKey: settingAdGroup.key, expectedName: 'Ad Name',
    fields: { materialName: 'Ad Name' }, sourceRefs: {},
  };
  const csvCampaign = {
    key: `c-${suffix}-cp`, level: 'Campaign', parentKey: null,
    fields: { campaign_name: 'Campaign Name' }, sourceRefs: {},
  };
  const csvAdGroup = {
    key: `c-${suffix}-adg`, level: 'Ad Group', parentKey: csvCampaign.key,
    fields: { ...(options.csvFields || {}) }, sourceRefs: {},
  };
  const csvAd = {
    key: `c-${suffix}-ad`, level: 'Ad', parentKey: csvAdGroup.key,
    fields: { creative_name: 'Ad Name' }, sourceRefs: {},
  };
  const matches = [
    { level: 'Campaign', settingKey: settingCampaign.key, csvKey: csvCampaign.key, status: 'matched', candidateKeys: [csvCampaign.key] },
    { level: 'Ad Group', settingKey: settingAdGroup.key, csvKey: csvAdGroup.key, status: 'matched', candidateKeys: [csvAdGroup.key] },
    { level: 'Ad', settingKey: settingAd.key, csvKey: csvAd.key, status: 'matched', candidateKeys: [csvAd.key] },
  ];
  const entries = [
    { ...makeDisplayEntry('Campaign', settingCampaign.key, csvCampaign.key, '一致'), targetName: 'campaign-target' },
    { ...makeDisplayEntry('Ad Group', settingAdGroup.key, csvAdGroup.key, '表記ゆれ一致'), targetName: 'adgroup-target' },
    { ...makeDisplayEntry('Ad', settingAd.key, csvAd.key, '不一致'), targetName: 'ad-target' },
  ];
  return {
    settingModel: { campaigns: [settingCampaign], adGroups: [settingAdGroup], ads: [settingAd], diagnostics: [] },
    csvTree: { campaigns: [csvCampaign], adGroups: [csvAdGroup], ads: [csvAd], orphans: [] },
    matching: makeDisplayMatching(matches),
    entries,
    setting: { campaign: settingCampaign, adGroup: settingAdGroup, ad: settingAd },
    csv: { campaign: csvCampaign, adGroup: csvAdGroup, ad: csvAd },
  };
}

function makeA181CTree(options = {}) {
  const fixture = makeA181CFixture(options);
  return { fixture, tree: api.buildTverDisplayTree(fixture) };
}

test('A18-1C Red: buildTverDisplayLabel函数存在并为每个节点生成displayLabel', () => {
  assert.equal(typeof api.buildTverDisplayLabel, 'function');
  const { tree } = makeA181CTree({ csvFields: { adgroup_name: 'CSV edit name' } });
  assert.equal(typeof tree.roots[0].displayLabel, 'string');
  assert.equal(typeof tree.roots[0].children[0].displayLabel, 'string');
  assert.equal(typeof tree.roots[0].children[0].children[0].displayLabel, 'string');
});

test('A18-1C: matched edit Ad Group不使用CSV名称冒充Setting身份', () => {
  const { tree } = makeA181CTree({ csvFields: { adgroup_name: 'CSV edit name' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ');
});

test('A18-1C: matched register Ad Group不使用CSV名称冒充Setting身份', () => {
  const { tree } = makeA181CTree({ csvFields: { adGroupName: 'CSV register name' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ');
});

test('A18-1C: CSV两种名称字段均不能覆盖Setting身份', () => {
  const { tree } = makeA181CTree({ csvFields: { adgroup_name: 'snake name', adGroupName: 'camel name' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ');
});

test('A18-1C Red: CSV名称为空时targetingNumber与tagAppeal组成Setting fallback', () => {
  const { tree } = makeA181CTree({ settingFields: { targetingNumber: '12', tagAppeal: 'SPPC' }, csvFields: { adgroup_name: '' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ 12｜SPPC');
});

test('A18-1C Red: 仅targetingNumber存在时生成固定fallback', () => {
  const { tree } = makeA181CTree({ settingFields: { targetingNumber: '12', tagAppeal: '  ' }, csvFields: { adgroup_name: '' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ 12');
});

test('A18-1C Red: 仅tagAppeal存在时生成固定fallback', () => {
  const { tree } = makeA181CTree({ settingFields: { targetingNumber: '  ', tagAppeal: ' CTV ' }, csvFields: { adgroup_name: '' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ｜CTV');
});

test('A18-1C Red: targetingNumber与tagAppeal都不存在时使用固定广告グループ', () => {
  const { tree } = makeA181CTree({ settingFields: { targetingNumber: '', tagAppeal: '' }, csvFields: { adgroup_name: '' } });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ');
});

test('A18-1C Red: Campaign与Ad的displayLabel保持displayName', () => {
  const { fixture, tree } = makeA181CTree({ csvFields: { adgroup_name: 'CSV edit name' } });
  assert.equal(tree.roots[0].displayLabel, fixture.setting.campaign.expectedName);
  assert.equal(tree.roots[0].children[0].children[0].displayLabel, fixture.setting.ad.expectedName);
  assert.equal(tree.roots[0].displayLabel, tree.roots[0].displayName);
  assert.equal(tree.roots[0].children[0].children[0].displayLabel, tree.roots[0].children[0].children[0].displayName);
});

test('A18-1C Red: displayLabel不改变原displayName、targetName和实体key', () => {
  const fixture = makeA181CFixture({ csvFields: { adgroup_name: 'CSV edit name' } });
  const before = JSON.stringify({
    setting: fixture.settingModel,
    csv: fixture.csvTree,
    matching: fixture.matching,
    entries: fixture.entries,
  });
  const tree = api.buildTverDisplayTree(fixture);
  const adGroup = tree.roots[0].children[0];
  assert.equal(JSON.stringify({
    setting: fixture.settingModel,
    csv: fixture.csvTree,
    matching: fixture.matching,
    entries: fixture.entries,
  }), before);
  assert.equal(adGroup.displayName, fixture.setting.adGroup.key);
  assert.equal(adGroup.entityKey, fixture.setting.adGroup.key);
  assert.equal(adGroup.csvEntityKey, fixture.csv.adGroup.key);
  assert.equal(adGroup.nodeKey, `match:${fixture.setting.adGroup.key}::${fixture.csv.adGroup.key}`);
  assert.equal(fixture.entries[1].targetName, 'adgroup-target');
});

test('A18-1C Red: 不解析entityKey中的JSON而只使用实体字段', () => {
  const { tree } = makeA181CTree({
    settingAdGroupKey: 's-adg-{"targetingNumber":"999"}',
    settingFields: { targetingNumber: '12', tagAppeal: 'SPPC' },
    csvFields: { adgroup_name: '' },
  });
  assert.equal(tree.roots[0].children[0].displayLabel, '広告グループ 12｜SPPC');
});

test('A18-1C Red: UI节点标题使用displayLabel而不是Ad Group原displayName', () => {
  const { fixture, tree } = makeA181CTree({
    settingAdGroupKey: 'adgroup:{"veryLong":"raw entity key"}',
    settingFields: { tagAppeal: 'Friendly Ad Group' }, csvFields: { adgroup_name: 'Wrong CSV name' },
  });
  const html = api.renderTverDisplayTree({ displayTree: tree, entries: fixture.entries });
  assert.match(html, /Friendly Ad Group/);
  const adGroupStart = html.indexOf('<div class="tver-display-tree-node-title"');
  const adGroupTitle = html.slice(adGroupStart, html.indexOf('<span class="tver-display-tree-direct"', adGroupStart));
  assert.doesNotMatch(adGroupTitle, /veryLong/);
});

test('A18-1C Red: displayLabel在UI中经过HTML转义', () => {
  const { fixture, tree } = makeA181CTree({ settingFields: { tagAppeal: '<img src="x" onerror="alert(1)">' }, csvFields: { adgroup_name: 'Wrong CSV name' } });
  const html = api.renderTverDisplayTree({ displayTree: tree, entries: fixture.entries });
  assert.match(html, /&lt;img src=&quot;x&quot; onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img src="x"/);
});

test('A18-1C Red: 相同displayLabel但不同nodeKey的节点保持独立', () => {
  const first = makeA181CFixture({ suffix: 'same-one', settingFields: { tagAppeal: 'Same label' }, csvFields: { adgroup_name: 'Wrong CSV name' } });
  const second = makeA181CFixture({ suffix: 'same-two', settingFields: { tagAppeal: 'Same label' }, csvFields: { adgroup_name: 'Wrong CSV name' } });
  const tree = api.buildTverDisplayTree({
    settingModel: {
      campaigns: [...first.settingModel.campaigns, ...second.settingModel.campaigns],
      adGroups: [...first.settingModel.adGroups, ...second.settingModel.adGroups],
      ads: [...first.settingModel.ads, ...second.settingModel.ads],
    },
    csvTree: {
      campaigns: [...first.csvTree.campaigns, ...second.csvTree.campaigns],
      adGroups: [...first.csvTree.adGroups, ...second.csvTree.adGroups],
      ads: [...first.csvTree.ads, ...second.csvTree.ads], orphans: [],
    },
    matching: makeDisplayMatching([...first.matching.matches, ...second.matching.matches]),
    entries: [...first.entries, ...second.entries],
  });
  const adGroups = tree.roots.map(node => node.children[0]);
  assert.equal(adGroups[0].displayLabel, 'Same label');
  assert.equal(adGroups[1].displayLabel, 'Same label');
  assert.notEqual(adGroups[0].nodeKey, adGroups[1].nodeKey);
});

test('A18-1C Red: displayLabel不改变状态统计、entryIndexes、父子层级或节点字段', () => {
  const fixture = makeA181CFixture({ csvFields: { adgroup_name: 'CSV edit name' } });
  const tree = api.buildTverDisplayTree(fixture);
  const campaign = tree.roots[0];
  const adGroup = campaign.children[0];
  const ad = adGroup.children[0];
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.entryIndexes)), [0]);
  assert.deepEqual(JSON.parse(JSON.stringify(adGroup.entryIndexes)), [1]);
  assert.deepEqual(JSON.parse(JSON.stringify(ad.entryIndexes)), [2]);
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.subtreeStatusCounts)), { '一致': 1, '表記ゆれ一致': 1, '不一致': 1, '需确认': 0, '未匹配': 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(adGroup.subtreeStatusCounts)), { '一致': 0, '表記ゆれ一致': 1, '不一致': 1, '需确认': 0, '未匹配': 0 });
  assert.equal(adGroup.parentEntityKey, fixture.setting.campaign.key);
  assert.equal(ad.parentEntityKey, fixture.setting.adGroup.key);
  assert.equal(Object.prototype.hasOwnProperty.call(adGroup, 'entries'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(adGroup, 'sourceEvidence'), false);
  assert.equal(typeof adGroup.displayLabel, 'string');
});

function makeA182AEntry(level, entityKey, csvEntityKey, index, status, field) {
  return {
    ...makeDisplayEntry(level, entityKey, csvEntityKey, status, field),
    targetName: level === 'Ad Group' ? `adgroup:{"long":"raw-${index}"}` : `${level}-target-${index}`,
    settingRawValue: `<setting-${index}>`,
    csvRawValue: `CSV & ${index}`,
    reason: `reason <${index}>`,
    ruleBasis: `RULE-${index}`,
    sourceEvidence: { setting: [{ fileName: `setting-${index}.xlsx` }], csv: [{ fileName: `csv-${index}.csv` }], derivedFrom: [] },
    candidateSignature: `candidate-${index}`,
    derivedFrom: [{ fileName: `derived-${index}.xlsx` }],
  };
}

function makeA182ARun() {
  const fixture = makeA181CFixture({ settingFields: { tagAppeal: 'Readable Ad Group' }, csvFields: { adgroup_name: 'Readable Ad Group' } });
  const entries = [
    makeA182AEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, 0, '一致', 'campaign-field-0'),
    makeA182AEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, 1, '表記ゆれ一致', 'adgroup-field-1'),
    makeA182AEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, 2, '不一致', 'ad-field-2'),
    makeA182AEntry('Campaign', fixture.setting.campaign.key, fixture.csv.campaign.key, 3, '需确认', 'campaign-field-3'),
    makeA182AEntry('Ad Group', fixture.setting.adGroup.key, fixture.csv.adGroup.key, 4, '一致', 'adgroup-field-4'),
    makeA182AEntry('Ad', fixture.setting.ad.key, fixture.csv.ad.key, 5, '未匹配', 'ad-field-5'),
  ];
  const displayTree = api.buildTverDisplayTree({ ...fixture, entries });
  return {
    ...fixture,
    entries,
    displayTree,
    statusCounts: { '一致': 2, '表記ゆれ一致': 1, '不一致': 1, '需确认': 1, '未匹配': 1 },
    schemaNotices: [],
    diagnostics: [],
    orphanEntities: [],
  };
}

function countOccurrences(text, needle) {
  return String(text).split(needle).length - 1;
}

function resultTableHtml(viewHtml) {
  const start = viewHtml.indexOf('<table class="results-table">');
  return start < 0 ? '' : viewHtml.slice(start);
}

function treeNodeHtml(viewHtml, nodeKey) {
  const start = viewHtml.indexOf(`<article class="tver-display-tree-node" data-node-key="${nodeKey}"`);
  if (start < 0) return '';
  const nextNode = viewHtml.indexOf('<article class="tver-display-tree-node" data-node-key="', start + 1);
  return viewHtml.slice(start, nextNode < 0 ? viewHtml.length : nextNode);
}

function treeEntryIndexes(viewHtml, nodeKey) {
  return [...treeNodeHtml(viewHtml, nodeKey).matchAll(/<tr data-entry-index="(\d+)">/g)].map(match => Number(match[1]));
}

test('A18-2A Red: entry index展示索引函数存在且只由displayTree建立', () => {
  const run = makeA182ARun();
  assert.equal(typeof api.buildTverEntryDisplayLabelIndex, 'function');
  const index = api.buildTverEntryDisplayLabelIndex(run.displayTree);
  assert.equal(index.get(0), 'Campaign Name');
  assert.equal(index.get(1), 'Readable Ad Group');
  assert.equal(index.get(2), 'Ad Name');
});

test('A18-2A Red: 实体字段表只渲染节点自身entryIndexes', () => {
  const run = makeA182ARun();
  assert.equal(typeof api.buildTverEntityFieldTableHtml, 'function');
  const campaign = run.displayTree.roots[0];
  const html = api.buildTverEntityFieldTableHtml(campaign, run.entries);
  assert.match(html, /campaign-field-0/);
  assert.match(html, /campaign-field-3/);
  assert.doesNotMatch(html, /adgroup-field-1|ad-field-2|ad-field-5/);
});

test('A18-2A Red: 子实体entry不进入父实体direct字段表', () => {
  const run = makeA182ARun();
  const adGroup = run.displayTree.roots[0].children[0];
  const html = api.buildTverEntityFieldTableHtml(adGroup, run.entries);
  assert.match(html, /adgroup-field-1|adgroup-field-4/);
  assert.doesNotMatch(html, /campaign-field-|ad-field-/);
});

test('A18-2A Red: Campaign、Ad Group、Ad三层均生成字段表', () => {
  const run = makeA182ARun();
  const html = api.buildTverDisplayTreeHtml(run.displayTree, run.entries);
  assert.equal(countOccurrences(html, 'class="tver-entity-field-table"'), 3);
  assert.match(html, /data-level="Campaign"/);
  assert.match(html, /data-level="Ad Group"/);
  assert.match(html, /data-level="Ad"/);
});

test('A18-2A Red: 字段表严格使用五列结构', () => {
  const run = makeA182ARun();
  const html = api.buildTverEntityFieldTableHtml(run.displayTree.roots[0], run.entries);
  assert.match(html, /<th>項目<\/th>/);
  assert.match(html, /<th>比較結果<\/th>/);
  assert.match(html, /<th>設定表値<\/th>/);
  assert.match(html, /<th>CSV値<\/th>/);
  assert.match(html, /<th>理由／ルール根拠<\/th>/);
  assert.equal(countOccurrences(html, '<th>'), 5);
});

test('A18-2A Red: 状態、Setting raw、CSV raw、reason和ruleBasis均显示', () => {
  const run = makeA182ARun();
  const html = api.buildTverEntityFieldTableHtml(run.displayTree.roots[0].children[0], run.entries);
  assert.match(html, /表記ゆれ一致|一致/);
  assert.match(html, /&lt;setting-1&gt;/);
  assert.match(html, /CSV &amp; 1/);
  assert.match(html, /reason &lt;1&gt;/);
  assert.match(html, /RULE-1/);
});

test('A18-2A Red: 没有direct entry的节点不生成空表', () => {
  const run = makeA182ARun();
  const emptyNode = { ...run.displayTree.roots[0], entryIndexes: [] };
  assert.equal(api.buildTverEntityFieldTableHtml(emptyNode, run.entries), '');
});

test('A18-2A Red: 非连续且乱序entryIndexes仍按索引顺序渲染', () => {
  const run = makeA182ARun();
  const campaign = { ...run.displayTree.roots[0], entryIndexes: [3, 0] };
  const html = api.buildTverEntityFieldTableHtml(campaign, run.entries);
  assert.ok(html.indexOf('campaign-field-3') < html.indexOf('campaign-field-0'));
});

test('A18-2A Red: 字段表所有动态内容经过HTML转义', () => {
  const run = makeA182ARun();
  const entry = { ...run.entries[1], field: '<field>', settingRawValue: '<img src="x">', csvRawValue: '"&', reason: '<reason>' };
  const html = api.buildTverEntityFieldTableHtml({ ...run.displayTree.roots[0].children[0], entryIndexes: [0] }, [entry]);
  assert.match(html, /&lt;field&gt;/);
  assert.match(html, /&lt;img src=&quot;x&quot;&gt;/);
  assert.match(html, /&quot;&amp;/);
  assert.match(html, /&lt;reason&gt;/);
  assert.doesNotMatch(html, /<img src="x">/);
});

test('A18-2A Red: 字段表渲染不把完整entry或Evidence写回节点', () => {
  const run = makeA182ARun();
  const before = JSON.stringify(run);
  api.renderTverDisplayTree(run);
  assert.equal(JSON.stringify(run), before);
  const nodes = [run.displayTree.roots[0], run.displayTree.roots[0].children[0], run.displayTree.roots[0].children[0].children[0]];
  assert.equal(nodes.every(node => !Object.prototype.hasOwnProperty.call(node, 'entries')), true);
  assert.equal(nodes.every(node => !Object.prototype.hasOwnProperty.call(node, 'sourceEvidence')), true);
});

test('A18-2A Red: 横向表Ad Group対象名使用displayLabel而非长JSON', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, />Readable Ad Group[\s\S]*?<\/td>/);
  assert.doesNotMatch(view.html, /adgroup:\{/);
});

test('A18-2A Red: 展示修正不改变原targetName与所有实体key', () => {
  const run = makeA182ARun();
  const before = JSON.stringify({
    entries: run.entries.map(entry => ({ targetName: entry.targetName, entityKey: entry.entityKey, csvEntityKey: entry.csvEntityKey })),
    nodes: [run.displayTree.roots[0], run.displayTree.roots[0].children[0], run.displayTree.roots[0].children[0].children[0]].map(node => ({ displayName: node.displayName, entityKey: node.entityKey, csvEntityKey: node.csvEntityKey, nodeKey: node.nodeKey })),
  });
  api.renderTverRun(run, { document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  const after = JSON.stringify({
    entries: run.entries.map(entry => ({ targetName: entry.targetName, entityKey: entry.entityKey, csvEntityKey: entry.csvEntityKey })),
    nodes: [run.displayTree.roots[0], run.displayTree.roots[0].children[0], run.displayTree.roots[0].children[0].children[0]].map(node => ({ displayName: node.displayName, entityKey: node.entityKey, csvEntityKey: node.csvEntityKey, nodeKey: node.nodeKey })),
  });
  assert.equal(after, before);
});

test('A18-2A Red: 相同displayLabel的节点和entry不合并', () => {
  const run = makeA182ARun();
  const first = { ...run.displayTree.roots[0], nodeKey: 'same-label-one', entryIndexes: [0], children: [] };
  const second = { ...run.displayTree.roots[0], nodeKey: 'same-label-two', entryIndexes: [3], children: [] };
  const displayTree = { roots: [first, second], unattached: [] };
  const index = api.buildTverEntryDisplayLabelIndex(displayTree);
  assert.equal(index.get(0), index.get(3));
  const html = api.buildTverDisplayTreeHtml(displayTree, run.entries);
  assert.equal(countOccurrences(html, 'data-node-key="same-label-one"'), 2);
  assert.equal(countOccurrences(html, 'data-node-key="same-label-two"'), 2);
  assert.match(html, /campaign-field-0/);
  assert.match(html, /campaign-field-3/);
});

test('A18-2A Red: schemaNotices保持run级且不进入实体字段表', () => {
  const run = makeA182ARun();
  run.schemaNotices = [{ code: 'A18_2A_NOTICE_ONLY', message: 'schema notice stays at run level' }];
  const html = api.renderTverRun(run, { document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.doesNotMatch(html, /A18_2A_NOTICE_ONLY|schema notice stays at run level/);
  assert.doesNotMatch(html, /schemaNotices/);
});

test('A18-2A Red: statusCounts、matching和candidateSignature保持不变', () => {
  const run = makeA182ARun();
  run.matching.candidateSignature = 'matching-signature';
  const before = JSON.stringify({ statusCounts: run.statusCounts, matching: run.matching, entries: run.entries });
  api.renderTverRun(run, { document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(JSON.stringify({ statusCounts: run.statusCounts, matching: run.matching, entries: run.entries }), before);
});

test('A18-3B迁移: 状态筛选同步过滤横向单元格', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: '不一致', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /data-entry-index="2"/);
  assert.doesNotMatch(view.html, /data-entry-index="0"|data-entry-index="1"|data-entry-index="3"|data-entry-index="4"|data-entry-index="5"/);
  assert.doesNotMatch(view.html, /data-entry-index="(?:0|1|3|4|5)"/);
});

test('A18-3B迁移: Level页签同步过滤横向字段行', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.deepEqual([...view.html.matchAll(/data-entry-index="(1|4)"/g)].map(match => Number(match[1])), [1, 4, 1, 4]);
  assert.doesNotMatch(view.html, /data-entry-index="0"|data-entry-index="2"|data-entry-index="3"|data-entry-index="5"/);
  assert.doesNotMatch(view.html, /data-entry-index="(?:0|2|3|5)"/);
});

test('A18-3B迁移: 异常筛选同步过滤当前Level横向单元格', () => {
  const run = makeA182ARun();
  const campaign = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: true, keyword: '' } });
  const ad = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: true, keyword: '' } });
  const adGroup = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: true, keyword: '' } });
  assert.match(campaign.html, /data-entry-index="3"/);
  assert.match(ad.html, /data-entry-index="2"/);
  assert.match(ad.html, /data-entry-index="5"/);
  assert.doesNotMatch(adGroup.html, /data-entry-index="1"/);
  assert.doesNotMatch(adGroup.html, /data-entry-index="4"/);
});

test('A18-3B迁移: 关键词筛选同步过滤横向单元格', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: 'RULE-4' } });
  assert.match(view.html, /data-entry-index="4"/);
  assert.doesNotMatch(view.html, /data-entry-index="1"|data-entry-index="2"|data-entry-index="3"|data-entry-index="5"/);
  assert.doesNotMatch(view.html, /data-entry-index="(?:1|2|3|5)"/);
});

test('A18-3B迁移: 多个筛选条件遵循既有组合语义', () => {
  const run = makeA182ARun();
  const filters = { level: 'Ad Group', status: '一致', abnormalOnly: false, keyword: 'RULE-4' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters });
  assert.match(view.html, /data-entry-index="4"/);
  assert.equal(view.displayedEntries.length, 1);
  assert.doesNotMatch(view.html, /class="results-table"/);
});

test('A18-3B迁移: displayStatus为需确认时可由界面要確認条件筛选', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: '要確認', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /data-entry-index="3"/);
  assert.equal(view.displayedEntries[0].displayStatus, '需确认');
  assert.doesNotMatch(view.html, /<option value="要確認">要確認<\/option>/);
});

test('A18-3B迁移: 子节点字段不得进入父阶层横向表', () => {
  const run = makeA182ARun();
  const parent = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: true, keyword: '' } });
  const child = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: true, keyword: '' } });
  assert.equal(horizontalEntityRows(parent.html).length, 0);
  assert.match(child.html, /data-entry-index="2"|data-entry-index="5"/);
  assert.doesNotMatch(parent.html, /data-entry-index="2"|data-entry-index="3"|data-entry-index="4"|data-entry-index="5"/);
});

test('A18-3B迁移: 横向单元格保持节点原始entryIndexes顺序', () => {
  const run = makeA182ARun();
  const campaign = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const adGroup = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const ad = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.deepEqual([...campaign.html.matchAll(/data-entry-index="(0|3)"/g)].map(match => Number(match[1])), [0, 3, 0, 3]);
  assert.deepEqual([...adGroup.html.matchAll(/data-entry-index="(1|4)"/g)].map(match => Number(match[1])), [1, 4, 1, 4]);
  assert.deepEqual([...ad.html.matchAll(/data-entry-index="(2|5)"/g)].map(match => Number(match[1])), [2, 5, 2, 5]);
});

test('A18-3B迁移: 没有匹配字段的实体不生成空横向行', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '要確認', abnormalOnly: false, keyword: '' } });
  assert.equal(horizontalEntityRows(view.html).length, 0);
  assert.doesNotMatch(view.html, /class="tver-horizontal-cell-entry"/);
});

test('A18-3B迁移: 筛选后没有匹配字段的实体行隐藏且空分组隐藏', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '一致', abnormalOnly: false, keyword: '' } });
  assert.equal(horizontalEntityRows(view.html).length, 2);
  assert.equal(horizontalGroupLabels(view.html).length, 1);
});

test('A18-3B迁移: 筛选后横向分组保留父阶层关系', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: '不一致', abnormalOnly: false, keyword: '' } });
  assert.deepEqual(horizontalGroupLabels(view.html), ['Readable Ad Group']);
  assert.doesNotMatch(view.html, /tver-horizontal-col-parent|data-column-key="parent"/);
  assert.doesNotMatch(view.html, /data-node-children/);
});

test('A18-3B迁移: 筛选不重新计算顶部三状态统计', () => {
  const run = makeA182ARun();
  run.displayTree.roots[0].directStatusCounts = { '一致': 7, '表記ゆれ一致': 0, '不一致': 0, '需确认': 1, '未匹配': 0 };
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: '要確認', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="status-count tver-status-consistent"[^>]*>[\s\S]*?<strong>1<\/strong>/);
  assert.match(view.html, /class="status-count tver-status-review"[^>]*>[\s\S]*?<strong>2<\/strong>/);
  assert.match(view.html, /data-entry-index="3"/);
});

test('A18-3B迁移: 筛选后的横向动态内容继续HTML转义', () => {
  const run = makeA182ARun();
  run.entries[1] = { ...run.entries[1], field: '<field>', settingRawValue: '<img src="x">', csvRawValue: '"&', reason: '<reason>', ruleBasis: 'RULE-HTML' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: 'RULE-HTML' } });
  assert.match(view.html, /&lt;field&gt;/);
  assert.match(view.html, /&lt;img src=&quot;x&quot;&gt;/);
  assert.match(view.html, /&quot;&amp;/);
  assert.doesNotMatch(view.html, /<reason>/);
  assert.doesNotMatch(view.html, /<img src="x">/);
});

test('A18-3B迁移: 无筛选时三页横向字段行保持原样且不显示扁平表', () => {
  const run = makeA182ARun();
  const views = ['Campaign', 'Ad Group', 'Ad'].map(activeLevel => api.renderTverRun(run, { activeLevel, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }));
  assert.equal(views.reduce((sum, view) => sum + view.displayedEntries.length, 0), run.entries.length);
  views.forEach(view => assert.doesNotMatch(view.html, /class="results-table"/));
});

test('A18-3B迁移: entries、displayTree、entryIndexes、matching、statusCounts、schemaNotices深度不变', () => {
  const run = makeA182ARun();
  const before = JSON.stringify(run);
  api.renderTverRun(run, { document: null, filters: { level: 'Ad Group', status: '需确认', abnormalOnly: false, keyword: 'RULE' } });
  assert.equal(JSON.stringify(run), before);
});

test('A18-3B迁移: 横向单元格集合仍与既有筛选结果一致', () => {
  const run = makeA182ARun();
  const filters = { level: 'Ad Group', status: 'all', abnormalOnly: false, keyword: '' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters });
  assert.deepEqual(view.displayedEntries.map(entry => entry.field), ['adgroup-field-1', 'adgroup-field-4']);
  assert.deepEqual([...view.html.matchAll(/data-entry-index="(1|4)"/g)].map(match => Number(match[1])), [1, 4, 1, 4]);
  assert.equal((view.html.match(/data-entry-index="(?:1|4)"/g) || []).length, view.displayedEntries.length * 2);
  assert.doesNotMatch(view.html, /class="results-table"/);
});

function makeA183StatusCounts(overrides = {}) {
  return { '一致': 0, '表記ゆれ一致': 0, '不一致': 0, '需確認': 0, '未匹配': 0, ...overrides };
}

function makeA183Node({ nodeKey, level, entityKey = null, displayLabel = nodeKey, entryIndexes = [], children = [], directStatusCounts = {} }) {
  return {
    nodeKey,
    level,
    entityKey,
    csvEntityKey: entityKey ? `csv-${entityKey}` : null,
    parentEntityKey: null,
    displayName: displayLabel,
    displayLabel,
    matchState: 'matched',
    entryIndexes: [...entryIndexes],
    directStatusCounts: makeA183StatusCounts(directStatusCounts),
    subtreeStatusCounts: makeA183StatusCounts(directStatusCounts),
    children: [...children],
  };
}

function makeA183Entry({ level, entityKey, field, status = '一致', settingRawValue = 'setting', csvRawValue = 'csv', targetName = 'target', ...extra }) {
  return {
    level,
    entityKey,
    csvEntityKey: `csv-${entityKey}`,
    targetName,
    field,
    comparisonStatus: status,
    displayStatus: status,
    settingRawValue,
    csvRawValue,
    ...extra,
  };
}

function makeA183Run() {
  const ad = makeA183Node({ nodeKey: 'ad-1', level: 'Ad', entityKey: 'ad-1', displayLabel: '同名Ad', entryIndexes: [7, 8] });
  const adGroup = makeA183Node({ nodeKey: 'adg-1', level: 'Ad Group', entityKey: 'adg-1', displayLabel: '同名Ad Group', entryIndexes: [3, 4, 5, 6], children: [ad] });
  const campaign = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', displayLabel: '同名Campaign', entryIndexes: [0, 1, 2], children: [adGroup] });
  const unattached = makeA183Node({ nodeKey: 'unattached-1', level: 'Ad Group', entityKey: 'orphan-adg', displayLabel: '未接続Ad Group', entryIndexes: [9] });
  const entries = [
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'campaign_name', settingRawValue: 'Campaign 1', csvRawValue: 'Campaign 1' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'budget', settingRawValue: '0', csvRawValue: false }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'unknown_campaign_field', settingRawValue: 'unknown', csvRawValue: 'unknown' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'device', settingRawValue: 'SP', csvRawValue: 'SP' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'budget', settingRawValue: '100', csvRawValue: '100', status: '不一致' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'budget', settingRawValue: '200', csvRawValue: '200', status: '需确认' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'partial_field', settingRawValue: '', csvRawValue: 'present' }),
    makeA183Entry({ level: 'Ad', entityKey: 'ad-1', field: 'creative_name', settingRawValue: 'Creative 1', csvRawValue: 'Creative 1' }),
    makeA183Entry({ level: 'Ad', entityKey: 'ad-1', field: 'creative_name', settingRawValue: 'Creative 2', csvRawValue: 'Creative 2' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'orphan-adg', field: 'device', settingRawValue: 'CTV', csvRawValue: 'CTV' }),
  ];
  return {
    entries,
    displayTree: { roots: [campaign], unattached: [unattached] },
    statusCounts: makeA183StatusCounts({ '一致': 7, '不一致': 1, '需确认': 1 }),
    matching: { matches: ['unchanged'] },
    schemaNotices: ['unchanged'],
  };
}

test('A18-3A Red: Campaign、Ad Group、Ad节点分别正确收集', () => {
  assert.equal(typeof api.collectTverDisplayNodesByLevel, 'function');
  const run = makeA183Run();
  assert.deepEqual(Array.from(api.collectTverDisplayNodesByLevel(run.displayTree, 'Campaign'), row => row.nodeKey), ['cp-1']);
  assert.deepEqual(Array.from(api.collectTverDisplayNodesByLevel(run.displayTree, 'Ad Group'), row => row.nodeKey), ['adg-1', 'unattached-1']);
  assert.deepEqual(Array.from(api.collectTverDisplayNodesByLevel(run.displayTree, 'Ad'), row => row.nodeKey), ['ad-1']);
});

test('A18-3A Red: 父路径只来自displayTree，不解析entityKey', () => {
  const run = makeA183Run();
  const row = api.collectTverDisplayNodesByLevel(run.displayTree, 'Ad')[0];
  assert.equal(row.parentDisplayLabel, '同名Ad Group');
  assert.deepEqual(Array.from(row.parentPath, parent => parent.displayLabel), ['同名Campaign', '同名Ad Group']);
  assert.deepEqual(Array.from(row.parentPath, parent => parent.nodeKey), ['cp-1', 'adg-1']);
});

test('A18-3A Red: 同名节点不会合并', () => {
  const first = makeA183Node({ nodeKey: 'cp-a', level: 'Campaign', entityKey: 'entity-a', displayLabel: '相同名称', entryIndexes: [0] });
  const second = makeA183Node({ nodeKey: 'cp-b', level: 'Campaign', entityKey: 'entity-b', displayLabel: '相同名称', entryIndexes: [1] });
  const rows = api.collectTverDisplayNodesByLevel({ roots: [first, second], unattached: [] }, 'Campaign');
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].rowKey, rows[1].rowKey);
  assert.deepEqual(Array.from(rows, row => Array.from(row.entryIndexes)), [[0], [1]]);
});

test('A18-3A Red: roots与children顺序保持', () => {
  const secondChild = makeA183Node({ nodeKey: 'adg-2', level: 'Ad Group', entityKey: 'adg-2', entryIndexes: [2] });
  const firstChild = makeA183Node({ nodeKey: 'adg-1', level: 'Ad Group', entityKey: 'adg-1', entryIndexes: [1] });
  const firstRoot = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0], children: [secondChild, firstChild] });
  const secondRoot = makeA183Node({ nodeKey: 'cp-2', level: 'Campaign', entityKey: 'cp-2', entryIndexes: [3] });
  const rows = api.collectTverDisplayNodesByLevel({ roots: [firstRoot, secondRoot], unattached: [] }, 'Ad Group');
  assert.deepEqual(Array.from(rows, row => row.nodeKey), ['adg-2', 'adg-1']);
});

test('A18-3A Red: unattached按原始顺序追加且标记未接続', () => {
  const root = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0] });
  const orphan = makeA183Node({ nodeKey: 'orphan-1', level: 'Campaign', entityKey: 'orphan-1', displayLabel: '孤立Campaign', entryIndexes: [1] });
  const rows = api.collectTverDisplayNodesByLevel({ roots: [root], unattached: [orphan] }, 'Campaign');
  assert.deepEqual(Array.from(rows, row => row.nodeKey), ['cp-1', 'orphan-1']);
  assert.equal(rows[1].parentDisplayLabel, '未接続');
  assert.deepEqual(Array.from(rows[1].parentPath), []);
});

test('A18-3A Red: 三个Level使用固定字段顺序', () => {
  assert.equal(typeof api.buildTverHorizontalColumns, 'function');
  const fields = {
    Campaign: ['campaign_name', 'start_datetime', 'end_datetime', 'budget', 'daily_budget', 'campaign_status'],
    'Ad Group': ['device', 'price', 'adgroup_status', 'media', 'local_broadcaster', 'gender', 'age', 'tver_video_duration', 'dmp_segment', 'pref', 'subgenre_exclude', 'store_segment', 'bid_segment'],
    Ad: ['creative_name', 'url', 'tracking_url_start', 'tracking_url_first_quartile', 'tracking_url_midpoint', 'tracking_url_third_quartile', 'tracking_url_complete', 'creative_id'],
  };
  const levelRuns = Object.fromEntries(Object.entries(fields).map(([level, levelFields]) => {
    const node = makeA183Node({ nodeKey: `node-${level}`, level, entityKey: `entity-${level}`, entryIndexes: levelFields.map((field, index) => index) });
    return [level, { entries: levelFields.map((field, index) => makeA183Entry({ level, entityKey: `entity-${level}`, field, settingRawValue: `${field}-setting`, csvRawValue: `${field}-csv` })), displayTree: { roots: [node], unattached: [] } }];
  }));
  assert.deepEqual(Array.from(api.buildTverHorizontalColumns(levelRuns['Campaign'], 'Campaign'), column => column.key).slice(0, 6), fields.Campaign);
  assert.deepEqual(Array.from(api.buildTverHorizontalColumns(levelRuns['Ad Group'], 'Ad Group'), column => column.key).slice(0, 13), fields['Ad Group']);
  assert.deepEqual(Array.from(api.buildTverHorizontalColumns(levelRuns.Ad, 'Ad'), column => column.key).slice(0, 8), fields.Ad);
});

test('A18-3A Red: 未知field按首次出现顺序追加到固定字段之后', () => {
  const run = makeA183Run();
  const keys = Array.from(api.buildTverHorizontalColumns(run, 'Campaign'), column => column.key);
  assert.deepEqual(keys.slice(-2), ['budget', 'unknown_campaign_field']);
});

test('A18-3A Red: 全实体为空的字段隐藏，部分为空字段保留', () => {
  const first = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0, 1] });
  const second = makeA183Node({ nodeKey: 'cp-2', level: 'Campaign', entityKey: 'cp-2', entryIndexes: [2] });
  const run = {
    entries: [
      makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'campaign_name', settingRawValue: 'A', csvRawValue: 'A' }),
      makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'partial_field', settingRawValue: 'x', csvRawValue: '' }),
      makeA183Entry({ level: 'Campaign', entityKey: 'cp-2', field: 'partial_field', settingRawValue: '', csvRawValue: '' }),
    ],
    displayTree: { roots: [first, second], unattached: [] },
  };
  const keys = Array.from(api.buildTverHorizontalColumns(run, 'Campaign'), column => column.key);
  assert.ok(!keys.includes('start_datetime'));
  assert.ok(keys.includes('partial_field'));
});

test('A18-3A Red: 数字0与布尔false不得判定为空', () => {
  const node = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0] });
  const run = {
    entries: [makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'budget', settingRawValue: 0, csvRawValue: false })],
    displayTree: { roots: [node], unattached: [] },
  };
  const keys = Array.from(api.buildTverHorizontalColumns(run, 'Campaign'), column => column.key);
  assert.ok(keys.includes('budget'));
});

test('A18-3A Red: 字段显示标签使用映射，未知field回退原始key', () => {
  assert.equal(api.buildTverHorizontalFieldLabel('Campaign', 'campaign_name'), 'キャンペーン名');
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'device'), 'デバイス');
  assert.equal(api.buildTverHorizontalFieldLabel('Ad', 'unknown_field'), 'unknown_field');
});

test('A18-3A Red: 重复field全部保留且顺序与entryIndexes一致', () => {
  const node = makeA183Node({ nodeKey: 'adg-1', level: 'Ad Group', entityKey: 'adg-1', entryIndexes: [2, 0, 1] });
  const entries = [
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'device', settingRawValue: 'first' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'device', settingRawValue: 'second' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'device', settingRawValue: 'third' }),
  ];
  const view = api.buildTverHorizontalViewModel({ entries, displayTree: { roots: [node], unattached: [] } }, 'Ad Group');
  assert.deepEqual(Array.from(view.rows[0].cells.device.entryIndexes), [2, 0, 1]);
  assert.deepEqual(Array.from(view.rows[0].cells.device.entries, entry => entry.settingRawValue), ['third', 'first', 'second']);
});

test('A18-3A Red: rowKey稳定且包含节点与父路径身份', () => {
  const run = makeA183Run();
  const row = api.collectTverDisplayNodesByLevel(run.displayTree, 'Ad')[0];
  assert.match(row.rowKey, /cp-1/);
  assert.match(row.rowKey, /adg-1/);
  assert.match(row.rowKey, /ad-1/);
  assert.equal(row.rowKey, api.collectTverDisplayNodesByLevel(run.displayTree, 'Ad')[0].rowKey);
});

test('A18-3A Red: directStatusCounts保持原始摘要且不重新计算', () => {
  const node = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0], directStatusCounts: { '一致': 7, '不一致': 3 } });
  const entry = makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'campaign_name', status: '需确认' });
  const view = api.buildTverHorizontalViewModel({ entries: [entry], displayTree: { roots: [node], unattached: [] } }, 'Campaign', { status: '要確認' });
  assert.deepEqual(JSON.parse(JSON.stringify(view.rows[0].directStatusCounts)), makeA183StatusCounts({ '一致': 7, '不一致': 3 }));
  assert.deepEqual(Array.from(view.rows[0].visibleEntryIndexes), [0]);
});

test('A18-3A Red: 筛选无匹配entry时隐藏实体行且不生成空行', () => {
  const first = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0] });
  const second = makeA183Node({ nodeKey: 'cp-2', level: 'Campaign', entityKey: 'cp-2', entryIndexes: [1] });
  const run = {
    entries: [
      makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'campaign_name', status: '一致' }),
      makeA183Entry({ level: 'Campaign', entityKey: 'cp-2', field: 'campaign_name', status: '不一致' }),
    ],
    displayTree: { roots: [first, second], unattached: [] },
  };
  const view = api.buildTverHorizontalViewModel(run, 'Campaign', { level: 'Campaign', status: '不一致', abnormalOnly: false, keyword: '' });
  assert.deepEqual(Array.from(view.rows, row => row.nodeKey), ['cp-2']);
});

test('A18-3A Red: view model每个field cell只保留通过现有entry筛选语义的entry', () => {
  const node = makeA183Node({ nodeKey: 'adg-1', level: 'Ad Group', entityKey: 'adg-1', entryIndexes: [0, 1] });
  const entries = [
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'device', status: '一致', targetName: 'keep' }),
    makeA183Entry({ level: 'Ad Group', entityKey: 'adg-1', field: 'device', status: '需确认', targetName: 'drop' }),
  ];
  const view = api.buildTverHorizontalViewModel({ entries, displayTree: { roots: [node], unattached: [] } }, 'Ad Group', { status: '要確認' });
  assert.deepEqual(Array.from(view.rows[0].cells.device.entryIndexes), [1]);
  assert.deepEqual(Array.from(view.rows[0].visibleEntryIndexes), [1]);
});

test('A18-3A Red: view model不复制Evidence且不改变entries、displayTree、entryIndexes', () => {
  const entry = makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'campaign_name', sourceEvidence: { setting: ['evidence'] }, derivedFrom: ['derived'] });
  const node = makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', entryIndexes: [0] });
  const run = { entries: [entry], displayTree: { roots: [node], unattached: [] }, matching: { keep: true }, statusCounts: { keep: true }, schemaNotices: ['keep'] };
  const before = JSON.stringify(run);
  const view = api.buildTverHorizontalViewModel(run, 'Campaign');
  assert.equal(view.rows[0].cells.campaign_name.entries[0], entry);
  assert.equal(Object.prototype.hasOwnProperty.call(view.rows[0], 'sourceEvidence'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(view.rows[0], 'derivedFrom'), false);
  assert.equal(JSON.stringify(run), before);
});

function horizontalEntityRows(html) {
  return [...String(html).matchAll(/<tr[^>]*data-row-key="([^"]+)"/g)].map(match => match[1]);
}

function horizontalFieldKeys(html) {
  return [...String(html).matchAll(/<th[^>]*data-column-key="([^"]+)"/g)]
    .map(match => match[1])
    .filter(key => !['no', 'target', 'parent', 'comparison'].includes(key));
}

function horizontalGroupLabels(html) {
  return [...String(html).matchAll(/class="tver-horizontal-group-row"[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>/g)].map(match => match[1]);
}

test('A18-3B Red: 默认结果包含三个Level页签及ARIA，默认Campaign', () => {
  const view = api.renderTverRun(makeA183Run(), { document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/class="tver-level-tab"/g) || []).length, 3);
  assert.match(view.html, /role="tablist"/);
  assert.match(view.html, /class="tver-level-tab"[^>]*data-level="Campaign"[^>]*aria-selected="true"/);
  assert.match(view.html, /role="tabpanel"/);
  assert.equal(view.activeLevel, 'Campaign');
});

test('A18-3B Red: 页签切换到Ad Group后保持当前Level且移除旧Level选择器', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(view.activeLevel, 'Ad Group');
  assert.match(view.html, /data-level="Ad Group"[^>]*aria-selected="true"/);
  assert.doesNotMatch(view.html, /id="filter-level"/);
  assert.doesNotMatch(view.html, /class="tver-display-tree"/);
});

test('A18-3B Red: 新案件与清除操作将Level重置为Campaign', () => {
  const cleared = api.clearTverPage({ activeLevel: 'Ad', filters: { level: 'Ad', status: 'all', abnormalOnly: false, keyword: '' } }, { document: null, revokeObjectUrl() {} });
  assert.equal(cleared.activeLevel, 'Campaign');
  const view = api.renderTverRun(makeA183Run(), { document: null, filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(view.activeLevel, 'Campaign');
});

test('A18-3B Red: 每个实体生成S/D两条横向数据行', () => {
  const run = makeA183Run();
  const campaign = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const adGroup = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const ad = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(horizontalEntityRows(campaign.html).length, 2);
  assert.equal(horizontalEntityRows(adGroup.html).length, 4);
  assert.equal(horizontalEntityRows(ad.html).length, 2);
});

test('A18-3B Red: 同名实体在横向表中不合并', () => {
  const first = makeA183Node({ nodeKey: 'same-cp-1', level: 'Campaign', entityKey: 'same-1', displayLabel: '同名Campaign', entryIndexes: [0] });
  const second = makeA183Node({ nodeKey: 'same-cp-2', level: 'Campaign', entityKey: 'same-2', displayLabel: '同名Campaign', entryIndexes: [1] });
  const run = {
    entries: [
      makeA183Entry({ level: 'Campaign', entityKey: 'same-1', field: 'campaign_name', settingRawValue: 'one', csvRawValue: 'one' }),
      makeA183Entry({ level: 'Campaign', entityKey: 'same-2', field: 'campaign_name', settingRawValue: 'two', csvRawValue: 'two' }),
    ],
    displayTree: { roots: [first, second], unattached: [] },
  };
  const rows = horizontalEntityRows(api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html);
  assert.equal(rows.length, 4);
  assert.equal(rows[0], rows[1]);
  assert.notEqual(rows[0], rows[2]);
});

test('A18-3B Red: Ad Group按Campaign、Ad按Ad Group生成分组行', () => {
  const run = makeA183Run();
  const adGroupHtml = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const adHtml = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.deepEqual(JSON.parse(JSON.stringify(horizontalGroupLabels(adGroupHtml))), ['同名Campaign', '未接続']);
  assert.deepEqual(JSON.parse(JSON.stringify(horizontalGroupLabels(adHtml))), ['同名Ad Group']);
});

test('A18-3B Red: 无匹配实体行及空分组同时隐藏', () => {
  const adGroup = makeA183Node({ nodeKey: 'adg-no-match', level: 'Ad Group', entityKey: 'adg-no-match', entryIndexes: [0] });
  const campaignWithMatch = makeA183Node({ nodeKey: 'cp-match', level: 'Campaign', entityKey: 'cp-match', entryIndexes: [], children: [adGroup] });
  const emptyAdGroup = makeA183Node({ nodeKey: 'adg-empty', level: 'Ad Group', entityKey: 'adg-empty', entryIndexes: [1] });
  const campaignWithoutMatch = makeA183Node({ nodeKey: 'cp-empty', level: 'Campaign', entityKey: 'cp-empty', entryIndexes: [], children: [emptyAdGroup] });
  const run = {
    entries: [
      makeA183Entry({ level: 'Ad Group', entityKey: 'adg-no-match', field: 'device', status: '一致' }),
      makeA183Entry({ level: 'Ad Group', entityKey: 'adg-empty', field: 'device', status: '一致' }),
    ],
    displayTree: { roots: [campaignWithMatch, campaignWithoutMatch], unattached: [] },
  };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '不一致', abnormalOnly: false, keyword: '' } });
  assert.equal(horizontalEntityRows(view.html).length, 0);
  assert.equal(horizontalGroupLabels(view.html).length, 0);
  assert.match(view.html, /当前の条件に一致する結果はありません|現在の条件に一致する結果はありません/);
});

test('A18-3B Red: 横向表具有三个固定列和Level动态列', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /<th[^>]*class="[^"]*tver-horizontal-fixed[^"]*"[^>]*>No\.<\/th>/);
  ['CPN訴求', '比較結果'].forEach(label => assert.match(view.html, new RegExp(`>${label}[\\s\\S]*?<\\/th>`)));
  assert.doesNotMatch(view.html, /父階層|data-column-key="parent"/);
  assert.doesNotMatch(view.html, /結果摘要|tver-horizontal-col-summary/);
  assert.ok(horizontalFieldKeys(view.html).includes('campaign_name'));
});

test('A18-3B Red: 字段列基于未筛选数据，筛选前后列集合与顺序不变', () => {
  const run = makeA183Run();
  const before = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const after = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '需确认', abnormalOnly: false, keyword: '' } });
  assert.deepEqual(JSON.parse(JSON.stringify(horizontalFieldKeys(before.html))), JSON.parse(JSON.stringify(horizontalFieldKeys(after.html))));
});

test('A18-3B Red: 单元格上下显示設定表值与CSV值，且重复field按原序堆叠', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /data-source-kind="setting">設定表<\/td>/);
  assert.match(view.html, /data-source-kind="csv">CSV<\/td>/);
  assert.doesNotMatch(view.html, /S: 設定表値|D: CSV値（ダウンロード）/);
  assert.match(view.html, /Creative 1/);
  assert.match(view.html, /Creative 2/);
  assert.ok(view.html.indexOf('Creative 1') < view.html.indexOf('Creative 2'));
  assert.match(view.html, /data-entry-index="7"/);
  assert.match(view.html, /data-entry-index="8"/);
});

test('A18-3B Red: 横向单元格全部动态文本HTML转义', () => {
  const run = makeA183Run();
  run.entries[7] = { ...run.entries[7], settingRawValue: '<img src="x">', csvRawValue: '"&', targetName: '<target>' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /&lt;img src=&quot;x&quot;&gt;/);
  assert.match(view.html, /&quot;&amp;/);
  assert.doesNotMatch(view.html, /<img src="x">/);
});

test('A18-3B Red: 状态、异常、关键词及组合筛选投影到横向单元格', () => {
  const run = makeA183Run();
  const status = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '要確認', abnormalOnly: false, keyword: '' } });
  assert.match(status.html, /data-entry-index="5"/);
  assert.doesNotMatch(status.html, /data-entry-index="3"|data-entry-index="4"/);
  const abnormal = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: true, keyword: '' } });
  assert.match(abnormal.html, /data-entry-index="4"|data-entry-index="5"/);
  const keyword = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: 'present' } });
  assert.match(keyword.html, /data-entry-index="6"/);
  const combined = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '要確認', abnormalOnly: true, keyword: 'present' } });
  assert.equal(horizontalEntityRows(combined.html).length, 0);
});

test('A18-3B Red: 界面要確認正确筛选displayStatus为需确认', () => {
  const run = makeA183Run();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '要確認', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /要確認/);
  assert.match(view.html, /data-entry-index="5"/);
});

test('A18-3B Red: 筛选不重新计算顶部三状态统计', () => {
  const node = makeA183Node({ nodeKey: 'cp-summary', level: 'Campaign', entityKey: 'cp-summary', entryIndexes: [0, 1], directStatusCounts: { '一致': 7, '需确认': 1 } });
  const run = { entries: [
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-summary', field: 'campaign_name', status: '一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-summary', field: 'budget', status: '需确认' }),
  ], displayTree: { roots: [node], unattached: [] }, statusCounts: makeA183StatusCounts({ '一致': 1, '需确认': 1 }) };
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: '要確認', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="status-count tver-status-consistent"[^>]*>[\s\S]*?<strong>1<\/strong>/);
  assert.match(view.html, /class="status-count tver-status-review"[^>]*>[\s\S]*?<strong>1<\/strong>/);
  assert.match(view.html, /data-entry-index="1"/);
});

test('A18-3B Red: 默认横向结果不再生成旧树DOM但旧树纯函数仍存在', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.doesNotMatch(view.html, /tver-display-tree/);
  assert.equal(typeof api.renderTverDisplayTree, 'function');
  assert.equal(typeof api.buildTverDisplayTreeHtml, 'function');
});

test('A18-3C1 Red: 详细扁平表数据仍保留在返回值但不进入默认DOM', () => {
  const run = makeA182ARun();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.deepEqual(JSON.parse(JSON.stringify(view.displayedEntries.map(entry => entry.field))), ['adgroup-field-1', 'adgroup-field-4']);
  assert.doesNotMatch(view.html, /class="results-table"/);
  assert.doesNotMatch(view.html, /campaign-field-|ad-field-/);
});

test('A18-3B Red: 横向渲染前后entries、displayTree、entryIndexes不变', () => {
  const run = makeA183Run();
  const before = JSON.stringify(run);
  api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: '需确认', abnormalOnly: false, keyword: '' } });
  assert.equal(JSON.stringify(run), before);
});

test('A18-3B Red: 横向滚动、sticky表头和固定列CSS存在且不会把页面撑宽', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /\.tver-horizontal-scroll[^}]*overflow-x:auto[^}]*overflow-y:clip/);
  assert.match(html, /\.tver-horizontal-table thead th[^}]*position:sticky/);
  assert.match(html, /\.tver-horizontal-fixed[^}]*position:sticky/);
  assert.match(html, /\.tver-horizontal-scroll[^}]*max-width:100%/);
});

function makeMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
  };
}

function horizontalDataRow(html, variant) {
  const match = String(html).match(new RegExp(`<tr[^>]*data-row-key="[^"]+"[^>]*data-row-variant="${variant}"[\\s\\S]*?<\\/tr>`));
  return match ? match[0] : '';
}

function horizontalDataEntryIndexes(html, variant) {
  return [...horizontalDataRow(html, variant).matchAll(/data-entry-index="(\d+)"/g)].map(match => Number(match[1]));
}

test('A18-3C1 Red: 五状态展示投影只输出三状态且案件②示例合计正确', () => {
  assert.equal(typeof api.projectTverDisplayStatus, 'function');
  assert.equal(api.projectTverDisplayStatus('一致'), '一致');
  assert.equal(api.projectTverDisplayStatus('表記ゆれ一致'), '一致');
  assert.equal(api.projectTverDisplayStatus('不一致'), '不一致');
  assert.equal(api.projectTverDisplayStatus('需确认'), '要確認');
  assert.equal(api.projectTverDisplayStatus('未匹配'), '要確認');
  assert.deepEqual(JSON.parse(JSON.stringify(api.projectTverStatusCounts({ '一致': 115, '表記ゆれ一致': 0, '不一致': 2, '需确认': 100, '未匹配': 71 }))), { '一致': 115, '不一致': 2, '要確認': 171 });
});

test('C3-C1 Red: Campaign每个实体只生成一对来源行且字段格不再重复S-D标签', () => {
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const settingRow = horizontalDataRow(html, 'setting');
  const csvRow = horizontalDataRow(html, 'csv');
  assert.equal((html.match(/class="tver-horizontal-source-row-label"/g) || []).length, 2);
  assert.equal((settingRow.match(/tver-horizontal-source-row-label/g) || []).length, 1);
  assert.equal((csvRow.match(/tver-horizontal-source-row-label/g) || []).length, 1);
  assert.match(settingRow, />設定表<\/td>/);
  assert.match(csvRow, />CSV<\/td>/);
  assert.doesNotMatch(settingRow, /S:\s*設定表値|D:\s*CSV値（ダウンロード）/);
  assert.doesNotMatch(csvRow, /S:\s*設定表値|D:\s*CSV値（ダウンロード）/);
});

test('C3-C1 Red: No対象名比較結果在实体两行之间只出现一次', () => {
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*tver-horizontal-col-no[^>]*rowspan="2"/g) || []).length, 1);
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*tver-horizontal-col-target[^>]*rowspan="2"/g) || []).length, 1);
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*tver-horizontal-col-comparison[^>]*rowspan="2"/g) || []).length, 1);
  assert.equal((html.match(/class="tver-horizontal-source-row-label"/g) || []).length, 2);
});

test('C3-C1 Red: 多个字段共享同一对設定表与CSV source row', () => {
  const run = makeA183Run();
  run.entries = [
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'campaign_name', settingRawValue: 'Campaign A', csvRawValue: 'Campaign A' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'budget', settingRawValue: '100', csvRawValue: '100' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'daily_budget', settingRawValue: '50', csvRawValue: '50' }),
  ];
  run.displayTree = { roots: [makeA183Node({ nodeKey: 'cp-1', level: 'Campaign', entityKey: 'cp-1', displayLabel: 'Campaign A', entryIndexes: [0, 1, 2] })], unattached: [] };
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const settingRow = horizontalDataRow(html, 'setting');
  const csvRow = horizontalDataRow(html, 'csv');
  assert.equal((settingRow.match(/tver-horizontal-source-row-label/g) || []).length, 1);
  assert.equal((csvRow.match(/tver-horizontal-source-row-label/g) || []).length, 1);
  assert.match(settingRow, /Campaign A[\s\S]*100[\s\S]*50/);
  assert.match(csvRow, /Campaign A[\s\S]*100[\s\S]*50/);
});

test('C3-C1 Red: Campaign固定为兩条source row且欄位header只生成一份', () => {
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.deepEqual([...html.matchAll(/data-row-variant="(setting|csv)"/g)].map(match => match[1]), ['setting', 'csv']);
  assert.equal((html.match(/data-column-key="budget"/g) || []).length >= 3, true);
  assert.equal((html.match(/class="tver-horizontal-source-row-label"/g) || []).length, 2);
});

test('C3-C1 Red: Ad Group保留父级group header并使用相同兩行结构', () => {
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /class="tver-horizontal-group-row"/);
  assert.equal((html.match(/data-row-variant="(?:setting|csv)"/g) || []).length, 4);
  assert.equal((html.match(/class="tver-horizontal-source-row-label"/g) || []).length, 4);
  assert.match(html, /同名Campaign/);
});

test('C3-C1 Red: Ad使用相同兩行结构且来源标签不随字段重复', () => {
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.deepEqual([...html.matchAll(/data-row-variant="(setting|csv)"/g)].map(match => match[1]), ['setting', 'csv']);
  assert.equal((html.match(/class="tver-horizontal-source-row-label"/g) || []).length, 2);
  assert.equal((horizontalDataRow(html, 'setting').match(/tver-horizontal-source-row-label/g) || []).length, 1);
  assert.equal((horizontalDataRow(html, 'csv').match(/tver-horizontal-source-row-label/g) || []).length, 1);
});

test('C3-C1 Red: 三状态判定badge只使用一致不一致要確認并强化语义class', () => {
  const entries = [
    makeA183Entry({ level: 'Campaign', entityKey: 'status-cp', field: 'campaign_name', status: '一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'status-cp', field: 'budget', status: '表記ゆれ一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'status-cp', field: 'daily_budget', status: '不一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'status-cp', field: 'start_datetime', status: '需确认' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'status-cp', field: 'end_datetime', status: '未匹配' }),
  ];
  const run = { entries, displayTree: { roots: [makeA183Node({ nodeKey: 'status-cp', level: 'Campaign', entityKey: 'status-cp', entryIndexes: entries.map((_, index) => index) })], unattached: [] }, statusCounts: makeA183StatusCounts() };
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const displayedStatuses = [...html.matchAll(/data-entity-status="([^"]+)"/g)].map(match => match[1]);
  assert.ok(displayedStatuses.every(status => ['一致', '不一致', '要確認'].includes(status)));
  assert.match(html, /tver-status-consistent/);
  assert.match(html, /tver-status-mismatch/);
  assert.match(html, /tver-status-review/);
});

test('C3-C1 Red: source列不加入可调宽字段且字段宽度由两条source row共同使用', () => {
  const storage = makeMemoryStorage({
    [api.TVER_COLUMN_WIDTH_STORAGE_KEY]: JSON.stringify({ Campaign: { budget: 240 } }),
  });
  const view = api.buildTverHorizontalViewModel(makeA183Run(), 'Campaign');
  const html = api.buildTverHorizontalTableHtml(view, { storage });
  assert.equal((html.match(/data-action="resize-column"[^>]*data-column-key="source"/g) || []).length, 0);
  assert.match(html, /data-column-key="source"[^>]*style="width:\d+px;min-width:\d+px"/);
  assert.equal((html.match(/data-column-key="budget"[^>]*style="width:240px;min-width:240px"/g) || []).length >= 3, true);
  assert.match(html, /--tver-dynamic-width:\d+px/);
});

test('C3-C1 Red: C3-B-V3横向source/access DOM与sticky header继续存在', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(source, /\.tver-horizontal-scroll-access\{/);
  assert.match(source, /\.tver-horizontal-sticky-header\{[^}]*position:sticky/);
  assert.match(html, /class="tver-horizontal-sticky-header"/);
  assert.match(html, /class="tver-horizontal-scroll-access"/);
  assert.match(html, /class="tver-horizontal-scroll"/);
  assert.match(html, /data-tver-sticky-header-track/);
});

test('C3-C1 Red: 结果表不引入内部纵向scrollbar', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /tver-horizontal-scroll[^}]*overflow-y\s*:\s*(?:auto|scroll)/);
  assert.doesNotMatch(source, /tver-horizontal-(?:result-viewport|scroll-region)/);
  assert.doesNotMatch(source, /max-height\s*:\s*min\(72vh/);
});

test('C3-C1 Red: 三个Level的动态文本继续HTML escape且不使用innerHTML注入值', () => {
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const field = level === 'Campaign' ? 'campaign_name' : level === 'Ad Group' ? 'device' : 'creative_name';
    const entry = makeA183Entry({ level, entityKey: `escape-${level}`, field, settingRawValue: '<script>alert(1)</script>', csvRawValue: '" onmouseover="alert(2)' });
    const node = makeA183Node({ nodeKey: `escape-${level}`, level, entityKey: `escape-${level}`, entryIndexes: [0] });
    const html = api.renderTverRun({ entries: [entry], displayTree: { roots: [node], unattached: [] } }, { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /innerHTML\s*=\s*.*settingRawValue/);
  }
});

test('C3-C2 Red: 业务值单元格取消内缩padding并保留无圆角无阴影的flat entry', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-table tbody td\.tver-horizontal-cell-toggle\{[^}]*padding:0/);
  const entryRule = source.match(/\.tver-horizontal-cell-entry\{([^}]*)\}/);
  assert.ok(entryRule);
  assert.match(entryRule[1], /border-radius:0/);
  assert.doesNotMatch(entryRule[1], /box-shadow/);
  assert.doesNotMatch(entryRule[1], /margin:/);
});

test('C3-C2 Red: semantic背景直接覆盖业务值data cell的完整可用区域', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /<td class="[^"]*tver-horizontal-cell-toggle[^"]*tver-status-(?:consistent|mismatch|review)[^"]*"[^>]*data-field-key="/);
  assert.doesNotMatch(view.html, /class="tver-horizontal-cell-entry tver-status-/);
});

test('C3-C2 Red: 一致颜色比不一致与要確認明显更淡且三状态颜色都存在', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-status-consistent\{background:#f1f8f2\}/);
  assert.match(source, /\.tver-status-mismatch\{background:#fdecec\}/);
  assert.match(source, /\.tver-status-review\{background:#fff6e5\}/);
});

test('C3-C2 Red: 比較結果仍保留实体级badge与状态边框强调', () => {
  const run = makeA183Run();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="tver-horizontal-entity-status[^\"]*tver-status-(?:consistent|mismatch|review)/);
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-entity-status\{[^}]*border:1px solid/);
  assert.match(source, /\.tver-horizontal-entity-status\{[^}]*border-radius:4px/);
});

test('C3-C2 Red: 来源列仍是設定表与CSV的稳定行标签', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /data-source-kind="setting">設定表<\/td>/);
  assert.match(view.html, /data-source-kind="csv">CSV<\/td>/);
  assert.equal((view.html.match(/class="tver-horizontal-source-row-label"/g) || []).length, 2);
});

test('C3-C2 Red: No対象名比較結果仍在实体两行之间使用rowspan', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
});

test('C3-C2 Red: Campaign每个实体仍固定输出設定表与CSV两行', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/<tr[^>]*data-row-variant="/g) || []).length, 2);
  assert.match(view.html, /data-row-variant="setting"/);
  assert.match(view.html, /data-row-variant="csv"/);
});

test('C3-C2 Red: Ad Group与Ad的父级group header仍保留', () => {
  ['Ad Group', 'Ad'].forEach(level => {
    const view = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
    assert.match(view.html, /class="tver-horizontal-group-row"/);
  });
});

test('C3-C2 Red: horizontal scroll access与sticky header DOM仍保留', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="tver-horizontal-scroll"/);
  assert.match(view.html, /class="tver-horizontal-scroll-access"/);
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-sticky-header\{[^}]*position:sticky/);
});

test('C3-C2 Red: 字段column resize结构仍保留且来源列不变成resize handle', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /data-action="resize-column"/);
  assert.doesNotMatch(view.html, /data-action="resize-column"[^>]*data-column-key="source"/);
});

test('C3-C2 Red: 业务结果区域不新增内部纵向scrollbar', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-scroll\{[^}]*overflow-x:auto[^}]*overflow-y:clip/);
  assert.doesNotMatch(source, /\.tver-horizontal-scroll\{[^}]*overflow-y:(?:auto|scroll)/);
  assert.doesNotMatch(source, /\.tver-horizontal-scroll-access\{[^}]*position:(?:fixed|absolute|sticky)/);
});

test('C3-C2 Red: URL等长字段继续保留title与truncate/overflow保护', () => {
  const longValue = 'https://example.test/tracking/'.repeat(30);
  const run = makeA183Run();
  run.entries[7] = { ...run.entries[7], settingRawValue: longValue, csvRawValue: `${longValue}-csv`, field: 'trackingComplete' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="tver-horizontal-cell-value"[^>]*title="https:\/\/example\.test\/tracking\//);
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-cell-value\{[^}]*overflow:hidden/);
  assert.match(source, /\.tver-horizontal-cell-value\{[^}]*text-overflow:ellipsis/);
});

test('C3-C2-Fix1 Red: 一致semantic class直接落在完整业务字段td', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const settingRow = horizontalDataRow(view.html, 'setting');
  assert.match(settingRow, /<td class="[^"]*tver-horizontal-cell-toggle[^"]*tver-status-consistent[^"]*"[^>]*data-field-key="device"/);
});

test('C3-C2-Fix1 Red: 不一致semantic class直接落在完整业务字段td', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const settingRow = horizontalDataRow(view.html, 'setting');
  assert.match(settingRow, /<td class="[^"]*tver-horizontal-cell-toggle[^"]*tver-status-mismatch[^"]*"[^>]*data-field-key="budget"/);
});

test('C3-C2-Fix1 Red: 要確認semantic class直接落在完整业务字段td', () => {
  const run = makeA183Run();
  run.entries[6] = { ...run.entries[6], comparisonStatus: '需确认', displayStatus: '需确认' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const settingRow = horizontalDataRow(view.html, 'setting');
  assert.match(settingRow, /<td class="[^"]*tver-horizontal-cell-toggle[^"]*tver-status-review[^"]*"[^>]*data-field-key="partial_field"/);
});

test('C3-C2-Fix1 Red: 空字符串value的設定表与CSV cell仍保留要確認完整背景契约', () => {
  const run = makeA183Run();
  run.entries[6] = { ...run.entries[6], comparisonStatus: '需确认', displayStatus: '需确认', settingRawValue: '', csvRawValue: 'present' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const settingRow = horizontalDataRow(view.html, 'setting');
  const csvRow = horizontalDataRow(view.html, 'csv');
  assert.match(settingRow, /<td class="[^"]*tver-horizontal-cell-toggle[^"]*tver-status-review[^"]*"[^>]*data-field-key="partial_field"[^>]*>[\s\S]*title=""><\/span>[\s\S]*<\/td>/);
  assert.match(csvRow, /<td class="[^"]*tver-horizontal-cell-toggle[^"]*tver-status-review[^"]*"[^>]*data-field-key="partial_field"/);
});

test('C3-C2-Fix1 Red: semantic背景不再落在inner entry且旧card-like背景不回归', () => {
  const run = makeA183Run();
  run.entries[6] = { ...run.entries[6], comparisonStatus: '需确认', displayStatus: '需确认' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(view.html, /class="tver-horizontal-cell-entry tver-status-/);
  assert.match(source, /\.tver-horizontal-cell-entry\{[^}]*background:transparent/);
  assert.doesNotMatch(source, /\.tver-horizontal-cell-entry\{[^}]*background:(?!transparent)/);
});

test('C3-C2-Fix1 Red: full-cell修正不退化C3-C1两行与rowspan结构', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/<tr[^>]*data-row-variant="/g) || []).length, 2);
  assert.equal((view.html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.match(view.html, /data-source-kind="setting">設定表<\/td>/);
  assert.match(view.html, /data-source-kind="csv">CSV<\/td>/);
});

function makeC3C3CampaignRun(fields, options = {}) {
  const campaignKey = options.campaignKey || 'c3-cp-1';
  const campaign = makeA183Node({
    nodeKey: campaignKey,
    level: 'Campaign',
    entityKey: campaignKey,
    displayLabel: options.displayLabel || 'Campaign target',
    entryIndexes: fields.map((field, index) => index),
  });
  const entries = fields.map((field, index) => makeA183Entry({
    level: 'Campaign',
    entityKey: campaignKey,
    field,
    status: options.statusByField && options.statusByField[field] || '一致',
    settingRawValue: `${field}-setting`,
    csvRawValue: `${field}-csv`,
  }));
  if (options.includeChildEntries) {
    const adGroupIndex = entries.length;
    const adIndex = entries.length + 1;
    const adGroup = makeA183Node({
      nodeKey: 'c3-adg-1',
      level: 'Ad Group',
      entityKey: 'c3-adg-1',
      displayLabel: 'Ad Group target',
      entryIndexes: [adGroupIndex],
      children: [makeA183Node({ nodeKey: 'c3-ad-1', level: 'Ad', entityKey: 'c3-ad-1', displayLabel: 'Ad target', entryIndexes: [adIndex] })],
    });
    campaign.children = [adGroup];
    entries.push(
      makeA183Entry({ level: 'Ad Group', entityKey: 'c3-adg-1', field: 'device', settingRawValue: 'ctv', csvRawValue: 'ctv' }),
      makeA183Entry({ level: 'Ad', entityKey: 'c3-ad-1', field: 'creative_name', settingRawValue: 'creative.mp4', csvRawValue: 'creative.mp4' }),
    );
  }
  return {
    entries,
    displayTree: { roots: [campaign], unattached: [] },
    statusCounts: makeA183StatusCounts(),
    matching: { matches: [] },
    schemaNotices: [],
  };
}

function makeC3C3CampaignContractRun({ schema = 'edit', campaignCsv = {}, settingFields = {} } = {}) {
  const campaignName = 'C3-C3-Fix1 Campaign';
  const startDateTime = '2026/08/01 00:00';
  const endDateTime = '2026/08/31 23:30';
  const expectedName = `${campaignName}_260801-0831_Contract`;
  const source = (columnName, rawValue, rowNumber = 12) => ({
    fileName: `c3-c3-fix1-${schema}.xlsx`, sheetName: 'Synthetic', rowNumber, columnName, rawValue: String(rawValue ?? ''),
  });
  const csvRow = {
    campaign_name: expectedName,
    start_datetime: startDateTime,
    end_datetime: endDateTime,
    budget: '900',
    daily_budget: '30',
    hourly_bid_weight: '',
    campaign_status: '0',
    consumption_type: '2',
    cv_point: '',
    report_target_flag: '1',
    adgroup_name: 'C3-C3-Fix1 Ad Group',
    creative_name: 'c3-c3-fix1.mp4',
    url: 'https://example.invalid/c3-c3-fix1',
    device: 'ctv',
    price: '11',
    ...(schema === 'register' ? { budget_type: '2' } : {}),
    ...campaignCsv,
  };
  const parsed = api.parseCsvText(
    schema === 'register' ? makeRegisterCsv([csvRow]) : makeEditCsv([{ ...csvRow, campaign_id: '3001', adgroup_id: '4001', ad_id: '5001' }]),
    { fileName: `c3-c3-fix1-${schema}.csv` },
  );
  const csvTree = schema === 'register' ? api.buildRegisterTree(parsed) : api.buildEditTree(parsed);
  const campaignKey = 'c3-c3-fix1-setting-campaign';
  const settingValues = {
    campaignName,
    campaignAppeal: 'Contract',
    campaignBudget: '900',
    startDateTime,
    endDateTime,
    initialDailyBudget: '30',
    otherSettings: '初動からフルモード',
    cvMode: 'なし',
    cvPoint: '',
    ...settingFields,
  };
  const settingFieldsBySource = {
    campaignName: '発注CPN名', campaignAppeal: 'CPN訴求', campaignBudget: 'CPN予算',
    startDateTime: '開始日時(yyyy/mm/dd hh:mm)', endDateTime: '終了日時(yyyy/mm/dd hh:mm)',
    initialDailyBudget: '初期設定日予算', otherSettings: 'その他設定', cvMode: 'CV', cvPoint: 'CVポイント',
  };
  const settingSources = Object.fromEntries(Object.entries(settingFieldsBySource).map(([field, columnName]) => [field, source(columnName, settingValues[field])]));
  const settingCampaign = {
    key: campaignKey,
    level: 'Campaign',
    expectedName,
    fields: settingValues,
    sourceRefs: settingSources,
    sourceEvidence: { fields: Object.fromEntries(Object.entries(settingSources).map(([field, ref]) => [field, [ref]])), derived: {} },
  };
  const csvCampaign = csvTree.campaigns[0];
  const matching = {
    matches: [{ status: 'matched', level: 'Campaign', settingKey: campaignKey, csvKey: csvCampaign.key, reasonCode: 'TEST_MATCH' }],
    unmatched: { setting: [], csv: [] }, unassigned: { setting: [], csv: [] }, orphans: [], diagnostics: [],
  };
  const run = api.buildRunFromModels(
    { campaigns: [settingCampaign], adGroups: [], ads: [], diagnostics: [] },
    csvTree,
    matching,
    parsed,
  );
  return { run, parsed, settingCampaign, csvCampaign };
}

function findCampaignEntry(run, field) {
  return run.entries.find(entry => entry.level === 'Campaign' && entry.field === field);
}

test('C3-C3-Fix1 Red: Campaign status default 0 must compare as 一致, not CSV-only 需确认', () => {
  const { run } = makeC3C3CampaignContractRun({ campaignCsv: { campaign_status: '0' } });
  const entry = findCampaignEntry(run, 'campaign_status');
  assert.ok(entry);
  assert.equal(entry.settingRawValue, '0');
  assert.equal(entry.comparisonStatus, '一致');

  const mismatch = findCampaignEntry(makeC3C3CampaignContractRun({ campaignCsv: { campaign_status: '1' } }).run, 'campaign_status');
  assert.equal(mismatch.settingRawValue, '0');
  assert.equal(mismatch.comparisonStatus, '不一致');
});

test('C3-C3-Fix1 Red: consumption_type must generate an independent Setting-derived Entry', () => {
  const { run } = makeC3C3CampaignContractRun({ campaignCsv: { consumption_type: '2' } });
  const entry = findCampaignEntry(run, 'consumption_type');
  assert.ok(entry);
  assert.equal(entry.settingRawValue, '2');
  assert.equal(entry.csvRawValue, '2');
  assert.equal(entry.comparisonStatus, '一致');
  assert.notEqual(entry.sourceRefs.setting && entry.sourceRefs.setting.fileName, entry.sourceRefs.csv && entry.sourceRefs.csv.fileName);

  const mismatch = findCampaignEntry(makeC3C3CampaignContractRun({ campaignCsv: { consumption_type: '1' } }).run, 'consumption_type');
  assert.equal(mismatch.settingRawValue, '2');
  assert.equal(mismatch.comparisonStatus, '不一致');
});

test('C3-C3-Fix1 Red: CVなし + CSV空值 must keep a comparable blank Entry', () => {
  const { run } = makeC3C3CampaignContractRun({ campaignCsv: { cv_point: '' } });
  const entry = findCampaignEntry(run, 'cv_point');
  assert.ok(entry);
  assert.equal(entry.settingRawValue, '');
  assert.equal(entry.csvRawValue, '');
  assert.equal(entry.comparisonStatus, '一致');
  assert.equal(entry.comparable, true);
  assert.ok(run.displayTree.roots[0].entryIndexes.includes(run.entries.indexOf(entry)));
});

test('C3-C3-Fix5 Red: report_target_flag raw data保留但不生成Campaign QC Entry', () => {
  const { run, parsed, csvCampaign } = makeC3C3CampaignContractRun({ schema: 'register', campaignCsv: { report_target_flag: '' } });
  assert.equal(parsed.schema.canonicalHeaders.includes('report_target_flag'), true);
  assert.equal(csvCampaign.rawRows[0].values.report_target_flag, '');
  assert.equal(findCampaignEntry(run, 'report_target_flag'), undefined);
  assert.equal(api.buildTverHorizontalColumns(run, 'Campaign').some(column => column.key === 'report_target_flag'), false);
  const view = api.buildTverHorizontalViewModel(run, 'Campaign');
  assert.equal(view.rows[0].entityDisplayStatus, '一致');
});

test('C3-C3-Fix1 Red: hourly_bid_weight remains visible as non-comparable 需确认 while the rule is pending', () => {
  const { run } = makeC3C3CampaignContractRun({ campaignCsv: { hourly_bid_weight: '' } });
  const entry = findCampaignEntry(run, 'hourly_bid_weight');
  assert.ok(entry);
  assert.equal(entry.comparisonStatus, '需确认');
  assert.equal(entry.comparable, false);
  assert.equal(entry.ruleBasis, 'HOURLY_BID_WEIGHT_RULE_PENDING');
  assert.ok(!api.buildTverHorizontalColumns(run, 'Campaign').some(column => column.key === 'hourly_bid_weight'));
});

test('C3-C3-Fix1 Red: register budget_type uses independent default 2 and edit schema omits it', () => {
  const registerMatch = findCampaignEntry(makeC3C3CampaignContractRun({ schema: 'register', campaignCsv: { budget_type: '2' } }).run, 'budget_type');
  assert.ok(registerMatch);
  assert.equal(registerMatch.settingRawValue, '2');
  assert.equal(registerMatch.csvRawValue, '2');
  assert.equal(registerMatch.comparisonStatus, '一致');

  const registerMismatch = findCampaignEntry(makeC3C3CampaignContractRun({ schema: 'register', campaignCsv: { budget_type: '1' } }).run, 'budget_type');
  assert.ok(registerMismatch);
  assert.equal(registerMismatch.settingRawValue, '2');
  assert.equal(registerMismatch.comparisonStatus, '不一致');

  const edit = makeC3C3CampaignContractRun({ schema: 'edit' });
  assert.equal(findCampaignEntry(edit.run, 'budget_type'), undefined);
  assert.ok(!api.buildTverHorizontalColumns(edit.run, 'Campaign').some(column => column.key === 'budget_type'));
});

test('C3-C3-Fix2 Red: hourly_bid_weight空值保留Entry但整列不显示，任一非空时显示整列', () => {
  const emptyRun = makeC3C3CampaignContractRun({ campaignCsv: { hourly_bid_weight: '' } }).run;
  assert.ok(findCampaignEntry(emptyRun, 'hourly_bid_weight'));
  assert.ok(!api.buildTverHorizontalColumns(emptyRun, 'Campaign').some(column => column.key === 'hourly_bid_weight'));
  assert.doesNotMatch(api.renderTverRun(emptyRun, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html, /data-column-key="hourly_bid_weight"/);

  const nonemptyRun = makeC3C3CampaignContractRun({ campaignCsv: { hourly_bid_weight: '0時100' } }).run;
  assert.ok(api.buildTverHorizontalColumns(nonemptyRun, 'Campaign').some(column => column.key === 'hourly_bid_weight'));
  assert.match(api.renderTverRun(nonemptyRun, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html, /data-column-key="hourly_bid_weight"/);
});

test('C3-C3-Fix2 Red: Campaign Setting行只显示业务label，CSV行保留原始值且comparison不变', () => {
  const { run } = makeC3C3CampaignContractRun({ schema: 'register', campaignCsv: {
    campaign_status: '0', consumption_type: '2', cv_point: '', report_target_flag: '1', budget_type: '2',
  } });
  const before = JSON.stringify(run.entries.map(entry => ({ field: entry.field, settingRawValue: entry.settingRawValue, csvRawValue: entry.csvRawValue, comparisonStatus: entry.comparisonStatus, canonicalValues: entry.canonicalValues })));
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const settingRow = horizontalDataRow(html, 'setting');
  const csvRow = horizontalDataRow(html, 'csv');
  assert.match(settingRow, /無効（規定値）/);
  assert.match(settingRow, />フル<\/span>/);
  assert.match(settingRow, />なし<\/span>/);
  assert.match(settingRow, />期間予算<\/span>/);
  assert.doesNotMatch(csvRow, /無効（規定値）|なし|対象外|対象<\/span>/);
  assert.match(csvRow, /title="2（期間予算）">2（期間予算）<\/span>/);
  assert.match(csvRow, /title="0（無効）">0（無効）<\/span>/);
  assert.match(csvRow, /title="2（フル）">2（フル）<\/span>/);
  assert.equal(JSON.stringify(run.entries.map(entry => ({ field: entry.field, settingRawValue: entry.settingRawValue, csvRawValue: entry.csvRawValue, comparisonStatus: entry.comparisonStatus, canonicalValues: entry.canonicalValues }))), before);
});

test('C3-C3-Fix2 Red: Reset清空文件、结果、状态、滚动并允许下一组上传', async () => {
  const classes = initial => {
    const values = new Set(initial || []);
    return {
      add(name) { values.add(name); },
      remove(name) { values.delete(name); },
      toggle(name, force) { const next = force === undefined ? !values.has(name) : Boolean(force); if(next) values.add(name); else values.delete(name); return next; },
      contains(name) { return values.has(name); },
    };
  };
  const elements = {
    'tver-file-input': { value: 'selected.xlsx' },
    'setting-file-state': { textContent: '設定表：selected.xlsx', classList: classes(['success']) },
    'csv-file-state': { textContent: 'CSV：selected.csv', classList: classes(['success']) },
    'upload-recognition-state': { textContent: '識別済み', classList: classes(['success']) },
    'tver-upload-zone': { classList: classes(['drag-over']) },
    'page-notice': { textContent: 'old error', classList: classes(['error']) },
    'results-panel': { innerHTML: '<div>old result</div>', scrollLeft: 140, classList: classes([]) },
    'tver-result-summary': { innerHTML: '<div>old counts</div>', classList: classes([]) },
    'run-check': { disabled: false },
    'reset-check': { disabled: false },
    'copy-exceptions': { disabled: false },
    'export-exceptions': { disabled: false },
  };
  const document = { getElementById(id) { return elements[id] || null; } };
  const readers = makeC2Readers();
  const { setting, csv } = makeC2ValidFiles();
  api.clearTverPage(undefined, { document: null, revokeObjectUrl() {} });
  await api.setPageFiles([setting, csv], document, readers);
  const state = api.getTverPageState();
  state.run = makeA183Run();
  state.activeLevel = 'Ad';
  state.filters = { level: 'Ad', status: '需确认', abnormalOnly: true, keyword: 'old' };
  elements['tver-file-input'].value = 'selected.xlsx';
  elements['results-panel'].innerHTML = '<div>old result</div>';
  elements['results-panel'].scrollLeft = 140;
  api.updateActionButtons(document);
  assert.equal(elements['reset-check'].disabled, false);

  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /id="reset-check"[^>]*>リセット<\/button>/);
  assert.match(source, /getElement\(document,'reset-check'\)/);
  api.clearTverPage(undefined, { document, revokeObjectUrl() {} });
  assert.equal(api.getTverPageState().settingFile, null);
  assert.equal(api.getTverPageState().csvFile, null);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getTverPageState().uploadFiles)), []);
  assert.equal(api.getTverPageState().recognition, null);
  assert.equal(api.getTverPageState().run, null);
  assert.equal(api.getTverPageState().activeLevel, 'Campaign');
  assert.equal(api.getTverPageState().filters.level, 'all');
  assert.equal(elements['tver-file-input'].value, '');
  assert.equal(elements['setting-file-state'].textContent, '設定表：未選択');
  assert.equal(elements['csv-file-state'].textContent, 'CSV：未選択');
  assert.equal(elements['upload-recognition-state'].textContent, '.xlsx と .csv を選択してください。');
  assert.equal(elements['results-panel'].innerHTML, '');
  assert.equal(elements['results-panel'].scrollLeft, 0);
  assert.equal(elements['tver-result-summary'].innerHTML, '');
  assert.equal(elements['run-check'].disabled, true);
  assert.equal(elements['reset-check'].disabled, true);

  await api.setPageFiles([setting], document, readers);
  await api.setPageFiles([csv], document, readers);
  assert.equal(api.getTverPageState().recognition.ok, true);
  assert.equal(api.getTverPageState().run, null);
  assert.equal(elements['run-check'].disabled, false);
  assert.equal(elements['reset-check'].disabled, false);
});

test('C3-C3-Fix2 Red: sticky header下access scrollbar紧贴表头且不产生深色空白带', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-scroll-access\{[^}]*height:16px[^}]*overflow-x:auto[^}]*background:#fff[^}]*border-top:1px solid #dce2e4/);
  assert.doesNotMatch(source, /\.tver-horizontal-scroll-access\{[^}]*background:#263238/);
  assert.match(source, /class="tver-horizontal-sticky-header"/);
  assert.match(source, /class="tver-horizontal-scroll-access"/);
});

test('C3-C3-Fix3R Red: Campaign対象名恢复为CPN訴求短识别label', () => {
  const label = api.buildTverDisplayLabel(
    'Campaign',
    { expectedName: 'Expected Campaign_260901-0930_Appeal', fields: { campaignAppeal: 'Appeal Only' } },
    { fields: { campaign_name: 'CSV Campaign Only' } },
    'Fallback Campaign',
  );
  assert.equal(label, 'Appeal Only');
  assert.notEqual(label, 'Expected Campaign_260901-0930_Appeal');
  assert.notEqual(label, 'CSV Campaign Only');
});

test('C3-C3-Fix3R Red: Campaign左侧使用短label且campaign_name比较Entry保持独立', () => {
  const { run } = makeC3C3CampaignContractRun({ campaignCsv: { campaign_name: 'CSV Campaign Only' } });
  const nameEntry = findCampaignEntry(run, 'campaign_name');
  assert.ok(nameEntry);
  const comparisonBefore = nameEntry.comparisonStatus;
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const targetCell = html.match(/<td class="tver-horizontal-fixed tver-horizontal-col-target[^>]*>([\s\S]*?)<\/td>/);
  assert.ok(targetCell);
  assert.equal(targetCell[1], 'Contract');
  assert.doesNotMatch(targetCell[1], /C3-C3-Fix1 Campaign_260801-0831_Contract/);
  assert.doesNotMatch(targetCell[1], /CSV Campaign Only/);
  assert.equal(api.buildTverHorizontalColumns(run, 'Campaign').some(column => column.key === 'campaign_name'), true);
  assert.equal(findCampaignEntry(run, 'campaign_name').comparisonStatus, comparisonBefore);
  assert.equal(nameEntry.settingRawValue, 'C3-C3-Fix1 Campaign_260801-0831_Contract');
  assert.equal(nameEntry.csvRawValue, 'CSV Campaign Only');
});

test('C3-C3-Fix3R Red: 固定No/対象名/比較結果无内部separator且实体语义不变', () => {
  const run = makeC3C3CampaignContractRun().run;
  const before = JSON.stringify({ entries: run.entries, displayTree: run.displayTree });
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.equal((html.match(/data-tver-fixed-row-separator/g) || []).length, 0);
  assert.doesNotMatch(html, /tver-horizontal-fixed-row-separator/);
  assert.match(html, /data-row-variant="setting"/);
  assert.match(html, /data-row-variant="csv"/);
  assert.doesNotMatch(horizontalDataRow(html, 'csv'), /tver-horizontal-fixed/);
  assert.equal(JSON.stringify({ entries: run.entries, displayTree: run.displayTree }), before);
});

test('C3-C3-Fix3R Red: fixed separator实现与生命周期调用完全移除', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /tver-horizontal-fixed-row-separator/);
  assert.doesNotMatch(source, /data-tver-fixed-row-separator/);
  assert.doesNotMatch(source, /syncTverHorizontalFixedRowSeparators/);
  assert.doesNotMatch(source, /fixedSeparator/);
});

test('C3-C3-Fix3R Red: corrective revert不改变C3-C2-Fix1与C3-B-V3契约', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-status-consistent\{background:#f1f8f2\}/);
  assert.match(source, /\.tver-status-mismatch\{background:#fdecec\}/);
  assert.match(source, /\.tver-status-review\{background:#fff6e5\}/);
  assert.match(source, /class="tver-horizontal-scroll-access"/);
  assert.match(source, /class="tver-horizontal-sticky-header"/);
  assert.match(source, /data-action="resize-column"/);
  assert.match(source, /source\.scrollLeft=access\.scrollLeft/);
  assert.match(source, /access\.scrollLeft=source\.scrollLeft/);
});

test('C3-C3-Fix4 Red: Campaign fixed header改为CPN訴求且body短label与campaign_name QC不变', () => {
  const { run } = makeC3C3CampaignContractRun({ campaignCsv: { campaign_name: 'CSV Campaign Only' } });
  const nameEntry = findCampaignEntry(run, 'campaign_name');
  assert.ok(nameEntry);
  const comparisonBefore = nameEntry.comparisonStatus;
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /data-column-key="target"[^>]*>CPN訴求/);
  assert.doesNotMatch(html, /data-column-key="target"[^>]*>対象名/);
  const targetCell = html.match(/<td class="tver-horizontal-fixed tver-horizontal-col-target[^>]*>([\s\S]*?)<\/td>/);
  assert.ok(targetCell);
  assert.equal(targetCell[1], 'Contract');
  assert.equal(api.buildTverHorizontalColumns(run, 'Campaign').some(column => column.key === 'campaign_name'), true);
  assert.equal(findCampaignEntry(run, 'campaign_name').comparisonStatus, comparisonBefore);
  assert.equal(nameEntry.settingRawValue, 'C3-C3-Fix1 Campaign_260801-0831_Contract');
  assert.equal(nameEntry.csvRawValue, 'CSV Campaign Only');
});

test('C3-C3-Fix4 Red: fixed与dynamic sticky header按真实高度max统一并可重新测量', () => {
  assert.equal(typeof api.syncTverHorizontalHeaderHeights, 'function');
  const style = () => ({ height: '', minHeight: '' });
  let fixedHeight = 88;
  let dynamicHeight = 124;
  const fixedTable = { style: style(), getBoundingClientRect: () => ({ height: fixedHeight }) };
  const dynamicTable = { style: style(), getBoundingClientRect: () => ({ height: dynamicHeight }) };
  const fixed = { style: style(), getBoundingClientRect: () => ({ height: fixedHeight }) };
  const dynamic = { style: style(), getBoundingClientRect: () => ({ height: dynamicHeight }) };
  const row = { style: style() };
  const panel = {
    querySelector(selector) {
      return {
        '.tver-horizontal-sticky-header-row': row,
        '.tver-horizontal-sticky-header-fixed': fixed,
        '.tver-horizontal-sticky-header-dynamic': dynamic,
        '.tver-horizontal-sticky-header-fixed-table': fixedTable,
        '.tver-horizontal-sticky-header-dynamic-table': dynamicTable,
      }[selector] || null;
    },
  };
  api.syncTverHorizontalHeaderHeights(panel);
  [row, fixed, dynamic, fixedTable, dynamicTable].forEach(element => {
    assert.equal(element.style.height, '124px');
    assert.equal(element.style.minHeight, '124px');
  });
  fixedHeight = 150;
  dynamicHeight = 105;
  api.syncTverHorizontalHeaderHeights(panel);
  [row, fixed, dynamic, fixedTable, dynamicTable].forEach(element => {
    assert.equal(element.style.height, '150px');
    assert.equal(element.style.minHeight, '150px');
  });
});

test('C3-C3-Fix4 Red: header高度在初始render、sticky sync、overflow与column resize路径重新同步且body不加separator', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /function syncTverHorizontalHeaderHeights\(panel\)/);
  assert.match(source, /function syncTverHorizontalStickyPresentation\(panel\)\{[\s\S]*?syncTverHorizontalHeaderHeights\(panel\);/);
  assert.match(source, /function syncTverHorizontalScrollAccess\(panel\)\{[\s\S]*?syncTverHorizontalHeaderHeights\(panel\);/);
  assert.match(source, /const move=moveEvent => \{[\s\S]*?syncTverHorizontalHeaderHeights\(panel\);/);
  assert.match(source, /panel\.innerHTML=resultSummary \? mainHtml : html;[\s\S]*?syncTverHorizontalHeaderHeights\(panel\);/);
  assert.match(source, /tver-horizontal-sticky-header-dynamic-table/);
  assert.doesNotMatch(source, /tver-horizontal-fixed-row-separator/);
  assert.doesNotMatch(source, /data-tver-fixed-row-separator/);
  const html = api.renderTverRun(makeC3C3CampaignContractRun().run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.equal((html.match(/data-tver-fixed-row-separator/g) || []).length, 0);
});

test('C3-C3-Fix4 Red: hidden hourly双方空值保留需确认Entry但不污染Campaign entity status', () => {
  const run = makeC3C3CampaignContractRun({ campaignCsv: { hourly_bid_weight: '' } }).run;
  const hourly = findCampaignEntry(run, 'hourly_bid_weight');
  assert.ok(hourly);
  assert.equal(hourly.comparisonStatus, '需确认');
  assert.equal(api.buildTverHorizontalColumns(run, 'Campaign').some(column => column.key === 'hourly_bid_weight'), false);
  const view = api.buildTverHorizontalViewModel(run, 'Campaign');
  assert.equal(view.rows[0].entityDisplayStatus, '一致');
});

test('C3-C3-Fix4 Red: hidden hourly不掩盖其他可见字段不一致', () => {
  const run = makeC3C3CampaignContractRun({ campaignCsv: { hourly_bid_weight: '', budget: '901' } }).run;
  const hourly = findCampaignEntry(run, 'hourly_bid_weight');
  const budget = findCampaignEntry(run, 'budget');
  assert.ok(hourly);
  assert.ok(budget);
  assert.equal(hourly.comparisonStatus, '需确认');
  assert.equal(budget.comparisonStatus, '不一致');
  assert.equal(api.buildTverHorizontalViewModel(run, 'Campaign').rows[0].entityDisplayStatus, '不一致');
});

test('C3-C3-Fix4 Red: hourly任一侧有值时列显示且需确认仍参与entity status', () => {
  const run = makeC3C3CampaignContractRun({ campaignCsv: { hourly_bid_weight: '0時100' } }).run;
  const hourly = findCampaignEntry(run, 'hourly_bid_weight');
  assert.ok(hourly);
  assert.equal(hourly.settingRawValue, '');
  assert.equal(hourly.csvRawValue, '0時100');
  assert.equal(hourly.comparisonStatus, '需确认');
  assert.equal(api.buildTverHorizontalColumns(run, 'Campaign').some(column => column.key === 'hourly_bid_weight'), true);
  assert.equal(api.buildTverHorizontalViewModel(run, 'Campaign').rows[0].entityDisplayStatus, '要確認');
});

test('C3-C3-Fix5 Red: Campaign 23:45 canonical相同不因30分钟粒度变为要確認', () => {
  const result = api.compareField({
    level: 'Campaign', field: 'end_datetime', settingValue: '2026/08/31 23:45', csvValue: '2026/8/31 23:45', ruleBasis: 'strict',
  });
  assert.equal(result.comparisonStatus, '表記ゆれ一致');
  assert.equal(result.displayStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(result.displayStatus), '一致');
  assert.equal(result.validationIssues.length, 2);
  assert.equal(result.validationIssues.every(issue => issue.code === 'DATETIME_NOT_30_MINUTE_GRANULARITY'), true);
});

test('C3-C3-Fix5 Red: Campaign 23:45与23:30仍判定真正时间不一致', () => {
  const result = api.compareField({
    level: 'Campaign', field: 'end_datetime', settingValue: '2026/08/31 23:45', csvValue: '2026/8/31 23:30', ruleBasis: 'strict',
  });
  assert.equal(result.comparisonStatus, '不一致');
  assert.equal(result.displayStatus, '不一致');
  assert.equal(result.validationIssues.length, 1);
  assert.equal(result.validationIssues[0].code, 'DATETIME_NOT_30_MINUTE_GRANULARITY');
});

test('C3-C3-Fix5 Red: 非法Campaign日期与非法秒数仍保持需确认 validation', () => {
  const invalidDate = api.compareField({
    level: 'Campaign', field: 'end_datetime', settingValue: '2026/08/31 24:45', csvValue: '2026/8/31 24:45', ruleBasis: 'strict',
  });
  const invalidSecond = api.compareField({
    level: 'Campaign', field: 'end_datetime', settingValue: '2026/08/31 23:45:01', csvValue: '2026/8/31 23:45:01', ruleBasis: 'strict',
  });
  assert.equal(invalidDate.displayStatus, '需确认');
  assert.ok(invalidDate.validationIssues.every(issue => issue.code === 'INVALID_DATETIME'));
  assert.equal(invalidSecond.displayStatus, '需确认');
  assert.ok(invalidSecond.validationIssues.some(issue => issue.code === 'DATETIME_SECOND_NOT_ZERO'));
});

test('C3-C3-Fix5 Red: Ad Group 日期粒度也只保留证据、不覆盖canonical等值绿色投影', () => {
  const result = api.compareField({
    level: 'Ad Group', field: 'adgroup_end_datetime', settingValue: '2026/08/31 23:45', csvValue: '2026/8/31 23:45', ruleBasis: 'strict',
  });
  assert.equal(result.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(result.displayStatus), '一致');
  assert.equal(result.validationIssues.length, 2);
});

async function makeC3C4ARegisterRun({
  settingStart = '2026/02/01 00:00', settingEnd = '2026/02/28 23:30',
  csvStart = settingStart, csvEnd = settingEnd,
} = {}) {
  const settingWorkbook = makeStructuredSettingWorkbook({
    mainRows: [{
      '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
      '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
      'ターゲティング番号': 'TG-01',
      'ADG開始日時(yyyy/mm/dd hh:mm)': settingStart, 'ADG終了日時(yyyy/mm/dd hh:mm)': settingEnd,
      '素材名': 'synthetic-creative.mp4', 'LP名': 'Synthetic LP', 'タグ訴求': 'Synthetic_SPPC',
      '初期設定日予算': '30', 'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
    }],
    targetingBatches: [[{ number: 'TG-01', device: 'SP／PC／CTV', price: '11' }]],
  });
  const csvText = makeRegisterCsv([{
    campaign_name: 'Synthetic Campaign_260201-0228_Synthetic Appeal',
    adgroup_name: 'Synthetic Group', adgroup_start_datetime: csvStart, adgroup_end_datetime: csvEnd,
    device: 'android ios pc', price: '11', creative_name: 'synthetic-creative.mp4',
    url: 'https://example.invalid/synthetic-lp',
  }]);
  const result=await api.runTverCheck({
    settingWorkbook, csvText, settingFileName: 'c3-c4-4a-setting.xlsx',
    csvFileName: 'c3-c4-4a-register.csv', document: null,
  });
  return result;
}

function findAdGroupPeriodEntry(run, field) {
  return run.entries.find(entry => entry.level === 'Ad Group' && entry.field === field);
}

test('C3-C4-4A Red: GP Period source直接来自Setting ADG列与CSV adgroup列，不继承Campaign日期', async () => {
  const result = await makeC3C4ARegisterRun({
    settingStart: '2026/02/03 10:00', settingEnd: '2026/02/28 23:45',
    csvStart: '2026/2/3 10:00', csvEnd: '2026/2/28 23:45',
  });
  assert.equal(result.ok, true);
  const start = findAdGroupPeriodEntry(result.run, 'adgroup_start_datetime');
  const end = findAdGroupPeriodEntry(result.run, 'adgroup_end_datetime');
  assert.ok(start);
  assert.ok(end);
  assert.equal(start.settingRawValue, '2026/02/03 10:00');
  assert.equal(start.csvRawValue, '2026/2/3 10:00');
  assert.equal(start.sourceRefs.setting.columnName, 'ADG開始日時(yyyy/mm/dd hh:mm)');
  assert.equal(start.sourceRefs.csv.columnName, 'adgroup_start_datetime');
  assert.equal(start.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(start.displayStatus), '一致');
  assert.equal(end.settingRawValue, '2026/02/28 23:45');
  assert.equal(end.csvRawValue, '2026/2/28 23:45');
  assert.equal(end.sourceRefs.setting.columnName, 'ADG終了日時(yyyy/mm/dd hh:mm)');
  assert.equal(end.sourceRefs.csv.columnName, 'adgroup_end_datetime');
  assert.equal(end.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(end.displayStatus), '一致');
  assert.notEqual(start.settingRawValue, '2026/02/01 00:00');
  assert.notEqual(end.settingRawValue, '2026/02/28 23:30');
});

test('C3-C4-4A Red: GP Period start/end的真实差异仍判定为不一致', async () => {
  const result = await makeC3C4ARegisterRun({
    settingStart: '2026/02/03 10:00', settingEnd: '2026/02/28 23:45',
    csvStart: '2026/02/04 10:00', csvEnd: '2026/03/01 00:00',
  });
  const start = findAdGroupPeriodEntry(result.run, 'adgroup_start_datetime');
  const end = findAdGroupPeriodEntry(result.run, 'adgroup_end_datetime');
  assert.ok(start);
  assert.ok(end);
  assert.equal(start.comparisonStatus, '不一致');
  assert.equal(end.comparisonStatus, '不一致');
});

test('C3-C4-4A Red: schema available时单侧空值是不一致，双方空值为neutral', () => {
  const settingEmpty = api.compareField({
    level: 'Ad Group', field: 'adgroup_start_datetime', settingValue: '', csvValue: '2026/02/01 10:00',
    settingEvidenceState: 'available', csvEvidenceState: 'available', ruleBasis: 'TVER_C3_C4_4A_GP_PERIOD',
  });
  const csvEmpty = api.compareField({
    level: 'Ad Group', field: 'adgroup_end_datetime', settingValue: '2026/02/28 23:30', csvValue: '',
    settingEvidenceState: 'available', csvEvidenceState: 'available', ruleBasis: 'TVER_C3_C4_4A_GP_PERIOD',
  });
  const bothEmpty = api.compareField({
    level: 'Ad Group', field: 'adgroup_start_datetime', settingValue: '', csvValue: '',
    settingEvidenceState: 'available', csvEvidenceState: 'available', ruleBasis: 'TVER_C3_C4_4A_GP_PERIOD',
  });
  assert.equal(settingEmpty.comparisonStatus, '不一致');
  assert.equal(settingEmpty.comparable, true);
  assert.equal(csvEmpty.comparisonStatus, '不一致');
  assert.equal(csvEmpty.comparable, true);
  assert.equal(bothEmpty.comparisonStatus, '一致');
  assert.equal(bothEmpty.comparable, true);
  assert.equal(bothEmpty.neutral, true);
  assert.equal(api.projectTverEntityDisplayStatus([bothEmpty]), '一致');
});

test('C3-C4-4A Red: schema/source unavailable不当作empty或mismatch，也不污染GP entity status', () => {
  const csvUnavailable = api.compareField({
    level: 'Ad Group', field: 'adgroup_start_datetime', settingValue: '2026/02/01 10:00', csvValue: '',
    settingEvidenceState: 'available', csvEvidenceState: 'unavailable', ruleBasis: 'TVER_C3_C4_4A_GP_PERIOD',
  });
  const settingUnavailable = api.compareField({
    level: 'Ad Group', field: 'adgroup_end_datetime', settingValue: '', csvValue: '2026/02/28 23:30',
    settingEvidenceState: 'unavailable', csvEvidenceState: 'available', ruleBasis: 'TVER_C3_C4_4A_GP_PERIOD',
  });
  [csvUnavailable, settingUnavailable].forEach(result => {
    assert.equal(result.comparisonStatus, '一致');
    assert.equal(result.comparable, false);
    assert.equal(result.neutral, true);
    assert.equal(api.projectTverEntityDisplayStatus([result]), '一致');
  });
  assert.equal(csvUnavailable.evidenceStates.csv, 'unavailable');
  assert.equal(settingUnavailable.evidenceStates.setting, 'unavailable');
});

test('C3-C4-4A Red: schema明确存在但日期格式无法解析时保持需确认 validation', () => {
  const result = api.compareField({
    level: 'Ad Group', field: 'adgroup_start_datetime', settingValue: '2026/02/01', csvValue: '2026/02/01',
    settingEvidenceState: 'available', csvEvidenceState: 'available', ruleBasis: 'TVER_C3_C4_4A_GP_PERIOD',
  });
  assert.equal(result.comparisonStatus, '需确认');
  assert.equal(result.displayStatus, '需确认');
  assert.ok(result.validationIssues.every(issue => issue.code === 'INVALID_DATETIME'));
});

test('C3-C3-Fix5 Red: 2431式Campaign全可见字段一致时entity status为一致且不含report_target_flag', () => {
  const run = makeC3C3CampaignContractRun({
    schema: 'register',
    settingFields: { endDateTime: '2026/08/31 23:45' },
    campaignCsv: { end_datetime: '2026/8/31 23:45', report_target_flag: '' },
  }).run;
  const end = findCampaignEntry(run, 'end_datetime');
  assert.ok(end);
  assert.equal(api.projectTverDisplayStatus(end.displayStatus), '一致');
  assert.equal(findCampaignEntry(run, 'report_target_flag'), undefined);
  const view = api.buildTverHorizontalViewModel(run, 'Campaign');
  assert.equal(view.rows[0].entityDisplayStatus, '一致');
  assert.equal(view.columns.some(column => column.key === 'report_target_flag'), false);
});

test('C3-C3-Fix5 Red: 2549式budget差异仍为不一致，其他全一致Campaign不被误伤', () => {
  const mismatchRun = makeC3C3CampaignContractRun({ campaignCsv: { budget: '901', report_target_flag: '' } }).run;
  const equalRun = makeC3C3CampaignContractRun({ campaignCsv: { report_target_flag: '' } }).run;
  assert.equal(api.buildTverHorizontalViewModel(mismatchRun, 'Campaign').rows[0].entityDisplayStatus, '不一致');
  assert.equal(api.buildTverHorizontalViewModel(equalRun, 'Campaign').rows[0].entityDisplayStatus, '一致');
  assert.equal(findCampaignEntry(mismatchRun, 'budget').comparisonStatus, '不一致');
  assert.equal(findCampaignEntry(equalRun, 'report_target_flag'), undefined);
});

test('C3-C3 Red: Campaign字段集合与优先顺序只包含Campaign字段', () => {
  const fields = [
    'campaign_name', 'start_datetime', 'end_datetime', 'budget', 'daily_budget', 'budget_type',
    'hourly_bid_weight', 'campaign_status', 'consumption_type', 'cv_point',
  ];
  const run = makeC3C3CampaignRun(fields);
  assert.deepEqual(Array.from(api.buildTverHorizontalColumns(run, 'Campaign'), column => column.key), fields);
  assert.deepEqual(
    fields.map(field => api.buildTverHorizontalFieldLabel('Campaign', field)),
    ['キャンペーン名', '開始日時', '終了日時', '予算', '日予算', '予算タイプ', '時間毎予算割合', 'キャンペーンステータス', '予算消化タイプ', 'CVポイント'],
  );
});

test('C3-C3 Red: Campaign主表不混入Ad Group或Ad字段', () => {
  const run = makeC3C3CampaignRun(['campaign_name', 'budget'], { includeChildEntries: true });
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.deepEqual(Array.from(api.buildTverHorizontalColumns(run, 'Campaign'), column => column.key), ['campaign_name', 'budget']);
  assert.doesNotMatch(view.html, /data-column-key="device"/);
  assert.doesNotMatch(view.html, /data-column-key="creative_name"/);
});

test('C3-C3 Red: schema或comparison contract缺失字段不生成错误列', () => {
  const available = ['campaign_name', 'start_datetime', 'end_datetime', 'budget', 'daily_budget', 'campaign_status'];
  const unavailable = ['budget_type', 'hourly_bid_weight', 'consumption_type', 'cv_point', 'report_target_flag'];
  const run = makeC3C3CampaignRun(available);
  const keys = Array.from(api.buildTverHorizontalColumns(run, 'Campaign'), column => column.key);
  assert.deepEqual(keys, available);
  unavailable.forEach(field => assert.ok(!keys.includes(field), `${field} must stay absent without an existing entry`));
});

test('C3-C3 Red: Campaign semantic full-cell background仍位于业务字段td', () => {
  const run = makeC3C3CampaignRun(['budget'], { statusByField: { budget: '不一致' } });
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const settingRow = horizontalDataRow(view.html, 'setting');
  assert.match(settingRow, /<td class="[^\"]*tver-horizontal-cell-toggle[^\"]*tver-status-mismatch[^\"]*"[^>]*data-field-key="budget"/);
  assert.doesNotMatch(view.html, /class="tver-horizontal-cell-entry tver-status-/);
});

test('C3-C3 Red: Campaign继续保持Setting与CSV两行结构', () => {
  const view = api.renderTverRun(makeC3C3CampaignRun(['campaign_name', 'budget']), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/<tr[^>]*data-row-variant="/g) || []).length, 2);
  assert.match(view.html, /data-row-variant="setting"/);
  assert.match(view.html, /data-row-variant="csv"/);
  assert.equal((view.html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
});

test('C3-C3-Fix3R Red: CPN訴求作为Campaign displayLabel且仍只改变nameComponents', () => {
  const fixture = makeA181CFixture({ csvFields: { adgroup_name: 'CSV edit name' } });
  fixture.setting.campaign.fields.campaignAppeal = 'No1_特定';
  const before = JSON.stringify({ setting: fixture.settingModel, csv: fixture.csvTree, matching: fixture.matching, entries: fixture.entries });
  const tree = api.buildTverDisplayTree(fixture);
  const campaign = tree.roots[0];
  assert.equal(campaign.displayLabel, 'No1_特定');
  assert.equal(campaign.displayName, fixture.setting.campaign.expectedName);
  assert.equal(fixture.entries[0].targetName, 'campaign-target');
  assert.equal(campaign.nodeKey, `match:${fixture.setting.campaign.key}::${fixture.csv.campaign.key}`);
  assert.equal(JSON.stringify({ setting: fixture.settingModel, csv: fixture.csvTree, matching: fixture.matching, entries: fixture.entries }), before);
});

test('C3-C3 Red: short label不存在时保持当前Campaign対象名', () => {
  const fixture = makeA181CFixture({ csvFields: { adgroup_name: 'CSV edit name' } });
  const tree = api.buildTverDisplayTree(fixture);
  assert.equal(tree.roots[0].displayLabel, fixture.setting.campaign.expectedName);
});

test('C3-C3 Red: C3-B-V3 scrolling与resize结构继续保留', () => {
  const run = makeC3C3CampaignRun(['campaign_name', 'budget']);
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(view.html, /class="tver-horizontal-scroll-access"/);
  assert.match(view.html, /data-action="resize-column"/);
  assert.match(source, /.tver-horizontal-sticky-header\{[^}]*position:sticky[^}]*top:0/);
  assert.match(source, /.tver-horizontal-scroll\{[^}]*overflow-x:auto/);
  assert.match(source, /source\.scrollLeft/);
  assert.match(source, /access\.scrollLeft/);
  assert.match(source, /syncTverHorizontalScrollAccess/);
});

test('A18-3C1-V1 Red: 顶部只渲染三张卡片且默认DOM无筛选控件', () => {
  const run = makeA183Run();
  run.statusCounts = { '一致': 115, '表記ゆれ一致': 0, '不一致': 2, '需确认': 100, '未匹配': 71 };
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/class="status-count /g) || []).length, 3);
  assert.doesNotMatch(view.html, /<select|<option|filter-status|filter-abnormal|filter-keyword|デフォルト幅/);
  assert.doesNotMatch(view.html, /結果摘要|class="tver-horizontal-col-summary"/);
  assert.ok(view.html.indexOf('class="status-counts"') < view.html.indexOf('class="tver-level-tabs"'));
});

test('A18-3C1 Red: 一致与要確認筛选分别聚合底层状态且不改变底层谓词', () => {
  assert.equal(typeof api.matchesTverEntryFilters, 'function');
  assert.equal(typeof api.matchesTverDisplayEntryFilters, 'function');
  const entries = [
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'exact', status: '一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'normalized', status: '表記ゆれ一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'review', status: '需确认' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'unmatched', status: '未匹配' }),
  ];
  const criteria = { level: 'Campaign', status: '一致', abnormalOnly: false, keyword: '' };
  assert.equal(api.matchesTverEntryFilters(entries[1], { ...criteria, status: '表記ゆれ一致' }), true);
  assert.equal(api.matchesTverDisplayEntryFilters(entries[0], criteria), true);
  assert.equal(api.matchesTverDisplayEntryFilters(entries[1], criteria), true);
  assert.equal(api.matchesTverDisplayEntryFilters(entries[2], criteria), false);
  assert.equal(api.matchesTverDisplayEntryFilters(entries[2], { ...criteria, status: '要確認' }), true);
  assert.equal(api.matchesTverDisplayEntryFilters(entries[3], { ...criteria, status: '要確認' }), true);
});

test('A18-3C1 Red: 一个实体输出S/D两条物理行且固定列rowspan为2', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal((view.html.match(/<tr[^>]*data-row-key="/g) || []).length, 2);
  assert.match(view.html, /data-row-variant="setting"/);
  assert.match(view.html, /data-row-variant="csv"/);
  assert.equal((view.html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.match(view.html, />No\.<\/th>[\s\S]*>対象名[\s\S]*?<\/th>[\s\S]*>比較結果[\s\S]*?<\/th>/);
  assert.doesNotMatch(view.html, /父階層|data-column-key="parent"/);
  assert.doesNotMatch(view.html, /結果摘要|tver-horizontal-col-summary/);
});

test('A18-3C1 Red: 设置值只进入S行、CSV值只进入D行且重复field顺序保持', () => {
  const run = makeA183Run();
  run.entries[7] = { ...run.entries[7], settingRawValue: 'S-1', csvRawValue: 'D-1' };
  run.entries[8] = { ...run.entries[8], settingRawValue: 'S-2', csvRawValue: 'D-2' };
  const view = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const settingRow = horizontalDataRow(view.html, 'setting');
  const csvRow = horizontalDataRow(view.html, 'csv');
  assert.match(settingRow, /S-1[\s\S]*S-2/);
  assert.doesNotMatch(settingRow, /D-1|D-2/);
  assert.match(csvRow, /D-1[\s\S]*D-2/);
  assert.doesNotMatch(csvRow, /S-1|S-2/);
  assert.deepEqual(horizontalDataEntryIndexes(view.html, 'setting'), [7, 8]);
  assert.deepEqual(horizontalDataEntryIndexes(view.html, 'csv'), [7, 8]);
  assert.equal(view.displayedEntries.length, 2);
  assert.equal((view.html.match(/data-entry-index="7"/g) || []).length, 2);
  assert.equal((view.html.match(/data-entry-index="8"/g) || []).length, 2);
});

test('A18-3C1 Red: 三状态颜色class、深色表头与No.数据列结构存在', () => {
  const run = makeA183Run();
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /tver-status-consistent/);
  assert.match(view.html, /tver-status-mismatch/);
  assert.match(view.html, /tver-status-review/);
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-table thead th\{[^}]*background:#2c3e50[^}]*color:#fff/);
  assert.match(source, /\.tver-horizontal-fixed-no\{[^}]*background:#2c3e50[^}]*color:#fff/);
  assert.match(source, /\.tver-status-consistent\{[^}]*background:#f1f8f2/);
  assert.match(source, /\.tver-status-mismatch\{[^}]*background:#fdecec/);
  assert.match(source, /\.tver-status-review\{[^}]*background:#fff6e5/);
});

test('A18-3C1 Red: 列宽按Level保存、限制范围且No.不可调整', () => {
  assert.equal(typeof api.getTverColumnWidth, 'function');
  assert.equal(typeof api.setTverColumnWidth, 'function');
  const storage = makeMemoryStorage({ otherPreference: 'keep' });
  assert.equal(api.getTverColumnWidth('Campaign', 'no', storage), 56);
  api.setTverColumnWidth('Campaign', 'target', 360, storage);
  api.setTverColumnWidth('Ad Group', 'target', 420, storage);
  api.setTverColumnWidth('Campaign', 'no', 120, storage);
  assert.equal(api.getTverColumnWidth('Campaign', 'target', storage), 360);
  assert.equal(api.getTverColumnWidth('Ad Group', 'target', storage), 420);
  assert.equal(api.getTverColumnWidth('Ad', 'target', storage), 280);
  assert.equal(api.getTverColumnWidth('Campaign', 'no', storage), 56);
  api.setTverColumnWidth('Campaign', 'budget', 20, storage);
  assert.ok(api.getTverColumnWidth('Campaign', 'budget', storage) >= 120);
  api.setTverColumnWidth('Campaign', 'budget', 9999, storage);
  assert.ok(api.getTverColumnWidth('Campaign', 'budget', storage) <= 560);
  assert.match(api.TVER_COLUMN_WIDTH_STORAGE_KEY, /^tver-/);
});

test('A18-3C1 Red: 表头拖动结构读取列宽且默认宽度重置不清理其他localStorage', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /tver-column-resizer/);
  assert.match(source, /data-action="resize-column"/);
  assert.match(source, /pointerdown|mousedown/);
  assert.match(source, /resetTverColumnWidths/);
  const storage = makeMemoryStorage({ otherPreference: 'keep' });
  api.setTverColumnWidth('Campaign', 'target', 390, storage);
  const table = api.buildTverHorizontalTableHtml(api.buildTverHorizontalViewModel(makeA183Run(), 'Campaign'), { storage });
  assert.match(table, /data-column-key="target"[^>]*style="width:390px/);
  assert.match(table, /<table[^>]*style="--tver-no-width:56px;--tver-target-width:390px;--tver-comparison-width:160px;--tver-fixed-width:606px;--tver-dynamic-width:\d+px;--tver-table-width:\d+px"/);
  assert.match(table, /data-action="resize-column"[^>]*data-column-key="target"/);
  assert.doesNotMatch(table, /data-action="resize-column"[^>]*data-column-key="no"/);
  assert.equal(typeof api.resetTverColumnWidths, 'function');
  api.resetTverColumnWidths(storage);
  assert.equal(api.getTverColumnWidth('Campaign', 'target', storage), 280);
  assert.equal(storage.getItem('otherPreference'), 'keep');
});

test('A18-3C1 Red: 长文本只作预览但原始值保留且不生成默认详细表DOM', () => {
  const longValue = 'LONG-VALUE-'.repeat(80);
  const run = makeA183Run();
  run.entries[7] = { ...run.entries[7], settingRawValue: longValue, csvRawValue: `${longValue}-csv`, field: 'media' };
  const before = JSON.stringify(run);
  const view = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /class="tver-horizontal-cell-value"[^>]*title="LONG-VALUE-/);
  assert.doesNotMatch(view.html, /class="results-table"/);
  assert.equal(run.entries[7].settingRawValue, longValue);
  assert.equal(run.entries[7].csvRawValue, `${longValue}-csv`);
  assert.equal(JSON.stringify(run), before);
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-cell-value\{[^}]*max-height:/);
  assert.match(source, /\.tver-horizontal-cell-value\{[^}]*overflow:hidden/);
});

test('A18-3C1-V1 Red: 默认横向DOM移除整块筛选操作栏及其控件', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.doesNotMatch(view.html, /class="filter-bar"|class="result-count"/);
  assert.doesNotMatch(view.html, /filter-status|filter-abnormal|filter-keyword|reset-tver-column-widths|すべて|異常のみ|デフォルト幅/);
  assert.match(view.html, /class="tver-level-tabs"/);
  assert.match(view.html, /class="tver-horizontal-table"/);
  assert.equal(typeof api.filterTverEntries, 'function');
  assert.equal(typeof api.projectTverDisplayStatus, 'function');
  assert.equal(typeof api.getTverColumnWidth, 'function');
});

test('A18-3C1-V1 Red: 三个Level的父分组行具备不遮住表头的sticky契约', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-table thead th\{[^}]*position:sticky[^}]*top:0[^}]*z-index:4/);
  assert.match(source, /\.tver-horizontal-sticky-header\{[^}]*position:sticky[^}]*top:0/);
  assert.doesNotMatch(source, /\.tver-horizontal-sticky-group-label\{/);
  assert.match(source, /syncTverHorizontalStickyPresentation/);
  ['Campaign', 'Ad Group', 'Ad'].forEach(level => {
    const view = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
    assert.match(view.html, new RegExp(`data-level="${level}"`));
  });
  const adGroup = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const ad = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(adGroup.html, /class="tver-horizontal-group-row"/);
  assert.match(ad.html, /class="tver-horizontal-group-row"/);
});

test('A18-3C1-V1 Red: 页面取消1380px居中限制并保留横向表自身滚动', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /\.page\{[^}]*max-width:1380px/);
  assert.match(source, /\.page\{[^}]*width:100%/);
  assert.match(source, /\.page\{[^}]*padding:[^}]*\}/);
  assert.match(source, /\.tver-horizontal-scroll\{[^}]*max-width:100%[^}]*overflow-x:auto[^}]*overflow-y:clip/);
  assert.match(source, /\.tver-horizontal-scroll-shell\{[^}]*overflow:visible/);
  assert.match(source, /\.tver-horizontal-scroll \.tver-horizontal-group-row th\{[^}]*position:static/);
});

test('A18-3C1-V1 Red: 双击仅切换当前动态单元格展开状态且不修改entry', () => {
  assert.equal(typeof api.bindTverHorizontalInteractions, 'function');
  const run = makeA183Run();
  const before = JSON.stringify(run);
  const states = new Set();
  const makeCell = name => ({
    name,
    getAttribute(attribute) { return attribute === 'data-action' ? 'toggle-cell' : null; },
    classList: {
      toggle(className) { if(states.has(`${name}:${className}`)) states.delete(`${name}:${className}`); else states.add(`${name}:${className}`); },
      contains(className) { return states.has(`${name}:${className}`); },
    },
  });
  const firstCell = makeCell('first');
  const secondCell = makeCell('second');
  const listeners = {};
  const panel = {
    __tverHorizontalEventsBound: false,
    addEventListener(type, handler) { listeners[type] = handler; },
    contains(target) { return target === firstCell || target === secondCell; },
  };
  api.bindTverHorizontalInteractions(panel);
  const child = { closest() { return firstCell; } };
  listeners.dblclick({ target: child, preventDefault() {} });
  assert.equal(firstCell.classList.contains('tver-horizontal-cell-expanded'), true);
  assert.equal(secondCell.classList.contains('tver-horizontal-cell-expanded'), false);
  listeners.dblclick({ target: child, preventDefault() {} });
  assert.equal(firstCell.classList.contains('tver-horizontal-cell-expanded'), false);
  assert.equal(JSON.stringify(run), before);
  const html = api.renderTverRun(run, { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /data-action="toggle-cell"/);
  assert.match(html, /rowspan="2"/);
  assert.match(html, /tver-status-review|tver-status-consistent|tver-status-mismatch/);
});

test('A18-3C1-V2 Red: 动态field cell不再输出重复的entry状态文字', () => {
  const view = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.doesNotMatch(view.html, /tver-horizontal-entry-status/);
});

test('A18-3C1-V2 Red: 实体展示状态按不一致大于要確認大于一致聚合', () => {
  assert.equal(typeof api.projectTverEntityDisplayStatus, 'function');
  const entries = statuses => statuses.map(status => makeA183Entry({ level: 'Campaign', entityKey: 'cp-1', field: 'field', status }));
  assert.equal(api.projectTverEntityDisplayStatus(entries([])), '一致');
  assert.equal(api.projectTverEntityDisplayStatus(entries(['一致', '表記ゆれ一致'])), '一致');
  assert.equal(api.projectTverEntityDisplayStatus(entries(['一致', '需确认'])), '要確認');
  assert.equal(api.projectTverEntityDisplayStatus(entries(['需确认', '不一致'])), '不一致');
  assert.equal(api.projectTverEntityDisplayStatus(entries(['一致', '不一致'])), '不一致');
  assert.equal(api.projectTverEntityDisplayStatus(entries(['未匹配'])), '要確認');
});

test('A18-3C1-V2 Red: 三个Level每实体只渲染一个比較結果且使用rowspan=2', () => {
  const run = makeA183Run();
  const expectedEntities = { Campaign: 1, 'Ad Group': 2, Ad: 1 };
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(run, { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /data-column-key="comparison"/);
    assert.match(html, /比較結果/);
    assert.equal((html.match(/class="tver-horizontal-entity-status[^"]*"/g) || []).length, expectedEntities[level]);
    assert.equal((html.match(/class="[^"]*tver-horizontal-fixed-comparison[^"]*"[^>]*rowspan="2"/g) || []).length, expectedEntities[level]);
  }
  const adGroupHtml = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(adGroupHtml, /tver-horizontal-entity-status tver-status-mismatch[^>]*>不一致</);
  assert.match(adGroupHtml, /tver-horizontal-entity-status tver-status-consistent[^>]*>一致</);
});

test('A18-3C1-V2 Red: 比較結果只消费当前row entry投影且不改变entry与statusCounts', () => {
  const run = makeA183Run();
  const beforeEntries = JSON.stringify(run.entries);
  const beforeStatusCounts = JSON.stringify(run.statusCounts);
  const view = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(JSON.stringify(run.entries), beforeEntries);
  assert.equal(JSON.stringify(run.statusCounts), beforeStatusCounts);
  assert.doesNotMatch(view.html, /<th[^>]*>[^<]*(?:理由|根拠|sourceRefs|ruleBasis)[^<]*<\/th>/);
  assert.equal(view.displayedEntries.length, 5);
});

test('A18-3C1-V2 Red: 新固定列的sticky offset在No→対象名→比較結果后保持正确', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /<th[^>]*data-column-key="no"[^>]*>/);
  assert.match(html, /<th[^>]*data-column-key="target"[^>]*>/);
  assert.match(html, /<th[^>]*data-column-key="comparison"[^>]*>/);
  assert.doesNotMatch(html, /data-column-key="parent"|父階層/);
  assert.match(html, /--tver-no-width:56px;--tver-target-width:280px;--tver-comparison-width:160px;--tver-fixed-width:496px/);
  assert.ok(source.includes('.tver-horizontal-fixed-target{left:var(--tver-no-width,56px)}'));
  assert.ok(source.includes('.tver-horizontal-fixed-comparison{left:calc(var(--tver-no-width,56px) + var(--tver-target-width,280px))}'));
});

test('A18-3C1-V2 Red: sticky group不再依赖纵向overflow:auto滚动祖先', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-scroll-shell\{[^}]*overflow:visible/);
  assert.match(source, /\.tver-horizontal-scroll\{[^}]*overflow-x:auto[^}]*overflow-y:clip/);
  assert.match(source, /const headerHtml='[^']*tver-horizontal-sticky-header/);
  assert.match(source, /const shellReplacement='[^']*tver-horizontal-scroll-shell/);
  assert.doesNotMatch(source, /groupHtml=.*data-tver-sticky-group/);
  assert.match(source, /syncTverHorizontalStickyPresentation/);
  assert.match(source, /\.tver-horizontal-scroll \.tver-horizontal-group-row th\{[^}]*position:static/);
});

test('A18-3C1-V2 Red: V1的S/D双行、双击、列宽记忆和三Level结构继续存在', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  const run = makeA183Run();
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(run, { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /data-row-variant="setting"/);
    assert.match(html, /data-row-variant="csv"/);
    assert.match(html, /data-action="toggle-cell"/);
    assert.match(html, /data-action="resize-column"/);
  }
  assert.equal(typeof api.getTverColumnWidth, 'function');
  assert.equal(typeof api.setTverColumnWidth, 'function');
  assert.equal(typeof api.resetTverColumnWidths, 'function');
  assert.match(source, /tver-horizontal-cell-expanded/);
});

test('A18-3C1-V2 Red: 列宽拖动同步固定/动态展示表并保持比較列偏移', () => {
  const makeStyle = () => ({
    width: '160px',
    minWidth: '160px',
    values: {},
    setProperty(key, value) { this.values[key] = value; },
    getPropertyValue(key) { return this.values[key] || ''; },
  });
  const makeCol = (key, width = 160) => ({
    style: { width: `${width}px`, minWidth: `${width}px` },
    getAttribute(name) { return name === 'data-column-key' ? key : null; },
  });
  const makeTable = () => {
    const cols = ['no', 'target', 'parent', 'comparison', 'budget'].map(key => makeCol(key, key === 'no' ? 56 : key === 'target' ? 280 : key === 'parent' ? 210 : key === 'comparison' ? 160 : 160));
    return {
      style: makeStyle(),
      getAttribute(name) { return name === 'data-level' ? 'Campaign' : null; },
      querySelectorAll(selector) { return selector.startsWith('col[') ? cols : []; },
      cols,
    };
  };
  const bodyTable = makeTable();
  const fixedTable = makeTable();
  const dynamicTable = makeTable();
  const handle = {
    getAttribute(name) { return name === 'data-action' ? 'resize-column' : name === 'data-column-key' ? 'budget' : null; },
    closest(selector) { return selector === 'table' ? dynamicTable : selector === '[data-action="resize-column"]' ? handle : null; },
  };
  const documentHandlers = {};
  const ownerDocument = {
    addEventListener(type, handler) { documentHandlers[type] = handler; },
    removeEventListener() {},
  };
  const panelHandlers = {};
  const panel = {
    __tverHorizontalEventsBound: false,
    ownerDocument,
    addEventListener(type, handler) { panelHandlers[type] = handler; },
    contains(target) { return target === handle; },
    querySelectorAll(selector) {
      return selector.startsWith('table[data-level') ? [bodyTable, fixedTable, dynamicTable] : [];
    },
    querySelector(selector) {
      return selector === '.tver-horizontal-scroll-shell' ? { style: makeStyle() } : null;
    },
  };

  api.bindTverHorizontalInteractions(panel);
  panelHandlers.pointerdown({ target: handle, clientX: 100, preventDefault() {} });
  assert.equal(typeof documentHandlers.pointermove, 'function');
  documentHandlers.pointermove({ clientX: 140 });
  for (const table of [bodyTable, fixedTable, dynamicTable]) {
    const budget = table.cols.find(col => col.getAttribute('data-column-key') === 'budget');
    assert.equal(budget.style.width, '200px');
    assert.equal(table.style.values['--tver-comparison-width'], '160px');
  }
});

test('A18-3C1-V3 Red: 横向固定列只保留No対象名比較結果且父数据仍用于group row', () => {
  const run = makeA183Run();
  const campaign = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  const adGroup = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.doesNotMatch(campaign.html, /data-column-key="parent"|>父階層</);
  assert.doesNotMatch(adGroup.html, /data-column-key="parent"|>父階層/);
  assert.match(campaign.html, /data-column-key="no"/);
  assert.match(campaign.html, /data-column-key="target"/);
  assert.match(campaign.html, /data-column-key="comparison"/);
  assert.equal((campaign.html.match(/tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.equal((campaign.html.match(/class="tver-horizontal-group-row"/g) || []).length, 0);
  assert.ok(adGroup.html.includes('同名Campaign'));
  assert.ok(adGroup.html.includes('data-group-key="cp-1"'));
  assert.equal(adGroup.html.includes('parentDisplayLabel'), false);
  const adGroupView = api.buildTverHorizontalViewModel(run, 'Ad Group');
  assert.equal(adGroupView.rows[0].parentNodeKey, 'cp-1');
  assert.equal(adGroupView.rows[0].parentDisplayLabel, '同名Campaign');
  assert.deepEqual(JSON.parse(JSON.stringify(adGroupView.rows[0].parentPath.map(item => item.displayLabel))), ['同名Campaign']);
});

test('A18-3C1-V3 Red: 旧parent宽度被忽略且固定宽度只计算No対象名比較結果', () => {
  assert.equal(typeof api.resolveTverHorizontalWidths, 'function');
  const storage = makeMemoryStorage({
    [api.TVER_COLUMN_WIDTH_STORAGE_KEY]: JSON.stringify({ Campaign: { parent: 500, target: 390, comparison: 180 } }),
    otherPreference: 'keep',
  });
  const widths = api.resolveTverHorizontalWidths('Campaign', [{ key: 'budget' }], storage);
  assert.deepEqual(JSON.parse(JSON.stringify(widths)), { no: 56, target: 390, comparison: 180, fields: { budget: 160 }, fixed: 626 });
  assert.equal(api.getTverColumnWidth('Campaign', 'parent', storage), 160);
  api.setTverColumnWidth('Campaign', 'parent', 480, storage);
  assert.equal(JSON.parse(storage.getItem(api.TVER_COLUMN_WIDTH_STORAGE_KEY)).Campaign.parent, 500);
  const html = api.buildTverHorizontalTableHtml(api.buildTverHorizontalViewModel(makeA183Run(), 'Campaign'), { storage });
  assert.doesNotMatch(html, /data-column-key="parent"|--tver-parent-width/);
  assert.match(html, /--tver-fixed-width:626px/);
});

test('A18-3C1-V3 Red: header和body所有同名列使用同一resolved width', () => {
  const storage = makeMemoryStorage({
    [api.TVER_COLUMN_WIDTH_STORAGE_KEY]: JSON.stringify({ Campaign: { target: 390, comparison: 180, budget: 240 } }),
  });
  const view = api.buildTverHorizontalViewModel(makeA183Run(), 'Campaign');
  const widths = api.resolveTverHorizontalWidths('Campaign', view.columns, storage);
  const html = api.buildTverHorizontalTableHtml(view, { storage });
  const expected = { no: widths.no, target: widths.target, comparison: widths.comparison, budget: widths.fields.budget };
  for (const [key, width] of Object.entries(expected)) {
    const matches = [...html.matchAll(new RegExp(`data-column-key="${key}"[^>]*style="width:(\\d+)px;min-width:(\\d+)px"`, 'g'))];
    assert.ok(matches.length >= 2, `${key} should be present in header and body`);
    assert.ok(matches.every(match => Number(match[1]) === width && Number(match[2]) === width), `${key} width must be ${width}`);
  }
});

test('A18-3C1-V3 Red: sticky current-group bar使用实际header高度并支持A到B切换', () => {
  assert.equal(typeof api.syncTverHorizontalStickyPresentation, 'function');
  const classes = new Set();
  const attrs = {};
  const text = { textContent: '' };
  const label = {
    style: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
    },
    setAttribute(name, value) { attrs[name] = value; },
    querySelector(selector) { return selector === '[data-tver-sticky-group-text]' ? text : null; },
  };
  const shellStyle = { values: {}, setProperty(name, value) { this.values[name] = value; } };
  const shell = { style: shellStyle, getBoundingClientRect() { return { bottom: 900 }; } };
  const header = { getBoundingClientRect() { return { top: 0, bottom: 64, height: 64 }; } };
  const track = { style: {} };
  const scroll = { scrollLeft: 0 };
  const rowA = { textContent: 'Group A', getAttribute(name) { return name === 'data-group-key' ? 'group-a' : null; }, getBoundingClientRect() { return { top: 52 }; } };
  const rowB = { textContent: 'Group B', getAttribute(name) { return name === 'data-group-key' ? 'group-b' : null; }, getBoundingClientRect() { return { top: 180 }; } };
  const panel = {
    querySelector(selector) {
      return selector === '.tver-horizontal-scroll-shell' ? shell
        : selector === '.tver-horizontal-scroll' ? scroll
        : selector === '[data-tver-sticky-header-track]' ? track
        : selector === '.tver-horizontal-scroll table[data-level]' ? {}
        : selector === '[data-tver-sticky-group]' ? label
        : selector === '[data-tver-sticky-header]' ? header : null;
    },
    querySelectorAll(selector) { return selector.includes('tver-horizontal-group-row') ? [rowA, rowB] : []; },
  };
  api.syncTverHorizontalStickyPresentation(panel);
  assert.equal(label.style.top, '64px');
  assert.equal(shellStyle.values['--tver-sticky-header-height'], '64px');
  assert.equal(text.textContent, 'Group A');
  assert.equal(attrs['aria-hidden'], 'false');
  rowA.getBoundingClientRect = () => ({ top: -20 });
  rowB.getBoundingClientRect = () => ({ top: 58 });
  api.syncTverHorizontalStickyPresentation(panel);
  assert.equal(text.textContent, 'Group B');
});

test('A18-3C1-V3 Red: Campaign没有sticky父级bar且sticky更新使用rAF节流契约', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  const campaign = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.doesNotMatch(campaign.html, /data-tver-sticky-group/);
  assert.equal(typeof api.scheduleTverHorizontalStickySync, 'function');
  assert.match(source, /requestAnimationFrame/);
  assert.doesNotMatch(source, /groupHtml=.*data-tver-sticky-group/);
});

test('A18-3C1-V3 Red: 删除parent后resize仍同步header/body且不写parent宽度', () => {
  const makeStyle = () => ({
    width: '160px', minWidth: '160px', values: {},
    setProperty(key, value) { this.values[key] = value; },
    getPropertyValue(key) { return this.values[key] || ''; },
  });
  const makeCol = (key, width = 160) => ({ style: { width: `${width}px`, minWidth: `${width}px` }, getAttribute(name) { return name === 'data-column-key' ? key : null; } });
  const makeTable = () => {
    const cols = ['no', 'target', 'comparison', 'budget'].map(key => makeCol(key, key === 'no' ? 56 : key === 'target' ? 280 : key === 'comparison' ? 160 : 160));
    return { style: makeStyle(), getAttribute(name) { return name === 'data-level' ? 'Campaign' : null; }, querySelectorAll(selector) { return selector.startsWith('col[') ? cols : []; }, cols };
  };
  const bodyTable = makeTable();
  const fixedTable = makeTable();
  const dynamicTable = makeTable();
  const handle = {
    getAttribute(name) { return name === 'data-action' ? 'resize-column' : name === 'data-column-key' ? 'budget' : null; },
    closest(selector) { return selector === 'table' ? dynamicTable : selector === '[data-action="resize-column"]' ? handle : null; },
  };
  const documentHandlers = {};
  const ownerDocument = { addEventListener(type, handler) { documentHandlers[type] = handler; }, removeEventListener() {} };
  const panelHandlers = {};
  const panel = {
    __tverHorizontalEventsBound: false, ownerDocument,
    addEventListener(type, handler) { panelHandlers[type] = handler; },
    contains(target) { return target === handle; },
    querySelectorAll(selector) { return selector.startsWith('table[data-level') ? [bodyTable, fixedTable, dynamicTable] : []; },
    querySelector(selector) { return selector === '.tver-horizontal-scroll-shell' ? { style: makeStyle() } : null; },
  };
  api.bindTverHorizontalInteractions(panel);
  panelHandlers.pointerdown({ target: handle, clientX: 100, preventDefault() {} });
  documentHandlers.pointermove({ clientX: 140 });
  for (const table of [bodyTable, fixedTable, dynamicTable]) {
    const budget = table.cols.find(col => col.getAttribute('data-column-key') === 'budget');
    assert.equal(budget.style.width, '200px');
    assert.equal(table.style.values['--tver-comparison-width'], '160px');
    assert.equal(Object.prototype.hasOwnProperty.call(table.style.values, '--tver-parent-width'), false);
  }
});

test('A18-3C1-V3 Red: 三个Level使用同一显式总宽度且不依赖AG/Ad补偿', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /--tver-dynamic-width:/);
  assert.match(source, /--tver-table-width:/);
  assert.match(source, /\.tver-horizontal-scroll \.tver-horizontal-table\{[^}]*width:var\(--tver-table-width/);
  assert.match(source, /\.tver-horizontal-sticky-header-table\{[^}]*width:var\(--tver-dynamic-width/);
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const view = api.buildTverHorizontalViewModel(makeA183Run(), level);
    const html = api.buildTverHorizontalTableHtml(view);
    assert.match(html, /--tver-table-width:\d+px/);
    assert.match(html, /--tver-dynamic-width:\d+px/);
  }
  assert.doesNotMatch(source, /level===['"](?:Ad Group|Ad)['"][^}]*\d+px/);
});

test('A18-3C1-V3 Red: 默认不生成可见floating group bar但静态group row仍保留', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.doesNotMatch(html, /data-tver-sticky-group/);
    if (level !== 'Campaign') assert.match(html, /class="tver-horizontal-group-row"/);
  }
  assert.doesNotMatch(source, /groupHtml=.*data-tver-sticky-group/);
});

test('A18-3C1-V3 Red: 比較結果列可按Level独立调宽且固定总宽同步', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  const storage = makeMemoryStorage();
  api.setTverColumnWidth('Campaign', 'comparison', 220, storage);
  api.setTverColumnWidth('Ad Group', 'comparison', 240, storage);
  assert.equal(api.getTverColumnWidth('Campaign', 'comparison', storage), 220);
  assert.equal(api.getTverColumnWidth('Ad Group', 'comparison', storage), 240);
  assert.equal(api.getTverColumnWidth('Ad', 'comparison', storage), 160);
  const html = api.buildTverHorizontalTableHtml(api.buildTverHorizontalViewModel(makeA183Run(), 'Ad Group'), { storage });
  const comparisonHeaders = [...html.matchAll(/<th[^>]*data-column-key="comparison"[^>]*>/g)].map(match => match[0]);
  assert.ok(comparisonHeaders.length >= 1);
  assert.ok((html.match(/data-column-key="comparison"[^>]*>[\s\S]*?data-action="resize-column"/g) || []).length >= 1);
  assert.match(html, /--tver-fixed-width:576px/);
  assert.match(source, /style\.setProperty\(['"]--tver-fixed-width['"]/);
});

test('A18-3C1-V3 Red: 三个Level动态值默认单行省略且双击展开仍可见完整多行', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-cell-value\{[^}]*white-space:nowrap[^}]*overflow:hidden[^}]*text-overflow:ellipsis/);
  assert.match(source, /\.tver-horizontal-cell-toggle\.tver-horizontal-cell-expanded[^}]*\.tver-horizontal-cell-value\{[^}]*white-space:pre-wrap[^}]*max-height:none/);
  const run = makeA183Run();
  const before = JSON.stringify(run);
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(run, { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /data-row-variant="setting"/);
    assert.match(html, /data-row-variant="csv"/);
    assert.match(html, /class="tver-horizontal-cell-value"[^>]*title=/);
  }
  assert.equal(JSON.stringify(run), before);
});

function makeC2FakeFile(name, payload = {}) {
  return { name, size: 1, lastModified: 1, ...payload };
}

function makeC2Readers() {
  return {
    readSettingWorkbook: async file => file.workbook,
    readCsvFile: async file => file.csvText,
  };
}

function makeC2ValidFiles() {
  return {
    setting: makeC2FakeFile('任意の設定表.xlsx', { workbook: makeStructuredSettingWorkbook() }),
    csv: makeC2FakeFile('任意のダウンロード.csv', { csvText: makeRegisterCsv([{ campaign_name: 'C2 Campaign' }]) }),
  };
}

test('A18-3C2 Red: 默认只有一个multiple统一上传区且四个旧操作控件退出DOM', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.equal((source.match(/class="upload-zone"/g) || []).length, 1);
  assert.match(source, /id="tver-file-input"[^>]*type="file"[^>]*multiple/);
  assert.doesNotMatch(source, /id="setting-file"|id="csv-file"|id="show-example"|id="clear-check"|id="copy-exceptions"|id="export-exceptions"/);
  ['例を表示', 'クリア', '異常をコピー', 'BOM CSV 出力'].forEach(label => assert.doesNotMatch(source, new RegExp(label)));
  assert.match(source, /id="page-notice"/);
  assert.doesNotMatch(source, /チェックが完了しました。/);
});

test('A18-3C2 Red: 扩展名加内容识别，批量与任意文件名均可唯一分工', async () => {
  assert.equal(typeof api.identifyTverSettingWorkbook, 'function');
  assert.equal(typeof api.identifyTverCsvText, 'function');
  assert.equal(typeof api.identifyTverFiles, 'function');
  const { setting, csv } = makeC2ValidFiles();
  assert.equal(api.identifyTverSettingWorkbook(setting.workbook, { fileName: setting.name }).ok, true);
  assert.equal(api.identifyTverCsvText(csv.csvText, { fileName: csv.name }).ok, true);
  const result = await api.identifyTverFiles([setting, csv], makeC2Readers());
  assert.equal(result.ok, true);
  assert.equal(result.setting.file, setting);
  assert.equal(result.csv.file, csv);
  assert.equal(result.csv.schemaKind, 'register-without-ids');
});

test('A18-3C2 Red: CSV→xlsx与xlsx→CSV分次上传都合并后再启用检查且不自动运行', async () => {
  assert.equal(typeof api.setPageFiles, 'function');
  const readers = makeC2Readers();
  const { setting, csv } = makeC2ValidFiles();
  api.clearTverPage(undefined, { document: null, revokeObjectUrl() {} });
  await api.setPageFiles([csv], null, readers);
  assert.equal(api.getTverPageState().recognition.ok, false);
  assert.equal(api.getTverPageState().run, null);
  await api.setPageFiles([setting], null, readers);
  assert.equal(api.getTverPageState().recognition.ok, true);
  assert.equal(api.getTverPageState().settingFile, setting);
  assert.equal(api.getTverPageState().csvFile, csv);
  assert.equal(api.getTverPageState().run, null);
  api.clearTverPage(undefined, { document: null, revokeObjectUrl() {} });
  await api.setPageFiles([setting], null, readers);
  await api.setPageFiles([csv], null, readers);
  assert.equal(api.getTverPageState().recognition.ok, true);
  assert.equal(api.getTverPageState().settingFile, setting);
  assert.equal(api.getTverPageState().csvFile, csv);
});

test('A18-3C2 Red: 重复角色、unsupported与内容不合规文件全部阻止执行并给出原因', async () => {
  const readers = makeC2Readers();
  const { setting, csv } = makeC2ValidFiles();
  const secondSetting = makeC2FakeFile('第二个设置.xlsx', { workbook: makeStructuredSettingWorkbook() });
  const secondCsv = makeC2FakeFile('第二个CSV.csv', { csvText: makeRegisterCsv([{ campaign_name: 'Second' }]) });
  const unsupported = makeC2FakeFile('archive.zip');
  const unknownCsv = makeC2FakeFile('not-tver.csv', { csvText: 'foo,bar\r\nbaz,qux' });
  const unknownSetting = makeC2FakeFile('not-tver.xlsx', { workbook: { SheetNames: ['Other'], Sheets: { Other: [['foo', 'bar']] } } });
  for (const [files, expected] of [
    [[setting, secondSetting, csv], '設定表'],
    [[setting, csv, secondCsv], 'CSV'],
    [[setting, csv, unsupported], '対応外形式'],
    [[setting, unknownCsv], '識別できないファイル'],
    [[unknownSetting, csv], '識別できないファイル'],
  ]) {
    const result = await api.identifyTverFiles(files, readers);
    assert.equal(result.ok, false);
    assert.match(result.message, new RegExp(expected));
  }
});

test('A18-3C2 Red: 缺少任一类型时按钮disabled，唯一识别齐全时enabled且不改动其他控件契约', async () => {
  const readers = makeC2Readers();
  const { setting, csv } = makeC2ValidFiles();
  const elements = {
    'run-check': { disabled: null },
    'upload-recognition-state': { textContent: '', classList: { toggle() {} } },
    'setting-file-state': { textContent: '', classList: { toggle() {} } },
    'csv-file-state': { textContent: '', classList: { toggle() {} } },
  };
  const document = { getElementById(id) { return elements[id] || null; } };
  api.clearTverPage(undefined, { document: null, revokeObjectUrl() {} });
  api.updateActionButtons(document);
  assert.equal(elements['run-check'].disabled, true);
  await api.setPageFiles([setting], document, readers);
  assert.equal(elements['run-check'].disabled, true);
  await api.setPageFiles([csv], document, readers);
  assert.equal(elements['run-check'].disabled, false);
  assert.match(elements['setting-file-state'].textContent, /任意の設定表\.xlsx/);
  assert.match(elements['csv-file-state'].textContent, /任意のダウンロード\.csv/);
  assert.equal(api.hasRecognizedTverFiles(), true);
});

test('A18-3C2 Red: Level tabs恢复左对齐契约且不改变C1横向结果入口', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /\.tver-level-tabs\{[^}]*justify-content:center/);
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /class="tver-horizontal-table"/);
    assert.match(html, /data-row-variant="setting"/);
    assert.match(html, /data-row-variant="csv"/);
    assert.match(html, /data-column-key="comparison"/);
  }
});

test('A18-3C2-V1 Red: Level tabs恢复左对齐且仅固定列的rowspan单元格垂直居中', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /\.tver-level-tabs\{[^}]*justify-content:center/);
  assert.match(source, /\.tver-horizontal-table tbody td\.tver-horizontal-fixed\{[^}]*vertical-align:middle/);
  assert.match(source, /\.tver-horizontal-table th,\.tver-horizontal-table td\{[^}]*vertical-align:top/);
  assert.doesNotMatch(source, /\.tver-horizontal-table tbody td\{[^}]*vertical-align:middle/);
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /class="tver-horizontal-fixed[^>]*rowspan="2"/);
  }
});

test('A18-3C2-V1 Red: 检查按钮与结果摘要使用同一紧凑操作区且默认摘要隐藏', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /class="control-bar tver-action-result"/);
  assert.ok(source.indexOf('id="run-check"') < source.indexOf('id="tver-result-summary"'));
  assert.match(source, /class="tver-result-summary hidden"[^>]*id="tver-result-summary"/);
  assert.doesNotMatch(source, /<h2>チェック結果<\/h2>/);
  assert.doesNotMatch(source, /<section class="summary"/);
});

test('A18-3C2-V1 Red: 结果摘要保留既有三状态投影值且不再生成大标题', () => {
  const run = makeA183Run();
  run.statusCounts = { '一致': 115, '表記ゆれ一致': 0, '不一致': 2, '需确认': 100, '未匹配': 71 };
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.match(view.html, /一致[\s\S]*115/);
  assert.match(view.html, /不一致[\s\S]*2/);
  assert.match(view.html, /要確認[\s\S]*171/);
  assert.equal((view.html.match(/class="status-count /g) || []).length, 3);
  assert.doesNotMatch(view.html, /<h2>チェック結果<\/h2>/);
  assert.match(view.html, /class="tver-result-summary"/);
});

test('A18-3C3-B Red: 详情展示只从现有entry生成并仅保留不一致与要確認', () => {
  assert.equal(typeof api.buildTverHorizontalDetailViewModel, 'function');
  assert.equal(typeof api.buildTverHorizontalDetailRowHtml, 'function');
  const run = makeA183Run();
  run.entries = [
    makeA183Entry({ level: 'Campaign', entityKey: 'detail-cp', field: 'campaign_name', status: '一致' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'detail-cp', field: 'budget', status: '不一致', settingRawValue: '100', csvRawValue: '200' }),
    makeA183Entry({ level: 'Campaign', entityKey: 'detail-cp', field: 'daily_budget', status: '需确认', settingRawValue: '', csvRawValue: '50', conservativeReason: null, ruleBasis: 'strict' }),
  ];
  const node = makeA183Node({ nodeKey: 'detail-cp', level: 'Campaign', entityKey: 'detail-cp', entryIndexes: [0, 1, 2] });
  run.displayTree = { roots: [node], unattached: [] };
  const view = api.buildTverHorizontalViewModel(run, 'Campaign');
  const detail = api.buildTverHorizontalDetailViewModel(view.rows[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(detail.map(item => item.entryIndex))), [1, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify(detail.map(item => item.field))), ['budget', 'daily_budget']);
  assert.match(api.buildTverHorizontalDetailRowHtml(view.rows[0], view.columns), /tver-horizontal-detail-row/);
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /data-action="toggle-detail"/);
  assert.match(html, /class="tver-horizontal-detail-row hidden"/);
  const detailRowStart = html.indexOf('class="tver-horizontal-detail-row');
  const detailRow = html.slice(detailRowStart, html.indexOf('</tr>', detailRowStart) + 5);
  assert.match(detailRow, /予算/);
  assert.match(detailRow, /日予算/);
  assert.doesNotMatch(detailRow, /キャンペーン名/);
  assert.ok(detailRowStart > html.indexOf('data-row-variant="csv"'));
});

test('A18-3C3-B Red: 一致实体不生成详情行且比較結果不可展开', () => {
  const run = makeA183Run();
  const node = makeA183Node({ nodeKey: 'consistent-cp', level: 'Campaign', entityKey: 'consistent-cp', entryIndexes: [0] });
  run.entries = [makeA183Entry({ level: 'Campaign', entityKey: 'consistent-cp', field: 'campaign_name', status: '一致' })];
  run.displayTree = { roots: [node], unattached: [] };
  const html = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.doesNotMatch(html, /tver-horizontal-detail-row/);
  assert.doesNotMatch(html, /data-action="toggle-detail"/);
  assert.match(html, /class="tver-horizontal-entity-status tver-status-consistent"[^>]*>一致<\//);
});

test('A18-3C3-B Red: 详情理由映射覆盖不一致、证据、状态、媒体、性别、都道府県、日予算和日期校验', () => {
  assert.equal(typeof api.getTverDisplayReason, 'function');
  const cases = [
    ['不一致', {}, '設定表とCSVの値が異なります'],
    ['需确认', { conservativeReason: 'SETTING_SOURCE_NOT_PROVIDED' }, '設定表側に確認元がないため、CSV値を確認してください'],
    ['需确认', { conservativeReason: 'SETTING_EVIDENCE_NOT_PROVIDED' }, '設定表側に確認元がないため、CSV値を確認してください'],
    ['需确认', { conservativeReason: 'SETTING_CURRENT_STATUS_NOT_PROVIDED' }, '設定表に現在ステータスの確認元がありません'],
    ['需确认', { conservativeReason: 'SETTING_CREATIVE_ID_SOURCE_NOT_PROVIDED' }, '設定表にCreative IDの確認元がありません'],
    ['需确认', { conservativeReason: 'MEDIA_MAPPING_INSUFFICIENT' }, '設定表の放送局指定だけではCSV値との一致を確定できません'],
    ['需确认', { conservativeReason: 'SETTING_LOCAL_BROADCASTER_NOT_PROVIDED' }, '設定表にローカル局の確認元がありません'],
    ['需确认', { conservativeReason: 'LOCAL_BROADCASTER_FULL_SELECTION_UNPROVEN' }, 'ローカル局の全選択を確定できないため確認が必要です'],
    ['需确认', { conservativeReason: 'GENDER_CODE_MAPPING_UNPROVEN' }, '設定表表記とCSVコードの対応を確定できません'],
    ['需确认', { conservativeReason: 'PREF_EXCLUSION_CHANGE_AMBIGUOUS' }, '都道府県の除外指定に複数の確認元があるため確認が必要です'],
    ['需确认', { conservativeReason: 'TARGETING_EVIDENCE_UNCONFIRMED' }, '設定表のターゲティング根拠を確定できないため確認が必要です'],
    ['需确认', { validationIssues: [{ code: 'DATETIME_NOT_30_MINUTE_GRANULARITY' }] }, '日時がTVer設定単位（00分／30分）ではありません'],
  ];
  cases.forEach(([status, extra, expected], index) => {
    const entry = makeA183Entry({ level: 'Campaign', entityKey: 'reason-cp', field: index === cases.length - 1 ? 'start_datetime' : 'budget', status, ...extra });
    assert.equal(api.getTverDisplayReason(entry), expected, `case ${index}`);
  });
  assert.equal(api.getTverDisplayReason(makeA183Entry({ level: 'Campaign', entityKey: 'reason-cp', field: 'daily_budget', status: '需确认', settingRawValue: '', conservativeReason: null, ruleBasis: 'strict' })), '設定表の日予算が空欄のため確認が必要です');
  assert.equal(api.getTverDisplayReason(makeA183Entry({ level: 'Campaign', entityKey: 'reason-cp', field: 'budget', status: '需确认', conservativeReason: 'UNKNOWN_REASON', ruleBasis: 'UNKNOWN_RULE' })), '確認理由を自動判定できません。根拠を確認してください');
});

test('A18-3C3-B Red: 详情保留可读sourceRefs，null来源不伪造primary且多Evidence全部可见', () => {
  const sourceA = { fileName: 'setting-a.xlsx', sheetName: '配信設計', rowNumber: 28, columnName: 'CPN予算' };
  const sourceB = { fileName: 'setting-b.xlsx', sheetName: '変更履歴', rowNumber: 4, columnName: '予算' };
  const csvSource = { fileName: 'download.csv', rowNumber: 2, columnName: 'budget' };
  const entry = makeA183Entry({
    level: 'Campaign', entityKey: 'source-cp', field: 'budget', status: '需确认', conservativeReason: 'SETTING_EVIDENCE_AMBIGUOUS',
    sourceRefs: { setting: null, csv: csvSource },
    sourceEvidence: { setting: [sourceA, sourceB], csv: [csvSource], derivedFrom: [] },
  });
  const row = { rowKey: 'source-row', level: 'Campaign', visibleEntryIndexes: [0], entryIndexes: [0], cells: { budget: { entryIndexes: [0], entries: [entry] } } };
  const html = api.buildTverHorizontalDetailRowHtml(row, [{ key: 'budget', label: '予算' }]);
  assert.match(html, /根拠を表示/);
  assert.match(html, /設定表：ファイル setting-a\.xlsx \/ シート 配信設計 \/ 行 28 \/ 列 CPN予算/);
  assert.match(html, /設定表：ファイル setting-b\.xlsx \/ シート 変更履歴 \/ 行 4 \/ 列 予算/);
  assert.match(html, /CSV：ファイル download\.csv \/ 行 2 \/ 列 budget/);
  assert.doesNotMatch(html, /設定表側の直接確認元はありません/);
});

test('A18-3C3-B Red: null source和技术信息默认关闭，轻量详情默认不泄露原始技术代码', () => {
  const entry = makeA183Entry({
    level: 'Ad', entityKey: 'tech-ad', field: 'creative_id', status: '需确认', conservativeReason: 'SETTING_CREATIVE_ID_SOURCE_NOT_PROVIDED', ruleBasis: 'TVER_A16_CREATIVE_ID',
    sourceRefs: { setting: null, csv: null }, sourceEvidence: { setting: [], csv: [], derivedFrom: [] }, evidenceStates: { setting: 'not_provided', csv: 'available' },
    validationIssues: [{ code: 'SOME_VALIDATION_CODE' }],
  });
  const html = api.buildTverHorizontalDetailRowHtml({ rowKey: 'tech-row', level: 'Ad', visibleEntryIndexes: [0], entryIndexes: [0], cells: { creative_id: { entryIndexes: [0], entries: [entry] } } }, [{ key: 'creative_id', label: 'Creative ID' }]);
  assert.match(html, /設定表側の直接確認元はありません/);
  assert.match(html, /CSV側の直接確認元はありません/);
  const technicalStart = html.indexOf('<details class="tver-horizontal-detail-technical"');
  assert.ok(technicalStart >= 0);
  assert.doesNotMatch(html.slice(0, technicalStart), /SETTING_CREATIVE_ID_SOURCE_NOT_PROVIDED|TVER_A16_CREATIVE_ID|SOME_VALIDATION_CODE/);
  assert.match(html.slice(technicalStart), /conservativeReason/);
  assert.match(html.slice(technicalStart), /ruleBasis/);
  assert.match(html.slice(technicalStart), /comparisonStatus/);
  assert.match(html.slice(technicalStart), /displayStatus/);
  assert.match(html.slice(technicalStart), /evidenceStates/);
  assert.match(html.slice(technicalStart), /validationIssues\.code/);
  assert.doesNotMatch(html.slice(technicalStart, technicalStart + 120), / open[=>]/);
  assert.doesNotMatch(html, /sourceEvidence|derivedFrom/);
});

test('A18-3C3-B Red: 比較結果详情展开为单一实体且再次点击收起', () => {
  assert.equal(typeof api.setTverHorizontalDetailExpanded, 'function');
  const state = new Map();
  const makeControl = key => ({
    getAttribute(name) { return name === 'data-row-key' ? key : name === 'data-action' ? 'toggle-detail' : null; },
    setAttribute(name, value) { state.set(`${key}:${name}`, value); },
  });
  const makeRow = key => ({
    hidden: true,
    classList: { toggle(name, value) { state.set(`${key}:${name}`, value); } },
    getAttribute(name) { return name === 'data-detail-row-key' ? key : null; },
  });
  const controlA = makeControl('A');
  const controlB = makeControl('B');
  const rowA = makeRow('A');
  const rowB = makeRow('B');
  const panel = { querySelectorAll(selector) { return selector.includes('toggle-detail') ? [controlA, controlB] : [rowA, rowB]; } };
  assert.equal(api.setTverHorizontalDetailExpanded(panel, controlA), true);
  assert.equal(rowA.hidden, false);
  assert.equal(state.get('A:aria-expanded'), 'true');
  assert.equal(api.setTverHorizontalDetailExpanded(panel, controlB), true);
  assert.equal(rowA.hidden, true);
  assert.equal(rowB.hidden, false);
  assert.equal(state.get('A:aria-expanded'), 'false');
  assert.equal(api.setTverHorizontalDetailExpanded(panel, controlB), false);
  assert.equal(rowB.hidden, true);
});

test('A18-3C3-B Red: 详情层三Level均存在且不改变entries/statusCounts', () => {
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const entry = makeA183Entry({ level, entityKey: `detail-${level}`, field: level === 'Campaign' ? 'budget' : level === 'Ad Group' ? 'media' : 'creative_id', status: '不一致' });
    const node = makeA183Node({ nodeKey: `detail-${level}`, level, entityKey: `detail-${level}`, entryIndexes: [0] });
    const run = { entries: [entry], displayTree: { roots: [node], unattached: [] }, statusCounts: makeA183StatusCounts({ '不一致': 1 }), matching: {}, schemaNotices: [] };
    const before = JSON.stringify({ entries: run.entries, statusCounts: run.statusCounts, node: run.displayTree });
    const html = api.renderTverRun(run, { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, /tver-horizontal-detail-row/);
    assert.match(html, /data-row-variant="setting"/);
    assert.match(html, /data-row-variant="csv"/);
    assert.equal(JSON.stringify({ entries: run.entries, statusCounts: run.statusCounts, node: run.displayTree }), before);
  }
});

test('A18-3C3-B-V2 Red: 三个Level只生成结果表自身的原生横向滚动容器', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /tver-horizontal-floating-scrollbar|data-tver-floating-scrollbar/);
  assert.doesNotMatch(source, /position:fixed/);
  assert.match(source, /\.tver-horizontal-scroll\{[^}]*overflow-x:auto/);
  assert.doesNotMatch(source, /\.tver-horizontal-scroll\{[^}]*overflow-x:scroll/);
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.match(html, new RegExp(`data-level="${level}"`));
    assert.equal((html.match(/class="tver-horizontal-scroll(?:\s|\")/g) || []).length, 1);
    assert.match(html, /<div class="tver-horizontal-scroll"><table class="tver-horizontal-table"/);
    assert.doesNotMatch(html, /tver-horizontal-floating-scrollbar|data-tver-floating-scrollbar/);
  }
});

test('A18-3C3-B-V2 Red: Campaign存在横向溢出时由结果容器承载原生滚动', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(source, /\.tver-horizontal-scroll \.tver-horizontal-table\{[^}]*width:var\(--tver-table-width\)/);
  assert.match(html, /class="tver-horizontal-scroll"><table[^>]*style="[^\"]*--tver-table-width:\d+px/);
});

test('A18-3C3-B-V2 Red: Ad Group初次切换即可使用结果容器且不依赖window scroll', () => {
  const panelHandlers = {};
  const viewHandlers = {};
  const scroll = { scrollLeft: 0 };
  const panel = {
    __tverHorizontalEventsBound: false,
    ownerDocument: { defaultView: { addEventListener(type, handler) { viewHandlers[type] = handler; } } },
    addEventListener(type, handler) { panelHandlers[type] = handler; },
    querySelector(selector) {
      if (selector === '.tver-horizontal-scroll') return scroll;
      return null;
    },
    querySelectorAll() { return []; },
  };
  api.bindTverHorizontalInteractions(panel);
  assert.equal(typeof panelHandlers.scroll, 'function');
  assert.equal(viewHandlers.scroll, undefined);
  scroll.scrollLeft = 80;
  panelHandlers.scroll();
  assert.equal(scroll.scrollLeft, 80);
});

test('A18-3C3-B-V2 Red: Ad无横向溢出时仍使用auto而不是强制显示滚动条', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-scroll\{[^}]*overflow-x:auto/);
  assert.doesNotMatch(source, /\.tver-horizontal-scroll\{[^}]*overflow-x:scroll/);
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /class="tver-horizontal-scroll"><table class="tver-horizontal-table"/);
  assert.doesNotMatch(html, /data-tver-floating-scrollbar/);
});

test('A18-3C3-B-V2 Red: Level切换后每个当前结果只保留一个新的scroll容器且没有floating残留状态', () => {
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const view = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
    assert.equal(view.activeLevel, level);
    assert.equal((view.html.match(/class="tver-horizontal-scroll(?:\s|\")/g) || []).length, 1);
    assert.doesNotMatch(view.html, /tver-horizontal-floating-scrollbar|data-tver-floating-scrollbar/);
  }
});

test('A18-3C3-B-V2 Red: sticky header、group row和detail展开仍位于原生scroll容器内', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-sticky-header\{[^}]*position:sticky[^}]*top:0/);
  assert.match(source, /\.tver-horizontal-scroll \.tver-horizontal-group-row th\{[^}]*position:static/);
  assert.match(source, /syncTverHorizontalStickyPresentation/);
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(html, /class="tver-horizontal-scroll"><table[\s\S]*class="tver-horizontal-group-row"/);
  assert.match(html, /class="tver-horizontal-detail-row/);
});

function makeC3BV3ScrollPanel({ sourceScrollWidth = 1200, sourceClientWidth = 700 } = {}) {
  const panelHandlers = {};
  const sourceHandlers = {};
  const accessHandlers = {};
  const viewHandlers = {};
  const accessClasses = new Set();
  const makeStyle = () => ({
    values: {},
    display: '',
    setProperty(key, value) { this.values[key] = value; },
    getPropertyValue(key) { return this.values[key] || ''; },
  });
  const source = {
    scrollWidth: sourceScrollWidth,
    clientWidth: sourceClientWidth,
    scrollLeft: 0,
    addEventListener(type, handler) { sourceHandlers[type] = handler; },
    getBoundingClientRect() { return { top: 80, bottom: 680, left: 0, right: sourceClientWidth, width: sourceClientWidth, height: 600 }; },
  };
  const access = {
    hidden: true,
    scrollLeft: 0,
    clientWidth: sourceClientWidth,
    style: makeStyle(),
    classList: {
      add(name) { accessClasses.add(name); },
      remove(name) { accessClasses.delete(name); },
      toggle(name, force) { if(force === undefined ? !accessClasses.has(name) : force) accessClasses.add(name); else accessClasses.delete(name); },
      contains(name) { return accessClasses.has(name); },
    },
    addEventListener(type, handler) { accessHandlers[type] = handler; },
    removeEventListener() {},
    setAttribute(name, value) { if(name === 'hidden') this.hidden = true; this[name] = value; },
    removeAttribute(name) { if(name === 'hidden') this.hidden = false; },
  };
  const accessTrack = { style: makeStyle() };
  const headerTrack = { style: makeStyle() };
  const shell = { style: makeStyle(), getBoundingClientRect() { return { top: 80, bottom: 680 }; } };
  const header = { offsetHeight: 44, getBoundingClientRect() { return { top: 0, bottom: 44, height: 44 }; } };
  const bodyTable = {};
  const defaultView = {
    addEventListener(type, handler) { viewHandlers[type] = handler; },
  };
  const ownerDocument = { defaultView };
  const panel = {
    __tverHorizontalEventsBound: false,
    ownerDocument,
    addEventListener(type, handler) { panelHandlers[type] = handler; },
    contains() { return true; },
    querySelector(selector) {
      if(selector === '.tver-horizontal-scroll') return source;
      if(selector === '.tver-horizontal-scroll-access') return access;
      if(selector === '.tver-horizontal-scroll-access-track') return accessTrack;
      if(selector === '.tver-horizontal-scroll-shell') return shell;
      if(selector === '[data-tver-sticky-header-track]') return headerTrack;
      if(selector === '[data-tver-sticky-header]') return header;
      if(selector === '.tver-horizontal-scroll table[data-level]') return bodyTable;
      return null;
    },
    querySelectorAll() { return []; },
    classList: { remove() {}, add() {}, toggle() {} },
  };
  const fireScroll = target => {
    if(target === source && sourceHandlers.scroll) sourceHandlers.scroll({ target });
    if(target === access && accessHandlers.scroll) accessHandlers.scroll({ target });
    if(panelHandlers.scroll) panelHandlers.scroll({ target });
  };
  return { panel, panelHandlers, source, access, accessTrack, headerTrack, viewHandlers, fireScroll, ownerDocument };
}

function c3BV3AccessVisible(access) {
  return access.hidden === false && access.style.display !== 'none' && !access.classList.contains('hidden');
}

test('A18-3C3-B-V3 Red: access scrollbar存在于sticky header内部且不引入独立定位层', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /tver-horizontal-floating-scrollbar|data-tver-floating-scrollbar/);
  assert.doesNotMatch(source, /\.tver-horizontal-scroll-access[^}]*position\s*:\s*(?:fixed|absolute|sticky)/);
  assert.doesNotMatch(source, /max-height\s*:\s*min\(72vh|tver-horizontal-result-(?:viewport|scroll-region)/);
  assert.doesNotMatch(source, /IntersectionObserver|tver-horizontal-bottom-sentinel/);
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const headerStart = html.indexOf('class="tver-horizontal-sticky-header"');
  const sourceStart = html.indexOf('class="tver-horizontal-scroll"><table');
  const headerFragment = html.slice(headerStart, sourceStart);
  assert.ok(headerStart >= 0);
  assert.ok(sourceStart > headerStart);
  assert.match(headerFragment, /tver-horizontal-sticky-header-row/);
  assert.match(headerFragment, /tver-horizontal-scroll-access/);
  assert.ok(headerFragment.indexOf('tver-horizontal-sticky-header-fixed') >= 0);
  assert.ok(headerFragment.indexOf('tver-horizontal-sticky-header-dynamic') >= 0);
});

test('A18-3C3-B-V3 Red: overflow时显示access并将真实scrollWidth写入track range', () => {
  assert.equal(typeof api.syncTverHorizontalScrollAccess, 'function');
  const fixture = makeC3BV3ScrollPanel({ sourceScrollWidth: 1200, sourceClientWidth: 700 });
  api.syncTverHorizontalScrollAccess(fixture.panel);
  assert.equal(c3BV3AccessVisible(fixture.access), true);
  assert.equal(fixture.accessTrack.style.width, '1200px');
});

test('A18-3C3-B-V3 Red: 无overflow时access折叠且不留下空槽', () => {
  const fixture = makeC3BV3ScrollPanel({ sourceScrollWidth: 700, sourceClientWidth: 700 });
  assert.equal(typeof api.syncTverHorizontalScrollAccess, 'function');
  fixture.access.hidden = false;
  fixture.access.style.display = '';
  fixture.access.classList.remove('hidden');
  api.syncTverHorizontalScrollAccess(fixture.panel);
  assert.equal(c3BV3AccessVisible(fixture.access), false);
  assert.equal(fixture.access.hidden, true);
});

test('A18-3C3-B-V3 Red: source与access双向scrollLeft同步且sticky header以source为基准', () => {
  const fixture = makeC3BV3ScrollPanel();
  assert.equal(typeof api.bindTverHorizontalInteractions, 'function');
  api.bindTverHorizontalInteractions(fixture.panel);
  fixture.source.scrollLeft = 140;
  fixture.fireScroll(fixture.source);
  assert.equal(fixture.access.scrollLeft, 140);
  assert.equal(fixture.headerTrack.style.transform, 'translate3d(-140px,0,0)');
  fixture.access.scrollLeft = 75;
  fixture.fireScroll(fixture.access);
  assert.equal(fixture.source.scrollLeft, 75);
  assert.equal(fixture.headerTrack.style.transform, 'translate3d(-75px,0,0)');
  assert.equal(fixture.viewHandlers.scroll, undefined);
});

test('A18-3C3-B-V3 Red: Ad Group render后立即根据overflow显示access而不等待resize或页面滚动', () => {
  const fixture = makeC3BV3ScrollPanel({ sourceScrollWidth: 1080, sourceClientWidth: 700 });
  let rendered = '';
  Object.defineProperty(fixture.panel, 'innerHTML', {
    get() { return rendered; },
    set(value) { rendered = value; },
  });
  const summary = { innerHTML: '', classList: { remove() {} } };
  const document = {
    defaultView: fixture.ownerDocument.defaultView,
    getElementById(id) { return id === 'results-panel' ? fixture.panel : id === 'tver-result-summary' ? summary : null; },
  };
  fixture.panel.ownerDocument = document;
  const result = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(result.activeLevel, 'Ad Group');
  assert.equal(c3BV3AccessVisible(fixture.access), true);
});

test('A18-3C3-B-V3 Red: header高度自然包含access且body首行继续位于header之后', () => {
  const source = fs.readFileSync(htmlPath, 'utf8');
  assert.match(source, /\.tver-horizontal-sticky-header\{[^}]*display:block/);
  assert.doesNotMatch(source, /\.tver-horizontal-sticky-header\{[^}]*height\s*:/);
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  const headerStart = html.indexOf('class="tver-horizontal-sticky-header"');
  const sourceStart = html.indexOf('class="tver-horizontal-scroll"><table');
  assert.ok(headerStart >= 0 && sourceStart > headerStart);
  assert.ok(html.indexOf('tver-horizontal-scroll-access', headerStart) < sourceStart);
});

test('A18-3C3-B-V3 Red: 列宽或detail变化后重新测量access track且不生成第二个access', () => {
  const fixture = makeC3BV3ScrollPanel({ sourceScrollWidth: 1000, sourceClientWidth: 700 });
  assert.equal(typeof api.syncTverHorizontalScrollAccess, 'function');
  api.syncTverHorizontalScrollAccess(fixture.panel);
  fixture.source.scrollWidth = 1360;
  api.syncTverHorizontalScrollAccess(fixture.panel);
  assert.equal(fixture.accessTrack.style.width, '1360px');
  const html = api.renderTverRun(makeA183Run(), { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.equal((html.match(/class="tver-horizontal-scroll-access(?:\s|\")/g) || []).length, 1);
  assert.match(html, /class="tver-horizontal-detail-row/);
});

test('A18-3C3-B-V3 Red: 三个Level render后均只有当前access且新source从scrollLeft 0开始', () => {
  for (const level of ['Campaign', 'Ad Group', 'Ad']) {
    const html = api.renderTverRun(makeA183Run(), { activeLevel: level, document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    assert.equal((html.match(/class="tver-horizontal-scroll-access(?:\s|\")/g) || []).length, 1);
    assert.equal((html.match(/class="tver-horizontal-scroll"><table/g) || []).length, 1);
    assert.doesNotMatch(html, /scrollLeft\s*=/);
  }
});

function c344SettingTargeting(label, rawValue) {
  return {
    sourceEvidence: {
      targeting: {
        [label]: [{
          fileName: 'c344-setting.xlsx', sheetName: '設定', rowNumber: 2495,
          columnName: label, rawValue: String(rawValue ?? ''),
        }],
      },
    },
  };
}

function c344CsvAdGroup(field, rawValue, schemaKind = 'edit-with-ids') {
  const value = String(rawValue ?? '');
  const source = { fileName: 'c344.csv', sheetName: null, rowNumber: 2, columnName: field, rawValue: value };
  if (schemaKind === 'register-without-ids') {
    return { fields: { [field]: value }, sourceEvidence: { fields: { [field]: [source] } } };
  }
  return { fields: { [field]: value }, rawRows: [{ sourceRefs: { [field]: source } }] };
}

function c344Input(field, settingLabel, settingValue, csvValue, schemaKind = 'edit-with-ids') {
  const input = api.buildTverA17TargetingComparisonInputs(
    c344SettingTargeting(settingLabel, settingValue),
    c344CsvAdGroup(field, csvValue, schemaKind),
    schemaKind,
    { level: 'Ad Group', entityKey: 'c344-setting-adg', csvEntityKey: 'c344-csv-adg' },
  ).find(candidate => candidate.field === field);
  assert.ok(input, `${field} comparison input should exist`);
  return input;
}

function uidSuffixInput(settingValue, csvValue, schemaKind = 'edit-with-ids', setting = null) {
  return api.buildTverA17TargetingComparisonInputs(
    setting || c344SettingTargeting('ASR', settingValue),
    c344CsvAdGroup('uid_suffix', csvValue, schemaKind),
    schemaKind,
    { level: 'Ad Group', entityKey: 'uid-setting-adg', csvEntityKey: 'uid-csv-adg' },
  ).find(candidate => candidate.field === 'uid_suffix');
}

test('C3-C4-4D-B2 FIX1 Red: uid_suffix exposes only exact-known Setting rules and strict numeric CSV set canonicalization', () => {
  assert.equal(typeof api.tverC344UidSuffixSettingCanonical, 'function');
  assert.equal(typeof api.tverC344UidSuffixCsvCanonical, 'function');
  assert.equal(api.tverC344UidSuffixSettingCanonical('0~8'), '0 1 2 3 4 5 6 7 8');
  assert.equal(api.tverC344UidSuffixSettingCanonical('0のみ'), '0');
  assert.equal(api.tverC344UidSuffixSettingCanonical('0-8'), null);
  assert.equal(api.tverC344UidSuffixSettingCanonical('0～8'), null);
  assert.equal(api.tverC344UidSuffixSettingCanonical('0〜8'), null);
  assert.equal(api.tverC344UidSuffixSettingCanonical('1~8'), null);
  assert.equal(api.tverC344UidSuffixSettingCanonical('ALL'), null);
  assert.equal(api.tverC344UidSuffixCsvCanonical('0 8 2 1 0'), '0 1 2 8');
  assert.equal(api.tverC344UidSuffixCsvCanonical('0,8,2,1,0'), '0 1 2 8');
  assert.equal(api.tverC344UidSuffixCsvCanonical('0 X 2'), null);
  assert.equal(api.tverC344UidSuffixCsvCanonical(''), '');
});

test('C3-C4-4D-B2 FIX1 Red: uid_suffix is mapped through the existing ASR/sourceRefs/entity field path for both CSV schemas', () => {
  for (const schemaKind of ['edit-with-ids', 'register-without-ids']) {
    const input = uidSuffixInput('0~8', '0 1 2 3 4 5 6 7 8', schemaKind);
    assert.ok(input, `uid_suffix input should exist for ${schemaKind}`);
    assert.equal(input.settingValue, '0~8');
    assert.equal(input.csvValue, '0 1 2 3 4 5 6 7 8');
    assert.equal(input.settingCanonical.value, '0 1 2 3 4 5 6 7 8');
    assert.equal(input.csvCanonical.value, '0 1 2 3 4 5 6 7 8');
    assert.equal(input.sourceEvidence.setting[0].columnName, 'ASR');
    assert.equal(input.sourceEvidence.csv[0].columnName, 'uid_suffix');
  }
});

test('C3-C4-4D-B2 FIX1 Red U1-U7: uid_suffix compares exact-known Setting and canonical CSV semantics conservatively', () => {
  const cases = [
    ['0~8', '0 1 2 3 4 5 6 7 8', '一致'],
    ['0のみ', '0', '一致'],
    ['0~8', '8 7 6 5 4 3 2 1 0', '一致'],
    ['0のみ', '0 0', '一致'],
    ['0~8', '9', '不一致'],
    ['0-8', '0 1 2 3 4 5 6 7 8', '要確認'],
    ['0のみ', '0 X', '要確認'],
    ['', '', '一致'],
  ];
  for (const schemaKind of ['edit-with-ids', 'register-without-ids']) {
    for (const [settingValue, csvValue, expectedStatus] of cases) {
      const input = uidSuffixInput(settingValue, csvValue, schemaKind);
      assert.ok(input, `uid_suffix input should exist for ${schemaKind} ${settingValue || '<empty>'}/${csvValue || '<empty>'}`);
      const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
      assert.equal(api.projectTverDisplayStatus(entry.displayStatus), expectedStatus, `${schemaKind} ${settingValue || '<empty>'}/${csvValue || '<empty>'}`);
      if (settingValue === '' && csvValue === '') assert.equal(entry.neutral, true);
    }
  }
});

test('C3-C4-4D-B2 FIX1 Red U8-U9: uid_suffix single-side values are 不一致 while unknown values remain 要確認', () => {
  const settingOnly = uidSuffixInput('0のみ', '');
  const settingOnlyEntry = api.buildComparisonRun({ fields: [settingOnly] }).entries[0];
  assert.equal(api.projectTverDisplayStatus(settingOnlyEntry.displayStatus), '不一致');

  const csvOnly = uidSuffixInput('0', '0', 'edit-with-ids', { sourceEvidence: { targeting: {} } });
  const csvOnlyEntry = api.buildComparisonRun({ fields: [csvOnly] }).entries[0];
  assert.equal(api.projectTverDisplayStatus(csvOnlyEntry.displayStatus), '不一致');

  const unknownCsv = uidSuffixInput('0のみ', 'abc');
  const unknownCsvEntry = api.buildComparisonRun({ fields: [unknownCsv] }).entries[0];
  assert.equal(api.projectTverDisplayStatus(unknownCsvEntry.displayStatus), '要確認');
});

test('C3-C4-4D-B2 FIX1 Red U10-U11: uid_suffix preserves raw display values and projects internal variant status to 一致', () => {
  const input = uidSuffixInput('0~8', '0 1 2 3 4 5 6 7 8');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.settingRawValue, '0~8');
  assert.equal(entry.csvRawValue, '0 1 2 3 4 5 6 7 8');
  assert.equal(api.formatTverDisplayValue(entry, 'setting'), '0~8');
  assert.equal(api.formatTverDisplayValue(entry, 'csv'), '0 1 2 3 4 5 6 7 8');
  assert.equal(entry.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '一致');
  assert.notEqual(api.projectTverDisplayStatus(entry.displayStatus), '表記ゆれ一致');
});

test('C3-C4-4D Red: annual_income only maps the three confirmed Setting buckets and keeps display/source raw', () => {
  const cases = [['600万円以上', '6'], ['800万円以上', '8'], ['1000万円以上', '10']];
  for (const [settingValue, expectedCanonical] of cases) {
    const resolved = api.resolveSettingTargetingForComparison(
      c344SettingTargeting('世帯年収●', `  ${settingValue}　`), 'annual_income',
    );
    assert.equal(resolved.rawValue, `  ${settingValue}　`);
    assert.equal(resolved.canonicalValue, expectedCanonical);
    assert.equal(resolved.comparable, true);
    assert.equal(resolved.primarySource.columnName, '世帯年収●');
    assert.equal(resolved.primarySource.rawValue, `  ${settingValue}　`);
    for (const schemaKind of ['edit-with-ids', 'register-without-ids']) {
      const input = c344Input('annual_income', '世帯年収●', settingValue, expectedCanonical, schemaKind);
      assert.equal(input.settingValue, settingValue);
      assert.equal(input.csvValue, expectedCanonical);
      assert.equal(input.settingCanonical.value, expectedCanonical);
      assert.equal(input.csvCanonical.value, expectedCanonical);
      assert.equal(input.csvSource.rawValue, expectedCanonical);
      assert.equal(input.sourceEvidence.setting[0].rawValue, settingValue);
      assert.equal(input.sourceEvidence.csv[0].rawValue, expectedCanonical);
      const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
      assert.equal(entry.settingRawValue, settingValue);
      assert.notEqual(entry.settingRawValue, expectedCanonical);
      assert.equal(entry.csvRawValue, expectedCanonical);
      assert.equal(entry.canonicalValues.setting, expectedCanonical);
      assert.equal(entry.canonicalValues.csv, expectedCanonical);
      assert.equal(entry.comparisonStatus, '表記ゆれ一致');
      assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '一致');
      const displayRun = makeA183Run();
      displayRun.entries[3] = { ...entry, level: 'Ad Group', entityKey: 'adg-1', csvEntityKey: 'csv-adg-1' };
      const displayHtml = api.renderTverRun(displayRun, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
      const escapedSettingValue = settingValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const annualCellIndex = displayHtml.indexOf('data-field-key="annual_income"');
      const settingRowStart = displayHtml.lastIndexOf('<tr', annualCellIndex);
      const settingRowEnd = displayHtml.indexOf('</tr>', annualCellIndex);
      const settingRow = settingRowStart >= 0 && settingRowEnd >= 0 ? displayHtml.slice(settingRowStart, settingRowEnd + 5) : '';
      assert.match(settingRow, new RegExp(`data-field-key="annual_income"[^>]*>[\\s\\S]*?title="${escapedSettingValue}">${escapedSettingValue}</span>`));
      assert.doesNotMatch(settingRow, new RegExp(`data-field-key="annual_income"[^>]*>[\\s\\S]*?title="${expectedCanonical}">${expectedCanonical}</span>`));
    }
  }
});

test('C3-C4-4D Red: annual_income rejects unproven buckets and separates explicit empty from unavailable', () => {
  const unknown = api.resolveSettingTargetingForComparison(
    c344SettingTargeting('世帯年収●', '700万円以上'), 'annual_income',
  );
  assert.equal(unknown.canonicalValue, null);
  assert.equal(unknown.comparable, false);
  assert.equal(unknown.shouldGenerate, true);
  assert.equal(unknown.diagnostics[0].code, 'TARGETING_FIELD_UNSUPPORTED');

  const unknownInput = c344Input('annual_income', '世帯年収●', '700万円以上', '8');
  const knownDeviceInput = {
    field: 'device', settingValue: 'CTV', csvValue: 'ctv',
    settingCanonical: { value: 'ctv', ruleId: 'TEST_DEVICE_CANONICAL', evidenceState: 'available' },
    csvCanonical: { value: 'ctv', ruleId: 'TEST_DEVICE_CSV', evidenceState: 'available' },
    settingEvidenceState: 'available', csvEvidenceState: 'available', comparable: true,
    ruleBasis: 'TEST_DEVICE_CANONICAL',
  };
  const isolatedRun = api.buildComparisonRun({ fields: [unknownInput, knownDeviceInput] });
  assert.equal(isolatedRun.entries.find(entry => entry.field === 'annual_income').comparisonStatus, '需确认');
  assert.equal(isolatedRun.entries.find(entry => entry.field === 'device').comparisonStatus, '表記ゆれ一致');

  for (const [settingValue, csvValue] of [['800万円以上', '6'], ['', '8'], ['800万円以上', '']]) {
    const input = c344Input('annual_income', '世帯年収●', settingValue, csvValue);
    const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
    assert.equal(entry.comparisonStatus, settingValue === '' && csvValue === '' ? '一致' : '不一致', `${settingValue || '<empty>'}/${csvValue || '<empty>'}`);
    assert.equal(entry.neutral, settingValue === '' && csvValue === '');
  }

  const empty = c344Input('annual_income', '世帯年収●', '', '');
  assert.equal(empty.settingCanonical.value, '');
  assert.equal(empty.csvCanonical.value, '');
  assert.equal(empty.settingEvidenceState, 'available');
  assert.equal(empty.csvEvidenceState, 'available');

  const unavailable = api.buildTverA17TargetingComparisonInputs(
    c344SettingTargeting('世帯年収●', ''),
    { fields: {} },
    'unknown-schema',
    { level: 'Ad Group', entityKey: 'c344-setting-adg', csvEntityKey: 'c344-csv-adg' },
  ).find(candidate => candidate.field === 'annual_income');
  assert.ok(unavailable);
  assert.equal(unavailable.csvEvidenceState, 'unavailable');
  assert.equal(unavailable.csvCanonical.value, null);
  assert.equal(unavailable.comparable, false);
  assert.equal(api.buildComparisonRun({ fields: [unavailable] }).entries[0].comparisonStatus, '需确认');
});

test('C3-C4-4D Fix1: unsupported targeting only reviews its own field and preserves unrelated field results', () => {
  const { model } = c342Setting();
  model.adGroups.forEach((group, index) => {
    const sourceEvidence = group.sourceEvidence || (group.sourceEvidence = {});
    const targeting = sourceEvidence.targeting || (sourceEvidence.targeting = {});
    targeting['世帯年収●'] = [c343Source('世帯年収●', '700万円以上', 70 + index)];
    targeting['デモグラフィック●'] = [c343Source('デモグラフィック●', '子なし', 80 + index)];
    targeting['年齢●'] = [c343Source('年齢●', '20歳〜34歳', 90 + index)];
    group.fields.startDateTime = '2026/02/01 00:00';
    group.fields.endDateTime = '2026/02/28 23:30';
    group.sourceRefs = {
      ...(group.sourceRefs || {}),
      startDateTime: c343Source('ADG開始日時(yyyy/mm/dd hh:mm)', '2026/02/01 00:00', 100 + index),
      endDateTime: c343Source('ADG終了日時(yyyy/mm/dd hh:mm)', '2026/02/28 23:30', 100 + index),
    };
  });
  const parsed = api.parseCsvText(makeRegisterCsv(model.adGroups.map((group, index) => ({
    campaign_name: model.campaigns[0].expectedName,
    adgroup_name: `C344-GP-${index}`,
    device: index % 2 ? 'ctv' : 'android ios pc', price: '11',
    dmp_segment: index < 2 ? '' : '68',
    adgroup_status: index < 2 ? '1' : '0',
    adgroup_start_datetime: '2026/02/01 00:00', adgroup_end_datetime: '2026/02/28 23:30',
    start_age: '20', end_age: '34', annual_income: '8', demography: '1',
  })), { fileName: 'c344-isolation.csv' }));
  const tree = api.buildRegisterTree(parsed);
  const matching = api.matchTverEntities(model, tree, {
    schemaKind: parsed.schema.kind,
    conversionContext: api.createTverConversionContext(parsed.schema.kind, tree),
  });
  assert.equal(matching.matches.filter(match => match.level === 'Ad Group' && match.status === 'matched').length, 4);
  const run = api.buildRunFromModels(model, tree, matching, parsed);
  const entries = run.entries.filter(entry => entry.level === 'Ad Group');
  assert.equal(entries.filter(entry => entry.field === 'annual_income').every(entry => entry.comparisonStatus === '需确认'), true);
  assert.equal(entries.filter(entry => entry.field === 'demography').every(entry => entry.comparisonStatus === '需确认'), true);
  const expectedKnownStatuses = {
    device: '表記ゆれ一致', price: '一致', adgroup_status: '一致',
    adgroup_start_datetime: '一致', adgroup_end_datetime: '一致', age: '表記ゆれ一致',
  };
  for (const [field, expectedStatus] of Object.entries(expectedKnownStatuses)) {
    assert.equal(entries.filter(entry => entry.field === field).every(entry => entry.comparisonStatus === expectedStatus), true, `${field} should remain ${expectedStatus}`);
  }
  assert.equal(run.entries.filter(entry => entry.level === 'Campaign' && entry.field === 'campaign_name').every(entry => entry.comparisonStatus === '一致'), true);
});

test('C3-C4-4D Red: demography only maps 子あり to 1 and compares CSV raw code while preserving Setting text', () => {
  const resolved = api.resolveSettingTargetingForComparison(
    c344SettingTargeting('デモグラフィック●', ' 子あり '), 'demography',
  );
  assert.equal(resolved.rawValue, ' 子あり ');
  assert.equal(resolved.canonicalValue, '1');
  assert.equal(resolved.comparable, true);
  assert.equal(resolved.primarySource.columnName, 'デモグラフィック●');

  for (const schemaKind of ['edit-with-ids', 'register-without-ids']) {
    const input = c344Input('demography', 'デモグラフィック●', '子あり', '1', schemaKind);
    assert.equal(input.settingValue, '子あり');
    assert.equal(input.csvValue, '1');
    assert.equal(input.settingCanonical.value, '1');
    assert.equal(input.csvCanonical.value, '1');
    assert.equal(input.sourceEvidence.setting[0].rawValue, '子あり');
    assert.equal(input.sourceEvidence.csv[0].rawValue, '1');
    const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
    assert.equal(entry.settingRawValue, '子あり');
    assert.notEqual(entry.settingRawValue, '1');
    assert.equal(entry.csvRawValue, '1');
    assert.equal(entry.canonicalValues.setting, '1');
    assert.equal(entry.canonicalValues.csv, '1');
    const displayRun = makeA183Run();
    displayRun.entries[3] = { ...entry, level: 'Ad Group', entityKey: 'adg-1', csvEntityKey: 'csv-adg-1' };
    const displayHtml = api.renderTverRun(displayRun, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
    const demographyCellIndex = displayHtml.indexOf('data-field-key="demography"');
    const settingRowStart = displayHtml.lastIndexOf('<tr', demographyCellIndex);
    const settingRowEnd = displayHtml.indexOf('</tr>', demographyCellIndex);
    const settingRow = settingRowStart >= 0 && settingRowEnd >= 0 ? displayHtml.slice(settingRowStart, settingRowEnd + 5) : '';
    assert.match(settingRow, /data-field-key="demography"[^>]*>[\s\S]*?title="子あり">子あり<\/span>/);
    assert.doesNotMatch(settingRow, /data-field-key="demography"[^>]*>[\s\S]*?title="1">1<\/span>/);
    assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '一致');
  }

  const other = api.buildComparisonRun({
    fields: [c344Input('demography', 'デモグラフィック●', '子あり', '2')],
  }).entries[0];
  assert.equal(other.comparisonStatus, '不一致');
  assert.equal(other.comparable, true);
});

test('C3-C4-4D Red: demography keeps childless explicit empty neutral, guards unknown labels, and does not enable affinity or unopened fields', () => {
  for (const [settingValue, csvValue] of [['', ''], ['子あり', ''], ['', '1']]) {
    const input = c344Input('demography', 'デモグラフィック●', settingValue, csvValue);
    const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
    assert.equal(entry.comparisonStatus, settingValue === '' && csvValue === '' ? '一致' : '不一致');
    assert.equal(entry.neutral, settingValue === '' && csvValue === '');
    if (settingValue === '') {
      assert.equal(input.settingCanonical.value, '');
      assert.notEqual(input.settingCanonical.value, '0');
    }
    if (csvValue === '') {
      assert.equal(input.csvCanonical.value, '');
      assert.notEqual(input.csvCanonical.value, '0');
    }
  }

  const unknown = api.resolveSettingTargetingForComparison(
    c344SettingTargeting('デモグラフィック●', '子なし'), 'demography',
  );
  assert.equal(unknown.canonicalValue, null);
  assert.equal(unknown.comparable, false);
  assert.equal(unknown.shouldGenerate, true);
  assert.equal(unknown.diagnostics[0].code, 'TARGETING_FIELD_UNSUPPORTED');

  const setting = {
    sourceEvidence: { targeting: {
      '世帯年収●': [{ fileName: 'c344.xlsx', sheetName: '設定', rowNumber: 1, columnName: '世帯年収●', rawValue: '' }],
      'デモグラフィック●': [{ fileName: 'c344.xlsx', sheetName: '設定', rowNumber: 2, columnName: 'デモグラフィック●', rawValue: '' }],
      '興味関心●': [{ fileName: 'c344.xlsx', sheetName: '設定', rowNumber: 3, columnName: '興味関心●', rawValue: 'アフィニティ：以下項目は拡張されないのでPC使えない\nテクノロジー・ガジェット／ラグジュアリー／ヘルスケア' }],
    } },
  };
  const csv = {
    fields: { annual_income: '', demography: '', affinity: '2' },
    rawRows: [{ sourceRefs: {
      annual_income: { fileName: 'c344.csv', sheetName: null, rowNumber: 2, columnName: 'annual_income', rawValue: '' },
      demography: { fileName: 'c344.csv', sheetName: null, rowNumber: 2, columnName: 'demography', rawValue: '' },
      affinity: { fileName: 'c344.csv', sheetName: null, rowNumber: 2, columnName: 'affinity', rawValue: '2' },
    } }],
  };
  const fields = api.buildTverA17TargetingComparisonInputs(setting, csv, 'edit-with-ids', {}).map(input => input.field);
  assert.deepEqual(JSON.parse(JSON.stringify(fields)), ['annual_income', 'demography']);
  for (const unopened of ['affinity', 'tv_usage_tendency', 'carrier', 'contents_group', 'genre', 'genre_exclude', 'subgenre', 'city']) {
    assert.equal(fields.includes(unopened), false, `${unopened} must remain unopened`);
  }
});

test('C3-C4-UI-FIX1A Red: pref 单侧显式空值不再进入需确认，双方空值保持 neutral', () => {
  const cases = [
    ['北海道 青森県', '', '不一致', false],
    ['', '01 02', '不一致', false],
    ['', '', '一致', true],
  ];
  for (const schemaKind of ['edit-with-ids', 'register-without-ids']) {
    for (const [settingValue, csvValue, expectedStatus, expectedNeutral] of cases) {
      const inputs = api.buildTverA17TargetingComparisonInputs(
        c344SettingTargeting('都道府県/市区町村●', settingValue),
        c344CsvAdGroup('pref', csvValue, schemaKind),
        schemaKind,
        { level: 'Ad Group', entityKey: 'fix1a-setting-pref', csvEntityKey: 'fix1a-csv-pref' },
      );
      const input = inputs.find(candidate => candidate.field === 'pref');
      assert.ok(input, `pref input should exist for ${schemaKind} ${settingValue || '<empty>'}/${csvValue || '<empty>'}`);
      const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
      assert.equal(entry.comparisonStatus, expectedStatus, `${schemaKind} ${settingValue || '<empty>'}/${csvValue || '<empty>'}`);
      assert.equal(entry.neutral, expectedNeutral, `${schemaKind} neutral ${settingValue || '<empty>'}/${csvValue || '<empty>'}`);
      assert.equal(api.projectTverDisplayStatus(entry.displayStatus), expectedStatus);
    }
  }
});

test('C3-C4-UI-FIX1A Red: pref 使用集合语义比较，不受顺序或集合增减影响', () => {
  const cases = [
    ['北海道 青森県', '01 02', '一致'],
    ['北海道 青森県', '02 01', '一致'],
    ['北海道 青森県 岩手県', '01 02', '不一致'],
    ['北海道 青森県', '01 02 03', '不一致'],
  ];
  for (const [settingValue, csvValue, expectedStatus] of cases) {
    const input = c344Input('pref', '都道府県/市区町村●', settingValue, csvValue);
    const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
    assert.equal(api.projectTverDisplayStatus(entry.displayStatus), expectedStatus, `${settingValue}/${csvValue}`);
  }
});

test('C3-C4-UI-FIX1A Red: pref 未知 Setting 名称与 CSV ID 继续保守为需确认', () => {
  const unknownSetting = c344Input('pref', '都道府県/市区町村●', '北海道 未知地域', '01 02');
  const unknownSettingEntry = api.buildComparisonRun({ fields: [unknownSetting] }).entries[0];
  assert.equal(unknownSettingEntry.comparisonStatus, '需确认');
  assert.equal(api.projectTverDisplayStatus(unknownSettingEntry.displayStatus), '要確認');
  assert.equal(unknownSetting.settingCanonical.value, null);
  assert.equal(unknownSetting.comparable, false);

  const unknownCsv = c344Input('pref', '都道府県/市区町村●', '北海道 青森県', '01 999');
  const unknownCsvEntry = api.buildComparisonRun({ fields: [unknownCsv] }).entries[0];
  assert.equal(unknownCsvEntry.comparisonStatus, '需确认');
  assert.equal(api.projectTverDisplayStatus(unknownCsvEntry.displayStatus), '要確認');
  assert.equal(unknownCsv.csvCanonical.value, null);
  assert.equal(unknownCsv.comparable, false);
});

test('C3-C4-UI-FIX1A Red: 非 pref targeting 的 null canonical 仍保持原有需确认行为', () => {
  const dictionaries = api.getTverIdDictionaries();
  const mediaInput = api.buildTverA17TargetingComparisonInputs(
    c344SettingTargeting('放送局●', dictionaries.media[0].id),
    c344CsvAdGroup('media', ''),
    'edit-with-ids',
    { level: 'Ad Group', entityKey: 'fix1a-setting-media', csvEntityKey: 'fix1a-csv-media' },
  ).find(candidate => candidate.field === 'media');
  assert.ok(mediaInput);
  assert.equal(mediaInput.csvCanonical.value, null);
  const entry = api.buildComparisonRun({ fields: [mediaInput] }).entries[0];
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '要確認');
  assert.equal(entry.comparisonStatus, '需确认');
});

function fix1bDisplayEntry(field, settingRawValue, csvRawValue, extra = {}) {
  return {
    field,
    settingRawValue,
    csvRawValue,
    comparisonStatus: '一致',
    displayStatus: '一致',
    canonicalValues: { setting: 'canonical-setting', csv: 'canonical-csv' },
    ...extra,
  };
}

test('C3-C4-UI-FIX1B Red B1-B4: CP CSV code只在显示层追加业务label', () => {
  assert.equal(typeof api.formatTverDisplayValue, 'function');
  const cases = [
    ['budget_type', '1', '1（月次予算）'],
    ['budget_type', '2', '2（期間予算）'],
    ['campaign_status', '0', '0（無効）'],
    ['campaign_status', '1', '1（有効）'],
    ['consumption_type', '1', '1（フラット）'],
    ['consumption_type', '2', '2（フル）'],
    ['report_target_flag', '0', '0（レポート対象に含めない）'],
    ['report_target_flag', '1', '1（レポート対象に含める）'],
  ];
  for (const [field, raw, expected] of cases) {
    assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry(field, '', raw), 'csv'), expected, field);
  }
});

test('C3-C4-UI-FIX1B Red B5-B6: GP confirmed code只在显示层追加业务label', () => {
  assert.equal(typeof api.formatTverDisplayValue, 'function');
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('annual_income', '', '6'), 'csv'), '6（600万円以上）');
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('annual_income', '', '8'), 'csv'), '8（800万円以上）');
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('annual_income', '', '10'), 'csv'), '10（1000万円以上）');
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('demography', '', '1'), 'csv'), '1（子あり）');
});

test('C3-C4-UI-FIX1B Red B7-B8: unknown code原样保留且demography=0不猜测子なし', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('budget_type', '', '99'), 'csv'), '99');
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('annual_income', '', '7'), 'csv'), '7');
  const demographyZero = api.formatTverDisplayValue(fix1bDisplayEntry('demography', '', '0'), 'csv');
  assert.equal(demographyZero, '0');
  assert.doesNotMatch(demographyZero, /子なし/);
});

test('C3-C4-UI-FIX1B Red: 横向表、详情与字段表均使用display-only code label', () => {
  const run = makeA183Run();
  run.entries[0] = { ...run.entries[0], field: 'budget_type', settingRawValue: '期間予算', csvRawValue: '2' };
  run.entries[1] = { ...run.entries[1], field: 'campaign_status', settingRawValue: '無効（規定値）', csvRawValue: '0' };
  run.entries[2] = { ...run.entries[2], field: 'consumption_type', settingRawValue: 'フル', csvRawValue: '1' };
  run.entries[3] = { ...run.entries[3], field: 'annual_income', settingRawValue: '800万円以上', csvRawValue: '8', comparisonStatus: '不一致', displayStatus: '不一致' };
  run.entries[4] = { ...run.entries[4], field: 'demography', settingRawValue: '子あり', csvRawValue: '1' };

  const campaignHtml = api.renderTverRun(run, { activeLevel: 'Campaign', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(campaignHtml, /title="2（期間予算）">2（期間予算）<\/span>/);
  assert.match(campaignHtml, /title="0（無効）">0（無効）<\/span>/);
  assert.match(campaignHtml, /title="1（フラット）">1（フラット）<\/span>/);

  const adGroupHtml = api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } }).html;
  assert.match(adGroupHtml, /title="8（800万円以上）">8（800万円以上）<\/span>/);
  assert.match(adGroupHtml, /title="1（子あり）">1（子あり）<\/span>/);
  assert.match(adGroupHtml, /CSV値<\/span><span class="tver-horizontal-detail-value">8（800万円以上）<\/span>/);
  const adGroupView = api.buildTverHorizontalViewModel(run, 'Ad Group');
  const detail = api.buildTverHorizontalDetailViewModel(adGroupView.rows[0]);
  const annualDetail = detail.find(item => item.field === 'annual_income');
  assert.equal(annualDetail.csvRawValue, '8');
  assert.equal(annualDetail.csvDisplayValue, '8（800万円以上）');

  const reportTargetHtml = api.buildTverEntityFieldTableHtml(
    { entryIndexes: [0] },
    [fix1bDisplayEntry('report_target_flag', '', '1')],
  );
  assert.match(reportTargetHtml, /1（レポート対象に含める）/);
});

test('C3-C4-UI-FIX1B Red B9-B10: display enhancement不改变comparisonStatus或canonicalValue', () => {
  const entry = fix1bDisplayEntry('annual_income', '800万円以上', '8', {
    comparisonStatus: '表記ゆれ一致',
    displayStatus: '一致',
    canonicalValues: { setting: '8', csv: '8' },
  });
  const before = JSON.stringify({ comparisonStatus: entry.comparisonStatus, canonicalValues: entry.canonicalValues });
  const displayValue = api.formatTverDisplayValue(entry, 'csv');
  assert.equal(displayValue, '8（800万円以上）');
  assert.equal(JSON.stringify({ comparisonStatus: entry.comparisonStatus, canonicalValues: entry.canonicalValues }), before);
  assert.equal(entry.comparisonStatus, '表記ゆれ一致');
  assert.deepEqual(entry.canonicalValues, { setting: '8', csv: '8' });

  const run = makeA183Run();
  run.entries[3] = { ...entry, level: 'Ad Group', entityKey: 'adg-1', csvEntityKey: 'csv-adg-1' };
  const beforeRender = JSON.stringify(run.entries[3]);
  api.renderTverRun(run, { activeLevel: 'Ad Group', document: null, filters: { status: 'all', abnormalOnly: false, keyword: '' } });
  assert.equal(JSON.stringify(run.entries[3]), beforeRender);
});

function makeFix1cRun(entries) {
  const node = makeA183Node({
    nodeKey: 'fix1c-adg-1',
    level: 'Ad Group',
    entityKey: 'fix1c-adg-1',
    displayLabel: 'FIX1C GP',
    entryIndexes: entries.map((_, index) => index),
  });
  return { entries, displayTree: { roots: [node], unattached: [] } };
}

test('C3-C4-UI-FIX1C Red C1-C4: JA优先，权威label使用JA，未知字段保持raw key', () => {
  assert.equal(typeof api.resolveTverHorizontalFieldLabel, 'function');
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad Group', 'pref'), '都道府県');
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad Group', 'annual_income'), '世帯年収');
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad Group', 'auction_type'), 'オークション設定');
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad Group', 'dmp_segment_expansion_threshold'), 'DMPセグメントの拡張');
});

test('C3-C4-4D-B2 FIX1A Red: uid_suffix header resolves to ASR while field key remains uid_suffix', () => {
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad Group', 'uid_suffix'), 'ASR');
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'uid_suffix'), 'ASR');
  const entry = makeA183Entry({
    level: 'Ad Group',
    entityKey: 'fix1a-adg-1',
    field: 'uid_suffix',
    status: '一致',
    settingRawValue: '0のみ',
    csvRawValue: '0',
    canonicalValues: { setting: '0', csv: '0' },
  });
  const view = api.buildTverHorizontalViewModel(makeFix1cRun([entry]), 'Ad Group');
  assert.equal(view.columns[0].key, 'uid_suffix');
  assert.equal(view.columns[0].label, 'ASR');
  assert.equal(entry.field, 'uid_suffix');
  assert.equal(entry.settingRawValue, '0のみ');
  assert.equal(entry.csvRawValue, '0');
  assert.deepEqual(entry.canonicalValues, { setting: '0', csv: '0' });
  assert.equal(entry.comparisonStatus, '一致');
});

test('C3-C4-UI-FIX1C Red C5-C6: 明确英文label次之，JA/EN均无时回退raw key', () => {
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad', 'url'), 'URL');
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad', 'tracking_url_start'), 'Tracking Start');
  assert.equal(api.resolveTverHorizontalFieldLabel('Ad Group', 'fix1c_unknown_field'), 'fix1c_unknown_field');
});

test('C3-C4-UI-FIX1C Red C7-C8: header label投影不改变comparison/raw/canonical', () => {
  const entry = makeA183Entry({
    level: 'Ad Group',
    entityKey: 'fix1c-adg-1',
    field: 'auction_type',
    status: '不一致',
    settingRawValue: '1',
    csvRawValue: '2',
    canonicalValues: { setting: '1', csv: '2' },
  });
  const run = makeFix1cRun([entry]);
  const before = JSON.stringify({
    comparisonStatus: entry.comparisonStatus,
    settingRawValue: entry.settingRawValue,
    csvRawValue: entry.csvRawValue,
    canonicalValues: entry.canonicalValues,
  });
  const view = api.buildTverHorizontalViewModel(run, 'Ad Group');
  assert.equal(view.columns[0].label, 'オークション設定');
  assert.equal(JSON.stringify({
    comparisonStatus: entry.comparisonStatus,
    settingRawValue: entry.settingRawValue,
    csvRawValue: entry.csvRawValue,
    canonicalValues: entry.canonicalValues,
  }), before);
});

test('C3-C4-UI-FIX1C Red C9: FIX1B code→label value display保持', () => {
  const entry = fix1bDisplayEntry('annual_income', '800万円以上', '8', {
    comparisonStatus: '表記ゆれ一致',
    canonicalValues: { setting: '8', csv: '8' },
  });
  assert.equal(api.formatTverDisplayValue(entry, 'csv'), '8（800万円以上）');
  assert.equal(entry.comparisonStatus, '表記ゆれ一致');
  assert.deepEqual(entry.canonicalValues, { setting: '8', csv: '8' });
});

test('C3-C4-UI-FIX1C Red C10: CP header/display contract不受影响', () => {
  assert.equal(api.buildTverHorizontalFieldLabel('Campaign', 'campaign_name'), 'キャンペーン名');
  assert.equal(api.buildTverHorizontalFieldLabel('Campaign', 'budget_type'), '予算タイプ');
  const entry = makeA183Entry({ level: 'Campaign', entityKey: 'fix1c-cp-1', field: 'campaign_name' });
  const node = makeA183Node({ nodeKey: 'fix1c-cp-1', level: 'Campaign', entityKey: 'fix1c-cp-1', entryIndexes: [0] });
  const view = api.buildTverHorizontalViewModel({ entries: [entry], displayTree: { roots: [node], unattached: [] } }, 'Campaign');
  assert.deepEqual(Array.from(view.columns, column => column.label), ['キャンペーン名']);
});

test('C3-C4-UI-FIX1C-R2 Red R2-1: auction_type使用权威管理画面項目名', () => {
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'auction_type'), 'オークション設定');
});

test('C3-C4-UI-FIX1C-R2 Red R2-2: DMP expansion使用权威管理画面項目名', () => {
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'dmp_segment_expansion_threshold'), 'DMPセグメントの拡張');
});

test('C3-C4-UI-FIX1C-R2 Red R2-3: 未知字段继续raw field key fallback', () => {
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'fix1c_r2_unknown_field'), 'fix1c_r2_unknown_field');
});

test('C3-C4-UI-FIX1C-R2 Red R2-4: 已有JA label不受R2影响', () => {
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'pref'), '都道府県');
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'annual_income'), '世帯年収');
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'demography'), 'デモグラフィック');
});

test('C3-C4-UI-FIX1C-R2 Red R2-5: header label patch不改变value display或comparisonStatus', () => {
  const entry = fix1bDisplayEntry('annual_income', '800万円以上', '8', {
    comparisonStatus: '表記ゆれ一致',
    canonicalValues: { setting: '8', csv: '8' },
  });
  const before = JSON.stringify({
    settingRawValue: entry.settingRawValue,
    csvRawValue: entry.csvRawValue,
    comparisonStatus: entry.comparisonStatus,
    canonicalValues: entry.canonicalValues,
  });
  assert.equal(api.buildTverHorizontalFieldLabel('Ad Group', 'auction_type'), 'オークション設定');
  assert.equal(api.formatTverDisplayValue(entry, 'csv'), '8（800万円以上）');
  assert.equal(JSON.stringify({
    settingRawValue: entry.settingRawValue,
    csvRawValue: entry.csvRawValue,
    comparisonStatus: entry.comparisonStatus,
    canonicalValues: entry.canonicalValues,
  }), before);
});

function makeFix1dPrefComparison(settingValue, csvValue, schemaKind = 'edit-with-ids') {
  const input = c344Input('pref', '都道府県/市区町村●', settingValue, csvValue, schemaKind);
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  return {
    input,
    entry: {
      ...entry,
      level: 'Ad Group',
      entityKey: input.entityKey,
      csvEntityKey: input.csvEntityKey,
      targetName: 'FIX1D GP',
    },
  };
}

function makeFix1dDetail(entry) {
  const node = makeA183Node({
    nodeKey: 'fix1d-adg-1',
    level: 'Ad Group',
    entityKey: entry.entityKey,
    displayLabel: 'FIX1D GP',
    entryIndexes: [0],
  });
  const view = api.buildTverHorizontalViewModel({ entries: [entry], displayTree: { roots: [node], unattached: [] } }, 'Ad Group');
  return api.buildTverHorizontalDetailViewModel(view.rows[0])[0];
}

test('C3-C4-UI-FIX1D Red D1: CSV不足显示Setting中有而CSV没有的都道府県', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  assert.equal(entry.comparisonStatus, '不一致');
  assert.equal(typeof api.buildTverPrefDiffDisplay, 'function');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.missingInCsv)), ['03']);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.extraInCsv)), []);
  assert.equal(diff.text, 'CSV不足：岩手県');
  assert.equal(makeFix1dDetail(entry).reason, 'CSV不足：岩手県');
});

test('C3-C4-UI-FIX1D Red D2: CSV多余显示CSV中有而Setting没有的都道府県', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '01 02 03');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.missingInCsv)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.extraInCsv)), ['03']);
  assert.equal(diff.text, 'CSV多余：岩手県');
});

test('C3-C4-UI-FIX1D Red D3: 双方向差异同时显示CSV不足与CSV多余', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02 04');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.missingInCsv)), ['03']);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.extraInCsv)), ['04']);
  assert.equal(diff.text, 'CSV不足：岩手県\nCSV多余：宮城県');
});

test('C3-C4-UI-FIX1D Red D4: Setting有值且CSV empty时列出全部CSV不足', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.equal(entry.comparisonStatus, '不一致');
  assert.deepEqual(JSON.parse(JSON.stringify(diff.missingInCsv)), ['01', '02']);
  assert.equal(diff.text, 'CSV不足：北海道、青森県');
});

test('C3-C4-UI-FIX1D Red D5: Setting empty且CSV有值时列出全部CSV多余', () => {
  const { entry } = makeFix1dPrefComparison('', '01 02');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.equal(entry.comparisonStatus, '不一致');
  assert.deepEqual(JSON.parse(JSON.stringify(diff.extraInCsv)), ['01', '02']);
  assert.equal(diff.text, 'CSV多余：北海道、青森県');
});

test('C3-C4-UI-FIX1D Red D6: 相同canonical set的顺序变化不产生diff', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '02 01');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '一致');
  assert.equal(diff.text, '');
});

test('C3-C4-UI-FIX1D Red D7: 双方empty为neutral且不产生diff', () => {
  const { entry } = makeFix1dPrefComparison('', '');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.equal(entry.comparisonStatus, '一致');
  assert.equal(entry.neutral, true);
  assert.equal(diff.text, '');
});

test('C3-C4-UI-FIX1D Red D8: Unknown Setting prefecture为要確認且不产生diff', () => {
  const { input, entry } = makeFix1dPrefComparison('北海道 未知地域', '01 02');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.equal(input.settingCanonical.value, null);
  assert.equal(entry.comparisonStatus, '需确认');
  assert.equal(diff.text, '');
});

test('C3-C4-UI-FIX1D Red D9: Unknown CSV ID为要確認且不产生diff', () => {
  const { input, entry } = makeFix1dPrefComparison('北海道 青森県', '01 999');
  const diff = api.buildTverPrefDiffDisplay(entry);
  assert.equal(input.csvCanonical.value, null);
  assert.equal(entry.comparisonStatus, '需确认');
  assert.equal(diff.text, '');
});

test('C3-C4-UI-FIX1D Red D10: 非pref mismatch不产生pref diff', () => {
  const input = c344Input('gender', '性別●', '男性', '2');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.comparisonStatus, '不一致');
  assert.equal(api.buildTverPrefDiffDisplay(entry).text, '');
});

test('C3-C4-UI-FIX1D Red D11: diff display前后comparisonStatus保持不变', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  const before = { comparisonStatus: entry.comparisonStatus, displayStatus: entry.displayStatus };
  assert.equal(api.getTverDisplayReason(entry), 'CSV不足：岩手県');
  assert.deepEqual({ comparisonStatus: entry.comparisonStatus, displayStatus: entry.displayStatus }, before);
});

test('C3-C4-UI-FIX1D Red D12: diff display前后canonicalValue保持不变', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  const before = JSON.stringify(entry.canonicalValues);
  api.buildTverPrefDiffDisplay(entry);
  api.getTverDisplayReason(entry);
  assert.equal(JSON.stringify(entry.canonicalValues), before);
});

function makeFix1ePrefSource(rawValue, rowNumber = 2431) {
  return {
    fileName: '2431_setting.xlsx', sheetName: '設定', rowNumber,
    columnName: '都道府県/市区町村●', rawValue: String(rawValue ?? ''),
  };
}

function makeFix1ePrefSetting(rawValue) {
  return {
    sourceEvidence: {
      targeting: {
        '都道府県/市区町村●': [makeFix1ePrefSource(rawValue)],
      },
    },
  };
}

function makeFix1ePrefCsv(rawValue, schemaKind = 'edit-with-ids') {
  const value = String(rawValue ?? '');
  const source = {
    fileName: '2431_edit.csv', sheetName: null, rowNumber: 2,
    columnName: 'pref', rawValue: value,
  };
  return schemaKind === 'register-without-ids'
    ? { fields: { pref: value }, sourceEvidence: { fields: { pref: [source] } } }
    : { fields: { pref: value }, rawRows: [{ sourceRefs: { pref: source } }] };
}

function makeFix1ePrefInput(settingValue, csvValue = '', schemaKind = 'edit-with-ids') {
  return api.buildTverA17TargetingComparisonInputs(
    makeFix1ePrefSetting(settingValue),
    makeFix1ePrefCsv(csvValue, schemaKind),
    schemaKind,
    { level: 'Ad Group', entityKey: 'fix1e-setting-adg', csvEntityKey: 'fix1e-csv-adg', targetName: 'FIX1E GP' },
  ).find(input => input.field === 'pref');
}

function makeFix1eRealAnnotation() {
  const names = api.getTverIdDictionaries().pref.filter(item => item.name !== '熊本県').map(item => item.name).join(', ');
  return `${names}\r\n※地震により熊本県除外→熊本県除外解除(8/13)`;
}

test('C3-C4-UI-FIX1E-A1 Red: 真实注记保留46个都道府県并可canonicalize', () => {
  const resolved = api.resolveSettingTargetingForComparison(makeFix1ePrefSetting(makeFix1eRealAnnotation()), 'pref');
  assert.equal(resolved.evidenceState, 'available');
  assert.equal(resolved.comparable, true);
  assert.equal(resolved.canonicalValue.split(' ').length, 46);
  assert.equal(resolved.canonicalValue, api.getTverIdDictionaries().pref.filter(item => item.name !== '熊本県').map(item => item.id).sort().join(' '));
});

test('C3-C4-UI-FIX1E-A2 Red: 真实注记加CSV empty为不一致而非需确认', () => {
  const input = makeFix1ePrefInput(makeFix1eRealAnnotation(), '');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.comparisonStatus, '不一致');
  assert.equal(entry.displayStatus, '不一致');
  assert.notEqual(entry.comparisonStatus, '需确认');
});

test('C3-C4-UI-FIX1E-A3 Red: 仅该pref mismatch时entity为不一致而非要确认', () => {
  const input = makeFix1ePrefInput(makeFix1eRealAnnotation(), '');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(api.projectTverEntityDisplayStatus([entry]), '不一致');
});

test('C3-C4-UI-FIX1E-A4 Red: 未完成的除外变更继续ambiguous且显示明确理由', () => {
  const raw = '北海道、青森県、岩手県除外→';
  const resolved = api.resolveSettingTargetingForComparison(makeFix1ePrefSetting(raw), 'pref');
  assert.equal(resolved.evidenceState, 'ambiguous');
  assert.equal(resolved.comparable, false);
  assert.equal(resolved.canonicalValue, null);
  const entry = api.buildComparisonRun({ fields: [makeFix1ePrefInput(raw, '')] }).entries[0];
  assert.equal(entry.comparisonStatus, '需确认');
  assert.equal(api.getTverDisplayReason(entry), '都道府県の除外指定に複数の確認元があるため確認が必要です');
});

test('C3-C4-UI-FIX1E-A5 Red: 未知Setting都道府県不猜ID', () => {
  const resolved = api.resolveSettingTargetingForComparison(makeFix1ePrefSetting('北海道、未知県'), 'pref');
  assert.equal(resolved.evidenceState, 'available');
  assert.equal(resolved.comparable, false);
  assert.equal(resolved.canonicalValue, null);
});

test('C3-C4-UI-FIX1E-A6 Red: 未知CSV ID继续需确认', () => {
  const input = makeFix1ePrefInput('北海道、青森県', '01 999');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(input.csvCanonical.value, null);
  assert.equal(entry.comparisonStatus, '需确认');
});

test('C3-C4-UI-FIX1E-A7 Red: 双方已知且set相同为一致', () => {
  const input = makeFix1ePrefInput('北海道、青森県', '01 02');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '一致');
});

test('C3-C4-UI-FIX1E-A8 Red: 都道府県顺序不同仍为一致', () => {
  const input = makeFix1ePrefInput('北海道、青森県', '02 01');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.comparisonStatus, '表記ゆれ一致');
  assert.equal(api.projectTverDisplayStatus(entry.displayStatus), '一致');
});

test('C3-C4-UI-FIX1E-A9 Red: 双方empty保持neutral', () => {
  const input = makeFix1ePrefInput('', '');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.comparisonStatus, '一致');
  assert.equal(entry.neutral, true);
});

test('C3-C4-UI-FIX1E-A10 Red: 非pref targeting行为保持不变', () => {
  const input = c344Input('gender', '性別●', '男性', '2');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  assert.equal(entry.comparisonStatus, '不一致');
  assert.equal(entry.canonicalValues.setting, '1');
  assert.equal(entry.canonicalValues.csv, '2');
});

function makeFix1eA2Run(entry) {
  const node = makeA183Node({
    nodeKey: 'fix1e-a2-adg-1', level: 'Ad Group', entityKey: entry.entityKey,
    displayLabel: 'FIX1E-A2 GP', entryIndexes: [0],
  });
  return { entries: [entry], displayTree: { roots: [node], unattached: [] } };
}

function makeFix1eA2Html(entry) {
  const view = api.buildTverHorizontalViewModel(makeFix1eA2Run(entry), 'Ad Group');
  return api.buildTverHorizontalTableHtml(view);
}

function getFix1eA2Row(html, variant) {
  const marker = `data-row-variant="${variant}"`;
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `${variant} row should exist`);
  const rowStart = html.lastIndexOf('<tr', start);
  const rowEnd = html.indexOf('</tr>', start);
  assert.ok(rowStart >= 0 && rowEnd >= 0, `${variant} row bounds should exist`);
  return html.slice(rowStart, rowEnd + 5);
}

test('C3-C4-UI-FIX1E-A2 Red A2-1: pref missing diff显示在CSV行horizontal cell', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  const html = makeFix1eA2Html(entry);
  assert.match(getFix1eA2Row(html, 'csv'), /CSV不足：岩手県/);
  assert.doesNotMatch(getFix1eA2Row(html, 'setting'), /CSV不足：|CSV多余：/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-2: pref extra diff显示在CSV行horizontal cell', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '01 02 03');
  assert.match(getFix1eA2Row(makeFix1eA2Html(entry), 'csv'), /CSV多余：岩手県/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-3: pref双方向diff在同一CSV cell显示两条', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02 04');
  const csvRow = getFix1eA2Row(makeFix1eA2Html(entry), 'csv');
  assert.match(csvRow, /CSV不足：岩手県/);
  assert.match(csvRow, /CSV多余：宮城県/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-4: CSV empty时列出全部Setting地域', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '');
  assert.match(getFix1eA2Row(makeFix1eA2Html(entry), 'csv'), /CSV不足：北海道、青森県/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-5: Setting empty时列出全部CSV地域', () => {
  const { entry } = makeFix1dPrefComparison('', '01 02');
  assert.match(getFix1eA2Row(makeFix1eA2Html(entry), 'csv'), /CSV多余：北海道、青森県/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-6: pref一致时horizontal无diff文本', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '01 02');
  const html = makeFix1eA2Html(entry);
  assert.doesNotMatch(html, /CSV不足：|CSV多余：/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-7: pref需确认时horizontal无diff文本', () => {
  const { entry } = makeFix1dPrefComparison('北海道 未知地域', '01 02');
  const html = makeFix1eA2Html(entry);
  assert.equal(entry.comparisonStatus, '需确认');
  assert.doesNotMatch(html, /CSV不足：|CSV多余：/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-8: pref unknown ID时horizontal无diff文本', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県', '01 999');
  const html = makeFix1eA2Html(entry);
  assert.equal(entry.comparisonStatus, '需确认');
  assert.doesNotMatch(html, /CSV不足：|CSV多余：/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-9: 非pref mismatch时horizontal无pref diff文本', () => {
  const input = c344Input('gender', '性別●', '男性', '2');
  const entry = api.buildComparisonRun({ fields: [input] }).entries[0];
  const html = makeFix1eA2Html({ ...entry, level: 'Ad Group', entityKey: 'fix1e-gender-adg' });
  assert.equal(entry.comparisonStatus, '不一致');
  assert.doesNotMatch(html, /CSV不足：|CSV多余：/);
});

test('C3-C4-UI-FIX1E-A2 Red A2-10: main raw/display value与secondary diff分离', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  const before = JSON.stringify({
    settingRawValue: entry.settingRawValue, csvRawValue: entry.csvRawValue,
    canonicalValues: entry.canonicalValues,
  });
  const csvRow = getFix1eA2Row(makeFix1eA2Html(entry), 'csv');
  assert.match(csvRow, /title="01 02">01 02<\/span>/);
  assert.match(csvRow, /class="tver-horizontal-cell-reason" data-cell-reason="pref-diff">CSV不足：岩手県<\/span>/);
  assert.equal(JSON.stringify({
    settingRawValue: entry.settingRawValue, csvRawValue: entry.csvRawValue,
    canonicalValues: entry.canonicalValues,
  }), before);
});

test('C3-C4-UI-FIX1E-A2 Red A2-11: horizontal diff不改变comparisonStatus', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  const before = entry.comparisonStatus;
  makeFix1eA2Html(entry);
  assert.equal(entry.comparisonStatus, before);
});

test('C3-C4-UI-FIX1E-A2 Red A2-12: existing horizontal rows与rowspan结构保持', () => {
  const { entry } = makeFix1dPrefComparison('北海道 青森県 岩手県', '01 02');
  const html = makeFix1eA2Html(entry);
  assert.equal((html.match(/data-row-variant="setting"/g) || []).length, 1);
  assert.equal((html.match(/data-row-variant="csv"/g) || []).length, 1);
  assert.equal((html.match(/class="tver-horizontal-fixed[^>]*rowspan="2"/g) || []).length, 3);
  assert.equal((html.match(/data-column-key="pref"/g) || []).length, 6);
});

test('C3-C4-UI-FIX1E-B1 Red B1-1: adgroup_status 1显示通常', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('adgroup_status', '', '1'), 'csv'), '1（通常）');
});

test('C3-C4-UI-FIX1E-B1 Red B1-2: adgroup_status 0显示初動OFF', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('adgroup_status', '', '0'), 'csv'), '0（初動OFF）');
});

test('C3-C4-UI-FIX1E-B1 Red B1-3: gender 1显示男性', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('gender', '', '1'), 'csv'), '1（男性）');
});

test('C3-C4-UI-FIX1E-B1 Red B1-4: gender 2显示女性', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('gender', '', '2'), 'csv'), '2（女性）');
});

test('C3-C4-UI-FIX1E-B1 Red B1-5: gender 3显示その他', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('gender', '', '3'), 'csv'), '3（その他）');
});

test('C3-C4-UI-FIX1E-B1 Red B1-6: unknown adgroup_status保留raw', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('adgroup_status', '', '9'), 'csv'), '9');
});

test('C3-C4-UI-FIX1E-B1 Red B1-7: unknown gender保留raw', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('gender', '', '9'), 'csv'), '9');
});

test('C3-C4-UI-FIX1E-B1 Red B1-8: Setting display保持业务文字', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('adgroup_status', '通常', '1'), 'setting'), '通常');
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('gender', '男性', '1'), 'setting'), '男性');
});

test('C3-C4-UI-FIX1E-B1 Red B1-9: code label display不改变canonicalValues', () => {
  for (const [field, raw] of [['adgroup_status', '1'], ['gender', '1']]) {
    const entry = fix1bDisplayEntry(field, field === 'gender' ? '男性' : '通常', raw, {
      canonicalValues: { setting: raw, csv: raw },
    });
    const before = JSON.stringify(entry.canonicalValues);
    api.formatTverDisplayValue(entry, 'csv');
    assert.equal(JSON.stringify(entry.canonicalValues), before, field);
  }
});

test('C3-C4-UI-FIX1E-B1 Red B1-10: code label display不改变comparisonStatus', () => {
  for (const [field, raw] of [['adgroup_status', '1'], ['gender', '1']]) {
    const entry = fix1bDisplayEntry(field, field === 'gender' ? '男性' : '通常', raw, {
      comparisonStatus: '表記ゆれ一致', displayStatus: '一致',
      canonicalValues: { setting: raw, csv: raw },
    });
    const before = entry.comparisonStatus;
    assert.equal(api.formatTverDisplayValue(entry, 'csv'), field === 'gender' ? '1（男性）' : '1（通常）');
    assert.equal(entry.comparisonStatus, before, field);
  }
});

test('C3-C4-UI-FIX1E-B2 Red B2-1: auction_type 1显示固定単価', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('auction_type', '', '1'), 'csv'), '1（固定単価）');
});

test('C3-C4-UI-FIX1E-B2 Red B2-2: auction_type 2显示オークション', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('auction_type', '', '2'), 'csv'), '2（オークション）');
});

test('C3-C4-UI-FIX1E-B2 Red B2-3: auction_type未知code保留raw', () => {
  assert.equal(api.formatTverDisplayValue(fix1bDisplayEntry('auction_type', '', '9'), 'csv'), '9');
});

test('C3-C4-UI-FIX1E-B2 Red B2-4: auction_type display不改变raw value', () => {
  const entry = fix1bDisplayEntry('auction_type', '固定単価', '1');
  const before = { settingRawValue: entry.settingRawValue, csvRawValue: entry.csvRawValue };
  api.formatTverDisplayValue(entry, 'csv');
  assert.deepEqual({ settingRawValue: entry.settingRawValue, csvRawValue: entry.csvRawValue }, before);
});

test('C3-C4-UI-FIX1E-B2 Red B2-5: auction_type display不改变canonical', () => {
  const entry = fix1bDisplayEntry('auction_type', '固定単価', '1', {
    canonicalValues: { setting: '1', csv: '1' },
  });
  const before = JSON.stringify(entry.canonicalValues);
  api.formatTverDisplayValue(entry, 'csv');
  assert.equal(JSON.stringify(entry.canonicalValues), before);
});

test('C3-C4-UI-FIX1E-B2 Red B2-6: auction_type display不改变comparisonStatus', () => {
  const entry = fix1bDisplayEntry('auction_type', '固定単価', '1', {
    comparisonStatus: '表記ゆれ一致', displayStatus: '一致',
    canonicalValues: { setting: '1', csv: '1' },
  });
  const before = entry.comparisonStatus;
  api.formatTverDisplayValue(entry, 'csv');
  assert.equal(entry.comparisonStatus, before);
});
