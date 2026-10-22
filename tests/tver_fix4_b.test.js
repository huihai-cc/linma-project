'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const XLSX=require('../xlsx.full.min.js');
const {getTverApi}=require('./tver_real_file.verify.js');
const {makeStructuredSettingWorkbook,makeRegisterCsv,makeEditCsv}=require('./fixtures/tver-fixtures.js');
const api=getTverApi();
const BASE='Survey Synthetic Order', NAME='【BLS】'+BASE+'_SP_261221-0321';
const CONTACT='【BLS】2612_'+BASE+'_SP_接触者', NONCONTACT='【BLS】2612_'+BASE+'_SP_非接触者';
function fixture({noncontact=2,start='2026/12/21',enable='あり',tap='あり',device='SP',references,cpCount='1本',contactCount='1本'}={}){
  const wb=makeStructuredSettingWorkbook({mainRows:['1','2'].map(number=>({'発注CPN名':BASE,'CPN訴求':'','CPN予算':'900','開始日時(yyyy/mm/dd hh:mm)':'2026/10/01 00:00','終了日時(yyyy/mm/dd hh:mm)':'2026/10/31 23:45','ターゲティング番号':number,'素材名':'synthetic-creative.mp4','LP名':'Synthetic LP'})),targetingBatches:[[
    {number:'1',displayName:'子あり',device:'SP／PC',price:'11',duration:'15秒(11-22秒)',age:'25歳〜44歳'},
    {number:'2',displayName:'DMP',device:'SP／PC',price:'22',duration:'15秒(11-22秒)',age:'25歳〜44歳',segment:'IM 合成DMP 9876',otherSettings:'DMP拡張値：50'},
  ]]});
  const rows=wb.Sheets[wb.SheetNames[0]];
  const targetHeader=rows.find(r=>r[1]==='ターゲティング名');
  targetHeader[2]='';targetHeader[4]='子あり';targetHeader[8]='';targetHeader[10]='DMP';
  rows[0]=['★','基本情報'];rows[9]=['','TVerSurvey',enable]; rows[17]=['','CV','あり','CVポイント','合成CV：345'];
  const creativeIndex=rows.findIndex(r=>r.includes('クリエイティブ'));
  rows.splice(creativeIndex,0,['','デモグラフィック●','○','子あり','','','','デモグラフィック●','','']);
  rows.push(['★','TVerSurvey'],['','','','','','','アンケート用CPN','本数','本数備考'],
    ['','','','','','','CPN',cpCount],['','設問表','Synthetic survey.xlsx','','','','接触者ADG',contactCount],
    ['','アンケート開始日',start,'','','','非接触者ADG',noncontact+'本',references??(noncontact===1?'ターゲ1':'ターゲ1,ターゲ2(拡張値50)')],
    ['','新TAP',tap],['','アンケート訴求','','サーベイタグ','VAST'],['',device,'接触者','synthetic-contact-tag','https://example.invalid/survey-contact-vast'],
    ['','','非接触者','synthetic-noncontact-tag','https://example.invalid/survey-noncontact-vast'],
    ['','作成場所','セグメント名','ID','','','サーベイ','サーベイ名'],
    ['','シナリオ','Synthetic Scenario',8765,'','','BLSキャンペーン名',BASE+'_'+start.replace(/[/-]/g,'').slice(2)],
    ['','VAST(サードパーティ)',CONTACT,7654],['','VAST(サードパーティ)',NONCONTACT,7655],
    ['※','旧システム'],['','SP','なし'],['','CTV','なし'],['★','後続']);
  return wb;
}
function run({wb=fixture(),mutate,edit=false,sheetJs=false}={}){
  if(sheetJs){const book=XLSX.utils.book_new();for(const n of wb.SheetNames)XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(wb.Sheets[n]),n);wb=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellDates:true});}
  const setting=api.parseTverSettingWorkbook(wb,{fileName:'survey-synthetic.xlsx'});
  const rows=[{suffix:'接触者',bid_segment:'8765',creative_name:CONTACT},
    {suffix:'非接触者_子あり',bid_segment_exclude:'8765',start_age:'25',end_age:'44',demography:'1',uid_suffix:'D E F',creative_name:NONCONTACT},
    {suffix:'非接触者_DMP',bid_segment_exclude:'8765',start_age:'25',end_age:'44',dmp_segment:'9876',dmp_segment_expansion_threshold:'50',uid_suffix:'D E F',creative_name:NONCONTACT}
  ].map((x,i)=>({campaign_name:NAME,start_datetime:'2026/12/21 0:00',end_datetime:'2027/3/21 23:45',budget:'90000',daily_budget:'1000',budget_type:'2',campaign_status:'0',consumption_type:'1',report_target_flag:'0',cv_point:'',adgroup_name:NAME+'_'+x.suffix,tver_video_duration:'15',price:'100',adgroup_status:'1',device:'android ios',start_time:'0:00',end_time:'23:59',status:'1',campaign_id:'901',adgroup_id:String(910+i),ad_id:String(920+i),...x}));
  if(mutate)mutate(rows);
  const parsed=api.parseCsvText((edit?makeEditCsv:makeRegisterCsv)(rows),{fileName:'survey-synthetic.csv'});
  const csv=edit?api.buildEditTree(parsed):api.buildRegisterTree(parsed);
  const matching=api.matchTverEntities(setting,csv,{schemaKind:parsed.schema.kind,conversionContext:api.createTverConversionContext(parsed.schema.kind,csv)});
  const result=api.buildRunFromModels(setting,csv,matching,parsed);
  const survey=[...setting.campaigns,...setting.adGroups,...setting.ads].filter(e=>e.businessType==='survey-sp');
  return {setting,csv,parsed,matching,result,survey,entries:result.entries.filter(e=>survey.some(s=>s.key===e.entityKey))};
}
const entity=(r,level,role)=>r.survey.find(e=>e.level===level&&(!role||e.surveyRole===role));
const entry=(r,level,field,role)=>r.entries.find(e=>e.level===level&&e.field===field&&(!role||r.survey.find(s=>s.key===e.entityKey).surveyRole===role));
function equal(e){assert.ok(e&&['一致','表記ゆれ一致'].includes(e.comparisonStatus),JSON.stringify(e));}

test('FIX4-B model: real SheetJS builds independent SP CP/3 GP/3 Ad with sources',()=>{
  const r=run({sheetJs:true});assert.equal(r.survey.filter(e=>e.level==='Campaign').length,1);assert.equal(r.survey.filter(e=>e.level==='Ad Group').length,3);assert.equal(r.survey.filter(e=>e.level==='Ad').length,3);
  assert.equal(r.matching.matches.filter(m=>m.status==='matched'&&r.survey.some(e=>e.key===m.settingKey)).length,7);
  assert.equal(entity(r,'Campaign').expectedName,NAME);
  assert.equal(entry(r,'Campaign','campaign_name').sourceRefs.setting.columnName,'発注CPN名');
  assert.equal(entry(r,'Ad Group','adgroup_name','contact').sourceRefs.setting.columnName,'adgroup_name');
  assert.ok(r.entries.length>45);assert.ok(r.entries.every(e=>e.sourceEvidence.setting.length&&e.sourceEvidence.csv.length));
  assert.equal(r.entries.filter(e=>['不一致','需确认','未匹配'].includes(e.comparisonStatus)).length,0);
});
for(const [field,value] of Object.entries({budget:'90000',daily_budget:'1000',budget_type:'2',campaign_status:'0',consumption_type:'1',report_target_flag:'0'}))test('FIX4-B CP contract '+field,()=>{
  const r=run();equal(entry(r,'Campaign',field));assert.equal(entry(r,'Campaign',field).settingRawValue,value);
});
test('FIX4-B CV is out of scope only for Survey; normal CV remains',()=>{
  const r=run({mutate(rows){rows.forEach(x=>{x.cv_point='999';});}});assert.equal(r.entries.filter(e=>e.field==='cv_point').length,0);
  assert.equal(r.setting.campaigns.find(e=>e.businessType!=='survey-sp').fields.cvPoint,'合成CV：345');
});
test('FIX4-B GP independent role contracts do not inherit normal price/device/CV/ASR',()=>{
  const r=run();equal(entry(r,'Ad Group','bid_segment','contact'));equal(entry(r,'Ad Group','bid_segment_exclude','noncontact'));
  assert.equal(entry(r,'Ad Group','bid_segment','contact').normalizedValues.setting,'8765');
  assert.equal(entry(r,'Ad Group','bid_segment_exclude','contact').normalizedValues.setting,'');
  assert.equal(entry(r,'Ad Group','uid_suffix','contact').normalizedValues.setting,'');
  assert.equal(entry(r,'Ad Group','dmp_segment','contact').normalizedValues.setting,'');
  assert.equal(entry(r,'Ad Group','device','contact').normalizedValues.setting,'android ios');
  assert.equal(entry(r,'Ad Group','price','contact').normalizedValues.setting,'100');
});
test('FIX4-B N branches: one noncontact produces 2 GPs, not fixed 3',()=>{
  const r=run({wb:fixture({noncontact:1}),mutate(rows){rows.splice(2);rows[1].adgroup_name=NAME+'_非接触者';}});
  assert.equal(r.survey.filter(e=>e.level==='Ad Group').length,2);assert.equal(r.survey.filter(e=>e.level==='Ad').length,2);
  assert.equal(r.matching.matches.filter(m=>m.status==='matched'&&r.survey.some(e=>e.key===m.settingKey)).length,5);
});
for(const [title,opts] of [['Survey disabled',{enable:'なし'}],['new TAP disabled',{tap:'なし'}],['CTV deferred',{device:'CTV'}]])test('FIX4-B detection: '+title,()=>{
  const r=run({wb:fixture(opts)});assert.equal(r.survey.length,0);assert.ok(r.setting.surveyDiagnostics.length);
  assert.ok(r.result.entries.some(e=>e.comparisonStatus==='未匹配'));
});
for(const [title,mutator] of [
  ['missing date',rows=>{rows.find(r=>r[1]==='アンケート開始日')[2]='';}],
  ['unknown Targeting reference',rows=>{rows.find(r=>r[6]==='非接触者ADG')[8]='ターゲ1,ターゲ99';}],
  ['duplicate Targeting reference',rows=>{rows.find(r=>r[6]==='非接触者ADG')[8]='ターゲ1,ターゲ1';}],
  ['plan count mismatch',rows=>{rows.find(r=>r[6]==='非接触者ADG')[7]='3本';}],
  ['missing Scenario ID',rows=>{rows.find(r=>r[1]==='シナリオ')[3]='';}],
  ['ambiguous Scenario ID',rows=>{rows.splice(rows.findIndex(r=>r[1]==='シナリオ'),0,['','シナリオ','Other Scenario','987']);}],
  ['multiple CP plan without mapping',rows=>{rows.find(r=>r[6]==='CPN')[7]='2本';}],
  ['missing Survey Creative',rows=>{rows.find(r=>r[2]===NONCONTACT)[2]='';}],
])test('FIX4-B evidence guard: '+title,()=>{
  const wb=fixture();mutator(wb.Sheets[wb.SheetNames[0]]);const r=run({wb});
  assert.ok(r.setting.surveyDiagnostics.length);assert.ok(r.result.entries.some(e=>['需确认','未匹配'].includes(e.comparisonStatus)));
  assert.notEqual(r.matching.matches.filter(m=>m.status==='matched'&&r.survey.some(e=>e.key===m.settingKey)).length,7);
});
for(const [field,value,row,role] of [
  ['budget','91000',0,null],['daily_budget','2000',0,null],['budget_type','1',0,null],['campaign_status','1',0,null],['consumption_type','2',0,null],['report_target_flag','1',0,null],
  ['bid_segment','999',0,'contact'],['bid_segment_exclude','999',1,'noncontact'],['uid_suffix','D E',1,'noncontact'],['uid_suffix','D E F 0',1,'noncontact'],['uid_suffix','0 1 2',0,'contact'],
  ['dmp_segment','999',2,'noncontact'],['dmp_segment_expansion_threshold','10',2,'noncontact'],['price','101',0,'contact'],['device','android ios pc',0,'contact'],
  ['start_age','26',1,'noncontact'],['demography','2',1,'noncontact'],['status','0',0,'contact'],['start_time','6:00',0,'contact'],['end_time','23:45',0,'contact'],
])test('FIX4-B negative field '+field+'='+value+' row '+row,()=>{
  const r=run({mutate(rows){if(row===0&&['budget','daily_budget','budget_type','campaign_status','consumption_type','report_target_flag'].includes(field))rows.forEach(x=>{x[field]=value;});else rows[row][field]=value;}});
  const level=['budget','daily_budget','budget_type','campaign_status','consumption_type','report_target_flag'].includes(field)?'Campaign':['status','start_time','end_time'].includes(field)?'Ad':'Ad Group';
  const comparisonField=field==='start_age'?'age':field;
  // CONTACT_ASR_BOUNDARY_FIX1：空值是本案可比较期望，非空接触者ASR不再视为已确认错误。
  const expected=field==='uid_suffix' && role==='contact' ? '需确认' : '不一致';
  assert.ok(r.entries.some(e=>e.level===level&&e.field===comparisonField&&e.comparisonStatus===expected),JSON.stringify(r.entries.filter(e=>e.field===comparisonField)));
});
test('FIX4-B wrong segment column cannot pass by sharing an ID',()=>{
  const r=run({mutate(rows){rows[0].bid_segment='';rows[0].bid_segment_exclude='8765';rows[1].bid_segment_exclude='';rows[1].bid_segment='8765';}});
  for(const role of ['contact','noncontact'])for(const field of ['bid_segment','bid_segment_exclude'])assert.equal(entry(r,'Ad Group',field,role).comparisonStatus,'不一致');
});
test('FIX4-B ASR: order is a set, duplicates and illegal characters remain review',()=>{
  equal(entry(run({mutate(rows){rows[1].uid_suffix='F E D';}}),'Ad Group','uid_suffix','noncontact'));
  for(const raw of ['D E F F','D E G'])assert.equal(entry(run({mutate(rows){rows[1].uid_suffix=raw;}}),'Ad Group','uid_suffix','noncontact').comparisonStatus,'需确认');
});
test('FIX4-B Creative: wrong name is compared using unique declared parent role, never hidden',()=>{
  const r=run({mutate(rows){rows[1].creative_name='wrong-survey-creative';}});
  assert.equal(entry(r,'Ad','creative_name','noncontact').comparisonStatus,'不一致');
});
test('FIX4-B same Creative under distinct parents matches independently; duplicate parent Ad is ambiguous',()=>{
  const good=run();assert.equal(good.matching.matches.filter(m=>m.level==='Ad'&&m.status==='matched').length,3);
  const duplicate=run({mutate(rows){rows.push({...rows[1]});}});
  const gp=duplicate.survey.find(s=>s.level==='Ad Group'&&s.expectedName.endsWith('_子あり'));
  const ad=duplicate.survey.find(s=>s.level==='Ad'&&s.parentKey===gp.key);
  assert.equal(duplicate.matching.matches.find(m=>m.settingKey===ad.key).reasonCode,'MULTIPLE_HARD_CANDIDATES');
});
test('FIX4-B parent scope: wrong CP cannot steal GP/Ad or compare across Campaigns',()=>{
  const r=run({mutate(rows){rows[1].campaign_name='【BLS】Other Parent';}});
  assert.ok(r.matching.matches.some(m=>m.level==='Ad Group'&&m.status!=='matched'&&r.survey.some(s=>s.key===m.settingKey)));
  assert.ok(r.entries.some(e=>e.field==='entity'&&['需确认','未匹配'].includes(e.comparisonStatus)));
});
test('FIX4-B URL/Tracking exclusion applies even with CSV values but only to actual Survey entities',()=>{
  const r=run({mutate(rows){rows.forEach(x=>{x.url='https://example.invalid/extra';x.tracking_url_complete='https://tracker.invalid/extra';});}});
  assert.equal(r.entries.filter(e=>e.field==='url'||e.field.startsWith('tracking_url')).length,0);
  assert.equal(r.entries.filter(e=>e.field==='auction_type').length,0);
});
test('FIX4-B Edit schema keeps missing columns review; provides explicit report/segments/ASR',()=>{
  const r=run({edit:true});equal(entry(r,'Campaign','report_target_flag'));equal(entry(r,'Ad Group','bid_segment','contact'));
  equal(entry(r,'Ad Group','uid_suffix','noncontact'));assert.equal(entry(r,'Ad Group','tver_video_duration','contact').comparisonStatus,'需确认');
  assert.equal(r.parsed.schema.canonicalHeaders.length,61);
});

test('FIX4-B CP source conflicts do not fall back to the only ordinary parent',()=>{
  const wb=fixture(),rows=wb.Sheets[wb.SheetNames[0]];
  rows.splice(rows.findIndex(r=>r[6]==='BLSキャンペーン名'),0,['','','','','','','BLSキャンペーン名','Other Order_261221']);
  const r=run({wb});assert.equal(r.survey.length,0);assert.ok(r.setting.surveyDiagnostics.some(x=>x.code==='SURVEY_NAME_OR_PARENT_SOURCE_CONFLICT'));
});
test('FIX4-B selected Audience text is unresolved, never silently treated as an empty set',()=>{
  const wb=fixture(),rows=wb.Sheets[wb.SheetNames[0]];
  const interest=rows.find(r=>r[1]==='興味関心●');interest[2]='○';interest[3]='アフィニティ：明示された業務値';
  const r=run({wb});assert.equal(entry(r,'Ad Group','affinity','noncontact').comparisonStatus,'需确认');
});
test('FIX4-B DMP description without a reliable ID is review, not an empty DMP PASS',()=>{
  const wb=fixture(),rows=wb.Sheets[wb.SheetNames[0]];
  rows.find(r=>r[7]==='DMPセグメント')[8]='IM 合成DMP ID不明';
  const r=run({wb,mutate(rows){rows[2].dmp_segment='';}});
  assert.ok(r.entries.some(e=>e.field==='dmp_segment'&&e.comparisonStatus==='需确认'));
});
test('FIX4-B Campaign evidence conflict across rows is visible review; no first-row report flag',()=>{
  const r=run({mutate(rows){rows[1].report_target_flag='1';}});
  assert.equal(entry(r,'Campaign','report_target_flag').comparisonStatus,'需确认');
});
test('FIX4-B name canonical: identical fullwidth names and approved Creative variants remain equal',()=>{
  const wb=fixture(),rows=wb.Sheets[wb.SheetNames[0]],replacement='Survey Synthetic＆Order';
  rows.forEach(row=>row.forEach((v,c)=>{if(typeof v==='string')row[c]=v.replaceAll(BASE,replacement);}));
  const mutate=csvRows=>csvRows.forEach(row=>Object.keys(row).forEach(k=>{if(typeof row[k]==='string')row[k]=row[k].replaceAll(BASE,replacement);}));
  const same=run({wb,mutate});equal(entry(same,'Campaign','campaign_name'));equal(entry(same,'Ad','creative_name','contact'));
  const variant=run({wb,mutate(csvRows){mutate(csvRows);csvRows.forEach(r=>r.campaign_name=r.campaign_name.replace('＆','&'));csvRows[0].creative_name=csvRows[0].creative_name.replace('＆','&');}});
  equal(entry(variant,'Campaign','campaign_name'));equal(entry(variant,'Ad','creative_name','contact'));
});
test('FIX4-B Edit Ad status cannot apply a Register-only current-status default',()=>{
  const r=run({edit:true,mutate(rows){rows[0].status='0';}});
  assert.equal(entry(r,'Ad','status','contact').comparisonStatus,'需确认');
  assert.equal(entry(r,'Ad','status','contact').settingRawValue,'');
  assert.equal(entry(r,'Ad','status','contact').normalizedValues.setting,null);
  assert.equal(entry(r,'Ad','status','contact').evidenceStates.setting,'not_provided');
});
test('FIX4-B N branches: three noncontact references produce four role GPs/Ads',()=>{
  const wb=fixture({noncontact:3,references:'ターゲ1,ターゲ2(拡張値50),ターゲ3'}),rows=wb.Sheets[wb.SheetNames[0]];
  const main=rows[19].slice();main[5]='3';rows.splice(21,0,main);
  const anchor=rows.findIndex(r=>r[1]==='ターゲティング名'),creative=rows.findIndex(r=>r.includes('クリエイティブ'));
  const extra=rows.slice(anchor,creative).map(r=>r.slice(0,7));extra[0][3]='3';extra[0][4]='合成枝';rows.splice(creative,0,...extra);
  const r=run({wb,mutate(csvRows){csvRows.push({...csvRows[1],adgroup_name:NAME+'_非接触者_合成枝'});}});
  assert.equal(r.survey.filter(e=>e.level==='Ad Group').length,4);assert.equal(r.survey.filter(e=>e.level==='Ad').length,4);
  assert.equal(r.matching.matches.filter(m=>m.status==='matched'&&r.survey.some(s=>s.key===m.settingKey)).length,9);
});
test('FIX4-B suffix: explicit comparable demographic label works; absent label remains review',()=>{
  const wb=fixture(),rows=wb.Sheets[wb.SheetNames[0]];rows.find(r=>r[1]==='ターゲティング名')[4]='';
  const good=run({wb});assert.equal(good.survey.find(e=>e.level==='Ad Group'&&e.surveyRole==='noncontact').expectedName,NAME+'_非接触者_子あり');
  rows.find(r=>r[1]==='デモグラフィック●')[3]='';
  const bad=run({wb});assert.ok(bad.matching.matches.some(m=>m.reasonCode==='SURVEY_BRANCH_NAME_SOURCE_MISSING'));
});
test('FIX4-B calendar: three calendar months cross year correctly; uncertain short-month boundary defers',()=>{
  const year=run({wb:fixture({start:'2026/10/31'})});assert.equal(entity(year,'Campaign').surveyContracts.end_datetime.rawValue,'2027/01/31 23:45');
  const boundary=run({wb:fixture({start:'2026/11/30'})});assert.equal(boundary.survey.length,0);assert.ok(boundary.setting.surveyDiagnostics.some(d=>d.code==='SURVEY_MONTH_END_POLICY_REQUIRED'));
});
test('FIX4-B duplicate Campaign identity blocks parent/child matching instead of stealing candidates',()=>{
  const r=run({mutate(rows){rows.push({...rows[0],budget:'90001'});}});
  assert.equal(r.matching.matches.find(m=>m.level==='Campaign'&&r.survey.some(s=>s.key===m.settingKey)).reasonCode,'MULTIPLE_HARD_CANDIDATES');
  assert.ok(r.matching.matches.filter(m=>m.level==='Ad'&&r.survey.some(s=>s.key===m.settingKey)).every(m=>m.status==='ambiguous'));
});
test('FIX4-B new comparison fields have explicit business labels',()=>{
  const r=run();assert.equal(entry(r,'Ad Group','adgroup_name').fieldLabel,'広告グループ名');
  assert.equal(entry(r,'Ad Group','bid_segment_exclude').fieldLabel,'入札除外セグメント');
  assert.equal(entry(r,'Ad Group','affinity').fieldLabel,'興味関心');
});

for(const [label,value,expected] of [
  ['empty','','一致'],['valid D E F','D E F','需确认'],['valid numeric','0 1 2','需确认'],['invalid','D ? F','需确认'],
])test('CONTACT-ASR-FIX1 contact '+label,()=>{
  const baseline=entry(run(),'Ad Group','uid_suffix','contact');
  const r=run({mutate(rows){rows[0].uid_suffix=value;}}),e=entry(r,'Ad Group','uid_suffix','contact');
  assert.equal(e.comparisonStatus,expected);assert.equal(e.displayStatus,expected);
  assert.equal(e.settingRawValue,'');assert.equal(e.csvRawValue,value);assert.equal(e.sourceRefs.csv.rawValue,value);
  assert.deepEqual(JSON.parse(JSON.stringify(e.sourceEvidence.setting)),JSON.parse(JSON.stringify(baseline.sourceEvidence.setting)));
  assert.deepEqual(JSON.parse(JSON.stringify(e.sourceEvidence.derivedFrom)),JSON.parse(JSON.stringify(baseline.sourceEvidence.derivedFrom)));
  assert.equal(e.sourceEvidence.csv[0].columnName,'uid_suffix');assert.equal(e.sourceEvidence.csv[0].rawValue,value);
  if(value){
    assert.equal(e.conservativeReason,label==='invalid' ? 'SURVEY_ASR_TOKEN_UNCONFIRMED' : 'SURVEY_CONTACT_ASR_RULE_PENDING');
    assert.equal(e.comparable,false);
  }
});
test('CONTACT-ASR-FIX1 noncontact D E F stays equal',()=>{
  assert.equal(entry(run(),'Ad Group','uid_suffix','noncontact').comparisonStatus,'一致');
});
test('CONTACT-ASR-FIX1 noncontact wrong ASR stays mismatch',()=>{
  assert.equal(entry(run({mutate(rows){rows[1].uid_suffix='D E';}}),'Ad Group','uid_suffix','noncontact').comparisonStatus,'不一致');
});
test('CONTACT-ASR-FIX1 ordinary GP 0~C stays variant equal',()=>{
  const wb=fixture(),rows=wb.Sheets[wb.SheetNames[0]];
  rows.splice(rows.findIndex(r=>r.includes('クリエイティブ')),0,['','ASR','○','0~C','','','','ASR','○','0~C']);
  const setting=api.parseTverSettingWorkbook(wb,{fileName:'ordinary-asr-synthetic.xlsx'}),cp=setting.campaigns.find(s=>s.businessType!=='survey-sp');
  const parsed=api.parseCsvText(makeRegisterCsv([{campaign_name:cp.expectedName,start_datetime:'2026/10/01 00:00',end_datetime:'2026/10/31 23:45',budget:'900',adgroup_name:'Normal GP',price:'11',device:'android ios pc',tver_video_duration:'15',creative_name:'synthetic-creative.mp4',url:'https://example.invalid/synthetic-lp',uid_suffix:'0 1 2 3 4 5 6 7 8 9 A B C'}]),{fileName:'ordinary-asr-synthetic.csv'});
  const csv=api.buildRegisterTree(parsed),matching=api.matchTverEntities(setting,csv,{schemaKind:parsed.schema.kind,conversionContext:api.createTverConversionContext(parsed.schema.kind,csv)});
  const result=api.buildRunFromModels(setting,csv,matching,parsed),gp=setting.adGroups.find(s=>s.businessType!=='survey-sp');
  assert.equal(result.entries.find(e=>e.entityKey===gp.key&&e.field==='uid_suffix').comparisonStatus,'表記ゆれ一致');
});
