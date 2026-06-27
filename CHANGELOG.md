# 修改履歴

> 期間：2026-06-27  
> 対象ファイル：`amazon_dsp_check.html` / `index.html` / `index_legacy.html`

---

## 1. アプリグループID の表示・対比対応

**対象**：`amazon_dsp_check.html`

### 1-1. 設定表の列マッチング修正
- `readSettingTableDSP` の `mobile_app` キーワードに `'Mobile app'` を追加
- 修正前：`['Mobile app targeting']` → 修正後：`['Mobile app targeting', 'Mobile app']`
- 理由：設定表Excelの列ヘッダーが「Mobile app」のみの場合、マッチングに失敗していた

### 1-2. `_getSettingValForCol` にマッピング追加
- `'Mobile app group ID targeting': sRow.mobile_app` を追加
- 設定表の Mobile app 列の値（BL/別紙参照/WL/空）が取得されるように

### 1-3. `Mobile app group ID targeting` 列の定義変更
- `autoHide:true` を削除（常に表示）
- `checkFn` を追加：BL/WLあり＋DLあり→要確認 / BL/WLあり＋DL空→不一致 / 設定空＋DLあり→要確認 / 両方空→正常

---

## 2. アプリターゲティング（Include/Exclude）の対比ロジック強化

**対象**：`amazon_dsp_check.html`

### 2-1. `Mobile app targeting - include or exclude` の checkFn 書き換え
修正前：設定表に値があれば一律「要確認」  
修正後：

| 設定表 | 期待値 | DL値 | 判定 |
|--------|--------|------|------|
| WL | Include | Include | ✅ 正常 |
| WL | Include | Exclude/空 | ❌ 不一致 |
| BL/別紙 | Exclude/空 | Exclude/空 | ✅ 正常 |
| BL/別紙 | Exclude/空 | Include | ❌ 不一致 |
| 空 | Exclude/空 | Exclude/空 | ✅ 正常 |
| 空 | Exclude/空 | Include | ☞ 要確認 |

---

## 3. 非表示だった列への対比ロジック追加

**対象**：`amazon_dsp_check.html`

以下の4列を `autoHide:true` から表示＆対比ロジック追加に変更：

| 列 | 対比ロジック |
|----|-------------|
| **Only use contextual** | Yes→✅（多数派）/ No/空→☞開発者連絡 |
| **コンテキスト（Amazon内）** | Yes→☞開発者連絡 / No/空→✅ |
| **IABカテゴリ** | 設定表Content列＋DL値で対比（有/有→要確認 / 有/空→不一致 / 空/有→要確認 / 空/空→正常） |
| **コンテンツターゲティング** | TWITCH_EXPANDED/空→✅ / 以外→☞開発者連絡 |

### 3-1. 設定表のContent列読み取り追加
- `readSettingTableDSP` の `COL_KEYWORDS` に `content:['コンテンツ','Content','IAB']` を追加
- 結果オブジェクトに `content:g(colIdx.content)` を追加
- `_getSettingValForCol` に `'IAB content categories': sRow.content` を追加

---

## 4. 類似オーディエンスの対比ロジック簡略化

**対象**：`amazon_dsp_check.html`

- `Reach similar audiences` の checkFn を簡略化
- 修正前：セグメントシートの有無による複雑な分岐
- 修正後：DL値=No→✅ / 以外→☞開発者連絡

---

## 5. セル展開のダブルクリック化

**対象**：`amazon_dsp_check.html`

- データセルの `onclick` を `ondblclick` に変更
- シングルクリックでの誤展開を防止（コピー操作時の誤動作対策）
- DSP / PVA / OTT 全タイプ共通

---

## 6. ナビゲーションページ リニューアル

**対象**：`index.html`

### 6-1. 変更内容
- タイトル：「惠海 QC ツール」→「🛠️ 惠海 QC ポータル」
- 「🔒 完全本地运行」バッジを削除
- レイアウト：固定リスト → **アコーディオン折りたたみ式**
- 課室構成：共通 / 1課 / **2課～6課（準備中プレースホルダー付き）**
- 旧「統合版（保留中）」セクションを削除

### 6-2. 削除
- `index_legacy.html` を削除

---

## 現在のファイル構成

```
amazon_dsp_check.html   ← 今回の主な修正対象（DSP/PVA/OTT 設定チェック）
index.html              ← ナビゲーションポータル（リニューアル）
tools_text.html
excel_clean.html
excel_compare.html
image_compare.html
upload.html
yomiko_kanri.html
xlsx.full.min.js
jszip.min.js
```

---

## 7. PVA/OTT コンテンツターゲティング統一

**対象**：`amazon_dsp_check.html`

- `DL_COLUMNS_VIDEO` の `Targeting - Content` を DSP と同じロジックに統一
- TWITCH_EXPANDED / 空 → ✅ / 以外 → ☞開発者連絡

---

## 8. Keyword 対比機能

**対象**：`amazon_dsp_check.html`

### 8-1. KW sheet 読み取り
- `readKWSheet()` 関数追加：名称に「KW」を含むシートの A 列を抽出
- `readSettingTableDSP` にて Keyword 列（`keyword:['Keyword','キーワード']`）と KW sheet を読み取り
- `sRow.keyword` と `sRow.__KW_DATA__` に保存

### 8-2. Targeting by Keywords（ja: Keyword）
- `checkFn` 追加：
  - None/空 → sKws=[] → DL空なら✅
  - 別紙「KW」参照 → KW sheet 使用
  - セル直書き → split で抽出
  - ■KWターゲティングリスト は比較対象から除外
  - 全角スペース→半角スペースに正規化
  - sort 後完全一致→✅ / 不一致→❌（差異を `__keyword_diff__` に保存）
- レンダリングに `__keyword_diff__` 表示対応追加

### 8-3. Target Keywords using only contextual signals?（ja: KW_only）
- `checkFn` 追加：AF 列に内容あり＋AG=YES→✅ / 設定表空＋AF 空→✅ / 以外☞

### 8-4. バグ修正
- `const dKws` → `let dKws`（再代入不可エラー修正）
- sed による誤削除を修復（`return false` / `return true` / 列ヘッダー欠落）

---

## 9. セル展開のダブルクリック化

**対象**：`amazon_dsp_check.html`

- データセルの `onclick` → `ondblclick` に変更
- シングルクリック誤展開防止（コピー操作対策）
- DSP/PVA/OTT 全タイプ共通
