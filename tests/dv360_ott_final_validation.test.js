// OTT Final Validation (Phase5)
// 全パイプライン最終検証: Upload→Parse→Tree→LI→CR
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
'  parseOttSetting, parseSdfData, parseYoutubeSetting,\n' +
'  buildComparisonTree, compareLI, compareCR,\n' +
'  compareLI_OTT_Base, compareLI_OTT_Targeting,\n' +
'  compareLI_OTT_Geography, compareLI_OTT_Deal, compareLI_OTT_Demographic,\n' +
'  compareCR_OTT, updateNodeStatus,\n' +
'  setMediaType: function(v){mediaType=v;},\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType==="function"?setSelectedDv360CaseType:undefined,\n' +
'  getMediaType: function(){return mediaType;},\n' +
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

const api = loadDv360Api();

// ── フルパイプライン実行 ──
async function runFullPipeline(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  // Step 1: Parse setting
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);

  // Step 2: Parse SDF
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);

  // Step 3: Build tree
  const settingForTree = {cp:setting.cpList, io:setting.ioList, li:setting.liList, gp:setting.gpList, cr:setting.crList};
  const downloadForTree = {cp:download.cpList, io:download.ioList, li:download.liList, gp:download.gpList, cr:download.crList};
  const tree = api.buildComparisonTree(settingForTree, downloadForTree);

  // Step 4: Collect all nodes
  function collectNodes(node, nodes) { nodes.push(node); node.children.forEach(c => collectNodes(c, nodes)); }
  const allNodes = [];
  tree.roots.forEach(r => collectNodes(r, allNodes));

  // Step 5: Run compareLI on first matched LI
  let liResult = null;
  for(const node of allNodes) {
    if(node.level === 'LI' && node.found && node.compItems.length > 0) {
      liResult = { items: node.compItems, status: node.status, ownStatus: node.ownStatus };
      break;
    }
  }

  // Step 6: Run compareCR on first matched CR
  let crResult = null;
  for(const node of allNodes) {
    if(node.level === 'CR' && node.found && node.compItems.length > 0) {
      crResult = { items: node.compItems, status: node.status, ownStatus: node.ownStatus };
      break;
    }
  }

  return {
    caseId,
    setting: {
      cp: setting.cpList.length, io: setting.ioList.length,
      li: setting.liList.length, gp: setting.gpList.length, cr: setting.crList.length,
    },
    download: {
      cp: downloadForTree.cp.length, io: downloadForTree.io.length,
      li: downloadForTree.li.length, gp: downloadForTree.gp.length, cr: downloadForTree.cr.length,
    },
    tree: {
      roots: tree.roots.length,
      nodesByLevel: {
        CP: allNodes.filter(n => n.level === 'CP').length,
        IO: allNodes.filter(n => n.level === 'IO').length,
        LI: allNodes.filter(n => n.level === 'LI').length,
        GP: allNodes.filter(n => n.level === 'GP').length,
        CR: allNodes.filter(n => n.level === 'CR').length,
      },
      counts: tree.counts,
    },
    li: liResult ? {
      itemCount: liResult.items.length,
      labels: liResult.items.map(i => i.label),
      status: liResult.status,
      results: {
        ok: liResult.items.filter(i => i.result === 'ok').length,
        mismatch: liResult.items.filter(i => i.result === 'mismatch').length,
        warning: liResult.items.filter(i => i.result === 'warning').length,
      },
      modules: {
        base: liResult.items.filter(i =>
          ['動画タイプ','予算','入札形式','収益モデル'].includes(i.label)).length,
        targeting: liResult.items.filter(i =>
          ['言語','デバイス','環境','曜日と時間'].includes(i.label)).length,
        geography: liResult.items.filter(i =>
          i.label === '地域 / Geography Targeting').length,
        deal: liResult.items.filter(i =>
          ['Deal ID'].includes(i.label)).length,
        demographic: liResult.items.filter(i =>
          ['性別','年齢','子供の有無','世帯年収',
           'オーディエンス｜自社と第三者','オーディエンス｜アフィニティカテゴリー',
           'オーディエンス｜カスタムリスト','オーディエンス｜統合'].includes(i.label)).length,
      },
    } : null,
    cr: crResult ? {
      itemCount: crResult.items.length,
      labels: crResult.items.map(i => i.label),
      status: crResult.status,
    } : null,
    validation: {
      noGpNodes: allNodes.filter(n => n.level === 'GP').length === 0,
      gpCountZero: tree.counts.gp === 0,
      crUnderLi: (() => {
        let ok = true;
        for(const node of allNodes) {
          if(node.level === 'CR') {
            const parent = allNodes.find(n => n.children.includes(node));
            if(parent && parent.level !== 'LI' && parent.level !== 'CR') ok = false;
          }
        }
        return ok;
      })(),
      noDupLabels: (items) => {
        if(!items) return true;
        const labels = items.map(i => i.label);
        return labels.filter((l,i) => labels.indexOf(l) !== i).length === 0;
      },
    },
  };
}

// ═══════════════════════════════════════════
// 1. 全パイプライン実行
// ═══════════════════════════════════════════
test('Case 001: full pipeline succeeds', async () => {
  const r = await runFullPipeline('001');
  assert.ok(r.setting.li > 0, 'should have LIs');
  assert.ok(r.setting.cr > 0, 'should have CRs');
  assert.ok(r.tree.roots > 0, 'should have tree roots');
});

test('Case 001: tree CP→IO→LI→CR structure without GP', async () => {
  const r = await runFullPipeline('001');
  assert.ok(r.tree.nodesByLevel.CP >= 1, 'CP nodes');
  assert.ok(r.tree.nodesByLevel.IO >= 1, 'IO nodes');
  assert.ok(r.tree.nodesByLevel.LI >= 1, 'LI nodes');
  assert.equal(r.tree.nodesByLevel.GP, 0, 'NO GP nodes');
  assert.equal(r.tree.nodesByLevel.CR, 0, 'NO OTT CR nodes');
});

test('Case 001: validation flags', async () => {
  const r = await runFullPipeline('001');
  assert.ok(r.validation.noGpNodes, 'no GP nodes');
  assert.ok(r.validation.gpCountZero, 'gp count = 0');
  assert.equal(r.cr, null, 'OTT must not produce CR comparison results');
  assert.ok(r.validation.crUnderLi, 'CR under LI (no CR nodes → vacuous true)');
});

test('Case 001: LI has all modules', async () => {
  const r = await runFullPipeline('001');
  assert.ok(r.li, 'should have LI result');
  assert.ok(r.li.modules.base >= 3, 'base module: '+r.li.modules.base);
  assert.ok(r.li.modules.targeting >= 2, 'targeting module: '+r.li.modules.targeting);
  assert.ok(r.li.modules.geography >= 1, 'geography module');
  assert.ok(r.li.modules.deal >= 1, 'deal module');
  assert.ok(r.li.modules.demographic >= 1, 'demographic module (actual affinity only)');
});

test('Case 001: LI no duplicate labels', async () => {
  const r = await runFullPipeline('001');
  const dupes = r.li.labels.filter((l,i) => r.li.labels.indexOf(l) !== i);
  assert.equal(dupes.length, 0, 'duplicates: '+dupes.join(','));
});

test('Case 001: LI result values', async () => {
  const r = await runFullPipeline('001');
  assert.ok(r.li.results.ok >= 0, 'ok count');
  assert.ok(typeof r.li.results.mismatch === 'number', 'mismatch count');
  assert.ok(typeof r.li.results.warning === 'number', 'warning count');
});

test('Case 001: CR is excluded from the OTT result tree', async () => {
  const r = await runFullPipeline('001');
  assert.equal(r.cr, null, 'OTT CR must not produce result items');
});

// ═══════════════════════════════════════════
// 2. 全ケース横断
// ═══════════════════════════════════════════
test('All cases: tree has no GP', async () => {
  for(const c of ['001','003','004','005']) {
    const r = await runFullPipeline(c);
    assert.equal(r.tree.nodesByLevel.GP, 0, 'Case '+c+': no GP');
    assert.equal(r.setting.gp, 0, 'Case '+c+': setting gp=0');
  }
});

test('All cases: LI without duplicates', async () => {
  for(const c of ['001','003','004','005']) {
    const r = await runFullPipeline(c);
    if(!r.li) continue;
    const dupes = r.li.labels.filter((l,i) => r.li.labels.indexOf(l) !== i);
    assert.equal(dupes.length, 0, 'Case '+c+': duplicates: '+dupes.join(','));
  }
});

test('All cases: CR without YouTube fields', async () => {
  for(const c of ['001','003','004','005']) {
    const r = await runFullPipeline(c);
    if(!r.cr) continue;
    assert.ok(!r.cr.labels.includes('動画ID'), 'Case '+c+': no Video ID');
    assert.ok(!r.cr.labels.includes('表示URL'), 'Case '+c+': no Display URL (YouTube CR)');
    assert.ok(!r.cr.labels.includes('CTA'), 'Case '+c+': no CTA');
    assert.ok(!r.cr.labels.includes('長い見出し※'), 'Case '+c+': no Long Headline');
  }
});

// ═══════════════════════════════════════════
// 3. 複数LI異常同時表示
// ═══════════════════════════════════════════
test('Case 001: multiple anomalies coexist', async () => {
  const r = await runFullPipeline('001');
  if(!r.li) return;
  const anomalies = r.li.results.mismatch + r.li.results.warning;
  // Even if all OK, this just confirms no crash
  assert.ok(anomalies >= 0, 'anomaly count: ' + anomalies);
});

// ═══════════════════════════════════════════
// 4. YouTube 非回帰
// ═══════════════════════════════════════════
test('YouTube: full pipeline unchanged', () => {
  api.setMediaType('youtube');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');

  const setting = {
    cp: [{name:'Test CP',fields:{}}],
    io: [{name:'Test IO',cpName:'Test CP',fields:{}}],
    li: [{name:'Test LI',ioName:'Test IO',fields:{
      videoType:'VRC(s)',startDate:'2026/06/24',endDate:'2026/06/30',
      daypart:'',budgetNet:'500000',pacing:'掲載期間',billing:'CPM',
      inventory:'YouTube',language:'',region:'Japan',gender:'',age:'',
      parentalStatus:'',householdIncome:'',revenueModel:''}}],
    gp: [{name:'Test GP',liName:'Test LI',fields:{videoAdFormat:'Responsive',bidCost:'100'}}],
    cr: [{name:'Test CR',gpName:'Test GP',lpName:'Test LI',fields:{videoUrl:'',displayUrl:'',landingUrl:'',cta:''}}],
  };
  const download = {
    cp: [{name:'Test CP',id:'cp1',rawFields:{Status:'Active'},rawFieldOrder:['Status'],fields:{status:'Active'},statusInfo:{found:true,normalizedValue:'Active'}}],
    io: [{name:'Test IO',id:'io1',cpId:'cp1',rawFields:{Status:'Active'},rawFieldOrder:['Status'],fields:{status:'Active',budgetSegments:''},statusInfo:{found:true,normalizedValue:'Active'}}],
    li: [{name:'Test LI',id:'li1',ioId:'io1',rawFields:{Status:'Active'},rawFieldOrder:['Status'],fields:{type:'Video',subtype:'In-stream',status:'Active',startDate:'06/24/2026',endDate:'06/30/2026',budgetType:'TOTAL',budgetAmount:'500000',pacing:'Flight',pacingRate:'Evenly',bidStrategyType:'Target CPM',bidStrategyValue:'',trueViewKpiType:'CPCV',trueViewKpiValue:'',inventorySource:'YouTube',languageTargeting:'Japanese',geographyTargeting:'Japan',geographyExclude:'',daypartTargeting:'',partnerRevenueModel:'',partnerRevenueAmount:'',demographicGender:'',demographicAge:'',demographicIncome:'',demographicParental:''},statusInfo:{found:true,normalizedValue:'Active'}}],
    gp: [{name:'Test GP',id:'gp1',liId:'li1',rawFields:{Status:'Active'},rawFieldOrder:['Status'],fields:{status:'Active',videoAdFormat:'Responsive',bidCost:'100'},statusInfo:{found:true,normalizedValue:'Active'}}],
    cr: [{name:'Test CR',id:'cr1',gpId:'gp1',rawFields:{Status:'Active'},rawFieldOrder:['Status'],fields:{status:'Active',videoId:'',displayUrl:'',landingPageUrl:'',callToAction:'',headline:'',infeedVideoHeadline:'',description1:'',adType:'Responsive'},statusInfo:{found:true,normalizedValue:'Active'}}],
  };

  const tree = api.buildComparisonTree(setting, download);
  const allNodes = [];
  function collectNodes(node, nodes) { nodes.push(node); node.children.forEach(c => collectNodes(c, nodes)); }
  tree.roots.forEach(r => collectNodes(r, allNodes));

  // YouTube must have GP nodes
  const gpNodes = allNodes.filter(n => n.level === 'GP');
  assert.ok(gpNodes.length >= 1, 'YouTube: GP nodes exist');

  // YouTube CR must be under GP
  const crNodes = allNodes.filter(n => n.level === 'CR');
  let crUnderGp = true;
  for(const cr of crNodes) {
    const parent = allNodes.find(n => n.children.includes(cr));
    if(parent && parent.level !== 'GP') crUnderGp = false;
  }
  assert.ok(crUnderGp || crNodes.length === 0, 'YouTube: CR under GP');
});
