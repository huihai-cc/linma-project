# USAGE_DASHBOARD FIX1A — FINAL ローカル基线封（2026-10-24）

> **この封はローカル基準の封であり、本番環境への配備を意味しない。**
> （`FIX1A_BASELINE_SEALED = YES` は「以後の Candidate 開発の基点を固定した」という意味に限定される）

## 1. 封の内容

| 項目 | 値 |
|---|---|
| sealId | `USAGE_DASHBOARD_FIX1A_FINAL_20261024` |
| 対象 | `usage_dashboard.html` |
| SHA256 | `4fa0c20fb66c21715324e9f392979638e3c7aca683edecd3052a0c2a1b050b32` |
| 行数 / CRLF | 1,535 行 / 19 行 |
| バイト数 | 77,536 |
| 承認 | ChatGPT Code Gate（2026-10-24） |
| ユーザー実機確認 | **`USER_REAL_GUI_QA = PASS`** |

### ユーザー確認済み項目（原文）

- 工具分析默认全期间正常
- 单月份执行次数显示正常
- 工具趋势图切换正常
- 图表显示正常
- 月次矩阵交替背景正常
- 原有功能未发现异常

## 2. 封ファイル

```
docs/usage-dashboard/seal/FIX1A_FINAL_20261024/
├── MANIFEST.json                      # SHA・証跡・テスト結果の正本
├── README.md                          # 本ファイル（封板清单）
├── usage_dashboard.html.sealed        # 読み取り専用（4fa0c20f…）
└── usage_dashboard_logic.js.sealed    # 読み取り専用（8662783b…）
```

`.sealed` は **読み取り専用属性**を付与済み。以後の Candidate 開発は
`docs/usage-dashboard/seal/FIX1A_FINAL_20261024/` を**参照のみ**とし、上書きしない。

## 3. 封板清单（チェック結果）

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 当前 `usage_dashboard.html` の SHA256 が承認値と一致 | **PASS** | `4fa0c20f…` == 承認値 |
| 2 | 上書きされない FINAL スナップショットを保存 | **PASS** | `.sealed` + 読み取り専用属性 |
| 3 | FIX1A Code Gate とテスト証跡を保持 | **PASS** | `USAGE_DASHBOARD_UI_FIX1A_CODE_GATE.md`（`d8d6e7cf…`）、`ui_fix1a/*.png`（7 枚）、テスト 4 本 |
| 4 | `USER_REAL_GUI_QA = PASS` を記録 | **PASS** | `MANIFEST.json` の `userRealGuiQa` |
| 5 | 封板清单の完成 | **PASS** | 本ファイル |
| 6 | 验收済み FIX1A 機能を変更していない | **PASS** | 封はコピーのみ。live ファイルは無変更 |
| 7 | 他タスクのファイルを上書きしていない | **PASS** | `index.html` / `Code.gs` の SHA が封直前と一致 |
| 8 | 正式リリースを実行していない | **PASS** | COMMIT / PUSH / DEPLOY いずれも未実施 |

## 4. テスト結果（封時点）

13 ファイル / **230 pass / 0 fail / 0 skip**、全ファイル `exit=0`。

```
usage_dashboard_logic            37   usage_dashboard_ui_fix1a          14
usage_dashboard_page             16   usage_dashboard_ui_fix1a_layout    4
usage_dashboard_dom              20   index_header_removal_fix1         25
usage_dashboard_index_entry      16   index_sidebar_nav                 24
usage_dashboard_ui_fix1          20   qc_header_p2a                     25
usage_dashboard_ui_fix1_layout    4   qc_header_p2b_fix1                12
                                      qc_header_p2b_pages               13
```

## 5. 復元手順

```bash
# 封時点の状態に戻す（live を封と同一にする）
cp docs/usage-dashboard/seal/FIX1A_FINAL_20261024/usage_dashboard.html.sealed usage_dashboard.html
sha256sum usage_dashboard.html   # 4fa0c20fb66c21715324e9f392979638e3c7aca683edecd3052a0c2a1b050b32

# FIX1 前の完全な原本に戻す（FIX1A 自体を取り消す場合）
cp _backup_fix1/usage_dashboard.html.pre_fix1 usage_dashboard.html
sha256sum usage_dashboard.html   # 4bb6b24684c5beb4743867323768f9c1a99198675b411ecb20bfc21c78f454cf
```

読み取り専用属性を外す必要がある場合:

```bash
attrib -R docs\usage-dashboard\seal\FIX1A_FINAL_20261024\*.sealed
```

## 6. 既知の制約（封に含めて記録）

- **FIX1 中間物（`66f0e1c1…`）はファイルとして残っていない**（in-place 更新のため）。FIX1 の挙動は
  `tests/usage_dashboard_ui_fix1.test.js`（20 件）と `USAGE_DASHBOARD_UI_FIX1_CODE_GATE.md` に固定されている。
- 本番配備の有無は**この封では保証しない**（`productionDeployed: false`）。
- `usage_dashboard.html` は **git 未追跡**（untracked）。封は git ではなくファイルコピー＋SHA で担保している。
