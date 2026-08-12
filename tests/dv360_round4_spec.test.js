// dv360_round4_spec.test.js — 第4轮专项测试
// 规格: ① YouTube IO FQ 结构化比较 ② Geography mismatch 显示原因 ③ GP 同名匹配
//       ④ 单元格双击完整展开（DV360 全体共通 UI） ⑤ Issues Summary 通用化
// 测试构成: FQ 6 / Geography 6 / GP 6 / 双击 10 = 28 项以上
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

// ── 可控 DOM mock（双击展开 / 行高联动测试用） ──
function makeDom() {
  const els = [];            // 全部 fake 元素
  const byClass = new Map(); // 类名 -> [元素]
  const byId = new Map();    // id -> 元素
  function makeEl(tag, id) {
    const classes = new Set();
    const el = {
      __tag: tag, __id: id, _classes: classes, parentElement: null,
      style: { height: '', setProperty() {} },
      classList: {
        add(...names) {
          for (const n of names) {
            classes.add(n);
            if (!byClass.has(n)) byClass.set(n, []);
            if (!byClass.get(n).includes(el)) byClass.get(n).push(el);
          }
        },
        remove(...names) {
          for (const n of names) {
            classes.delete(n);
            const a = byClass.get(n);
            if (a) { const i = a.indexOf(el); if (i >= 0) a.splice(i, 1); }
          }
        },
        contains(n) { return classes.has(n); },
      },
      closest(sel) {
        let p = this.parentElement;
        while (p) { if (p.__tag === sel.replace(/^[.#]/, '')) return p; p = p.parentElement; }
        return null;
      },
      addEventListener() {}, appendChild() {}, dataset: {}, disabled: false, files: [], innerHTML: '',
      querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
      textContent: '',
    };
    // ブラウザと同じく value 代入は文字列に変換（dvUpdateRowHeight は数値を代入する）
    let _value = '';
    Object.defineProperty(el, 'value', { get: () => _value, set: v => { _value = String(v); } });
    els.push(el);
    if (id) byId.set(id, el);
    return el;
  }
  function matches(sel, el) {
    if (sel.endsWith('tr')) return el.__tag === 'tr';
    if (sel.endsWith('td')) return el.__tag === 'td';
    let cls = null;
    for (const p of sel.split(' ')) { if (p.startsWith('.')) cls = p.slice(1); }
    return cls ? el._classes.has(cls) : false;
  }
  const document = {
    body: makeEl('body'), documentElement: makeEl('html'),
    getElementById(id) { if (!byId.has(id)) makeEl('div', id); return byId.get(id); },
    querySelector() { return null; },
    querySelectorAll(sel) { return els.filter(e => matches(sel, e)); },
  };
  return { document, makeEl, byId };
}

function loadDv360Api(dom) {
  const scripts = [...rawHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(m => m[1]).find(s => s.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script should be present');
  const exportBlock = `
window.__r4spec = {
  setMediaType: function(v) { mediaType = v; },
  setSelectedDv360CaseType: typeof setSelectedDv360CaseType === 'function' ? setSelectedDv360CaseType : undefined,
  parseSettingFrequencyCap: typeof parseSettingFrequencyCap === 'function' ? parseSettingFrequencyCap : undefined,
  parseSdfFrequencyCap: typeof parseSdfFrequencyCap === 'function' ? parseSdfFrequencyCap : undefined,
  resolveSettingFrequencyCap: typeof resolveSettingFrequencyCap === 'function' ? resolveSettingFrequencyCap : undefined,
  formatSettingFqDisplay: typeof formatSettingFqDisplay === 'function' ? formatSettingFqDisplay : undefined,
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  compareGeography: typeof compareGeography === 'function' ? compareGeography : undefined,
  formatIssueItemLabel: typeof formatIssueItemLabel === 'function' ? formatIssueItemLabel : undefined,
  formatMismatchDetailForDisplay: typeof formatMismatchDetailForDisplay === 'function' ? formatMismatchDetailForDisplay : undefined,
  getGpParentIdentity: typeof getGpParentIdentity === 'function' ? getGpParentIdentity : undefined,
  getLiIdentity: typeof getLiIdentity === 'function' ? getLiIdentity : undefined,
  buildComparisonTree: typeof buildComparisonTree === 'function' ? buildComparisonTree : undefined,
  getNodeOwnStatus: typeof getNodeOwnStatus === 'function' ? getNodeOwnStatus : undefined,
  dvToggleCellExpansion: typeof dvToggleCellExpansion === 'function' ? dvToggleCellExpansion : undefined,
  dvUpdateRowHeight: typeof dvUpdateRowHeight === 'function' ? dvUpdateRowHeight : undefined,
  dvResetRowHeight: typeof dvResetRowHeight === 'function' ? dvResetRowHeight : undefined,
  dvApplyGlobalRowHeight: typeof dvApplyGlobalRowHeight === 'function' ? dvApplyGlobalRowHeight : undefined,
  getDvRowHeight: function() { return DV_ROW_HEIGHT; },
  _buildRowHtml: typeof _buildRowHtml === 'function' ? _buildRowHtml : undefined,
};`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set, TextDecoder,
    Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document: dom.document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__r4spec;
}

const dom = makeDom();
const api = loadDv360Api(dom);
const fqLabel = 'FQ';

function sIO(ov) {
  return { fields: { ioType: '', goal: '', budget: '500000', startDate: '2026/06/01', endDate: '2026/06/30',
    pacing: '掲載期間', pacingRate: '均等', kpi: '', kpiValue: '', fq: '1か月/2', ...ov } };
}
function dIO(ov) {
  return { fields: { status: 'Active', ioType: 'Standard', ioSubtype: 'Default', objective: '',
    budgetSegments: '(500000;06/01/2026 00:00;06/30/2026 23:59;;;)', pacing: 'Flight', pacingRate: 'Even',
    kpiType: '', kpiValue: '', frequencyEnabled: 'True', frequencyExposures: '2', frequencyPeriod: 'Months', ...ov } };
}
function fqItem(ov, dov) { return api.compareIO(sIO(ov), dIO(dov)).find(i => i.label === fqLabel); }

// ═══════════════════════════════
// ① FQ 结构化比较（YouTube IO）
// ═══════════════════════════════
test('FQ1: 1か月/2 ↔ 2/Months → ok', () => {
  api.setMediaType('youtube');
  const it = fqItem({});
  assert.equal(it.result, 'ok');
  assert.equal(it.sVal, '1か月 / 2回');
  assert.equal(it.dVal, '2回 / Months');
});

test('FQ2: 1ヶ月/2 ↔ 2/Months → ok（ヶ表記）', () => {
  api.setMediaType('youtube');
  assert.equal(fqItem({ fq: '1ヶ月/2' }).result, 'ok');
  assert.equal(fqItem({ fq: '1ヵ月/2' }).result, 'ok');
  assert.equal(fqItem({ fq: '1月/2' }).result, 'ok');
});

test('FQ3: 1週間/2 ↔ 2/Weeks → ok（週間）', () => {
  api.setMediaType('youtube');
  assert.equal(fqItem({ fq: '1週間/2' }, { frequencyPeriod: 'Weeks' }).result, 'ok');
  assert.equal(fqItem({ fq: '1週/2' }, { frequencyPeriod: 'Weeks' }).result, 'ok');
});

test('FQ4: 1か月/2 ↔ 3/Months → mismatch（回数不一致）', () => {
  api.setMediaType('youtube');
  assert.equal(fqItem({}, { frequencyExposures: '3' }).result, 'mismatch');
});

test('FQ5: 1週間/2 ↔ 2/Months → mismatch（周期不一致）', () => {
  api.setMediaType('youtube');
  const it = fqItem({ fq: '1週間/2' });
  assert.equal(it.result, 'mismatch');
  assert.equal(it.sVal, '1週間 / 2回');
  assert.equal(it.dVal, '2回 / Months');
});

test('FQ6: 1か月 の 1 を回数として誤取しない', () => {
  api.setMediaType('youtube');
  const p = api.parseSettingFrequencyCap('1か月/2');
  assert.equal(p.exposures, 2);
  assert.equal(p.periodCount, 1);
  assert.equal(p.periodUnit, 'month');
  // 旧実装は match(/\d+/)[0] で exposures=1 になっていた
  const it = fqItem({});
  assert.equal(it.result, 'ok', 'exposures は 2 として一致判定される');
});

test('FQ-extra: split 形式（設定タイミング/回数 分列）も结构化解析', () => {
  api.setMediaType('youtube');
  const r = api.resolveSettingFrequencyCap({ fqTiming: '1か月', fqCount: '5回' });
  assert.equal(r.exposures, 5); assert.equal(r.periodCount, 1); assert.equal(r.periodUnit, 'month');
  const r2 = api.resolveSettingFrequencyCap({ fqTiming: '月', fqCount: '5回' });
  assert.equal(r2.exposures, 5); assert.equal(r2.periodCount, 1); assert.equal(r2.periodUnit, 'month');
});

test('FQ-extra: ●回 placeholder → warning（解析不能）', () => {
  api.setMediaType('youtube');
  assert.equal(fqItem({ fq: '●回' }).result, 'warning');
});

// ═══════════════════════════════
// ② Geography mismatch 显示原因
// ═══════════════════════════════
test('Geo1: 配信不足 → detail 表示', () => {
  const g = api.compareGeography('埼玉県', '', '', '');
  assert.equal(g.result, 'mismatch');
  assert.ok(g.detail.includes('配信不足：埼玉県'), g.detail);
});

test('Geo2: 配信追加 → detail 表示', () => {
  const g = api.compareGeography('', '埼玉県', '', '');
  assert.equal(g.result, 'mismatch');
  assert.ok(g.detail.includes('配信追加：埼玉県'), g.detail);
});

test('Geo3: 除外不足 → detail 表示', () => {
  const g = api.compareGeography('除外：埼玉県', '', '', '');
  assert.equal(g.result, 'mismatch');
  assert.ok(g.detail.includes('除外不足：埼玉県'), g.detail);
});

test('Geo4: 除外追加 → detail 表示', () => {
  const g = api.compareGeography('埼玉県', '', '埼玉県', '');
  assert.equal(g.result, 'mismatch');
  assert.ok(g.detail.includes('除外追加：埼玉県'), g.detail);
});

test('Geo5: SDF側未知Code → warning + SDF未識別Code', () => {
  const g = api.compareGeography('埼玉県', '99999', '', '');
  assert.equal(g.result, 'warning');
  assert.ok(g.detail.includes('SDF未識別Code：99999'), g.detail);
});

test('Geo6: ok 時 detail は空（余計な理由を出さない）', () => {
  const g = api.compareGeography('埼玉県', '埼玉県', '', '');
  assert.equal(g.result, 'ok');
  assert.equal(g.detail, '');
});

test('Geo-extra: mismatch detail は mpDetail でなく detail から表示（⑤ 通用化）', () => {
  const label = api.formatIssueItemLabel(
    { label: '地域 / Geography Targeting', result: 'mismatch', detail: '配信不足：埼玉県', mpDetail: '' });
  // 2026-08-09: 表記を自然日本語に統一（配信不足/配信追加 のまま表示）
  assert.equal(label, '❌地域 / Geography Targeting【配信不足：埼玉県】');
  assert.equal(api.formatIssueItemLabel({ label: 'FQ', result: 'warning', detail: '回数解析不能' }),
    '⚠FQ【回数解析不能】');
  assert.equal(api.formatIssueItemLabel({ label: 'X', result: 'mismatch', detail: '' }), '❌X');
  assert.equal(api.formatIssueItemLabel({ label: 'Y', result: 'mismatch', mpDetail: 'MP' }), '❌Y【MP】');
});

// ═══════════════════════════════
// ③ GP 同名匹配（LI 绑定）
// ═══════════════════════════════
function mkRec(name, extra) {
  return { name, fields: { status: 'Active' }, rawFields: { Status: 'Active', Name: name },
    rawFieldOrder: ['Status', 'Name'], ...extra };
}
function mkLi(name, id) { return mkRec(name, { id, ioName: 'IO1', ioId: 'io1' }); }
function mkGp(name, id, liId, liName) { return mkRec(name, { id, liId, liName, ioName: 'IO1' }); }
function buildTree(sGpList, dGpList) {
  api.setMediaType('youtube');
  return api.buildComparisonTree(
    { cp: [mkRec('CP1')], io: [mkRec('IO1')],
      li: [mkLi('LI-A', 'li1'), mkLi('LI-B', 'li2')], gp: sGpList, cr: [] },
    { cp: [mkRec('CP1', { id: 'cp1' })], io: [mkRec('IO1', { id: 'io1', cpId: 'cp1' })],
      li: [mkLi('LI-A', 'li1'), mkLi('LI-B', 'li2')], gp: dGpList, cr: [] });
}
function liNode(tree, idx) { return tree.roots[0].children[0].children[idx]; }

test('GP1: 同名 GP が異なる LI 配下に存在 → それぞれ自分の LI の下で一致', () => {
  const tree = buildTree(
    [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-X', 'sg2', 'li2', 'LI-B')],
    [mkGp('GP-X', 'dg1', 'li1', 'LI-A'), mkGp('GP-X', 'dg2', 'li2', 'LI-B')]);
  const liA = liNode(tree, 0), liB = liNode(tree, 1);
  assert.equal(liA.children.length, 1);
  assert.equal(liB.children.length, 1);
  assert.equal(liA.children[0].found, true);
  assert.equal(liB.children[0].found, true);
  assert.equal(liA.children[0].matchedName, 'GP-X');
  assert.equal(liB.children[0].matchedName, 'GP-X');
});

test('GP2: ダウンロード同名 GP が 1 つだけ → 親 LI 一致側のみ一致、他方は未匹配', () => {
  const tree = buildTree(
    [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-X', 'sg2', 'li2', 'LI-B')],
    [mkGp('GP-X', 'dg1', 'li1', 'LI-A')]);
  assert.equal(liNode(tree, 0).children[0].found, true);
  assert.equal(liNode(tree, 1).children[0].found, false);
  assert.equal(liNode(tree, 1).children[0].matchedName, null, '未匹配時は matchedName なし');
});

test('GP3: 無駄な SDF由来 GP が出ない（matchedDGP 消費が正しい）', () => {
  const tree = buildTree(
    [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-X', 'sg2', 'li2', 'LI-B')],
    [mkGp('GP-X', 'dg1', 'li1', 'LI-A'), mkGp('GP-X', 'dg2', 'li2', 'LI-B')]);
  assert.equal(tree.dlOnly.filter(n => n.level === 'GP').length, 0);
  const tree3 = buildTree(
    [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-X', 'sg2', 'li2', 'LI-B')],
    [mkGp('GP-X', 'dg1', 'li1', 'LI-A')]);
  // ダウンロード GP は LI-A 側で消費 → 未消費の SDF由来 GP なし
  assert.equal(tree3.dlOnly.filter(n => n.level === 'GP').length, 0, '消費済みなら SDF由来 なし');
  // 設定表側の未マッチ GP はツリー内に found:false ノードとして残る
  assert.equal(liNode(tree3, 1).children[0].found, false);
  assert.equal(liNode(tree3, 1).children[0].name, 'GP-X');
});

test('GP4: 同名 GP 一方不整合 → 影響はその LI 内に限定', () => {
  const tree = buildTree(
    [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-X', 'sg2', 'li2', 'LI-B')],
    [mkGp('GP-X', 'dg1', 'li1', 'LI-A')]);
  const liA = liNode(tree, 0), liB = liNode(tree, 1);
  assert.equal(liA.children[0].found, true, 'LI-A 側は影響なし');
  assert.equal(liB.children[0].found, false);
});

test('GP5: 親 LI 一致済み → グローバル fallback 禁止（candidate にしない）', () => {
  const tree = buildTree(
    [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-X', 'sg2', 'li2', 'LI-B')],
    [mkGp('GP-X', 'dg1', 'li1', 'LI-A')]);
  const gpB = liNode(tree, 1).children[0];
  assert.equal(gpB.found, false);
  assert.equal(gpB.candidate, false, '親 LI 一致時は候補すら出さない');
  assert.equal(api.getNodeOwnStatus(gpB), 'notfound');
});

test('GP6: 親 LI 未一致 → 全体候補検索は診断のみ、matchedDGP を消費しない', () => {
  api.setMediaType('youtube');
  const tree = api.buildComparisonTree(
    { cp: [mkRec('CP1')], io: [mkRec('IO1')],
      li: [mkLi('LI-A', 'li1'), mkLi('LI-B', 'li2')],
      gp: [mkGp('GP-X', 'sg1', 'li1', 'LI-A'), mkGp('GP-Y', 'sg2', 'li2', 'LI-B')], cr: [] },
    { cp: [mkRec('CP1', { id: 'cp1' })], io: [mkRec('IO1', { id: 'io1', cpId: 'cp1' })],
      li: [mkLi('LI-A', 'li1')],
      gp: [mkGp('GP-X', 'dg1', 'li1', 'LI-A'), mkGp('GP-Y', 'dg2', 'li2', 'LI-B')], cr: [] });
  const gpB = liNode(tree, 1).children[0];
  assert.equal(gpB.candidate, true, '親 LI 未一致は候補表示');
  assert.equal(api.getNodeOwnStatus(gpB), 'warning');
  assert.equal(tree.dlOnly.filter(n => n.level === 'GP').length, 1, '候補は消費されず SDF由来 GP に残る');
});

test('GP-extra: getGpParentIdentity は liId 優先、無ければ liName', () => {
  const a = api.getGpParentIdentity({ liId: '123', liName: 'LI-A' });
  assert.equal(a.liId, '123'); assert.equal(a.liName, undefined);
  const b = api.getGpParentIdentity({ liName: 'LI-A' });
  assert.equal(b.liName, 'li-a'); assert.equal(b.liId, undefined);
  const c = api.getLiIdentity({ id: '123', name: 'LI-A' });
  assert.equal(c.id, '123'); assert.equal(c.name, 'li-a');
});

// ═══════════════════════════════
// ④ セルダブルクリック全展開（DV360 全体共通）
// ═══════════════════════════════
const cols = [{ key: 'geo', label: '地域' }, { key: 'kw', label: 'Keyword' }];
const longGeo = '配信：埼玉県、群馬県、茨城県、栃木県、千葉県、神奈川県、東京都 / 除外：なし';
const longKw = 'アドビシリーズ ブランド キーワード AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH IIII JJJJ KKKK LLLL MMMM';
const statusIcon = { ok: '✅', mismatch: '❌', warning: '⚠', notfound: '⬜' };
const statusText = { ok: '一致', mismatch: '不一致', warning: '需確認', notfound: '未匹配' };
function buildItemHtml() {
  return api._buildRowHtml({
    found: true, name: 'LI-A', ownStatus: 'mismatch', status: 'mismatch',
    compItems: [
      { key: 'geo', label: '地域', result: 'mismatch', sVal: longGeo, dVal: '配信：東京都', mpDetail: '' },
      { key: 'kw', label: 'Keyword', result: 'ok', sVal: longKw, dVal: longKw, mpDetail: '' },
    ],
  }, 0, 'LI', cols, statusIcon, statusText);
}

test('Dbl1: 名称/S行/D行 データセルに dv-cell-dblclick + title 付与', () => {
  const html = buildItemHtml();
  assert.ok(html.includes('col-name dv-cell-dblclick'), '名称列');
  assert.ok(html.includes('dv-cell-dblclick" title="ダブルクリックで全表示"'), 'データセル');
  assert.ok((html.match(/dv-cell-dblclick/g) || []).length >= 5, '名称1 + S行2 + D行2');
  assert.ok(html.includes('title="ダブルクリックで全表示"'));
});

test('Dbl2: No./比較結果 列に dv-cell-dblclick なし', () => {
  const html = buildItemHtml();
  assert.ok(!html.includes('col-no dv-cell-dblclick'), 'No. 列');
  assert.ok(!html.includes('col-status dv-cell-dblclick'), '比較結果列');
  assert.ok(html.includes('class="col-no"'));
  assert.ok(html.includes('class="col-status"'));
});

test('Dbl3: 長い Geography 内容が S行/D行に完全表示（折返し対象）', () => {
  const html = buildItemHtml();
  assert.ok(html.includes(longGeo), 'S行 全文字保持');
  assert.ok(html.includes('cell-s-row'), 'S行 div');
  assert.ok(html.includes('cell-d-row'), 'D行 div');
});

test('Dbl4: 長い Keyword 内容も完全表示', () => {
  const html = buildItemHtml();
  assert.ok(html.includes(longKw));
});

test('Dbl5: CSS 展開ルール存在（!important で固定高を上書き）', () => {
  assert.ok(rawHtml.includes('.result-table td.dv-cell-expanded{height:auto!important;max-height:none;overflow:visible;white-space:normal;}'));
  assert.ok(rawHtml.includes('.result-table tr.dv-expanded-row{height:auto!important;}'));
  assert.ok(rawHtml.includes('.dv-cell-expanded .cell-s-row,.dv-cell-expanded .cell-d-row{height:auto!important;max-height:none;overflow:visible;}'));
  assert.ok(rawHtml.includes('.dv-cell-dblclick{cursor:zoom-in;}'));
  assert.ok(rawHtml.includes('.dv-cell-dblclick.dv-cell-expanded{cursor:zoom-out;}'));
});

test('Dbl6: 列幅ドラッグ（dv-col-resizer）・横スクロール CSS は維持', () => {
  assert.ok(rawHtml.includes('dv-col-resizer'), '列幅リサイズ');
  assert.ok(/\.result-table-wrap\{[^}]*overflow:auto/.test(rawHtml), '横スクロール（overflow:auto）');
});

test('Dbl7: dblclick 委譲リスナー登録（result-table-wrap）', () => {
  assert.ok(rawHtml.includes("addEventListener('dblclick'"));
  const m = rawHtml.match(/getElementById\('result-table-wrap'\)\.addEventListener\('dblclick'[\s\S]{0,200}?closest\('td\.dv-cell-dblclick'\)/);
  assert.ok(m, 'delegation target: td.dv-cell-dblclick');
});

test('Dbl8: 展開 → td.dv-cell-expanded + tr.dv-expanded-row、再クリックで復元', () => {
  const td = dom.makeEl('td'); const tr = dom.makeEl('tr');
  td.parentElement = tr;
  api.dvToggleCellExpansion(td);
  assert.ok(td._classes.has('dv-cell-expanded'), 'td 展開');
  assert.ok(tr._classes.has('dv-expanded-row'), 'tr 展開');
  api.dvToggleCellExpansion(td);
  assert.ok(!td._classes.has('dv-cell-expanded'), 'td 復元');
  assert.ok(!tr._classes.has('dv-expanded-row'), 'tr 復元');
});

test('Dbl9: 他セル展開中に別セルをダブルクリック → 前の展開のみ解除', () => {
  const td1 = dom.makeEl('td'); const td2 = dom.makeEl('td');
  api.dvToggleCellExpansion(td1);
  api.dvToggleCellExpansion(td2);
  assert.ok(!td1._classes.has('dv-cell-expanded'), '前のセル解除');
  assert.ok(td2._classes.has('dv-cell-expanded'), '新セル展開');
});

test('Dbl10: Slider 80 → 展開 → 收起 → DV_ROW_HEIGHT は 80 のまま、行高 80px 再適用', () => {
  const tr = dom.makeEl('tr'); const td = dom.makeEl('td');
  td.parentElement = tr;
  api.dvUpdateRowHeight(80);
  assert.equal(api.getDvRowHeight(), 80);
  assert.equal(dom.byId.get('dv-row-height-slider').value, '80');
  assert.equal(dom.byId.get('dv-row-height-input').value, '80');
  assert.equal(tr.style.height, '80px');
  api.dvToggleCellExpansion(td);
  assert.equal(api.getDvRowHeight(), 80, '展開しても 80 保持');
  api.dvToggleCellExpansion(td);
  assert.equal(api.getDvRowHeight(), 80, '收起後も 80');
  assert.equal(tr.style.height, '80px', '收起時に dvApplyGlobalRowHeight で再適用');
});

test('Dbl-extra: 行高 Slider 20-200 クランプ + 50/120/200 联动', () => {
  for (const v of [50, 120, 200]) {
    api.dvUpdateRowHeight(v);
    assert.equal(api.getDvRowHeight(), v);
  }
  api.dvUpdateRowHeight(5); assert.equal(api.getDvRowHeight(), 20, '下限 20');
  api.dvUpdateRowHeight(999); assert.equal(api.getDvRowHeight(), 200, '上限 200');
  api.dvResetRowHeight();
  assert.equal(api.getDvRowHeight(), 50, 'リセット 50');
});
