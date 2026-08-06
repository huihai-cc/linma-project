// excel_compare.html 标准模式「绝对行号对齐」专项测试（2026-08-06）
// 覆盖:
//   1. A/B 起始有效行不同，但绝对行数据一致 → 不应有差异/删除
//   2. A/B 末尾仅有残留样式（style-only / 空公式结果）→ 不统计为删除
//   3. A 真实多一行业务数据 → 删除1行
//   4. B 真实多一行业务数据 → 新增1行
//   5. 中间真实删除一行 → 尾部删除1行 + 后续行按绝对行号显示 mod
//   6. 起始+末尾残留样式组合 → 仍无差异
// 附带断言: rowNo 必须是真实 Excel 行号，colHeaders 必须是绝对列字母
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
    '  xlcompGetActualRange: typeof xlcompGetActualRange === "function" ? xlcompGetActualRange : undefined,\n' +
    '  sheetTo2D: typeof sheetTo2D === "function" ? sheetTo2D : undefined,\n' +
    '  compareSheet: typeof compareSheet === "function" ? compareSheet : undefined,\n' +
    '  setWb: function(a, b) { xlcompWbA = a; xlcompWbB = b; },\n' +
    '  setColorOpts: function(bg, font) { xlcompCmpBg = bg; xlcompCmpFont = font; },\n' +
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
// cells: { addr: value } — value 为原始值，或 { t, v, s, f } 形式（如残留样式 {s:0}）
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

function runCompare(wsA, wsB, sheetName = 'Sheet1') {
  api.setWb(makeWb(sheetName, wsA), makeWb(sheetName, wsB));
  api.setColorOpts(false, false);
  return api.compareSheet(sheetName);
}

// ===== 测试用例 =====
test('T1: A/B 起始有效行不同（A有残留样式B1），绝对行数据一致 → 无差异', function() {
  // A: B1 为残留样式（无内容），业务数据 B2:D6；B: 无 B1，业务数据 B2:D6（完全一致）
  const data = {
    B2: 'R1', C2: 'C1', D2: 'D1',
    B3: 'R2', C3: 'C2', D3: 'D2',
    B4: 'R3', C4: 'C3', D4: 'D3',
    B5: 'R4', C5: 'C4', D5: 'D4',
    B6: 'R5', C6: 'C5', D6: 'D5',
  };
  const wsA = makeSheet({ B1: { s: 0 }, ...data });
  const wsB = makeSheet({ ...data });
  const res = runCompare(wsA, wsB);

  assert.equal(res.diffCount, 0, '不应有内容差异');
  assert.equal(res.addCount, 0, '不应有新增');
  assert.equal(res.delCount, 0, '起始行不同不应导致尾部误判删除');
  assert.equal(res.totalA, 5, 'A 有效内容行数应为5');
  assert.equal(res.totalB, 5, 'B 有效内容行数应为5');

  // 统一范围 = B1:D6（6行），rowNo 必须是真实 Excel 行号
  assert.equal(res.rows.length, 6, '统一范围应为6行');
  assert.equal(res.rows[0].rowNo, 1, '第一行是残留样式行（Excel行1）');
  assert.equal(res.rows[0].status, 'eq', '残留样式行不统计为增删');
  assert.equal(res.rows[1].rowNo, 2, '业务数据首行必须是真实Excel行号2');
  assert.equal(res.rows[1].status, 'eq');

  // 列号必须是绝对列字母（A的残留样式在B列 → 统一起点列=B）
  // 注: vm 沙箱中的数组是跨 realm 的，需先展开为宿主数组再比较
  assert.deepEqual([...res.colHeaders], ['B', 'C', 'D'], '列头应为绝对列字母');
});

test('T2: A/B 末尾仅有残留样式（style-only + 空公式结果）→ 不统计为删除', function() {
  const data = { A1: 'R1', A2: 'R2', A3: 'R3', A4: 'R4', A5: 'R5' };
  // A 末尾追加: 残留样式单元格 + 空公式结果单元格（v为空字符串）
  const wsA = makeSheet({ ...data, A6: { s: 0 }, A7: { t: 's', f: 'IF(FALSE,"x","")', v: '' } });
  const wsB = makeSheet({ ...data });
  const res = runCompare(wsA, wsB);

  assert.equal(res.diffCount, 0);
  assert.equal(res.addCount, 0);
  assert.equal(res.delCount, 0, '末尾残留样式不应误判为删除');
  assert.equal(res.totalA, 5, '残留样式行不计入有效行数');
  assert.equal(res.totalB, 5);
  assert.equal(res.rows.length, 7, '统一范围应覆盖A的残留行');
  assert.equal(res.rows[5].rowNo, 6, '残留样式行应显示真实Excel行号');
  assert.equal(res.rows[5].status, 'eq');
  assert.equal(res.rows[6].status, 'eq', '空公式结果行不统计为删除');
});

test('T3: A 真实多一行业务数据 → 删除1行（真实删除仍能检出）', function() {
  const data = { A1: 'R1', A2: 'R2', A3: 'R3', A4: 'R4', A5: 'R5' };
  const wsA = makeSheet({ ...data, A6: 'R6' });
  const wsB = makeSheet({ ...data });
  const res = runCompare(wsA, wsB);

  assert.equal(res.diffCount, 0);
  assert.equal(res.addCount, 0);
  assert.equal(res.delCount, 1, 'A多出的真实业务行应判定为删除');
  assert.equal(res.totalA, 6);
  assert.equal(res.totalB, 5);
  const delRow = res.rows.find(row => row.status === 'del');
  assert.ok(delRow, '应存在删除行');
  assert.equal(delRow.rowNo, 6, '删除行必须是真实Excel行号6');
});

test('T4: B 真实多一行业务数据 → 新增1行', function() {
  const data = { A1: 'R1', A2: 'R2', A3: 'R3', A4: 'R4', A5: 'R5' };
  const wsA = makeSheet({ ...data });
  const wsB = makeSheet({ ...data, A6: 'R6' });
  const res = runCompare(wsA, wsB);

  assert.equal(res.diffCount, 0);
  assert.equal(res.delCount, 0);
  assert.equal(res.addCount, 1, 'B多出的真实业务行应判定为新增');
  assert.equal(res.totalA, 5);
  assert.equal(res.totalB, 6);
  const addRow = res.rows.find(row => row.status === 'add');
  assert.ok(addRow, '应存在新增行');
  assert.equal(addRow.rowNo, 6, '新增行必须是真实Excel行号6');
});

test('T5: 中间真实删除一行 → 按绝对行号显示：前4行相同、中间5行mod、尾部删除1行', function() {
  const dataA = {};
  for (let i = 1; i <= 10; i++) dataA['A' + i] = 'R' + i;
  const wsA = makeSheet(dataA);
  // B 删除第5行 → 业务行上移: 1-4行不变，5-9行 = 原6-10行，无第10行
  const dataB = { A1: 'R1', A2: 'R2', A3: 'R3', A4: 'R4' };
  for (let i = 5; i <= 9; i++) dataB['A' + i] = 'R' + (i + 1);
  const wsB = makeSheet(dataB);
  const res = runCompare(wsA, wsB);

  assert.equal(res.addCount, 0);
  assert.equal(res.delCount, 1, '绝对对齐下尾部删除1行');
  assert.equal(res.diffCount, 5, '删除后上移的5行显示为内容差异（不做智能重排）');
  assert.equal(res.totalA, 10);
  assert.equal(res.totalB, 9);

  assert.equal(res.rows[0].rowNo, 1);
  assert.equal(res.rows[0].status, 'eq');
  assert.equal(res.rows[3].rowNo, 4);
  assert.equal(res.rows[3].status, 'eq');
  assert.equal(res.rows[4].rowNo, 5, '删除行的真实行号');
  assert.equal(res.rows[4].status, 'mod');
  assert.equal(res.rows[9].rowNo, 10);
  assert.equal(res.rows[9].status, 'del', '真实删除 = 尾部1行删除');
});

test('T6: 起始+末尾残留样式组合，业务数据一致 → 仍无差异', function() {
  const data = { B2: 'R1', B3: 'R2', B4: 'R3', B5: 'R4' };
  const wsA = makeSheet({ B1: { s: 0 }, ...data, B6: { s: 0 } });
  const wsB = makeSheet({ ...data, A1: { s: 0 }, C6: { t: 's', v: '' } });
  const res = runCompare(wsA, wsB);

  assert.equal(res.diffCount, 0);
  assert.equal(res.addCount, 0);
  assert.equal(res.delCount, 0);
  assert.equal(res.totalA, 4);
  assert.equal(res.totalB, 4);
  // 统一范围: 起点行1/列A，终点行6/列C
  assert.equal(res.rows.length, 6);
  assert.deepEqual([...res.colHeaders], ['A', 'B', 'C']);
});
