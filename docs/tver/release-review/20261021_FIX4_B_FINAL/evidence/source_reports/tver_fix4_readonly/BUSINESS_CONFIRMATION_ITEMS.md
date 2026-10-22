# FIX4业务确认事项

状态：只读调查已完成，以下是FIX4实施前的业务确认清单与未来验收方案。本轮没有操作公司Chrome，也没有把自动重放说成真人QA。

## BUSINESS_CONFIRMATION_REQUIRED

| 编号 | 证据与问题 | 需要确认的具体规则 | 影响/阻塞阶段 |
|---|---|---|---|
| BC01 | P66/P68标题CTV，但文字与截图都选SD iOS/Android | CTV Survey问卷实际投放设备是否仍移动端；何时使用ctv token | CTV实现全部阻塞，不自动推导 |
| BC02 | P66 Contact命名模板CTV前缺_；P70 Creative模板_SP_而表中_CTV_；P71 CTV FQ模板_SP_ | 正式CP/GP/Creative/FQ各层命名公式、显式Excel名和模板优先级 | CTV identity/命名阻塞 |
| BC03 | P57/P65文字状态停止、日预算1000、结束23:45；P57截图有有效、日预算90000、结束23:30等旧示例 | 文字规则是否优先，例外以何种明确Setting证据覆盖 | Survey CP合同应先签定优先级；本案CSV符合文字 |
| BC04 | P57“3个月后”，P63“MAX110天”，本案C147=12/21，CSV CP至3/21，J25 FQ至4/10 | 3个月的月末/闰年夹取、结束日包含关系；FQ110天计数；名称结束日是否与CP日期同源 | 日期间隔边界测试；两种期间绝不混用 |
| BC05 | 本案H147=2非接触者GP，I147 Target1/Target2(50)；CSV后缀_子あり/_DMP；P60说消化用GP不要 | 多分支命名/身份映射规则；哪些DMP是有效Noncontact分支，哪些是消化用 | SP多分支唯一匹配；不能固定两GP或删除DMP |
| BC06 | 普通CVあり；BLS CSV cv_point空，P57只见空输入截图，没有明文CVなし | Survey CP的CV是否正式不设置/禁止/有特定例外；是否按类型对象外 | 不继承通常CV；未确认前保持Survey CV策略未知 |
| BC07 | P62/P70“URL、計測タグ設定不要” | 不必设置是否也允许已有额外值；额外CSV URL应对象外/需确认/不一致 | Survey URL/Tracking策略，不把VAST当Ad URL |
| BC08 | Setting业务行32/35计划素材，C86文件名空，P32/35 OFF；Scheduler11/2启用 | 本次10/21快照是否必须包含提前注册的停止Ad，还是后续补建；正式Creative文件名/ID | 两个计划Ad是否构成真正未匹配；保持需确认且不删除 |
| BC09 | 本案新TAPあり，旧SP/CTVなし；bls_*列均空 | 新TAP Scenario/VAST与旧BLS/CTV字段的正式版本关系及样例 | 不能用空旧列作新TAP校正依据；CTV另需真实案 |
| BC10 | P59 Contact不设置Audience/DMP，但没逐项列ASR/store等；P61 SP Noncontact不要媒体/Contents | 各角色字段的明确空值、默认值、允许遗留值及Setting例外优先级 | 防止复制普通全部Targeting；空值必须有来源 |
| BC11 | FQ、Scheduler、Dashboard、素材后台配置不在本61列 | 可提供的专门导出格式、最小必要字段及真人证据形式 | 相应功能只能列D，不能声称纯HTML修复后已验证 |

不需要新增业务决定即可提出修复的事实：本案B18/C18的CVあり；E18明确225–229；CSV2–5行同一集合；D71/I71的6:00–23:59；现有ASR只认0~8/0のみ；Survey区块当前未解析。这些证据本轮已确认，但本轮仍不实施。

