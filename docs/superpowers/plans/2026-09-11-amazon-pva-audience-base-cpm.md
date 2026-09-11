# Amazon PVA Audience + Base CPM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Amazon PVA checker extract the real Ver1-5 JKA segment sheet correctly and retire PVA Base CPM from QC comparison/UI while preserving raw parsing and OTT/Display behavior.

**Architecture:** Keep the existing bounded explicit Segment Sheet resolver and old-format parser in `amazon_dsp_check.html`. Extend only the old-format operator scan using the actual JKA row layout, and carry a dedicated PVA Base CPM skip state through video comparison statistics and column rendering; keep `DL_COLUMNS_VIDEO` and raw `base_cpm` fields intact.

**Tech Stack:** Static HTML/JavaScript, SheetJS workbook-shaped test doubles, Node's built-in `node:test`, Python/openpyxl for read-only real-workbook extraction.

**Spec:** `C:\Users\BPO\.codex\attachments\7e902991-0f3d-43f3-9a59-4861cb8fa013\pasted-text.txt`

## Global Constraints

- Production SHA must equal `5993DD143BBA0530AA0F3736F44D35B1304C238E9F291A7739C3F316C53DFA0F` before changes.
- Use the exact real JKA XLSX when available; never fabricate a real-XLSX validation result.
- Preserve the previous exact explicit resolver behavior and default `セグメントシート` support; do not broaden fuzzy matching.
- Preserve raw setting/download Base CPM parsing and the shared `DL_COLUMNS_VIDEO` entry.
- PVA excludes Base CPM for all PG and non-PG; OTT and Display Base CPM remain unchanged.
- Do not change Audience comparison logic beyond the proven old-format parsing root cause.
- Do not commit or push.

---

### Task 1: Capture the real JKA baseline and focused regression contract

**Files:**
- Create: `tests/amazon_dsp_pva_audience_base_cpm.test.js`
- Read-only input: `D:\業務用\開発用\テスト用アイル\設定用\AmazonPVAテスト\002\【9月配信】AmazonDSP_PVA用設定シートVer1_5_公益財団法人JKA.xlsx`

**Interfaces:**
- Export the existing inline functions `_readSegmentSheetOldFMT`, `readAllSegmentSheets`, `readSettingTableVideo`, `matchAndCompareVideo`, and `DL_COLUMNS_VIDEO` from the VM test harness.
- The real-workbook test reads `process.env.AMAZON_JKA_XLSX` through Python/openpyxl and passes workbook-shaped rows into the production parser without writing a fixture.

- [x] **Step 1: Confirm the production SHA and run the existing resolver/full/fixture/syntax baselines.**

- [x] **Step 2: Confirm the JKA shortcut resolves to an existing real XLSX and inspect Ver1-5, six LI rows, and the old segment-sheet layout.**

- [x] **Step 3: Add a failing JKA test that asserts six LIs resolve to `セグメントシート`, two Include groups of lengths 8 and 3, `and` is present in `groupOps`, and there are 11 unique source segments.**

```js
const parsed = api.readSettingTableVideo(makeWorkbookFromXlsx(filePath), 'amazon_pva');
assert.equal(parsed.length, 6);
for (const li of parsed) {
  assert.equal(li.__SEGMENT_SHEET_NAME__, 'セグメントシート');
  assert.deepEqual(li.__SEGMENT_SHEET__.groups.map(g => g.segments.length), [8, 3]);
}
assert.ok(api.readAllSegmentSheets(makeWorkbookFromXlsx(filePath))['セグメントシート'].groupOps.includes('and'));
assert.equal(new Set(parsed[0].__SEGMENT_SHEET__.groups.flatMap(g => g.segments)).size, 11);
```

- [x] **Step 4: Run the JKA test before production changes and record the RED result.**

Run: `$env:AMAZON_JKA_XLSX='D:\業務用\開発用\テスト用アイル\設定用\AmazonPVAテスト\002\【9月配信】AmazonDSP_PVA用設定シートVer1_5_公益財団法人JKA.xlsx'; node --test tests\amazon_dsp_pva_audience_base_cpm.test.js --test-name-pattern='JKA'`

Expected: FAIL because the Ver1-5 parser currently scans only rows 0-2 for operators and misses JKA's row-3 `および(and)`.

### Task 2: Retire PVA Base CPM from comparison and UI

**Files:**
- Modify: `amazon_dsp_check.html:2597-2620, 3625-3642, 3816-3854, 7040-7145`
- Test: `tests/amazon_dsp_pva_audience_base_cpm.test.js`

**Interfaces:**
- `DL_COLUMNS_VIDEO` continues to expose `Base supply bid*` and its check function continues to read `s.base_cpm` for non-PVA systems.
- PVA video comparison emits a per-column skip reason/status for Base CPM; mismatch/review totals ignore that column.
- PVA rendering excludes Base CPM from both the normal visible-column list and the toggle panel; OTT and Display filters are unchanged.

- [x] **Step 1: Add B1-B7 tests before implementation.**

```js
for (const [setting, download] of [[1550, 1550], [1550, 999], [1550, ''], ['', 1550]]) {
  const item = runVideoCompare('amazon_pva', setting, download);
  assert.equal(item.colResults.find(c => c.key === 'Base supply bid*').status, 'skip');
  assert.equal(item.mismatchCount, 0);
}
assert.equal(getBaseCheck('amazon_ott')({ __SYSTEM__: 'amazon_ott', base_cpm: '1550' }, '999'), false);
assert.equal(getBaseCheck('amazon_dsp')({ __SYSTEM__: 'amazon_dsp', base_cpm: '1550' }, '999'), false);
assert.equal(getBaseCheck('amazon_pva')({ __SYSTEM__: 'amazon_pva', base_cpm: '1550' }, '999'), null);
assert.equal(getBaseCheck('amazon_pva')({ __SYSTEM__: 'amazon_pva', base_cpm: '' }, '1550'), null);
assert.equal(getBaseCheck('amazon_pva')({ __SYSTEM__: 'amazon_pva', base_cpm: '1550' }, ''), null);
```

- [x] **Step 2: Run the Base CPM tests and confirm the current implementation fails for PVA mismatch/review/UI expectations while OTT/Display checks remain active.**

- [x] **Step 3: Make the minimal production change.**

```js
// Base supply bid* checkFn
if (s.__SYSTEM__ === 'amazon_pva') return null;
// existing PVA PG skip branch remains separate for other PG fields

const pvaBaseCpmExcluded = system === 'amazon_pva' && col.key === 'Base supply bid*';
return {
  ...,
  skipReason: pvaBaseCpmExcluded ? 'PVAではBase CPMをQC対象外' : existingPgSkipReason,
  status: pvaBaseCpmExcluded ? 'skip' : existingStatus,
};
```

Use the same `pvaBaseCpmExcluded` predicate to omit the column from PVA `visibleCols` and the column-toggle filter, leaving `DL_COLUMNS_VIDEO` and `sGetForCol('Base supply bid*')` untouched.

- [x] **Step 4: Run the focused Base CPM tests and confirm B1-B7 pass.**

### Task 3: Make the old Ver1-5 parser match the JKA row layout

**Files:**
- Modify: `amazon_dsp_check.html:2604-2616`
- Test: `tests/amazon_dsp_pva_audience_base_cpm.test.js`

**Interfaces:**
- `_readSegmentSheetOldFMT(rows)` retains its current dynamic type/segment-column detection and group extraction.
- Operator extraction scans the pre-data rows through the detected `dataStartRow`, deduplicates `and`/`or`, and therefore sees JKA row-3 `および(and)` without treating repeated inner-operator cells as separate operators.

- [x] **Step 1: Implement only the proven parser fix.**

```js
// after dataStartRow is found, scan rows before it and append each operator once
for (let ri = 0; ri < dataStartRow; ri++) {
  for (const value of (rows[ri] || [])) {
    const s = String(value || '').trim();
    if (s.includes('および') || s.toLowerCase() === 'and') {
      if (!result.groupOps.includes('and')) result.groupOps.push('and');
    } else if (s.includes('または') || s.toLowerCase() === 'or') {
      if (!result.groupOps.includes('or')) result.groupOps.push('or');
    }
  }
}
```

Remove the old fixed `ri <= 2` operator scan so the same operator is not collected twice.

- [x] **Step 2: Run the JKA test and confirm six LIs, 2 groups, 8/3 rows, 11 unique segments, and `and` pass.**

- [x] **Step 3: Run previous resolver, Audience/Segment, Base CPM, Amazon full, real-file fixture, and inline syntax regressions.**

### Task 4: Final verification and handoff

**Files:**
- Read-only: all changed files and git diff

- [x] **Step 1: Run `git diff --check` and inspect the exact diff for scope containment.**

- [x] **Step 2: Recompute `PRODUCTION_SHA_AFTER`, verify no commit/push occurred, and report only the requested named gate fields.**

**Expected final gate:** `AMAZON_PVA_AUDIENCE_BASE_CPM_CODE_GATE=PASS`, with real JKA XLSX validation PASS and OTT/Display Base CPM regressions PASS.
