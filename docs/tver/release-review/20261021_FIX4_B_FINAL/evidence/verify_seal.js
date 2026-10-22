'use strict';
// 本次封板只读校验：只写审核证据，不修改HTML、测试或业务输入。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'../../../../..'),out=__dirname;
const XLSX=require(path.join(project,'xlsx.full.min.js'));
const {makeRegisterCsv}=require(path.join(project,'tests/fixtures/tver-fixtures.js'));
const htmlPath=path.join(project,'tver_check.html');
const authoritative='CA3D99E13F6B64A1604C669A3AE51DD78EB037CADF1F04E362D43BF767519DD6';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
assert.equal(hash(htmlPath),authoritative);
const scripts=[...fs.readFileSync(htmlPath,'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());scripts.forEach(s=>new Function(s));
const exportNames=['parseTverSettingWorkbook','parseCsvText','buildRegisterTree','buildEditTree','matchTverEntities','createTverConversionContext','buildRunFromModels','summarizeValidationRun','findSettingHeaderCandidates','buildTverHorizontalViewModel','buildTverHorizontalTableHtml'];
const stub=()=>({addEventListener(){},appendChild(){},setAttribute(){},remove(){},click(){},classList:{add(){},remove(){},toggle(){}},dataset:{},files:[],innerHTML:'',style:{},textContent:'',value:'',querySelector(){return null},querySelectorAll(){return []}});
const document={body:stub(),documentElement:stub(),getElementById:stub,querySelector(){return null},querySelectorAll(){return []},createElement:stub};
const box={Blob,Map,Set,TextDecoder,Uint8Array,URL,console,document,XLSX};box.window=box;
vm.runInNewContext(scripts.find(s=>s.includes('TVER_APP_MARKER')).replace(/\}\)\(\);\s*$/,'window.__seal={'+exportNames.join(',')+',REGISTER_HEADERS_61,EDIT_HEADERS_61};})();'),box);
const a=box.__seal,plain=o=>JSON.parse(JSON.stringify(o));
assert.equal(a.REGISTER_HEADERS_61.length,61);assert.equal(a.EDIT_HEADERS_61.length,61);
assert.ok(a.REGISTER_HEADERS_61.includes('auction_type'));assert.ok(a.EDIT_HEADERS_61.includes('auction_type'));
const priorRoot='C:/Users/BPO/.codex/visualizations/2026/10/19/01a15208-5b3d-7750-a13b-65d9bb604c3a';
const manifest=JSON.parse(fs.readFileSync(priorRoot+'/tver_fix4_a/source_hash_verification.json','utf8'));
manifest.forEach(i=>assert.equal(hash(i.path),i.sha256,'business original unchanged'));
fs.writeFileSync(path.join(out,'input_manifest.json'),JSON.stringify(manifest,null,2));
function run(name,probe){
 const src=manifest.filter(x=>x.case===name),xp=src.find(x=>/\.xlsx$/.test(x.path)).path,cp=src.find(x=>/\.csv$/.test(x.path)).path;
 const wb=XLSX.read(fs.readFileSync(xp),{type:'buffer',cellDates:true});
 let parsed=a.parseCsvText(fs.readFileSync(cp,'utf8'),{fileName:cp});
 if(probe){
  const sheet=wb.Sheets[wb.SheetNames[0]];
  for(const addr of ['C56','D56','E56','H56','I56','J56','C64','D64','H64','I64']) if(sheet[addr])sheet[addr]={t:'s',v:''};
  const rows=plain(parsed.rows.map(r=>r.values));rows.filter(r=>!r.campaign_name.startsWith('【BLS】')).forEach(r=>{r.store_segment='';r.uid_suffix='';});
  parsed=a.parseCsvText(makeRegisterCsv(rows),{fileName:cp+' [read-only coverage gap probe]'});
 }
 const sm=a.parseTverSettingWorkbook(wb,{fileName:xp}),ct=a.buildRegisterTree(parsed),matching=a.matchTverEntities(sm,ct,{schemaKind:parsed.schema.kind,conversionContext:a.createTverConversionContext(parsed.schema.kind,ct)});
 const run=a.buildRunFromModels(sm,ct,matching,parsed),survey=[...sm.campaigns,...sm.adGroups,...sm.ads].filter(s=>s.businessType==='survey-sp');
 const normalKeys=new Set(sm.adGroups.filter(s=>!s.businessType).map(s=>s.key));
 const h=a.findSettingHeaderCandidates(wb,{maxRows:100}).candidates[0].headers;
 return {sources:src,summary:plain(a.summarizeValidationRun(run)),schemaKind:parsed.schema.kind,headerEvidence:plain(h.filter(s=>['デバイス','タグ訴求','タグ訴求(0%)','タグ訴求(100%)'].includes(s))),
  auctionEntries:run.entries.filter(e=>e.field==='auction_type').length,
  surveyCounts:{Campaign:survey.filter(s=>s.level==='Campaign').length,'Ad Group':survey.filter(s=>s.level==='Ad Group').length,Ad:survey.filter(s=>s.level==='Ad').length},
  surveyEntries:plain(run.entries.filter(e=>survey.some(s=>s.key===e.entityKey))),
  abnormal:plain(run.entries.filter(e=>['不一致','需确认','未匹配'].includes(e.comparisonStatus))),
  normalSurveyLinkFields:plain(run.entries.filter(e=>normalKeys.has(e.entityKey)&&['store_segment','uid_suffix'].includes(e.field))),
  horizontalCounts:Object.fromEntries(['Campaign','Ad Group','Ad'].map(l=>[l,a.buildTverHorizontalViewModel(run,l,{status:'all',abnormalOnly:false,keyword:''}).rows.length]))};
}
const result={authoritativeSha256:authoritative,htmlSha256:hash(htmlPath),inlineSyntax:'PASS',schema:{Register:a.REGISTER_HEADERS_61.length,Edit:a.EDIT_HEADERS_61.length,registerHeaders:plain(a.REGISTER_HEADERS_61),editHeaders:plain(a.EDIT_HEADERS_61)},cases:{}};
for(const [n,counts,status] of [
 ['Benesse',{Campaign:2,'Ad Group':5,Ad:7},{'一致':99,'表記ゆれ一致':24,'不一致':0,'需确认':4,'未匹配':0}],
 ['AXA',{Campaign:1,'Ad Group':10,Ad:10},{'一致':125,'表記ゆれ一致':43,'不一致':2,'需确认':2,'未匹配':0}],
 ['Airbnb',{Campaign:3,'Ad Group':6,Ad:6},{'一致':80,'表記ゆれ一致':46,'不一致':6,'需确认':6,'未匹配':0}],
]){
 const c=run(n);assert.deepEqual(c.summary.matchedCounts,counts);assert.deepEqual(c.summary.statusCounts,status);assert.equal(c.auctionEntries,0);
 if(n==='Benesse'){assert.equal(c.surveyEntries.length,69);assert.equal(c.surveyEntries.filter(e=>['不一致','需确认','未匹配'].includes(e.displayStatus)).length,0);}
 result.cases[n]=c;
}
// 覆盖调查探针，既不是新增回归测试，也不改变封板生产文件。记录结果而不伪造功能已实现。
const probe=run('Benesse',true);
result.coverageGapProbe={purpose:'P56 ordinary SP mandatory Scenario/ASR relationship',method:'in-memory removal of normal Store/ASR Setting+CSV values; Survey enable and Scenario ID retained',summary:probe.summary,normalFields:probe.normalSurveyLinkFields,abnormal:probe.abnormal};
const log=fs.readFileSync(path.join(out,'full_regression.log'),'utf8');
for(const token of ['tests 837','pass 837','fail 0','skipped 0'])assert.ok(log.includes(token));
assert.equal(hash(htmlPath),authoritative);
fs.writeFileSync(path.join(out,'seal_verification.json'),JSON.stringify(result,null,2));
fs.copyFileSync(htmlPath,path.join(out,'tver_check.sealed.html'));
console.log(JSON.stringify({gate:'PASS',sha256:authoritative,cases:Object.fromEntries(Object.entries(result.cases).map(([n,c])=>[n,{matched:c.summary.matchedCounts,status:c.summary.statusCounts,fmtHeaders:c.headerEvidence}])),gapProbe:{status:probe.summary.statusCounts,normalFields:probe.normalSurveyLinkFields.map(e=>({field:e.field,status:e.comparisonStatus,setting:e.settingRawValue,csv:e.csvRawValue}))}}));
