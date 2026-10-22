# TVER_FIX4_B_FINAL_SEAL_GATE

BASELINE_SHA_MATCH = YES

REAL_GUI_QA = PASS_USER_REPORTED

REAL_GUI_QA_SCOPE = BENESSE_SURVEY_SP

FULL_REGRESSION = 837/837 PASS (fail 0, skip 0)

AXA_REGRESSION = PASS

AIRBNB_REGRESSION = PASS

BENESSE_REGRESSION = PASS

SURVEY_SP_REGRESSION = PASS

AUCTION_EXCLUSION = PASS

SCHEMA_REGRESSION = PASS Register61/Edit61

PRODUCTION_HTML_UNCHANGED = YES

FINAL_SHA256 = CA3D99E13F6B64A1604C669A3AE51DD78EB037CADF1F04E362D43BF767519DD6

SEALED = YES

REAL_GUI_QA_SCOPE = BENESSE_SURVEY_SP。用户报告已用真实Chrome验收：一致（含表記ゆれ一致）123 /不一致0 /要確認4，Campaign2/2、GP5/5、Ad7/7。本轮没有操作Chrome；PASS只代表该案件范围，不扩大到全部历史案件或CTV。

## 冻结含义与范围

原位置tver_check.html保持权威SHA；另留同字节冻结副本evidence/tver_check.sealed.html与SEALED_VERSION.json，可核对后续变动。SEALED=YES仅指本地已验候选冻结、回归与报告完成，不表示Commit、Push或上线，也不是把全部手册覆盖缺口标成PASS。

本轮仅写本目录审核文档/证据/生成脚本；HTML、测试、业务原件及其他已跟踪项目文件均未改。工作树既有的其他媒体及历史未提交修改保留；没有stage、commit、push。进入时工作区已非干净状态，不能把当前git diff全算作本轮工作。

## 新鲜执行证据

完整命令（项目目录运行）：

```powershell
node --test tests/tver_check.test.js tests/tver_mismatch_navigator.test.js tests/tver_release_prep.test.js tests/tver_c3c5_cr_reopen3.test.js tests/tver_c3c5_cr_reopen5.test.js tests/tver_c3c5_cr_reopen5_fix1.test.js tests/tver_fix4_a.test.js tests/tver_fix4_b.test.js
```

结果837/837 PASS，fail0/cancelled0/skipped0/todo0；测试总数与基线相同，本轮无新增/删改/skip任何测试。[完整输出](evidence/full_regression.log)。

补充只读校验：node docs/tver/release-review/20261021_FIX4_B_FINAL/evidence/verify_seal.js。实际SheetJS读取原件，正式production parser/matcher/comparison/horizontal pipeline；Register/Edit headers均61且保留auction_type；三个真实案件auction entries均0；所有非空inline script可编译。没有修改Schema或数据来取得PASS。

| 案件 | Setting CP/GP/Ad | CSV CP/GP/Ad | Matched | 一致/表記ゆれ/不一致/要確認/未匹配 |
| --- | --- | --- | --- | --- |
| Benesse | 2/5/9 | 2/5/7 | {"Campaign":2,"Ad Group":5,"Ad":7} | 99 / 24 / 0 / 4 / 0 |
| AXA | 1/10/10 | 1/10/10 | {"Campaign":1,"Ad Group":10,"Ad":10} | 125 / 43 / 2 / 2 / 0 |
| Airbnb | 3/6/6 | 3/6/6 | {"Campaign":3,"Ad Group":6,"Ad":6} | 80 / 46 / 6 / 6 / 0 |

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
- [工作区进入快照](evidence/workspace_before.json)、[142个受保护文件未变化核验](evidence/workspace_unchanged.json)；包括全部跟踪文件与未跟踪TVer测试。
- [覆盖总报告](TVER_FUNCTION_COVERAGE_20261021.md)、[113条完整CSV](TVER_FUNCTION_COVERAGE_20261021.csv)、[FIX4-C优先计划](TVER_FIX4_C_PRIORITY_PLAN.md)。
- [历史审计/后续报告副本与SHA](evidence/source_reports_manifest.json)。交付不再仅在临时visualizations中。

## 待办与停止点

推荐FIX4-C先补Survey启用时通常SP Scenario/ASR完整性漏检；普通Bid Segment Exclude和SP意外Media/Contents可作为后续窄范围项目。CTV、旧Survey、FQ/Scheduler/Dashboard仍需专门证据。G105模板问题和通用Group模糊名称扩展仍DEFERRED。

已停在Final Seal Gate。没有开始FIX4-C，没有修改任何业务逻辑。
