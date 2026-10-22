'use strict';
// 仅生成审核交付，不修改生产、测试或业务输入。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'..'),root=path.resolve(__dirname,'../../../../..');
const prior='C:/Users/BPO/.codex/visualizations/2026/10/19/01a15208-5b3d-7750-a13b-65d9bb604c3a';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'seal_verification.json'),'utf8'));
assert.equal(hash(path.join(root,'tver_check.html')),evidence.authoritativeSha256);
function parseCsv(text){let rows=[],row=[],s='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){s+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(s);s='';}else if(c==='\n'&&!q){row.push(s.replace(/\r$/,''));rows.push(row);row=[];s='';}else s+=c;}if(s||row.length){row.push(s.replace(/\r$/,''));rows.push(row);}return rows;}
const raw=parseCsv(fs.readFileSync(prior+'/tver_fix4_readonly/MANUAL_71P_COVERAGE_MATRIX.csv','utf8').replace(/^\uFEFF/,''));
const headers=raw.shift(),original=raw.filter(r=>r.length>1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));assert.equal(original.length,113);
const sources=[
 ['tver_fix4_readonly','MANUAL_71P_COVERAGE_MATRIX.md'],['tver_fix4_readonly','MANUAL_71P_COVERAGE_MATRIX.csv'],['tver_fix4_readonly','FIX4_DEVELOPMENT_SPEC.md'],['tver_fix4_readonly','BUSINESS_CONFIRMATION_ITEMS.md'],
 ['tver_fix4_a','IMPLEMENTATION_AND_REAL_CASE_REPORT.md'],['tver_fix4_a','FIX4_B_CONFIRMATION_CLASSIFICATION.md'],
 ['tver_fix4_b','IMPLEMENTATION_REPORT.md'],['tver_fix4_b','BENESSE_MATCH_AND_STATISTICS.md'],['tver_fix4_b','BLS_ALL_COMPARISONS.md'],['tver_fix4_b','NEGATIVE_TEST_RESULTS.md'],['tver_fix4_b','BUSINESS_CONFIRMATION_REMAINING.md'],
 ['tver_fix4_b_contact_asr_fix1','FIX_REPORT.md'],['tver_fix4_b_contact_asr_fix1','TVER_FIX4_B_CONTACT_ASR_FIX1_GATE.md'],
];
const sourceManifest=sources.map(([dir,name])=>{const source=prior+'/'+dir+'/'+name,target=path.join(__dirname,'source_reports',dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);assert.equal(hash(source),hash(target));return{source,saved:path.relative(out,target).replaceAll('\\','/'),sha256:hash(target)};});
fs.writeFileSync(path.join(__dirname,'source_reports_manifest.json'),JSON.stringify(sourceManifest,null,2));
const html=fs.readFileSync(path.join(root,'tver_check.html'),'utf8'),htmlLines=html.split(/\r?\n/);
const ref=name=>{const i=htmlLines.findIndex(l=>l.includes('function '+name+'('));return i<0?name:'tver_check.html:'+String(i+1)+' '+name;};
const tests=['tver_check.test.js','tver_mismatch_navigator.test.js','tver_release_prep.test.js','tver_c3c5_cr_reopen3.test.js','tver_c3c5_cr_reopen5.test.js','tver_c3c5_cr_reopen5_fix1.test.js','tver_fix4_a.test.js','tver_fix4_b.test.js'];
const testCatalog=tests.flatMap(file=>fs.readFileSync(path.join(root,'tests',file),'utf8').split(/\r?\n/).flatMap((line,i)=>/\btest\(/.test(line)?[{file:'tests/'+file,line:i+1,definition:line.trim()}]:[]));
fs.writeFileSync(path.join(__dirname,'test_definition_catalog.json'),JSON.stringify(testCatalog,null,2));
function testRefs(file,pattern){const r=new RegExp(pattern,'i');return testCatalog.filter(t=>(!file||t.file.includes(file))&&r.test(t.definition)).slice(0,6).map(t=>t.file+':'+t.line).join('; ')||'无该功能闭环正反例，不能据字段名判A';}
const display=[ref('buildTverHorizontalViewModel'),ref('buildTverHorizontalTableHtml'),'tests/tver_mismatch_navigator.test.js:12/29/51'].join('; ');
const normalMatch=ref('matchTverEntities')+'；Campaign→唯一父GP→Ad；候选争用/缺身份保守';
const surveyMatch=normalMatch+'；survey-sp角色/显式引用；同名Creative按唯一父GP隔离';
// Profile为当前源码中逐项查证的来源与接线；未接线项目明确保留空缺，不把通用比较器当实现证据。
const profiles={
 doc:{setting:'文档/章节/操作说明，无设置期望',csv:'61列无本项操作完成证据',parser:'不适用',compare:'无自动比较',test:'无自动校正正反例（不应声称支持）'},
 inventory:{setting:'★クリエイティブ素材名/文件名；非账户素材库存',csv:'Ad creative_name；无库存状态/文件属性/VAST/Transcode/Companion数据',parser:'resolveCreativeFields',compare:'只对Ad选择的素材名；库存/实际文件规格无比较',test:'Creative:|Creative 全角|Creative 独立|素材名不能'},
 cp:{setting:'配信設計每个Campaign业务行：名称/期间/预算；sourceRefs保留',csv:'Register own rawRows/sourceEvidence；Edit Campaign ID自身字段',parser:'buildCampaignExpectation',compare:'buildRunFromModels',test:'Campaign|A16 Compare|datetime|budget'},
 cv:{setting:'基本情報业务CV行C18/E18等定位及其CVポイント；排除报表指标G8/H8；不扫描全表数字',csv:'Register所属Campaign rawRows cv_point；Edit自身cv_point，冲突/空白保留',parser:'resolveTverSettingCvPoint',compare:'normalizeComparisonValue',testFile:'tver_fix4_a',test:'CV'},
 daily:{setting:'配信設計同CP跨行业务日预算sourceEvidence',csv:'Campaign daily_budget自身各行',parser:'buildRunFromModels',compare:'buildRunFromModels',test:'daily|日预算'},
 gp:{setting:'通常配信設計Targeting编号/タグ訴求/父CP与Targeting索引',csv:'Register分组独立原始行；Edit GP ID及父CP ID',parser:'parseTverSettingWorkbook',compare:'buildRunFromModels',test:'GP|Ad Group|identity'},
 period:{setting:'GP明确期间；无独立期间时适用继承保护',csv:'GP adgroup_start_datetime/adgroup_end_datetime自身sourceEvidence',parser:'resolveTverGpPeriodGuard',compare:'buildRunFromModels',test:'GP.*(期間|period|期间)|期間.*GP|GP_PERIOD'},
 operations:{setting:'所属Targeting视频尺、CPM、初動OFF/状态业务槽',csv:'Register tver_video_duration/price/adgroup_status；Edit无视频尺',parser:'resolveSettingOperationalTargetingForComparison',compare:'buildTverA173OperationalComparisonInputs',test:'A17-3A|CPM|status 默认|status 1/1'},
 device:{setting:'新FMT行Device优先/旧FMTタグ訴求与Targeting可靠设备；非全局说明',csv:'GP自身device，空值不被邻组污染',parser:'resolveSettingAdGroupDevice',compare:'buildRunFromModels',test:'NEW-FMT-DEVICE|OLD-FMT-DEVICE|空device|年齢_CTV'},
 targeting:{setting:'所属Targeting业务槽原文及sourceEvidence；只对已知字典/明确表达转换',csv:'readTverA17TargetingCsvValue按Register/Edit独立字段；age读取start_age/end_age',parser:'resolveSettingTargetingForComparison',compare:'buildTverA17TargetingComparisonInputs',test:'A17-2|Age 支持|C3-C4-4D|genre_exclude'},
 asr:{setting:'所属Targeting ASR明确0~8/0のみ/0~C等已知序列；非任意0-F范围',csv:'GP uid_suffix，重复/非法/未知范围保守',parser:'tverC344UidSuffixSettingCanonical',compare:'buildTverA17TargetingComparisonInputs',testFile:'tver_fix4_a',test:'ASR'},
 retarget:{setting:'数据蓄积/入札セグメント分别取所属Targeting可靠ID，不相互回退',csv:'Register/Edit store_segment与bid_segment独立raw/sourceRefs',parser:'resolveSettingRetargetProfile',compare:'buildTverA173RetargetComparisonInputs',test:'A17-3B|Retarget'},
 dmp:{setting:'所属Targeting DMP可靠ID与扩张值；模板/备注不视作ID',csv:'Register dmp_segment + threshold；Edit仅threshold存在，DMP ID列缺失',parser:'resolveSettingOperationalTargetingForComparison',compare:'buildTverA173OperationalComparisonInputs',test:'A17-3A|DMP扩展|DMP evidence|DMP 纯'},
 creative:{setting:'★クリエイティブ唯一文件名/素材映射及配信設計父GP',csv:'每个Ad独立creative_name/rawRows，非整CP首行',parser:'resolveCreativeFields',compare:'buildRunFromModels',test:'Creative|计划|MISSING_CREATIVE|同名'},
 adtime:{setting:'按Ad父GP的Targeting编号关联明确時間指定；缺失沿既有00:00/23:59；歧义保守',csv:'Ad自身start_time与end_time分别读取',parser:'resolveTverAdTimeContract',compare:'buildRunFromModels',testFile:'tver_fix4_a',test:'Ad time'},
 adstatus:{setting:'Register已确认初始状态1；尚无可靠Edit当前状态/所有停止例外来源',csv:'Ad自身status；空白/非法可见',parser:'buildRunFromModels',compare:'buildRunFromModels',test:'Register Ad status|status.*URL|Status:'},
 url:{setting:'★入稿用URL唯一素材关联；旧FMT明确fallback；不使用其他素材URL',csv:'Ad url原文，协议/路径/查询/宏严格保留',parser:'buildUploadUrlIndex',compare:'buildRunFromModels',test:'FIX3 upload URL|FIX3 identity|Creative:.*LP'},
 tracking:{setting:'★計測タグ按タグ訴求及素材关联；100%完成标签集合',csv:'Ad tracking_url_complete自身rawRows，其他点不完整',parser:'buildMeasurementTagIndex',compare:'buildRunFromModels',test:'MTag:|Creative:.*Tracking|Tracking.*宏'},
 survey:{setting:'基本TVerSurvey=あり+新TAP+★TVerSurvey SP有效设计/日期/角色/数量/引用；来源独立',csv:'Register 【BLS】CP/GP/Ad各rawRows；前缀仅身份证据之一；Edit缺列需确认',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'model:|detection:|evidence guard:|parent scope|negative field'},
 surveycp:{setting:'Survey开始日00:00/三日历月后23:45；90000/1000/类型2/状态0/消化1/report0独立手册契约',csv:'BLS所属CP自身rawRows，跨行冲突保守；Edit无budget_type',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'CP contract|negative field|calendar:|Campaign evidence|Edit schema'},
 surveygp:{setting:'Contact独立规则SP=android ios/15秒/100/状态1；Scenario ID指定与除外分列；Audience/DMP明确空契约',csv:'BLS GP自身字段；Edit无video/DMP列不可当空',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'GP independent|negative field|wrong segment|Edit schema'},
 surveybranch:{setting:'Noncontact设计数量+唯一Targeting引用；显式标签生成多分支后缀；已测试1/2/3',csv:'每个BLS GP名称与唯一父CP；不从CSV反推Setting数量',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'N branches|suffix:|evidence guard|duplicate Campaign'},
 surveytarget:{setting:'Noncontact仅按明确引用继承gender/age/pref/annual_income/demography/DMP；业务Affinity未可靠映射时review',csv:'BLS GP自身上述字段；不是普通GP CSV值复制',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'selected Audience|DMP description|negative field|GP independent'},
 surveyasr:{setting:'Noncontact=D E F；Contact本案空可比，非空规则未确认',csv:'各角色uid_suffix及bid_segment_exclude独立原文/证据',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'ASR:|CONTACT-ASR|wrong segment|negative field uid_suffix'},
 surveyad:{setting:'Survey专用VAST Creative按SP角色读取；Ad唯一父GP；同名可跨父重用',csv:'各BLS Ad creative_name/status/start_time/end_time；Edit状态不套初始默认',parser:'appendTverSurveySpModel',compare:'buildTverSurveyComparisonInputs',testFile:'tver_fix4_b',test:'Creative:|same Creative|parent scope|negative field|Edit Ad status'},
 policy:{setting:'正式业务对象外决定；原始解析兼容保留',csv:'原始列/原文保留；不生成该项比较entry',parser:'buildRunFromModels',compare:'输入生成阶段排除；不是CSS隐藏/统计扣减',test:'TVER_AUCTION_TYPE_QC_EXCLUSION_FIX2'},
 missing:{setting:'原矩阵Excel/手册要求保留，尚无可验证的完整期望链',csv:'见原CSV字段列；缺独立实体/数据时不能用近似字段代替',parser:'未建立该功能完整生产接线',compare:'未比较；不声明自动校正',test:'未有该功能完整正反例闭环'},
};
const assign={doc:[1,2,3,4,6,7,8,11,22,23,30,55,61,64,68,71,72,75,76,77,81,100],inventory:[12,13,14,15,16,17,18,20,21],cp:[5,24,26],cv:[25],daily:[27,29],gp:[31,32,34],period:[33],operations:[35],device:[37],targeting:[39,41,42,43,44,45,47,48,49,50,69,70,73,74],asr:[46,84],retarget:[40,51,52,83],dmp:[53,54],creative:[19,56],adtime:[57],adstatus:[58],url:[59],tracking:[60],survey:[82],surveycp:[85,86,87],surveygp:[89,91],surveybranch:[92,93],surveytarget:[94,96],surveyasr:[95],surveyad:[97],policy:[36,88,90,98]};
const byId={};for(const [p,ids]of Object.entries(assign))for(const id of ids)byId[id]=p;
const changes={25:'A',29:'E',57:'A',82:'A',85:'B',86:'A',87:'A',88:'A',89:'A',91:'A',92:'A',93:'B',94:'B',95:'A',96:'B',97:'A',98:'A'};
const notes={
 5:'通常三层+新TAP Survey SP三层已建模；账户/素材库存/FQ/Dashboard并未变成三层CSV可证数据。',
 12:'素材名/Ad关系可读；不能证明全账户无重名或文件已取得。',13:'已比所选Ad Creative名；素材库存状态/VAST上传类型无证据。',18:'支持已选Creative唯一关联；全账户注册/重名检测不足。',19:'名称规范化及唯一父GP关联已比较；不扩展成素材库审核。',21:'普通Nonclick/CTV URL免设置仍无统一契约，不能直接套Survey例外。',
 24:'通常CP名称/期间/总预算完整比较；BLS另由85/86处理，不继承通常预算。',
 25:'FIX4-A已修正业务CV定位、Register原始值读链与ID集合；顺序允许，重复/非法/冲突review，漏/多/错ID mismatch；なし+空正常，あり无可靠ID review；BLS对象外另记88。',
 26:'通常CP已确认状态/预算类型/消化类型契约可比；自由文本/缺列不猜；Survey独立合同。',
 27:'同CP跨行业务日预算可读；自动日均/未来Scheduler时点未实现；Benesse日预算仍有review。',
 29:'当前hourly_bid_weight仅保守review占位，双方空可隐藏但仍有entry；无可靠小时预算Setting契约，改E，不能计作已比较。',
 31:'父CP范围与候选唯一性保留；错父、争用不会强配，SP角色扩展已验证。',
 32:'FIX1 AXA有结构限定身份修复，FIX3明确分支名支持；通常GP全面命名QC仍无普遍adgroup_name预期，不能把特殊匹配当通用命名校正。',
 33:'GP明确期间/继承保护可比，不把GP日期当Ad日内时间。',34:'daily_freq_cap虽保留raw，普通Setting期望与比较输入未接线；不等同Campaign期间FQ。',
 35:'Register视频/CPM/GP状态可比；Edit未提供视频尺，素材实际规格仍需库存证据。',
 36:'正式对象外：所有FMT/Register/Edit不生成auction_type校正entry；不是自动校正功能。',
 37:'通常旧/新FMT Device均有正负例；AXA两项真差异保留；Survey SP固定手机合同另记89，绝不代表Survey CTV支持。',
 39:'明确Media ID、Local全选及部分名称可比；单Local/所有排除表达未全覆盖。',
 40:'明确store_segment ID可比；Survey启用→普通SP必须蓄积Scenario的跨条件完整性检查仍缺，见83。',
 41:'已知性别、年龄、Pref明确集合可比；所有区域/排除/City不全，仍B。',42:'无正式City master/业务映射和生产comparison闭环，保守保护不是实现。',
 43:'普通affinity有列/字典但Setting到比较entry未接线；SP仅空契约/未解析业务文本review，不能升级。',
 44:'已知世帯年収/子あり映射可比；其他表达保守，不能声称全部Demography。',45:'tv_usage_tendency/carrier只有CSV承载，普通Setting映射与comparison未接线。',
 46:'0~C已增加；0~8/0のみ历史语义不变，SP非接触者D E F另记95；普通任意0-F/未知范围仍未完整支持。',
 47:'genre/subgenre include没有生产Setting比较；不能由exclude实现推定。',48:'FIX3 genre_exclude与既有subgenre_exclude已实际接线，Register/Edit有正反例；未知别名保守，不重复列为全未实现。',49:'手册别名未全部权威映射，现为明确字典名范围，不做任意模糊。',50:'contents_group raw/字典不代表比较；缺业务来源接线和版本字典闭环。',
 51:'普通bid_segment明确ID已独立比较；Survey接触者另记91，不能和exclude混用。',
 52:'普通bid_segment_exclude仍无Setting解析/comparison；SP Noncontact已支持(95)，两范围不能互相冒充。',
 53:'Register可靠DMP ID和扩张值可比；Edit CSV缺DMP ID，不能声称ID已校正（扩张字段可读）。',54:'普通dmp_segment_exclude尚无生产比较输入；SP无此通用能力。',
 56:'普通Creative与父GP唯一关联已支持；无filename计划Ad继续review。',57:'FIX4-A明确Targeting時間指定按编号/父GP关联，每个Ad分别比较start/end；缺失沿旧默认，未知/冲突review；Airbnb23:45真差异保留。',
 58:'Register初始状态已有比较；普通停止例外与计划Ad生命周期、Edit当前状态无可靠全覆盖，仍B。',59:'普通Ad入稿URL唯一来源与严格值比较；Survey仅类型适用性例外。',60:'100% Tracking集合与严格URL比较保留；其他地点/每点最多5条的完整校正规则仍缺。',
 67:'Dashboard指标无导出，仍D；FIX4-A已隔离报表G8/H8与真正CV业务行，不代表Dashboard实现。',
 69:'能识别city列；City Bulk操作/转换缺Master，操作流程不纳入自动功能分母；具体转换合并42/70。',
 70:'City名→代码缺Master与生产映射；和42合并为一个功能组，原记录不删。',
 73:'Media字段比较能力同39；Bulk最终后台状态/任意Local表达未全。',74:'61列读取可用；上传目标/执行完成和专用非61列格式不由工具证明，操作流程不计自动功能。',
 82:'FIX4-B已由真实Setting证据建新TAP Survey SP独立模型；普通与BLS并存；支持单CP/单Contact/N个显式Noncontact，缺条件给诊断，不由CSV数量补造。',
 83:'普通SP已有明确store_segment时可比较；缺Survey启用+SP包含条件→必须Scenario的跨字段检查。内存探针同时清空通常Setting/CSV Store与ASR后无对应entry/告警；不能计完整。',
 84:'普通0~C范围比较已修，尚缺Survey启用条件下的必须设置检查及CTV-only明确豁免联动；无强制拆GP。',
 85:'新TAP SP CP名/开始日/三日历月后结束已比；短月无同日→review，多Survey CP/多Contact无明确映射→诊断，故复合功能B。',
 86:'新TAP SP Register独立合同90000/1000/type2/status0/消化1；每字段负例检出；Edit无budget_type→不可用/review，非两Schema全部字段A。',
 87:'Survey report_target_flag=0有独立原始值比较、跨行冲突保护及横表列；普通CP不新增此项。',
 88:'用户确认Survey CV对象外；不继承通常CV、不生成entry。策略完成A，但不计自动比较。',
 89:'新TAP SP GP名/device/15秒/价格100/状态1正式比较，错值可见；仅Register有全字段，Edit视频不可用。',
 90:'复用正式Auction对象外，和36同政策；不因Survey手册示例恢复比较。',
 91:'Contact bid_segment明确Scenario，bid_segment_exclude空；gender/age/pref/annual_income/demography/affinity/DMP空契约可比。Contact非空ASR另为review，不是通用必须空判错。',
 92:'按设计计数与唯一Targeting引用生成，1/2/3 Noncontact正例及缺引用/重复/数量冲突负例；不固定两个GP。',
 93:'明确Targeting标签后缀已获用户确认并实现；无标签/冲突保守；“消化用GP”任意业务场景及多CP仍待确认。',
 94:'SP Noncontact允许字段按唯一引用继承，DMP ID/threshold可比；Affinity业务名称到ID未有可靠Master→review，其余未允许普通字段不直接复制。',
 95:'SP Noncontact bid_segment空、bid_segment_exclude=Contact ID、ASR D E F独立比较；错列/漏/多成员检出，重复/非法review。Contact空一致、有效或非法非空review，保留原文/来源及理由。',
 96:'白名单已阻止普通Media/Contents继承，但Survey合同未生成media/local_broadcaster/contents_group空值比较；CSV错填目前会漏检，仍B。',
 97:'Survey专用Creative按角色建Ad、唯一父GP匹配，跨GP同名不竞争；错名mismatch，父GP歧义不强配；Register状态/时间可比，Edit当前状态未确认。',
 98:'Survey Ad URL/Tracking正式对象外：即使CSV有值也不比较；普通Ad规则不变。不是已验证所有URL为空。',
 99:'Survey期间FQ一次/110天/全部CP需独立FQ配置证据，不能用三个月CP日期代替。',
 101:'Survey CTV未建Setting类型模型/实案验证；SP共通字段实现不可转记为CTV A。',102:'CTV文案/截图与版本优先级待业务确认。',103:'CTV Contact设备/名称分隔符待确认，SP android ios不可替代。',104:'CTV视频/CPM/status仍未建类型模型；字段存在不等实现。',105:'CTV段ID类型/角色未确认、未建立模型；不套SP。',106:'CTV非接触者设备文字矛盾待确认。',107:'CTV Noncontact类型实体未实现。',108:'CTV Noncontact include自身+exclude Contact未开发；SP Noncontact bid空不能复用成CTV规则。',109:'CTV Audience/DMP/Media/Contents/ASR适用性未完整确认且无模型。',110:'CTV专用Creative命名SP/CTV矛盾待确认。',111:'SP URL/Tracking政策不能证明CTV实体已解析/比较；CTV仍未实现。',112:'CTV FQ命名待确认且无FQ导出；保留原E，次级数据限制D。',113:'CTV FQ需独立导出，61列无法支持。',
};
const documentRows=new Set([1,2,3,4,7,8,11,22,30,55,61,64,68,72,77,81,100]);
const processRows=new Set([6,23,69,71,74,75,76]),policyRows=new Set([36,88,90,98]);
const groupMap={12:18,19:56,73:39,70:42};
const groupClass={18:'B',56:'A',39:'B',42:'C'};
const exactTestRefs={
 19:[['tver_check','Creative:.*(关联|素材名)|Creative 全角|A16 Compare:.*(Creative|ABC/abc)']],
 24:[['tver_check','A16 Compare:.*(Campaign|合法日期|非法日期)'],['tver_check','CPN-DTMATCH-FIX.*(不一致|一致)|A16 Compare:.*ABC/abc']],
 26:[['tver_check','C3-C3-Fix1.*(Campaign status|consumption_type|budget_type)'],['tver_check','C3-C3-Fix3.*(status|consumption|budget_type)|campaign_status|budget_type']],
 31:[['tver_check','matching.*(parent|父)|Matcher:.*(父|parent)|duplicate.*(parent|Parent)|同名但 entityKey|wrong.*parent|MULTIPLE_HARD'],['tver_fix4_b','parent scope|duplicate Campaign']],
 37:[['tver_check','NEW-FMT-DEVICE-(1|5|6)|OLD-FMT-DEVICE|空device|年齢_CTV']],
 40:[['tver_check','A17-3B.*(蓄積|retarget Compare|严格隔离|有效ID|Edit.*store|真实⑧|模板与CSV)']],
 51:[['tver_check','A17-3B.*(入札|retarget Compare|严格隔离|有效ID|真实⑧|模板与CSV)']],
 53:[['tver_check','A17-3A.*(视频|DMP)|DMP扩展']],
 56:[['tver_check','Creative:.*(关联|素材名)|Creative 全角|A16 Compare:.*(Creative|ABC/abc)'],['tver_check','同名但 entityKey|Ad.*(父|parent)|MISSING_CREATIVE']],
};
const fieldMap={24:'campaign_name start_datetime end_datetime budget',25:'cv_point',26:'campaign_status budget_type consumption_type',27:'daily_budget',29:'hourly_bid_weight',31:'campaign_name adgroup_name campaign_id adgroup_id',32:'adgroup_name',33:'adgroup_start_datetime adgroup_end_datetime',34:'daily_freq_cap',35:'tver_video_duration price adgroup_status',36:'auction_type',37:'device',39:'media local_broadcaster',40:'store_segment',41:'gender start_age end_age pref',42:'city',43:'affinity',44:'annual_income demography',45:'tv_usage_tendency carrier',46:'uid_suffix',47:'genre subgenre',48:'genre_exclude subgenre_exclude',49:'genre subgenre genre_exclude subgenre_exclude',50:'contents_group',51:'bid_segment',52:'bid_segment_exclude',53:'dmp_segment dmp_segment_expansion_threshold',54:'dmp_segment_exclude',56:'creative_name',57:'start_time end_time',58:'status',59:'url',60:'tracking_url_complete',69:'city',70:'city',73:'media local_broadcaster',74:'media local_broadcaster',83:'store_segment',84:'uid_suffix',85:'campaign_name start_datetime end_datetime',86:'budget daily_budget budget_type campaign_status consumption_type',87:'report_target_flag',88:'cv_point',89:'adgroup_name device price tver_video_duration adgroup_status',90:'auction_type',91:'bid_segment bid_segment_exclude gender start_age end_age pref annual_income demography affinity dmp_segment dmp_segment_expansion_threshold',94:'gender start_age end_age pref annual_income demography affinity dmp_segment dmp_segment_expansion_threshold',95:'uid_suffix bid_segment bid_segment_exclude',96:'media local_broadcaster contents_group',97:'creative_name status start_time end_time',98:'url tracking_url_complete'};
const priority={};for(const n of [83,84])priority[n]='P0';for(const n of [34,43,47,52,54,96])priority[n]='P1';
const rows=original.map((o,i)=>{
 const id=i+1,classification=changes[id]||o['分类'],pkey=byId[id]||'missing',p=profiles[pkey],policy=policyRows.has(id),isDoc=documentRows.has(id),isProcess=processRows.has(id),overview=id===5;
 const included=!policy&&!isDoc&&!isProcess&&!overview,group=included?(groupMap[id]||id):null;
 const active=['A','B'].includes(classification)&&!policy&&!isDoc&&!isProcess&&!overview;
 const rawOnly=classification==='C'||classification==='D'||classification==='E';
 let setting=p.setting||o['Excel来源'],csv=p.csv||o['CSV字段'];
 if(pkey==='missing'){setting=o['Excel来源'];csv=o['CSV字段']+'；尚无完整校正来源链';}
 let cp=typeof p.compare==='string'&&/^\w+$/.test(p.compare)?ref(p.compare):p.compare;
 let parser=/^\w+$/.test(p.parser)?ref(p.parser):p.parser;
 if(id===26)parser=ref('resolveTverCampaignContract');
 let tr=p.testFile?testRefs(p.testFile,p.test):pkey==='missing'||pkey==='doc'?p.test:testRefs(null,p.test);
 if(exactTestRefs[id])tr=exactTestRefs[id].map(([file,pattern])=>testRefs(file,pattern)).join('; ');
 if(policy&&id!==36&&id!==90)tr=testRefs('tver_fix4_b',id===88?'CV is out':'URL/Tracking exclusion');
 if(id===48)tr=testRefs('tver_check','FIX3 genre|A17-2');
 if(rawOnly){cp=(classification==='C'?'未生成本项比较entry；仅保留raw/字典不构成实现':classification==='D'?'无所需CSV/实体证据，无法自动校正':'完整业务规则/可靠来源未确认，保守提示不等于比较')+'；'+(id===29?'hourly_bid_weight仅review占位':'');if(![29,102,103,106,110,112].includes(id))tr='无该功能完整正反例闭环；现有通用/缺Master保护测试不能替代';}
 const scope=id>=101?'TVerSurvey CTV：DEFERRED；旧Survey：DEFERRED':id>=82&&id<=99?'新TAP TVerSurvey SP（详见本行边界）；CTV/旧Survey不适用':'通常配信；Survey SP仅在明确专用合同实现时适用；不宣称Survey CTV/旧系统';
 let schema=id>=82&&id<=99?'Register实案+负例；Edit仅存在列可比，缺列review；Survey规则不扩展CTV':'Register/Edit按各自列与来源读取；真实3案为Register，Edit证据限历史/合成测试';
 if([35,53,86,89,94,97].includes(id))schema+='；注意Edit无budget_type/tver_video_duration/dmp_segment，当前状态需可靠Setting';
 const fmt=id>=82&&id<=99?'新TAP Survey业务区已验证；不是旧Survey系统；旧FMT整体Survey无实案验收':'普通旧FMT/新FMT框架均有回归；本功能仅在相应格式有明确业务来源时可比较，未逐项声称所有布局均验证';
 const fields=(fieldMap[id]||'').split(' ').filter(Boolean);
 const schemaFields=key=>fields.length?fields.map(f=>f+':'+(evidence.schema[key].includes(f)?'列存在':'列缺失')).join('; '):'见原CSV字段列；无独立实体的功能不能凭近似列替代';
 return {...o,'记录ID':String(id).padStart(3,'0'),'原始分类':o['分类'],'截至FIX4B分类':classification,'当前业务范围':scope,'FMT范围':fmt,'Register_Edit范围':schema,
  'Register列实核':schemaFields('registerHeaders'),'Edit列实核':schemaFields('editHeaders'),
  'Setting来源核验':setting,'CSV来源核验':csv,'当前解析函数':parser,'匹配关系核验':active?(id>=82&&id<=99?surveyMatch:normalMatch):'无本项完整闭环/不适用；通用实体匹配不能代替字段实现',
  '比较规则核验':cp,'结果显示核验':active?display:policy?'无本项entry/横表/统计/Navigator；保留CSV原文':classification==='B'?display+'；只显示已实现子集/保守提示':'无本项有效自动校正显示；不得用空白假装完成',
  '正反例测试证据':tr,'测试用例摘要':testCatalog.filter(t=>tr.includes(t.file+':'+t.line+';')||tr.endsWith(t.file+':'+t.line)).map(t=>t.definition).join(' / ')||'无该功能闭环测试，不计已完整支持',
  '当前结论及边界':notes[id]||o['缺口'],'记录性质':policy?'正式对象外策略':isDoc?'说明/章节':isProcess?'操作流程':overview?'总览':'设置校正需求',
  '可校正统计纳入':included?'YES':'NO','去重功能组':group?String(group).padStart(3,'0'):'—','当前风险':priority[id]==='P0'?'高：实证漏检，后续单独修复':classification==='A'?'已验范围低；未确认边界仍保守':o['风险等级'],
  '建议优先级':isDoc||isProcess?'文档/人工操作核验':policy?'已完成对象外策略':priority[id]||(['A'].includes(classification)?'维护回归':'P2'),
 };
});
const counts=arr=>Object.fromEntries('ABCDE'.split('').map(k=>[k,arr.filter(x=>x===k).length]));
const rawCounts=counts(rows.map(r=>r['截至FIX4B分类']));
const activeRows=rows.filter(r=>r['可校正统计纳入']==='YES');
const groups=[...new Set(activeRows.map(r=>r['去重功能组']))].map(id=>{const members=activeRows.filter(r=>r['去重功能组']===id),main=rows[Number(id)-1];return{id,name:main['业务名称'],members:members.map(r=>r['记录ID']),class:groupClass[Number(id)]||main['截至FIX4B分类']};});
const groupCounts=counts(groups.map(g=>g.class));
assert.deepEqual(rawCounts,{A:27,B:22,C:16,D:42,E:6});assert.equal(activeRows.length,84);assert.equal(groups.length,80);assert.deepEqual(groupCounts,{A:22,B:18,C:15,D:19,E:6});
const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const cols=Object.keys(rows[0]);fs.writeFileSync(path.join(out,'TVER_FUNCTION_COVERAGE_20261021.csv'),'\uFEFF'+[cols.map(q).join(','),...rows.map(r=>cols.map(k=>q(r[k])).join(','))].join('\r\n')+'\r\n');
fs.writeFileSync(path.join(__dirname,'functional_groups.json'),JSON.stringify({originalCounts:counts(original.map(r=>r['分类'])),rawCounts,excluded:{documentation:[...documentRows],operations:[...processRows],overview:[5],policy:[...policyRows]},activeRecordCounts:counts(activeRows.map(r=>r['截至FIX4B分类'])),groupCounts,groups},null,2));
const table=(header,data)=>'| '+header.join(' | ')+' |\n| '+header.map(()=> '---').join(' | ')+' |\n'+data.map(r=>'| '+r.map(s=>String(s).replaceAll('|','／').replaceAll('\n',' ')).join(' | ')+' |').join('\n');
const write=(name,s)=>fs.writeFileSync(path.join(out,name),s.trim()+'\n');
const allMatrix=table(['ID / PPT页','业务','原→现','适用范围与当前缺口','后续'],rows.map(r=>[r['记录ID']+' / '+r['PPT页码'],r['业务名称'],r['原始分类']+'→'+r['截至FIX4B分类'],r['当前结论及边界'],r['建议优先级']]));
write('TVER_FUNCTION_COVERAGE_20261021.md',`
# TVer功能覆盖复核（2026-10-21，截至FIX4-B Contact ASR边界修正）

## 结论与计数

权威HTML SHA256：\`${evidence.authoritativeSha256}\`。本轮未改HTML/测试/业务输入。全套837/837通过；真人QA由用户报告，仅BENESSE_SURVEY_SP，不外推历史所有案件或CTV。

**经口径核实的80个设置校正功能组：完整实现22，部分实现18，CSV有数据但未比较15，CSV缺必要数据19，需要业务确认6。** 这是有范围限制的功能组计数，不是80个原子字段，不计算自动校正百分比。

${table(['口径','A 已完整自动校正（限定业务/Schema）','B 部分','C 有CSV未比较','D 无必要CSV','E 需确认','合计'],[
 ['原审计113条',15,21,28,42,7,113],['截至FIX4-B原113记录分类',27,22,16,42,6,113],['剔除非校正记录后84条',23,19,16,20,6,84],['归并重复后的设置功能组',22,18,15,19,6,80]])}

原始分类/原状态/原缺口均保留在CSV原列，新增当前分类和逐条证据；本MD表保留全部113项。原A包括“正式对象外”，因此当前原记录A27不能直接叫27项自动校正。每行A仅指列明范围内来源、匹配、规则、显示与正反例闭环；不是“所有FMT、Schema、设备与业务版本全覆盖”。遇未知来源/歧义继续review。

### 分母核实与重复处理

- 17条说明/章节：${[...documentRows].join('、')}。原分类D保留，不是HTML缺陷。
- 7条操作流程：${[...processRows].join('、')}。其中原69/74含字段读取能力但主要操作执行不可由输入CSV证明；设置值能力分别在42/39中记录。
- 1条总览：005（三层结构及其他账户实体），不当作独立字段重复计数。
- 4条正式对象外：036/090 Auction同政策，088 BLS CV，098 BLS URL/Tracking。4条/3个政策，完成但均不计自动比较。CSV原文保留与排除比较不矛盾。
- 113−17−7−1−4=84条设置需求；归并下列四对重复后80组。组合功能未拆成虚构原子能力，因此不提供简单覆盖率。

${table(['组','保留成员','统计分类','说明'],[['018','012+018','B','Ad素材名与关联已支持，全账户素材库存/重名缺数据'],['056','019+056','A','普通Ad Creative选择与父GP唯一关系'],['039','039+073','B','普通Media/Local含Bulk设置值，部分表达未全'],['042','042+070','C','同一City名称代码映射，缺权威Master']])}

所有80组成员及分类可机械复算：[functional_groups.json](evidence/functional_groups.json)。原113条CSV并未删改或跳项。

## 证据标准与适用边界

CSV逐条新增：Setting来源、CSV来源、解析函数、唯一匹配关系、比较规则、显示、正反例测试引用、业务/FMT/Schema边界、统计分组。函数行号以本次权威HTML为准，原CSV旧行号只作历史记录。通用字典、CSV字段名、display label或通用compareField存在，均不单独构成A证据。C/D/E没有闭环正反例时明确注明缺失。

${table(['范围','当前证据','不能扩大认定'],[
 ['通常配信旧FMT/新FMT','核心测试有旧/新FMT、Register/Edit、Device来源、Targeting、父子关系正反例；FIX4-A CV/日内时间/0~C回归','不能声称所有历史Excel布局和全部自由文本均支持'],
 ['新TAP Survey SP','可靠Setting启用+新TAP+SP设计→独立CP/GP/Ad；Benesse真实Register完整比较69项，负例测试保留','单CP/单Contact/N明确Noncontact；多CP/多Contact、自由Affinity、短月等边界保守'],
 ['Survey SP Register','真实Benesse与合成负例覆盖；CP9/GP48/Ad12项','不代表后台FQ/素材库存/其他61列外实体已验'],
 ['Survey SP Edit','61列识别及存在字段的比较/缺字段保守测试','没有真实Survey Edit验收；缺budget_type/video/DMP ID列不能假装空值一致；Ad当前状态review'],
 ['Survey CTV','仅检测后DEFERRED/诊断，原矩阵C/E/D保留','SP手机Device/名称/ASR/bid空规则不能套CTV'],
 ['旧Survey系统','未纳本次业务实现，DEFERRED','旧Excel FMT支持不等于旧Survey系统支持']])}

### 关键已修复与仍未完成

- CV：业务CV行与可靠ID范围读取；Register自身rawRows；集合比较，重复/非法/冲突不静默去重。BLS CV对象外。
- Ad时间：明确Targeting时间按父GP关联，每Ad分开start/end；未指定沿原默认，保留Airbnb真实结束时间差异。
- ASR：普通0~C、0~8、0のみ；SP Noncontact D E F；Contact空一致，任何非空review并保留证据/原因。旧FIX4-B报告“非空Contact不一致”已由边界修正报告和当前代码覆盖。
- Segment：普通指定bid_segment已支持；普通排除bid_segment_exclude未接线。Survey指定与排除独立比较，错列会检出。
- Genre/Subgenre：**除外已经实现**；指定include仍C，别名覆盖B。不得重复当作全未开发。
- SP白名单不会复制普通Media/Contents；但**不等于**CSV意外多填也能检出（096 B）。
- Survey启用时普通SP必须Scenario/ASR的完整性联动仍B：本轮只在内存清空普通Setting/CSV值，保留Survey与Scenario；结果无普通Store/ASR comparison entry，0不一致，未新增该项review。详见seal_verification.json的coverageGapProbe。该范围列入FIX4-C，不修改本次验收合同。

## 全113条复核矩阵

以下为逐条摘要；六段证据及全部原审计字段见同名CSV（UTF-8 BOM）。

${allMatrix}

## 留存证据

- [完整测试日志](evidence/full_regression.log)：837 tests /837 pass /0 fail /0 skipped；数量未改变。
- [当前真实案件+Schema+语法+覆盖探针](evidence/seal_verification.json)，[业务输入原件路径/SHA](evidence/input_manifest.json)。
- [原审计及开发报告副本清单/SHA](evidence/source_reports_manifest.json)；只复制报告，不复制/修改业务xlsx/CSV/PPT原件。来源旧报告中的待QA状态以本次用户验收及当前边界修正为准。
- [测试定义索引](evidence/test_definition_catalog.json)为源定义索引，含参数化用例定义，不能把索引条数误作执行测试数。
`);
write('TVER_FIX4_C_PRIORITY_PLAN.md',`
# TVer FIX4-C建议优先级（只提出计划，不开发）

基于既有71页审计113条、当前HTML和837项测试及本次只读案件重放。生产封板不等于全手册功能完成。以下普通/Survey SP/CTV范围分别立项，不以同名CSV列推定可用。

## P0：优先消除已有真实数据和明文规则下的漏检

### 建议FIX4-C首项：Survey启用时“通常SP配信的Scenario/ASR完整性”

- 对应083/084，P56；不是重写已完成的BLS GP。
- 证据：Benesse基本Surveyあり、新TAP、通常Targeting含SP，Scenario ID7550及ASR0~C有实际来源。当前只能比较已经明确登记的store_segment/uid_suffix；不会由Survey条件强制检验漏填。
- 只读负向探针：内存清空通常GP对应Setting与CSV Store/ASR，保留Survey设计、Scenario7550。当前普通两字段entry均未生成；仍0不一致/4原review，没有遗漏提示。业务原件、HTML、测试均未修改。证据seal_verification.json.coverageGapProbe。
- 最小建议：在现有普通GP比较输入生成前解析适用性：已确认新TAP SP启用+明确普通父CP+该GP Device含SP→要求与该Survey Scenario及0~C规则建立独立证据链；CTV-only明确豁免；Device未知/多Survey映射不唯一→review。Setting/CSV均漏值也应产生可见保守提示或已确认的缺失差异，不静默无entry。
- 不强行拆GP，不把普通CV/ASR复制到BLS Contact；保留Contact非空review规则。
- 开发前明确缺Setting值时的显示口径及父Survey关联，避免把“来源缺失”伪造成已知Setting原文；复用sourceEvidence记录手册与实际引用的派生值。
- 验收正负例：Survey开/关、新TAP开/关、SP/含SP/CTV-only、双边缺失/单边缺失、正确/错Scenario、错列bid/store、ASR漏/多/重复/非法、多CP映射冲突；AXA/Airbnb/Benesse837基线全部通过，真人确认新增提示。

## P1：CSV已有字段、业务依据清楚的能力补全

${table(['顺序/原记录','业务范围及目前状态','建议开发与前提','最低负例'],[
 ['1 /052','普通bid_segment_exclude=C；Survey SP已支持，勿重做','先取得普通配信非空真实Setting/CSV配对，增加可靠业务标签/ID读取，复用集合与独立字段比较；不套Survey固定Scenario','指定/除外互换、漏/多/错ID、重复、空/未知、父GP误关联'],
 ['2 /096','SP Noncontact Media/Contents白名单仅不继承=B','P61已说明不设置；先用已验SP契约对CSV已有media/local_broadcaster/contents_group明确空值检出。确认CSV字段中空与平台默认/无指定表达的等价关系后执行','意外多填、正常空、普通GP仍按原值比较、Edit缺列/冲突'],
 ['3 /047','普通genre/subgenre指定include=C；exclude048已A','增加指定模式Setting来源与权威字典映射，复用exclude架构但独立字段；不要把除外当指定','include/exclude互换、漏/多ID、未知/别名不明、顺序/重复'],
 ['4 /054','普通DMP除外=C','使用明确业务ID来源，不复制DMP include；真实非空样本+各Schema列可用性核实','include/exclude错列、错误阈值适用性、漏/多/非法ID'],
 ['5 /034','GP每日FQ default/明确设置=C','仅做CSV daily_freq_cap与明确GP规则；与期间FQ分开。先确认“不使用”对应CSV表示并取得真实值','default/0/空有别、非默认异常、不能把期间110天当每日FQ'],
 ['6 /043','普通興味関心=C；Survey选中业务文本review','有可靠ID或权威版本字典+业务槽后接线；自由文本/未知仍review。缺Master部分转P2','备注误读、同名多ID、漏/多ID、错父/错Targeting']])}

这些是P1候选，只有真实样本/权威规则/空值契约达标后才进入实施；仅有CSV列名不足。每次最小增量，复用同一HTML，独立Code Gate与真人验收。

## P2：先补业务确认/其他导出或新版本证据

${table(['记录/业务','当前缺口','下一步'],[
 ['050 コンテンツグループ；045 テレビ視聴傾向/Carrier','有CSV但普通Setting映射/版本化Master/有效业务样本未闭环','提供权威字段含义、ID映射、有效Setting槽及实案；不靠名称模糊'],
 ['042/070 City，039/073 Local/Media，049别名','City缺Master；Local子集/排除表达与别名证据不全','提供版本Master和明确默认/排除含义；保持未知review'],
 ['062/063/099/113 Campaign/Survey期间FQ','61列没有完整独立实体、期间、CP集合','取得FQ独立导出；普通daily_freq_cap不等同该功能'],
 ['078–080 Scheduler','没有未来执行时间/重复规则/对象/计划状态数据','定义Scheduler专用导出/后台证据与CP ID关联；当前daily_budget不能代替'],
 ['065–067 Dashboard','没有Dashboard实体、指标顺序与CP关系数据','专用导出或受控人工QA；不能以CV字段存在冒充'],
 ['101–113 Survey CTV；旧Survey系统','设备/命名/文字截图矛盾与版本角色规则未明；无已验类型模型','独立确认、实案与版本契约；禁止直接套SP android ios/ASR/bid空'],
 ['085/093 Survey日期与多CP/多Contact/任意后缀','短月无同日、父子角色/引用不唯一','确认月末算法及明确映射表；现有review/诊断不强配'],
 ['094 Affinity自由文本；058/097 Edit Ad状态；计划Ad','缺权威ID或当前状态来源/生命周期规则','保留保守原因，取得业务来源后扩展；不删除计划Ad'],
 ['027/029自动日均与小时分配；060其他Tracking地点','Setting时点/完整合同或标签规则不全','确认真实来源/默认/上限及原始CSV字段，先补证据'],
 ['账户/素材库存/Transcode/Companion/视频实际规格','61列没有必要实体和属性','需要其他导出或人工QA，不判现有HTML缺陷']])}

## 后续验证与业务问题

1. Contact非空ASR继续review，不自动一致也不强判错误；仅空本案可比较。需要业务决定时独立变更合同。
2. Survey CTV的设备、命名、文字/截图优先级及旧系统Segment类型需分版本确认；不阻断已有新TAP SP规则。
3. SP短月/多CP/多Contact、自由Affinity Master、Edit当前Ad状态、无明确分支标签须明确实际输入。
4. 两个计划Ad继续review；不能凭当前CSV缺少就忽略或强配。
5. 真正缺CSV的FQ/Scheduler/Dashboard需先确定导出方案；普通字段补齐与这些实体功能分开估算。

后续每项TDD正负例、完整837历史基线及新增测试、三真实案件逐字段对比、61列Schema/Auction排除/Navigator验证，再做针对性真人QA。本轮未新增或修改测试、未开发FIX4-C。
`);
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'workspace_before.json'),'utf8'));
const unchanged=before.map(b=>({...b,afterSha256:hash(b.path)}));assert.ok(unchanged.every(b=>b.sha256===b.afterSha256));
fs.writeFileSync(path.join(__dirname,'workspace_unchanged.json'),JSON.stringify({checkedFiles:unchanged.length,allUnchanged:true,files:unchanged},null,2));
const finalGate={task:'TVER_FIX4_B_FINAL_SEAL_GATE',BASELINE_SHA_MATCH:'YES',REAL_GUI_QA:'PASS_USER_REPORTED',REAL_GUI_QA_SCOPE:'BENESSE_SURVEY_SP',FULL_REGRESSION:'837/837 PASS (fail 0, skip 0)',AXA_REGRESSION:'PASS',AIRBNB_REGRESSION:'PASS',BENESSE_REGRESSION:'PASS',SURVEY_SP_REGRESSION:'PASS',AUCTION_EXCLUSION:'PASS',SCHEMA_REGRESSION:'PASS Register61/Edit61',PRODUCTION_HTML_UNCHANGED:'YES',FINAL_SHA256:hash(path.join(root,'tver_check.html')),SEALED:'YES',meaning:'本地候选冻结与报告归档；没有Commit/Push/上线；不代表71页所有功能已实现',snapshot:'evidence/tver_check.sealed.html',snapshotSha256:hash(path.join(__dirname,'tver_check.sealed.html'))};
assert.equal(finalGate.FINAL_SHA256,finalGate.snapshotSha256);fs.writeFileSync(path.join(out,'SEALED_VERSION.json'),JSON.stringify(finalGate,null,2));
const cases=Object.entries(evidence.cases).map(([n,c])=>[n,c.summary.parsedCounts.setting.Campaign+'/'+c.summary.parsedCounts.setting['Ad Group']+'/'+c.summary.parsedCounts.setting.Ad,c.summary.parsedCounts.csv.Campaign+'/'+c.summary.parsedCounts.csv['Ad Group']+'/'+c.summary.parsedCounts.csv.Ad,JSON.stringify(c.summary.matchedCounts),Object.values(c.summary.statusCounts).join(' / ')]);
write('TVER_FIX4_B_FINAL_SEAL_REPORT.md',`
# TVER_FIX4_B_FINAL_SEAL_GATE

${Object.entries(finalGate).filter(([k])=>/^[A-Z_0-9]+$/.test(k)).map(([k,v])=>k+' = '+v).join('\n\n')}

REAL_GUI_QA_SCOPE = BENESSE_SURVEY_SP。用户报告已用真实Chrome验收：一致（含表記ゆれ一致）123 /不一致0 /要確認4，Campaign2/2、GP5/5、Ad7/7。本轮没有操作Chrome；PASS只代表该案件范围，不扩大到全部历史案件或CTV。

## 冻结含义与范围

原位置tver_check.html保持权威SHA；另留同字节冻结副本evidence/tver_check.sealed.html与SEALED_VERSION.json，可核对后续变动。SEALED=YES仅指本地已验候选冻结、回归与报告完成，不表示Commit、Push或上线，也不是把全部手册覆盖缺口标成PASS。

本轮仅写本目录审核文档/证据/生成脚本；HTML、测试、业务原件及其他已跟踪项目文件均未改。工作树既有的其他媒体及历史未提交修改保留；没有stage、commit、push。进入时工作区已非干净状态，不能把当前git diff全算作本轮工作。

## 新鲜执行证据

完整命令（项目目录运行）：

\`\`\`powershell
node --test ${tests.map(t=>'tests/'+t).join(' ')}
\`\`\`

结果837/837 PASS，fail0/cancelled0/skipped0/todo0；测试总数与基线相同，本轮无新增/删改/skip任何测试。[完整输出](evidence/full_regression.log)。

补充只读校验：node docs/tver/release-review/20261021_FIX4_B_FINAL/evidence/verify_seal.js。实际SheetJS读取原件，正式production parser/matcher/comparison/horizontal pipeline；Register/Edit headers均61且保留auction_type；三个真实案件auction entries均0；所有非空inline script可编译。没有修改Schema或数据来取得PASS。

${table(['案件','Setting CP/GP/Ad','CSV CP/GP/Ad','Matched','一致/表記ゆれ/不一致/要確認/未匹配'],cases)}

Benesse横向实体数2/5/9，Setting两计划Ad继续review，实际CSV7个Ad匹配7个。Survey SP独立1CP/3GP/3Ad，69项比较=CP9+GP48+Ad12，61一致+8表記ゆれ，0不一致/0要確認。其余通常配信仍4要確認：daily_budget、hourly_bid_weight和2个未取得正式filename的计划Ad，未删/强配。

AXA两项真实Device差异保留：興味関心_DMP_CTV，Setting ctv /CSV空；年齢_CTV，Setting ctv /CSV android ios pc。Airbnb六项真实差异保留：2Device、2DMP阈值10对50、1Ad状态1对0、1结束时间23:59对23:45。FIX4-A CV225/226/227/228/229、通常4Ad明确6:00–23:59、ASR0~C回归通过。

Contact ASR边界回归：空一致，D E F/0 1 2/非法非空review；Noncontact D E F正常、错值不一致；普通0~C表記ゆれ一致。原始值、来源、保守原因保留。当前规则覆盖旧FIX4-B报告的“Contact非空直接不一致”文字。

## 全部Gate的实际边界

- AXA/Airbnb/Benesse：本轮自动真实文件重放；真人PASS只用户指定Benesse SP。
- 新旧FMT、Register/Edit：837套件覆盖。三件真实案件都是Register；不虚称已有真实Survey Edit/CTV验收。
- Auction：输入阶段不生成entry，非CSS隐藏，Schema保留raw。
- Schema：61/61识别不表示每列都在比较；缺列/未知值保持保守。
- Navigator：5项专用测试及横表/字段显示测试PASS，review不入mismatch导航。
- 本地冻结不扩展功能范围：覆盖报告仍明确普通Bid Exclude、include genre、Affinity等缺口；SP/CTV/旧Survey分开。

## 完整性与审计资产

- [原件路径及SHA](evidence/input_manifest.json)：沿用此前核实同版本6件xlsx/CSV与手册，全部hash重验，不凭空改路径。
- [三个真实案件/Schema/inline语法/内存覆盖探针](evidence/seal_verification.json)。探针只记录现有漏检范围，没有新断言、没有改统计，也不将未实现功能PASS。
- [工作区进入快照](evidence/workspace_before.json)、[${unchanged.length}个受保护文件未变化核验](evidence/workspace_unchanged.json)；包括全部跟踪文件与未跟踪TVer测试。
- [覆盖总报告](TVER_FUNCTION_COVERAGE_20261021.md)、[113条完整CSV](TVER_FUNCTION_COVERAGE_20261021.csv)、[FIX4-C优先计划](TVER_FIX4_C_PRIORITY_PLAN.md)。
- [历史审计/后续报告副本与SHA](evidence/source_reports_manifest.json)。交付不再仅在临时visualizations中。

## 待办与停止点

推荐FIX4-C先补Survey启用时通常SP Scenario/ASR完整性漏检；普通Bid Segment Exclude和SP意外Media/Contents可作为后续窄范围项目。CTV、旧Survey、FQ/Scheduler/Dashboard仍需专门证据。G105模板问题和通用Group模糊名称扩展仍DEFERRED。

已停在Final Seal Gate。没有开始FIX4-C，没有修改任何业务逻辑。
`);
console.log(JSON.stringify({generated:4,originalRows:rows.length,rawCounts,settingRecords:activeRows.length,functionalGroups:groups.length,groupCounts,protectedFiles:unchanged.length,htmlSha256:finalGate.FINAL_SHA256,sealed:finalGate.SEALED}));
