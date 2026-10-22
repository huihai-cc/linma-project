# Benesse三级匹配及统计

日期：2026-10-21。FIX4-A基线：`97A2842F7D87E34564C7A6F2E079E8CB29C487F0FA1668D936BD2E353C0888F0`；FIX4-B候选：`AE63AE30AA26B8E77BA258071FF6B0916FF79E8486A45F59805BE2F9141428E6`。

| 版本/指标 | Campaign | Ad Group | Ad |
|---|---|---|---|
| FIX4-A Setting | 1 | 2 | 6 |
| FIX4-A CSV | 2 | 5 | 7 |
| FIX4-A Matched | 1 | 2 | 4 |
| FIX4-B Setting | 2 | 5 | 9 |
| FIX4-B CSV | 2 | 5 | 7 |
| FIX4-B Matched | 2 | 5 | 7 |
| FIX4-B 横表 | 2 | 5 | 9 |

按已登记CSV对象：CP2/2、GP5/5、Ad7/7；按全部Setting计划：Ad7/9，不能写成9/9。两个计划Ad仍为MISSING_CREATIVE_FILE_NAME需确认。

| 业务 | CP匹配 | GP匹配 | Ad匹配 | 备注 |
|---|---|---|---|---|
| 通常配信 | 1/1 | 2/2 | 4/4已登记 | 另有2个Setting计划Ad保留需确认 |
| 新TAP Survey SP | 1/1 | 3/3 | 3/3 | 接触1、非接触2；同名非接触Creative按各父GP独立关联 |

| 版本 | 一致 | 表記ゆれ一致 | 不一致 | 需确认 | 未匹配 |
|---|---|---|---|---|---|
| FIX4-A | 38 | 16 | 0 | 4 | 7 |
| FIX4-B | 99 | 24 | 0 | 4 | 0 |

entries由65变为127：原58项通常配信entry逐项完全不变；原7项CSV侧BLS未匹配entity entry被69项有来源的真实BLS字段比较替代。新增69项为61一致、8表記ゆれ一致。没有删除计划Ad或改统计函数。

剩余需确认4项：通常CP daily_budget、hourly_bid_weight，以及业务行32/35两个计划Ad。未匹配从7降为0，原因是新增Setting BLS 1CP/3GP/3Ad后真正匹配。

## BLS逐对象关联

| 层级 | Setting期望业务名 | CSV原始业务名 | 父级范围 | 实际比较项 |
|---|---|---|---|---|
| Campaign | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321 | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321 | 独立Campaign | 9 |
| Ad Group | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者 | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_接触者 | contact | 16 |
| Ad Group | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_子あり | noncontact | 16 |
| Ad Group | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP | 【BLS】株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_261221-0321_非接触者_DMP | noncontact | 16 |
| Ad | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_接触者 | contact | 4 |
| Ad | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | noncontact | 4 |
| Ad | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | 【BLS】2612_株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_SP_非接触者 | noncontact | 4 |

## 真实输入与SHA256

| 路径 | SHA256 |
|---|---|
| D:\業務用\開発用\2課_設定依頼\003\【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx | AEF47B223EF1FB52EE98999DCED5AAA9431971E67CB9D6A0B851442EFB76AB4C |
| D:\業務用\開発用\2課_設定依頼\003\4877_register_campaign_adgroup_ad_202610211449.csv | 356EDD1332F4F85034FF1F38E71431CDAAFDC530908EB00DB2842C54F8FCA29E |

目录验证器发现Excel打开期间的`~$...xlsx`临时锁文件，会拒绝自动选择（no cases found）。本轮没有删除锁文件或修改验证器；使用任务指定的精确业务文件路径，并与FIX4-A记录的SHA核对后重放。原始工作簿/CSV/手册7份hash全部保持。
