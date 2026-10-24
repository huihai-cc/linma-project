# 清理清单与暂存/提交计划（先清单后执行）

生成日：2026-10-24。依据：原指令 Part 四 + ChatGPT 补充审核（可恢复、隔离候选、COMMIT/PUSH/DEPLOY 分报）。

> 处置符号：RETAIN 保留 / ARCHIVE 归档（迁至不参与部署的备份区）/ RECYCLE 移入回收站（仅明确可弃项）/ CONFIRM 待确认。

---

## A. 桌面（个人目录 · 高敏感，仅扫描，禁用 git clean / reset --hard / 批量永久删除）

| 原路径 | 处置 | 理由 |
|---|---|---|
| `C:\Users\BPO\Desktop\my-qc-web` | RETAIN | 项目工作副本本身 |
| `C:\Users\BPO\Desktop\my-qc-web-p1-candidate\`（P2B_*_CANDIDATE…） | RETAIN | 其他任务（P2B Header 迁移 / Amazon 封板候选）目录，本轮无关 |
| `C:\Users\BPO\Desktop\workbench_test\`（含 智能工作台分享版.html） | RETAIN | 其他任务/旧产物，非本轮生成 |
| `C:\Users\BPO\Desktop\test.xlsx` | RETAIN | 来源/用途不明，保留待确认 |
| `C:\Users\BPO\Desktop\WorkBuddy.lnk` | RETAIN | 快捷方式 |
| 桌面其余 38 项 | RETAIN | 不在本轮范围，不扫描删除 |

**桌面结论**：本轮不在桌面执行任何删除；仅记录。如需清理须另行明确清单与确认。

---

## B. 本项目临时/备份/测试目录（本轮 Codex/Workbuddy 生成）

| 原路径 | 大小 | 处置 | 理由 |
|---|---|---|---|
| `_temp_extract/` | 536K | ARCHIVE | 含 2431_setting.xlsx 等疑似业务输入 + 日志，保全 |
| `_backup_case_v1_pre_gate_fix/`、`_backup_case_v1_pre_preflight/`、`_backup_fix1/`、`_backup_fix1a/` | ~0.6M | RETAIN | 案件分析任务恢复备份（原始证据） |
| `.temp/` | 2.7M | RETAIN | c3c5_cr_reopen*、SDF.zip、xlsx 疑似其他任务 fixture |
| `.workbuddy-ai/` | 16K | RETAIN | 工具内部 |
| `qa_tver_c3b_v2/`、`qa_tver_c3b_v3/`、`qa_tver_floating/` | ~3.1M | RETAIN | TVer 任务 fixture，仍被测试引用 |
| `scripts/`（*.cjs 探针） | 72K | ARCHIVE | 本轮生成的临时测试脚本；确认无引用后归档副本，不直接删 |
| `docs/text-diff-investigation/`（v1/v2 候选+证据+审查包） | — | ARCHIVE | 文本 V2 审查包/证据，迁至不参与部署的归档区 |
| `docs/*/candidate`、`docs/superpowers/`、`docs/cross-media-setting-qc-audit/` 等 | — | RETAIN/ARCHIVE | 各任务 own Gate，按任务归档 |

**说明**：补充要求「来源不明、其他任务目录、仍有引用的 fixture、正在使用的候选一律保留」。因此真正可回收项极少；清理以「集中归档 + 整理冗余副本」为主，不永久删除。

---

## C. 部署风险项（须迁离部署路径，避免随 Push 意外公开）

| 文件 | SHA256 | 处置 |
|---|---|---|
| `usage_dashboard_case_candidate_20261024.html` | `196946e0…` | ARCHIVE→不参与部署目录 |
| `yomiko_kanri_table_header_candidate_20261024.html` | `0162c35e…` | ARCHIVE→不参与部署目录 |
| `tver_ctv_candidate_20261022.html` | `7d2e60ee…` | ARCHIVE→不参与部署目录 |
| `tver_group_name_candidate_20261023.html` | `980dabbe…` | ARCHIVE→不参与部署目录 |
| `docs/.../candidate-review-package.zip` ×2、`review-package.zip` | — | ARCHIVE（审查包独立安全存放） |
| 各 `tests/` 下测试截图/log（如含真实客户/员工数据） | — | ARCHIVE，禁止随部署发布 |

---

## D. 暂存/提交计划（COMMIT 前精确清单）

### D.1 本轮 A 类提交（仅 FIX1A 封板）
- `usage_dashboard.html`（`4fa0c20f…`，已批准基线；当前 UNTRACKED）
- `usage_dashboard_logic.js`（`8662783b…`；确认 untracked 后加入）
- `docs/usage-dashboard/seal/FIX1A_FINAL_20261024/`（MANIFEST.json / .sealed / README.md）
- `docs/release-wrapup-20261024/`（本矩阵 + 本计划 + 后续封板/报告）

**提交前核查（补充要求 Part 四）**：
1. 是否混入其他任务未提交修改 → 否（仅上述精确清单）
2. 是否改动已封板文件 → 否（仅新增封板文件本身）
3. 是否含未验收 Candidate → 否（candidate HTML 不暂存）
4. 是否含真实业务数据/凭证 → 否
5. 是否误删生产依赖/许可证 → 否
6. 是否有其他任务正在改同一文件 → index.html / yomiko_kanri.html 存在 HEAD/工作区分歧，**排除**本轮提交，先 reconcile

### D.2 明确不提交（保持隔离）
- `tools_text.html`（V2 未确认验收，不接生产）
- `index.html`、`yomiko_kanri.html`（HEAD 分歧，待 reconcile）
- 所有 `*_candidate_*.html`、`case_analysis_*`、`gas_candidate/`、`docs/amazon_dsp/`、`docs/tver/`、`qa_tver_*/`、`.temp/`、`_backup_*/`、`_temp_extract/`、`scripts/`
- `Code.gs`（+431，其他任务）、`workbench_concept.html`（deleted，其他任务）

### D.3 PUSH / DEPLOY 分报
- **COMMIT**：仅 D.1 精确清单（不 `git add .`）
- **PUSH**：正常推送 main，不强推
- **DEPLOY**：html-deploy 触发后，确认仅封板仪表盘等 A 类文件对外可达；候选/证据已迁离部署路径
- **PRODUCTION_ENTRY_CHECK**：核对 `index.html` 门户入口正常、`usage_dashboard.html` 资源路径（JS/CSS/Worker）正常、第三方库与许可证仍在、原自动测试仍可运行、FIX1A 封板可从备份恢复
- 若无法安全隔离未验收内容 → 暂停受影响文件 Push，其余明确可发布项继续
