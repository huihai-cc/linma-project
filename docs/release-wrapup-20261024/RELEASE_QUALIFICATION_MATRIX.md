# 发布资格矩阵 · my-qc-web 整体调整收尾

生成日：2026-10-24（Asia/Tokyo）
依据：原整体收尾指令 + ChatGPT 补充审核要求（A/B/C 三类清单、部署隔离、COMMIT/PUSH/DEPLOY 分报、最终矩阵）

> 原则：用户授权本轮 Commit/Push **不等于** 授权所有 Candidate 正式上线。仅 A 类（APPROVED_FOR_RELEASE）进入正式发布；B 类（CANDIDATE_ONLY）归档/隔离/保留；C 类（UNRELATED_OR_UNKNOWN）保留、不纳入本次发布。

---

## 一、A 类：APPROVED_FOR_RELEASE（可进入正式发布）

判定门槛（须同时满足）：①代码审核通过 ②用户完成要求的真实 GUI 验收 ③正式接线后必要验证通过 ④发布文件/依赖/版本/SHA256 明确 ⑤无未解决发布阻断项。

| 项目 | 当前版本 | SHA256（实物） | Code Gate | 用户 GUI QA | 备注 / 阻断项 |
|---|---|---|---|---|---|
| 使用情况仪表盘 FIX1A | 封板 FINAL 20261024 | `usage_dashboard.html` = `4fa0c20f…`（=已批准基线）；`usage_dashboard_logic.js` = `8662783b…` | 通过（`usage_dashboard_fix1a_seal` 7/7；全量 348 pass） | 报告记 `USER_REAL_GUI_QA = PASS`（真实 Chrome 验收） | **可进入发布候选**。必须排除案件分析 V1 功能混入。文件目前 UNTRACKED，尚未推送。 |
| 文本比较 V2 | 独立候选（待生产接线） | `candidate-route-a-v2/` 全量证据已归档 | 97 项通过（unit-final.tap）；只读代码审查无遗留 | **待确认**：VALIDATION_REPORT 自述「等待 ChatGPT 复核与用户手动验收」 | **见下方 §四决策点**：未确认真实 GUI 验收前，不得升格为正式入口，列为 B。 |

**结论**：严格按补充要求，本轮仅 **FIX1A 仪表盘** 明确满足 A 类全部门槛（已封板 + 真实验收 + 实物 SHA 与批准基线一致）。文本 V2 因「用户手动验收待确认」暂不满足 A。

---

## 二、B 类：CANDIDATE_ONLY（归档/保留/独立测试，不得升格为正式业务入口）

| 项目 | 实物 | SHA256 | 状态 | 处理 |
|---|---|---|---|---|
| 案件分析 V1 | `case_analysis_logic.js`、`gas_candidate/`、`usage_dashboard_case_candidate_20261024.html`、`docs/usage-dashboard/case_analysis_v1/`、`CASE_ANALYSIS_*_REPORT.md`、6 视图测试 | `case_analysis_logic.js` = `9561abc9…`；candidate HTML = `196946e01…` | 源码 Candidate 完成；线上 GAS 版本与真实日志状态**未核实** | **禁止**本轮合并 caseStats 到线上 GAS；**禁止**用 6 视图 Candidate 替换已封板 5 视图；全部隔离归档，后续单独真实 GAS Gate。 |
| YOMIKO 表头修复 | 官方 `yomiko_kanri.html`（=`9a1adb03…` 批准基线）；Candidate `yomiko_kanri_table_header_candidate_20261024.html` = `0162c35e…` | 官方=基线；Candidate=`0162c35e…` | Candidate 通过技术审核；**需核对用户是否对修复后 Candidate 完成真实 Chrome 验收** | 若仅「目测正常」不得扩大为全部业务功能验收；若用户明确确认 GUI 测试通过，可走独立 Gate 升格。 |
| 文本比较 V2（默认归类） | `docs/text-diff-investigation/20261024_DIFFf_READONLY_01/candidate-route-a-v2/` | core.js=`e0beb618…`；vendor/diff-8.0.2.js=`6290e229…`（与 PROVENANCE 一致） | 等待 ChatGPT 复核 + 用户手动验收；未接生产 | 见 §四。未确认前**不**写入 `tools_text.html` 正式入口。 |
| TVer 候选 | `tver_ctv_candidate_20261022.html`=`7d2e60ee…`、`tver_group_name_candidate_20261023.html`=`980dabbe…`、`docs/tver/`、`qa_tver_*/` | 见左 | 各自 Gate 待确认 | 走各自 Gate，不纳入本次发布。 |
| Amazon DSP 候选 | `amazon_dsp_check.html`（modified）、`docs/amazon_dsp/`、`tests/amazon_dsp_*.test.js` | — | 各自 Gate 待确认 | 走各自 Gate。 |
| DV360 / Meta / 3ka / Excel / 地域 / upload / Code.gs(+431) / workbench_concept 等 | 多文件 modified / untracked | — | 各自 Gate 待确认 | 走各自 Gate。 |

**根目录 Candidate HTML（部署风险）**：以下文件不在门户入口（`grep` 为空），但静态部署后可通过直接 URL 访问，构成「随 Push 意外公开」风险，须迁移到不参与部署的归档目录或本地备份区：
- `usage_dashboard_case_candidate_20261024.html`
- `yomiko_kanri_table_header_candidate_20261024.html`
- `tver_ctv_candidate_20261022.html`
- `tver_group_name_candidate_20261023.html`
- 各 `candidate-review-package.zip`、临时日志、测试截图

---

## 三、C 类：UNRELATED_OR_UNKNOWN（保留，不纳入本次发布）

- 本轮 Codex/Workbuddy 实际生成的临时测试目录：`_temp_extract/`、`_backup_case_v1_*/`、`_backup_fix1*/`、`.temp/`（2.7M）、`qa_tver_*/`、`scripts/`、`docs/text-diff-investigation/`（含 v1/v2 候选与证据）、`docs/*/candidate`、`docs/superpowers/`。
- 其他任务并发修改、归属不明的未跟踪文件：`docs/` 下大量 plan/spec/audit 文档、`node_modules/`、`package-lock.json`、`.workbuddy-ai/`、`.workbuddy/`。
- 尚未确认用途的旧版本 / 重复备份：多份旧候选与 `_backup_*` 快照（确认最终归档完整后可整理冗余副本，但不回滚/不覆盖）。
- 来源不明、仍可能被其他任务使用的文件：保留，列为待确认。

---

## 四、§ 决策点（须在不可逆操作前确认）

1. **文本 V2 用户验收状态**：原指令将 V2 视为「已验收」并要接生产；但 VALIDATION_REPORT 自述「等待用户手动验收」。若仅「目测无问题」，按补充要求只能记为外观反馈，**不得升格为正式入口**。→ 需用户明确确认「已完成要求的真实 GUI 验收」。
2. **index.html / yomiko_kanri.html HEAD 与工作区差异**：两文件实物 SHA 与已知批准基线一致（`937f09cb…` / `9a1adb03…`），但 `git` 报 modified vs HEAD（blob 不同），存在 HEAD/工作区分歧，须先 reconcile 再决定是否暂存。
3. **Commit 范围**：默认仅 FIX1A 封板文件进入 A 类提交；其余按 B/C 隔离，不 `git add .`。
4. **部署隔离**：确认 html-deploy 行为后，将根目录 Candidate/证据/审查包 ZIP 迁移到不参与部署的归档目录，避免随 Push 意外公开。
5. **桌面清理**：桌面 `my-qc-web`、`my-qc-web-p1-candidate`、`workbench_test`、`test.xlsx` 等，按「先清单后执行、仅移入回收站」原则，须先列清单并确认。

---

## 五、最终状态字段（仅允许以下值）

`RELEASED` / `SEALED_LOCAL_ONLY` / `CANDIDATE_ONLY` / `BLOCKED` / `EXCLUDED`

缺失用户真实验收的项目，不得因整体收尾授权自动判定 `RELEASED`。

---

## 六、本轮暂定结论（待用户确认后执行）

- **FIX1A 仪表盘** → `SEALED_LOCAL_ONLY` →（用户确认后）可 `RELEASED`（仅封板文件，不含案件分析 V1）。
- **文本 V2** → 验收未确认前 `CANDIDATE_ONLY`；确认验收 + 生产接线验证通过后，方可走独立 Gate。
- **其余所有并发任务改动** → `EXCLUDED`（本轮不发布，各自 Gate 跟进）。
