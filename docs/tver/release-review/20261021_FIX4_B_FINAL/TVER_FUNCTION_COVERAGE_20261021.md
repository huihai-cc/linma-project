# TVer功能覆盖复核（2026-10-21，截至FIX4-B Contact ASR边界修正）

## 结论与计数

权威HTML SHA256：`CA3D99E13F6B64A1604C669A3AE51DD78EB037CADF1F04E362D43BF767519DD6`。本轮未改HTML/测试/业务输入。全套837/837通过；真人QA由用户报告，仅BENESSE_SURVEY_SP，不外推历史所有案件或CTV。

**经口径核实的80个设置校正功能组：完整实现22，部分实现18，CSV有数据但未比较15，CSV缺必要数据19，需要业务确认6。** 这是有范围限制的功能组计数，不是80个原子字段，不计算自动校正百分比。

| 口径 | A 已完整自动校正（限定业务/Schema） | B 部分 | C 有CSV未比较 | D 无必要CSV | E 需确认 | 合计 |
| --- | --- | --- | --- | --- | --- | --- |
| 原审计113条 | 15 | 21 | 28 | 42 | 7 | 113 |
| 截至FIX4-B原113记录分类 | 27 | 22 | 16 | 42 | 6 | 113 |
| 剔除非校正记录后84条 | 23 | 19 | 16 | 20 | 6 | 84 |
| 归并重复后的设置功能组 | 22 | 18 | 15 | 19 | 6 | 80 |

原始分类/原状态/原缺口均保留在CSV原列，新增当前分类和逐条证据；本MD表保留全部113项。原A包括“正式对象外”，因此当前原记录A27不能直接叫27项自动校正。每行A仅指列明范围内来源、匹配、规则、显示与正反例闭环；不是“所有FMT、Schema、设备与业务版本全覆盖”。遇未知来源/歧义继续review。

### 分母核实与重复处理

- 17条说明/章节：1、2、3、4、7、8、11、22、30、55、61、64、68、72、77、81、100。原分类D保留，不是HTML缺陷。
- 7条操作流程：6、23、69、71、74、75、76。其中原69/74含字段读取能力但主要操作执行不可由输入CSV证明；设置值能力分别在42/39中记录。
- 1条总览：005（三层结构及其他账户实体），不当作独立字段重复计数。
- 4条正式对象外：036/090 Auction同政策，088 BLS CV，098 BLS URL/Tracking。4条/3个政策，完成但均不计自动比较。CSV原文保留与排除比较不矛盾。
- 113−17−7−1−4=84条设置需求；归并下列四对重复后80组。组合功能未拆成虚构原子能力，因此不提供简单覆盖率。

| 组 | 保留成员 | 统计分类 | 说明 |
| --- | --- | --- | --- |
| 018 | 012+018 | B | Ad素材名与关联已支持，全账户素材库存/重名缺数据 |
| 056 | 019+056 | A | 普通Ad Creative选择与父GP唯一关系 |
| 039 | 039+073 | B | 普通Media/Local含Bulk设置值，部分表达未全 |
| 042 | 042+070 | C | 同一City名称代码映射，缺权威Master |

所有80组成员及分类可机械复算：[functional_groups.json](evidence/functional_groups.json)。原113条CSV并未删改或跳项。

## 证据标准与适用边界

CSV逐条新增：Setting来源、CSV来源、解析函数、唯一匹配关系、比较规则、显示、正反例测试引用、业务/FMT/Schema边界、统计分组。函数行号以本次权威HTML为准，原CSV旧行号只作历史记录。通用字典、CSV字段名、display label或通用compareField存在，均不单独构成A证据。C/D/E没有闭环正反例时明确注明缺失。

| 范围 | 当前证据 | 不能扩大认定 |
| --- | --- | --- |
| 通常配信旧FMT/新FMT | 核心测试有旧/新FMT、Register/Edit、Device来源、Targeting、父子关系正反例；FIX4-A CV/日内时间/0~C回归 | 不能声称所有历史Excel布局和全部自由文本均支持 |
| 新TAP Survey SP | 可靠Setting启用+新TAP+SP设计→独立CP/GP/Ad；Benesse真实Register完整比较69项，负例测试保留 | 单CP/单Contact/N明确Noncontact；多CP/多Contact、自由Affinity、短月等边界保守 |
| Survey SP Register | 真实Benesse与合成负例覆盖；CP9/GP48/Ad12项 | 不代表后台FQ/素材库存/其他61列外实体已验 |
| Survey SP Edit | 61列识别及存在字段的比较/缺字段保守测试 | 没有真实Survey Edit验收；缺budget_type/video/DMP ID列不能假装空值一致；Ad当前状态review |
| Survey CTV | 仅检测后DEFERRED/诊断，原矩阵C/E/D保留 | SP手机Device/名称/ASR/bid空规则不能套CTV |
| 旧Survey系统 | 未纳本次业务实现，DEFERRED | 旧Excel FMT支持不等于旧Survey系统支持 |

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

| ID / PPT页 | 业务 | 原→现 | 适用范围与当前缺口 | 后续 |
| --- | --- | --- | --- | --- |
| 001 / 1 | 手册版本/封面 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 002 / 2 | 构成/目录 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 003 / 3 | Slack依赖、纳期、问询 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 004 / 4 | 配信構造章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 005 / 5 | CP/GP/Ad三层与完整业务层级 | B→B | 通常三层+新TAP Survey SP三层已建模；账户/素材库存/FQ/Dashboard并未变成三层CSV可证数据。 | P2 |
| 006 / 6 | 注册→CP→GP→Ad→FQ→Dashboard→Scheduler流程 | D→D | FQ/Dashboard/Scheduler及操作执行状态无下载证据 | 文档/人工操作核验 |
| 007 / 7 | 設定方法章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 008 / 8 | アカウント选择章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 009 / 9 | 广告会社ID/账户选择 | D→D | 需要带Account/Agency ID的独立导出；名称不能代替ID | P2 |
| 010 / 10 | 广告主ID/账户选择 | D→D | 无法凭文件名证明上传到正确广告主账户 | P2 |
| 011 / 11 | クリエイティブ登録章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 012 / 12 | 视频文件取得/重名检查 | D→D | 素材名/Ad关系可读；不能证明全账户无重名或文件已取得。 | P2 |
| 013 / 13 | 视频素材名、状态、VAST上传类型 | B→B | 已比所选Ad Creative名；素材库存状态/VAST上传类型无证据。 | P2 |
| 014 / 14 | 入稿规格、分辨率与可投设备 | D→D | 1920x1080/1280x720、CTV资格不能由GP视频尺推断 | P2 |
| 015 / 15 | Transcode完成状态 | D→D | 需素材库存导出/人工QA，不是HTML字段遗漏 | P2 |
| 016 / 16 | Companion素材库存/重复检查 | D→D | 缺少素材库存列表 | P2 |
| 017 / 17 | Companion类型、文件、文本、CTA、状态 | D→D | 61列只有Ad关联creative名称；需额外导出 | P2 |
| 018 / 18 | Creative注册/全账户重名 | B→B | 支持已选Creative唯一关联；全账户注册/重名检测不足。 | P2 |
| 019 / 19 | Creative名称/普通Ad选择关联 | A→A | 名称规范化及唯一父GP关联已比较；不扩展成素材库审核。 | 维护回归 |
| 020 / 19 | Creative LP URL、Companion、ADCAS | D→D | 不能用Ad url替代Creative LP URL或ADCAS证据 | P2 |
| 021 / 19 | Nonclick/CTV普通LP URL豁免 | B→B | 普通Nonclick/CTV URL免设置仍无统一契约，不能直接套Survey例外。 | P2 |
| 022 / 20 | Campaign章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 023 / 21 | Campaign查找/停止过滤 | D→D | 无法证明UI过滤操作或列表完整性 | 文档/人工操作核验 |
| 024 / 22 | 通常Campaign名称、期间、总预算 | A→A | 通常CP名称/期间/总预算完整比较；BLS另由85/86处理，不继承通常预算。 | 维护回归 |
| 025 / 22 | CVあり/なし及CVポイント集合 | B→A | FIX4-A已修正业务CV定位、Register原始值读链与ID集合；顺序允许，重复/非法/冲突review，漏/多/错ID mismatch；なし+空正常，あり无可靠ID review；BLS对象外另记88。 | 维护回归 |
| 026 / 22 | Campaign状态停止、期间预算类型、Flat/Full | A→A | 通常CP已确认状态/预算类型/消化类型契约可比；自由文本/缺列不猜；Survey独立合同。 | 维护回归 |
| 027 / 22 | 初期日预算与自动日均预算 | B→B | 同CP跨行业务日预算可读；自动日均/未来Scheduler时点未实现；Benesse日预算仍有review。 | P2 |
| 028 / 22 | 最終日残予算 | D→D | CSV不含独立开关/末日预算值 | P2 |
| 029 / 22 | 時間毎予算割合 | B→E | 当前hourly_bid_weight仅保守review占位，双方空可隐藏但仍有entry；无可靠小时预算Setting契约，改E，不能计作已比较。 | P2 |
| 030 / 23 | Ad Group章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 031 / 24 | Campaign→GP父子导航/唯一性 | A→A | 父CP范围与候选唯一性保留；错父、争用不会强配，SP角色扩展已验证。 | 维护回归 |
| 032 / 25 | GP命名规则/SPPC/CTV/DMP后缀 | B→B | FIX1 AXA有结构限定身份修复，FIX3明确分支名支持；通常GP全面命名QC仍无普遍adgroup_name预期，不能把特殊匹配当通用命名校正。 | P2 |
| 033 / 25 | GP独立配信期间/空值继承 | A→A | GP明确期间/继承保护可比，不把GP日期当Ad日内时间。 | 维护回归 |
| 034 / 25 | GP每日FQ不使用默认 | C→C | daily_freq_cap虽保留raw，普通Setting期望与比较输入未接线；不等同Campaign期间FQ。 | P1 |
| 035 / 25 | 视频秒数带与CPM、GP状态 | A→A | Register视频/CPM/GP状态可比；Edit未提供视频尺，素材实际规格仍需库存证据。 | 维护回归 |
| 036 / 25 | オークションタイプ | A→A | 正式对象外：所有FMT/Register/Edit不生成auction_type校正entry；不是自动校正功能。 | 已完成对象外策略 |
| 037 / 26 | Device及拆GP规则 | A→A | 通常旧/新FMT Device均有正负例；AXA两项真差异保留；Survey SP固定手机合同另记89，绝不代表Survey CTV支持。 | 维护回归 |
| 038 / 26 | 動画位置 | D→D | 不可据此标记为可修HTML比较缺陷 | P2 |
| 039 / 26 | 放送局指定/除外/单个Local | B→B | 明确Media ID、Local全选及部分名称可比；单Local/所有排除表达未全覆盖。 | P2 |
| 040 / 27 | データ蓄積/Scenario Segment | A→A | 明确store_segment ID可比；Survey启用→普通SP必须蓄积Scenario的跨条件完整性检查仍缺，见83。 | 维护回归 |
| 041 / 28 | 性别/年龄/都道府县 | B→B | 已知性别、年龄、Pref明确集合可比；所有区域/排除/City不全，仍B。 | P2 |
| 042 / 28 | 市区町村 | C→C | 无正式City master/业务映射和生产comparison闭环，保守保护不是实现。 | P2 |
| 043 / 28 | 兴趣关心 | C→C | 普通affinity有列/字典但Setting到比较entry未接线；SP仅空契约/未解析业务文本review，不能升级。 | P1 |
| 044 / 28 | 世帯年收/子あり | B→B | 已知世帯年収/子あり映射可比；其他表达保守，不能声称全部Demography。 | P2 |
| 045 / 28 | 电视收视倾向/Carrier | C→C | tv_usage_tendency/carrier只有CSV承载，普通Setting映射与comparison未接线。 | P2 |
| 046 / 28 | ASR 0-F完整选择集 | B→B | 0~C已增加；0~8/0のみ历史语义不变，SP非接触者D E F另记95；普通任意0-F/未知范围仍未完整支持。 | P2 |
| 047 / 29 | ジャンル/サブジャンル指定 | C→C | genre/subgenre include没有生产Setting比较；不能由exclude实现推定。 | P1 |
| 048 / 29 | ジャンル/サブジャンル除外 | A→A | FIX3 genre_exclude与既有subgenre_exclude已实际接线，Register/Edit有正反例；未知别名保守，不重复列为全未实现。 | 维护回归 |
| 049 / 29 | キッズ年龄段/トーク等别名 | B→B | 手册别名未全部权威映射，现为明确字典名范围，不做任意模糊。 | P2 |
| 050 / 30 | Contents Group | C→C | contents_group raw/字典不代表比较；缺业务来源接线和版本字典闭环。 | P2 |
| 051 / 31 | Bid Segment指定 | A→A | 普通bid_segment明确ID已独立比较；Survey接触者另记91，不能和exclude混用。 | 维护回归 |
| 052 / 31 | Bid Segment Exclude | C→C | 普通bid_segment_exclude仍无Setting解析/comparison；SP Noncontact已支持(95)，两范围不能互相冒充。 | P1 |
| 053 / 32 | DMP ID与扩张阈值 | A→A | Register可靠DMP ID和扩张值可比；Edit CSV缺DMP ID，不能声称ID已校正（扩张字段可读）。 | 维护回归 |
| 054 / 32 | DMP Exclude | C→C | 普通dmp_segment_exclude尚无生产比较输入；SP无此通用能力。 | P1 |
| 055 / 33 | Ad章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 056 / 34 | Ad Creative与父GP关联 | A→A | 普通Creative与父GP唯一关联已支持；无filename计划Ad继续review。 | 维护回归 |
| 057 / 34 | Ad指定配信时间 | B→A | FIX4-A明确Targeting時間指定按编号/父GP关联，每个Ad分别比较start/end；缺失沿旧默认，未知/冲突review；Airbnb23:45真差异保留。 | 维护回归 |
| 058 / 34 | Ad有效状态/停止例外 | B→B | Register初始状态已有比较；普通停止例外与计划Ad生命周期、Edit当前状态无可靠全覆盖，仍B。 | P2 |
| 059 / 34 | Ad入稿用URL | A→A | 普通Ad入稿URL唯一来源与严格值比较；Survey仅类型适用性例外。 | 维护回归 |
| 060 / 34 | 外部Tracking 100%与其他地点 | B→B | 100% Tracking集合与严格URL比较保留；其他地点/每点最多5条的完整校正规则仍缺。 | P2 |
| 061 / 35 | FQ章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 062 / 36 | Campaign期间FQ启用 | D→D | daily_freq_cap不是Campaign期间FQ，缺独立FQ导出 | P2 |
| 063 / 37 | FQ名称/状态/CP集合/任意周日小时期间 | D→D | 需要FQ配置导出及CP ID关联 | P2 |
| 064 / 38 | Dashboard章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 065 / 39 | Dashboard创建 | D→D | 需Dashboard导出/人工记录 | P2 |
| 066 / 40 | Dashboard名称/一订单全CP关系/状态 | D→D | 不能用campaign_name数量代替关联证明 | P2 |
| 067 / 41 | Dashboard开放指标/Click/CV与排序 | D→D | Dashboard指标无导出，仍D；FIX4-A已隔离报表G8/H8与真正CV业务行，不代表Dashboard实现。 | P2 |
| 068 / 42 | 市町村Bulk章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 069 / 43 | City Bulk下载/City列 | B→B | 能识别city列；City Bulk操作/转换缺Master，操作流程不纳入自动功能分母；具体转换合并42/70。 | 文档/人工操作核验 |
| 070 / 44 | 市町村名→代码转换 | C→C | City名→代码缺Master与生产映射；和42合并为一个功能组，原记录不删。 | P2 |
| 071 / 45 | City Bulk上传/上书执行 | D→D | 不能证明后台操作执行/最终保存 | 文档/人工操作核验 |
| 072 / 46 | 放送局Bulk章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 073 / 47 | Media ID Bulk校正 | B→B | Media字段比较能力同39；Bulk最终后台状态/任意Local表达未全。 | P2 |
| 074 / 48 | Media Bulk读取/上传内容 | B→B | 61列读取可用；上传目标/执行完成和专用非61列格式不由工具证明，操作流程不计自动功能。 | 文档/人工操作核验 |
| 075 / 49 | Media Bulk上传目标与保存 | D→D | 不能由输入CSV证明正确选择了上传目标 | 文档/人工操作核验 |
| 076 / 50 | Bulk后Local开关恢复 | D→D | 需最终平台证据/真人勾选检查；不把操作步骤当HTMLbug | 文档/人工操作核验 |
| 077 / 51 | Scheduler章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 078 / 52 | Scheduler有无/section读取 | D→D | 只能将Setting待办列出，不能生成假一致/不一致 | P2 |
| 079 / 53 | Scheduler名称、对象、状态、执行日时、预算 | D→D | 不能将当前daily_budget等同未来计划已设置 | P2 |
| 080 / 54 | Scheduler重复期间/星期/时刻 | D→D | 需要Scheduler导出或人工确认 | P2 |
| 081 / 55 | Survey SP章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 082 / 56 | Survey启用/普通与BLS并存 | C→A | FIX4-B已由真实Setting证据建新TAP Survey SP独立模型；普通与BLS并存；支持单CP/单Contact/N个显式Noncontact，缺条件给诊断，不由CSV数量补造。 | 维护回归 |
| 083 / 56 | 普通SP包含GP的Scenario Segment | B→B | 普通SP已有明确store_segment时可比较；缺Survey启用+SP包含条件→必须Scenario的跨字段检查。内存探针同时清空通常Setting/CSV Store与ASR后无对应entry/告警；不能计完整。 | P0 |
| 084 / 56 | 普通Survey ASR 0-C；CTV-only豁免 | B→B | 普通0~C范围比较已修，尚缺Survey启用条件下的必须设置检查及CTV-only明确豁免联动；无强制拆GP。 | P0 |
| 085 / 57 | SP BLS CP名称与起止日期 | C→B | 新TAP SP CP名/开始日/三日历月后结束已比；短月无同日→review，多Survey CP/多Contact无明确映射→诊断，故复合功能B。 | P2 |
| 086 / 57 | BLS预算90000/日预算1000/状态0/预算类型2/Flat1 | C→A | 新TAP SP Register独立合同90000/1000/type2/status0/消化1；每字段负例检出；Edit无budget_type→不可用/review，非两Schema全部字段A。 | 维护回归 |
| 087 / 57 | BLS report_target_flag=0 | C→A | Survey report_target_flag=0有独立原始值比较、跨行冲突保护及横表列；普通CP不新增此项。 | 维护回归 |
| 088 / 57 | BLS CV策略与截图冲突 | E→A | 用户确认Survey CV对象外；不继承通常CV、不生成entry。策略完成A，但不计自动比较。 | 已完成对象外策略 |
| 089 / 58 | SP接触者GP基本字段 | C→A | 新TAP SP GP名/device/15秒/价格100/状态1正式比较，错值可见；仅Register有全字段，Edit视频不可用。 | 维护回归 |
| 090 / 58 | Survey auction_type | A→A | 复用正式Auction对象外，和36同政策；不因Survey手册示例恢复比较。 | 已完成对象外策略 |
| 091 / 59 | Contact bid_segment/无Audience、DMP | C→A | Contact bid_segment明确Scenario，bid_segment_exclude空；gender/age/pref/annual_income/demography/affinity/DMP空契约可比。Contact非空ASR另为review，不是通用必须空判错。 | 维护回归 |
| 092 / 60 | SP多非接触者GP/非固定2GP | C→A | 按设计计数与唯一Targeting引用生成，1/2/3 Noncontact正例及缺引用/重复/数量冲突负例；不固定两个GP。 | 维护回归 |
| 093 / 60 | 多非接触者命名/消化用GP含义 | E→B | 明确Targeting标签后缀已获用户确认并实现；无标签/冲突保守；“消化用GP”任意业务场景及多CP仍待确认。 | P2 |
| 094 / 61 | SP非接触者Audience/DMP复制 | C→B | SP Noncontact允许字段按唯一引用继承，DMP ID/threshold可比；Affinity业务名称到ID未有可靠Master→review，其余未允许普通字段不直接复制。 | P2 |
| 095 / 61 | 非接触者ASR D-F/接触者排除 | C→A | SP Noncontact bid_segment空、bid_segment_exclude=Contact ID、ASR D E F独立比较；错列/漏/多成员检出，重复/非法review。Contact空一致、有效或非法非空review，保留原文/来源及理由。 | 维护回归 |
| 096 / 61 | SP非接触者放送局/Contents不设置 | C→B | 白名单已阻止普通Media/Contents继承，但Survey合同未生成media/local_broadcaster/contents_group空值比较；CSV错填目前会漏检，仍B。 | P1 |
| 097 / 62 | SP Survey专用Creative/三个Ad | C→A | Survey专用Creative按角色建Ad、唯一父GP匹配，跨GP同名不竞争；错名mismatch，父GP歧义不强配；Register状态/时间可比，Edit当前状态未确认。 | 维护回归 |
| 098 / 62 | Survey URL/Tracking免设置 | C→A | Survey Ad URL/Tracking正式对象外：即使CSV有值也不比较；普通Ad规则不变。不是已验证所有URL为空。 | 已完成对象外策略 |
| 099 / 63 | SP Survey FQ一回/110天/全部Survey CP | D→D | Survey期间FQ一次/110天/全部CP需独立FQ配置证据，不能用三个月CP日期代替。 | P2 |
| 100 / 64 | Survey CTV章节 | D→D | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 文档/人工操作核验 |
| 101 / 65 | CTV Survey CP共通字段 | C→C | Survey CTV未建Setting类型模型/实案验证；SP共通字段实现不可转记为CTV A。 | P2 |
| 102 / 65 | CTV章节文字与截图默认矛盾 | E→E | CTV文案/截图与版本优先级待业务确认。 | P2 |
| 103 / 66 | CTV Contact设备与名称分隔符 | E→E | CTV Contact设备/名称分隔符待确认，SP android ios不可替代。 | P2 |
| 104 / 66 | CTV GP视频15/价格100/状态1 | C→C | CTV视频/CPM/status仍未建类型模型；字段存在不等实现。 | P2 |
| 105 / 67 | CTV Contact bid_segment与Audience/DMP空 | C→C | CTV段ID类型/角色未确认、未建立模型；不套SP。 | P2 |
| 106 / 68 | CTV Noncontact设备矛盾 | E→E | CTV非接触者设备文字矛盾待确认。 | P2 |
| 107 / 68 | CTV Noncontact GP基本字段 | C→C | CTV Noncontact类型实体未实现。 | P2 |
| 108 / 69 | CTV非接触者include自身/Exclude接触者 | C→C | CTV Noncontact include自身+exclude Contact未开发；SP Noncontact bid空不能复用成CTV规则。 | P2 |
| 109 / 69 | CTV非接触者不继承Audience/DMP/媒体/Contents | C→C | CTV Audience/DMP/Media/Contents/ASR适用性未完整确认且无模型。 | P2 |
| 110 / 70 | CTV Survey Creative命名SP/CTV矛盾 | E→E | CTV专用Creative命名SP/CTV矛盾待确认。 | P2 |
| 111 / 70 | CTV Survey URL/Tracking免设置 | C→C | SP URL/Tracking政策不能证明CTV实体已解析/比较；CTV仍未实现。 | P2 |
| 112 / 71 | CTV Survey FQ命名SP/CTV矛盾 | E→E | CTV FQ命名待确认且无FQ导出；保留原E，次级数据限制D。 | P2 |
| 113 / 71 | CTV Survey FQ 110天/一次/CP集合 | D→D | CTV FQ需独立导出，61列无法支持。 | P2 |

## 留存证据

- [完整测试日志](evidence/full_regression.log)：837 tests /837 pass /0 fail /0 skipped；数量未改变。
- [当前真实案件+Schema+语法+覆盖探针](evidence/seal_verification.json)，[业务输入原件路径/SHA](evidence/input_manifest.json)。
- [原审计及开发报告副本清单/SHA](evidence/source_reports_manifest.json)；只复制报告，不复制/修改业务xlsx/CSV/PPT原件。来源旧报告中的待QA状态以本次用户验收及当前边界修正为准。
- [测试定义索引](evidence/test_definition_catalog.json)为源定义索引，含参数化用例定义，不能把索引条数误作执行测试数。
