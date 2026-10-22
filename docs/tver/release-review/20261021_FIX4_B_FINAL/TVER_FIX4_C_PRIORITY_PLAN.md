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

| 顺序/原记录 | 业务范围及目前状态 | 建议开发与前提 | 最低负例 |
| --- | --- | --- | --- |
| 1 /052 | 普通bid_segment_exclude=C；Survey SP已支持，勿重做 | 先取得普通配信非空真实Setting/CSV配对，增加可靠业务标签/ID读取，复用集合与独立字段比较；不套Survey固定Scenario | 指定/除外互换、漏/多/错ID、重复、空/未知、父GP误关联 |
| 2 /096 | SP Noncontact Media/Contents白名单仅不继承=B | P61已说明不设置；先用已验SP契约对CSV已有media/local_broadcaster/contents_group明确空值检出。确认CSV字段中空与平台默认/无指定表达的等价关系后执行 | 意外多填、正常空、普通GP仍按原值比较、Edit缺列/冲突 |
| 3 /047 | 普通genre/subgenre指定include=C；exclude048已A | 增加指定模式Setting来源与权威字典映射，复用exclude架构但独立字段；不要把除外当指定 | include/exclude互换、漏/多ID、未知/别名不明、顺序/重复 |
| 4 /054 | 普通DMP除外=C | 使用明确业务ID来源，不复制DMP include；真实非空样本+各Schema列可用性核实 | include/exclude错列、错误阈值适用性、漏/多/非法ID |
| 5 /034 | GP每日FQ default/明确设置=C | 仅做CSV daily_freq_cap与明确GP规则；与期间FQ分开。先确认“不使用”对应CSV表示并取得真实值 | default/0/空有别、非默认异常、不能把期间110天当每日FQ |
| 6 /043 | 普通興味関心=C；Survey选中业务文本review | 有可靠ID或权威版本字典+业务槽后接线；自由文本/未知仍review。缺Master部分转P2 | 备注误读、同名多ID、漏/多ID、错父/错Targeting |

这些是P1候选，只有真实样本/权威规则/空值契约达标后才进入实施；仅有CSV列名不足。每次最小增量，复用同一HTML，独立Code Gate与真人验收。

## P2：先补业务确认/其他导出或新版本证据

| 记录/业务 | 当前缺口 | 下一步 |
| --- | --- | --- |
| 050 コンテンツグループ；045 テレビ視聴傾向/Carrier | 有CSV但普通Setting映射/版本化Master/有效业务样本未闭环 | 提供权威字段含义、ID映射、有效Setting槽及实案；不靠名称模糊 |
| 042/070 City，039/073 Local/Media，049别名 | City缺Master；Local子集/排除表达与别名证据不全 | 提供版本Master和明确默认/排除含义；保持未知review |
| 062/063/099/113 Campaign/Survey期间FQ | 61列没有完整独立实体、期间、CP集合 | 取得FQ独立导出；普通daily_freq_cap不等同该功能 |
| 078–080 Scheduler | 没有未来执行时间/重复规则/对象/计划状态数据 | 定义Scheduler专用导出/后台证据与CP ID关联；当前daily_budget不能代替 |
| 065–067 Dashboard | 没有Dashboard实体、指标顺序与CP关系数据 | 专用导出或受控人工QA；不能以CV字段存在冒充 |
| 101–113 Survey CTV；旧Survey系统 | 设备/命名/文字截图矛盾与版本角色规则未明；无已验类型模型 | 独立确认、实案与版本契约；禁止直接套SP android ios/ASR/bid空 |
| 085/093 Survey日期与多CP/多Contact/任意后缀 | 短月无同日、父子角色/引用不唯一 | 确认月末算法及明确映射表；现有review/诊断不强配 |
| 094 Affinity自由文本；058/097 Edit Ad状态；计划Ad | 缺权威ID或当前状态来源/生命周期规则 | 保留保守原因，取得业务来源后扩展；不删除计划Ad |
| 027/029自动日均与小时分配；060其他Tracking地点 | Setting时点/完整合同或标签规则不全 | 确认真实来源/默认/上限及原始CSV字段，先补证据 |
| 账户/素材库存/Transcode/Companion/视频实际规格 | 61列没有必要实体和属性 | 需要其他导出或人工QA，不判现有HTML缺陷 |

## 后续验证与业务问题

1. Contact非空ASR继续review，不自动一致也不强判错误；仅空本案可比较。需要业务决定时独立变更合同。
2. Survey CTV的设备、命名、文字/截图优先级及旧系统Segment类型需分版本确认；不阻断已有新TAP SP规则。
3. SP短月/多CP/多Contact、自由Affinity Master、Edit当前Ad状态、无明确分支标签须明确实际输入。
4. 两个计划Ad继续review；不能凭当前CSV缺少就忽略或强配。
5. 真正缺CSV的FQ/Scheduler/Dashboard需先确定导出方案；普通字段补齐与这些实体功能分开估算。

后续每项TDD正负例、完整837历史基线及新增测试、三真实案件逐字段对比、61列Schema/Auction排除/Navigator验证，再做针对性真人QA。本轮未新增或修改测试、未开发FIX4-C。
