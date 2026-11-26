# PROJECT_STATUS.md — 惠海 QC Portal｜唯一权威当前状态

> 本文件**只写当前真实状态**：运行基线、Gate、业务模块状态、待办、有效回滚点、必要环境信息。
> 分工：本文件 = **唯一权威当前状态**；`PORTAL_ARCHITECTURE.md` = 稳定架构与联动事实；`AGENTS.md` = AI 入口与禁改范围。**Git / Production 版本信息只在本文件维护。**
> 最后更新：**2026-11-23 JST（NO003 TVer UI 紧凑化 正式发布：源代码 commit `513947b94d5d0bb3125694f99a8b5fb0b6435907`；Vercel Production `dpl_Fx35X23gtjRdDVM9zRBp9xBnmvpR`（Ready，别名 `my-qc-web.vercel.app`）；线上 `tver_check.html` 833,195 B / SHA256 `bccc5828867e02bc224b23128d6e962162bb8526bc5963e81193bee9447639c6`；回滚基线 `76bd4b2` / TVer `a53627393826b3eb8735b8e2b656379becccd785882ecfd9745d0fd61a3c96dd`；L3–L5 NOT_RUN；STRICT_AUTHORIZATION_GATE=NOT_MET）**
> **2026-11-26 JST 追記（NO026 TL Meta Report Studio 現場反馈 7 項，Preview のみ・Production 未反映）**：実案件 **B0000412487** で 7 項目を修正。commit **`f0e4129`**（parent `b52b107`、変更 2 ファイル＝`tl_meta_report.html` 874,571 B / manifest の TL 行 1 行、+668/−69）。manifest **38 件**（7,688 B・CRLF 204）、build exit 0・38/38。**Preview `2t86iDtKUt6mHYdoVDUrNUhYbZ1a`** ／ `https://my-qc-ptmdnwl5z-huihaiqctool-s-projects.vercel.app`（Ready・Vercel Authentication 配下）。**Production は NO025 のまま**（`b05bd07b…` / 840,272 B）。内容：①案件レベルの使用頻度（正規化ファイル名の **SHA-256 案件キー**を `caseName`、操作種別を `note` に送信。生のファイル名は送らない。作成/校正/実行/案件数の 4 指標は送信データから復元可能。案件数の**表示**は GAS の summary 列追加が必要＝候補のみ・未適用）②作業頁に TODO 4 セル貼付（校正頁と同じ parseTodo・実パラメータへ反映・3 枚の RAW 期間照合・同一案件のみ校正頁へ引き継ぎ）③期間列 232px＋nowrap（100%/125% で 1 行）④校正頁のドラッグ領域 96px＋「2 冊必須」文言の全箇所是正⑤単一広告の独立画像は twoCellAnchor を正常とし交付組属性は【不適用(un)】（PASS にしない。0 枚＝未貼付・2 枚以上＝エラー）⑥【レポート定義】… を補助頁に分類（余分頁・広告・画像・CP・数値の対象外／カーソル・印刷範囲は継続／残存 RAW は従来どおり余分）⑦校正結果を業務項目 1 行に集約（底層 findings は保持・異常は全件展開・件数は項目数・未実施を通過にしない）。検証：エンジン 78/78・新規単体 38/38・実機 35/35（独立版）＋26/26（ポータル版）・内蔵スクリプト 16/16 一致・他ツール 37/37 不変。**保留：GAS 適用の合意、別案件（多 CP・和光・日経）での通し試走、旧型 RAW（期間列なし）の扱い**。
>
> **2026-11-26 JST 追記（NO025 TL Meta Report Studio ポータル統合，正式发布）**：1課トーチライトの Meta レポート作成／納品前チェックを `my-qc-web` の一ツールとして統合し正式公開。commit **`35ec635`**（parent `deb7942`、変更 3 ファイル＝`tl_meta_report.html` 新規 840,272 B / `index.html` +2 行 / `scripts/static-site-manifest.json` +7−1、+13,438/−1）。manifest **38 件**（7,688 B・CRLF 204）、`node scripts/build_static_site.cjs` exit 0・38/38 SHA 一致。Vercel Preview `7k7y3c8NVkZ48NXk4Ybf8p8BXUeP`（Ready）、Production **`4rQcABfaysvJqEx78tG9NAfKEM8E`**（Ready、別名 `my-qc-web.vercel.app`）。線上核验：`tl_meta_report.html` **840,272 B / `b05bd07bc92a6236a937ac7702310c5752880f1c0921238bc5e3c8270a63a19d`**、`index.html` 151,246 B / `31844c2c…`（HTTP 200・コミットのブロブと一致）。他ツールは manifest 38 件中 35 件が線上＝HEAD で一致（`bpo_weekly_report_malin.html` は既存の権限確認ミドルウェア経由のため差分）。**共通 Header**（`qc-header.js`／`qc-ui.css`）を再利用し専用 Header を廃止、**認証**は `guardPage()` をそのまま使用、**使用頻度**は「作成／校正」の能動クリック 1 回＝1 件を既存 `sendLog` の `note`（`report_create`／`report_check`）で送信（新規統計機構なし・失敗は業務を止めない）。**業務ロジックは無改変**（内蔵スクリプト 15 ブロックが独立版と SHA 一致、HTML 差分は 5 箇所のみ）。実機：ローカル／正式の両方で 41/41 PASS（入口・Header・言語・戻る・作成（実ファイル 4 本）・2 版 DL・校正（両版／単冊）・統計 6 段階・再読込・Console 0・100%/125%・統計遮断）、認証 3/3、エンジン回帰 78/78。回滚：`git revert 35ec635` もしくは Vercel で直前 Production へ Promote。**保留：GAS 集計表への TL 行反映確認と現場実案件の通し試走**。
>
>
> 前次更新：**2026-11-23 JST（NO002 TVer Group 名称精確匹配＋結果提示最適化 正式发布：源代码 commit `fb2ebf1d72c061b83b962c416d957c0bbd263a2b`；Vercel Production `dpl_3NHuVpVDJFqdiwQoR6zKZAdx3NWt`（Ready，别名 `my-qc-web.vercel.app`）；线上 `tver_check.html` 827,244 B / SHA256 `a53627393826b3eb8735b8e2b656379becccd785882ecfd9745d0fd61a3c96dd`；回滚基线 `f4f450e` / TVer `2067e310a69ba55a81b69ea6aed9d489fab86333c347874d47a7e3f4ca2cd2a1`；L3–L5 NOT_RUN；STRICT_AUTHORIZATION_GATE=NOT_MET）**
>
> **2026-11-23 JST 追記（NO003 TVer UI 紧凑化，正式发布）**：ユーザー無人参可（UI 修正＋全 Gate＋Commit/Push/Deploy＋本機 Git 安全同期）に基づき上线。发布前 `git fetch` 後 origin/main＝`76bd4b2`、远端 TVer＝`a5362739…`（827,244 B）＝线上で衝突なし。クリーン worktree `release/no003-ui-compact-20261123` で **`tver_check.html` と manifest の TVer 行のみ** を変更（+52/−7、バイナリコピーで候補 SHA 不変、manifest CRLF 199/199 維持）。`node scripts/build_static_site.cjs` exit 0、manifest **37/37 SHA 一致**、`public/` 37 ファイル、暂存 2 ファイルのみ、`git cat-file blob :tver_check.html`＝`bccc5828…`＝作業区＝候補。commit `513947b` → push（`76bd4b2..513947b`、非强制）→ Vercel 自動デプロイ **`dpl_Fx35X23gtjRdDVM9zRBp9xBnmvpR`**（Ready・2026-11-23 22:27 JST）。内容：①Sheet 名称検索＋参照シート名を同一行化（狭幅は折返し、検索/選択/必須検証は不変）②操作行を「チェック開始・リセット・一致/不一致/要確認・校正結果CSV（全件）・未完了ヒント」に集約③「未完了の校正項目があります…」の独立行を廃止し、hover / focus / click（tap）で開く小型ヒント（i）へ移動（Escape・外側クリックで閉じる、表のスクロール容器外なのでクリップなし、未完了が無ければ非表示）。**業務ロジックは一切変更なし**：2431 は 一致 304 / 不一致 2 / 要確認 32、Group 16/16、0% 12・100% 16・ADG 16・impression 16 行空白・CP status 不一致 2 を据え置き、CSV 61/62/63 列互換も維持。既有 TVer 回帰 **219/223**（失敗 4 件は前版と同一）。线上核验：3 幅（1920/1365/390）の真 Chrome で同一行・ツールチップ・横はみ出しなし・Console 0 を確認、线上 `tver_check.html` は 833,195 B / `bccc5828…`、他ツール 11/11 は線上 SHA ＝ HEAD blob。本機 main は §5 の手順で `76bd4b2` → `513947b` へ安全同期（ローカル未コミット変更は退避して復元）。証跡：`dev-materials/00_交付ChatGPT/20261123_NO003_TVER_UI紧凑化と本机Git安全同步/` と `dev-materials/01_测试运行数据/acceptance/20261123_NO003_TVER_UI紧凑化と本机Git安全同步/evidence/`。
>
> 前次更新：**2026-11-22 JST（NO001 TVer CSV 62列互換・未知項目検出 正式发布：源代码 commit `fa3331cf8ef9b64f5c03ec799bb76605943ce242`；Vercel Production `dpl_cBHxbUNKt9ThsGGQctsQfiAbSj39`（Ready，别名 `my-qc-web.vercel.app`）；线上 `tver_check.html` 814,197 B / SHA256 `2067e310a69ba55a81b69ea6aed9d489fab86333c347874d47a7e3f4ca2cd2a1`；回滚基线 `cba8716` / 原 SHA `13424c336b2918e03c4f8bd679af89225c45cf809267f80728fad059b57e34f9`；L3–L5 NOT_RUN；STRICT_AUTHORIZATION_GATE=NOT_MET）**
>
> **2026-11-23 JST 追記（NO002 TVer Group 名称精確匹配＋結果提示最適化，正式发布）**：ChatGPT の条件付き RELEASE APPROVED とユーザー发布指令（追加 PATCH 2 件を含む）に基づき上线。发布前 `git fetch` 後 origin/main＝`f4f450e`、远端 TVer＝`2067e310…`（814,197 B）＝指定基线で衝突なし。クリーン worktree `release/no002-group-match-20261123` で **`tver_check.html` と manifest の TVer 行のみ** を変更（+176/−10、バイナリコピーで候補 SHA 不変、manifest CRLF 199/199 維持）。`node scripts/build_static_site.cjs` exit 0、manifest **37/37 SHA 一致**、`public/` 37 ファイル、暂存 2 ファイルのみ、`git cat-file blob :tver_check.html`＝`a5362739…`＝作業区＝候補。commit `fb2ebf1` → push（`f4f450e..fb2ebf1`、非强制）。Vercel Production 自動デプロイ **`dpl_3NHuVpVDJFqdiwQoR6zKZAdx3NWt`**（Ready・2026-11-23 20:17 JST）。线上核验：`tver_check.html` **827,244 B / `a5362739…`**（HTTP 200・字节一致・リダイレクトなし）。线上真 Chrome：2431 実 CSV（62 列）識別→Sheet `2611-12_Fortune Bag`→チェック開始→一致 304 / 不一致 2 / 要確認 32、Ad Group 層の名称セルは「設定表 30, 52 行 / CSV 2 行」で**マニュアル P22/P25 の混入 0 件**、「対応未確定」0 件、impression は 54 列目・値あり 0 件／空白 16 件、61 列 CSV も同一の判定分布、Console は既有 `favicon.ico` 404 のみ。他ツール 11 ファイル（index / excel_compare / excel_clean / 3ka_check_tool / dv360_check / amazon_dsp_check / tool_logos.js / qc-ui.css / qc-auth.js / qc-header.js）は線上 SHA と HEAD blob が全一致。残課題（本轮対象外）：ADG デバイス別接尾辞の**自動対応は本輪で実装済み**（2431 は自動で 16/16）、`campaign_status` の業務裁定 2 件、media 局辞書、`UNIQUE_PARENT_REMAINDER_AFTER_CONFIRMED_PAIRS` の残量フォールバック（名称は要確認のまま）。証跡：`dev-materials/00_交付ChatGPT/20261123_NO001_TVER_Group名称精確匹配と結果提示最適化/` と `dev-materials/01_测试运行数据/acceptance/20261123_NO001_TVER_Group名称精確匹配と結果提示最適化/evidence/`。
>
> 前次更新：**2026-11-16 JST（NO026 region_check 表格显示修复正式发布：源代码 commit `738c260`；Vercel source deployment `3E9S9A1csom3vNtcpRw9KQmvtnHv` success；Production region_check.html 159749 B / SHA256 `2ebdc6dd176fe02b454e9aa1d78c856acb935ca456fcde406aa8a7333eb3f401`；回滚基线 `1812cbc` / 原 SHA `407edc91ee096cb869c081c55ae2973254304646770e196cf326a4391903c584`；L3–L5 NOT_RUN；STRICT_AUTHORIZATION_GATE=NOT_MET）**
>
> **2026-11-22 JST 追記（NO001 TVer CSV 62列互換・未知項目検出，正式发布）**：ChatGPT の条件付き RELEASE APPROVED とユーザー发布指令に基づき上线。发布前：`git fetch` 後 origin/main＝`cba8716`、远端 TVer＝`13424c33…`（800,791 B）＝本机＝指定基线で**冲突なし**。クリーン worktree `release/no001-csv62-20261122`（origin/main 基点）で **`tver_check.html` と `scripts/static-site-manifest.json` の TVer 行のみ** を変更（+201/−36、バイナリコピーで候補 SHA 不変、manifest は CRLF 199/199 維持）。`node scripts/build_static_site.cjs` exit 0、manifest **37/37 SHA 一致**、`public/` 37 ファイル、暂存 2 ファイルのみ、`git cat-file blob :tver_check.html`＝`2067e310…`＝作業区＝候補。commit `fa3331c` → `git push origin HEAD:main`（`cba8716..fa3331c`、非强制）。Vercel Production 自動デプロイ **`dpl_cBHxbUNKt9ThsGGQctsQfiAbSj39`**（Ready・2026-11-22 22:46 JST）。本書更新の docs commit `7258602` も自動デプロイされるが、`PROJECT_STATUS.md` は manifest 対象外のため出力バイトは不変（线上 `2067e310…` を再確認）。线上核验：`tver_check.html` **814,197 B / `2067e310…`**（HTTP 200・字节一致）；他ツール 10 ファイル（index / excel_compare / dv360_check / amazon_dsp_check / excel_clean / 3ka_check_tool / tool_logos.js / qc-ui.css / qc-auth.js / qc-header.js）は線上 SHA と HEAD blob が**全一致**。线上真 Chrome：ログイン状態で描画（qcHeader 実描画・リダイレクトなし）、2431 実 CSV（62列）識別→Sheet `2611-12_Fortune Bag`→チェック開始→impression「値あり 0 件／空白 16 件」表示、61 列 CSV も識別・実行可（一致236/不一致2/要確認194 は 62 列と同一）、Console は既有 `favicon.ico` 404 のみ（リポジトリに favicon 無し・本轮不関与）。ローカル preview も再確認（クリック／ドラッグ＆ドロップ両経路、63 列未知項目で「新規ダウンロード項目については、開発担当者へご連絡ください」表示、Console 0）。残課題（本轮対象外）：ADG デバイス別接尾辞の自動対応（2431 は手動対応 16 件で 16/16 一致に到達）、`campaign_status` の業務裁定、media 局辞書。証跡：`dev-materials/00_交付ChatGPT/20261122_NO001_TVER_CSV62列互換と未知項目検出/` と `dev-materials/01_测试运行数据/acceptance/20261122_NO001_TVER_CSV62列互換と未知項目検出/evidence/`。
> 历史过程不在本文件展开；各任务的最终结论与证据位置见 §9。

---

## 1. 生产运行基线（唯一权威版本信息）

| 项 | 值 | 验证方式 |
|---|---|---|
| 本机仓库 / 分支 | `C:\Users\BPO\Desktop\my-qc-web` / `main` | — |
| **HEAD / Production source** | **`738c260cf626fcca436a193f98180a4cf16f771d`**（NO026 region_check 发布 commit；后续状态记录提交不改变静态资源字节） | GitHub main；2026-11-16 JST |
| 批准基线 / parent | `1812cbc0c8aae11f5ff79f256f746749124f2963` | NO026 发布前 Production / origin/main 基线；回滚使用该提交或 `region_check.html` SHA `407edc91ee096cb869c081c55ae2973254304646770e196cf326a4391903c584` |
| **Vercel Production Deployment（NO026 源代码发布）** | **`3E9S9A1csom3vNtcpRw9KQmvtnHv`**（ref=`738c260`，success；2026-11-16 JST） | GitHub commit status Vercel=success；Production 下载后 target SHA 与候选一致 |
| 线上入口 | `https://my-qc-web.vercel.app` → 200（**匿名可访问**）；`huihai-qc-tool.vercel.app` 为**另一个 Vite React 项目，非本仓库**（602 B），非生产站点 | `curl -w %{http_code}` |
| 发布白名单 | `scripts/static-site-manifest.json`，**37 条**（7521 B；本轮仅 `region_check.html` SHA `407edc91…→2ebdc6dd…`；manifest SHA `f27d78ddd2e63642de3098cac56d6df40aac062da976a155e78aa1d73ebe0d68`） | 条目数 + bytes + SHA 核验 |
| 构建产物 | `public/` **37 文件**，集合与清单一致，`SHA_MISMATCH=0`；本轮相对备份仅 `region_check.html` 变化，`OTHER_36_SHA_CHANGED=0` | 构建后 37/37 SHA 比对 |
| 线上字节一致性 | **`region_check.html` 1/1 HTTP200、159749 B、SHA256 `2ebdc6dd176fe02b454e9aa1d78c856acb935ca456fcde406aa8a7333eb3f401`**（NO026 Production 验收）；其他 36 项本轮未重新下载 | `acceptance/20261116_NO026_region_check表格显示修复/evidence/production_region_check_after_commit1.html` |
| **Excel 对比生产文件** | `excel_compare.html` = **356491 B / `fa1b73b3c300a3d11948ca2ddd8c342e7e36d84377a8cdf7903590d280b88990`**（NO021 C+ v26.1，冻结候选逐字节）；**线上浏览器内 fetch `cache:'no-store'` + `crypto.subtle` 计算一致** | `curl` + `sha256sum` + 浏览器内 `crypto.subtle`，2026-11-15 JST |
| 其余静态资源 | NO026 对照本地 `public_before.sha256`：其他 36 项 SHA 不变；线上本轮只验收 region_check 1/1 | NO026 acceptance 与 `_build_backup` |
| 工作区改动（**须保护，不得清理**） | 原.gitignore修改及8项未跟踪资料原样保留；本轮仅2个批准文件入库 | NO002字节/状态清单对照 |
| 后端 | Google Apps Script（`SHEET_ID = 1GlYrGBSwztn6dr3d70XzXiLcoBF7H9VELnWOAs5Nd5Y`）+ Sheet `users/logs/summary/case_summary` | 架构 §5 |
| GAS 端点 | `GET <GAS_URL>` → 302 → 200 `{"ok":true,"message":"惠海QC API is running"}`（NO003 只读复核）；**不含任何日志 / 统计数据** | 只读探测，2026-11-10 |
| GAS 线上版本 / `caseStats` | **UNKNOWN**（`GET /exec` 200 只证明部署可达） | 架构 §5.5–5.6 |
| 认证模型 | `PORTAL_AUTH_MODEL = FRONTEND_ONLY`；`STRICT_AUTHORIZATION_GATE = NOT_MET` | 架构 §4.5（匿名 GET 实测 200） |

## 2. 当前业务模块状态

### 2.1 已上线（Vercel Production）

| 模块 | 主文件 / commit | 状态 |
|---|---|---|
| 门户首页 / 工具注册 | `index.html`（`TOOLS` 唯一注册表，37 静态资源） | 已上线；`UPDATE_LOG` 历史条目只允许追加 |
| **Excel 对比（检查范围自适应 / 8 类检查 / Sheet 汇总 / ZIP 部分检查 / 渲染容量保护 / 条件格式三级提示）** | `excel_compare.html` / **`9e417fa`（NO021 v26.1 正式上线）** | **已正式发布（NO021 v26.1，2026-11-15）：独立审核 58/58 PASS（双语交互/导出/三级提示）；线上 SHA 37/37；生产 URL 真 Chrome 15/15 PASS（页面 200＋线上 SHA 一致＋8 类检查＋三级提示红黄蓝＋黄色详情展开 B2:B4＋中日切换＋HTML 报告真实下载落盘 24274B 含 B2:B4＋高速完成＋ZIP 渲染＋首页正常；GAS 零真实写入）**。**能力边界见 §2.1.1；L3–L5 仍 `NOT_VERIFIED`**（GAS 上报为假响应，不转发生产）；见 §3 |
| 6課 TVPR 关键字生成 | `tvpr_check.html`（59551B / `764250f8…`）/ `cf36356`（NO007） | 已上线、已封板；正式集成 24/24 真 Chrome |
| 6課 0042 三得利 UTM 核对 | `suntory_utm_check.html`（113337B / `f737b0f3…`）/ `e43bbd4`（NO010） | 已上线；逻辑 164/164、真 Chrome 75/75。**HOLD**：H1–H4 业务裁定、短链允许域、WARN 计数口径、真实业务样本、L3–L5 |
| 工具业务图标补齐 + NEW 徽章废除 | `tool_logos.js` 等 6 文件 / `6f3f5a4`（NO011） | 已上线；线上 37/37 SHA 一致；规范见架构 §3.5 |
| 2課 TVer 設定チェック | **NO003 / `513947b`**；tver_check.html（833195 B / `bccc5828867e02bc224b23128d6e962162bb8526bc5963e81193bee9447639c6`） | **已正式发布（NO003，2026-11-23）：UI 紧凑化のみ。Sheet 名称検索と参照シート名（必須）を同一行化、操作行を「チェック開始／リセット／一致・不一致・要確認／校正結果CSV（全件）／未完了ヒント」に集約、長文の未完了注意書きを CSV 導線横の小型ヒント（i）へ移設（hover・focus・click/tap で全文、Escape と外側クリックで閉じる、未完了なしなら非表示）。検索・選択・必須検証・CSV 出力・校正判定は不変。2431：一致 304／不一致 2／要確認 32、Group 16/16、0% 12・100% 16・ADG 16・impression 16 行空白、CP status 不一致 2 据え置き。CSV 61/62/63 列互換維持、既有回帰 219/223（失敗 4 件は前版と同一）。3 幅（1920/1365/390）真 Chrome・线上 SHA 逐字节一致・他ツール 11/11 不変。**未着手（既存課題）：media 局辞書、`campaign_status` 裁定。L3–L5 NOT_RUN。**（前身 NO002：`fb2ebf1` / `a5362739…`） |
| **1課 TL Meta Report Studio**（Meta レポート作成／納品前チェック） | `tl_meta_report.html`（840,272 B / `b05bd07b…`）/ **NO025 `35ec635`** | **已正式发布（NO025，2026-11-26）**。共通 Header・共通ログイン・使用頻度（作成／校正）対応。Excel の読み込み・加工・校正・DL はブラウザ内完結。実機 41/41（ローカル／正式）、認証 3/3、エンジン回帰 78/78。独立 HTML 版は非常用として別途保管。**未確認：GAS 集計行・現場通し試走**。 |
| 6課 地域表記変換チェック | `region_check.html` / source commit `738c260` | **NO026 正式发布 PASS（2026-11-16）**。提出者：刘佳怡。Production SHA `2ebdc6dd176fe02b454e9aa1d78c856acb935ca456fcde406aa8a7333eb3f401`；真 Chrome：单行1/1、六行回归6/6、28行滚动、390×844移动端与复制 PASS；共享 `qc-ui.css` / `qc-header.js` 无遮挡。JS page error 0；Console 有一个 `/favicon.ico` 404（资源未在 manifest，未扩围修改）。回滚基线：commit `1812cbc` / 原 SHA `407edc91ee096cb869c081c55ae2973254304646770e196cf326a4391903c584`；`public` 快照见 `_build_backup/20261116_NO026_region_check表格显示修复/`；L3–L5 NOT_RUN。 |
| 其他课室既有工具 | `amazon_dsp_check.html`、`dv360_check.html`、`3ka_*`、`excel_clean.html`、`excel_formula_cleaner.html`、`image_compare.html`、`tools_text.html`、`manuscript_*`、`bpo_weekly_report_malin.html`、`usage_dashboard.html` | 长期既有、已封板；**禁改业务逻辑**（AGENTS §3.1） |

### 2.1.1 Excel 对比（NO012 基础 + NO021 v26.1）能力边界

**检查范围（自适应列 + 累计预算）**

| 项 | 值 |
|---|---|
| 行列硬上限 | `XLCOMP_MAX_ROWS = 50000`、`XLCOMP_MAX_COLS = 100`（历史默认）、`XLCOMP_MAX_COLS_HARD = 16384` |
| 自适应放宽条件 | 单 Sheet `fullCols*rows ≤ 150000`（`XLCOMP_EXPAND_CELL_BUDGET`）**且** 本次仍需格数 ≤ 累计余额（`XLCOMP_EXPAND_CELL_BUDGET_TOTAL = 300000`） |
| 超限行为 | `clipped = true`，产出精确未检查范围（`clipRanges`），界面显示「部分检查／一部比較」＋未检查范围；**不假报完整检查** |
| 预算生命周期 | 标准模式每次比较重置；ZIP 模式每次 `runZipComp()` 重置，**同一次 ZIP 内全部工作簿与 Sheet 共用 300000 格累计预算**（patch_08 修复） |
| 已知呈现规则 | 空白 Sheet 仅在**完整检查后确认无有效内容**才标「空白（无内容）」；partial／failed 不被 empty 覆盖；仅存在于裁剪范围外的内容保持「部分检查」 |

**ZIP 渲染容量保护（patch_09）**：渲染前按行／列／字符量估算，超阈值改用轻量汇总，不一次性生成全部单元格 HTML；比较计算与显示分离。阈值依据 Chrome 实测（V8 最大字符串 536,870,888 字符；单 Sheet 200列×500行 ≈ 250,000,000 字符；4 张累计 ≈ 1,000,000,000 字符为原报错点）。`clipped=true` 时仍显示「部分检查」与 `clipRanges`，并区分「未检查范围」与「已检查但明细未显示」。**不修改比较引擎与差异计数规则。**

**尚未支持（如实登记）**：宏（xlsm）内容比对、数据透视表结构比对、图表对象比对、外部链接解析。**NO021 v26.1 已支持**：条件格式规则比对（CF 签名含全部 cfRule + dxf 全子元素 + stopIfTrue 门控组 + x14 扩展；已知/可解析差异按类别计入检查结果，未知/不可解析以黄色提醒保留范围与原因，定位到动态 CF 组时以蓝灰说明呈现且不产生大面积黄色警告；最终边框显示效果浏览器不可求值，恒为「规则定义一致」级结论）。

### 2.2 未上线 / 候选（不得标记为已上线）

| 项 | 位置 | 状态 |
|---|---|---|
| 5課 0009・0018 子ツール 9 件 | `candidates/20261109_NO002_5KA_0018_SUBTOOL_PORTAL/`（未跟踪） | **候选 READY（隔离验证済）／正式反映 HOLD**。真 Chrome 45/45、隔离构建 48/48、manifest 37→48；正式区 / `public/` / 生产**无变更**。前置：0009 原件同一性确认、现场样本、L3–L5、发布授权 |
| 正式区 5課 `TOOLS` | `index.html` | 仍为「準備中」占位（`disabled:true`），候选的 9 张直接卡片**未反映** |
| 历史候选（保留不覆盖） | `candidates/20261106_NO005_TVPR字体可读性改善/`、`…_NO006_TVPR_UIUX再设计/`、`candidates/TVPR_6KA_CANDIDATE_01/`、`…_NO008_0042_UTM_AUDIT_FIX/`、`…_NO009_0042_UTM_UI_FIX/`、`…/20261110_NO001_Excel边框与结果导航/` | 原样保留，禁止覆盖或删除 |
| 严格访问控制方案 A/B/C | 架构 §4.5 | **仅提案，未实施**；`STRICT_AUTHORIZATION_GATE` 仍 `NOT_MET` |
| 2課 TVer 历史候选 NO013–NO018 | `candidates/`各原编号目录及同名审核包 | 历史源码/测试/报告全部保留；被替代的当前Gate不在本表重复，查各同名交付包。NO018与NO017同源码；原生下载与CSV空Device裁定仍未放行。 |
| 2課 TVer 当前候选／本地验收 | NO021隔离候选；`candidates/TVer_LOCAL_ACCEPTANCE/`同步当前SHA，NO020完整回滚快照保留 | 正式命名/ASR/UI精准修复；316/316专项、937对齐891/46既有失败、006–009与Chrome30/30；正式认证NOT_RUN、业务/发布HOLD。 |
| 2課 TVer NO022（已由 NO023 正式上线） | 见 §2.1；commit `1812cbc` / Vercel `2dYCvtBozkiAyCekoG8VnEEvKYja` | 2026-11-16 已 push main 并 Production 部署，线上 tver SHA `eed98ff6…` 逐字节一致；4 真案件回归 ALL PASS、preflight 13/13、GAS 0。BUSINESS_ACCEPTANCE=PENDING（现场验收未完成）。上一版 FIX7 `9fc661c6…` 为回滚基线。 |
| Excel NO024 最终上线回归候选 | `candidates/20261116_NO024_EXCEL_FINAL_RELEASE_GATE/`（隔离） | Engine `e5305101…30de`：Chrome 回归 42/42、集成 22/22、入口/下载 11/11 PASS；converter bundle `415cf2a7…9147`：1s→8s graceful wait + kill 前 ownership recheck，PowerShell 5.1 实测被 `AuthorizationManager` 拒绝，T1–T4 `NOT_VERIFIED`。`ENGINE_RELEASE_GATE=PASS`、`CONVERTER_RELEASE_GATE=HOLD`、`OVERALL_RELEASE_GATE=HOLD`；未改正式源码/manifest，未 Commit/Push/Deploy；Production 实时复核 `UNKNOWN`。审核包：`dev-materials/00_交付ChatGPT/20261116_NO024_EXCEL_FINAL_RELEASE_GATE/`。 |

### 2.3 TVer 连续候选任务（目标：2026-11-25）

当前候选 **NO022（已由 NO023 正式上线 Production）**：`candidates/20261115_NO022_TVER_设备命名与确认项目可视化/tver_check.html`，**667510B / SHA256 `eed98ff622572c3a61e459930c48dc9112a38f8bbb5d5d6268941a2c9e255564`**（源自 NO021 `54d739f1…` 逐字节复制后精准修改）。**2026-11-16 NO023 已 push main 并 Vercel Production 部署，线上逐字节一致**；BUSINESS_ACCEPTANCE=PENDING（现场验收未完成）。

NO022 变更：① 设备后缀表补 SP+CTV→`_SPCTV`（用户 2026-11-15 正式确认；`TVER_GROUP_NAME_DOCUMENTED_SUFFIXES` 同步收入）；② 要確認/不一致可视化：徽标显示原因概要（`要確認（遷移先URL）`／`不一致（オークション設定）`／`（N項目）`），详情展开回退 `run.entries` 使无显示列字段（如 Apple 12 条 url 要確認）原因可见，空欄原值明示 `（空欄）`，新增「表示証拠不足」保护；③ Apple URL 根因=**分类C**（设定表 URL 区块无数据行、Ad 行 LP名 空栏，程序读取无缺陷，保留要確認）。四真实案件函数级回归 PASS（006/007/008 漂移仅 adgroup_name 证据溯源，009 名称 5/5 一致+反向检出）；真 Chrome 徽标/详情/导出 12↔12 一致性 PASS。NO021 三套件 4 条以 `_SPCTV` 为定義外示例的旧断言按设计被取代（NO021 原测试未改，`no022_naming_semantics` 6/6 覆盖原规则）。业务/发布 HOLD；交付包 `dev-materials/00_交付ChatGPT/20261115_NO022_TVER_设备命名与确认项目可视化_REVIEW.zip`。

上一候选 **NO021**：`candidates/20261113_NO021_TVER_正式命名规则精准修复/tver_check.html`，**663069B / SHA256 `54d739f161d040554481ae0ba23bc5beada0bb50d2ec13ae8d4c373b607e9dea`**（保留不覆盖）。正式TVer仍FIX7；生产/HEAD见§1。未Commit/Push/Deploy，未改正式TVer、manifest、public或其他QC工具。

本轮仅按正式规则精准修改：Setting独立设备CTV/SP/SPPC/默认四设备名称后缀；GP名称引用父CP命名日期；ASR精确0~7；Creative末尾已知视频扩展名派生（保留原值/来源与身份算法）。正式UI移除校正時点选择及详细診断；状态以unknown保守处理，必要未完成提醒与全件CSV保留，coverage仅LOCAL TEST。CP名称/日期比较函数不改，未知设备组合、消化用DMP顺序、Survey/CTV特殊命名不自动放行。

| Gate | 当前结论 | 证据 |
|---|---|---|
| NAMING / ASR / UI | **PASS（已确认规则范围）** | 35/35新增规则；Apple12GP实际比较一致，故意错名检出1件；SP/独立CTV/CP日期/扩展名及raw捷径负测齐备 |
| TARGETED_REGRESSION | **316 PASS / 0 FAIL** | 最终SHA绑定；NO017两项GP风险修复与NO018边界保护在内 |
| HISTORICAL_REGRESSION | **891 PASS / 46既有FAIL；新增非预期0** | 937对齐失败集合/顺序与NO017相同；冻结raw855/82，额外3条被正式规则替代的GP日期命名断言保留。9组契约改前/后证据齐全，不改全局历史测试 |
| REAL_CASE_REGRESSION | **PASS（006–009）** | CP/GP/CR=6/12/12、2/4/8、2/2/2、5/5/5；逐匹配对象与NO020相同，未涉及字段完全相同；008 auction_type真实差异2件；009 SPCTV名称5件继续要確認 |
| LOCAL_FUNCTION_GATE | **PASS** | 本地Python5/5、适配器4/4、可见正常Chrome30/30；显式Sheet、拖放/选择文件、CP2/GP4/CR8、两种导出 |
| NATIVE_CHROME_DOWNLOAD_GATE / DISK_READBACK_GATE | **PASS（本地合成）** | Chrome原生download failure=null；浏览器关闭前Python直接读取原始磁盘文件：全件33列/264条/452475B/SHA4978b1…97b25；coverage4列/264条/19731B/SHAdcd64a…082e6；UTF8 BOM/状态/原值/来源/未比较原因一致 |
| LOCAL_NETWORK_GATE | **PASS（页面业务请求）** | 仅127.0.0.1；Host/Origin/路由白名单+CSP+测试适配器；无QA请求路由伪响应，页面外部请求0，主动外联被阻断，无安全禁用参数 |
| PRODUCTION_AUTH_GATE | **NOT_RUN / NOT_VERIFIED** | 本地测试身份不读取正式Session/Token/Cookie，不替代正式认证；root qc-auth.js未改 |
| BUSINESS_RULE_GATE / RELEASE_CANDIDATE_READY | **HOLD** | CSV空Device、007年龄Token、Q01/Q03特殊分支残/Q04–Q07及未确认设备/DMP组合继续保留要確認或已登记现状；待现场/ChatGPT最终Gate |
| PRODUCTION_RELEASE_GATE | **HOLD** | 未授权正式发布；L2–L5本轮NOT_RUN，不以本地Mock替代 |

本地入口：`candidates/TVer_LOCAL_ACCEPTANCE/启动TVer本地测试.bat`，双击Python loopback→正常Chrome，无需F12/Overrides/安全配置。active HTML与当前候选逐字节同SHA。NO020原件SHA`7887872b55a50d54da7859b13090d61934d7cfe9f3e6bea299c01ac9436d67cb`及原审核包未覆盖，完整本地回滚快照在`candidates/20261113_NO021_TVER_正式命名规则精准修复/baseline_local_NO020/`；停止本地服务后从快照复制回active目录即可，不涉及正式回滚。

本地认证/请求阻断仅存在于测试目录，不能纳入正式manifest。正式发布前仍须ChatGPT审核与用户单独授权。完整测试证据在同号acceptance；精简审核包`dev-materials/00_交付ChatGPT/20261113_NO021_TVER_正式命名规则精准修复_REVIEW.zip`。三份维护MD随包与docs_baseline快照保留。

## 3. Excel 生产日志验收（NO021 复核：仍 NOT_VERIFIED）

```text
EXCEL_PRODUCTION = DEPLOYED  （NO021 v26.1：356491 B / fa1b73b3…，线上真 Chrome 15/15 PASS）
L3 (GAS 接收及写入)   = NOT_VERIFIED  (NOT_RUN)
L4 (Sheet 真实读回)   = NOT_VERIFIED  (NOT_RUN)
L5 (Dashboard 统计)   = NOT_VERIFIED  (NOT_RUN)
EXCEL_ONLINE_FUNCTION = PASS  （生产 URL 真 Chrome 15/15；GAS 网络阻断零真实写入，不作 L3 证据）
```

**已完成的只读对账**：

- **L2 复核 PASS（NO021 更新）**：线上 `excel_compare.html` HTTP 200 / **356491 B**，**浏览器内 `fetch(cache:'no-store')` + `crypto.subtle` 计算 SHA256 = `fa1b73b3…88990`**，与批准候选逐字节一致；manifest 37/37 产物 SHA 全部匹配，TVer FIX7 及其余 35 项未变。（NO012 的 306103 B / `aed5eb1f…` 为上一版，已由 NO021 取代）
- **GAS 只读探测**：`GET <GAS_URL>` 经 302 跟随返回 `{"ok":true,"message":"惠海QC API is running"}`。**只证明部署可达，不返回 `logs` / `summary` 数据，不构成 L3–L5 证据。**
- **历史行排除**：NO002 记录的 `logs` 末行 row 11835（2026/11/10 18:27:59，工具 `Excel对比`）用户标识与当前门户会话不匹配，已判定为历史记录，**不视为本次记录**。
- **读取能力边界（源码级确认）**：`qc-auth.js` 只有 POST `apiCall`，`sendLog` → `log` 是写 `logs` 且强制带 `session.token`；本地 `Code.gs` 的 `doPost` 路由中，**凡返回数据的 action 全部需要 token**，`usageStats` 另需 `requireUsageAdmin`（`管理者` 職務）且只读 `summary`；`usageStatsHealth` / `doGet` 免 token 但只返回版本号 / 健康 JSON。**不存在** `getLogs` / `readLogs` / `exportLogs` 等返回 `logs` 原始行的端点，`rebuildSummary()` 是内部函数（定时 / 后台触发），不是 Web 端点。`usage_dashboard.html` 亦先校验 `session.token`。本会话**不持有任何生产凭证** → 无法只读取得 `logs` / `summary` / 看板内容。
- **全项目只读搜索（NO003）**：`dev-materials/00_交付ChatGPT/20261110_NO002_Excel正式发布准备/`、`acceptance/…/post_release/` 及全项目 `.csv` / 截图 / 脚本中，均不存在生产 Sheet 日志导出、Dashboard 统计截图或「某次 Excel 比较已写入生产 logs」的记录，亦无 2026-11-10 18:27:59 之后的新日志行证据。NO002 的 `chrome_log_acceptance.json` 明确记录 `upload_completed=false`、`comparison_executed=false`、`successful_comparison_count=0`。

**未能确认的部分**：用户口述「已在门户上传 Excel 并展示过实际比较结果」属于功能层观察，无法据此判定「比较成功 / GAS 写入成功 / Sheet 读回成功 / Dashboard 统计成功」四者中任一层的生产对账结果；仓库内无对应本次操作的 Sheet 导出 / 读回 / 看板证据，且**不将历史行误认为本次记录**。

**纪律执行**：未修改 / 删除 / 补写任何日志；未写 GAS、未写正式 Sheet、未用 Mock 或假账号；未改 Chrome 扩展权限；未为验收反复制造使用记录；未执行浏览器自动控制重试。L3–L5 按 `NOT_RUN` 如实登记。

**补齐路径（需用户配合，本轮未执行）**：在正常登录的 Chrome 中手动选择文件并运行**一次**真实比较 → 提供 `logs` 新增行（时间 / 工具名 / 用户标识）、`summary` 对应行（実行回数 / 有効利用回数）与 Dashboard 按人员/课室/工具/日期的查得结果 → 据此逐层对账并封板。注意 `summary` 非每次 logs 写入即刷新（架构 §5.2）。

## 4. Gate 总览（当前有效结论）

```text
STATIC_BUILD_GATE            = PASS   （37/37，清单锁定；BUILD_EXIT_CODE=0）
PRODUCTION_BASELINE_VERIFIED = PASS   （本轮本地 formal = manifest = public；Production target region_check 1/1 SHA matched）
GIT_COMMIT_GATE              = PASS   （NO026 source commit `738c260`；3 个获授权文件 staged blob == 工作区字节）
GIT_PUSH_GATE                = PASS   （push origin HEAD:main，`1812cbc..738c260`）
VERCEL_DEPLOY_GATE           = PASS   （NO026 source deployment `3E9S9A1csom3vNtcpRw9KQmvtnHv`，Production success）
PRODUCTION_L2_SHA_GATE       = PASS   （region_check.html 1/1，159749 B / `2ebdc6dd176fe02b454e9aa1d78c856acb935ca456fcde406aa8a7333eb3f401`）
TVER_FIX7_PROTECTED          = YES    （tver_check.html = 9fc661c6… 未变）
EXCEL_ONLINE_FUNCTION_GATE   = PASS   （生产 URL 真 Chrome 15/15，含 HTML 报告真实下载落盘）
SECURITY_CODE_GATE           = PASS   （沿用已审候选；NO003 未改业务代码）
PORTAL_INTEGRATION_GATE      = PASS
PRE_RELEASE_GATE             = PASS
PRODUCTION_RELEASE_GATE      = PASS   （NO026 region_check UI；L3–L5 NOT_RUN，STRICT_AUTHORIZATION_GATE 仍 NOT_MET）
FINAL_RELEASE_GATE           = HOLD   （v26.1 已上线；日志验收 L3–L5 未封板；STRICT_AUTHORIZATION_GATE 仍 NOT_MET）
PORTAL_AUTH_MODEL            = FRONTEND_ONLY
STRICT_AUTHORIZATION_GATE    = NOT_MET（匿名 GET 200；不得记为 PASS）
GAS_ONLINE_VERSION           = UNKNOWN
CASE_STATS_ONLINE            = UNKNOWN
GAS_ISOLATION_GATE           = PASS   （本地快照不可发布；build() 三路径全拒否）
DIRECTORY_GOVERNANCE_GATE    = PASS   （NO003 目录治理已审）
```

已封板项目的 Gate 结论（`TVPR_*`、`UTM_*`、`PORTAL_ICON_GATE`、`PORTAL_NEW_BADGE_REMOVED`、`NO011_*` 等）全部 `PASS`，逐项测试数值与证据见 §9 对应交付包；本文件不重复维护历史数值。`KA5_RELEASE_GATE = HOLD`（5課 候选未经发布授权）。`REAL_USAGE_WRITE_READBACK = NOT_VERIFIED`（未写生产 GAS/Sheet）。

**TVer FIX7 正式发布：PASS（2026-11-11 NO002）**；ChatGPT Code Gate和用户发布授权已取得；Vercel成功、线上37/37 SHA一致。严格授权仍NOT_MET，统计L3–L5 NOT_RUN；不影响Excel既有HOLD。

## 5. 有效回滚基线

| 项 | 值 |
|---|---|
| **当前 Production（2026-11-23 NO003 发布后）** | **TVer NO003 `bccc5828…`（833,195 B）+ `scripts/static-site-manifest.json`（TVer 行のみ更新）/ commit `513947b94d5d0bb3125694f99a8b5fb0b6435907` / Vercel `dpl_Fx35X23gtjRdDVM9zRBp9xBnmvpR`（Production・Ready）** |
| **TVer NO003 回滚点** | `76bd4b2`（NO003 发布前 origin/main）/ TVer `a53627393826b3eb8735b8e2b656379becccd785882ecfd9745d0fd61a3c96dd`（827,244 B）。手順：`git revert 513947b` → push（TVer と manifest の TVer 行が同時に戻る）、または Vercel で直前の Production deployment（`my-qc-nb6wjoho1…`）へ切替。禁 reset --hard／push --force。候補原件は `candidates/20261123_NO003_TVER_UI紧凑化と本机Git安全同步/tver_check.html`（=`bccc5828…`）、改前は同ディレクトリ `baseline_CURRENT_PRODUCTION.html`（=`a5362739…`） |
| **TVer NO002 回滚点** | `f4f450e`（NO002 发布前 origin/main）/ TVer `2067e310a69ba55a81b69ea6aed9d489fab86333c347874d47a7e3f4ca2cd2a1`（814,197 B）。手順：`git revert fb2ebf1` → push（TVer と manifest の TVer 行が同時に戻る）、または Vercel で直前の Production deployment（`https://my-qc-qiecrei2d-huihaiqctool-s-projects.vercel.app` の 1 つ前）へ切替。禁 reset --hard／push --force。候補原件は `candidates/20261123_NO001_TVER_Group名称精確匹配と結果提示最適化/tver_check.html`（=`a5362739…`）、承認済み NO001 候補は同ディレクトリ `baseline_NO001_prepatch.html`（=`99c276d3…`）、发布前生産版は `baseline_CURRENT_PRODUCTION.html`（=`2067e310…`） |
| **TVer NO001 回滚点** | `cba8716`（NO001 发布前 origin/main）/ TVer `13424c336b2918e03c4f8bd679af89225c45cf809267f80728fad059b57e34f9`（800,791 B）。手順：`git revert fa3331c` → push（TVer と manifest の TVer 行が同時に戻る）、または Vercel で直前の Production deployment（`https://my-qc-esamejjwu-huihaiqctool-s-projects.vercel.app`）へ切替。禁 reset --hard／push --force。候補原件は `candidates/20261122_NO001_TVER_CSV62列互換と未知項目検出/tver_check.html`、改前は同ディレクトリ `baseline_CURRENT_PRODUCTION.html`（=`13424c33…`） |
| 当前 Production | **Excel NO021 `fa1b73b3…` + TVer NO022 `eed98ff6…` commit `1812cbc0c8aae11f5ff79f256f746749124f2963` / Vercel `2dYCvtBozkiAyCekoG8VnEEvKYja`** |
| **TVer连续候选回滚点** | NO006 `snapshots/00_NO005.html` = NO005 SHA256 `7439d9b78c47c5693087f94b4e241ea16ea41fed9f5d5083541e61d64e2fe42f`；NO005与更早阶段0快照全部保留 | 仅隔离候选恢复；不改正式区、不回滚其他任务 |
| **有效回滚点** | NO021 parent **`53ffc5d2c9b7f01f08d9cc42547de3144ddb0588`** / 发布前 Production **deployment `7755550034`**（NO012，Excel 306103 B / `aed5eb1f…`）；更前一版 `5743f43` / `7730238734`（NO009，Excel 285625 B / `83f2192c…`） |
| 回滚方式 | 单独授权后 `git revert 1812cbc`（恢复 TVer FIX7 `9fc661c6…` 与 manifest）→ Push 触发 Production；或 Vercel 回退至上一 Production deployment `BEnTUmubYCn2YiHgi9F9mJb5vi2d`。禁 reset --hard／push --force。详见 `20261116_NO023_TVER_PRODUCTION_UAT/ROLLBACK.md` |
| 历史版本链 | `c2b3970` → `05f8f31`(FIX5) → `f5c25b1`(FIX6) → `4b34a7d`(FIX6-B) → `cf36356`(NO007 TVPR) → `e43bbd4`(NO010 UTM) → `6f3f5a4`(NO011 图标) → `15f90cdb`(NO002 Excel) → `1e5b570`(NO002 FIX7) → `625c00e7`(NO008 Excel 正式上线) → `5743f43`(NO009 Sheet 汇总正式上线) → `53ffc5d`(NO012 通用化 + ZIP 渲染保护正式上线) → `9e417fa`(NO021 v26.1 条件格式签名 + 三级提示正式上线) → `1812cbc`(NO023 TVer NO022 正式上线) |
| 现状 | NO023 TVer NO022 已正式上线，线上字节/功能核验 PASS，无回滚；BUSINESS_ACCEPTANCE=PENDING（现场验收未完成）；真实使用统计 L3–L5 仍 NOT_VERIFIED（见 §3） |

### 5.1 文件级回滚备份（未删除，可直接读取）

| 备份 | 路径 | 内容 |
|---|---|---|
| 旧版源文件 | `_build_backup/20261113_NO012/RELEASE_PREP/rollback_backup/` | `excel_compare.html`（`83f2192c…`）、`static-site-manifest.json`（`fbc9ec70…`）、`public_sha256_list.json`（37 项） |
| 旧版 public ① | `_build_backup/20261113_NO012/RELEASE/public_20261113_113418/public/` | 构建前 `cp -r` 备份（37 文件） |
| 旧版 public ② | `_build_backup/20261113_NO012/RELEASE/public_replaced_20261113_113505/public/` | 构建时 `mv` 出来的旧 `public/`（37 文件，未删除） |
| 线上下载留证 | `_build_backup/20261113_NO012/RELEASE/online_verify/` | 线上 `excel_compare.html` ×2 域名、`vercel_deploys.json` |
| **NO021 v26.1 发布前备份** | `_build_backup/20261115_NO003_NO021_V26_1_RELEASE/public_20261115_115315/public/` | 构建前 `mv` 备份（37 文件 = NO012 生产全量，含 `aed5eb1f…` Excel）；候选原件 `candidates/20261115_NO001_NO021_CPLUS_V26_1/excel_compare.html`（`fa1b73b3…`） |

## 6. 生产环境已知问题（非本轮引入）

1. **`PORTAL_AUTH_MODEL = FRONTEND_ONLY` / `STRICT_AUTHORIZATION_GATE = NOT_MET`**：静态资源可匿名 GET，`guardPage()` 只是浏览器重定向。历次上线均未改变此事实（架构 §4.5）。
2. **GAS 线上版本 / `caseStats` = UNKNOWN**：本地 `Code.gs` 仅为历史快照，不得据此推断线上；`summary` 由定时触发器 / 后台汇总，非每次 logs 写入即刷新。
3. **`recordRecent` 未定义**：`index.html` 卡片 `onclick="recordRecent(...)"` 触发 `ReferenceError`（迁移仍成立），历史验收资料已归类为基准已知错误。
4. **5課「準備中」占位**：仅在候选中删除，正式区未反映。
5. 其余既有缺陷见架构 §6.3 / §8：`excel_clean` NBSP 文案与实现不符、`bpo_weekly_report_malin` / `meta_interest_qc` 无守卫、`xlsx.full.min.js` 0.18.5 CVE、`TOKEN_EXPIRY_HOURS=12` 与履历「8 小时」不符、`deploy.bat` 绕过白名单、残留 worktree、`release/` 未跟踪未忽略。
6. **Excel 对比未完全封板**：L3–L5 仍 `NOT_VERIFIED`，不得标记为「全部验收完成」。

## 7. 当前最重要待办

| 优先 | 事项 | 前置 |
|---|---|---|
| P0 | **TVer现场规则确认（NO011待答）**：Q01校正时点、Q03 CTV命名、Q04 media／local全选、Q05 LP／Tracking独立源、Q06 daily_freq_cap 与配信設計FQ关系、Q07 city空值语义、Q10已确认（不再提问）；CSV空Device语义待裁定 | 现场回答后按来源修复；对齐891/46；业务/发布HOLD；CHATGPT_FINAL_GATE=UNKNOWN；禁止正式升格 |
| P0 | **Excel L3–L5 真实统计验收**：一次真实比较 → `logs` 新增行 → `summary` 读回 → 看板核对（严格分层，不得用 Mock / 假账号） | 用户在已登录 Chrome 手动比较 + 提供读回证据 |
| P1 | **Excel 真实超大样本现场验证**：NO012 线上验收使用了合成 fixture 覆盖「ZIP 超累计预算 → 部分检查＋渲染容量保护」，**现场样本最大规模未达 200列×500行**；需在真实业务出现宽表时复核一次，确认轻量汇总文案与未检查范围呈现符合现场预期 | 真实宽表样本 + 用户确认 |
| P0 | **0009 原件同一性确认**：`广告文本终极検出_WB_260820.html` 是否为正式送審版，附 SHA256 向提出人确认 | 提出人回答；未确认不得正式反映 5課 候选 |
| P0 | **5課 候选现场确认**：X 跨日时 / URL 重复 / 地区分割 / Pinterest 30 字 / SP 非 9 分 / 0009 实 Excel 写回，实数据走 1 周 | 真实样本 + 真 Chrome |
| P1 | 5課 9 件 L3–L5 与正式反映（9 HTML + 2 资产 + index/manifest），回写架构 §3.1 / §6.1 | 上述 P0 + 发布授权 |
| P1 | `recordRecent` 未定义裁定（实现 / 移除调用） | 用户裁定 |
| P1 | 消除 GAS UNKNOWN：控制台核对线上版本与 `caseStats`；`TOOL_NAME_JA` 追加 `'TVPR关键字生成'`；`logs.tool` 服务端白名单 | GAS 只读导出 / 变更授权（**本轮禁止改 GAS**） |
| P1 | 真实使用后核对 `summary` 是否按既有汇总机制刷新 | 同上 |
| P2 | 三份核心 MD 纳入 Git（仅文档，不影响构建产物；现仍 UNTRACKED） | 用户授权 |
| P2 | 严格访问控制方案 A/B/C 评估 | 架构变更评审 + 用户选择 |
| P2 | `release/` 与 `TVER_GROUP_NAME_FIX_20261102/` 处置；本地 `Code.gs` 与线上只读导出同步 | 用户确认 |
| P3 | 退役 `deploy.bat`；`git worktree prune`；其他工具 `diffCount` 自查（R10）；补 `.gitattributes` | 用户确认 / 逐工具评审 |

## 8. 与生产运行有关的必要环境信息

- 本机 Git **无 `user.name/user.email`**：commit 必须 `git -c user.name="馬林" -c user.email="lin.ma@hakuhodody-one.co.jp" commit`。
- 发布前 `public/` 必须按架构 §2.5 **移动备份**（`mv` 到 `dev-materials/01_测试运行数据/_build_backup/<TASK>/`，禁 `rm -rf`、禁根目录 `public.bak.*`）；线上一致性必须**下载后计算 SHA256**，不可只看 200 / size。
- 三份核心 MD 为 UNTRACKED，每轮快照存 `dev-materials/02_历史归档/docs_baseline/<TASK>/`，随 `*_REVIEW.zip` 交付。
- GAS 本地快照 `dev-materials/03_GAS/06_GAS/Code.gs` **禁改 / 禁部署 / 禁复制**，仅为历史维护快照（AGENTS §3.4）。
- 执行环境（受管 Node 22.22.2 / 真 Chrome / Playwright / 行尾纪律）见架构 §7；6課 业务资料 `D:\業務用\開発用\部門_ツール審査\6課` 只读。
- 真人验收入口（本地 QA，不入生产）：TVPR `candidates/20261106_NO006_TVPR_UIUX再设计/START_TVPR_ACCEPTANCE.bat`；0042 `candidates/20261106_NO009_0042_UTM_UI_FIX/START_SUNTORY_ACCEPTANCE.bat`（GAS DNS 遮断，SHA 不符拒绝启动）。

## 9. 历史结论与证据位置（已封板项目只留最终结论）

详细开发过程、逐项测试数值、旧版本差异不再在本文件维护；完整证据保留在下列交付包与 `acceptance/` 目录，以及 `dev-materials/02_历史归档/docs_baseline/<TASK>/` 的 MD 快照。

| 任务 | 最终结论 | 证据位置（均在 `dev-materials/`） |
|---|---|---|
| **20261113 NO012 Excel 通用化 + ZIP 渲染保护 正式上线** | commit `53ffc5d`；Vercel `7755550034` success；线上 37/37 SHA（Excel `aed5eb1f…`，TVer FIX7 不变）；生产 URL 真 Chrome 5/5（含真实 P-MAX 样本标准比较 32/34、中日文各自真实比较、ZIP 部分检查＋容量保护）；**L3–L5 = NOT_VERIFIED**（GAS 假响应不转发）；`FINAL_RELEASE_GATE = HOLD` | `01_测试运行数据/acceptance/20261112_NO012_Excel通用兼容与检查范围/evidence/phase10_online_acceptance.json`；`00_交付ChatGPT/20261113_NO012_发布准备/` |
| **20261112 NO009 Sheet 检查结果默认显示 正式上线** | commit `5743f43`；Vercel `DYiADGRqvm7uwFB7o4AZm4bqDdGp` success；线上 37/37 SHA（Excel `83f2192c…`、TVer FIX7 不变）；生产 URL 真 Chrome 6/6；**L3–L5 = NOT_VERIFIED**（本轮未授权生产日志测试，GAS 假响应不转发）；`FINAL_RELEASE_GATE = HOLD` | `01_测试运行数据/acceptance/20261112_NO009_ExcelSheet检查结果默认显示/release/`（online-sha.json、online_function.json） |
| **20261112 NO008 Excel 检查限制可视化 正式上线** | commit `625c00e7`；Vercel `AtF8kEFwoZHRspTpXNKHnsz4US44` success；线上 37/37 SHA（Excel `7eb7b371…`、TVer FIX7 不变）；生产 URL 真 Chrome 7/7；**L3–L5 = NOT_VERIFIED**（无有效真实 QC 登录态，未写生产日志）；`FINAL_RELEASE_GATE = HOLD` | `01_测试运行数据/acceptance/20261112_NO008_Excel正式上线/`（online-sha.json、online_function.json、usage_log_verification.md） |
| 20261111 NO002 2課 TVer FIX7 正式发布 | commit `1e5b570`；Vercel成功；线上37/37 SHA；生产下载字节GUI6/6；统计L3–L5 NOT_RUN | 00_交付ChatGPT/20261111_NO002_TVER_FIX7_PRODUCTION_RELEASE/ |
| 20261112 NO013 2課 TVer 命名接尾辞范围与最终验证（候选） | 接尾辞降级收窄至「本体一致＋差が接尾辞のみ」；最終SHA 73ae6f16…で专项148/148・aligned 891/46（NO011と逐名同一）・raw 858/79・Chrome5/5；008/009マトリクス無漂移；NO011のA17-3A 9→5項を訂正 | `candidates/20261112_NO013_TVER_命名接尾辞范围与最终验证/`、`01_测试运行数据/acceptance/20261112_NO013_TVER_命名接尾辞范围与最终验证/`、`00_交付ChatGPT/20261112_NO013_TVER_命名接尾辞范围与最终验证/`及同名REVIEW.zip |
| 20261112 NO011 2課 TVer 四组真实案件验证（候选） | 006=005同一输入／007 register／008 register／009 edit。对齐891/46与NO010逐名相同、原断言858/79；专项143/143、Chrome5/5；修正GP命名伪不一致7件（P25任意トークン・定義外接尾辞）、实差2件（008 auction_type）；007 GP粒度未確定で8件ambiguous；業務/発売HOLD | `candidates/20261112_NO011_TVER_四组真实案件验证/`、`01_测试运行数据/acceptance/20261112_NO011_TVER_四组真实案件验证/`、`00_交付ChatGPT/20261112_NO011_TVER_四组真实案件验证/`及同名REVIEW.zip |
| 20261112 NO010 2課 TVer 真实业务比较闭环（候选） | 继承NO006；hourly_bid_weight按260605默认空栏自动比较（auto 240→246）；对齐891/46，失败集合与NO006逐名相同；原断言858/79（同会话控制856/81、0新增）；专项131/131、Chrome5/5（原生下载恢复PASS）；Apple6/12/12、30 matched，实际比较288条；业务/发布HOLD | `candidates/20261112_NO010_TVER_真实业务比较闭环/`、`01_测试运行数据/acceptance/20261112_NO010_TVER_真实业务比较闭环/`、`00_交付ChatGPT/20261112_NO010_TVER_真实业务比较闭环/`及同名REVIEW.zip |
| 20261112 NO006 2課 TVer核心架构回归稳定化（候选） | 原断言792/145；证据裁定891/46，46历史失败集合不变；127/127专项、Chrome5/5；Apple6/12/12；规则42／来源不足102，业务/发布HOLD | `00_交付ChatGPT/20261112_NO006_TVER_核心架构回归稳定化/`及同名REVIEW.zip |
| 20261111 NO005 2課 TVer核心架构稳定化（跨日交付2026-11-12） | 阶段0 PASS；CP/Group/Ad/覆盖PARTIAL；BLS HOLD；专项69/69；937项773/164；最终Gate PENDING，正式未动 | `00_交付ChatGPT/20261111_NO005_TVER_核心架构稳定化/`及同名REVIEW.zip |
| 20261111 NO004 2課 TVer 阶段0 Sheet/模板适配（候选） | 固定样本重现 F01–F03；所有比较入口显式选择 Sheet；Apple 6/12/12；新旧模板、来源与 field coverage 通过；21/21测试、真Chrome 3/3；遗留回归0新失败；无正式区/生产变更 | `00_交付ChatGPT/20261111_NO004_TVER_阶段0_Sheet与模板适配/`；`acceptance/20261111_NO004_TVER_阶段0_Sheet与模板适配/`；`candidates/20261111_NO004_TVER_阶段0_Sheet与模板适配/` |
| 20261111 NO001 2課 TVer FIX7 发布准备 | NO004源不变；两项旧断言更新；891/46同基线；build37/37与Chrome6/6，本地READY、发布HOLD | 00_交付ChatGPT/20261111_NO001_TVER_FIX7_RELEASE_PREP/ |
| 20261110 NO004 2課 TVer 遗留问题调查与修复 | 隔离候选；修复 Start 漏检和 0% 跨点位取值；正式区/Git/生产未动 | `00_交付ChatGPT/20261110_NO004_TVER_遗留问题调查与修复/` |
| 20261110 NO003 核心 MD 精简 + Excel 日志验收 | 三份 MD 精简；Excel L2 复核 PASS，L3–L5 `NOT_VERIFIED`；无代码 / GAS / 部署变更 | `00_交付ChatGPT/20261110_NO003_核心MD精简与Excel日志验收/`；`02_历史归档/docs_baseline/20261110_NO003_核心MD精简与Excel日志验收/` |
| 20261110 NO002 Excel 正式发布与线上验收 | commit `15f90cdb`、deployment `2d4ccCYw…`、线上 37/37 SHA 一致；真实比较与 L3–L5 受阻于 Chrome 上传 | `00_交付ChatGPT/20261110_NO002_Excel正式发布准备/`；`01_测试运行数据/acceptance/…/post_release/` |
| 20261110 NO001 Excel 边框 / 斜线与结果导航（本地候选） | 候选 247582B / `53ef4ae9…`；旧引擎 39/39、真 Chrome 18/18；核心功能已审 | `00_交付ChatGPT/20261110_NO001_Excel边框与结果导航/` |
| 20261109 NO002 5課 9 件直接接入（**未发布候选**） | 真 Chrome 45/45、隔离构建 48/48；正式区零变更，正式反映 HOLD | `candidates/20261109_NO002_5KA_0018_SUBTOOL_PORTAL/`（仓库根 `candidates/`） |
| 20261106 NO011 图标补齐 + NEW 废除 | commit `6f3f5a4`、deployment `7602485472`；真 Chrome 36/36、线上 37/37 | `00_交付ChatGPT/20261106_NO011_PORTAL_LOGO_NO_NEW/`；`01_测试运行数据/acceptance/20261106_NO011_PORTAL_LOGO_NO_NEW/` |
| 20261106 NO010 0042 UTM 正式上线 | commit `e43bbd4`、deployment `7601638360`；逻辑 164/164、真 Chrome 75/75、线上 37/37 | `00_交付ChatGPT/20261106_NO010_0042_UTM_FINAL_RELEASE/` |
| 20261106 NO008 / NO009 UTM 审查与 UI 修正（候选） | F01–F12 修复、schema 原子回滚；候选保留不覆盖，H1–H4 等业务裁定 HOLD | `00_交付ChatGPT/20261106_NO008_0042_UTM_AUDIT_FIX/`、`…_NO009_0042_UTM_UI_FIX/` |
| 20261106 NO007 TVPR 6課 上线 | commit `cf36356`、Vercel `Gp32TGn6PSPi6X6Ttvwvkeb8zkgS`；集成 24/24、线上 36/36 | `00_交付ChatGPT/20261106_NO007_TVPR_6KA正式上线/` |
| 20261106 NO005 / NO006 TVPR 字体与 UI/UX 再設計（候选） | NO006 为 NO007 上线来源（59551B / `764250f8…`）；39/39；旧候选原样保留 | `00_交付ChatGPT/20261106_NO005_…/`、`…_NO006_…/`；`candidates/` |
| 20261106 NO003 / NO004 目录治理 / 架构核实 / 验收入口 | 目录清查、任务编号规则、GAS 隔离结论、public 备份规则、A/B/C 方案修正 | `00_交付ChatGPT/20261106_NO003_*/`、`…_NO004_*/` |
| 20261102 FIX6-B 及更早 | `4b34a7d fix(tver): enforce fail-closed auth gate`；首页改版 + 看板（2026-10-23/25） | `dev-materials/02_历史归档/03_封板版本/`、早期交付报告 |

> 历史目录与任务编号的映射见 `dev-materials/00_交付ChatGPT/HISTORY_DIRECTORY_MAP.md`。**不得删除上述交付包或归档资料。**


<!-- NO021_CPLUS_V23_CURRENT -->
## NO021 Excel C+ 当前隔离候选（2026-11-13）

- 用户正式裁定 C+，停止扩张条件格式语义引擎。唯一有效审核候选：`candidates/20261113_NO021_Excel通用化架构升级/Cplus_v23/excel_compare.html`，328466 B，SHA256 `daabe679ac7f8e644eb7b0f5934bb09509477071edfe7bffbc84d1dfd3cb9f17`。v20、v21、v22与其冻结记录全部保留，仅v23进入本次最终质量Gate。
- 生产保持 NO012 / HEAD `53ffc5d2c9b7f01f08d9cc42547de3144ddb0588`；生产只读下载 SHA 与本机一致 `aed5eb1fd1b9f1c60a6d81f3da3c5a84d57a89130e7fc40a7cbdfc7eb61b4553`。正式37资源、manifest、public未改；未Commit/Push/Deploy、未写GAS/Sheet。
- 真Chrome：业务/加载链33/33、范围单元23/23、8类及并存6/6、NO012预算8/8、ZIP容量6/6；标准/高速/ZIP均实测。TVer5、大正308、P-MAX原4差异与36来源→18范围组保留；全部范围可展开、可导出。
- 004：原始直接读取仍只可靠提供值与数字格式，新增直接样式能力0项；修复背景色未支持却PASS。Excel只读副本转换后字体色/背景色/边框可读，属于B辅助转换，原件SHA未变；公式/文本框样本均0，不能宣称实证支持。
- 001：9月原件1776438 B，ZIP缺EOCD，解析即失败；8月有效文件48 Sheet自比较可完成。单次观测NO012 4938 ms / v23 4294 ms，不构成通用性能提升证明，损坏原件A/B比较HOLD。
- 独立审查：Codex同SHA21/21 PASS；Claude BLOCKED（本机Claude Code实际模型deepseek-v4-flash，已停止，不计Claude）；Workbuddy NOT_RUN（无可用独立执行器）。三方审核未齐，ChatGPT最终Gate待审，PRODUCTION_RELEASE_GATE=HOLD，STRICT_AUTHORIZATION_GATE=NOT_MET，L3–L5=NOT_RUN。
- 六份报告与唯一审核包：`dev-materials/00_交付ChatGPT/20261113_NO021_Excel通用化架构升级/Cplus_v23/`、同层任务目录外的`20261113_NO021_Excel通用化架构升级_Cplus_v23_REVIEW.zip`。下一步仅为相同冻结SHA补齐真实Claude、Workbuddy独立审查并交ChatGPT，不申请发布。


<!-- NO021_V23_VALIDATION_20261114 -->
## NO021 v23 第一轮实际质量调查（2026-11-14）

- 按用户最新裁定，本轮由当前Codex会话执行，不安排第二AI；架构方向沿用APPROVED。v23源码仍328466B / `daabe679ac7f8e644eb7b0f5934bb09509477071edfe7bffbc84d1dfd3cb9f17`，源码0修改，未创建正式修复候选。
- 真实Chrome：P-MAX34Sheet/18范围/既有4差异、展开及中日文导出保持；004原件6Sheet全部partial，值与2对数字格式实际比较；TVer5、大正308、8类6/6、预算8/8、ZIP容量6/6及三模式保持。
- 新确认P0-01：仅条件格式字体/填充显示红蓝不同，Excel DisplayFormat分别255/16711680，但v23和NO012均给8类0差异及Sheet完整检查；未验证颜色范围未标明。不是v23新回归，仍阻断发布；仅提供最小复现与状态防护建议，不扩张语义引擎、不覆盖v23。
- 004本轮Excel只读转换逐格保真：每原件4970位置，值/数字格式/基础字体/填充/6边（含斜线）/合并均0差异；99条CF的定义及字体/填充/4边属性0差异。原件不变、7外链未更新且目标列表相同、VBA/Connections均0。公式0、Shapes/OLE0，不能外推完整保真。推荐C为可选手动Excel→XLSX辅助流程，CF实际显示仍须人工核对。
- 001损坏原件ZIP缺EOCD，解析即失败；有效8月48Sheet自比较三轮中位NO012=3877ms、v23=4410ms，未证实提升；比较后JS堆中位279.6/302.6MiB，不是进程峰值。
- 本轮P0=1/P1=1/P2=2；P1是继承SheetJS0.18.5已知安全漏洞。SRI/无CDN回退正常，版权与完整许可存在；P2为0/6完整检查文案及产品声明标识补齐建议。详见精简5报告及`NO021_CPLUS_V23_VALIDATION_REVIEW.zip`。
- `RELEASE_RECOMMENDATION=HOLD`；`READY_FOR_SECOND_REVIEW=YES`；由用户指定另一AI，当前不组织。生产NO012/HEAD53ffc5d不变，未Commit/Push/Deploy；L3–L5 NOT_RUN，STRICT_AUTHORIZATION_GATE=NOT_MET。

<!-- NO021_INDEPENDENT_REVIEW_20261114 -->
## NO021 v23 第二轮独立审核（2026-11-14 NO002）

- 审核对象冻结不变：v23 candidates/20261113_NO021_Excel通用化架构升级/Cplus_v23/excel_compare.html = 328466 B / daabe679ac7f8e644eb7b0f5934bb09509477071edfe7bffbc84d1dfd3cb9f17；生产 NO012 / HEAD 53ffc5d / Excel aed5eb1f… 未变。本轮未改候选/生产/共享库/manifest/第一轮证据，未 Commit/Push/Deploy，未写 GAS/Sheet。
- CF_COLOR_P0 = CONFIRMED：v23 与 NO012 对 cf_font / cf_fill_solid 均 8 类 0 差异、Sheet「完整检查 1/1」，Excel DisplayFormat 字体/填充 255 vs 16711680；另独立确认 colorScale / dataBar / iconSet / dxf numFmt 同样漏检（共 7 个 CF 规则族）。根因 xlcompCfScope 1049–1123 仅以 border 为谓词、compareSheet 只比静态样式。最小修复原型（12 处编辑/134 行/+3695 B，无需公式求值器）可让 7 族全部转「部分检查」且 0 误报；只覆盖 font/fill 不足。真实大正 308 文件 XML 级有 66 组 CF 内容真实不同，页面仍显示通过。
- SHEETJS_SECURITY = CONFIRMED：生产/候选均运行 0.18.5（c9506197…），受 CVE-2023-30533（≤0.19.2）与 CVE-2024-22363（≤0.20.1）影响；项目内 xlsx-0.20.3.full.min.js（cc015130…）与官方 cdn.sheetjs.com 发布逐字节相同，git/manifest/public 已存在且被 2 个生产页使用。隔离实测 Excel 页私有 0.20.3 与 0.18.5 在 12 对素材/三模式/导出上零差异字段；推荐 v24 采用「页私有 0.20.3 + SRI」，不改共享库。补充：生产 NO012 无 SRI 且有 CDN 回退（含 0.20.1），v23 已修复但未发布。
- XLSB_CONVERSION = PARTIAL：004 两原件与各自转换件逐项 0 内容/样式/CF 差异（4970 UsedRange 位置 = 3150 实体格 + 1820 空位；99 条 CF/文件；7 外链；无公式/对象/宏）。合成 8 对：转换↔转换可检出 7/8 类，CF 显示颜色仍漏检并判 PASS。NEW P1：xlsb↔转换 xlsx 混合比较不可用（虚假 cell=7/bgcolor=170 + 字体/边框/文本框假阴性），方案 C 必须双方转换。建议保留有条件的人工辅助流程。
- 回归/性能：TVer 5、大正 308、P-MAX（002 新/旧）34/33/34 + 2背景/1文本框/1结构 + 18 组/36 来源 + checked32/34、8 类 7×1、日志 1/1/0、NO012 预算 8/8、ZIP 容量 6/6、001 9 月损坏+8 月 48 Sheet 均复现（OLD_REGRESSION = PASS）。001 有效件 7 轮中位 v23 5523ms vs NO012 5175ms（+6.7%），解析 +20.1%、比较 −1.8%、渲染 +1.3%，PERFORMANCE = PARTIAL。
- NEW P2：v23「真实差异优先」把「有差异 + 有未验证范围」的 Sheet 计入「完整检查/已检查」（NO012 为部分检查），建议与 P0 同轮修复；另有「4970/Manual」口径修正与 9 条隐藏 _xlfn 名称转换丢失（无引用）。
- 四份报告与审核包：dev-materials/00_交付ChatGPT/20261114_NO002_NO021_INDEPENDENT_REVIEW/（INDEPENDENT_REVIEW / REPRODUCTION_RESULTS / SECURITY_AND_COMPATIBILITY / XLSB_CROSSCHECK + 同名 _REVIEW.zip）。RECOMMENDED_NEXT_ACTION = HOLD v23，另立 v24 最小修复后重审；RELEASE_GATE = HOLD，STRICT_AUTHORIZATION_GATE = NOT_MET，L3–L5 NOT_RUN。

<!-- NO024_INDEPENDENT_REVIEW_20261116 -->
## NO024 独立交叉审核（2026-11-16）

- 审核对象：`dev-materials/00_交付ChatGPT/20261116_EXCEL_FINAL_RELEASE_GATE_REVIEW.zip`（ZIP `b412803e…`）。独立解压 73/73 内容 SHA256 一致；引擎 `e5305101…`（361,999 B）与 converter bundle `415cf2a7…` 与提名一致；`before/` converter 源码与 NO007 candidate 逐字节相同；引擎与 NO007 候选逐字节相同。
- `ENGINE_GATE=PASS`：独立重跑 `engine_targeted` 11/11、`engine_modes` 7/7；真实案件按 DEV_REPORTED 采信并验算一致（TVer 边框 5/3 Sheet partial、大正 308、P-MAX 34 Sheet/4 差异、004 = 1 完整 + 5 部分 0 差异、8 类 12/12）。未发现新增错误 PASS 或真实漏检。
- `CONVERTER_STATIC_GATE=PASS`（Close→Quit→release、8000 ms grace、6 项 ownership、无全局 Kill）。`CONVERTER_RUNTIME_GATE=PASS_WITH_DEFECT`：本机 PS 5.1 `-File` 可执行（未用 Bypass、未改策略），真实 Excel Office16 完成 20 次 COM 转换。
- **BLOCKER_A（新引入）= CONVERTER_SHUTDOWN_RACE**：Excel Quit 后主窗口约 3.1–4.5 s 即销毁、进程要到 4.8–10.6 s 才退出；父进程"等待前 HWND 校验"落在该窗口即返回 `EXCEL_CLEANUP_UNVERIFIED` 并跳过 8 秒等待 → 成功转换被判失败，实测 3/20（15%），其中一次使正常 A/B 配对整体被拒。最小修复候选 FIX1（`candidates/20261116_NO024_EXCEL_FINAL_RELEASE_GATE_FIX1/`，core `01b5ae7e…`/bundle `08807c97…`）把假失败降到 1/11（9%）但未清零（仍存在 8 s < 实测 10.6 s 长尾、HWND 消失后强杀路径不可达两点），**不是可发布修复，须负责人裁定 Kill 门禁策略**。
- `USER_EXCEL_SAFETY=PASS`（既有 Excel 实例存活、pid/startTime/内容不变，20 次 0 误杀）；`ATOMICITY=PASS`（任一失败→accepted=false、`*_FAILED`、`diagnostics/` 隔离、源文件 SHA 20/20 未变）；`DEFERRED_B`：8 s 长尾、3 s 超时泄漏隐形 `/automation` Excel、HWND 门禁自相矛盾、ZIP 内非 ASCII 文件名未置 UTF-8 标志、`index.html:895 recordRecent` 未定义（既有）。
- `PRODUCTION_VERSION=CONFIRMED 1812cbc / excel_compare.html fa1b73b3…（356,491 B）`：本轮线上可访问，`/excel_compare.html` 与 HEAD blob 字节一致；`index/dv360/amazon_dsp/tver/excel_clean` 5/5 线上=HEAD，其他 QC 工具未受影响；`STRICT_AUTHORIZATION_GATE=NOT_MET`，L3–L5 NOT_RUN。
- 裁定：`ENGINE_RELEASE_READY=YES`（引擎可独立上线）；`CONVERTER_RELEASE_READY=NO`；`OVERALL_GATE=HOLD`。审核包：`dev-materials/00_交付ChatGPT/20261116_NO024_INDEPENDENT_REVIEW/` + `_REVIEW.zip`（SHA256 见交付目录同名 `.sha256` 文件）。本轮未改冻结源码/根目录页面/manifest/public，未 Commit/Push/Deploy。
