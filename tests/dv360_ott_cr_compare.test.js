// OTT CR Compare Test (Phase4-2)
// 検証: compareCR_OTT — CR比較 6フィールド / YouTube非回帰
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

function createElement(v){return{addEventListener(){},appendChild(){},classList:{add(){},remove(){},contains(){return false}},closest(){return null},dataset:{},disabled:false,files:[],innerHTML:'',querySelector(){return null},querySelectorAll(){return[]},scrollIntoView(){},style:{display:'',setProperty(){}},textContent:'',value:v||''};}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(m => m[1]).find(s => s.includes('function parseSdfData'));
  assert.ok(source);
  const exp = '\n' +
'window.__api = {\n' +
'  parseOttSetting: typeof parseOttSetting==="function"?parseOttSetting:undefined,\n' +
'  parseSdfData, compareCR,\n' +
'  compareCR_OTT: typeof compareCR_OTT==="function"?compareCR_OTT:undefined,\n' +
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

function parseWorkbook(fp){const wb=XLSX.read(fs.readFileSync(fp),{type:'buffer',cellDates:true});const sheets={};for(const sn of wb.SheetNames)sheets[sn]=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});return{sheets,sheetNames:wb.SheetNames};}

async function parseSdfZip(fp){const buf=fs.readFileSync(fp);const zip=await JSZip.loadAsync(buf);const csvFiles=[];for(const[fn,entry]of Object.entries(zip.files)){if(entry.dir)continue;const blob=await entry.async('blob');const buffer=Buffer.from(await blob.arrayBuffer());let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch(e){try{text=new TextDecoder('shift_jis',{fatal:true}).decode(buffer);}catch(e2){text=new TextDecoder('utf-8').decode(buffer);}}const lines=text.split(/\r?\n/);const rows=[];for(const line of lines){if(!line.trim())continue;const cols=line.split(',').map(c=>c.replace(/^\uFEFF/,'').replace(/^"|"$/g,'').trim());if(cols.some(c=>c))rows.push(cols);}if(rows.length)csvFiles.push({name:fn,rows});}return csvFiles;}

function findItem(items,label){return items.find(i=>i.label===label);}

const api = loadDv360Api();

async function getCRData(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  if(!setting.crList.length || !download.crList.length) return null;
  const items = api.compareCR_OTT(setting.crList[0], download.crList[0]);
  return {items, sCr: setting.crList[0], dCr: download.crList[0]};
}

// ── テスト ──

test('OTT CR compare functions exported', () => {
  assert.ok(typeof api.compareCR === 'function', 'compareCR');
  assert.ok(typeof api.compareCR_OTT === 'function', 'compareCR_OTT');
});

// ═══════════════════════════════════════════
// Case 001: CR items
// ═══════════════════════════════════════════
test('Case 001: CR items exist', async () => {
  const data = await getCRData('001');
  assert.ok(data, 'should get CR data');
  assert.ok(data.items.length >= 5, 'should have 5+ items, got ' + data.items.length);
});

test('Case 001: creative name', async () => {
  const data = await getCRData('001');
  const item = findItem(data.items, 'クリエイティブ名');
  assert.ok(item, 'should have creative name');
  assert.ok(item.sVal || item.dVal, 'should have values');
  assert.ok(['ok','mismatch','warning'].includes(item.result), 'result: '+item.result);
});

test('Case 001: creative file', async () => {
  const data = await getCRData('001');
  const item = findItem(data.items, 'クリエイティブファイル');
  assert.ok(item, 'should have creative file');
  assert.ok(item.sVal.length > 0, 'sVal should be non-empty');
});

test('Case 001: click URL', async () => {
  const data = await getCRData('001');
  const item = findItem(data.items, 'クリック先URL');
  assert.ok(item, 'should have click URL');
  assert.ok(['ok','mismatch','warning'].includes(item.result));
});

test('Case 001: start date', async () => {
  const data = await getCRData('001');
  const item = findItem(data.items, '配信開始日');
  assert.ok(item, 'should have start date');
});

test('Case 001: end date', async () => {
  const data = await getCRData('001');
  const item = findItem(data.items, '配信停止日');
  assert.ok(item, 'should have end date');
});

test('Case 001: status items', async () => {
  const data = await getCRData('001');
  const status = findItem(data.items, 'ステータス');
  assert.ok(status, 'should have case status');
  const raw = data.items.find(i => i.key === 'raw_sdf__status');
  assert.ok(raw, 'should have raw SDF status');
});

// ═══════════════════════════════════════════
// compareCR entry routes to OTT
// ═══════════════════════════════════════════
test('Case 001: compareCR excludes OTT from the production CR route', async () => {
  const dir = path.join(ottRoot, '001');
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  const viaEntry = api.compareCR(setting.crList[0], download.crList[0]);
  assert.equal(viaEntry.length, 0, 'OTT must not enter the production CR comparison route');
});

// ═══════════════════════════════════════════
// Cases 003-005
// ═══════════════════════════════════════════
test('Case 003: CR items', async () => {
  const data = await getCRData('003');
  if(!data){console.log('  [SKIP]');return;}
  assert.ok(data.items.length >= 3, 'items: '+data.items.length);
});

test('Case 004: CR items', async () => {
  const data = await getCRData('004');
  if(!data){console.log('  [SKIP]');return;}
  assert.ok(data.items.length >= 3, 'items: '+data.items.length);
});

test('Case 005: CR items', async () => {
  const data = await getCRData('005');
  if(!data){console.log('  [SKIP]');return;}
  assert.ok(data.items.length >= 3, 'items: '+data.items.length);
});

// ═══════════════════════════════════════════
// All CR items have valid result
// ═══════════════════════════════════════════
test('All cases: CR items have valid result', async () => {
  const valid = ['ok','mismatch','warning','notfound','download-only'];
  for(const c of ['001','003','004','005']) {
    const data = await getCRData(c);
    if(!data) continue;
    data.items.forEach(item => {
      assert.ok(valid.includes(item.result),
        'Case '+c+' '+item.label+': invalid result '+item.result);
    });
  }
});

// ═══════════════════════════════════════════
// YouTube non-regression
// ═══════════════════════════════════════════
test('YouTube: compareCR unchanged', () => {
  api.setMediaType('youtube');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const sCr = { fields: { videoUrl:'', displayUrl:'', landingUrl:'', cta:'',
    headline:'', longHeadline:'', description:'', companionBanner:'' }};
  const dCr = { name:'Test CR', id:'cr1', rawFields:{Status:'Active'}, rawFieldOrder:['Status'],
    statusInfo:{found:true,normalizedValue:'Active'},
    fields:{status:'Active',videoId:'',displayUrl:'',landingPageUrl:'',
      callToAction:'',headline:'',infeedVideoHeadline:'',description1:'',adType:'Responsive'}};

  const items = api.compareCR(sCr, dCr);
  const labels = items.map(i => i.label);
  // YouTube-specific items must remain
  assert.ok(labels.includes('動画ID'), 'YT: Video ID');
  assert.ok(labels.includes('表示URL'), 'YT: Display URL');
  assert.ok(labels.includes('CTA'), 'YT: CTA');
  assert.ok(labels.includes('長い見出し※'), 'YT: Long Headline');
  assert.ok(labels.includes('説明※'), 'YT: Description');
  assert.ok(labels.includes('コンパニオンバナー'), 'YT: Companion Banner');
  assert.ok(labels.includes('広告形式'), 'YT: Ad Type');
  // OTT-only items must NOT appear
  assert.ok(!labels.includes('クリエイティブファイル'), 'YT: no OTT creative file');
});

// ═══════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════
test('OTT: null CR returns empty', () => {
  api.setMediaType('ott');
  assert.equal(api.compareCR_OTT(null, {}).length, 0);
  assert.equal(api.compareCR_OTT({}, null).length, 0);
});
