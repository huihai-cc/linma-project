# Amazon PVA Gender Hierarchy Canonical Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make confirmed Amazon PVA `Demographic > Gender >` setting names compare canonically with the corresponding downloaded `Demo - ...` names without weakening existing fuzzy safety rules.

**Architecture:** Add a Segment-comparison-only canonical helper or equivalent local branch inside `_segmentNamesEquivalent()`. It will first use the existing `_normalizeAudienceName()`, then strip only the explicit `Demographic > Gender >` hierarchy; all other names continue through the existing exact and `last segment >= 8` fallback logic.

**Tech Stack:** Static HTML/JavaScript, Node `node:test`, VM extraction of the inline production script, Python/openpyxl read-only extraction for the real JKA workbook.

**Spec:** `C:\Users\BPO\.codex\attachments\974ad7f2-ae20-4807-b2cb-9e07512b6fdc\pasted-text.txt`

## Global Constraints

- Production SHA must equal `EEB8C2E49A91794584E69FC21FF3ACB514825BAB28951BAEA8327BE568C8E838` before changes.
- Preserve Segment Sheet explicit/default resolver, JKA extraction, PVA Base CPM retirement, and all prior tests.
- Do not modify `_findSegmentForLI()`, `_readSegmentSheetOldFMT()`, `_readSegmentSheetDynamic()`, download Audience parsing, Area logic, Base CPM, CR, Display, or OTT.
- Do not remove or relax the existing `last segment length >= 8` condition.
- Do not add global short-token fuzzy, `endsWith`, `includes`, Levenshtein, or hardcoded Male/Female mappings.
- Do not commit or push.

---

### Task 1: Read-only baseline and root-cause trace

**Files:**
- Read: `amazon_dsp_check.html`
- Read: existing `tests/amazon_dsp_*.test.js`
- Read-only input: `D:\業務用\開発用\テスト用アイル\設定用\AmazonPVAテスト\002\【9月配信】AmazonDSP_PVA用設定シートVer1_5_公益財団法人JKA.xlsx`

**Interfaces:**
- Trace `_normalizeAudienceName()`, `_segmentNamesEquivalent()`, `_segmentNameFuzzyEquals()`, and the `DL_COLUMNS_VIDEO` Audience names `checkFn`.
- Record setting normalized value, download normalized value, comparison result, and the first failing layer before production changes.

- [x] **Step 1: Verify the production SHA equals the required candidate.**

- [x] **Step 2: Run Amazon full tests, resolver tests, existing Audience/Segment tests, PVA Base CPM tests, fixture verifier, and inline JS syntax.**

- [x] **Step 3: Trace the real JKA Audience path and confirm the mismatch is only `Demographic > Gender > Male` versus `Demo - Male`, with the existing `>=8` fallback bypassed because `Male` is length 4.**

### Task 2: Add G1-G9 RED tests

**Files:**
- Create: `tests/amazon_dsp_gender_hierarchy_canonical.test.js`

**Interfaces:**
- Export `_normalizeAudienceName`, `_segmentNamesEquivalent`, `_segmentNameFuzzyEquals`, and the Audience names `checkFn` from the existing inline VM script.
- Use the real JKA workbook through `AMAZON_JKA_XLSX` when available; do not write or fabricate a real-case fixture.

- [x] **Step 1: Add focused assertions for G1-G9.**

```js
assert.equal(equivalent('Demographic > Gender > Male', 'Demo - Male'), true);
assert.equal(equivalent('Demographic > Gender > Female', 'Demo - Female'), true);
assert.equal(equivalent('Demographic > Gender > AudienceOne: Gender - Male', 'Demo - AudienceOne: Gender - Male'), true);
assert.equal(equivalent('Demographic > Gender > Intimate Merger: Male', 'Demo - Intimate Merger: Male'), true);
assert.equal(equivalent('Demographic > Gender > Male', 'Demo - Female'), false);
assert.equal(equivalent('Some Other Category > Male', 'Demo - Male'), false);
assert.equal(equivalent('Demographic > Age > AudienceOne: Age 20-21', 'Demo - AudienceOne: Age 20-21'), true);
assert.equal(longLastSegmentFallbackStillWorks, true);
assert.equal(ordinaryAudienceComparisonsRemainUnchanged, true);
```

- [x] **Step 2: Run the focused tests before production changes and record `RED_RESULT=FAIL_AS_EXPECTED` with G1 as the failure.**

### Task 3: Minimal Segment-only canonical implementation

**Files:**
- Modify: `amazon_dsp_check.html` in `_segmentNamesEquivalent()` / adjacent Segment-name comparison helpers only
- Test: `tests/amazon_dsp_gender_hierarchy_canonical.test.js`

**Interfaces:**
- Add `_normalizeSegmentComparableName(value)` or an equivalent private helper.
- The helper returns the existing normalized name except that a value matching the explicit `Demographic > Gender >` hierarchy returns the normalized text after that prefix.
- `_segmentNamesEquivalent()` uses exact equality on the canonical values before its existing `last segment >= 8` fallback.

- [x] **Step 1: Implement only the explicit hierarchy canonicalization.**

```js
function _normalizeSegmentComparableName(value) {
  const normalized = _normalizeAudienceName(value);
  const genderPrefix = /^demographic\s*>\s*gender\s*>\s*(.+)$/i;
  const match = normalized.match(genderPrefix);
  return match ? match[1].trim() : normalized;
}
```

Use this only in Segment-name equivalence; do not alter `_normalizeAudienceName()` globally and do not replace the existing length guard.

- [x] **Step 2: Run G1-G9 and confirm `GREEN_RESULT=PASS`.**

### Task 4: Real JKA validation and regression gate

**Files:**
- Read-only input: JKA real XLSX and available download fixture/data

- [x] **Step 1: Re-run the real JKA 6-LI path and verify Group2 `AudienceOne: Gender - Male`, `Intimate Merger: Male`, and generic `Male` all match their downloaded names.**

- [x] **Step 2: Run resolver 11/11, Audience/Segment full, Base CPM retirement, Amazon full, fixture verifier, and inline JS syntax.**

- [x] **Step 3: Verify unchanged boundaries: resolver `NO CHANGE`, download parser `NO CHANGE`, area `NO CHANGE`, PVA Base CPM `STILL RETIRED`, OTT `UNCHANGED`, Display `UNCHANGED`, CR `UNCHANGED`.**

### Task 5: Final verification and handoff

**Files:**
- Read-only: final diff, plan, tests, and git status

- [x] **Step 1: Run `git diff --check`, inspect the exact production diff, and verify no navigation changes.**

- [x] **Step 2: Recompute `PRODUCTION_SHA_AFTER`, verify no commit/push occurred, and report only the requested final gate fields.**
