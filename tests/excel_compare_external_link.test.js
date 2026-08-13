// excel_compare.html 外部链接公式对比 专项测试（2026-08-13）
// 覆盖:
//   E1. 同一公式多个 [n] 逐个比较（[2]相同 [8]不同 → 外部参照路径差异）
//   E2. 公式本体差异（无外部引用）→ 公式本体差异
//   E3. 公式本体＋外部参照同时不同 → 两者皆异
//   E4. 完整Target比较（basename相同但完整路径不同 → 判差异）
//   E5. 公式与外部参照完全一致 → 无差异
//   E6. 无外部引用公式相同 → 无差异
//   E7. 空引用集 → 无差异
//   E8. 真实文件：ターゲティング I36 必须显示「外部参照路径差异」
//   E9. 真实文件：externalLink6 回归（A 5层../ vs B 4层../）
//   E10. xlcompToggleEq 不覆盖当前公式视图（视图保留）
//   E11. _xlcompExtDesc 输出格式
//   E12. 真实文件 renderFormulaView 全流程渲染：I36 必须显示「外部参照路径差异」+ 独立统计
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const htmlPath = path.join(__dirname, '..', 'excel_compare.html');

function extractMainScript() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts
    .map(match => match[1])
    .find(script => script.includes('function xlcompGetActualRange'));
  assert.ok(source, 'excel_compare 主脚本应存在');
  const exportBlock = '\n' +
    'window.__xlcompApi = {\n' +
    '  compareSheetFormula: typeof compareSheetFormula === "function" ? compareSheetFormula : undefined,\n' +
    '  xlcompExtractExternalLinks: typeof xlcompExtractExternalLinks === "function" ? xlcompExtractExternalLinks : undefined,\n' +
    '  xlcompExtRefsDiff: typeof _xlcompExtRefsDiff === "function" ? _xlcompExtRefsDiff : undefined,\n' +
    '  xlcompFormulaExtRefs: typeof _xlcompFormulaExtRefs === "function" ? _xlcompFormulaExtRefs : undefined,\n' +
    '  xlcompExtTargetAt: typeof _xlcompExtTargetAt === "function" ? _xlcompExtTargetAt : undefined,\n' +
    '  xlcompExtDesc: typeof _xlcompExtDesc === "function" ? _xlcompExtDesc : undefined,\n' +
    '  xlcompParseWorkbookRels: typeof _xlcompExtParseWorkbookRels === "function" ? _xlcompExtParseWorkbookRels : undefined,\n' +
    '  xlcompParseLinkRels: typeof _xlcompExtParseLinkRels === "function" ? _xlcompExtParseLinkRels : undefined,\n' +
    '  setWb: function(a, b) { xlcompWbA = a; xlcompWbB = b; },\n' +
    '  setExtMaps: function(a, b) { xlcompExtMapA = a; xlcompExtMapB = b; },\n' +
    '};\n';
  return source + exportBlock;
}

function makeDocument() {
  return {
    currentScript: null,
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} } }; },
    head: { appendChild() {} },
    body: { innerHTML: '' },
  };
}

function loadXlcompApi(document = makeDocument(), extra = {}) {
  const instrumented = extractMainScript();
  const sandbox = {
    alert() {}, Blob, Date, Map, Promise, Set, TextDecoder, Uint8Array, URL,
    XLSX, JSZip, console: { log() {}, warn() {}, error() {}, table() {} },
    document, location: { href: 'file:///excel_compare.html' },
    ...extra,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox;
}

// 查找真实对比文件，返回 [bufA, bufB, wbA, wbB]
function loadRealFiles() {
  const baseDir = 'D:\\業務用\\開発用\\テスト用アイル\\Excel比較\\260813';
  if (!fs.existsSync(baseDir)) return null;
  const names = fs.readdirSync(baseDir);
  const fa = names.find(n => n.startsWith('大正製薬_YDAGS') && n.endsWith('.xlsx'));
  const fb = names.find(n => n.startsWith('宇航') && n.endsWith('.xlsx'));
  if (!fa || !fb) return null;
  const bufA = fs.readFileSync(path.join(baseDir, fa));
  const bufB = fs.readFileSync(path.join(baseDir, fb));
  const wbA = XLSX.read(bufA, { type: 'buffer', cellFormula: true, cellNF: true });
  const wbB = XLSX.read(bufB, { type: 'buffer', cellFormula: true, cellNF: true });
  return { bufA, bufB, wbA, wbB };
}

const api = loadXlcompApi().__xlcompApi;
assert.ok(typeof api.compareSheetFormula === 'function', 'compareSheetFormula 应可导出');
assert.ok(typeof api.xlcompExtractExternalLinks === 'function', 'xlcompExtractExternalLinks 应可导出');

// ===== 测试数据构造 =====
function makeSheet(cells) {
  const ws = {};
  let maxR = -1, maxC = -1;
  Object.entries(cells).forEach(([addr, def]) => {
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

// f 不带头 '='（与SheetJS一致），compareSheetFormula 内部会加 '='
const fc = (f) => ({ t: 'n', v: 0, f });

// 构造 1..10 的外部链接映射；默认全部相同，可指定不同
function mkMaps(diffIdx = 8, tgtB = 'file:///C:/Other/Book8.xlsx') {
  const mk = (i) => ({ targets: ['file:///C:/Base/Book' + i + '.xlsx'] });
  const mapA = [], mapB = [];
  for (let i = 1; i <= 10; i++) { mapA.push(mk(i)); mapB.push(mk(i)); }
  mapB[diffIdx - 1].targets = [tgtB];
  return { mapA, mapB };
}

function runFormulaCompare(wsA, wsB, mapA, mapB, sheetName = 'Sheet1') {
  api.setWb(makeWb(sheetName, wsA), makeWb(sheetName, wsB));
  api.setExtMaps(mapA, mapB);
  return api.compareSheetFormula(sheetName);
}

// ===== 测试用例 =====
test('E1: 同一公式多个[n]逐个比较（[2]相同 [8]不同 → 外部参照路径差异）', function() {
  const { mapA, mapB } = mkMaps(8);
  const f = '[2]既存リスト!$A:$A+[8]既存リスト!$C:$C';
  const wsA = makeSheet({ A1: fc(f) });
  const wsB = makeSheet({ A1: fc(f) });
  const res = runFormulaCompare(wsA, wsB, mapA, mapB);
  assert.equal(res.diffs.length, 1, '应检出1处差异');
  const d = res.diffs[0];
  assert.equal(d.addr, 'A1');
  assert.equal(d.type, 'external', '仅外部参照不同 → external');
  assert.equal(d.fA, d.fB, '公式本体应相同');
  assert.ok(d.fA.includes('[2]') && d.fA.includes('[8]'), '公式应含 [2] 与 [8]');
  assert.ok(d.extA.includes('[2] → file:///C:/Base/Book2.xlsx'));
  assert.ok(d.extA.includes('[8] → file:///C:/Base/Book8.xlsx'));
  assert.ok(d.extB.includes('[8] → file:///C:/Other/Book8.xlsx'), 'B的[8]应指向其他目录');
  assert.ok(d.extB.includes('[2] → file:///C:/Base/Book2.xlsx'), '[2]相同不应变化');
});

test('E2: 公式本体差异（无外部引用）→ 公式本体差异', function() {
  const { mapA, mapB } = mkMaps();
  const wsA = makeSheet({ A1: fc('XLOOKUP(H36,C:C,E:E)') });
  const wsB = makeSheet({ A1: fc('XLOOKUP(H36,D:D,F:F)') });
  const res = runFormulaCompare(wsA, wsB, mapA, mapB);
  assert.equal(res.diffs.length, 1);
  const d = res.diffs[0];
  assert.equal(d.type, 'formula');
  assert.equal(d.extA, '', '无外部引用时 extA 应为空');
  assert.equal(d.extB, '');
});

test('E3: 公式本体＋外部参照同时不同 → both', function() {
  const { mapA, mapB } = mkMaps(8);
  const wsA = makeSheet({ A1: fc('[2]S!A1') });
  const wsB = makeSheet({ A1: fc('[8]S!B1') });
  const res = runFormulaCompare(wsA, wsB, mapA, mapB);
  assert.equal(res.diffs.length, 1);
  assert.equal(res.diffs[0].type, 'both', '本体不同且引用不同 → both');
});

test('E4: 完整Target比较（basename相同但完整路径不同 → 判差异，不按文件名等价）', function() {
  const mk = (t) => ({ targets: [t] });
  const mapA = [mk('file:///C:/a/Report.xlsx')];
  const mapB = [mk('file:///D:/b/Report.xlsx')];
  assert.equal(api.xlcompExtRefsDiff([1], [1], mapA, mapB), true, 'basename相同但完整Target不同 → 差异');
  assert.equal(api.xlcompExtRefsDiff([1], [1], mapA, mapA), false, 'Target相同 → 无差异');

  // 引用索引不同
  assert.equal(api.xlcompExtRefsDiff([1], [2], mapA, mapB), true, '[n]序号不同 → 差异');
  // 引用数量不同
  assert.equal(api.xlcompExtRefsDiff([1], [1, 2], mapA, mapB), true, '引用数量不同 → 差异');
  // 双方均无法解析 Target（越界/无映射）→ 一致
  assert.equal(api.xlcompExtRefsDiff([2], [2], mapA, mapB), false, '双方均无Target映射 → 一致');
  // 一方能解析、另一方不能（映射条数不同）→ 差异
  const mapLong = [mapA[0], { targets: ['file:///C:/a/Book2.xlsx'] }];
  assert.equal(api.xlcompExtRefsDiff([2], [2], mapLong, mapB), true, 'A能解析B不能 → 差异');
});

test('E5: 公式与外部参照完全一致 → 无差异', function() {
  const { mapA, mapB } = mkMaps();  // 全部相同
  const f = '[2]既存リスト!$A:$A';
  const wsA = makeSheet({ A1: fc(f) });
  const wsB = makeSheet({ A1: fc(f) });
  const res = runFormulaCompare(wsA, wsB, mapA, mapB);
  assert.equal(res.diffs.length, 0);
});

test('E6: 无外部引用公式相同 → 无差异', function() {
  const { mapA, mapB } = mkMaps();
  const wsA = makeSheet({ A1: fc('SUM(A1:B1)') });
  const wsB = makeSheet({ A1: fc('SUM(A1:B1)') });
  const res = runFormulaCompare(wsA, wsB, mapA, mapB);
  assert.equal(res.diffs.length, 0);
});

test('E7: 空引用集 → 无差异（不误判）', function() {
  assert.equal(api.xlcompExtRefsDiff([], [], null, null), false, '双方均无外部引用 → 无差异');
  assert.equal(api.xlcompExtRefsDiff([], [], [], []), false);
});

test('E8: 真实文件 ターゲティング I36 必须显示「外部参照路径差异」', async function(t) {
  const baseDir = 'D:\\業務用\\開発用\\テスト用アイル\\Excel比較\\260813';
  if (!fs.existsSync(baseDir)) {
    t.skip('真实测试文件目录不存在: ' + baseDir);
    return;
  }
  const names = fs.readdirSync(baseDir);
  const fa = names.find(n => n.startsWith('大正製薬_YDAGS') && n.endsWith('.xlsx'));
  const fb = names.find(n => n.startsWith('宇航') && n.endsWith('.xlsx'));
  if (!fa || !fb) {
    t.skip('未找到两个真实对比文件');
    return;
  }
  const bufA = fs.readFileSync(path.join(baseDir, fa));
  const bufB = fs.readFileSync(path.join(baseDir, fb));
  const wbA = XLSX.read(bufA, { type: 'buffer', cellFormula: true, cellNF: true });
  const wbB = XLSX.read(bufB, { type: 'buffer', cellFormula: true, cellNF: true });

  const mapA = await api.xlcompExtractExternalLinks(bufA);
  const mapB = await api.xlcompExtractExternalLinks(bufB);
  assert.ok(mapA.length >= 8 && mapB.length >= 8, '外部链接映射应至少含8个条目');

  api.setWb(wbA, wbB);
  api.setExtMaps(mapA, mapB);
  const r = api.compareSheetFormula('ターゲティング');
  const d = r.diffs.find(x => x.addr === 'I36');
  assert.ok(d, 'ターゲティング I36 应检出差异');
  assert.equal(d.type, 'external', 'I36 应为外部参照路径差异');
  assert.equal(d.fA, d.fB, 'I36 公式本体相同（均为 XLOOKUP 引用 [8]）');
  assert.ok(d.fA.includes('[8]'), 'I36 公式应引用 [8]');
  assert.ok(d.extA.includes('C:\\Users\\BPO\\Desktop\\0813'), '文件A Target 应为 BPO 路径');
  assert.ok(d.extB.includes('C:\\Users\\21252'), '文件B Target 应为 21252 路径');
  assert.notEqual(d.extA, d.extB, 'A/B 外部参照路径必须不同');
});

test('E9: 真实文件 externalLink6 回归（A 5层../ vs B 4层../）', async function(t) {
  const baseDir = 'D:\\業務用\\開発用\\テスト用アイル\\Excel比較\\260813';
  if (!fs.existsSync(baseDir)) {
    t.skip('真实测试文件目录不存在: ' + baseDir);
    return;
  }
  const names = fs.readdirSync(baseDir);
  const fa = names.find(n => n.startsWith('大正製薬_YDAGS') && n.endsWith('.xlsx'));
  const fb = names.find(n => n.startsWith('宇航') && n.endsWith('.xlsx'));
  if (!fa || !fb) { t.skip('未找到两个真实对比文件'); return; }
  const bufA = fs.readFileSync(path.join(baseDir, fa));
  const bufB = fs.readFileSync(path.join(baseDir, fb));

  const mapA = await api.xlcompExtractExternalLinks(bufA);
  const mapB = await api.xlcompExtractExternalLinks(bufB);
  assert.ok(mapA.length >= 6 && mapB.length >= 6, '外部链接映射应至少含6个条目');
  const tA = mapA[5].targets[0];
  const tB = mapB[5].targets[0];
  assert.ok(tA && tB, 'externalLink6 应能解析出 Target');
  assert.notEqual(tA, tB, 'externalLink6 在两个文件间 Target 应不同（5层 vs 4层）');
  const depthA = (tA.match(/\.\.\//g) || []).length;
  const depthB = (tB.match(/\.\.\//g) || []).length;
  assert.notEqual(depthA, depthB, 'A/B 的 ../ 层数应不同');
  assert.ok(depthA === 5 || depthB === 5, '其中一方应为5层');
  assert.ok(depthA === 4 || depthB === 4, '其中一方应为4层');

  // 用真实映射构造引用 [6] 的公式 → compareSheetFormula 应检出 external
  const wsA = makeSheet({ A1: fc('[6]既存リスト!$A:$A') });
  const wsB = makeSheet({ A1: fc('[6]既存リスト!$A:$A') });
  api.setWb(makeWb('Sheet1', wsA), makeWb('Sheet1', wsB));
  api.setExtMaps(mapA, mapB);
  const res = api.compareSheetFormula('Sheet1');
  assert.equal(res.diffs.length, 1, '引用 [6] 的公式应检出外部参照差异');
  assert.equal(res.diffs[0].type, 'external');
  assert.equal(res.diffs[0].fA, res.diffs[0].fB, '公式本体相同');
});

test('E10: xlcompToggleEq 不覆盖当前公式视图（视图保留）', function() {
  // 带DOM mock 重新加载，替换渲染函数为 spy
  const els = new Map();
  const mkEl = () => ({
    style: {}, innerHTML: '', textContent: '', setAttribute() {}, appendChild() {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    closest() { return null; }, scrollIntoView() {},
  });
  const document2 = {
    currentScript: null,
    addEventListener() {},
    getElementById(id) { if (!els.has(id)) els.set(id, mkEl()); return els.get(id); },
    querySelectorAll() { return []; },
    createElement() { return mkEl(); },
    head: { appendChild() {} },
    body: { innerHTML: '' },
  };
  const sandbox = loadXlcompApi(document2);
  vm.runInContext(
    'window.__spy = { calls: [] };\n' +
    'renderXlCompResult = function(){ window.__spy.calls.push("cell"); };\n' +
    'renderFormulaView = function(){ window.__spy.calls.push("formula"); };\n' +
    'xlcompCurrentView = "formula";\n' +
    'xlcompToggleEq(true);\n' +
    'window.__view = xlcompCurrentView;\n',
    sandbox
  );
  assert.deepEqual([...sandbox.__spy.calls], ['formula'],
    'xlcompToggleEq 必须重新渲染当前公式视图，不得回退到单元格视图');
  assert.equal(sandbox.__view, 'formula', '视图状态应保持 formula');
  assert.equal(els.get('xlcomp-btn-hide').style.display, 'none', '隐藏按钮应隐藏');
  assert.equal(els.get('xlcomp-btn-show').style.display, 'inline-block', '显示按钮应显示');
});

test('E11: _xlcompExtDesc 输出格式（多引用换行）', function() {
  const map = [
    { targets: ['file:///C:/Base/Book1.xlsx'] },
    { targets: ['file:///C:/Base/Book2.xlsx'] },
    { targets: [] },
  ];
  const desc = api.xlcompExtDesc('=[1]S!A1+[3]S!B1', map);
  assert.equal(desc, '[1] → file:///C:/Base/Book1.xlsx\n[3] → （无Target）');
  assert.equal(api.xlcompExtDesc('=SUM(A1:B1)', map), '', '无外部引用 → 空');
  assert.equal(api.xlcompExtTargetAt(map, 2), 'file:///C:/Base/Book2.xlsx');
  assert.equal(api.xlcompExtTargetAt(map, 5), null, '越界 → null');
  assert.deepEqual([...api.xlcompFormulaExtRefs('=[2]S!A1+[8]S!B1+[2]S!C1')], [2, 8, 2],
    '按出现顺序提取全部 [n]（不去重）');
});

test('E12: 真实文件 renderFormulaView 全流程渲染：I36 显示「外部参照路径差异」+ 独立统计', async function(t) {
  const real = loadRealFiles();
  if (!real) { t.skip('真实测试文件目录不存在'); return; }
  const { bufA, bufB, wbA, wbB } = real;
  wbA._rawBuf = bufA;
  wbB._rawBuf = bufB;

  // 完整 DOM mock：head.appendChild 触发 script.onload（LibLoader 依赖）
  const els = new Map();
  const mkEl = () => ({
    style: {}, innerHTML: '', textContent: '', setAttribute() {}, appendChild() {},
    classList: { add() {}, remove() {} },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    closest() { return null; }, scrollIntoView() {},
  });
  const document3 = {
    currentScript: null,
    addEventListener() {},
    getElementById(id) { if (!els.has(id)) els.set(id, mkEl()); return els.get(id); },
    querySelectorAll() { return []; },
    createElement() { return mkEl(); },
    head: { appendChild(child) { if (child && typeof child.onload === 'function') child.onload(); } },
    body: { innerHTML: '' },
  };
  const sandbox3 = loadXlcompApi(document3, { setTimeout: (fn) => { fn(); return 0; } });

  vm.runInContext(
    'xlcompWbA = window.__wA; xlcompWbB = window.__wB; xlcompResults = { "ターゲティング": { rows: [] } };',
    Object.assign(sandbox3, { __wA: wbA, __wB: wbB })
  );

  // 执行 async 渲染（内部会自动解析外部链接映射并渲染）
  await vm.runInContext('renderFormulaView()', sandbox3);

  const html = els.get('xlcomp-result').innerHTML;
  assert.ok(html.includes('外部参照路径差异'), '应显示差异类型「外部参照路径差异」');
  assert.ok(html.includes('I36'), '应包含 I36 单元格');
  assert.ok(html.includes('外部参照差异：'), '汇总统计应含外部参照差异独立计数');
  assert.ok(html.includes('公式差异：'), '汇总统计应含公式差异独立计数');
  assert.ok(html.includes('差异类型'), '表头应含差异类型列');
  assert.ok(html.includes('文件A 外部参照'), '表头应含文件A外部参照列');
  assert.ok(html.includes('文件B 外部参照'), '表头应含文件B外部参照列');
  assert.ok(html.includes('C:\\Users\\BPO\\Desktop\\0813'), '文件A外部参照列应显示 BPO 路径');
  assert.ok(html.includes('C:\\Users\\21252'), '文件B外部参照列应显示 21252 路径');
  assert.ok(html.includes('ターゲティング'), '应包含Sheet名');
});
