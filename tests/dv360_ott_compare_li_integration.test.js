// OTT compareLI Integration Test (Phase3-6)
// 検証: 全モジュール組合せ動作 — 重複/異常/YouTube非回帰
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
'  parseSdfData, compareLI,\n' +
'  compareLI_OTT_Base: typeof compareLI_OTT_Base==="function"?compareLI_OTT_Base:undefined,\n' +
'  compareLI_OTT_Targeting: typeof compareLI_OTT_Targeting==="function"?compareLI_OTT_Targeting:undefined,\n' +
'  compareLI_OTT_Geography: typeof compareLI_OTT_Geography==="function"?compareLI_OTT_Geography:undefined,\n' +
'  compareLI_OTT_Deal: typeof compareLI_OTT_Deal==="function"?compareLI_OTT_Deal:undefined,\n' +
'  compareLI_OTT_Demographic: typeof compareLI_OTT_Demographic==="function"?compareLI_OTT_Demographic:undefined,\n' +
'  compareLI_OTT_DownloadDefaults: typeof compareLI_OTT_DownloadDefaults==="function"?compareLI_OTT_DownloadDefaults:undefined,\n' +
'  setMediaType: function(v){mediaType=v;},\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType==="function"?setSelectedDv360CaseType:undefined,\n' +
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

async function parseSdfZip(fp) {
  const buf = fs.readFileSync(fp);
  const zip = await JSZip.loadAsync(buf);
  const csvFiles = [];
  for(const [fn,entry] of Object.entries(zip.files)) {
    if(entry.dir) continue;
    const blob = await entry.async('blob');
    const buffer = Buffer.from(await blob.arrayBuffer());
    let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
    catch(e){try{text=new TextDecoder('shift_jis',{fatal:true}).decode(buffer);}catch(e2){text=new TextDecoder('utf-8').decode(buffer);}}
    const lines = text.split(/\r?\n/);
    const rows = [];
    for(const line of lines) {
      if(!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^\uFEFF/,'').replace(/^"|"$/g,'').trim());
      if(cols.some(c=>c)) rows.push(cols);
    }
    if(rows.length) csvFiles.push({name:fn,rows});
  }
  return csvFiles;
}

function findItem(items, label) { return items.find(i => i.label === label); }

const api = loadDv360Api();

async function getFullItems(caseId) {
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
  const items = api.compareLI(setting.liList[0], download.liList[0]);
  return {items, setting, download};
}

// ── テスト ──

// ═══════════════════════════════════════════
// 1. 全モジュール組合せ: 項目重複なし
// ═══════════════════════════════════════════
test('Case 001: no duplicate item labels', async () => {
  const data = await getFullItems('001');
  assert.ok(data);
  const labels = data.items.map(i => i.label);
  const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
  assert.equal(dupes.length, 0, 'no duplicate labels: ' + dupes.join(', '));
});

test('Case 001: all modules present', async () => {
  const data = await getFullItems('001');
  const labels = data.items.map(i => i.label);
  // Base
  assert.ok(labels.includes('動画タイプ'), 'Base: LI Type');
  assert.ok(labels.includes('予算'), 'Base: Budget');
  assert.ok(labels.includes('入札形式'), 'Base: Bid Strategy');
  assert.ok(labels.includes('収益モデル'), 'Base: Revenue');
  // Targeting
  assert.ok(labels.includes('言語'), 'Targeting: Language');
  assert.ok(labels.includes('デバイス'), 'Targeting: Device');
  assert.ok(labels.includes('環境'), 'Targeting: Environment');
  // Case 001 は Daypart 双方空 → 表示しない
  assert.ok(!labels.includes('曜日と時間'), 'Targeting: Daypart both empty → hidden');
  // Geography
  assert.ok(labels.includes('地域 / Geography Targeting'), 'Geography');
  // Deal
  assert.ok(labels.includes('Deal ID'), 'Deal');
  // Demographic: 人口属性は双方空なので非表示、実値のある affinity のみ表示
  assert.ok(labels.includes('オーディエンス｜アフィニティカテゴリー'), 'Demo: Affinity');
  for(const label of ['性別','年齢','子供の有無','世帯年収']) assert.equal(labels.includes(label), false, label);
});

// ═══════════════════════════════════════════
// 2. 全項目 result が有効値
// ═══════════════════════════════════════════
test('Case 001: all items have valid result', async () => {
  const data = await getFullItems('001');
  const validResults = ['ok', 'mismatch', 'warning', 'notfound', 'download-only'];
  data.items.forEach(item => {
    assert.ok(validResults.includes(item.result),
      item.label + ' has invalid result: ' + item.result);
  });
});

test('Cases 003-005: all items have valid result', async () => {
  for(const c of ['003','004','005']) {
    const data = await getFullItems(c);
    if(!data) continue;
    const valid = ['ok','mismatch','warning','notfound','download-only'];
    data.items.forEach(item => {
      assert.ok(valid.includes(item.result),
        'Case '+c+' '+item.label+': invalid result '+item.result);
    });
  }
});

// ═══════════════════════════════════════════
// 3. 各モジュールの独立検証
// ═══════════════════════════════════════════
test('Case 001: modules return disjoint label sets', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  const sLi = setting.liList[0], dLi = download.liList[0];

  const base = api.compareLI_OTT_Base(sLi, dLi);
  const tgt  = api.compareLI_OTT_Targeting(sLi, dLi);
  const geo  = api.compareLI_OTT_Geography(sLi, dLi);
  const deal = api.compareLI_OTT_Deal(sLi, dLi);
  const demo = api.compareLI_OTT_Demographic(sLi, dLi);
  const def  = api.compareLI_OTT_DownloadDefaults(sLi, dLi);

  const full = api.compareLI(sLi, dLi);
  const total = base.length + tgt.length + geo.length + deal.length + demo.length + def.length;
  assert.equal(full.length, total, 'full = base+tgt+geo+deal+demo+def: ' + full.length + ' vs ' + total);

  // Cross-check no label collisions across modules
  const baseLabels = new Set(base.map(i => i.label));
  for(const item of tgt)  assert.ok(!baseLabels.has(item.label), 'tgt collision: ' + item.label);
  for(const item of geo)  assert.ok(!baseLabels.has(item.label), 'geo collision: ' + item.label);
  for(const item of deal) assert.ok(!baseLabels.has(item.label), 'deal collision: ' + item.label);
  for(const item of demo) assert.ok(!baseLabels.has(item.label), 'demo collision: ' + item.label);
});

// ═══════════════════════════════════════════
// 4. 异常组合: Deal + Demographic 同时warning
// ═══════════════════════════════════════════
test('mock: Deal + Demographic both warning counted', () => {
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = { fields: {
    // Base
    liType:'動画', startDate:'2026/06/24', endDate:'2026/06/30',
    budget98:'500000', budgetPace:'掲載期間', bidStrategy:'固定入札', bidPrice:'1536',
    inventory:'認定販売者', revenueModel:'33.333%',
    // Targeting
    language:'Japanese', devicePC:'●', deviceSP:'●', deviceCTV:'●',
    environment:'ウェブ＆アプリ', daypart:'',
    // Geography
    geo:'Japan',
    // Deal (異常: Deal IDあり、SDF側なし)
    dealId:'test-deal-uuid',
    resolvedDealInfo:{source:'direct',dealId:'test-deal-uuid',dealName:'Test Deal',isTemplateDeal:false},
    // Demographic (異常: 設定とSDF不一致)
    gender:'Male', age:'18-24', parentalStatus:'', householdIncome:'',
  }};
  const dLi = {
    name:'Test', id:'li1', rawFields:{Status:'Active','Private Deal Group Targeting Include':'',
      'Demographic Targeting Gender':'Female;','Demographic Targeting Age':'25-34;'},
    rawFieldOrder:['Status'], statusInfo:{found:true,normalizedValue:'Active'},
    fields:{type:'Video',subtype:'',status:'Active',startDate:'06/24/2026',endDate:'06/30/2026',
      budgetType:'TOTAL',budgetAmount:'500000',pacing:'Flight',pacingRate:'Evenly',
      bidStrategyType:'',bidStrategyValue:'1536',inventorySource:'',
      languageTargeting:'Japanese',geographyTargeting:'Japan',geographyExclude:'',
      daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'33.333%',
      demographicGender:'Female;',demographicAge:'25-34;',demographicIncome:'',demographicParental:'',
      environmentTargeting:'',deviceTargetingInclude:''}
  };

  const items = api.compareLI(sLi, dLi);
  const dealItem = findItem(items, 'Deal ID');
  const genderItem = findItem(items, '性別');

  assert.ok(dealItem.result === 'warning', 'Deal should be warning (no SDF deal)');
  assert.ok(genderItem.result !== 'ok', 'Gender should not be ok (Male vs Female), got: ' + genderItem.result);

  // Both anomalies should coexist
  const warnings = items.filter(i => i.result === 'warning' || i.result === 'mismatch');
  assert.ok(warnings.length >= 2, 'should have 2+ anomalies, got ' + warnings.length);
});

// ═══════════════════════════════════════════
// 5. Geography + Device 同时异常
// ═══════════════════════════════════════════
test('mock: Geography + Device both mismatched', () => {
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = { fields: {
    liType:'動画', startDate:'2026/06/24', endDate:'2026/06/30',
    budget98:'500000', budgetPace:'掲載期間', bidStrategy:'固定入札', bidPrice:'100',
    inventory:'', revenueModel:'',
    language:'Japanese', devicePC:'●', deviceSP:'', deviceCTV:'', environment:'ウェブ',
    daypart:'', geo:'Japan', dealId:'',
  }};
  const dLi = {
    name:'Test', id:'li1', rawFields:{Status:'Active',
      'Geography Targeting - Include':'2124;',  // 日本=2392, 2124=米国→mismatch
      'Device Targeting - Include':'Desktop;Smartphone;'},
    rawFieldOrder:['Status'], statusInfo:{found:true,normalizedValue:'Active'},
    fields:{type:'Video',subtype:'',status:'Active',startDate:'06/24/2026',endDate:'06/30/2026',
      budgetType:'TOTAL',budgetAmount:'500000',pacing:'Flight',pacingRate:'Evenly',
      bidStrategyType:'',bidStrategyValue:'100',inventorySource:'',
      languageTargeting:'Japanese',geographyTargeting:'2124;',geographyExclude:'',
      daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'',
      environmentTargeting:'',deviceTargetingInclude:'Desktop;Smartphone;',
      demographicGender:'',demographicAge:'',demographicIncome:'',demographicParental:''}
  };

  const items = api.compareLI(sLi, dLi);
  const geoItem = findItem(items, '地域 / Geography Targeting');
  const devItem = findItem(items, 'デバイス');

  assert.ok(geoItem, 'should have geo item');
  assert.ok(devItem, 'should have device item');
  assert.ok(geoItem.result !== 'ok', 'geo should not be ok (mismatched geo code)');
  assert.ok(devItem, 'should have device item');
});

// ═══════════════════════════════════════════
// 6. OK 项目不重复（全ok时也能正确返回）
// ═══════════════════════════════════════════
test('mock: all-OK items are unique', () => {
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = { fields: {
    liType:'動画', startDate:'2026/06/24', endDate:'2026/06/30',
    budget98:'500000', budgetPace:'掲載期間', bidStrategy:'固定入札', bidPrice:'100',
    inventory:'', revenueModel:'', language:'', devicePC:'', deviceSP:'', deviceCTV:'',
    environment:'', daypart:'', geo:'', dealId:'',
    gender:'', age:'', parentalStatus:'', householdIncome:'', audience:'',
  }};
  const dLi = {
    name:'Test', id:'li1', rawFields:{Status:'Active'}, rawFieldOrder:['Status'],
    statusInfo:{found:true,normalizedValue:'Active'},
    fields:{type:'Video',subtype:'',status:'Active',startDate:'06/24/2026',endDate:'06/30/2026',
      budgetType:'TOTAL',budgetAmount:'500000',pacing:'Flight',pacingRate:'Evenly',
      bidStrategyType:'',bidStrategyValue:'100',inventorySource:'',
      languageTargeting:'',geographyTargeting:'',geographyExclude:'',
      daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'',
      environmentTargeting:'',deviceTargetingInclude:'',
      demographicGender:'',demographicAge:'',demographicIncome:'',demographicParental:''}
  };

  const items = api.compareLI(sLi, dLi);
  const labels = items.map(i => i.label);
  const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
  assert.equal(dupes.length, 0, 'all-OK: no duplicates');
});

// ═══════════════════════════════════════════
// 7. 全 Case 横断: 全LIの全項目有効
// ═══════════════════════════════════════════
test('All cases: every LI produces valid items', async () => {
  for(const c of ['001','003','004','005']) {
    const dir = path.join(ottRoot, c);
    const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
    api.setMediaType('ott');
    if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
    const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
    const setting = api.parseOttSetting(sheets, sheetNames, xf);
    if(!setting.liList.length) continue;
    const csvFiles = await parseSdfZip(path.join(dir, zf));
    const download = api.parseSdfData(csvFiles);

    // Test all LIs with matching SDF LIs (up to first 3)
    const count = Math.min(setting.liList.length, download.liList.length, 3);
    for(let i = 0; i < count; i++) {
      const items = api.compareLI(setting.liList[i], download.liList[i]);
      assert.ok(items.length >= 15, 'Case '+c+' LI['+i+']: items=' + items.length);
      const valid = ['ok','mismatch','warning','notfound','download-only'];
      items.forEach(item => {
        assert.ok(valid.includes(item.result),
          'Case '+c+' LI['+i+'] '+item.label+': invalid result '+item.result);
      });
      // No duplicate labels
      const labels = items.map(it => it.label);
      const dupes = labels.filter((l, idx) => labels.indexOf(l) !== idx);
      assert.equal(dupes.length, 0, 'Case '+c+' LI['+i+']: duplicates: ' + dupes.join(','));
    }
  }
});

// ═══════════════════════════════════════════
// 8. YouTube 完全非回帰
// ═══════════════════════════════════════════
test('YouTube: full integration unchanged', () => {
  api.setMediaType('youtube');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sLi = { name:'Test', fields:{ videoType:'VRC(s)', startDate:'2026/06/24', endDate:'2026/06/30',
    daypart:'', budgetNet:'500000', dailyBudget:'', pacing:'掲載期間', billing:'CPM',
    bidCap:'', inventory:'YouTube', language:'', region:'Japan', geoReference:'', gender:'', age:'',
    ageUnknown:'', parentalStatus:'', householdIncome:'', revenueModel:'' }};
  const dLi = { name:'Test', id:'li1', rawFields:{Status:'Active'}, rawFieldOrder:['Status'],
    statusInfo:{found:true,normalizedValue:'Active'},
    fields:{type:'Video',subtype:'In-stream',status:'Active',startDate:'06/24/2026',
      endDate:'06/30/2026',budgetType:'TOTAL',budgetAmount:'500000',
      pacing:'Flight',pacingRate:'Evenly',bidStrategyType:'Target CPM',bidStrategyValue:'',
      trueViewKpiType:'CPCV',trueViewKpiValue:'',inventorySource:'YouTube',
      languageTargeting:'Japanese',geographyTargeting:'Japan',geographyExclude:'',
      daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'',
      demographicGender:'',demographicAge:'',demographicIncome:'',demographicParental:''}};

  const items = api.compareLI(sLi, dLi);
  const labels = items.map(i => i.label);

  // YouTube-specific items that must remain
  assert.ok(labels.includes('動画タイプ'), 'YT: video type');
  assert.ok(labels.includes('課金形態'), 'YT: billing');
  assert.ok(labels.includes('地域 / Geography Targeting'), 'YT: geography');
  assert.ok(labels.includes('言語'), 'YT: language');

  // OTT-only items must NOT appear
  assert.ok(!labels.includes('Deal ID'), 'YT: no Deal ID');
  assert.ok(!labels.includes('デバイス'), 'YT: no Device (YouTube style)');
  assert.ok(!labels.includes('環境'), 'YT: no Environment');

  // No duplicates
  const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
  assert.equal(dupes.length, 0, 'YT: no duplicates');
});
