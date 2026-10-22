# Contact ASR边界最小修复

日期：2026-10-21。基线SHA确认一致，用户报告Benesse此前真人Chrome结果为123一致（含表記ゆれ一致）、0不一致、4要確認；本修正后的最终GUI尚待用户确认。

## 修改范围

仅修改tver_check.html的Survey比较输入生成器：businessType=survey-sp、level=Ad Group、surveyRole=contact、field=uid_suffix且CSV非空时，增加保守理由SURVEY_CONTACT_ASR_RULE_PENDING并不可比较/需确认。已有非法token、重复、跨行冲突等原因优先保留，不会把非法CSV直接当一致。新理由有日文说明。

原Setting值、CSV值、sourceRefs/sourceEvidence、canonical均保留。空CSV仍一致；不修改Survey模型、其他字段、非接触者正式D E F或普通GP的ASR。

## 测试预期更新依据

原830项中的“FIX4-B negative field uid_suffix=0 1 2 row 0”原先要求不一致，现根据本轮正式业务澄清更新为需确认。该项仍执行；其余历史预期不变，未删除/skip测试。新增7项：Contact空、D E F、0 1 2、非法；Noncontact正确、错误；普通GP0~C。TDD先复现两项有效非空输入误报，修复后全部837/837通过。

## 真实案件

Benesse完整Setting/CSV模型、matching、summary、所有entries与FIX4-B基线完全相同：匹配2CP/5GP/7Ad；Setting仍2/5/9；统计99/24/0/4/0。Contact实际CSV为空，仍一致。两个计划Ad继续需确认，BLS69项正式比较保留。AXA、Airbnb也做了同一输入下全部实体/比较entry逐项相等验证，而非仅比统计。

原始业务xlsx/CSV/手册7份SHA与先前一致。读取明确原件路径，未修改业务文件。所有非空inline script可编译；git diff --check通过。

## Benesse内存边界重放

| CSV原文 | FIX4-B | 本修正 | 原因 |
|---|---|---|---|
| （空白） | 一致 | 一致 | TARGETING_BOTH_VALUES_EMPTY |
| D E F | 不一致 | 需确认 | SURVEY_CONTACT_ASR_RULE_PENDING |
| 0 1 2 | 不一致 | 需确认 | SURVEY_CONTACT_ASR_RULE_PENDING |
| D ? F | 需确认 | 需确认 | SURVEY_ASR_TOKEN_UNCONFIRMED |

这些变异只存在于内存副本。每个变异前后匹配完全相同，sourceEvidence/sourceRefs完全相同，除该Contact ASR entry之外其他所有entry完全相同。

## 文件与版本

仓库本轮仅tver_check.html、tests/tver_fix4_b.test.js有本任务变更；工作树既有其他文件与历史测试hash保持。测试中改1项旧预期并新增7项，完整输出见full_regression.log；真实来源、完整ASR证据见real_case_evidence.json。

SHA256_BEFORE = AE63AE30AA26B8E77BA258071FF6B0916FF79E8486A45F59805BE2F9141428E6

SHA256_AFTER = CA3D99E13F6B64A1604C669A3AE51DD78EB037CADF1F04E362D43BF767519DD6

## 最终GUI确认

使用仓库当前候选和原始Benesse文件：五状态仍99/24/0/4/0；Contact ASR空应一致；Noncontact D E F应一致；普通0~C仍表記ゆれ一致。非空Contact ASR的合成/测试副本应显示要確認及日文“業務ルール未確認”，不得进入不一致Navigator；保留CSV原文。不要覆盖业务原件。本轮不操作公司Chrome，不Commit/Push/上线。
