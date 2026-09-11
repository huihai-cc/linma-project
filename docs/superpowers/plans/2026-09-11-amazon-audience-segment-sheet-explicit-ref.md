# Amazon Audience Segment Sheet Explicit Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve explicitly quoted Amazon PVA audience references such as `「セグメントシート1」で指定` to exactly one workbook Segment Sheet without changing existing audience comparison behavior.

**Architecture:** Keep the change inside `_findSegmentForLI()`. Before the existing keyword and fallback resolution, extract only the confirmed explicit wrapper/指示詞 form, normalize the extracted candidate and workbook sheet names with `_normalizeSheetName()`, and accept only one exact normalized match; zero matches fall through to the existing resolver and multiple matches return the existing unresolved/ambiguous marker.

**Tech Stack:** Plain HTML/JavaScript, Node.js built-in `node:test`, VM-based tests that load the inline application script.

**Spec:** `C:\Users\BPO\.codex\attachments\3aaff7f5-2c6d-461d-83c2-ec63c0d1b342\pasted-text.txt`

## Global Constraints

- Modify only the explicit Segment Sheet reference resolver behavior and its focused tests.
- Use exact equality after `_normalizeSheetName()`; do not add substring, prefix, suffix, Levenshtein, number guessing, or LI inference for explicit references.
- Preserve existing CTV, default, direct-sheet, LI/common/parenthesis fallback behavior.
- Do not modify `_readSegmentSheetDynamic()`, `_readSegmentSheetOldFMT()`, `_segmentNamesEquivalent()`, `compareAudience()`, download parsing, area sheets, CP/GP/CR, OTT, GUI styles, navigation, commit, or push.
- Validate focused tests, related Amazon tests, fixture verification, inline JavaScript syntax, and real XLSX availability without fabricating missing real-data evidence.

### Task 1: Add the explicit resolver regression suite

**Files:**
- Modify: `C:\Users\BPO\Desktop\my-qc-web\tests\amazon_dsp_segment_sheet_resolver.test.js`
- Read: `C:\Users\BPO\Desktop\my-qc-web\amazon_dsp_check.html`

**Interfaces:**
- Consumes: `_findSegmentForLI(audienceVal, segMap, liName)` and `_normalizeSheetName()` exported from the inline application script.
- Produces: assertions covering exact quoted references, direct references, whitespace normalization, missing references, prefix collisions, existing fallbacks, ordinary Audience false positives, and normalized-name ambiguity.

- [x] **Step 1: Write the failing test**

  Load the application script in a VM and export `_findSegmentForLI`. Build `segMap` entries with identifiable `groups` data and assert:

  ```js
  const result = api._findSegmentForLI('「セグメントシート1」で指定', {
    'セグメントシート1': { groups: [{ id: 'sheet-1' }], groupOps: [] },
    'セグメントシート2': { groups: [{ id: 'sheet-2' }], groupOps: [] },
  }, 'LI');
  assert.equal(result.__sheetName__, 'セグメントシート1');
  assert.deepEqual(result.groups, [{ id: 'sheet-1' }]);
  ```

  Add separate tests for Sheet2, direct Sheet1, `「 セグメントシート1 」 で指定`, missing Sheet9 unresolved, Sheet1 versus Sheet10 prefix safety, `セグメントシート（CTV）`, default `セグメントシート`, ordinary names `Demo - Female` and `AudienceOne Age 20-34`, and two normalized duplicate sheet keys returning `__ambiguous__` without selecting either data object.

- [x] **Step 2: Run the focused test to verify it fails for the expected reason**

  Run:

  ```powershell
  node --test tests\amazon_dsp_segment_sheet_resolver.test.js
  ```

  Expected: the new quoted-reference assertions fail because the current resolver does not extract `セグメントシート1` from `「セグメントシート1」で指定`; existing tests may remain green.

### Task 2: Implement the minimal exact explicit resolver

**Files:**
- Modify: `C:\Users\BPO\Desktop\my-qc-web\amazon_dsp_check.html:2187-2311`
- Test: `C:\Users\BPO\Desktop\my-qc-web\tests\amazon_dsp_segment_sheet_resolver.test.js`

**Interfaces:**
- Consumes: raw `audienceVal`, `segMap`, `liName`, and existing `_normalizeSheetName()`.
- Produces: the matched existing segment data object with `__sheetName__` set to the workbook key, or an unresolved/ambiguous marker that the current Audience check understands.

- [x] **Step 1: Add the smallest resolver branch before existing fallback logic**

  Recognize only an outer pair among `「...」`, `『...』`, `"..."`, or `“...”`, optionally followed by whitespace and the exact suffix `で指定`. Trim and normalize the candidate. Compare it to every `segMap` key using:

  ```js
  _normalizeSheetName(sheetName) === _normalizeSheetName(explicitCandidate)
  ```

  For exactly one match, set `data.__sheetName__ = sheetName` and return `data`. For more than one match, return `{ groups: [], groupOps: [], __directRef__: true, __ambiguous__: true }`. For zero matches, continue into the existing resolver unchanged. Keep direct sheet-name handling and all existing fallback branches intact.

- [x] **Step 2: Run focused tests to verify green**

  Run:

  ```powershell
  node --test tests\amazon_dsp_segment_sheet_resolver.test.js
  node --test tests\amazon_dsp_segment_sheet.test.js tests\amazon_dsp_audience_bidirectional.test.js
  ```

  Expected: all new resolver tests and existing segment/audience tests pass with no production behavior outside the explicit reference branch changed.

### Task 3: Run the final validation gate

**Files:**
- Verify: `C:\Users\BPO\Desktop\my-qc-web\amazon_dsp_check.html`
- Verify: `C:\Users\BPO\Desktop\my-qc-web\tests\amazon_dsp_segment_sheet_resolver.test.js`
- Verify: `C:\Users\BPO\Desktop\my-qc-web\tests\amazon_dsp_*.test.js`
- Verify: `C:\Users\BPO\Desktop\my-qc-web\tests\amazon_dsp_real_file.verify.js`

- [x] **Step 1: Run all Amazon DSP test files**

  Run:

  ```powershell
  node --test (Get-ChildItem tests -Filter 'amazon_dsp_*.test.js' | ForEach-Object FullName)
  ```

- [x] **Step 2: Run fixture verification and syntax checks**

  Run:

  ```powershell
  node tests\amazon_dsp_real_file.verify.js
  node --check tests\amazon_dsp_segment_sheet_resolver.test.js
  node --check amazon_dsp_check.html
  ```

  Record that the bundled extracted fixture is available if it passes, and separately record `REAL_XLSX_NOT_AVAILABLE` if the named Recruit XLSX is absent. Do not call fixture verification a named-real-XLSX validation.

- [x] **Step 3: Confirm scope and final evidence**

  Recalculate SHA256, inspect `git diff -- amazon_dsp_check.html tests/amazon_dsp_segment_sheet_resolver.test.js`, and confirm no navigation, audience comparison, area logic, or other Amazon fields changed. Do not run `git commit` or `git push`.
