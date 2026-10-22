# FIX4详细开发规格（只读设计，尚未实施）

## 0. 基线、边界与架构

当前候选FIX3 SHA256：C8B4594C6EFEAC8F0DC5095ECD5F3D6C0F6437F496903F0CF020E1B0A72EFD13。739项历史回归本轮全部PASS。源代码、测试及业务文件本轮均不修改。

继续使用tver_check.html同一页面和既有parse → entity → parent-first matching → comparison inputs → entries → displayTree/horizontal → Navigator/summary流程。普通Campaign与Survey Campaign是同一层级的不同业务类型，Survey解析/期望契约应隔离，后续通用匹配与展示可复用。不要重建独立HTML或把Survey全量字段塞入通常默认规则。

所有新增期望值必须有明确Excel或规则来源，保留原始值、file/sheet/cell、derivedFrom、ruleId与可比较状态。只读审计发现“CSV有列/原始证据有值”不等于当前实体字段/比较项有值。

保留：AXA FIX1窄身份范围、FIX2 Auction正式排除、FIX3 Device与URL独立比较、预算跨行归集、fullwidth Targeting号关联、唯一性/候选冲突/父未匹配保护。禁止Benesse/4877公司或案件白名单，禁止泛化模糊名称。

下述新函数名均为**拟新增接口**，不是已存在的实现。

## FIX4-A：CVポイント最小修复

### A1. 允许修改的接点

1. parseTverSettingWorkbook中CV契约读取：改为在“★基本情報”边界内、精确成对查找CV和CVポイント。不要更改findSettingPairValue所有其他调用的行为。适合新增parseTverCvContractFromBasicSection(rows)。
2. 新增parseTverCvPointSet(raw, sourceKind)：把ID解析与比较分离。
3. 新增readTverCampaignCsvEvidenceField(entity, schemaKind, field)：只在比较阶段从该Campaign自己的rawRows/sourceEvidence取得CV字段并检查跨行一致性；Register不要向campaignFields/matchingFields插入cvPoint，否则会改变signature/实体聚合。Edit按本schema显式取证，不使用camel||snake猜测。
4. resolveTverCampaignContract('cv_point')返回原始值、canonical ID set、CV模式、evidence state和规则；buildRunFromModels传入settingCanonical/csvCanonical并继续使用既有compareField。
5. normalizeComparisonValue已优先接受显式canonical，优先复用此接口，无需重构共享normalizer。若有CV专用分支，只处理已声明的ID集合语法，不在通用函数中扫描整表或任意提数字。
6. 不改Campaign身份、Grouping、rowLedger、匹配候选或其他字段sourceRefs。CV异常不得改变CP/GP/Ad匹配数量。

### A2. 取证与完整解析

- Benesse权威模式是B18/C18=CV/あり；G8/H8为报表指标，必须排除。
- Setting支持：纯数字单ID；纯ID列表；每行“说明：ID/说明:ID”并以该行结尾的明确ID。纯ID列表分隔可先支持空白、换行、逗号、日文逗号；只有明确的全角数字表记可按规则NFKC归一。
- 禁止用全局/\d+/g从自由描述中抽数字，避免把“30日”“25歳”等当CV ID。范围、URL数字、未闭合说明、混有无法解释业务行均为需确认，不能只取成功解析的一部分。
- canonical为去重后的稳定排序ID字符串；用字符串排序键而非JavaScript Number避免大ID精度问题。前导零是否同义未明确前不自动消除。
- CSV只接受纯ID列表，不从自由文本中猜ID。保留原始字符串及重复token信息。
- 同一Register Campaign的多行CV证据按canonical集合收敛：只是顺序/重复差异可一致；不同集合、空/非空混合或非法token均为CV_CSV_FIELD_CONFLICT/需确认。不得首行、首个非空或最后一行覆盖。若业务确认空行表示继承，可另行明确此例外。
- sourceRefs所选原文必须与entry.rawValue一致；同时保留所有sourceEvidence。禁止出现当前“entry CSV空白，但evidence原文是225…229”的断点。
- 解析失败不等于ID不存在；这里不建立任意CV平台库存字典，也不声称校验ID是否真的在该广告主下有效。

### A3. 判定真值表

| CV模式/Setting证据 | CSV | 结果 |
|---|---|---|
| あり，完整有效ID集 | 完全相同原文 | 一致 |
| あり，完整有效ID集 | 同一集合，说明/顺序/重复/空白不同 | 表記ゆれ一致，原文仍显示 |
| あり，完整有效ID集 | 漏ID/多余ID/完全不同有效集合 | 不一致；明示missing/extra |
| あり，完整有效ID集 | 空 | 不一致，不伪装为无证据 |
| あり，Setting ID空或提取不完整 | 任意 | 需确认 |
| なし且Setting无ID | 空 | 一致；显示なし语义 |
| なし且Setting无ID | 有效非空ID集 | 不一致 |
| なし但Setting仍有ID | 任意 | 需确认/SETTING_CV_CONTRADICTION |
| CV模式未知/多处业务值冲突 | 任意 | 需确认，不从报表CV列推断 |
| 任一侧非法ID/同CP跨行集合冲突 | 任意 | 需确认，保留错误token及source |
| Survey类型未声明CV策略 | 任意 | 不继承通常CP；单独记录策略待确认 |

重复ID本身没有集合差异，保留informational诊断，不能通过普通validationIssues把语义一致又推成需确认。未知token仍为需确认。

### A4. 自动验收用例（将来实施时）

CVあり/なし、单ID、多ID、不同顺序、重复、漏ID、多余ID、未知语法、Setting有CV而CSV空、Setting无ID、CV模式冲突、重复“CV”标签（G8/H8与B18/C18）、Register真实SheetJS读档、多CSV行一致/冲突、Edit读字段、多CP隔离、通常与BLS隔离。所有sourceRefs/聚合signature及匹配数量保持。

Benesse正常CP的225–229应从误报不一致改为表記ゆれ一致；不是通过改CSV或扣统计达成。单做A阶段，四个Ad时间误报、ASR和BLS缺口仍存在，不可宣称整案通过。

## FIX4-B：TVerSurvey SP业务支持

### B1. 启用和版本

拟新增parseTverSurveySection及buildTverSurveySpEntities。使用★基本情報的TVerSurvey有无、★TVerSurvey区块、明确SP/新TAP字段共同判断。
- 本案C15あり，C150新TAPあり，B152 SP；C162旧SPなし、C168 CTVなし。
- 有启用但缺区块/日期/段ID/角色名称 → 明确需确认，不生成伪完整模型。
- 无启用但区块有有效业务内容 → 冲突需确认。
- 旧系统占位VAST模板、公司登记○、【BLS】前缀或CSV存在BLS都不能单独启用。
- 新TAP SP与旧BLS/CTV分别记录版本，未经实案和业务确认不混用bls_*字段。
- 普通Campaign与BLS Campaign并存于campaigns数组；附加内部businessType与surveyKey，不让通常全局CV/预算/URL默认流入Survey。

### B2. 声明计划与普通CP/Targeting关联

读取G145:H148的CP/Contact GP/Noncontact GP/FQ数量和I147的Targeting引用。数量是验证条件，不是凭空造N个空对象的依据。
- 本案Survey CP1、Contact GP1、Noncontact GP2；非接触者引用Target1和Target2(扩张50)。要生成3个GP，不固定2GP。
- 用同工作簿明确普通CP业务身份和Targeting号进行关联，禁止仅公司名、编号、CSV数量猜配。
- 多普通CP/多Survey/多Contact情形必须有对应来源；唯一关联不能证明时PARENT_NOT_UNIQUELY_MATCHED/需确认。
- Noncontact的精确后缀“子あり/DMP”命名与分支关联，需要确认通用规则或新增明确Excel字段。不能把本案CSV名称直接当Setting期望，也不能把DMP GP一律当“消化用不要”删除。
- 只在计划引用和数量都明确时生成；缺来源时留完整诊断及待关联计划。

### B3. Survey Campaign期望契约

| 字段 | SP期望 | 依据/限制 |
|---|---|---|
| campaign_name | 【BLS】发注CP名(_问卷名)_SP_yymmdd-mmdd | P57；普通CP、问卷、SP、开始/结束来源完整后按批准规则生成；H156单日期运营提示不等于完整权威名 |
| start_datetime | 问卷开始日00:00 | C147/P57；本案2026/12/21 |
| end_datetime | 3个日历月后23:45 | 本案2027/3/21；月末/闰年/短月规则须确认，不能换成90天或FQ110天 |
| budget | 90000 | P57明文，Survey适用性证据完整 |
| daily_budget | 1000 | P57明文，不继承通常分周预算193629 |
| campaign_status | 0 | 停止，P57明文 |
| budget_type | 2 | 期间预算；Edit缺此列则Schema unavailable，不误报 |
| consumption_type | 1 | Flat，P57 |
| report_target_flag | 0 | P57含めない；通常CP政策1另分支处理 |
| cv_point | 独立策略待确认 | 本案CSV空、手册截图空但文字没明写CVなし；不继承普通225–229 |

手册P57/P65截图与文字在状态、日预算、结束时间有差异；开发前确认正式文字优先级，报告中的数值方案依据文字+本案CSV，不把截图矛盾藏掉。

report_target_flag使用A阶段同类的Campaign级raw evidence reader，显式0不能被truthy默认1覆盖；生成正式entry后接入横表字段顺序与现有label，移除现有显示排除。不是只加CSS或单独统计。

### B4. SP Survey GP字段白名单

| 字段组 | Contact | Noncontact（每个显式Targeting分支） |
|---|---|---|
| identity | 已唯一匹配Survey CP + Contact角色 + 明确命名证据 | 已唯一匹配Survey CP + Noncontact角色 + 明确Targeting分支身份 |
| 视频/价格/状态 | 15秒带 / 100 / 1 | 15秒带 / 100 / 1 |
| Device | ios android | ios android |
| bid_segment | Contact段ID7550 | SP手册未要求，不能复制通常Bid；空值严格策略待确认 |
| bid_segment_exclude | 不复制普通排除；角色策略明确后比较 | Contact段ID7550 |
| Audience/DMP | 不设置（P59）；不复制通常Targeting | 只从明确引用的Targeting复制允许的Audience及DMP/扩张 |
| ASR | 不继承普通0-C；Contact策略明确后处理 | D E F（P61、Setting备注） |
| media/contents | 不自动复制普通设置 | P61明确不设置，即使普通有指示 |
| auction_type | 正式对象外 | 正式对象外 |

本案两个Noncontact：
- Target1：25–44岁、子あり；没有DMP。
- Target2：25–44岁、DMP7541、扩张50。
二者均排除Contact7550、ASR D E F、Device android ios。不能整块复制通常GP的store_segment7550、媒体、Contents、Device pc或正常投放ASR0-C。

### B5. ASR与Bid Exclude

- ASR显式序列限定0 1 2 3 4 5 6 7 8 9 A B C D E F，支持0~C/0～C/0-C等经批准表示以及D,E,F/空白集合；保持原始字面。
- 漏/多token必须不一致，未知G或反向/不明确范围需确认。范围正规化不等于允许任意字母/自由文本。
- 普通SP包含GP仍需Scenario Contact段与ASR0-C；CTV-only普通GP不因SP Survey规则而被强制拆设备/追加Scenario。以Setting权威设备判断适用性，不以CSV错误值决定是否比较。
- 通常GP现有store_segment7550比较可复用。bid_segment_exclude新增精确Setting字段映射/源索引、Register/Edit按schema读字段、ID集合解析和比较、label/横表顺序；与bid_segment绝不混用。
- 角色策略的明确空集合也要有来源，避免“只在两边都有值时才比较”掩盖CSV漏值或多填值。

### B6. Survey Creative与Ad

建立独立Survey Creative索引，读取C157/C158显式名称，保留D157/D158后台ID作为原始证据；不恢复creative_id校正。E152/E153的VAST链接不能当成Ad url/tracking。
- 每个已声明Survey GP下生成对应角色Ad。本案Contact1+Noncontact2→3 Ads，但只有2种Creative名称，非接触者两GP合法共用一名。
- 匹配先唯一父GP，再归一后的明确Creative名；同父重复候选保留MULTIPLE_HARD_CANDIDATES，重复占用保留CANDIDATE_CONTENTION，父不唯一保留PARENT_NOT_UNIQUELY_MATCHED。
- 角色、分支或命名证据不足时保留需确认。Device/价格/ASR/URL/状态等可校正值不能通过值一致才决定唯一Ad身份。
- Survey URL/Tracking免设置：独立not_required策略，不调用通常LP fallback，不强造Setting URL。CSV为空不产生“缺少URL”误报。CSV额外填值允许/错误/对象外，等待业务确认后制定；确认前保持可见原始证据/策略待确认，不自动判不一致或删除字段。
- Register Ad状态默认1复用FIX3；如有明确停用指示需独立例外政策。Edit不扩大未确认默认。

### B7. 模型与显示验收目标

在多非接触者命名、计划Ad处理等必要规则确认后，本案完整声明模型应是：
- 通常1CP/2GP/6Ad（包含2个缺文件名计划Ad）+Survey1CP/3GP/3Ad=Setting2CP/5GP/9Ad。
- CSV仍2CP/5GP/7Ad；可靠匹配目标2CP/5GP/7Ad，另2个计划Ad留在需确认/待建证据中。不得为了显示“7/7”把Setting Ad直接裁成7。
- 若业务正式确认当前快照排除未来计划，须把2个对象保留为独立计划待办并声明scope，不能删除；当前业务未批准该例外。
- displayTree和横表必须按实体key列出一致数量，显示通常/Survey及Contact/Noncontact业务角色；不重复生成CSV侧孤立影子；不以同名Creative去重跨父Ad。
- 所有统计/Navigator/导出只消费正式entries，比较修复阶段从输入生成接线，禁止手工调统计。
- BLS CP缺一个、一个GP缺、一个Ad缺、同角色重复、跨CP候选、同名跨父、字段变异等都必须有保守且可追踪结果。

## FIX4-C：71页遗留功能计划

### C0：先去掉本案明确误报与状态盲点

1. 显式Ad时间：新增Targeting“時間指定”来源，规范6:00~23:59。继承到该Setting GP下Ad，必要时允许更明确Ad指示覆盖；多处冲突需确认。没有显式指示才用00:00/23:59默认，CSV空值按既有规则处理，不全局改成6:00。时间变更不改identity/GP签名。
2. Ad停用备注：P32/P35“ADステータスオフ”当前未处理。先确认与计划未来启用的规则，再只作用于对应Ad；不要误用GP初动OFF或从Scheduler日期猜当前状态。
3. 计划Ad保留，明确快照范围、稳定Creative身份与生命周期；无ID时继续需确认，不能强配到同父别的素材。

### C1：现有CSV可以承载的Targeting校正

按实际业务量与风险依次接入：bid_segment_exclude/ASR在4-B；DMP Exclude；兴趣affinity；genre/subgenre include及手册明确别名；City master；tv_usage_tendency/carrier；contents_group；GP名称完整规则；broadcast名称/排除/Local子集；daily_freq_cap与hourly_bid_weight明确契约。

每项必须具备Setting权威source、CSV字段语义、未知值行为、Register/Edit映射、空值/集合/冲突保护，之后才接入通用entries。存在字典不等于已经比较。

### C2：缺少CSV证据的独立实体

FQ、Scheduler、Dashboard、账户、素材/Companion/ADCAS/Transcode/分辨率等先定义额外输入的导出合同或真人证据清单。仍使用同一页面的模块，不另写HTML。
- Campaign FQ：实体ID/名称/状态/CP ID集合/频次/类型/期间/次数。GP daily_freq_cap不能替代。
- Scheduler：名称/目标CP或Ad ID/动作/状态/日期时间/重复星期/预算。当前CP daily_budget不是未来Scheduler证明。
- Dashboard：名称/状态/CP集合/指标与顺序。G8/H8“CV”报表信息不能当CP的CV启用。
- Creative库存：素材/Creative/Companion关联、文件元数据、审核、ADCAS、transcode。Ad url不能代替Creative LP。
缺少后台证据的字段显示“本CSV无法验证/需人工证据”，不生成伪PASS或将其算成实际业务差异。

### C3：CTV Survey

P66/P68写CTV但设备为SD iOS/Android；P66缺_；P70/P71模板_SP_而截图/章节CTV。CTV Case当前未提供。先完成BUSINESS_CONFIRMATION_REQUIRED清单，再另开明确CTV合同与真实回归，不能把SP模板机械替换为CTV。

## 开发完成的强制退出条件

- 每阶段有独立Code Gate；A可以独立交付，但不得宣称B/C已支持。
- 完整739项原基线回归不得删用例、skip或变造数据；新增用例后总数增加需说明。只允许更新确因已批准业务规则变化而失效的相关断言，并逐条记录。
- Benesse、AXA、Airbnb都通过真实SheetJS路径；列出每个统计变化的字段原因，不能固定总数作目标。
- 新/旧FMT、Register/Edit、正常/Survey并存、多CP、多GP、重复/候选竞争、Device变异、URL、Tracking、CR、Navigator、reset/read race全部回归。
- AXA GP10/10 Ad10/10及两项Device差异；Airbnb CP3/3 GP6/6 Ad6/6、六项真实差异均保留。
- auction_type entries继续0；61列Schema及原始数据不变。
- 源与输入SHA、diff范围、inline JS、code review、真人GUI QA均有记录，开发不在本轮执行。

