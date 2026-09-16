// excel_compare.html Sheet构成检查 + 附加对比选项专项测试
// 本文件先于生产实现添加，用于固定本轮 Red -> Green 验收行为。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const htmlPath = path.join(__dirname, '..', 'excel_compare.html');
const htmlSource = fs.readFileSync(htmlPath, 'utf8');
const mainSource = [...htmlSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .find(script => script.includes('function xlcompGetActualRange'));
assert.ok(mainSource, 'excel_compare 主脚本应存在');

function makeElement(id = '') {
  return {
    id,
    checked: false,
    disabled: false,
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    className: '',
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
    },
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
    cloneNode() { return makeElement(id); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    closest() { return null; },
    scrollIntoView() {},
  };
}

function makeHarness() {
  const elements = new Map();
  const sheetCheckboxes = [];
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const document = {
    currentScript: null,
    addEventListener() {},
    getElementById,
    querySelectorAll(selector) {
      if (selector === '.xlcomp-sheet-cb') return sheetCheckboxes;
      if (selector === '.xlcomp-sheet-cb:checked') return sheetCheckboxes.filter(cb => cb.checked);
      return [];
    },
    createElement(tag) {
      const element = makeElement();
      if (tag === 'a') element.click = () => {};
      return element;
    },
    head: {
      appendChild(element) {
        if (typeof element?.onload === 'function') element.onload();
      },
    },
    body: { innerHTML: '', appendChild() {} },
  };

  const sandbox = {
    alert() {},
    confirm() { return true; },
    Blob,
    Buffer,
    Date,
    Map,
    Promise,
    Set,
    TextDecoder,
    Uint8Array,
    URL,
    XLSX,
    JSZip,
    navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
    console: { log() {}, warn() {}, error() {}, table() {} },
    document,
    location: { href: 'file:///excel_compare.html' },
    sendLog: async () => {},
    setTimeout(fn) { fn(); return 0; },
    clearTimeout() {},
  };
  sandbox.window = sandbox;

  const exportBlock = `
    window.__xlcompApi = {
      buildSheetStructureDiff: typeof xlcompBuildSheetStructureDiff === 'function' ? xlcompBuildSheetStructureDiff : undefined,
      hasAnyDiff: typeof xlcompHasAnyDiff === 'function' ? xlcompHasAnyDiff : undefined,
      zipFileHasDiff: typeof xlcompZipFileHasDiff === 'function' ? xlcompZipFileHasDiff : undefined,
      onCompareOptChange: typeof xlcompOnCompareOptChange === 'function' ? xlcompOnCompareOptChange : undefined,
      updateViewBtns: typeof xlcompUpdateViewBtns === 'function' ? xlcompUpdateViewBtns : undefined,
      resetCompareOptions: typeof xlcompResetCompareOptions === 'function' ? xlcompResetCompareOptions : undefined,
      renderXlCompResult: typeof renderXlCompResult === 'function' ? renderXlCompResult : undefined,
      renderFastResult: typeof _fastRenderDiffList === 'function' ? _fastRenderDiffList : undefined,
      renderZipResult: typeof renderZipCompResult === 'function' ? renderZipCompResult : undefined,
      prepareFormulaComparison: typeof prepareFormulaComparison === 'function' ? prepareFormulaComparison : undefined,
      renderFormulaView: typeof renderFormulaView === 'function' ? renderFormulaView : undefined,
      prepareTextboxComparison: typeof prepareTextboxComparison === 'function' ? prepareTextboxComparison : undefined,
      renderTextboxView: typeof renderTextboxView === 'function' ? renderTextboxView : undefined,
      get cmpBg() { return xlcompCmpBg; },
      get cmpFont() { return xlcompCmpFont; },
      get cmpNumFmt() { return xlcompCmpNumFmt; },
      get cmpFormula() { return xlcompCmpFormula; },
      get cmpTextbox() { return xlcompCmpTextbox; },
      get formulaResults() { return xlcompFormulaResults; },
      get textboxResults() { return xlcompTextboxResults; },
      setWb(a, b) { xlcompWbA = a; xlcompWbB = b; },
      setExtMaps(a, b) { xlcompExtMapA = a; xlcompExtMapB = b; },
      setFiles(a, b) { xlcompFileA = a; xlcompFileB = b; },
      setSelected(names) { window._xlcompSelectedSheets = names; },
      setStandardState(results, structure) {
        xlcompResults = results;
        xlcompSheetStructureDiff = structure;
      },
      setFastState(diffs, stats, structure) {
        xlcompFastDiffs = diffs;
        xlcompFastStats = stats;
        xlcompSheetStructureDiff = structure;
        xlcompFastPhase = 'done';
      },
      setZipState(structure) { xlcompSheetStructureDiff = structure; },
      setOptionIds(ids) {
        for (const [id, checked] of Object.entries(ids)) document.getElementById(id).checked = checked;
      },
      getElement(id) { return document.getElementById(id); },
      addSheetCheckbox(name, checked = true) {
        const cb = makeElement();
        cb.dataset = { sheet: name };
        cb.checked = checked;
        sheetCheckboxes.push(cb);
      },
      getFormulaCounter() { return window.__formulaCounter || 0; },
      getTextboxCounter() { return window.__textboxCounter || 0; },
    };

    window.__formulaCounter = 0;
    window.__textboxCounter = 0;
    if (typeof compareSheetFormula === 'function') {
      const originalCompareSheetFormula = compareSheetFormula;
      compareSheetFormula = function(...args) {
        window.__formulaCounter++;
        return originalCompareSheetFormula(...args);
      };
    }
    if (typeof getTextboxesFromZip === 'function') {
      const originalGetTextboxesFromZip = getTextboxesFromZip;
      getTextboxesFromZip = async function(...args) {
        window.__textboxCounter++;
        return originalGetTextboxesFromZip(...args);
      };
    }
  `;

  vm.runInNewContext(mainSource + exportBlock, sandbox, { filename: htmlPath });
  return { api: sandbox.__xlcompApi, sandbox, elements, sheetCheckboxes };
}

function makeSheet(cells = {}) {
  const ws = {};
  let maxR = 0;
  let maxC = 0;
  for (const [addr, value] of Object.entries(cells)) {
    ws[addr] = value;
    const cell = XLSX.utils.decode_cell(addr);
    maxR = Math.max(maxR, cell.r);
    maxC = Math.max(maxC, cell.c);
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return ws;
}

function makeWb(sheetNames, cellsBySheet = {}) {
  const Sheets = {};
  for (const name of sheetNames) Sheets[name] = cellsBySheet[name] || makeSheet({ A1: { t: 's', v: 'same' } });
  return { SheetNames: sheetNames, Sheets };
}

function makeFormulaWb(formula) {
  return makeWb(['Sheet1'], {
    Sheet1: makeSheet({ A1: { t: 'n', v: 0, f: formula } }),
  });
}

function makeXlsxBuffer() {
  return Buffer.from(XLSX.write(makeWb(['Sheet1']), { type: 'buffer', bookType: 'xlsx' }));
}

test('S1: 相同Sheet集合的构成差异为0', () => {
  const { api } = makeHarness();
  assert.equal(typeof api.buildSheetStructureDiff, 'function');
  assert.deepEqual([...api.buildSheetStructureDiff(['Sheet1', 'Sheet2'], ['Sheet1', 'Sheet2']).onlyA], []);
  assert.deepEqual([...api.buildSheetStructureDiff(['Sheet1', 'Sheet2'], ['Sheet1', 'Sheet2']).onlyB], []);
  assert.equal(api.buildSheetStructureDiff(['Sheet1', 'Sheet2'], ['Sheet1', 'Sheet2']).count, 0);
});

test('S2: A有B无的Sheet显示为新表中未找到', () => {
  const { api } = makeHarness();
  const diff = api.buildSheetStructureDiff(['Sheet1', 'Sheet2', 'OldOnly'], ['Sheet1', 'Sheet2']);
  assert.deepEqual([...diff.onlyA], ['OldOnly']);
  assert.deepEqual([...diff.onlyB], []);
  assert.equal(diff.count, 1);
  assert.equal(diff.onlyA[0], 'OldOnly');
});

test('S3: A无B有的Sheet显示为新表新增', () => {
  const { api } = makeHarness();
  const diff = api.buildSheetStructureDiff(['Sheet1', 'Sheet2'], ['Sheet1', 'Sheet2', 'NewOnly']);
  assert.deepEqual([...diff.onlyA], []);
  assert.deepEqual([...diff.onlyB], ['NewOnly']);
  assert.equal(diff.count, 1);
});

test('S4: 双方各自独有的Sheet合计为2件', () => {
  const { api } = makeHarness();
  const diff = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1', 'NewOnly']);
  assert.deepEqual([...diff.onlyA], ['OldOnly']);
  assert.deepEqual([...diff.onlyB], ['NewOnly']);
  assert.equal(diff.count, 2);
});

test('S5: Sheet数量相同但名称不同仍能检测构成异常', () => {
  const { api } = makeHarness();
  const diff = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1', 'NewOnly']);
  assert.equal(diff.count, 2);
  assert.ok(diff.onlyA.includes('OldOnly'));
  assert.ok(diff.onlyB.includes('NewOnly'));
});

test('S6: Sheet构成检查独立于用户选中的Sheet', () => {
  const { api } = makeHarness();
  api.setSelected(['Sheet1']);
  const diff = api.buildSheetStructureDiff(['Sheet1', 'UnselectedOld'], ['Sheet1', 'UnselectedNew']);
  assert.deepEqual([...diff.onlyA], ['UnselectedOld']);
  assert.deepEqual([...diff.onlyB], ['UnselectedNew']);
});

test('S7: 单元格差异为0但Sheet构成异常时Overall仍为有差异', () => {
  const { api } = makeHarness();
  const structure = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1']);
  assert.equal(api.hasAnyDiff({ cellDiffCount: 0, sheetStructureDiff: structure }), true);
});

test('S8: 高速模式无cell diff但Sheet构成异常时不得判定无差异', () => {
  const { api } = makeHarness();
  const structure = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1']);
  assert.equal(api.hasAnyDiff({ fastDiffs: [], sheetStructureDiff: structure }), true);
});

test('S9: ZIP内单元格差异为0但Sheet构成异常时文件为有差异', () => {
  const { api } = makeHarness();
  const structure = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1']);
  assert.equal(api.zipFileHasDiff({ status: 'both', totalDiff: 0, sheetStructureDiff: structure }), true);
});

test('S10: 标准结果区域明确显示Sheet构成异常与两种语义标签', () => {
  const { api } = makeHarness();
  const structure = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1', 'NewOnly']);
  api.setStandardState({
    Sheet1: { status: 'both', rows: [], diffCount: 0, addCount: 0, delCount: 0, numFmtDiffCount: 0, totalA: 0, totalB: 0 },
  }, structure);
  api.renderXlCompResult();
  const html = api.getElement('xlcomp-result').innerHTML;
  assert.match(html, /Sheet构成异常/);
  assert.match(html, /新表中未找到/);
  assert.match(html, /新表新增/);
  assert.match(html, /差异行：0/);
});

test('U1-U3: 顶部显示基本对比、五项附加对比与自动Sheet构成检查', () => {
  assert.match(htmlSource, /基本对比/);
  assert.match(htmlSource, /附加对比/);
  for (const id of ['xlcomp-bgcolor', 'xlcomp-fontcolor', 'xlcomp-numfmt', 'xlcomp-formula', 'xlcomp-textbox']) {
    assert.match(htmlSource, new RegExp(`id=["']${id}["']`));
  }
  assert.match(htmlSource, /单元格内容/);
  assert.match(htmlSource, /Sheet构成：自动检查/);
  assert.doesNotMatch(htmlSource, /id=["']xlcomp-sheet-structure["']/);
});

test('U4-U5: 公式与文本框checkbox同步到独立状态变量', () => {
  const { api } = makeHarness();
  api.setOptionIds({ 'xlcomp-formula': true, 'xlcomp-textbox': true });
  api.onCompareOptChange();
  assert.equal(api.cmpFormula, true);
  assert.equal(api.cmpTextbox, true);
});

test('U6-U9: 五个附加View按钮按对应checkbox启用状态同步', () => {
  const { api } = makeHarness();
  api.setOptionIds({
    'xlcomp-bgcolor': false,
    'xlcomp-fontcolor': false,
    'xlcomp-numfmt': false,
    'xlcomp-formula': false,
    'xlcomp-textbox': false,
  });
  api.onCompareOptChange();
  for (const id of ['xlcomp-view-bgcolor', 'xlcomp-view-fontcolor', 'xlcomp-view-numfmt', 'xlcomp-view-formula', 'xlcomp-view-textbox']) {
    assert.equal(api.getElement(id).style.pointerEvents, 'none', `${id} 未勾选时应禁用`);
  }

  api.setOptionIds({
    'xlcomp-bgcolor': true,
    'xlcomp-fontcolor': true,
    'xlcomp-numfmt': true,
    'xlcomp-formula': true,
    'xlcomp-textbox': true,
  });
  api.onCompareOptChange();
  for (const id of ['xlcomp-view-bgcolor', 'xlcomp-view-fontcolor', 'xlcomp-view-numfmt', 'xlcomp-view-formula', 'xlcomp-view-textbox']) {
    assert.equal(api.getElement(id).style.pointerEvents, 'auto', `${id} 勾选时应启用`);
  }
});

test('U10: resetCompareOptions使五个附加checkbox和状态全部恢复false', () => {
  const { api } = makeHarness();
  api.setOptionIds({
    'xlcomp-bgcolor': true,
    'xlcomp-fontcolor': true,
    'xlcomp-numfmt': true,
    'xlcomp-formula': true,
    'xlcomp-textbox': true,
  });
  api.onCompareOptChange();
  api.resetCompareOptions();
  for (const id of ['xlcomp-bgcolor', 'xlcomp-fontcolor', 'xlcomp-numfmt', 'xlcomp-formula', 'xlcomp-textbox']) {
    assert.equal(api.getElement(id).checked, false, `${id} 应取消勾选`);
  }
  assert.equal(api.cmpBg, false);
  assert.equal(api.cmpFont, false);
  assert.equal(api.cmpNumFmt, false);
  assert.equal(api.cmpFormula, false);
  assert.equal(api.cmpTextbox, false);
});

test('F1-F3: 公式未勾选不解析，勾选后只比较一次并缓存，切View不重复扫描', async () => {
  const { api } = makeHarness();
  api.setWb(makeFormulaWb('SUM(A1:A2)'), makeFormulaWb('SUM(A1:A3)'));
  api.setSelected(['Sheet1']);
  api.setOptionIds({ 'xlcomp-formula': false });
  api.onCompareOptChange();
  const skipped = await api.prepareFormulaComparison();
  assert.equal(skipped, null);
  assert.equal(api.getFormulaCounter(), 0);

  api.setOptionIds({ 'xlcomp-formula': true });
  api.onCompareOptChange();
  const sandbox = makeHarness();
  sandbox.api.setWb(makeFormulaWb('SUM(A1:A2)'), makeFormulaWb('SUM(A1:A3)'));
  sandbox.api.setSelected(['Sheet1']);
  sandbox.api.setStandardState({ Sheet1: { rows: [] } }, { onlyA: [], onlyB: [], count: 0 });
  sandbox.api.setOptionIds({ 'xlcomp-formula': true });
  sandbox.api.onCompareOptChange();
  sandbox.api.setExtMaps([], []);
  const first = await sandbox.api.prepareFormulaComparison();
  const second = await sandbox.api.prepareFormulaComparison();
  assert.equal(sandbox.api.getFormulaCounter(), 1);
  assert.strictEqual(first, second);
  sandbox.api.setStandardState({ Sheet1: { rows: [] } }, { onlyA: [], onlyB: [], count: 0 });
  await sandbox.api.renderFormulaView();
  await sandbox.api.renderFormulaView();
  assert.equal(sandbox.api.getFormulaCounter(), 1);
});

test('T1-T3: 文本框未勾选不扫描，勾选后只扫描一次并缓存', async () => {
  const { api } = makeHarness();
  const wb = makeWb(['Sheet1']);
  const buf = makeXlsxBuffer();
  api.setWb(wb, wb);
  api.setFiles(buf, buf);
  api.setSelected(['Sheet1']);
  api.setStandardState({ Sheet1: { rows: [] } }, { onlyA: [], onlyB: [], count: 0 });
  api.setOptionIds({ 'xlcomp-textbox': false });
  api.onCompareOptChange();
  const skipped = await api.prepareTextboxComparison();
  assert.equal(skipped, null);
  assert.equal(api.getTextboxCounter(), 0);

  api.setOptionIds({ 'xlcomp-textbox': true });
  api.onCompareOptChange();
  const first = await api.prepareTextboxComparison();
  const second = await api.prepareTextboxComparison();
  assert.equal(api.getTextboxCounter(), 2, '双方都存在的Sheet应各扫描一次');
  assert.strictEqual(first, second);
});

test('M1: 高速模式结果渲染Sheet构成异常，即使fastDiffs为空也不显示无差异', () => {
  const { api } = makeHarness();
  const structure = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1']);
  api.setFastState([], { OldOnly: { status: 'only_a', diffCount: 0, addCount: 0, delCount: 0 } }, structure);
  api.renderFastResult();
  const html = api.getElement('xlcomp-result').innerHTML;
  assert.match(html, /Sheet构成异常/);
  assert.doesNotMatch(html, /选択したSheetに差異はありません/);
});

test('M2: ZIP结果渲染Sheet构成异常时文件状态不是完全一致', () => {
  const { api } = makeHarness();
  const structure = api.buildSheetStructureDiff(['Sheet1', 'OldOnly'], ['Sheet1']);
  api.setZipState(structure);
  api.renderZipResult({
    onlyA: [],
    onlyB: [],
    files: {
      'book.xlsx': {
        status: 'both',
        sheets: {
          Sheet1: { status: 'both', rows: [], diffCount: 0, addCount: 0, delCount: 0, totalA: 0, totalB: 0 },
          OldOnly: { status: 'only_a', rows: [], diffCount: 0, addCount: 0, delCount: 0 },
        },
        sheetNames: ['Sheet1', 'OldOnly'],
        totalDiff: 0,
        sheetStructureDiff: structure,
      },
    },
  });
  const html = api.getElement('xlcomp-result').innerHTML;
  assert.match(html, /有差异/);
  assert.doesNotMatch(html, /完全一致/);
});

test('I18N: 新增概念同时存在zh-CN与ja-JP', () => {
  const i18n = fs.readFileSync(path.join(__dirname, '..', 'qc-i18n.js'), 'utf8');
  for (const key of [
    'compareBasicGroup',
    'compareExtraGroup',
    'compareCellContentOpt',
    'compareFormulaOpt',
    'compareTextboxOpt',
    'compareSheetStructureAuto',
    'compareSheetStructureDiff',
    'compareSheetOnlyAMissing',
    'compareSheetOnlyBAdded',
    'compareUnsupportedFast',
  ]) {
    assert.ok((i18n.match(new RegExp(`^\\s*${key}:`, 'gm')) || []).length >= 2, `${key} 应同时有中日文`);
  }
});
