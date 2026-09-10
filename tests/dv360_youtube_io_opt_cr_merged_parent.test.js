// YouTube IO 最適化 canonical comparison + CR parent merged-cell 修复测试（2026-09-10）
//
// FIX A: YouTube IO「最適化」— 設定表未設定（''/'-'等 placeholder）は業務上デフォルト OFF=False と
//        同等。よって 設定なし+False=ok / 設定なし+True=mismatch。未知テキスト・Download 空は
//        warning のまま（勝手に false と解釈しない）。
// FIX B: 入稿物管理表の親フィールド（IO名/LI名/GP名）が縦結合（merged cells）の場合、
//        sheet_to_json は結合左上セルにしか値を出力せず、merge continuation 行の CR が
//        IO/LI/GP 親スコープを失い階層マッチ（lpName/gpName スコープ）が崩れる。
//        worksheets[sname]['!merges'] に基づく merge-aware accessor で親 3 フィールドのみ解決する。
//        （CR 固有フィールド URL/見出し等は決して伝播しない — 各自行を読む）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');

function createClassList() {
  const values = new Set();
  return { add(...names) { names.forEach(name => values.add(name)); }, remove(...names) { names.forEach(name => values.delete(name)); }, contains(name) { return values.has(name); } };
}
function createElement() {
  return { addEventListener() {}, appendChild() {}, classList: createClassList(), closest() { return null; }, dataset: {}, innerHTML: '', scrollIntoView() {}, style: { setProperty() {} }, textContent: '', value: '' };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source);

  const exportBlock = `
window.__dv360IoptCrApi = {
  compareIO: typeof compareIO === 'function' ? compareIO : undefined,
  parseYoutubeSetting: typeof parseYoutubeSetting === 'function' ? parseYoutubeSetting : undefined,
  setMediaType: function(value) { mediaType=value; },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map([['dv-case-select', createElement('initial')]]);
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {}, FileReader() {}, JSZip: {},
    Map, Promise, Response, Set, TextDecoder, Uint8Array, URL, XLSX: {},
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  sandbox.__dv360IoptCrApi.setMediaType('youtube');
  return { api: sandbox.__dv360IoptCrApi };
}

function findItem(items, label) {
  const item = items.find(entry => entry.label === label);
  assert.ok(item, `${label} comparison item should exist`);
  return item;
}
function makeDownload(fields = {}) {
  return { name: 'YouTube test', id: 'io-test', rawFields: {}, rawFieldOrder: [],
    statusInfo: { found: true, matchedKey: 'Status', rawValue: 'Active', normalizedValue: 'Active' },
    fields: { status: 'Active', ...fields } };
}

// ══════════════════ FIX A: YouTube IO 最適化 canonical ══════════════════

test('A1: 設定なし + Download False = ok（未設定はデフォルト OFF と同等）', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: {} }, makeDownload({ autoBudget: 'False' }));
  assert.equal(findItem(items, '最適化').result, 'ok');
});

test('A1b: 設定なし（placeholder "-"）+ Download False = ok', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: { optimize: '-' } }, makeDownload({ autoBudget: 'False' }));
  assert.equal(findItem(items, '最適化').result, 'ok');
});

test('A2: 設定なし + Download True = mismatch', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: {} }, makeDownload({ autoBudget: 'True' }));
  assert.equal(findItem(items, '最適化').result, 'mismatch');
});

test('A3: 手動で管理 + Download False = ok', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: { optimize: '予算の割り当てを手動で管理する' } }, makeDownload({ autoBudget: 'False' }));
  assert.equal(findItem(items, '最適化').result, 'ok');
});

test('A4: 自動的に最適化 + Download True = ok', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: { optimize: '予算の割り当てを自動的に最適化する' } }, makeDownload({ autoBudget: 'True' }));
  assert.equal(findItem(items, '最適化').result, 'ok');
});

test('A5: 自動的に最適化 + Download False = mismatch', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: { optimize: '予算の割り当てを自動的に最適化する' } }, makeDownload({ autoBudget: 'False' }));
  assert.equal(findItem(items, '最適化').result, 'mismatch');
});

test('A6: 未知テキスト + Download False = warning（未知を勝手に false と解釈しない）', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: { optimize: '第三の未知管理方式' } }, makeDownload({ autoBudget: 'False' }));
  assert.equal(findItem(items, '最適化').result, 'warning');
});

test('A7: 設定なし + Download 空 = warning（空を勝手に false と解釈しない）', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: {} }, makeDownload({ autoBudget: '' }));
  assert.equal(findItem(items, '最適化').result, 'warning');
});

test('A8: 表示テキストは変わらない（S:(設定表なし) / D:False、偽装しない）', () => {
  const { api } = loadDv360Api();
  const items = api.compareIO({ fields: {} }, makeDownload({ autoBudget: 'False' }));
  const item = findItem(items, '最適化');
  assert.equal(item.sVal, '(設定表なし)');
  assert.equal(item.dVal, 'False');
});

// ══════════════════ FIX B: CR parent merged cells ══════════════════

const SALES = '記入欄_営業・業推記入用';
const OP = '※運用者用※設定シート';
const CR_SHEET = '入稿物管理表（VRC・VVC・VRC(FQ))';
const IO_A = 'IO_A_TestCase';
const IO_B = 'IO_B_TestCase';

function mkRow(pairs) { const r = []; for (const [i, v] of pairs) r[i] = v; return r; }
function merge(sr, sc, er, ec) { return { s: { r: sr, c: sc }, e: { r: er, c: ec } }; }

function buildCaseSheets() {
  // 営業: IO_A に 2 LI、IO_B に 2 LI
  const h6 = mkRow([[0, '＃'], [2, 'J.No'], [3, '配信目的'], [4, 'IO名'], [5, 'セグメント内容'], [6, '動画タイプ'], [14, '開始・終了\n時間指定有無'], [15, '開始日・時間'], [17, '終了日・時間'], [55, '使用する入稿物管理表']]);
  const h7 = mkRow([[15, '日'], [16, '時間'], [17, '日'], [18, '時間']]);
  const sRow = (idx, io, seg) => mkRow([[0, idx], [4, io], [5, seg], [6, 'VRC（スキップ可）'], [14, 'あり'], [15, '2026/9/10(aaa)'], [16, '10:00'], [17, '2026/9/30(aaa)'], [18, '23:59'], [55, CR_SHEET]]);
  const salesRows = [[], [], [], [], [], h6, h7, [], sRow('1', IO_A, 'SEG_A1'), sRow('2', IO_A, 'SEG_A2'), sRow('3', IO_B, 'SEG_B1'), sRow('4', IO_B, 'SEG_B2')];

  // 運用者: 各 IO 2 LI
  const opHdr = mkRow([[1, 'NO'], [2, 'IO名'], [3, 'IOタイプ'], [4, '目標'], [5, '全体予算'], [6, '98%'], [9, '開始日・時間'], [11, '終了日・時間'], [13, 'ペース'], [16, 'KPI'], [18, '最適化'], [19, 'IOのFQ'], [20, 'マージン'], [21, '品質'], [22, '備考欄有無'], [23, '広告申込情報名'], [24, 'タイプ'], [27, '言語'], [28, '地域'], [29, '曜日・日時'], [30, '広告枠ソース'], [33, '掲載期間'], [36, '日予算管理'], [37, '予算ペース'], [38, '日予算'], [52, '広告グループ名'], [62, '性別'], [64, '年齢']]);
  const opRow = (no, io, liName) => mkRow([[1, no], [2, io], [3, 'スタンダード'], [4, 'ブランドの知名度'], [5, '¥250,000'], [6, '¥245,000'], [9, 'Thursday, September 10, 2026'], [10, '10:00'], [11, 'Wednesday, September 30, 2026'], [12, '23:59'], [13, '掲載期間'], [14, '均等'], [23, liName], [24, 'ブランド認知度とリーチ'], [27, 'Japanese'], [28, 'Japan（国名）'], [29, '2026/9/10(木)10:00～2026/9/30(水)23:59'], [30, 'Youtube'], [33, '広告掲載オーダーと同じ日付を使用'], [36, '日次'], [37, '均等'], [38, '¥11,666'], [52, 'GP_' + liName], [64, '18～34']]);
  const opRows = new Array(23).fill(null).map(() => []);
  opRows[1] = mkRow([[1, 'キャンペーン名'], [3, 'TestCase_Campaign']]);
  opRows[2] = mkRow([[1, '全体目標'], [3, '認知']]);
  opRows[23] = opHdr;
  const LI_A1 = 'LI_A1_TestCase_SEG_A1', LI_A2 = 'LI_A2_TestCase_SEG_A2';
  const LI_B1 = 'LI_B1_TestCase_SEG_B1', LI_B2 = 'LI_B2_TestCase_SEG_B2';
  opRows[24] = opRow('1', IO_A, LI_A1);
  opRows[25] = opRow('2', IO_A, LI_A2);
  opRows[26] = opRow('3', IO_B, LI_B1);
  opRows[27] = opRow('4', IO_B, LI_B2);

  // CR sheet（018 構造を復刻: D=IO col3, E=LI col4, F=GP col5, G=CR名 col6）
  const crHdr = mkRow([[1, '依頼日'], [2, 'ステータス'], [3, '広告掲載オーダー名※'], [4, '広告申込情報名※'], [5, '広告グループ名※'], [6, '広告名※'], [7, '掲載開始日'], [8, '掲載終了日'], [9, 'Youtube動画(URL)※'], [10, '入稿用URL（ランディングページURL）'], [11, '表示 URLの第一ドメイン'], [15, '行動を促すフレーズ'], [17, 'タイトル'], [19, '長い見出し※'], [21, '説明※'], [23, 'コンパニオンバナー'], [25, 'クリック トラッカー URL（省略可）']]);
  const crRow = (io, li, gp, cr, url) => mkRow([[3, io], [4, li], [5, gp], [6, cr], [9, url], [17, 'HH_' + cr], [19, 'LH_' + cr]]);
  // row(0-based): crHdr=4 → data 5..（excel row6..）
  const crRows = [[], [], [], [], crHdr,
    crRow(IO_A, LI_A1, 'GP_A', 'CR_A1', 'https://youtu.be/v1'),   // row6: 直填
    crRow('', LI_A1, 'GP_A', 'CR_A2', 'https://youtu.be/v2'),     // row7: IO merge continuation (D6:D7)
    [],
    [],
    crRow(IO_B, LI_B1, 'GP_B', 'CR_SHARED', 'https://youtu.be/v3'),  // row10: 第1组左上 (D10:D15/E10:E12/F10:F12)
    crRow('', '', '', 'CR_B2', 'https://youtu.be/v4'),            // row11: continuation → IO_B/LI_B1/GP_B
    crRow('', '', '', 'CR_B3', 'https://youtu.be/v5'),            // row12: continuation → IO_B/LI_B1/GP_B
    crRow('', LI_B2, 'GP_B2', 'CR_SHARED', 'https://youtu.be/v6'),// row13: 第2组左上 E13:E15/F13:F15, IO 仍 D10:D15 continuation
    crRow('', '', '', 'CR_B5', 'https://youtu.be/v7'),            // row14: continuation → IO_B/LI_B2/GP_B2
    crRow('', '', '', 'CR_B6', 'https://youtu.be/v8'),            // row15: continuation → IO_B/LI_B2/GP_B2
    crRow('', '', '', 'CR_TRUEBLANK', 'https://youtu.be/v9'),     // row16: 真正空白（无 merge）
  ];
  // merges（0-based 行）: excel row6-7 → r5-6; excel row10-15 → r9-14; E/F excel 10-12 → r9-11; 13-15 → r12-14
  const worksheets = { [CR_SHEET]: { '!merges': [
    merge(5, 3, 6, 3),   // D6:D7  IO
    merge(9, 3, 14, 3),  // D10:D15 IO
    merge(9, 4, 11, 4),  // E10:E12 LI
    merge(9, 5, 11, 5),  // F10:F12 GP
    merge(12, 4, 14, 4), // E13:E15 LI
    merge(12, 5, 14, 5), // F13:F15 GP
  ] } };
  const sheets = { [SALES]: salesRows, [OP]: opRows, [CR_SHEET]: crRows };
  return { sheets, worksheets, LI_A1, LI_A2, LI_B1, LI_B2 };
}

function parseCase() {
  const { api } = loadDv360Api();
  const { sheets, worksheets } = buildCaseSheets();
  const result = api.parseYoutubeSetting(sheets, Object.keys(sheets), 'test.xlsx', worksheets);
  return { result, meta: buildCaseSheets() };
}
function crByName(result, name) {
  return result.crList.find(cr => cr.name === name);
}

test('B主: merged continuation CR（row11/12/14/15）の親 IO/LI/GP が merge 左上値で復元される', () => {
  const { result, meta } = parseCase();
  const expect = [
    ['CR_B2', meta.LI_B1, 'GP_B', IO_B],
    ['CR_B3', meta.LI_B1, 'GP_B', IO_B],
    ['CR_B5', meta.LI_B2, 'GP_B2', IO_B],
    ['CR_B6', meta.LI_B2, 'GP_B2', IO_B],
  ];
  for (const [crName, li, gp, io] of expect) {
    const cr = crByName(result, crName);
    assert.ok(cr, `${crName} should exist`);
    assert.equal(cr.lpName, li, `${crName} lpName`);
    assert.equal(cr.gpName, gp, `${crName} gpName`);
    assert.equal(cr.ioName, io, `${crName} ioName`);
  }
});

test('B主: row7 IO merge continuation（D6:D7）の IO が復元される', () => {
  const { result } = parseCase();
  const cr2 = crByName(result, 'CR_A2');
  assert.ok(cr2);
  assert.equal(cr2.lpName, 'LI_A1_TestCase_SEG_A1');
  assert.equal(cr2.ioName, IO_A);
});

test('B主: row13 は第2 merge グループ左上（LI_B2/GP_B2）+ IO は D10:D15 左上', () => {
  const { result, meta } = parseCase();
  const cr = crByName(result, 'CR_SHARED');
  // CR_SHARED が 2 行（row10=LI_B1配下, row13=LI_B2配下）存在
  const shared = result.crList.filter(c => c.name === 'CR_SHARED');
  assert.equal(shared.length, 2);
  assert.equal(shared[0].lpName, meta.LI_B1);
  assert.equal(shared[0].gpName, 'GP_B');
  assert.equal(shared[1].lpName, meta.LI_B2);
  assert.equal(shared[1].gpName, 'GP_B2');
  assert.equal(shared[1].ioName, IO_B);
});

test('B3: 同名 CR が跨 LI に存在しても parent scope どおりに帰属する（跨 LI 混線なし）', () => {
  const { result, meta } = parseCase();
  const shared = result.crList.filter(c => c.name === 'CR_SHARED');
  assert.equal(shared[0].lpName, meta.LI_B1, 'row10 の CR_SHARED は LI_B1');
  assert.equal(shared[1].lpName, meta.LI_B2, 'row13 の CR_SHARED は LI_B2');
  assert.notEqual(shared[0].lpName, shared[1].lpName);
});

test('B1: 真正空白（merge 範囲外）の親は空のまま伝播しない', () => {
  const { result } = parseCase();
  const cr = crByName(result, 'CR_TRUEBLANK');
  assert.ok(cr, 'CR_TRUEBLANK should exist（videoUrl があるため record 生成）');
  assert.equal(cr.ioName, '', 'ioName は空');
  assert.equal(cr.lpName, '', 'lpName は空');
  assert.equal(cr.gpName, '', 'gpName は空');
});

test('B4: CR 固有フィールド（videoUrl/headline/longHeadline）は各自行の値のまま', () => {
  const { result } = parseCase();
  const b2 = crByName(result, 'CR_B2');
  const b3 = crByName(result, 'CR_B3');
  const b5 = crByName(result, 'CR_B5');
  assert.equal(b2.fields.videoUrl, 'https://youtu.be/v4');
  assert.equal(b3.fields.videoUrl, 'https://youtu.be/v5');
  assert.equal(b5.fields.videoUrl, 'https://youtu.be/v7');
  assert.equal(b2.fields.headline, 'HH_CR_B2', 'headline は各自行');
  assert.equal(b5.fields.longHeadline, 'LH_CR_B5', 'longHeadline は各自行');
  // merge continuation で親から headline 等が伝播していないこと
  assert.notEqual(b2.fields.headline, 'HH_CR_B3');
});

test('B5: 直填行（非 merge）は従来どおり自身の値', () => {
  const { result, meta } = parseCase();
  const cr1 = crByName(result, 'CR_A1');
  assert.equal(cr1.lpName, meta.LI_A1);
  assert.equal(cr1.gpName, 'GP_A');
  assert.equal(cr1.ioName, IO_A);
});

// ══════════════════ 封板保護 ══════════════════

test('封板: LI Time Fix（sf.startTime/sf.endTime）は変更されない', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /compareYoutubeLiTime\(sf\.startTime\|\|\s*''/);
  assert.match(html, /compareYoutubeLiTime\(sf\.endTime\|\|\s*''/);
  assert.doesNotMatch(html, /compareYoutubeLiTime\(sf\.daypart/);
});

test('封板: CR Optional Schema Fix（sentinel -1）は変更されない', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /longHeadline:-1,\s*description:-1,\s*companion:-1/);
});

test('封板: Sales merged-cell Fix（salesMergeAnchors/readMergedAwareCell）は変更されない', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /const salesMergeAnchors=new Map\(\);/);
  assert.match(html, /readMergedAwareCell/);
});
