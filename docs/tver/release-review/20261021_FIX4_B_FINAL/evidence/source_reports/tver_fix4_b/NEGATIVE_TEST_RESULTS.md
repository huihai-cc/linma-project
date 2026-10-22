# Survey负例测试结果

原771项通过；新增59项通过，合计830/830，失败0、skip0。原有测试断言未改。完整命令/输出见full_regression.log。

初始48项用例在FIX4-A上46失败/2通过；后续增加来源、名称、Edit边界等保护，总59项。新增生产修复均由失败测试先复现；测试数据仅为代码生成的合成数据，不写入真实文件。合成Targeting标签槽曾修正为真实FMT的第3业务槽，未削弱预期结果。

## 真实案件内存变异（11组）

每组从原始CSV重建独立内存副本，正式parse/tree/match/compare；实体匹配始终2CP/5GP/7Ad，错误字段进入不一致；横表HTML包含Navigator的mismatch标记。未修改业务文件。

| 变异 | 检出字段 | Setting | CSV变异值 | 结果 |
|---|---|---|---|---|
| CP budget | budget | 90000 | 91000 | PASS / 不一致 |
| CP report flag | report_target_flag | 0 | 1 | PASS / 不一致 |
| contact wrong field | bid_segment | 7550 | （空白） | PASS / 不一致 |
| noncontact wrong field | bid_segment_exclude | 7550 | （空白） | PASS / 不一致 |
| DMP ID | dmp_segment | 7541 | 9999 | PASS / 不一致 |
| DMP expansion | dmp_segment_expansion_threshold | 50 | 10 | PASS / 不一致 |
| ASR missing | uid_suffix | D E F | D E | PASS / 不一致 |
| contact ASR unexpectedly set | uid_suffix | （空白） | 0 1 2 | PASS / 不一致 |
| Creative wrong | creative_name | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | wrong Survey Creative | PASS / 不一致 |
| Ad status | status | 1 | 0 | PASS / 不一致 |
| Ad end time | end_time | 23:59 | 23:45 | PASS / 不一致 |

## 59项新增用例

| 用例 | 结果 |
|---|---|
| FIX4-B model: real SheetJS builds independent SP CP/3 GP/3 Ad with sources | PASS |
| FIX4-B CP contract budget | PASS |
| FIX4-B CP contract daily_budget | PASS |
| FIX4-B CP contract budget_type | PASS |
| FIX4-B CP contract campaign_status | PASS |
| FIX4-B CP contract consumption_type | PASS |
| FIX4-B CP contract report_target_flag | PASS |
| FIX4-B CV is out of scope only for Survey; normal CV remains | PASS |
| FIX4-B GP independent role contracts do not inherit normal price/device/CV/ASR | PASS |
| FIX4-B N branches: one noncontact produces 2 GPs, not fixed 3 | PASS |
| FIX4-B detection: Survey disabled | PASS |
| FIX4-B detection: new TAP disabled | PASS |
| FIX4-B detection: CTV deferred | PASS |
| FIX4-B evidence guard: missing date | PASS |
| FIX4-B evidence guard: unknown Targeting reference | PASS |
| FIX4-B evidence guard: duplicate Targeting reference | PASS |
| FIX4-B evidence guard: plan count mismatch | PASS |
| FIX4-B evidence guard: missing Scenario ID | PASS |
| FIX4-B evidence guard: ambiguous Scenario ID | PASS |
| FIX4-B evidence guard: multiple CP plan without mapping | PASS |
| FIX4-B evidence guard: missing Survey Creative | PASS |
| FIX4-B negative field budget=91000 row 0 | PASS |
| FIX4-B negative field daily_budget=2000 row 0 | PASS |
| FIX4-B negative field budget_type=1 row 0 | PASS |
| FIX4-B negative field campaign_status=1 row 0 | PASS |
| FIX4-B negative field consumption_type=2 row 0 | PASS |
| FIX4-B negative field report_target_flag=1 row 0 | PASS |
| FIX4-B negative field bid_segment=999 row 0 | PASS |
| FIX4-B negative field bid_segment_exclude=999 row 1 | PASS |
| FIX4-B negative field uid_suffix=D E row 1 | PASS |
| FIX4-B negative field uid_suffix=D E F 0 row 1 | PASS |
| FIX4-B negative field uid_suffix=0 1 2 row 0 | PASS |
| FIX4-B negative field dmp_segment=999 row 2 | PASS |
| FIX4-B negative field dmp_segment_expansion_threshold=10 row 2 | PASS |
| FIX4-B negative field price=101 row 0 | PASS |
| FIX4-B negative field device=android ios pc row 0 | PASS |
| FIX4-B negative field start_age=26 row 1 | PASS |
| FIX4-B negative field demography=2 row 1 | PASS |
| FIX4-B negative field status=0 row 0 | PASS |
| FIX4-B negative field start_time=6:00 row 0 | PASS |
| FIX4-B negative field end_time=23:45 row 0 | PASS |
| FIX4-B wrong segment column cannot pass by sharing an ID | PASS |
| FIX4-B ASR: order is a set, duplicates and illegal characters remain review | PASS |
| FIX4-B Creative: wrong name is compared using unique declared parent role, never hidden | PASS |
| FIX4-B same Creative under distinct parents matches independently; duplicate parent Ad is ambiguous | PASS |
| FIX4-B parent scope: wrong CP cannot steal GP/Ad or compare across Campaigns | PASS |
| FIX4-B URL/Tracking exclusion applies even with CSV values but only to actual Survey entities | PASS |
| FIX4-B Edit schema keeps missing columns review; provides explicit report/segments/ASR | PASS |
| FIX4-B CP source conflicts do not fall back to the only ordinary parent | PASS |
| FIX4-B selected Audience text is unresolved, never silently treated as an empty set | PASS |
| FIX4-B DMP description without a reliable ID is review, not an empty DMP PASS | PASS |
| FIX4-B Campaign evidence conflict across rows is visible review; no first-row report flag | PASS |
| FIX4-B name canonical: identical fullwidth names and approved Creative variants remain equal | PASS |
| FIX4-B Edit Ad status cannot apply a Register-only current-status default | PASS |
| FIX4-B N branches: three noncontact references produce four role GPs/Ads | PASS |
| FIX4-B suffix: explicit comparable demographic label works; absent label remains review | PASS |
| FIX4-B calendar: three calendar months cross year correctly; uncertain short-month boundary defers | PASS |
| FIX4-B duplicate Campaign identity blocks parent/child matching instead of stealing candidates | PASS |
| FIX4-B new comparison fields have explicit business labels | PASS |
