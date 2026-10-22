# TVER FIX4-B 修复报告

日期：2026-10-21。目标：在现有tver_check.html实现有真实证据的新TAP TVerSurvey SP；未新建页面。本轮未Commit、Push、上线或操作公司Chrome。

## 根因

FIX4-A只解析通常业务主表、Targeting和通常Creative；Survey区块没有生成Setting CP/GP/Ad。CSV已有BLS实体，因此显示的是CSV侧未匹配占位，字段比较没有输入。只改前端无法修复。

## 模型与取证

- 新增appendTverSurveySpModel，在通常模型解析后追加独立Survey业务对象；businessType=survey-sp，角色contact/noncontact、明确父关系、surveyContracts逐字段保存原文/规则值、canonical、sourceEvidence、规则ID及可比较性。CSV树/61列Schema与原聚合函数未改。
- 按基本情報TVerSurveyあり、新TAPあり、Survey有效SP角色区块、日期、计划数量、Scenario段ID、Survey Creative等共同确认。CSV【BLS】名称仅参与严格身份关联，不生成Setting期望值。CTV/旧系统单独诊断，不套用SP合同。
- 本案C15/C150/B152确认启用；C147开始日期；G145:H147计划1CP/1接触GP/2非接触GP，I147引用Target1/Target2(50)；C156/D156提供接触段名/7550；C157/C158提供Survey Creative。
- Survey CP预算90000、日预算1000、类型2、状态0、消化1、report_target_flag0来自P57合同。日期为开始日00:00至3个日历月后同日23:45，不混用FQ110天；短月无同日时输出SURVEY_MONTH_END_POLICY_REQUIRED，不猜月末规则。
- 普通CP关联要求明确运营栏名称提示或确实唯一父对象；重复提示/多CP无法唯一关联时诊断。当前支持一套明确1CP/1接触者的SP设计，非接触者N个按引用生成；测试覆盖1/2/3个非接触者。多CP、多接触者须补明确映射后扩展，不虚造数量。
- 非接触者GP后缀按本轮批准的明确Targeting标签构成。本案Target1使用D63子あり业务标签，Target2使用J49 DMP；不是公司/案件白名单，也不是从CSV反推期望。缺标签或相互冲突时保留需确认。

## 角色合同

- Contact：Device android ios、15秒、价格100、状态1；bid_segment=7550，bid_segment_exclude空；不继承通常Audience/DMP；用户确认无明确ASR时为空。
- Noncontact：同SP设备/尺/价格/状态；bid_segment空、bid_segment_exclude=7550；仅从明确引用Targeting复用允许的年龄/性别/地域/年收入/デモグラフィック及DMP证据，不整块复制通常GP。ASR=D E F。
- Target2 DMP7541、扩张50来自明确来源；DMP文本没有可靠ID时需确认，不当作空集合一致。Audience的备注槽与业务槽分离：本案F60/K60的说明不当业务选中值；真正选中自由文本无法可靠转换ID时可见需确认。
- 两个Noncontact各建一个Ad，共用C158同一Creative合法；按唯一父GP区分，不按全局Creative名竞争。
- Register Ad状态复用既有默认1，时间复用既有00:00/23:59，来源标注既有Ad合同，未冒称P62规定默认值。Edit当前Ad状态无可靠Setting依据时不提供虚假期望1，Setting为空、canonical=null、证据not_provided并需确认。Edit缺预算类型/视频尺/DMP列时明确schema unavailable。

## 三项本轮业务确认（已接入）

1. Survey CV对象外：不生成Survey cv_point entry；通常CV225–229仍正常比较。
2. Contact无明确ASR时CSV要求空，若填通常0~C等值则不一致。
3. 允许以明确Targeting标签生成多Noncontact后缀，保留原始来源。

Survey Ad的URL/Tracking按任务/P62正式不适用，仅Survey比较输入不生成这些字段；普通Ad所有URL/Tracking entry保持原样。Auction继续对象外。

## 匹配与错误检出

复用原Campaign名称匹配、唯一父CP下GP名称匹配、占用冲突保护。仅对有明确Survey模型的Ad增加“该GP声明一个Ad，且唯一CSV子Ad”的身份规则，使Creative填错仍可正常比较；多个子Ad一律MULTIPLE_HARD_CANDIDATES，缺父不跨Campaign强配。预算、Device、Segment、DMP、ASR不决定Survey身份。

字段比较使用独立Survey输入生成器，继续交给现有compareField及displayTree/horizontal/Navigator。Campaign/Creative两侧使用既有有限名称归一化，不引入模糊匹配。report_target_flag仅对Survey生成和显示，通常规则保持不比较。新GP名称、Segment除外、Audience列有明确日文标签。

## 回归与范围保护

- 原771/771 + 新增59/59 = 830/830，失败0、skip0；FIX4-A原32项全部保留。
- Benesse：Setting2/5/9、CSV2/5/7、Matched2/5/7；69项BLS真实比较，61一致、8表記ゆれ一致，无BLS误报或空白占位。
- AXA：1/10/10，125/43/2/2/0；兩項Device差异保留。Airbnb：3/6/6，80/46/6/6/0；六项真实差异全部保留，包括end_time23:59 vs23:45。
- 三案全部通常Setting实体、全部通常entry/sourceRefs、整个CSV模型逐项与FIX4-A相同。原始文件hash一致；原有其他项目文件和历史测试hash一致。
- 保持不变的函数原文：buildRegisterTree、buildEditTree、normalizeComparisonValue、compareField、makeTargetingGroup、createTverFix1IdentityScope、createTverConversionContext。没有修改通用normalizeComparisonValue/compareField、CSV聚合或FIX1身份范围。
- G105模板问题、CTV/旧系统、FQ/Scheduler/Dashboard及两计划Ad生命周期仍在后续范围。

## 审阅记录与限制

独立审阅收到的全角名称假不一致、Edit状态越用Register默认两项观察均已增加失败测试并修正；自身复核另修复了父名称冲突被回退、选中Audience被误当备注、无ID DMP被误当空值及来源主引用问题。独立审阅工具随后因额度中断，未取得完整独立审阅通过结论，不能把部分审阅写成完整批准。最终审批仍等待ChatGPT Gate。

## 文件及版本

仓库本轮仅修改tver_check.html、新增tests/tver_fix4_b.test.js。index.html、既有测试和其他项目未修改。

SHA256_BEFORE = 97A2842F7D87E34564C7A6F2E079E8CB29C487F0FA1668D936BD2E353C0888F0

SHA256_AFTER = AE63AE30AA26B8E77BA258071FF6B0916FF79E8486A45F59805BE2F9141428E6

本目录保存候选快照、基线、完整log、真实模型和重放脚本。快照用于版本记录；实际使用仓库页面和其原有依赖库。模型及比较细节见BENESSE_MATCH_AND_STATISTICS.md、BLS_ALL_COMPARISONS.md、real_case_evidence.json。
