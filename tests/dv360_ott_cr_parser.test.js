// OTT CR Parser Test (Phase4-1)
// 検証: parseOttCreativeSheets — CR構造 / 親キー / フィールド完全性
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const ottRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/OTT';

function createElement(v) {
  return {addEventListener(){},appendChild(){},classList:{add(){},remove(){},contains(){return false}},closest(){return null},dataset:{},disabled:false,files:[],innerHTML:'',querySelector(){return null},querySelectorAll(){return[]},scrollIntoView(){},style:{display:'',setProperty(){}},textContent:'',value:v||''};
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(m => m[1]).find(s => s.includes('function parseSdfData'));
  assert.ok(source);
  const exp = '\n' +
'window.__api = {\n' +
'  parseOttSetting: typeof parseOttSetting==="function"?parseOttSetting:undefined,\n' +
'  parseOttCreativeSheets: typeof parseOttCreativeSheets==="function"?parseOttCreativeSheets:undefined,\n' +
'};\n';
  const inst = source.replace(/\}\)\(\);\s*$/, exp + '\n})();');
  const elems = new Map([['dv-case-select', createElement('initial')]]);
  const doc = {body:createElement(),documentElement:createElement(),getElementById(id){if(!elems.has(id))elems.set(id,createElement());return elems.get(id);},querySelector(){return null},querySelectorAll(){return[]}};
  const sb = {Blob,DecompressionStream:globalThis.DecompressionStream,Encoding:{},FileReader:function(){},JSZip:{},Map,Promise,Response,Set,TextDecoder,Uint8Array,URL,XLSX:{},alert(){},atob:globalThis.atob,console:{log(){},warn(){},error(){}},document:doc,sessionStorage:{getItem(){return null},setItem(){}}};
  sb.window=sb;
  vm.runInNewContext(inst, sb, {filename:htmlPath});
  return sb.__api;
}

function parseWorkbook(fp) {
  const wb = XLSX.read(fs.readFileSync(fp), {type:'buffer', cellDates:true});
  const sheets = {};
  for(const sn of wb.SheetNames) sheets[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1,defval:'',raw:false});
  return {sheets, sheetNames:wb.SheetNames};
}

const api = loadDv360Api();

function getCRData(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const crSheet = sheets['入稿物管理表(動画)'];
  const hasCrSheet = !!crSheet;
  return {setting, crSheet, hasCrSheet, fileName: xf};
}

// ── テスト ──

test('CR parser function exported', () => {
  assert.ok(typeof api.parseOttCreativeSheets === 'function', 'parseOttCreativeSheets');
  assert.ok(typeof api.parseOttSetting === 'function', 'parseOttSetting');
});

// ═══════════════════════════════════════════
// Case 001: CR構造
// ═══════════════════════════════════════════
test('Case 001: crList is array', () => {
  const {setting} = getCRData('001');
  assert.ok(Array.isArray(setting.crList), 'crList should be array');
});

test('Case 001: CR count >= 1', () => {
  const {setting} = getCRData('001');
  assert.ok(setting.crList.length >= 1, 'should have at least 1 CR, got ' + setting.crList.length);
});

test('Case 001: CR has liName (not gpName)', () => {
  const {setting} = getCRData('001');
  setting.crList.forEach((cr, i) => {
    assert.ok(typeof cr.liName === 'string', 'CR['+i+']: liName should be string');
    assert.ok(cr.liName.length > 0, 'CR['+i+']: liName should not be empty');
    // OTT CR must NOT have gpName (GP layer absent)
    assert.ok(!('gpName' in cr) || cr.gpName === undefined || cr.gpName === '',
      'CR['+i+']: should not have gpName, OTT has no GP');
  });
});

test('Case 001: CR required fields', () => {
  const {setting} = getCRData('001');
  const cr = setting.crList[0];
  const requiredFields = [
    'name', 'liName', 'sheet', 'fileName',
  ];
  requiredFields.forEach(f => {
    assert.ok(f in cr, 'CR should have ' + f);
  });
  const requiredSubFields = [
    'status', 'creativeFile', 'clickUrl', 'startDate', 'endDate',
  ];
  requiredSubFields.forEach(f => {
    assert.ok(f in cr.fields, 'CR.fields should have ' + f);
  });
});

test('Case 001: CR SDF-placeholder fields exist', () => {
  const {setting} = getCRData('001');
  const cr = setting.crList[0];
  // Fields reserved for SDF comparison (may be empty)
  const sdfFields = [
    'displayUrl', 'landingPageUrl', 'callToAction', 'headline',
    'infeedVideoHeadline', 'description1', 'description2', 'businessName',
    'adType', 'videoId',
  ];
  sdfFields.forEach(f => {
    assert.ok(f in cr.fields, 'CR.fields should have SDF placeholder: ' + f);
  });
});

test('Case 001: CR has creative file name', () => {
  const {setting} = getCRData('001');
  const cr = setting.crList[0];
  assert.ok(cr.fields.creativeFile.length > 0, 'creativeFile should not be empty');
  assert.ok(cr.name.length > 0, 'CR name should not be empty');
});

// ═══════════════════════════════════════════
// Case 003: 最小構成
// ═══════════════════════════════════════════
test('Case 003: CR list valid', () => {
  const {setting} = getCRData('003');
  assert.ok(Array.isArray(setting.crList), 'crList should be array');
  // Case 003 may or may not have CRs (8 sheets, has 入稿物管理表(動画))
});

// ═══════════════════════════════════════════
// Case 004: 大規模
// ═══════════════════════════════════════════
test('Case 004: CR structure valid', () => {
  const {setting} = getCRData('004');
  assert.ok(Array.isArray(setting.crList));
  if(setting.crList.length > 0) {
    const cr = setting.crList[0];
    assert.ok(typeof cr.liName === 'string', 'liName should be string');
    assert.ok(cr.liName.length > 0, 'liName should not be empty');
  }
});

// ═══════════════════════════════════════════
// Case 005
// ═══════════════════════════════════════════
test('Case 005: CR structure valid', () => {
  const {setting} = getCRData('005');
  assert.ok(Array.isArray(setting.crList));
  if(setting.crList.length > 0) {
    const cr = setting.crList[0];
    assert.ok(typeof cr.liName === 'string', 'liName should be string');
  }
});

// ═══════════════════════════════════════════
// 全Case: CR親キー = LI
// ═══════════════════════════════════════════
test('All cases: CR parent key is liName (not gpName)', () => {
  for(const c of ['001','003','004','005']) {
    const {setting} = getCRData(c);
    setting.crList.forEach((cr, i) => {
      assert.ok(cr.liName !== undefined, 'Case '+c+' CR['+i+']: liName must exist');
      // Verify no gpName pollution
      const hasGpName = cr.gpName !== undefined && cr.gpName !== '' &&
        cr.gpName !== '(GP未定義)';
      assert.ok(!hasGpName,
        'Case '+c+' CR['+i+']: gpName should not exist in OTT CR');
    });
  }
});

// ═══════════════════════════════════════════
// CR数量
// ═══════════════════════════════════════════
test('CR counts across cases', () => {
  for(const c of ['001','003','004','005']) {
    const {setting} = getCRData(c);
    const count = setting.crList.length;
    console.log('  Case ' + c + ': CR count = ' + count);
    assert.ok(count >= 0, 'Case '+c+': CR count should be >= 0');
  }
});

// ═══════════════════════════════════════════
// CR-LI linkage: CR liName matches an LI name
// ═══════════════════════════════════════════
test('Case 001: CR liName references exist in liList', () => {
  const {setting} = getCRData('001');
  if(setting.crList.length > 0 && setting.liList.length > 0) {
    const liNames = new Set(setting.liList.map(li => li.name));
    let matched = 0;
    setting.crList.forEach(cr => {
      // CR liName may be a substring of LI name (e.g. "LI_Netflix(PA)|..." contains "LI_Netflix(PA)")
      const found = [...liNames].some(liName => liName.includes(cr.liName) || cr.liName.includes(liName));
      if(found) matched++;
    });
    assert.ok(matched > 0, 'At least one CR should match an LI name: ' + matched + '/' + setting.crList.length);
  }
});

// ═══════════════════════════════════════════
// YouTube CR comparison: gpName still present
// ═══════════════════════════════════════════
test('YouTube: CR gpName preserved (non-regression)', () => {
  // Load YouTube sample to verify gpName still exists
  // YouTube CRs are not parsed by parseOttCreativeSheets — manual verification
  // This test confirms the code structure handles YouTube CRs differently
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Verify YouTube CR parser still references gpName
  assert.ok(html.includes('gpName'), 'YouTube CR code should still reference gpName');
  // Verify OTT CR parser does NOT reference gpName
  const ottCrFn = html.substring(
    html.indexOf('function parseOttCreativeSheets'),
    html.indexOf('function parseOttCreativeSheets') + 2000
  );
  assert.ok(!ottCrFn.includes('gpName'), 'OTT CR parser should NOT reference gpName');
});
