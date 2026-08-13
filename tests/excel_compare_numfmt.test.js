// excel_compare.html 数字格式／单位对比 专项测试（2026-08-06）
// 覆盖:
//   1. 相同数值、相同单位 → 无差异
//   2. 相同数值、円 vs imp → 单位格式差异
//   3. 相同数值、整数 vs 百分比 → 数字格式差异
//   4. 相同数值、0% vs 0.00% → 格式差异
//   5. 相同数值、General vs 普通整数显示 → 等价（无差异）
//   6. 数值不同且格式不同 → 同时显示内容差异＋数字格式差异
//   7. 文本单元格不受影响
//   8. 空白单元格及残留样式不误报
//   9. 未勾选数字格式选项时保持现有行为
//  10. 引号/未引号单位等价（'#,##0"円"' vs '#,##0円'）
//  11. 千分位差异（'0.00' vs '#,##0.00'）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const htmlPath = path.join(__dirname, '..', 'excel_compare.html');

function loadXlcompApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts
    .map(match => match[1])
    .find(script => script.includes('function xlcompGetActualRange'));
  assert.ok(source, 'excel_compare 主脚本应存在');

  const exportBlock = '\n' +
    'window.__xlcompApi = {\n' +
    '  xlcompNormalizeNumFmt: typeof xlcompNormalizeNumFmt === "function" ? xlcompNormalizeNumFmt : undefined,\n' +
    '  compareSheet: typeof compareSheet === "function" ? compareSheet : undefined,\n' +
    '  setWb: function(a, b) { xlcompWbA = a; xlcompWbB = b; },\n' +
    '  setNumFmtOpt: function(v) { xlcompCmpNumFmt = !!v; },\n' +
    '};\n';
  const instrumented = source + exportBlock;

  const document = {
    currentScript: null,
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} } }; },
    head: { appendChild() {} },
    body: { innerHTML: '' },
  };
  const sandbox = {
    alert() {}, Blob, Date, Map, Promise, Set, TextDecoder, Uint8Array, URL,
    XLSX, console: { log() {}, warn() {}, error() {}, table() {} },
    document, location: { href: 'file:///excel_compare.html' },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__xlcompApi;
}

const api = loadXlcompApi();
assert.ok(typeof api.compareSheet === 'function', 'compareSheet 应可导出');

// ===== 测试数据构造 =====
// cells: { addr: {t:'n', v:..., z:格式代码} 或 原始值 }
function makeSheet(cells) {
  const ws = {};
  let maxR = -1, maxC = -1;
  Object.entries(cells).forEach(([addr, v]) => {
    const def = (v && typeof v === 'object' && !Array.isArray(v))
      ? v
      : { t: typeof v === 'number' ? 'n' : 's', v };
    ws[addr] = def;
    const rc = XLSX.utils.decode_cell(addr);
    maxR = Math.max(maxR, rc.r);
    maxC = Math.max(maxC, rc.c);
  });
  if (maxR >= 0) {
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  }
  return ws;
}

function makeWb(sheetName, ws) {
  return { SheetNames: [sheetName], Sheets: { [sheetName]: ws } };
}

function runCompare(wsA, wsB, sheetName = 'Sheet1', numFmt = true) {
  api.setWb(makeWb(sheetName, wsA), makeWb(sheetName, wsB));
  api.setNumFmtOpt(numFmt);
  return api.compareSheet(sheetName);
}

// 数字单元格快捷构造
const num = (v, z) => ({ t: 'n', v, z });

// ===== 测试用例 =====
test('F1: 相同数值、相同单位 → 无差异', function() {
  const wsA = makeSheet({ A1: num(150456, '#,##0"円"'), A2: num(12.5, '0.00') });
  const wsB = makeSheet({ A1: num(150456, '#,##0"円"'), A2: num(12.5, '0.00') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.diffCount, 0);
  assert.equal(res.numFmtDiffCount, 0);
  assert.equal(res.rows[0].status, 'eq');
});

test('F2: 相同数值、円 vs imp → 单位格式差异', function() {
  const wsA = makeSheet({ A1: num(150456, '#,##0"円"') });
  const wsB = makeSheet({ A1: num(150456, '#,##0"imp"') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.diffCount, 0, '内容不应有差异');
  assert.equal(res.numFmtDiffCount, 1, '应检出1处单位格式差异');
  assert.equal(res.rows[0].status, 'fmt', '行状态应为 fmt（仅格式差异）');
  const cell = res.rows[0].cells[0];
  assert.equal(cell.fmtDiff, true);
  assert.equal(cell.fmtA, '#,##0"円"');
  assert.equal(cell.fmtB, '#,##0"imp"');
});

test('F3: 相同数值、整数 vs 百分比 → 数字格式差异', function() {
  const wsA = makeSheet({ A1: num(25, '0') });
  const wsB = makeSheet({ A1: num(25, '0%') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.diffCount, 0);
  assert.equal(res.numFmtDiffCount, 1);
  assert.equal(res.rows[0].status, 'fmt');
});

test('F4: 相同数值、0% vs 0.00% → 格式差异（小数位数）', function() {
  const wsA = makeSheet({ A1: num(0.125, '0%') });
  const wsB = makeSheet({ A1: num(0.125, '0.00%') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.diffCount, 0);
  assert.equal(res.numFmtDiffCount, 1, '小数位数不同应检出');
  assert.equal(res.rows[0].status, 'fmt');
});

test('F5: 相同数值、General vs 普通整数显示(0) → 按设计等价，无差异', function() {
  const wsA = makeSheet({ A1: num(12345, null) });          // General
  const wsB = makeSheet({ A1: num(12345, '0') });           // 普通整数
  const res = runCompare(wsA, wsB);
  assert.equal(res.numFmtDiffCount, 0, 'General 与 0 显示等价，不应误报');
  assert.equal(res.diffCount, 0);
  assert.equal(res.rows[0].status, 'eq');
});

test('F6: 数值不同且格式不同 → 同时显示内容差异＋数字格式差异', function() {
  const wsA = makeSheet({ A1: num(100, '0') });
  const wsB = makeSheet({ A1: num(200, '0%') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.diffCount, 1, '内容不同应计1行修改');
  assert.equal(res.numFmtDiffCount, 1, '格式不同同时计数');
  assert.equal(res.rows[0].status, 'mod');
  const cell = res.rows[0].cells[0];
  assert.equal(cell.status, 'mod');
  assert.equal(cell.fmtDiff, true);
  assert.ok(cell.combinedStatus.includes('内容差异'));
  assert.ok(cell.combinedStatus.includes('数字格式差异'));
});

test('F7: 文本单元格不受影响（不同数字格式不报差异）', function() {
  const wsA = makeSheet({ A1: { t: 's', v: 'ABC', z: '0"円"' } });
  const wsB = makeSheet({ A1: { t: 's', v: 'ABC', z: '0"imp"' } });
  const res = runCompare(wsA, wsB);
  assert.equal(res.diffCount, 0);
  assert.equal(res.numFmtDiffCount, 0, '文本单元格不应比较数字格式');
  assert.equal(res.rows[0].status, 'eq');
});

test('F8: 空白单元格及残留样式不误报', function() {
  // A: 残留样式行（无值）；B: 无此行；真实数据行一致
  const wsA = makeSheet({
    A1: num(100, '#,##0"円"'),
    A2: { s: 0 },                                  // 残留样式（无值无格式）
    A3: { t: 's', f: 'IF(FALSE,"x","")', v: '', z: '0%' }, // 空公式结果
  });
  const wsB = makeSheet({ A1: num(100, '#,##0"円"') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.numFmtDiffCount, 0, '空白/残留样式行不应产生格式差异');
  assert.equal(res.delCount, 0, '不应误判删除');
  assert.equal(res.diffCount, 0);
  assert.equal(res.rows[0].status, 'eq');
  assert.equal(res.rows[1].status, 'eq');
});

test('F9: 未勾选数字格式选项 → 保持现有行为（格式不同也不报）', function() {
  const wsA = makeSheet({ A1: num(150456, '#,##0"円"') });
  const wsB = makeSheet({ A1: num(150456, '#,##0"imp"') });
  const res = runCompare(wsA, wsB, 'Sheet1', false);
  assert.equal(res.numFmtDiffCount, 0, '未勾选时不比较格式');
  assert.equal(res.diffCount, 0, '内容相同无差异');
  assert.equal(res.rows[0].status, 'eq');
  assert.equal(res.rows[0].cells[0].fmtDiff, false);
});

test('F10: 引号/未引号单位等价（"円" 与 円）→ 无差异', function() {
  const wsA = makeSheet({ A1: num(150456, '#,##0"円"') });
  const wsB = makeSheet({ A1: num(150456, '#,##0円') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.numFmtDiffCount, 0, '引号写法差异不应误报');
  assert.equal(res.diffCount, 0);
});

test('F11: 千分位差异（0.00 vs #,##0.00）→ 格式差异', function() {
  const wsA = makeSheet({ A1: num(12345.67, '0.00') });
  const wsB = makeSheet({ A1: num(12345.67, '#,##0.00') });
  const res = runCompare(wsA, wsB);
  assert.equal(res.numFmtDiffCount, 1, '千分位不同应检出');
  assert.equal(res.rows[0].status, 'fmt');
});

test('F12: 归一化函数行为校验（直接调用）', function() {
  const n = api.xlcompNormalizeNumFmt;
  assert.equal(n(null), 'GENERAL');
  assert.equal(n(undefined), 'GENERAL');
  assert.equal(n(''), 'GENERAL');
  assert.equal(n('General'), 'GENERAL');
  assert.equal(n('@'), 'GENERAL');
  assert.equal(n('0'), 'GENERAL');                       // 普通整数 ≡ General
  assert.equal(n('#,##0'), 'TD0');                       // 千分位
  assert.equal(n('0.00'), 'D2');                         // 两位小数
  assert.equal(n('0%'), 'PCTD0');                        // 百分比
  assert.equal(n('0.00%'), 'PCTD2');                     // 百分比两位小数
  assert.equal(n('#,##0"円"'), 'TD0[円]');
  assert.equal(n('#,##0"imp"'), 'TD0[imp]');
  assert.notEqual(n('#,##0"円"'), n('#,##0"imp"'));      // 单位必须区分
  assert.notEqual(n('0"click"'), n('0"CV"'));            // click vs CV 必须区分
  assert.notEqual(n('0"円"'), n('0"imp"'));
  assert.equal(n('#,##0円'), n('#,##0"円"'));            // 引号写法等价
  assert.equal(n('yyyy/mm/dd'), 'DT:yyyy/mm/dd');        // 日期格式
});
