# BLS全部比较字段及实际结果

来源：真实Benesse工作簿与Register CSV，经当前候选正式SheetJS、模型、匹配、比较流程生成。不是手写统计或空白展示补丁。共69项：Campaign9、GP48、Ad12；61一致、8表記ゆれ一致、0不一致、0需确认。

原文为空时显示“（空白）”；这表示有角色规则支持的空集合，不表示缺少来源。来源不可靠的路径会生成明确需确认或未匹配诊断。CSV原始值未改写。

## Campaign / Survey Campaign

【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| campaign_name | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321 | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321 | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321 / 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321 | 一致 | TVER_SURVEY_SP_NAME |
| start_datetime | 2026/12/21 00:00 | 2026/12/21 0:00 | 2026-12-21 00:00 / 2026-12-21 00:00 | 表記ゆれ一致 | TVER_SURVEY_SP_START |
| end_datetime | 2027/03/21 23:45 | 2027/3/21 23:45 | 2027-03-21 23:45 / 2027-03-21 23:45 | 表記ゆれ一致 | TVER_SURVEY_SP_END |
| budget | 90000 | 90000 | 90000 / 90000 | 一致 | TVER_SURVEY_SP_budget |
| daily_budget | 1000 | 1000 | 1000 / 1000 | 一致 | TVER_SURVEY_SP_daily_budget |
| budget_type | 2 | 2 | 2 / 2 | 一致 | TVER_SURVEY_SP_budget_type |
| campaign_status | 0 | 0 | 0 / 0 | 一致 | TVER_SURVEY_SP_campaign_status |
| consumption_type | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_consumption_type |
| report_target_flag | 0 | 0 | 0 / 0 | 一致 | TVER_SURVEY_SP_report_target_flag |

主要来源：

- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R30 発注CPN名
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C15
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C150
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / B152
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H145
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H156
- embedded:TVer管理画面マニュアル_20260827 / P57 / campaign_name
- embedded:TVer管理画面マニュアル_20260827 / P57 / start_datetime
- embedded:TVer管理画面マニュアル_20260827 / P57 / end_datetime
- embedded:TVer管理画面マニュアル_20260827 / P57 / budget
- embedded:TVer管理画面マニュアル_20260827 / P57 / daily_budget
- embedded:TVer管理画面マニュアル_20260827 / P57 / budget_type
- embedded:TVer管理画面マニュアル_20260827 / P57 / campaign_status
- embedded:TVer管理画面マニュアル_20260827 / P57 / consumption_type
- embedded:TVer管理画面マニュアル_20260827 / P57 / report_target_flag

## Ad Group / contact

【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| adgroup_name | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者 | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者 | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者 / 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者 | 一致 | TVER_SURVEY_SP_GP_NAME |
| device | android ios | android ios | android ios / android ios | 一致 | TVER_SURVEY_SP_contact_device |
| price | 100 | 100 | 100 / 100 | 一致 | TVER_SURVEY_SP_contact_price |
| tver_video_duration | 15 | 15 | 15 / 15 | 一致 | TVER_SURVEY_SP_contact_tver_video_duration |
| adgroup_status | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_contact_adgroup_status |
| bid_segment | 7550 | 7550 | 7550 / 7550 | 一致 | TVER_SURVEY_SP_BID_SEGMENT |
| bid_segment_exclude | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_BID_SEGMENT_EXCLUDE |
| uid_suffix | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_CONTACT_ASR_EMPTY |
| gender | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_gender |
| age | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_age |
| pref | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_pref |
| annual_income | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_annual_income |
| demography | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_demography |
| dmp_segment | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_dmp_segment |
| dmp_segment_expansion_threshold | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_dmp_segment_expansion_threshold |
| affinity | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_contact_affinity |

主要来源：

- embedded:TVer管理画面マニュアル_20260827 / P58 / adgroup_name
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C15
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C150
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / B152
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H145
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H156
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R30 発注CPN名
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H146
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / D156
- embedded:TVer管理画面マニュアル_20260827 / P58 / device
- embedded:TVer管理画面マニュアル_20260827 / P58 / price
- embedded:TVer管理画面マニュアル_20260827 / P58 / tver_video_duration
- embedded:TVer管理画面マニュアル_20260827 / P58 / adgroup_status
- embedded:TVer管理画面マニュアル_20260827 / P59 / bid_segment
- embedded:TVer管理画面マニュアル_20260827 / P59 / bid_segment_exclude
- embedded:TVER_FIX4_B_USER_DECISION / Contact ASR / uid_suffix
- embedded:TVer管理画面マニュアル_20260827 / P59 / gender
- embedded:TVer管理画面マニュアル_20260827 / P59 / age
- embedded:TVer管理画面マニュアル_20260827 / P59 / pref
- embedded:TVer管理画面マニュアル_20260827 / P59 / annual_income
- embedded:TVer管理画面マニュアル_20260827 / P59 / demography
- embedded:TVer管理画面マニュアル_20260827 / P59 / dmp_segment
- embedded:TVer管理画面マニュアル_20260827 / P59 / dmp_segment_expansion_threshold
- embedded:TVer管理画面マニュアル_20260827 / P59 / affinity

## Ad Group / noncontact

【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| adgroup_name | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり / 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり | 一致 | TVER_SURVEY_SP_GP_NAME |
| device | android ios | android ios | android ios / android ios | 一致 | TVER_SURVEY_SP_noncontact_device |
| price | 100 | 100 | 100 / 100 | 一致 | TVER_SURVEY_SP_noncontact_price |
| tver_video_duration | 15 | 15 | 15 / 15 | 一致 | TVER_SURVEY_SP_noncontact_tver_video_duration |
| adgroup_status | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_noncontact_adgroup_status |
| bid_segment | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_BID_SEGMENT |
| bid_segment_exclude | 7550 | 7550 | 7550 / 7550 | 一致 | TVER_SURVEY_SP_BID_SEGMENT_EXCLUDE |
| uid_suffix | D E F | D E F | D E F / D E F | 一致 | TVER_SURVEY_SP_noncontact_uid_suffix |
| gender | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_gender |
| age | 25歳〜44歳 | 25 / 44 | 25-44 / 25-44 | 表記ゆれ一致 | TVER_SURVEY_SP_TARGETING_age |
| pref | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_pref |
| annual_income | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_annual_income |
| demography | 子あり | 1 | 1 / 1 | 表記ゆれ一致 | TVER_SURVEY_SP_TARGETING_demography |
| dmp_segment | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_noncontact_dmp_segment |
| dmp_segment_expansion_threshold | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_noncontact_dmp_segment_expansion_threshold |
| affinity | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_noncontact_affinity |

主要来源：

- embedded:TVer管理画面マニュアル_20260827 / P60 / adgroup_name
- embedded:TVER_FIX4_B_USER_DECISION / GP suffix / adgroup_name
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C15
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C150
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / B152
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H145
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H156
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R30 発注CPN名
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / I147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / D156
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C49
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / D49
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R63 デモグラフィック●
- embedded:TVer管理画面マニュアル_20260827 / P60 / device
- embedded:TVer管理画面マニュアル_20260827 / P60 / price
- embedded:TVer管理画面マニュアル_20260827 / P60 / tver_video_duration
- embedded:TVer管理画面マニュアル_20260827 / P60 / adgroup_status
- embedded:TVer管理画面マニュアル_20260827 / P61 / bid_segment
- embedded:TVer管理画面マニュアル_20260827 / P61 / bid_segment_exclude
- embedded:TVer管理画面マニュアル_20260827 / P61 / uid_suffix
- embedded:TVer管理画面マニュアル_20260827 / P61 / gender
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R58 年齢●
- embedded:TVer管理画面マニュアル_20260827 / P61 / age
- embedded:TVer管理画面マニュアル_20260827 / P61 / pref
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R61 世帯年収●
- embedded:TVer管理画面マニュアル_20260827 / P61 / annual_income
- embedded:TVer管理画面マニュアル_20260827 / P61 / demography
- embedded:TVer管理画面マニュアル_20260827 / P61 / dmp_segment
- embedded:TVer管理画面マニュアル_20260827 / P61 / dmp_segment_expansion_threshold
- embedded:TVer管理画面マニュアル_20260827 / P61 / affinity

## Ad Group / noncontact

【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| adgroup_name | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP / 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP | 一致 | TVER_SURVEY_SP_GP_NAME |
| device | android ios | android ios | android ios / android ios | 一致 | TVER_SURVEY_SP_noncontact_device |
| price | 100 | 100 | 100 / 100 | 一致 | TVER_SURVEY_SP_noncontact_price |
| tver_video_duration | 15 | 15 | 15 / 15 | 一致 | TVER_SURVEY_SP_noncontact_tver_video_duration |
| adgroup_status | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_noncontact_adgroup_status |
| bid_segment | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_BID_SEGMENT |
| bid_segment_exclude | 7550 | 7550 | 7550 / 7550 | 一致 | TVER_SURVEY_SP_BID_SEGMENT_EXCLUDE |
| uid_suffix | D E F | D E F | D E F / D E F | 一致 | TVER_SURVEY_SP_noncontact_uid_suffix |
| gender | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_gender |
| age | 25歳〜44歳 | 25 / 44 | 25-44 / 25-44 | 表記ゆれ一致 | TVER_SURVEY_SP_TARGETING_age |
| pref | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_pref |
| annual_income | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_annual_income |
| demography | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_TARGETING_demography |
| dmp_segment | 7541 | 7541 | 7541 / 7541 | 一致 | TVER_SURVEY_SP_DMP |
| dmp_segment_expansion_threshold | 50 | 50 | 50 / 50 | 一致 | TVER_SURVEY_SP_DMP_EXPANSION |
| affinity | （空白） | （空白） | （空白） / （空白） | 一致 | TVER_SURVEY_SP_noncontact_affinity |

主要来源：

- embedded:TVer管理画面マニュアル_20260827 / P60 / adgroup_name
- embedded:TVER_FIX4_B_USER_DECISION / GP suffix / adgroup_name
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C15
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C150
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / B152
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H145
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H156
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R30 発注CPN名
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / I147
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / D156
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / H49
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / I49
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / J49
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R63 デモグラフィック●
- embedded:TVer管理画面マニュアル_20260827 / P60 / device
- embedded:TVer管理画面マニュアル_20260827 / P60 / price
- embedded:TVer管理画面マニュアル_20260827 / P60 / tver_video_duration
- embedded:TVer管理画面マニュアル_20260827 / P60 / adgroup_status
- embedded:TVer管理画面マニュアル_20260827 / P61 / bid_segment
- embedded:TVer管理画面マニュアル_20260827 / P61 / bid_segment_exclude
- embedded:TVer管理画面マニュアル_20260827 / P61 / uid_suffix
- embedded:TVer管理画面マニュアル_20260827 / P61 / gender
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R58 年齢●
- embedded:TVer管理画面マニュアル_20260827 / P61 / age
- embedded:TVer管理画面マニュアル_20260827 / P61 / pref
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R61 世帯年収●
- embedded:TVer管理画面マニュアル_20260827 / P61 / annual_income
- embedded:TVer管理画面マニュアル_20260827 / P61 / demography
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R69 DMPセグメント
- embedded:TVer管理画面マニュアル_20260827 / P61 / dmp_segment
- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / R72 その他設定(ADG)
- embedded:TVer管理画面マニュアル_20260827 / P61 / dmp_segment_expansion_threshold
- embedded:TVer管理画面マニュアル_20260827 / P61 / affinity

## Ad / contact

【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| creative_name | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者 / 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者 | 一致 | TVER_SURVEY_SP_CREATIVE |
| status | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_REGISTER_AD_STATUS_DEFAULT_ON |
| start_time | 00:00 | 0:00 | 00:00 / 00:00 | 表記ゆれ一致 | TVER_SURVEY_SP_AD_DEFAULT_START |
| end_time | 23:59 | 23:59 | 23:59 / 23:59 | 一致 | TVER_SURVEY_SP_AD_DEFAULT_END |

主要来源：

- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C157
- embedded:TVER_260605 / Ad contract / status
- embedded:TVER_260605 / Ad contract / start_time
- embedded:TVER_260605 / Ad contract / end_time

## Ad / noncontact

【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| creative_name | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 / 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 一致 | TVER_SURVEY_SP_CREATIVE |
| status | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_REGISTER_AD_STATUS_DEFAULT_ON |
| start_time | 00:00 | 0:00 | 00:00 / 00:00 | 表記ゆれ一致 | TVER_SURVEY_SP_AD_DEFAULT_START |
| end_time | 23:59 | 23:59 | 23:59 / 23:59 | 一致 | TVER_SURVEY_SP_AD_DEFAULT_END |

主要来源：

- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C158
- embedded:TVER_260605 / Ad contract / status
- embedded:TVER_260605 / Ad contract / start_time
- embedded:TVER_260605 / Ad contract / end_time

## Ad / noncontact

【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者

| 字段 | Setting值（原文/规则期望） | CSV原文 | 规范化Setting / CSV | 状态 | 规则依据 |
|---|---|---|---|---|---|
| creative_name | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 / 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 一致 | TVER_SURVEY_SP_CREATIVE |
| status | 1 | 1 | 1 / 1 | 一致 | TVER_SURVEY_SP_REGISTER_AD_STATUS_DEFAULT_ON |
| start_time | 00:00 | 0:00 | 00:00 / 00:00 | 表記ゆれ一致 | TVER_SURVEY_SP_AD_DEFAULT_START |
| end_time | 23:59 | 23:59 | 23:59 / 23:59 | 一致 | TVER_SURVEY_SP_AD_DEFAULT_END |

主要来源：

- 【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx / 2610-12_小ゼミ_F / C158
- embedded:TVER_260605 / Ad contract / status
- embedded:TVER_260605 / Ad contract / start_time
- embedded:TVER_260605 / Ad contract / end_time

## 明确不适用项目

- Survey CP：CVポイント按本轮用户确认正式对象外，不生成cv_point entry；通常CP的CV比较不变。
- Survey Ad：入稿URL和所有Tracking比较按P62对象外，不生成相应entry，既不伪造空值一致，也不加需确认。普通Ad URL/Tracking完整entries与FIX4-A逐项相同。
- Auction仍为所有业务的校正对象外。
- media/contents不从普通配信复制到Survey。FQ/Scheduler/Dashboard、CTV/旧系统未实现为SP规则。
- 时间/状态使用既有Ad合同，不伪称P62明文规定这些默认值。Edit Ad当前状态没有可靠Setting依据时显示需确认；Register默认1不延伸成Edit期望。
