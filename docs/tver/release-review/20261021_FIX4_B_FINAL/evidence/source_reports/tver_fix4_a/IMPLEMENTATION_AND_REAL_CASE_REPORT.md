# TVER FIX4-A 修改与真实案件报告

日期：2026-10-21。范围：CV、Ad时间、ASR 0~C。自动验证完成，真人GUI QA未执行。没有Commit、Push、上线或操作公司Chrome。

## 1. 权威基线与文件范围

- FIX3基线SHA256：`C8B4594C6EFEAC8F0DC5095ECD5F3D6C0F6437F496903F0CF020E1B0A72EFD13`，开始编辑前一致，基线快照保留于本目录。
- FIX4-A候选SHA256：`97A2842F7D87E34564C7A6F2E079E8CB29C487F0FA1668D936BD2E353C0888F0`。
- 本轮仓库改动仅`tver_check.html`和新增`tests/tver_fix4_a.test.js`；历史测试文件未改。工作树原有其他项目修改保留，逐文件hash核对见`workspace_hashes_after.json`。
- 报告、重放JSON、证据脚本及候选只读快照均在本交付目录，未写入业务输入目录。快照用于版本存档；本地运行使用仓库页面及其依赖库。

## 2. 根因与最小接线

### CV

1. 原`findSettingPairValue`全表成对查找会先命中报表指标G8/H8，模式变成“CV, 間接CV, 推定VTCV”。新增`findSettingCvValues`只读取主业务表之前的基本信息边界，且要求业务行首标签CV/CVポイント，实际模式取B18/C18，ID取D18/E18。共享成对查找函数其他用途未改。多处业务来源冲突保留需确认。
2. Register Campaign未将cv_point放入matchingFields/fields。旧比较读取空，但rawRows/sourceEvidence保留完整CSV原文。新增`readTverCsvCvPoint`只读取当前Campaign自己的证据，逐行验证集合；不改Register signature、聚合或身份。Edit显式按schema同样取证；空/非空跨行、不同集合、非法值保留需确认。
3. Setting描述原文没有ID集合语义。新增`parseTverCvPointCollection`只接受纯数字ID列表或Setting每行“说明：ID”；完整解析，禁止整表扫描数字或只取成功部分。保留名称、原始ID文本、全部sourceEvidence，稳定字符串排序，不用Number破坏长ID，不擅自消除前导零。
4. 复用既有显式canonical接口，`normalizeComparisonValue`与`compareField`函数原文未改。CVなし+双方空为一致；あり但无可靠ID/模式未知/矛盾/重复为需确认；明确集合缺少、多余、错误ID或CSV空为不一致。
5. 重复ID保留原文且显式需确认，理由CV_POINT_DUPLICATE_IDS，不静默去重成PASS。与旧审计A3“重复可信息提示”建议不同：本轮最新授权明确要求重复不能被静默掩盖，采用更保守且可见的专项处理；未改任何历史断言。

### Ad时间

旧代码对所有已比较Ad固定使用00:00/23:59，忽略Targeting时间。源码实际上已在`rawFields`及sourceEvidence保留時間指定，因此无需修改Targeting解析器/GP语义签名。新增`resolveTverAdTimeContract`：Ad→当前Setting父GP→其Targeting時間指定，只作用于该父对象。明确时间优先；无指定沿用00:00/23:59和CSV空值原有defer；有指示但格式/范围/来源冲突或CSV缺失则需确认。开始/结束各自比较。CSV时间原始来源通过现有`csvFieldSource`接线，保留行号、字段名和原文。时间跨午夜、未知文本没有业务依据时不自动推断。

### ASR

原已知Setting范围只认0~8/0のみ，CSV解析只接受数字。新增精确0~C展开及该范围专用CSV成员读取。已知成员为0–9/A–F，0~C期望只含0–9/A–C，出现额外D/E/F为明确不一致，未知字符/未知范围为需确认；重复成员为需确认。顺序变化允许。旧0~8/0のみ的数字归一化和历史重复语义不变。没有实现Survey D/E/F Setting规则或任意范围/模糊文本匹配。

### 与旧审计规格的差异

- 本轮正式授权把显式Ad时间、0~C ASR纳入FIX4-A；旧设计曾把它们分到FIX4-C/FIX4-B，本轮按最新范围实施。
- 旧设计称“新增時間指定来源”，实际源码已经保存原文，现复用rawFields来源。
- CV重复处理依本轮明确要求采用需确认，替代旧审计的信息提示建议。
- Survey模型、report_target_flag、Bid Exclude、角色ASR D/E/F等仍留FIX4-B；没有顺带修改。

## 3. Benesse完整重放

使用仓库SheetJS读取真实xlsx，执行正式parse→CSV tree→match→buildRun→horizontal；不是只数CSV。

| 模型/显示层 | Campaign | Ad Group | Ad |
|---|---|---|---|
| Setting模型 | 1 | 2 | 6 |
| CSV模型 | 2 | 5 | 7 |
| 匹配 | 1 | 2 | 4 |
| displayTree | 2 | 5 | 9 |
| 横表 | 2 | 5 | 9 |

通常已登记对象匹配CP1/1、GP2/2、Ad4/4；Setting还保留2个计划Ad。因此完整Setting Ad匹配是4/6，不能写成6/6。BLS仍未支持：Setting没有新增Survey对象，CSV侧1CP+3GP+3Ad继续未匹配。

| 版本 | 一致 | 表記ゆれ一致 | 不一致 | 需确认 | 未匹配 |
|---|---|---|---|---|---|
| FIX3 | 34 | 13 | 5 | 6 | 7 |
| FIX4-A | 38 | 16 | 0 | 4 | 7 |

正式entries前后均65项。7项判定变化如下；其余字段无统计修正。4项end_time仍为23:59/一致，仅改为明确时间来源。

| 层级/对象 | 字段 | 修改前 | 修改后 |
|---|---|---|---|
| 株式会社ベネッセコーポレーション_FY26秋冬施策_小ゼミ_運用型_F_WebUpper新小1CP_261012-1220 | cv_point | 不一致 | 表記ゆれ一致 |
| 広告グループ 1｜SPPC | uid_suffix | 需确认 | 表記ゆれ一致 |
| DMP_SPPC | uid_suffix | 需确认 | 表記ゆれ一致 |
| benesse_小ゼミFY26秋冬_➆新小1認知 (15秒)_TVer運用型_プレミアムレート | start_time | 不一致 | 一致 |
| benesse_小ゼミFY26秋冬_➇新小1ワレワレ (15秒)_TVer運用型_プレミアムレート | start_time | 不一致 | 一致 |
| benesse_小ゼミFY26秋冬_➆新小1認知 (15秒)_TVer運用型_プレミアムレート | start_time | 不一致 | 一致 |
| benesse_小ゼミFY26秋冬_➇新小1ワレワレ (15秒)_TVer運用型_プレミアムレート | start_time | 不一致 | 一致 |

剩余4项需确认：CP daily_budget（SETTING_EVIDENCE_NOT_PROVIDED）、CP hourly_bid_weight（HOURLY_BID_WEIGHT_RULE_PENDING），以及业务行32/35两个计划Ad（MISSING_CREATIVE_FILE_NAME）。未匹配7项均为CSV_SIDE_UNMATCHED的BLS对象；未删除、强配或忽略。

## 4. CV原始值与规范化

Setting sheet：2610-12_小ゼミ_F；模式C18=あり（标签B18）；点位原文E18：

```text
オーガニック経由のビュースルーサーチ計測：225
ペイド経由のビュースルーサーチ計測：226
入会完了サンクスページ：227
LP(サイト訪問数計測)：228
申込フォーム(前半)：229
```

CSV行2–5的cv_point均为：

```text
225 226 227 228 229
```

| 侧 | 规范化ID集合 | 结果 |
|---|---|---|
| Setting | 225 226 227 228 229 | 表記ゆれ一致 |
| CSV | 225 226 227 228 229 | 表記ゆれ一致 |

CV entry CSV原文来自行2 cv_point，完整sourceEvidence仍含2–5行；Setting保留C18和E18来源。BLS行6–8 cv_point空，未复制通常CV，也没有为CSV侧未匹配Campaign创建CV entry。

## 5. Ad时间对应关系

| Targeting | Setting业务行/素材 | 明确范围来源 | CSV行 | 开始 | 结束 | 判定 |
|---|---|---|---|---|---|---|
| 1 | 30 / 新小1認知 | D71=6:00~23:59 | 2 | 6:00 / 6:00 | 23:59 / 23:59 | 一致 / 一致 |
| 1 | 31 / 新小1ワレワレ | D71=6:00~23:59 | 3 | 6:00 / 6:00 | 23:59 / 23:59 | 一致 / 一致 |
| 2 | 33 / 新小1認知 | I71=6:00~23:59 | 4 | 6:00 / 6:00 | 23:59 / 23:59 | 一致 / 一致 |
| 2 | 34 / 新小1ワレワレ | I71=6:00~23:59 | 5 | 6:00 / 6:00 | 23:59 / 23:59 | 一致 / 一致 |

两GP虽然本案时间相同，专项测试另用6:00–23:59与8:00–21:30验证不交叉继承。开始错误、结束错误分别产生不一致；未知/冲突时间不落入默认。Airbnb默认23:59 vs CSV23:45仍报真实不一致。

## 6. ASR结果

| GP | Setting原文 | CSV原文 | Setting/CSV规范化 | 判定 |
|---|---|---|---|---|
| 広告グループ 1｜SPPC | 0~C | 0 1 2 3 4 5 6 7 8 9 A B C | 0 1 2 3 4 5 6 7 8 9 A B C / 0 1 2 3 4 5 6 7 8 9 A B C | 表記ゆれ一致 |
| DMP_SPPC | 0~C | 0 1 2 3 4 5 6 7 8 9 A B C | 0 1 2 3 4 5 6 7 8 9 A B C / 0 1 2 3 4 5 6 7 8 9 A B C | 表記ゆれ一致 |

Targeting1/2来源D64/I64；完整序列13个成员。专项负例验证缺C、多D均不一致；重复C、非法G、未知1~C均需确认；反序集合允许。0~8及0のみ继续走旧规则。

## 7. AXA与Airbnb保护

| 案件 | CP/GP/Ad匹配 | 一致 | 表記ゆれ一致 | 不一致 | 需确认 | 未匹配 |
|---|---|---|---|---|---|---|
| AXA | 1/10/10 | 125 | 43 | 2 | 2 | 0 |
| Airbnb | 3/6/6 | 80 | 46 | 6 | 6 | 0 |

与同一FIX3快照重放逐项比对：两案所有entries的字段、原始Setting/CSV值、canonical及判定完全不变。

### AXA完整2项Device不一致

| 对象 | 字段 | Setting | CSV | 判定 |
|---|---|---|---|---|
| 興味関心_DMP_CTV | device | ctv | （空白） | 不一致 |
| 年齢_CTV | device | ctv | android ios pc | 不一致 |

### Airbnb完整6项真实不一致

| 对象 | 字段 | Setting | CSV | 判定 |
|---|---|---|---|---|
| マクロミル | device | pc | android ctv ios pc | 不一致 |
| マクロミル | dmp_segment_expansion_threshold | 10 | 50 | 不一致 |
| マクロミル | device | ios | android ctv ios pc | 不一致 |
| マクロミル | dmp_segment_expansion_threshold | 10 | 50 | 不一致 |
| 30-Provoke Inspire_Celeb_Midnight Secret Talk_JP_JPN_OTT_Tver_16x9 | status | 1 | 0 | 不一致 |
| 30-Provoke Inspire_Celeb_Midnight Secret Talk_JP_JPN_OTT_Tver_16x9 | end_time | 23:59 | 23:45 | 不一致 |

## 8. 保护边界与验证

- 原739项历史断言全部通过、未改期望；新增32项全部通过，总771/771，失败0、skip0。新增数量只来自专项测试文件。原有测试覆盖旧/新FMT、Register/Edit、Campaign/GP/Ad、Device/DMP/Tracking/CR、Navigator、Auction排除及Schema。
- TDD：新增32项在FIX3上先出现28失败/4通过，实施后32通过；另补时间CSV sourceRef断言，先失败（null），接入现有source reader后通过。
- 自动证据脚本确认以下函数源码完全相同：`buildRegisterTree`、`buildEditTree`、`matchTverEntities`、`createTverConversionContext`、`makeTargetingGroup`、`createTverFix1IdentityScope`、`normalizeComparisonValue`、`compareField`、`detectTverCsvSchema`。
- Register/Edit各61列，header逐元素完全不变，保留auction_type；三实案auction entries均0，历史Auction值1/2/空等排除测试通过。
- 三案整个CSV模型、Setting身份键/父关系/签名、完整matching输出、显示数量和横表数量均与FIX3相同。所有非CV/时间/ASR字段的完整entry及sourceRefs完全相同。没有修改比较统计、Navigator或显示层。
- 所有非空内联脚本以new Function编译成功；git diff --check通过。
- 全部真实xlsx/CSV与手册hash和上轮审计一致，原件未修改；原有不相关工作树文件hash一致。
- AXA G105模板警告仍存在，未修改Targeting解析器；FIX1窄身份范围不变；Survey/计划生命周期留后续。

## 9. 命令与可复核证据

```powershell
node --test tests/tver_check.test.js tests/tver_mismatch_navigator.test.js tests/tver_release_prep.test.js tests/tver_c3c5_cr_reopen3.test.js tests/tver_c3c5_cr_reopen5.test.js tests/tver_c3c5_cr_reopen5_fix1.test.js tests/tver_fix4_a.test.js
node tests/tver_real_file.verify.js --root "D:\業務用\開発用\2課_設定依頼\003"
node tests/tver_real_file.verify.js --root "D:\業務用\開発用\2課_設定依頼\001"
node tests/tver_real_file.verify.js --root "D:\業務用\開発用\2課_設定依頼\002"
node "C:\Users\BPO\.codex\visualizations\2026\10\19\01a15208-5b3d-7750-a13b-65d9bb604c3a\tver_fix4_a\verify_real_cases.js"
```

- full_regression.log：完整771项输出。
- real_case_evidence.json：逐字段前后差异、CV/时间/ASR所有来源、三案异常。
- benesse_replay.after.json / axa_replay.after.json / airbnb_replay.after.json：真实模型、匹配、entries、显示计数。
- verify_real_cases.js：基线/候选同输入重放与不可变条件断言。
- workspace_hashes_before/after.json：本轮文件边界；source_hash_verification.json：业务原件SHA。
- FIX4_B_CONFIRMATION_CLASSIFICATION.md：11项原问题、证据、建议、影响及A/B分类。
- REAL_GUI_QA_PLAN.md：下一步真人验收清单；本轮未执行。

## 10. 原始业务证据路径及SHA256

| 案件 | 真实路径 | SHA256 |
|---|---|---|
| AXA | D:\業務用\開発用\2課_設定依頼\001\【5777_アクサ生命保険株式会社】摺合シート.xlsx | 49A94BF8E9C7DFAE74C22E32A7D223274BE17723B70231B221EEEED36EA566E5 |
| AXA | D:\業務用\開発用\2課_設定依頼\001\5777_register_campaign_adgroup_ad_202609291403.csv | 052CEE755D41DB30D09AC7E21C60B8DE2F1AFF99E35ED46AA8499377C73F1FEE |
| Airbnb | D:\業務用\開発用\2課_設定依頼\002\【3883_Airbnb Japan株式会社】摺合せシート.xlsx | 1DE0A621ECBC4987B204CAC6A1588303215A5A560FD5F256143E4E0AEDE42BEF |
| Airbnb | D:\業務用\開発用\2課_設定依頼\002\3883_register_campaign_adgroup_ad_202610191036.csv | E32160FE84BF719BC43B6CA78AD1FA112B4F4D4DB966F08F1A989A121F1267D4 |
| Benesse | D:\業務用\開発用\2課_設定依頼\003\【4877_株式会社ベネッセコーポレーション(HDYONE)】摺合せシート.xlsx | AEF47B223EF1FB52EE98999DCED5AAA9431971E67CB9D6A0B851442EFB76AB4C |
| Benesse | D:\業務用\開発用\2課_設定依頼\003\4877_register_campaign_adgroup_ad_202610211449.csv | 356EDD1332F4F85034FF1F38E71431CDAAFDC530908EB00DB2842C54F8FCA29E |
| Manual | D:/業務用/開発用/2課_設定依頼/003/※長春用※TVer管理画面マニュアル_20260827.pptx | DD3315D54A2FE48612F5FF430871D8614645E92157884D3381BEAA39E7FAA1A3 |
