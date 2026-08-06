// Amazon DSP PVA/OTT Audience names セグメントシート双向比較テスト
// 検証: checkFn（Audience names）— 設定表 = ダウンロード の双向比較
//      ・設定表 ⊂ ダウンロード でも一致としない
//      ・Include/Exclude を ID 構造で分離して別々に比較
//      ・名称等価判定は _segmentNamesEquivalent を双方共通に使用
// 対象: amazon_dsp_check.html
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

// ── テストヘルパー ──
function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('_readSegmentSheetDynamic'));
  assert.ok(source, 'amazon_dsp_check application script should be present');

  const exportBlock = '\n' +
'window.__amazonTestApi = {\n' +
'  _readSegmentSheetDynamic: typeof _readSegmentSheetDynamic === "function" ? _readSegmentSheetDynamic : undefined,\n' +
'  getAudienceNamesCheckFn: function(){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === "Audience names") : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  _segmentNamesEquivalent: typeof _segmentNamesEquivalent === "function" ? _segmentNamesEquivalent : undefined,\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');

  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

const api = loadAmazonApi();
const checkFn = api.getAudienceNamesCheckFn();
assert.equal(typeof checkFn, 'function', 'Audience names checkFn should be exported');

// ── テストデータ作成（実ファイル キュレル セグメントシート相当） ──
const G1 = ['Demo - Intimate Merger: Female', 'Demo - AudienceOne: Gender - F'];   // 組1 (Include)
const G2 = ['Demo - AudienceOne: Age 18-19', 'Demo - AudienceOne: Age 20-21',
            'Demo - AudienceOne: Age 22-29', 'Demo - AudienceOne: Age 30-34',
            'Demo - AudienceOne: Age 35-39'];                                       // 組2 (Include)
const G3 = ['LS - Beauty Fans', 'IM - Beauty products', 'LS - Beauty Products Purchaser']; // 組3 (Include)

function makeSegSheet(groups, liName) {
  return {
    audience: 'セグメントシート参照',
    __LI_NAME__: liName || 'TEST-LI',
    __SEGMENT_SHEET__: { groups: groups.map(g => ({ type: g.type, segments: g.segments })) },
  };
}
function makeDl(ar, at) {
  return { 'Audiences - include': ar, 'Audience names': at };
}
// 名前リスト → "名前 (ID); ..." 形式
function namesAt(names, startId) {
  return names.map((n, i) => `${n} (${startId + i})`).join('; ');
}
// ID 集合 → "(id1; id2)(id3)" Include 構造
function arInclude(idSets) { return idSets.map(ids => `(${ids.join('; ')})`).join(''); }
// ID 集合 → "[NOT id1; id2]" Exclude 構造
function arExclude(idSets) { return idSets.map(ids => `[NOT ${ids.join('; ')}]`).join(''); }

let idSeed = 40000;
function idFor(names) { return names.map((_, i) => String(idSeed + i)); }

// ═══════════════════════════════════════════
test('API: checkFn がエクスポートされる', () => {
  assert.equal(typeof api._segmentNamesEquivalent, 'function');
});

// ═══════════════════════════════════════════
// Case 1: 設定表とダウンロードが完全一致 → true
// ═══════════════════════════════════════════
test('Case 1: 完全一致 → true', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Include', segments: G2 },
    { type: 'Include', segments: G3 },
  ]);
  const all = [...G1, ...G2, ...G3];
  const ids = idFor(all);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 7), ids.slice(7, 10)]),
    namesAt(all, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, true, JSON.stringify(s.__audience_diff__));
  assert.equal(s.__audience_diff__, undefined);
});

// ═══════════════════════════════════════════
// Case 2: 設定表から1個のInclude Segmentを削除 → false
// ═══════════════════════════════════════════
test('Case 2: 設定表からIncludeを1個削除 → false（ダウンロードに多い方も検出）', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: [G1[0]] },  // G1[1] を削除
    { type: 'Include', segments: G2 },
    { type: 'Include', segments: G3 },
  ]);
  const all = [...G1, ...G2, ...G3];
  const ids = idFor(all);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 7), ids.slice(7, 10)]),
    namesAt(all, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false, '削除後は不一致');
  assert.ok(s.__audience_diff__.includes('【Include：ダウンロードにあるが設定表にない】'),
    'ダウンロード側に多いSegmentが明示される\n' + s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes(G1[1]), '削除されたSegment名が表示される');
});

// ═══════════════════════════════════════════
// Case 3: 設定表から複数Include Segmentを削除（複数Groupに分散）→ false
// ═══════════════════════════════════════════
test('Case 3: 複数Groupから複数削除 → false（削除分すべて表示）', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: [G1[0]] },               // G1[1] 削除
    { type: 'Include', segments: [G2[0], G2[2]] },        // G2 から3個削除
    { type: 'Include', segments: [G3[0]] },               // G3 から2個削除
  ]);
  const all = [...G1, ...G2, ...G3];
  const ids = idFor(all);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 7), ids.slice(7, 10)]),
    namesAt(all, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false);
  for (const removed of [G1[1], G2[1], G2[3], G2[4], G3[1], G3[2]]) {
    assert.ok(s.__audience_diff__.includes(removed), `削除分「${removed}」が表示される\n${s.__audience_diff__}`);
  }
});

// ═══════════════════════════════════════════
// Case 4: ダウンロード側がIncludeを1個欠落 → false
// ═══════════════════════════════════════════
test('Case 4: ダウンロード側がIncludeを1個欠落 → false', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Include', segments: G2 },
    { type: 'Include', segments: G3 },
  ]);
  const dlNames = [...G1, ...G2.slice(0, 4), ...G3];  // G2[4] 欠落
  const ids = idFor([...G1, ...G2, ...G3]);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 7), ids.slice(7, 10)]),  // ID構造は元のまま
    namesAt(dlNames, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false);
  assert.ok(s.__audience_diff__.includes('【Include：設定表にあるがダウンロードにない】'), s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes(G2[4]), '欠落名が表示される');
});

// ═══════════════════════════════════════════
// Case 5: Excludeグループで設定表から1個削除 → false
// ═══════════════════════════════════════════
test('Case 5: Excludeで設定表から1個削除 → false', () => {
  const exG1 = ['Ex - Demo - Intimate Merger: Female', 'Ex - Demo - AudienceOne: Gender - F'];
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Exclude', segments: [exG1[0]] },  // exG1[1] を削除
  ]);
  const all = [...G1, ...exG1];
  const ids = idFor(all);
  const dl = makeDl(
    arInclude([ids.slice(0, 2)]) + arExclude([ids.slice(2, 4)]),
    namesAt(all, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false);
  assert.ok(s.__audience_diff__.includes('【Exclude：ダウンロードにあるが設定表にない】'), s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes(exG1[1]));
});

// ═══════════════════════════════════════════
// Case 6: Excludeグループでダウンロード側が1個欠落 → false
// ═══════════════════════════════════════════
test('Case 6: Excludeでダウンロード側が1個欠落 → false', () => {
  const exG1 = ['Ex - Demo - Intimate Merger: Female', 'Ex - Demo - AudienceOne: Gender - F'];
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Exclude', segments: exG1 },
  ]);
  const all = [...G1, ...exG1];
  const ids = idFor(all);
  const dl = makeDl(
    arInclude([ids.slice(0, 2)]) + arExclude([ids.slice(2, 3)]),  // Exclude 2個目欠落（ID構造にも反映）
    namesAt([...G1, exG1[0]], idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false);
  assert.ok(s.__audience_diff__.includes('【Exclude：設定表にあるがダウンロードにない】'), s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes(exG1[1]));
});

// ═══════════════════════════════════════════
// Case 7: Group数量が同じでも内容が違う → false
// ═══════════════════════════════════════════
test('Case 7: グループ数が同じでも内容が違えば → false', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Include', segments: G2 },
  ]);
  // ダウンロード側も2グループだが、中身が異なる
  const d1 = ['Demo - AudienceOne: Gender - F', 'Demo - AudienceOne: Age 45-49'];
  const d2 = ['Demo - AudienceOne: Age 18-19', 'Demo - AudienceOne: Age 20-21'];
  const ids = idFor([...d1, ...d2]);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 4)]),
    namesAt([...d1, ...d2], idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false, 'Group数一致でも内容不一致なら false');
  assert.ok(s.__audience_diff__.includes('【Include：設定表にあるがダウンロードにない】') ||
            s.__audience_diff__.includes('【Include：ダウンロードにあるが設定表にない】'));
});

// ═══════════════════════════════════════════
// Case 8: Group数量が違う＆内容も違う → 数量差と名称差の両方を表示
// ═══════════════════════════════════════════
test('Case 8: グループ数も内容も違う → 数量差と名称差を両方表示', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Include', segments: G2 },
    { type: 'Include', segments: G3 },
  ]);
  const d1 = [...G1, ...G2.slice(0, 3)];
  const ids = idFor(d1);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 5)]),  // 2グループ
    namesAt(d1, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false);
  assert.ok(s.__audience_diff__.includes('【参考】Includeグループ数が異なります'), '数量差が表示される\n' + s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes('【Include：設定表にあるがダウンロードにない】'), '名称差が表示される');
});

// ═══════════════════════════════════════════
// Case 9: 順序が違うだけで内容同じ → true
// ═══════════════════════════════════════════
test('Case 9: 順序が違うだけで内容が同じ → true', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Include', segments: G2 },
  ]);
  const all = [...G1, ...G2];
  const rev = [...all].reverse();
  const ids = idFor(all);
  const dl = makeDl(
    arInclude([ids.slice(0, 2), ids.slice(2, 7)]),
    namesAt(rev, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, true, JSON.stringify(s.__audience_diff__));
});

// ═══════════════════════════════════════════
// Case 10: 同一Audienceがダウンロード側に重複 → 重複で誤報しない
// ═══════════════════════════════════════════
test('Case 10: ダウンロード側の重複は誤報にならない', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: G1 },
    { type: 'Include', segments: G2 },
  ]);
  const all = [...G1, ...G2];
  // 同じ名前が2回（別IDで）出現（同じグループ内の重複）
  const dupNames = [...all, G2[1]];
  const ids = idFor(all);
  const dupIds = [...ids.slice(0, 2), ...ids.slice(2, 7), ids[3]];
  const dl = makeDl(
    arInclude([dupIds.slice(0, 2), dupIds.slice(2, 8)]), // 2グループのまま（2番目に重複を含む）
    namesAt(dupNames, idSeed)
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, true, '重複は Set で正規化されるため誤報しない\n' + s.__audience_diff__);
});

// ═══════════════════════════════════════════
// Case 11: Demo/Demographic/AudienceOne 表記差異 → 正常にマッチ
// ═══════════════════════════════════════════
test('Case 11: Demo/Demographic/AudienceOne 表記差異はマッチする', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: ['Demographic > Age > AudienceOne: Age 20-21'] },
  ]);
  const dl = makeDl(
    arInclude([['90001']]),
    'Demo - AudienceOne: Age 20-21 (90001)'
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, true, JSON.stringify(s.__audience_diff__));

  // Intimate Merger 系の表記差異
  const s2 = makeSegSheet([
    { type: 'Include', segments: ['Demo - Intimate Merger: Female'] },
  ]);
  const dl2 = makeDl(
    arInclude([['90002']]),
    'Demographic: Intimate Merger - Female (90002)'
  );
  const r2 = checkFn(s2, dl2['Audience names'], dl2);
  assert.equal(r2, true, JSON.stringify(s2.__audience_diff__));
});

// ═══════════════════════════════════════════
// Case 12: 設定表=A,B / DL=A,B,C → 絶対に一致としない（回帰）
// ═══════════════════════════════════════════
test('Case 12: 設定表=A,B / DL=A,B,C → false かつ C を明示', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: ['SegA', 'SegB'] },
  ]);
  const dl = makeDl(
    arInclude([['50001', '50002', '50003']]),
    'SegA (50001); SegB (50002); SegC (50003)'
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false, '子集判定で一致してはいけない');
  assert.ok(s.__audience_diff__.includes('【Include：ダウンロードにあるが設定表にない】'), s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes('SegC'), '「SegC」が表示される');
});

// ═══════════════════════════════════════════
// Case 13: 設定表=A,B,C / DL=A,B → false かつ C を明示
// ═══════════════════════════════════════════
test('Case 13: 設定表=A,B,C / DL=A,B → false かつ C を明示', () => {
  const s = makeSegSheet([
    { type: 'Include', segments: ['SegA', 'SegB', 'SegC'] },
  ]);
  const dl = makeDl(
    arInclude([['50001', '50002']]),
    'SegA (50001); SegB (50002)'
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, false, 'DLが不足していても一致してはいけない');
  assert.ok(s.__audience_diff__.includes('【Include：設定表にあるがダウンロードにない】'), s.__audience_diff__);
  assert.ok(s.__audience_diff__.includes('SegC'), '「SegC」が表示される');
});

// ═══════════════════════════════════════════
// Case 14: Include/Exclude に同名が存在しても串組しない
// ═══════════════════════════════════════════
test('Case 14: Include/Exclude 同名でも串組しない', () => {
  // 同名「Shared Name」が Include と Exclude の両方にある
  const s = makeSegSheet([
    { type: 'Include', segments: ['Shared Name', 'IM - A'] },
    { type: 'Exclude', segments: ['Shared Name', 'Ex - B'] },
  ]);
  // 両側に同名がある → 一致
  const dl = makeDl(
    arInclude([['60001', '60002']]) + arExclude([['60003', '60004']]),
    'Shared Name (60001); IM - A (60002); Shared Name (60003); Ex - B (60004)'
  );
  const r = checkFn(s, dl['Audience names'], dl);
  assert.equal(r, true, '同名が両側にある場合は一致\n' + s.__audience_diff__);

  // Include 側の同名が欠落 → 他方の同名で補完してはいけない
  const s2 = makeSegSheet([
    { type: 'Include', segments: ['Shared Name', 'IM - A'] },
    { type: 'Exclude', segments: ['Shared Name', 'Ex - B'] },
  ]);
  const dl2 = makeDl(
    arInclude([['60001']]) + arExclude([['60003', '60004']]),   // Include の Shared Name 欠落
    'IM - A (60001); Shared Name (60003); Ex - B (60004)'
  );
  const r2 = checkFn(s2, dl2['Audience names'], dl2);
  assert.equal(r2, false, 'Exclude側の同名でInclude側を補完してはいけない');
  assert.ok(s2.__audience_diff__.includes('【Include：設定表にあるがダウンロードにない】'), s2.__audience_diff__);
  assert.ok(s2.__audience_diff__.includes('Shared Name'));
});
