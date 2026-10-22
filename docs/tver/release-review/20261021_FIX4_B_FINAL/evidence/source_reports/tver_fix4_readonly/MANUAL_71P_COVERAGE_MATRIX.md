# 71页手册功能覆盖矩阵

源手册：D:\業務用\開発用\2課_設定依頼\003\※長春用※TVer管理画面マニュアル_20260827.pptx
SHA256：DD3315D54A2FE48612F5FF430871D8614645E92157884D3381BEAA39E7FAA1A3

审计基线：FIX3 HTML SHA256 C8B4594C6EFEAC8F0DC5095ECD5F3D6C0F6437F496903F0CF020E1B0A72EFD13。
全部71页原生文字已读取，71页均已只读导出渲染并检查页面总览；关键规则及截图以大图复核。未更改源PPT。

分类：A=明确范围内完整支持；B=部分支持；C=现有CSV可提供该设置证据而生产比较未接线（本案非空值在行内注明；不把本案空字段说成错误）；D=本CSV缺少必要后台字段/实体，或本页属于文档/操作而非设置比较；E=需要业务确认。A不等于整个模块全覆盖，正式对象外规则也标明A（按已批准业务范围实现）。
D不是HTML缺陷。CSV schema有列、sourceEvidence保留、generic compareField可接受字段，都不等于生产buildRunFromModels已生成比较。
风险：高=可能误报/漏报或匹配错误；中=功能缺口/有限规则；低=已验证范围；无=说明页或明确不在范围。
阶段：4-A=CV最小修复；4-B=SP Survey；4-C-0=显式Ad时间/状态优先；4-C=其他手册遗留，缺后台证据的项目先接入证据。CTV疑点未确认前不实现默认推导。

CSV版适合筛选；本表按页逐功能列示。同一功能可出现在多个页面，不用行数计算支持率。


| PPT页码 | 业务名称 | 业务层级 | Excel来源 | CSV字段 | 现有代码函数 | 分类 | 当前实现状态 | 缺口 | 风险等级 | 建议开发阶段 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 手册版本/封面 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 2 | 构成/目录 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 3 | Slack依赖、纳期、问询 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 4 | 配信構造章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 5 | CP/GP/Ad三层与完整业务层级 | 层级 | 配信设计、Creative、FQ、Dashboard | CP/GP/Ad列；无FQ/Dashboard实体 | parseTverSettingWorkbook:1045；buildRegisterTree:1442 | B | 通常三层已建模 | 账户、素材元数据、FQ、Dashboard不在本CSV；Survey三层尚缺 | 高 | 4-B；4-C证据接入 |
| 6 | 注册→CP→GP→Ad→FQ→Dashboard→Scheduler流程 | 跨层级 | 各★section | 仅CP/GP/Ad快照 | buildRunFromModels:4322 | D | 检查CSV快照，不能证明操作流程 | FQ/Dashboard/Scheduler及操作执行状态无下载证据 | 中 | 4-C证据接入 |
| 7 | 設定方法章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 8 | アカウント选择章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 9 | 广告会社ID/账户选择 | Account | C5=906、基本信息 | 本61列无广告会社ID | CSV Schema:59-77 | D | 不可比较 | 需要带Account/Agency ID的独立导出；名称不能代替ID | 高 | 4-C外部证据 |
| 10 | 广告主ID/账户选择 | Account | C7=4877 | 本61列无广告主ID | CSV Schema:59-77 | D | 不可比较 | 无法凭文件名证明上传到正确广告主账户 | 高 | 4-C外部证据 |
| 11 | クリエイティブ登録章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 12 | 视频文件取得/重名检查 | Material | H84/H85素材保管URL | creative_name仅名称 | buildCreativeIndex；matchTverEntities:3310 | D | 能读素材名，不能审计素材仓库 | 未导出已有素材列表和文件；无法证明全账户无重名 | 中 | 4-C素材证据 |
| 13 | 视频素材名、状态、VAST上传类型 | Material | ★クリエイティブ | creative_name；无素材状态/类型 | buildCreativeIndex；resolveCreativeFields:921 | B | 关联到名称 | Ad creative_name不等于素材库存状态、VAST类型证明 | 中 | 4-C素材证据 |
| 14 | 入稿规格、分辨率与可投设备 | Material | 素材秒数/文件本体 | 无宽高/码率/上传校验结果 | parseTverVideoDuration:1672（仅GP秒数带） | D | 没有素材文件规格证据 | 1920x1080/1280x720、CTV资格不能由GP视频尺推断 | 高 | 4-C素材证据 |
| 15 | Transcode完成状态 | Material | 平台素材列表 | 无transcode字段 | — | D | 不可比较 | 需素材库存导出/人工QA，不是HTML字段遗漏 | 高 | 4-C外部证据 |
| 16 | Companion素材库存/重复检查 | Companion | B91/C91；93行起 | 无companion库存字段 | buildCreativeIndex（不建companion实体） | D | 不可比较 | 缺少素材库存列表 | 中 | 4-C素材证据 |
| 17 | Companion类型、文件、文本、CTA、状态 | Companion | ★クリエイティブ的Companion表 | 无type/text/CTA/companion status | — | D | 不可比较 | 61列只有Ad关联creative名称；需额外导出 | 中 | 4-C素材证据 |
| 18 | Creative注册/全账户重名 | Creative | ★クリエイティブ | creative_name/creative_id（已正式不校正ID） | buildCreativeIndex；matchTverEntities:3310 | B | 已校正Ad所选名称 | 不能证明库存中重名、注册成功或全部creative关联 | 中 | 4-C素材证据 |
| 19 | Creative名称/普通Ad选择关联 | Creative/Ad | C84/C85文件名 | creative_name | resolveCreativeFields:921；matchTverEntities:3310 | A | 父GP内唯一creative名称匹配 | 本A限名称与父子关系，非素材库存全面支持 | 低 | 保留FIX3 |
| 19 | Creative LP URL、Companion、ADCAS | Creative | I列LP URL、Companion、ADCAS说明 | url是Ad入稿URL；无CreativeLP/companion/ADCAS状态 | buildCreativeIndex；buildUploadUrlIndex | D | 来源可读取，backend Creative字段不可证实 | 不能用Ad url替代Creative LP URL或ADCAS证据 | 高 | 4-C素材证据 |
| 19 | Nonclick/CTV普通LP URL豁免 | Creative/Ad | B81/C81クリック；配信设备 | url仅Ad层 | resolveCreativeFields:921 | B | 有旧LP fallback与FIX3入稿URL映射 | 无统一Nonclick/CTV豁免契约；本案双方url为空，不能证明所有豁免规则 | 中 | 4-C规则完善 |
| 20 | Campaign章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 21 | Campaign查找/停止过滤 | Campaign UI | 配信设计 | campaign_name/campaign_status | matchTverEntities:3310 | D | 快照名称/状态可比 | 无法证明UI过滤操作或列表完整性 | 低 | 人工QA |
| 22 | 通常Campaign名称、期间、总预算 | Campaign | B30、E30/F30、D30 | campaign_name/start_datetime/end_datetime/budget | buildCampaignExpectation；buildRunFromModels:4322 | A | 本案1/1匹配，独立校正期间/预算 | 不代表Survey CP已支持 | 低 | 保留FIX3 |
| 22 | CVあり/なし及CVポイント集合 | Campaign | B18:C18、D18:E18（不能用G8/H8报表指标） | cv_point（本案225 226 227 228 229） | findSettingPairValue:378；csvField:3114；resolveTverCampaignContract:4241；normalizeComparisonValue:1849 | B | 已有entry，但取值和集合比较有缺陷 | 模式误取H8；Register比较值为空；整段说明未提ID；无集合归一化 | 高 | 4-A |
| 22 | Campaign状态停止、期间预算类型、Flat/Full | Campaign | P30及正式默认规则 | campaign_status=0/budget_type=2/consumption_type=1 | resolveTverCampaignContract:4241；buildRunFromModels:4322 | A | 通常默认与可识别Full说明已比较 | 特殊自由文本需保守；Survey须专用契约 | 中 | 保留；4-B类型隔离 |
| 22 | 初期日预算与自动日均预算 | Campaign | O30:O35；Scheduler H125:H133 | daily_budget=193629 | addCampaignDailyBudgetSource；buildRunFromModels:4322 | B | FIX3跨业务行聚合已支持；本案空→需确认 | 未实现平台自动计算/时点Scheduler期望；不能按总预算天数替代本案分周设置 | 高 | 4-C预算时点契约 |
| 22 | 最終日残予算 | Campaign | 其他设置/自由备注 | 无独立最后一天预算列 | — | D | 无法比较 | CSV不含独立开关/末日预算值 | 中 | 4-C额外导出 |
| 22 | 時間毎予算割合 | Campaign | 自由说明/小时分配 | hourly_bid_weight | buildRunFromModels:4360附近 | B | 只生成规则待确认项 | 未解析Setting小时分配或明确空值默认契约 | 中 | 4-C |
| 23 | Ad Group章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 24 | Campaign→GP父子导航/唯一性 | Ad Group | 业务表G列Targeting号 | adgroup_name/CP字段 | matchTverEntities:3310 | A | 唯一父CP匹配、竞争候选保护保留 | 无业务ID时仍保守；不使用模糊名称 | 低 | 保留 |
| 25 | GP命名规则/SPPC/CTV/DMP后缀 | Ad Group | Targeting名、诉求、设备、CP期间 | adgroup_name | parseTverSettingWorkbook:1045；createTverFix1IdentityScope；matchTverEntities:3310 | B | 可作严格身份/分支证据，非完整命名校正 | 通常parser.expectedName=null；未生成adgroup_name比较项；AXA特例不能泛化 | 高 | 4-C名称规则确认 |
| 25 | GP独立配信期间/空值继承 | Ad Group | I/J业务列 | adgroup_start_datetime/adgroup_end_datetime | resolveTverGpPeriodGuard；buildRunFromModels:4400附近 | A | 已比较，空值维持继承语义 | 无需将GP结束日期与Ad end_time混用 | 低 | 保留 |
| 25 | GP每日FQ不使用默认 | Ad Group | FQ/GP备注 | daily_freq_cap（本案空） | ADGROUP_FIELDS:1226；无生产entry生成 | C | 只保留CSV字段 | 没有default/explicit日FQ校正；不等于Campaign期间FQ | 中 | 4-C |
| 25 | 视频秒数带与CPM、GP状态 | Ad Group | D51/I51、D52/I52、初动OFF备注 | tver_video_duration/price/adgroup_status | parseTverVideoDuration:1672；resolveSettingAdGroupStatus:2383；buildTverA173OperationalComparisonInputs:2855 | A | Register已比较；已知初动OFF可覆盖GP状态 | Edit不含视频尺；Creative实际秒数资格需另证 | 中 | 保留；Edit视频尺为D |
| 25 | オークションタイプ | Ad Group | 50行原结构保留 | auction_type | buildRunFromModels（正式不生成auction entry） | A | 按已批准FIX2排除校正 | 手册固定/自动示例不重新启用校正 | 无 | 保持对象外 |
| 26 | Device及拆GP规则 | Ad Group | H30:H35/配信デバイス● | device | resolveSettingAdGroupDevice:3952；matchTverEntities:3310 | A | Device独立于匹配后校正，空CSV不覆盖Setting | 素材实际规格对设备资格不在CSV | 低 | 保留FIX3 |
| 26 | 動画位置 | Ad Group | 54行動画位置● | 61列无视频位置列 | TARGETING_FIELD_NAMES:403（无该字段） | D | backend必要数据缺失 | 不可据此标记为可修HTML比较缺陷 | 中 | 4-C额外导出 |
| 26 | 放送局指定/除外/单个Local | Ad Group | 55行放送局● | media/local_broadcaster | resolveSettingTargetingForComparison:2473 | B | 数值Media ID与Local全选已支持 | 名称、排除含义及Local子集未完整；本案无指定 | 高 | 4-C字典/开关契约 |
| 27 | データ蓄積/Scenario Segment | Ad Group | 56行段名与ID=7550 | store_segment=7550；bls_store_segment本案空 | buildTverA173RetargetComparisonInputs:2927 | A | 通常两个GP均7550一致 | A仅段ID校正；未验证Survey启用关系/创建状态 | 中 | 保留；4-B增加关系校验 |
| 28 | 性别/年龄/都道府县 | Targeting | 57/58/59行 | gender/start_age/end_age/pref | resolveSettingTargetingForComparison:2473；parseTverAgeExpression:2338 | B | 已知性别、年龄与Pref名/ID支持 | 所有区域表达、排除及City不完整；不以B代表已支持整个Audience | 中 | 4-C |
| 28 | 市区町村 | Targeting | 59行/外部市町村Code表 | city | applyConservativeRules:1887（只有缺Master保护） | C | CSV值保留但无生产city entry | 缺少正式City master与Setting关联，不能强判 | 高 | 4-C City master |
| 28 | 兴趣关心 | Targeting | 60行興味関心● | affinity | ID dictionary存在；无comparison input | C | 只有读取/字典 | 未把Setting名映射为affinity并比较 | 中 | 4-C |
| 28 | 世帯年收/子あり | Targeting | 61/63行 | annual_income/demography | resolveSettingC344TargetingForComparison:2302 | B | 600/800/1000万円以上、子あり已支持 | 其他值/表达保守需确认，非全面泛化 | 中 | 4-C |
| 28 | 电视收视倾向/Carrier | Targeting | 62行テレビ視聴傾向●；其他指示 | tv_usage_tendency/carrier | Schema/ADGROUP_FIELDS；无comparison input | C | 字段保留 | Setting映射与规则未接线 | 中 | 4-C |
| 28 | ASR 0-F完整选择集 | Targeting | 64行ASR | uid_suffix | tverC344UidSuffixSettingCanonical:2265；CsvCanonical:2273 | B | 仅Setting 0~8/0のみ，CSV仅十进制数字 | 字母A-F、0~C、D/E/F不支持；本案2项需确认 | 高 | 4-B |
| 29 | ジャンル/サブジャンル指定 | Targeting | 65/66行非除外指示 | genre/subgenre | Schema与字典存在；无生产比较映射 | C | 读原始字段 | 只实现exclude，不可将include当作exclude | 中 | 4-C |
| 29 | ジャンル/サブジャンル除外 | Targeting | 65/66行除外marker+列表 | genre_exclude/subgenre_exclude | resolveSettingTargetingForComparison:2565/2576 | A | 已知字典值独立比较；本案subgenre exclude正常 | A限定已知可解析名称；不等于所有别名覆盖 | 低 | 保留FIX3 |
| 29 | キッズ年龄段/トーク等别名 | Targeting | 0～2/3～5/小学生/トーク等 | subgenre | tverA17CanonicalNames:2215（精确字典名） | B | 只有精确字典名 | 手册别名未做全部显式映射；不能靠模糊词匹配 | 中 | 4-C别名规格 |
| 30 | Contents Group | Targeting | コンテンツグループ指示 | contents_group | Schema、字典存在；无comparison input | C | CSV字段保留 | 临时选项需版本化字典/未知值确认 | 中 | 4-C |
| 31 | Bid Segment指定 | Targeting | 67行入札セグメント | bid_segment | buildTverA173RetargetComparisonInputs:2927 | A | Register/Edit数字ID集合已有比较 | Survey Contact没有Setting实体，不能因此认为已支持 | 中 | 保留；4-B接线 |
| 31 | Bid Segment Exclude | Targeting | 68行入札除外セグメント；Survey Contact ID | bid_segment_exclude（BLS两组7550） | ADGROUP_FIELDS:1231；TARGETING_FIELD_NAMES缺该label | C | 仅CSV保存 | Setting解析和比较输入、横表列、统计/Navigator接线均缺 | 高 | 4-B |
| 32 | DMP ID与扩张阈值 | Targeting | 69行=7541；72行拡張値50 | dmp_segment/dmp_segment_expansion_threshold | resolveSettingOperationalTargetingForComparison:2787；resolveSettingDmpExpansionForComparison:2797 | A | Register数值ID，Register/Edit扩张值支持 | Edit CSV无dmp_segment应归D而非误报 | 中 | 保留 |
| 32 | DMP Exclude | Targeting | 70行DMP除外セグメント | dmp_segment_exclude | Schema/ADGROUP_FIELDS；无Setting映射和entry | C | 字段保留 | 未校正除外集合 | 高 | 4-C |
| 33 | Ad章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 34 | Ad Creative与父GP关联 | Ad | 业务表K30:K35→C84/C85 | creative_name | resolveCreativeFields:921；matchTverEntities:3310 | A | 父GP内唯一名称；URL不再阻断匹配 | 无filename的计划素材保持需确认 | 低 | 保持FIX3 |
| 34 | Ad指定配信时间 | Ad | D71/I71=6:00~23:59 | start_time/end_time | buildRunFromModels:4475-4489 | B | 比较存在，但仅固定00:00/23:59 | 时间指定行未解析；4条6:00误报；须显式Setting优先 | 高 | 4-C-0最先处理 |
| 34 | Ad有效状态/停止例外 | Ad | P32/P35=ADステータスオフ | status | buildRunFromModels:4490附近 | B | Register固定1已实现；Edit不扩大 | 未解析明确Ad停止指示；计划Ad身份未决时不可假装已比 | 高 | 4-C-0经业务确认 |
| 34 | Ad入稿用URL | Ad | ★URL的LP名→入稿用URL | url | buildUploadUrlIndex；resolveCreativeFields:921 | A | FIX3唯一映射与旧FMT fallback保护已实现 | Survey需独立URL免设置规则，不借普通LP替代 | 中 | 保留；4-B类型隔离 |
| 34 | 外部Tracking 100%与其他地点 | Ad | ★計測タグ及0/100诉求 | tracking_url_start/first_quartile/midpoint/third_quartile/complete | buildMeasurementTagIndex；resolveCreativeFields:921；buildRunFromModels | B | Complete集合比较；Start/25/50/75按既有决定中立defer | 各点最大5标签校验/其余地点比较未全面；不能当作回归失败强启 | 中 | 4-C先确认范围 |
| 35 | FQ章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 36 | Campaign期间FQ启用 | FQ | B23:C26/期间FQ | 本61列无FQ实体/期间/回数 | applyConservativeRules仅有孤立isPeriodFreqCap保护 | D | 不能核验实际FQ | daily_freq_cap不是Campaign期间FQ，缺独立FQ导出 | 高 | 4-C证据接入 |
| 37 | FQ名称/状态/CP集合/任意周日小时期间 | FQ | 期间FQ及J24/J25 | 无FQ集合/周期/次数CSV | — | D | 本CSV不可比较 | 需要FQ配置导出及CP ID关联 | 高 | 4-C证据接入 |
| 38 | Dashboard章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 39 | Dashboard创建 | Dashboard | 配信ダッシュボード备考 | 无Dashboard实体 | — | D | 本CSV不可验证 | 需Dashboard导出/人工记录 | 中 | 4-C证据接入 |
| 40 | Dashboard名称/一订单全CP关系/状态 | Dashboard | 基本信息+订单期间/备注 | 无Dashboard名称/CP集合/状态 | — | D | 不可比较 | 不能用campaign_name数量代替关联证明 | 高 | 4-C证据接入 |
| 41 | Dashboard开放指标/Click/CV与排序 | Dashboard | F8/H8及配信Dashboard备注 | 无开放指标/顺序字段 | findSettingPairValue:378误把G8的CV当模式 | D | 不具备backend证据 | 本模块不完整不是CSV字段遗漏；须隔离CV业务读取 | 高 | 4-A修误取；4-C额外证据 |
| 42 | 市町村Bulk章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 43 | City Bulk下载/City列 | Targeting/操作 | 市町村Code表 | city | CSV Schema；applyConservativeRules:1908 | B | 61列Register/Edit识别，City不作可靠校正 | Code master、外部表输入及CSV匹配缺；上传操作非工具职能 | 高 | 4-C City master |
| 44 | 市町村名→代码转换 | Targeting | 外部市町村Code表N列以降 | city | 无City master；applyConservativeRules:1908 | C | 缺master保护存在 | 资料003无City master；须额外授权资料后实现，未知不自动取数 | 高 | 4-C数据字典先行 |
| 45 | City Bulk上传/上书执行 | 后台操作 | 修改过的Bulk | CSV只呈现值，不证明已上传成功 | detectTverCsvSchema | D | 能识别下载文件类型 | 不能证明后台操作执行/最终保存 | 中 | 人工QA/最终后台导出 |
| 46 | 放送局Bulk章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 47 | Media ID Bulk校正 | Targeting | 55行数值Media ID | media/local_broadcaster | resolveSettingTargetingForComparison:2473 | B | 支持数值Media ID/Local全选 | 单Local选择/排除说明与操作后状态不全面 | 中 | 4-C |
| 48 | Media Bulk读取/上传内容 | Targeting/操作 | 55行ID | media | parseCsvText；buildEditTree；resolveSettingTargetingForComparison | B | 字段与Edit三层读取已有 | 操作执行、单GP专用导出（若非61列）不在现有Schema证明范围 | 中 | 4-C Schema核实 |
| 49 | Media Bulk上传目标与保存 | 后台操作 | Bulk操作要求 | 无upload action/target执行结果 | detectTverCsvSchema | D | 不执行后台上传 | 不能由输入CSV证明正确选择了上传目标 | 中 | 人工QA |
| 50 | Bulk后Local开关恢复 | 后台操作/Targeting | Local操作说明 | local_broadcaster仅列表；无上传前后开关事件 | resolveSettingTargetingForComparison（Local全选） | D | 能比部分列表，不能证明UI动作完成 | 需最终平台证据/真人勾选检查；不把操作步骤当HTMLbug | 高 | 人工QA/额外导出 |
| 51 | Scheduler章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 52 | Scheduler有无/section读取 | Scheduler | B16:C16；★スケジューラー119行起 | 无Scheduler实体 | parseTverSettingWorkbook:1045不建Scheduler | D | Setting存在指示，CSV没有实际计划 | 只能将Setting待办列出，不能生成假一致/不一致 | 高 | 4-C证据接入 |
| 53 | Scheduler名称、对象、状态、执行日时、预算 | Scheduler | 123-140行；193629等分周预算 | 无Schedule name/runAt/action/target列 | — | D | 无法核验平台Scheduler | 不能将当前daily_budget等同未来计划已设置 | 高 | 4-C专用导出/人工QA |
| 54 | Scheduler重复期间/星期/时刻 | Scheduler | 重复列F/G及时间指示 | 无repeat schedule字段 | — | D | 不可比较 | 需要Scheduler导出或人工确认 | 中 | 4-C证据接入 |
| 55 | Survey SP章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 56 | Survey启用/普通与BLS并存 | Survey/跨层级 | C15=あり；★TVerSurvey142行；C150新TAPあり | 普通与BLS CP/GP/Ad实际列 | parseTverSettingWorkbook:1045只解析业务主表 | C | 通常1CP2GP6Ad；没有Survey对象 | 没有enabled/type/角色/父子模型；不能靠【BLS】前缀补全 | 高 | 4-B |
| 56 | 普通SP包含GP的Scenario Segment | 通常GP | D56/E56,I56/J56；D156=7550 | store_segment=7550 | buildTverA173RetargetComparisonInputs:2927 | B | 两个普通GP段ID已比一致 | 未校验Survey启用、SP含有条件及角色一致性 | 高 | 4-B |
| 56 | 普通Survey ASR 0-C；CTV-only豁免 | 通常GP | D64/I64=0~C；H30:H35 | uid_suffix=0 1 2 3 4 5 6 7 8 9 A B C | tverC344UidSuffixSettingCanonical:2265/CsvCanonical:2273 | B | 本案2条需确认 | 缺字母token/范围映射；不能为Survey强制拆设备 | 高 | 4-B |
| 57 | SP BLS CP名称与起止日期 | BLS Campaign | C147=2026/12/21；G145:H145=1CP；业务CP名；H156运营名 | campaign_name/start_datetime/end_datetime（2026/12/21→2027/3/21） | parseTverSettingWorkbook:1045无Survey builder | C | BLS CP是CSV侧未匹配 | 需Rule+Source建立Survey CP；H156单日期提示不能直接覆盖标准名 | 高 | 4-B |
| 57 | BLS预算90000/日预算1000/状态0/预算类型2/Flat1 | BLS Campaign | P57文字规则+Survey启用证据 | budget=90000/daily_budget=1000/campaign_status=0/budget_type=2/consumption_type=1 | resolveTverCampaignContract:4241（仅通常默认） | C | 没有BLS字段entry | 需有来源的Survey契约，不能复用普通预算 | 高 | 4-B |
| 57 | BLS report_target_flag=0 | BLS Campaign | P57含めない | report_target_flag=0（普通=1） | REGISTER_SOURCE_FIELDS_BY_LEVEL:1305；buildRunFromModels无entry；横列显式排除:4891 | C | 原始证据有值、比较项为0条 | 不仅是显示；需比较阶段接线及类型专属预期 | 高 | 4-B |
| 57 | BLS CV策略与截图冲突 | BLS Campaign | P57 CV输入空；状态/日预算/结束时刻截图与文字不一致 | cv_point本案BLS空 | resolveTverCampaignContract:4241若直接复用有继承风险 | E | 没有BLS CV语义 | CV不继承普通CP；正式空值策略及文字优先级须确认 | 高 | 4-B确认后 |
| 58 | SP接触者GP基本字段 | BLS GP | C152/D152；C156/D156；G146:H146=1 | adgroup_name/tver_video_duration15/price100/status1/device android ios | matchTverEntities:3310；无Survey Setting实体 | C | CSV1条未匹配 | 未建立Contact role及专用字段规则 | 高 | 4-B |
| 58 | Survey auction_type | BLS GP | P58固定单价示例 | auction_type=1 | FIX2正式排除规则 | A | 继续不校正 | 不得因手册Survey说明恢复auction comparison | 无 | 保持对象外 |
| 59 | Contact bid_segment/无Audience、DMP | BLS GP | D156=7550；P59 | bid_segment=7550；其他Audience/DMP空 | 现有bid比较器可复用，但无Contact实体 | C | CSV Contact GP未匹配，未实际比较这些值 | Contact独立不继承普通Targeting；也须校验错误多填 | 高 | 4-B |
| 60 | SP多非接触者GP/非固定2GP | BLS GP | H147=2本；I147=ターゲ1,ターゲ2(拡張値50) | 非接触者_子あり/非接触者_DMP两GP | 无Survey分支构建器 | C | 两个CSV非接触者GP未匹配 | 按显式引用建立可变分组；不能凭CSV反推Setting数量 | 高 | 4-B |
| 60 | 多非接触者命名/消化用GP含义 | BLS GP | P60消化用不要；I147明确包含Target2 DMP | adgroup_name含_非接触者_DMP | — | E | 手册没定义多分支后缀；本案DMP角色需区分 | 非接触者DMP不自动等同不需建的消化用GP；确认名称和分支规则 | 高 | 4-B业务确认 |
| 61 | SP非接触者Audience/DMP复制 | BLS GP | Target1/2；25-44歳、子あり/7541、拡張50 | start_age/end_age/demography/dmp_segment/threshold | 现有Targeting比较函数可复用；无Survey builder | C | CSV配置有值但未校正 | 只复制明确引用Targeting的允许字段，不复制全部普通GP | 高 | 4-B |
| 61 | 非接触者ASR D-F/接触者排除 | BLS GP | 72行D,E,F；D156接触者ID7550 | uid_suffix D E F/bid_segment_exclude7550 | ASR仅0~8/0のみ；exclude未实现 | C | 没有BLS比较；现有ASR也无法解析字母 | 独立ID/ASR集合；保留缺漏/多余检测 | 高 | 4-B |
| 61 | SP非接触者放送局/Contents不设置 | BLS GP | P61明文豁免 | media/local_broadcaster/genre/subgenre/contents_group空 | 普通Targeting函数不区分角色 | C | 当前无BLS对象，无法检查误继承 | 建立白名单继承与明确空值契约；不能泛化到所有字段 | 高 | 4-B |
| 62 | SP Survey专用Creative/三个Ad | BLS Ad | C157/C158段名；两非接触者共享非接触creative | creative_name；creative_id仅后台ID | buildCreativeIndex（只★クリエイティブ）；matchTverEntities:3310 | C | BLS三个CSV Ad未匹配 | Survey自己的creative index；在各父GP唯一匹配，可重用同名creative | 高 | 4-B |
| 62 | Survey URL/Tracking免设置 | BLS Ad | P62明确不要；D152/E152为VAST非Ad URL | url/tracking_url_*本案空 | resolveCreativeFields:921（通常契约） | C | 尚无Survey Ad比较，不是已通过豁免 | VAST URL不能映射为Ad入稿/Tracking；免设置是否允许额外值需确认 | 高 | 4-B |
| 63 | SP Survey FQ一回/110天/全部Survey CP | FQ | J25=2027/4/10；H148=1本；P63 | 61列无FQ实体/周期/回数/关联 | — | D | 无法由本CSV验证 | FQ 110天不等于BLS CP三个月；需独立FQ证据 | 高 | 4-C证据接入 |
| 64 | Survey CTV章节 | 业务流程/文档 | — | — | — | D | 非设置值比较页 | 本页没有需要由61列CSV证明的设置值；不判为HTML缺陷 | 无 | 文档/人工流程 |
| 65 | CTV Survey CP共通字段 | BLS Campaign | P65；本案C168=なし | CP列可表达；本案无CTV Survey | 无Survey builder | C | 通用CP字段能力可复用，CTV未实案验证 | 日期命名/90000/1000/flag0须以类型契约，不能拿SP数据冒充CTV验收 | 高 | 4-C在CTV确认后 |
| 65 | CTV章节文字与截图默认矛盾 | BLS Campaign | P65文字停止/1000/23:45；截图另值 | campaign_status/daily_budget/end_datetime | — | E | 规则未定优先级 | 手册文字、截图与后续新TAP版本需正式优先级 | 高 | BUSINESS_CONFIRMATION_REQUIRED |
| 66 | CTV Contact设备与名称分隔符 | BLS GP | P66文字和截图都是SD iOS/Android；模板CTV前缺下划线 | device/adgroup_name | — | E | 不能根据CTV标题自动设device=ctv | 确认Survey投放设备究竟为移动端还是CTV、命名拼接规则 | 高 | BUSINESS_CONFIRMATION_REQUIRED |
| 66 | CTV GP视频15/价格100/状态1 | BLS GP | P66 | tver_video_duration/price/adgroup_status | 比较器可复用；无Survey模型 | C | 未建立CTV Contact实体 | 需要角色构建器与实案；Auction依然排除 | 高 | 4-C确认后 |
| 67 | CTV Contact bid_segment与Audience/DMP空 | BLS GP | P67 Contact segment | bid_segment；Audience/DMP列 | buildTverA173RetargetComparisonInputs可复用 | C | 当前无CTV Survey匹配 | 确认old/new系统段ID类型；不继承SP非接触者规则 | 高 | 4-C确认后 |
| 68 | CTV Noncontact设备矛盾 | BLS GP | P68标CTV但SD iOS/Android已勾选 | device/adgroup_name | — | E | 未自动推断 | 同P66，CTV章节名称不能证明ctv设备 | 高 | BUSINESS_CONFIRMATION_REQUIRED |
| 68 | CTV Noncontact GP基本字段 | BLS GP | P68 | tver_video_duration15/price100/adgroup_status1 | 现有字段比较器；无Survey builder | C | 无CTV Survey模型 | 需业务规则类型与真实样例 | 高 | 4-C确认后 |
| 69 | CTV非接触者include自身/Exclude接触者 | BLS GP | P69非接触者segment、接触者segment | bid_segment/bid_segment_exclude | bid可比较、exclude未接线 | C | 尚无此类型entity | 不能把SP非接触者的bid空规则用于CTV；需ID唯一角色映射 | 高 | 4-C确认后 |
| 69 | CTV非接触者不继承Audience/DMP/媒体/Contents | BLS GP | P69明确全部不要 | 相关Targeting列 | 普通函数无角色策略 | C | 尚未比较 | 与SP规则不同，需独立契约；ASR是否空另确认 | 高 | 4-C确认后 |
| 70 | CTV Survey Creative命名SP/CTV矛盾 | BLS Ad | P70说明_SP_，截图表实际_CTV_ | creative_name | 无Survey creative resolver | E | 两处证据冲突 | 优先使用唯一可靠Excel显式名；默认模板需确认，不做自动替换 | 高 | BUSINESS_CONFIRMATION_REQUIRED |
| 70 | CTV Survey URL/Tracking免设置 | BLS Ad | P70明确不要 | url/tracking_url_* | 普通resolver无Survey策略 | C | 未建CTV Survey Ad | 共同豁免可复用但需明确空值业务契约 | 高 | 4-C确认后 |
| 71 | CTV Survey FQ命名SP/CTV矛盾 | FQ | P71标题CTV、公式_SP_ | 本CSV无FQ字段 | — | E | 无权从标题猜名字 | 命名确认后仍需FQ导出才能自动比较 | 高 | BUSINESS_CONFIRMATION_REQUIRED |
| 71 | CTV Survey FQ 110天/一次/CP集合 | FQ | P71；本案无CTV survey | 无FQ实体/周期/回数 | — | D | 无法验证 | 需独立FQ数据，非HTML现有61列缺陷 | 高 | 4-C证据接入 |