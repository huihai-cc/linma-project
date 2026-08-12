// OTT compareLI Demographic Test (Phase3-5)
// 検証: compareLI_OTT_Demographic — Gender/Age/Parental/Income/Audience
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

function createElement(v) {
  return {
    addEventListener(){}, appendChild(){},
    classList:{add(){},remove(){},contains(){return false}},
    closest(){return null}, dataset:{}, disabled:false, files:[], innerHTML:'',
    querySelector(){return null}, querySelectorAll(){return[]}, scrollIntoView(){},
    style:{display:'',setProperty(){}}, textContent:'', value:v||'',
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(m => m[1]).find(s => s.includes('function parseSdfData'));
  assert.ok(source);
  const exp = '\n' +
'window.__api = {\n' +
'  parseOttSetting: typeof parseOttSetting==="function"?parseOttSetting:undefined,\n' +
'  parseSdfData, compareLI,\n' +
'  compareLI_OTT_Demographic: typeof compareLI_OTT_Demographic==="function"?compareLI_OTT_Demographic:undefined,\n' +
'  compareDemographicTargeting: typeof compareDemographicTargeting==="function"?compareDemographicTargeting:undefined,\n' +
'  compareAgeDemographicTargeting: typeof compareAgeDemographicTargeting==="function"?compareAgeDemographicTargeting:undefined,\n' +
'  filterVisibleComparisonItems: typeof filterVisibleComparisonItems==="function"?filterVisibleComparisonItems:undefined,\n' +
'  isOttUnsetSettingValue: typeof isOttUnsetSettingValue==="function"?isOttUnsetSettingValue:undefined,\n' +
'  compareOttBidTargetMode: typeof compareOttBidTargetMode==="function"?compareOttBidTargetMode:undefined,\n' +
'  setMediaType: function(v){mediaType=v;},\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType==="function"?setSelectedDv360CaseType:undefined,\n' +
'};\n';
  const inst = source.replace(/\}\)\(\);\s*$/, exp + '\n})();');
  const elems = new Map([['dv-case-select', createElement('initial')]]);
  const doc = {
    body:createElement(), documentElement:createElement(),
    getElementById(id){if(!elems.has(id))elems.set(id,createElement());return elems.get(id);},
    querySelector(){return null}, querySelectorAll(){return[]},
  };
  const sb = {
    Blob, DecompressionStream:globalThis.DecompressionStream, Encoding:{},
    FileReader:function(){}, JSZip:{}, Map,Promise,Response,Set,TextDecoder,Uint8Array,URL,XLSX:{},
    alert(){}, atob:globalThis.atob, console:{log(){},warn(){},error(){}},
    document:doc, sessionStorage:{getItem(){return null},setItem(){}},
  };
  sb.window = sb;
  vm.runInNewContext(inst, sb, {filename:htmlPath});
  return sb.__api;
}

function parseWorkbook(fp) {
  const wb = XLSX.read(fs.readFileSync(fp), {type:'buffer', cellDates:true});
  const sheets = {};
  for(const sn of wb.SheetNames) sheets[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:'', raw:false});
  return {sheets, sheetNames:wb.SheetNames};
}

async function parseSdfZip(fp) {
  const buf = fs.readFileSync(fp);
  const zip = await JSZip.loadAsync(buf);
  const csvFiles = [];
  for(const [fn, entry] of Object.entries(zip.files)) {
    if(entry.dir) continue;
    const blob = await entry.async('blob');
    const buffer = Buffer.from(await blob.arrayBuffer());
    let text;
    try { text = new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
    catch(e){ try{text=new TextDecoder('shift_jis',{fatal:true}).decode(buffer);}catch(e2){text=new TextDecoder('utf-8').decode(buffer);} }
    const lines = text.split(/\r?\n/);
    const rows = [];
    for(const line of lines) {
      if(!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^\uFEFF/,'').replace(/^"|"$/g,'').trim());
      if(cols.some(c=>c)) rows.push(cols);
    }
    if(rows.length) csvFiles.push({name:fn, rows});
  }
  return csvFiles;
}

function findItem(items, label) { return items.find(i => i.label === label); }

const api = loadDv360Api();

async function getDemoItems(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  if(!setting.liList.length || !download.liList.length) return null;
  const items = api.compareLI_OTT_Demographic(setting.liList[0], download.liList[0]);
  return {items, sLi:setting.liList[0], dLi:download.liList[0]};
}

// ── テスト ──

test('OTT demographic function exported', () => {
  assert.ok(typeof api.compareLI_OTT_Demographic === 'function');
});

// ═══════════════════════════════════════════
// Case 001: All demographic items
// ═══════════════════════════════════════════
test('Case 001: gender 双方未指定は生成しない', async () => {
  const data = await getDemoItems('001');
  assert.ok(data);
  const item = findItem(data.items, '性別');
  assert.equal(item, undefined);
});

test('Case 001: age 双方未指定は生成しない', async () => {
  const data = await getDemoItems('001');
  const item = findItem(data.items, '年齢');
  assert.equal(item, undefined);
});

test('Case 001: parental status 双方未指定は生成しない', async () => {
  const data = await getDemoItems('001');
  const item = findItem(data.items, '子供の有無');
  assert.equal(item, undefined);
});

test('Case 001: household income 双方未指定は生成しない', async () => {
  const data = await getDemoItems('001');
  const item = findItem(data.items, '世帯年収');
  assert.equal(item, undefined);
});

test('Case 001: audience 4 items', async () => {
  const data = await getDemoItems('001');
  const item = findItem(data.items, 'オーディエンス｜アフィニティカテゴリー');
  assert.ok(item, 'affinity audience item');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
  assert.equal(findItem(data.items, 'オーディエンス｜自社と第三者'), undefined, '双方未指定は生成しない');
  assert.equal(findItem(data.items, 'オーディエンス｜カスタムリスト'), undefined, '双方未指定は生成しない');
  assert.equal(findItem(data.items, 'オーディエンス｜統合'), undefined, '双方未指定は生成しない');
});

test('Case 001: demographic 双方空时仅保留实际 affinity', async () => {
  const data = await getDemoItems('001');
  assert.deepEqual(Array.from(data.items, item => item.label), ['オーディエンス｜アフィニティカテゴリー']);
});

// ═══════════════════════════════════════════
// Case 001: compareLI includes demographic
// ═══════════════════════════════════════════
test('Case 001: compareLI 不包含双方未指定的人口属性', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  const items = api.compareLI(setting.liList[0], download.liList[0]);
  const labels = items.map(i => i.label);
  assert.equal(labels.includes('性別'), false);
  assert.equal(labels.includes('年齢'), false);
  assert.equal(labels.includes('子供の有無'), false);
  assert.equal(labels.includes('世帯年収'), false);
});

// ═══════════════════════════════════════════
// Cases 003-005
// ═══════════════════════════════════════════
test('Case 003: 双方未指定 demographic 不生成', async () => {
  const data = await getDemoItems('003');
  if(!data) { console.log('  [SKIP]'); return; }
  assert.equal(data.items.length, 0, 'items: ' + data.items.length);
});

test('Case 004: 双方未指定 demographic 不生成', async () => {
  const data = await getDemoItems('004');
  if(!data) { console.log('  [SKIP]'); return; }
  assert.equal(data.items.length, 0, 'items: ' + data.items.length);
});

test('Case 005: 双方未指定 demographic 不生成', async () => {
  const data = await getDemoItems('005');
  if(!data) { console.log('  [SKIP]'); return; }
  assert.equal(data.items.length, 0, 'items: ' + data.items.length);
});

// ═══════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════
test('OTT: null inputs for demo', () => {
  api.setMediaType('ott');
  assert.equal(api.compareLI_OTT_Demographic(null, {}).length, 0);
  assert.equal(api.compareLI_OTT_Demographic({}, null).length, 0);
});

test('OTT: empty values produce valid results', () => {
  api.setMediaType('ott');
  const sLi = { fields: { gender:'', age:'', parentalStatus:'', householdIncome:'' }};
  const dLi = { fields: {}, rawFields: {} };
  const items = api.compareLI_OTT_Demographic(sLi, dLi);
  assert.deepEqual(Array.from(items), [], '双方未指定の demographic / audience は item 自体を生成しない');
});

test('OTT unset-equivalent: ▼選択系と空値は Download 空なら表示しない', () => {
  api.setMediaType('ott');
  assert.equal(typeof api.isOttUnsetSettingValue, 'function');
  for (const value of ['', ' ', '▼選択', '▼ 選択', '▼選択（ALLとして解釈）',
    '▼選択(ALLとして解釈)', '(設定なし)', '(空欄)', '—', '-']) {
    assert.equal(api.isOttUnsetSettingValue(value), true, JSON.stringify(value));
    const visible = api.filterVisibleComparisonItems([{label:'x',sVal:value,dVal:'',result:'ok'}]);
    assert.equal(visible.length, 0, JSON.stringify(value));
  }
});

test('OTT unset-equivalent: Setting未指定でも Download実値は warning として表示する', () => {
  api.setMediaType('ott');
  const items = api.compareLI_OTT_Demographic(
    {fields:{gender:'▼選択',age:'',ageUnknown:'',parentalStatus:'',householdIncome:''}},
    {fields:{demographicGender:'Male;'},rawFields:{}},
  );
  const visible = api.filterVisibleComparisonItems(items);
  const gender = findItem(visible, '性別');
  assert.ok(gender);
  assert.equal(gender.result, 'warning');
});

test('OTT unset-equivalent: 三つの LI が双方未指定なら demographic / audience 列候補が残らない', () => {
  api.setMediaType('ott');
  const present = new Set();
  for (let i=0;i<3;i++) {
    const items = api.compareLI_OTT_Demographic(
      {fields:{gender:'▼選択',age:'',ageUnknown:'',parentalStatus:'▼選択（ALLとして解釈）',householdIncome:'▼選択',
        audienceFirstPartyPartner:'',audienceGoogle:'',audienceCustomList:'',audienceCombined:''}},
      {fields:{},rawFields:{}},
    );
    api.filterVisibleComparisonItems(items).forEach(item => present.add(item.label));
  }
  for (const label of ['性別','子供の有無','世帯年収','オーディエンス｜自社と第三者',
    'オーディエンス｜アフィニティカテゴリー','オーディエンス｜カスタムリスト','オーディエンス｜統合']) {
    assert.equal(present.has(label), false, label);
  }
});

test('OTT 目標単価: 未指定は非表示、明確値だけ SDF対応なし warning を保持する', () => {
  api.setMediaType('ott');
  for (const value of ['', '▼選択', '▼選択（ALLとして解釈）']) {
    const item = {label:'目標単価の有無', ...api.compareOttBidTargetMode({bidTarget:value},{})};
    assert.equal(item.result, 'ok', JSON.stringify(value));
    assert.equal(api.filterVisibleComparisonItems([item]).length, 0, JSON.stringify(value));
    assert.doesNotMatch(item.mpDetail||'', /SDFに.*対応/);
  }
  const explicit = {label:'目標単価の有無', ...api.compareOttBidTargetMode({bidTarget:'あり'},{})};
  assert.equal(explicit.result, 'warning');
  assert.equal(api.filterVisibleComparisonItems([explicit]).length, 1);
  assert.match(explicit.mpDetail, /SDFに.*独立フィールド/);
});

test('YouTube: ▼選択 の表示空値規則は変更しない', () => {
  api.setMediaType('youtube');
  const visible = api.filterVisibleComparisonItems([{label:'x',sVal:'▼選択',dVal:'',result:'warning'}]);
  assert.equal(visible.length, 1);
});

// ═══════════════════════════════════════════
// YouTube non-regression
// ═══════════════════════════════════════════
test('YouTube: demo still at LI+GP levels', () => {
  api.setMediaType('youtube');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const sLi = { name:'Test', fields:{ videoType:'VRC(s)', startDate:'2026/06/24', endDate:'2026/06/30',
    daypart:'', budgetNet:'500000', dailyBudget:'', pacing:'掲載期間', billing:'CPM',
    bidCap:'', inventory:'YouTube', language:'', region:'', gender:'Male/Female', age:'18-24/25-34',
    ageUnknown:'', parentalStatus:'', householdIncome:'', revenueModel:'' }};
  const dLi = { name:'Test', id:'li1', rawFields:{Status:'Active'}, rawFieldOrder:['Status'],
    statusInfo:{found:true,normalizedValue:'Active'},
    fields:{type:'Video',subtype:'In-stream',status:'Active',startDate:'06/24/2026',
      endDate:'06/30/2026',budgetType:'TOTAL',budgetAmount:'500000',
      pacing:'Flight',pacingRate:'Evenly',bidStrategyType:'Target CPM',bidStrategyValue:'',
      trueViewKpiType:'CPCV',trueViewKpiValue:'',inventorySource:'YouTube',
      languageTargeting:'Japanese',geographyTargeting:'Japan',geographyExclude:'',
      daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'',
      demographicGender:'Male; Female;',demographicAge:'18-24; 25-34;',
      demographicIncome:'',demographicParental:''}};
  const items = api.compareLI(sLi, dLi);
  const labels = items.map(i => i.label);
  assert.ok(labels.includes('性別'), 'YouTube LI should have gender');
  assert.ok(labels.includes('年齢'), 'YouTube LI should have age');
});
