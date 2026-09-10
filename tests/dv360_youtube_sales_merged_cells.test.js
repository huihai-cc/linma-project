// YouTube 営業・業推記入用シート merged-cell 读取测试（2026-09-10 Merged-Cell Fix）
//
// 背景: 同一 IO 配下の複数 LI 行で、IO名/開始日/開始時間/終了日/終了時間などの IO 級セルが
// Excel の縦結合（merged cells）になるケースがある（実案件: サクセスSUPERGT Ver8 等）。
// sheet_to_json(header:1) は結合範囲の左上セルにしか値を出力しないため、
// 2 行目以降は空文字となり、LI2 の startTime='' → 開始時間 00:00 誤表示 / endTime='' →
// 終了時間がデフォルト 23:59 で「見かけ上正常」（false normal）となる。
//
// 修正: worksheet の !merges に基づく merge-aware accessor。
//   - 現在セルに値があればそれを返す
//   - 空かつ座標が実在する結合範囲内 → 左上セルの値を返す
//   - 空かつ結合範囲外 → '' （真正空白は決して伝播しない）
//
// 本テストは合成データで自完結する。実案件（016 サクセスSUPERGT）検証は別途手動実施。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML_PATH = path.join(__dirname, '..', 'dv360_check.html');

function stripNoise(code) {
  let out = '', i = 0, n = code.length, state = 'code';
  while (i < n) {
    const c = code[i], c2 = code.slice(i, i + 2);
    if (state === 'code') {
      if (c2 === '//') { state = 'line'; i += 2; continue; }
      if (c2 === '/*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'squote'; out += ' '; i++; continue; }
      if (c === '"') { state = 'dquote'; out += ' '; i++; continue; }
      if (c === '`') { state = 'template'; out += ' '; i++; continue; }
      out += c; i++;
    } else if (state === 'line') { if (c === '\n') { state = 'code'; out += '\n'; } i++; }
    else if (state === 'block') { if (c2 === '*/') { state = 'code'; i += 2; continue; } if (c === '\n') out += '\n'; i++; }
    else if (state === 'squote' || state === 'dquote') { if (c === '\\') { i += 2; continue; } if (c === (state === 'squote' ? "'" : '"') || c === '\n') state = 'code'; i++; }
    else if (state === 'template') { if (c === '\\') { i += 2; continue; } if (c === '`') { state = 'code'; i++; continue; } i++; }
  }
  return out;
}

function extractFunction(lines, name) {
  const startRe = new RegExp('^(?:const|let|var)\\s+' + name + '\\s*=|function\\s+' + name + '\\s*\\(');
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) {
      let depth = 0, started = false;
      const buf = [];
      for (let j = i; j < lines.length; j++) {
        buf.push(lines[j]);
        for (const ch of stripNoise(lines[j])) {
          if (ch === '{') { depth++; started = true; }
          else if (ch === '}') depth--;
        }
        if (started && depth === 0) return buf.join('\n');
      }
    }
  }
  throw new Error('function not found: ' + name);
}

function loadParser() {
  const lines = fs.readFileSync(HTML_PATH, 'utf8').split(/\r?\n/);
  const ctx = { console: { log() {}, warn() {}, error() {} }, XLSX: {} };
  vm.createContext(ctx);
  const loaded = new Set(), failed = new Set();
  const load = name => {
    if (loaded.has(name)) return true;
    if (failed.has(name)) return false;
    try { vm.runInContext(extractFunction(lines, name), ctx, { filename: name + '.js' }); loaded.add(name); return true; }
    catch (e) { failed.add(name); return false; }
  };
  ['normStr', 'normDate', 'fmtDateVal', 'excelSerialToUtcDateParts', 'normVideoType',
    'isSameAsIo', 'extractYoutubeAudienceSheetReferences', 'normalizeYoutubeAudienceSheetName',
    'extractYoutubeVideoId', 'normNum'].forEach(load);
  load('parseYoutubeSetting');
  return {
    parse: (sheets, worksheets) => {
      const sheetNames = Object.keys(sheets);
      for (let round = 0; round < 80; round++) {
        try { return ctx.parseYoutubeSetting(sheets, sheetNames, 'test.xlsx', worksheets || {}); }
        catch (e) {
          const m = String(e.message || '').match(/^(\w+) is not defined$/);
          if (m && load(m[1])) continue;
          throw e;
        }
      }
      throw new Error('auto-dep rounds exhausted');
    },
  };
}

// ── 合成データ構築 ──
const SALES = '記入欄_営業・業推記入用';
const OP = '※運用者用※設定シート';
const IO_A = 'IO_A_TestCase';
const IO_B = 'IO_B_TestCase';

function mkRow(pairs) { const r = []; for (const [i, v] of pairs) r[i] = v; return r; }

// 営業 header（2 層構造を再現: row6=大項目 / row7=日・時間サブ列）
function salesHeaderRows() {
  const h6 = mkRow([[0, '＃'], [1, 'ファネル'], [2, 'J.No'], [3, '配信目的'], [4, 'IO名'], [5, 'セグメント内容'], [6, '動画タイプ'], [14, '開始・終了\n時間指定有無'], [15, '開始日・時間'], [17, '終了日・時間'], [19, '課金形態'], [55, '使用する入稿物管理表']]);
  const h7 = mkRow([[15, '日'], [16, '時間'], [17, '日'], [18, '時間']]);
  return [h6, h7];
}

function salesDataRows(rowsSpec) {
  // rowsSpec: [{idx:'1', io, seg, videoType, timeSpec, startDate, startTime, endDate, endTime, materialSheet}]
  return rowsSpec.map(s => mkRow([
    [0, s.idx], [4, s.io], [5, s.seg], [6, s.videoType || 'VRC（スキップ可）'],
    [14, s.timeSpec], [15, s.startDate], [16, s.startTime], [17, s.endDate], [18, s.endTime],
    [55, s.materialSheet || '入稿物管理表（VRC・VVC・VRC(FQ))'],
  ]));
}

// 運用者用 header（実テンプレートの col 配置を再現）
function opHeaderRow() {
  return mkRow([[1, 'NO'], [2, 'IO名'], [3, 'IOタイプ'], [4, '目標'], [5, '全体予算'], [6, '98%'], [9, '開始日・時間'], [11, '終了日・時間'], [13, 'ペース'], [16, 'KPI'], [18, '最適化'], [19, 'IOのFQ'], [20, 'マージン'], [21, '品質'], [22, '備考欄有無'], [23, '広告申込情報名'], [24, 'タイプ'], [27, '言語'], [28, '地域'], [29, '曜日・日時'], [30, '広告枠ソース'], [33, '掲載期間'], [36, '日予算管理'], [37, '予算ペース'], [38, '日予算'], [52, '広告グループ名'], [62, '性別'], [64, '年齢']]);
}
function opDataRows(specs) {
  return specs.map((s, i) => mkRow([
    [1, String(i + 1)], [2, s.io], [3, 'スタンダード'], [4, 'ブランドの知名度'], [5, '¥250,000'], [6, '¥245,000'],
    [9, 'Thursday, September 10, 2026'], [10, s.startTime || '10:00'], [11, 'Wednesday, September 30, 2026'], [12, s.endTime || '23:59'],
    [13, '掲載期間'], [14, '均等'], [23, s.liName], [24, 'ブランド認知度とリーチ'], [27, 'Japanese'], [28, 'Japan（国名）'],
    [29, '2026/9/10(木)10:00～2026/9/30(水)23:59'], [30, 'Youtube'], [33, s.liPeriod !== undefined ? s.liPeriod : '広告掲載オーダーと同じ日付を使用'],
    [36, '日次'], [37, '均等'], [38, '¥11,666'], [52, 'GP_' + s.liName], [64, '18～34'],
  ]));
}
function buildOpSheet(specs) {
  const rows = new Array(23).fill(null).map(() => []);
  rows[1] = mkRow([[1, 'キャンペーン名'], [3, 'TestCase_Campaign']]);
  rows[2] = mkRow([[1, '全体目標'], [3, '認知']]);
  rows[23] = opHeaderRow();
  opDataRows(specs).forEach((r, i) => { rows[24 + i] = r; });
  return rows;
}

function buildSheets(salesRows, opSpecs) {
  return {
    [SALES]: salesRows,
    [OP]: buildOpSheet(opSpecs),
  };
}
function merge(sr, sc, er, ec) { return { s: { r: sr, c: sc }, e: { r: er, c: ec } }; }

const MERGE_COLS = [4, 15, 16, 17, 18]; // IO名 / 開始日 / 開始時間 / 終了日 / 終了時間

function findLi(result, name) { return result.liList.find(li => li.name === name); }
function findLiBySeg(result, seg) { return result.liList.find(li => li.fields.segmentName === seg); }

// ══════════════════ 主ケース: 同一 IO 下 LI1/LI2 全 IO 級字段縦結合 ══════════════════
// Excel 視覚: LI1 = IO_A / 2026/8/18 / 10:00 / 2026/8/23 / 23:59
//            LI2 = IO_A / 2026/8/18 / 10:00 / 2026/8/23 / 23:59（結合セル表示）
// sheet_to_json: LI2 行の該当セルはすべて ''
function buildMainCase() {
  const [h6, h7] = salesHeaderRows();
  const data = salesDataRows([
    { idx: '1', io: IO_A, seg: 'SEG_A1', timeSpec: 'あり', startDate: '2026/8/18(aaa)', startTime: '10:00', endDate: '2026/8/23(aaa)', endTime: '23:59' },
    { idx: '2', io: '', seg: 'SEG_A2', timeSpec: 'あり', startDate: '', startTime: '', endDate: '', endTime: '' },
  ]);
  const salesRows = [[], [], [], [], [], h6, h7, [], data[0], data[1]];
  const worksheets = { [SALES]: { '!merges': MERGE_COLS.map(c => merge(8, c, 9, c)) } };
  const sheets = buildSheets(salesRows, [
    { io: IO_A, liName: 'LI_A1_TestCase_SEG_A1', liPeriod: '' },
    { io: IO_A, liName: 'LI_A2_TestCase_SEG_A2', liPeriod: '' },
  ]);
  return { sheets, worksheets };
}

// 主ケースでは liPeriod を空にし、startDate/endDate が followsIo 既定経路ではなく
// merge-aware の元日付セル（col15/col17）を読む経路を通るようにする。
// （liPeriod='広告掲載オーダーと同じ日付を使用' の場合、startDate は liPeriod を優先する
// 　既存業務ロジックが働き merge 経路が検証できないため）

test('主ケース: LI2 の merged IO級セル（IO名/開始日/開始時間/終了日/終了時間）が左上値で解決される', () => {
  const { parse } = loadParser();
  const { sheets, worksheets } = buildMainCase();
  const result = parse(sheets, worksheets);
  assert.equal(result.liList.length, 2, 'LI 2 行');

  const li1 = findLiBySeg(result, 'SEG_A1');
  const li2 = findLiBySeg(result, 'SEG_A2');
  assert.ok(li1 && li2, '両 LI 存在');

  // LI1（merge 左上）は従来通り
  assert.equal(li1.fields.startTime, '10:00');
  assert.equal(li1.fields.endTime, '23:59');
  assert.equal(li1.ioName, IO_A);
  // fmtDateVal は '2026/8/18(aaa)' を '2026/8/18' に正規化する（既存動作）
  assert.equal(li1.fields.startDate, '2026/8/18');

  // LI2（merged continuation）は左上値で解決される — RED では '' になり失敗する
  assert.equal(li2.fields.startTime, '10:00', 'LI2 startTime は merge 左上値 10:00');
  assert.equal(li2.fields.endTime, '23:59', 'LI2 endTime は merge 左上値 23:59（デフォルト値による見かけ正常でなく実値）');
  assert.equal(li2.ioName, IO_A, 'LI2 effective IO は merge 左上 IO_A');
  assert.equal(li2.fields.startDate, '2026/8/18', 'LI2 startDate は merge 左上値（LI1 と同一）');
  assert.equal(li2.fields.endDate, '2026/8/23', 'LI2 endDate は merge 左上値（LI1 と同一）');
});

test('主ケース: LI2 が ALL_IO_FALLBACK なしで IO_A に限定マッチする', () => {
  // 営業 row2 の IO セルは merged 空。merge-aware により salesIOName=IO_A となり
  // candidateGroups は IO_A 単独に限定される（全 IO fallback 不発生）。
  // opDetail は IO_A 側の正式 LI 名（LI_A2_TestCase_SEG_A2）でなければならない。
  const { parse } = loadParser();
  const { sheets, worksheets } = buildMainCase();
  const result = parse(sheets, worksheets);
  const li2 = result.liList.find(li => li.name.includes('SEG_A2'));
  assert.ok(li2, 'LI2 存在');
  assert.equal(li2.name, 'LI_A2_TestCase_SEG_A2', 'primaryLIName は運用者用正式名');
  assert.equal(li2.ioName, IO_A, 'primaryIOName は IO_A');
});

test('主ケース GUI: LI2 開始/終了時間比較がともに ok（旧コードでは開始 00:00 mismatch）', () => {
  const { parse } = loadParser();
  const { sheets, worksheets } = buildMainCase();
  const result = parse(sheets, worksheets);
  const li2 = findLiBySeg(result, 'SEG_A2');

  // compareYoutubeLiTime を本番 HTML から抽出して GUI 比較を再現
  const lines = fs.readFileSync(HTML_PATH, 'utf8').split(/\r?\n/);
  const timeCtx = { console: { log() {} } };
  vm.createContext(timeCtx);
  const fns = ['excelSerialToUtcDateParts', 'normStr', 'normDate', 'normNum', 'slotToTime',
    'parseDaypartTargeting', 'parseSettingDaypart', 'compareYoutubeLiTime', 'normalizeSimpleTime',
    'isPeriodLongerThanSevenDays', 'compareField'];
  vm.runInContext(fns.map(n => extractFunction(lines, n)).join('\n\n'), timeCtx, { filename: 'time.js' });

  const opts = { startDate: '2026-08-18', endDate: '2026-08-23' }; // 6 日間 → 7日ルール非対象
  const start = timeCtx.compareYoutubeLiTime(li2.fields.startTime || '', '304096', false, opts);
  const end = timeCtx.compareYoutubeLiTime(li2.fields.endTime || '', '304096', true, opts);
  assert.deepEqual({ s: start.sVal, d: start.dVal, r: start.result }, { s: '10:00', d: '10:00', r: 'ok' });
  assert.deepEqual({ s: end.sVal, d: end.dVal, r: end.result }, { s: '23:59', d: '23:59', r: 'ok' });
});

// ══════════════════ N1: 真正空白は伝播しない ══════════════════
test('N1: LI2 startTime が結合なしの真正空白 → LI1 の 10:00 を継承しない', () => {
  const { parse } = loadParser();
  const [h6, h7] = salesHeaderRows();
  const data = salesDataRows([
    { idx: '1', io: IO_A, seg: 'SEG_A1', timeSpec: 'あり', startDate: '2026/8/18(aaa)', startTime: '10:00', endDate: '2026/8/23(aaa)', endTime: '23:59' },
    { idx: '2', io: '', seg: 'SEG_A2', timeSpec: 'あり', startDate: '', startTime: '', endDate: '', endTime: '' },
  ]);
  const salesRows = [[], [], [], [], [], h6, h7, [], data[0], data[1]];
  // IO名/開始日/終了日/終了時間のみ結合。開始時間(col16)は結合なし → 真正空白
  const worksheets = { [SALES]: { '!merges': [4, 15, 17, 18].map(c => merge(8, c, 9, c)) } };
  const sheets = buildSheets(salesRows, [
    { io: IO_A, liName: 'LI_A1_TestCase_SEG_A1' },
    { io: IO_A, liName: 'LI_A2_TestCase_SEG_A2' },
  ]);
  const result = parse(sheets, worksheets);
  const li2 = findLiBySeg(result, 'SEG_A2');
  assert.equal(li2.fields.startTime, '', '結合なし真正空白は空のまま（10:00 を継承しない）');
  assert.equal(li2.fields.endTime, '23:59', '終了時間は結合されているので左上値で解決');
  assert.equal(li2.ioName, IO_A, 'IO名は結合されているので左上値で解決');
});

// ══════════════════ N2: 次の IO 境界 ══════════════════
test('N2: IO_A の merge 値が後続 IO_B 行に伝播しない', () => {
  const { parse } = loadParser();
  const [h6, h7] = salesHeaderRows();
  const data = salesDataRows([
    { idx: '1', io: IO_A, seg: 'SEG_A1', timeSpec: 'あり', startDate: '2026/8/18(aaa)', startTime: '10:00', endDate: '2026/8/23(aaa)', endTime: '23:59' },
    { idx: '2', io: '', seg: 'SEG_A2', timeSpec: 'あり', startDate: '', startTime: '', endDate: '', endTime: '' },
    { idx: '3', io: IO_B, seg: 'SEG_B1', timeSpec: 'なし', startDate: '', startTime: '', endDate: '', endTime: '' },
  ]);
  const salesRows = [[], [], [], [], [], h6, h7, [], data[0], data[1], data[2]];
  // IO_A の結合は rows 8-9 のみ。row10 (IO_B) は範囲外。
  const worksheets = { [SALES]: { '!merges': MERGE_COLS.map(c => merge(8, c, 9, c)) } };
  const sheets = buildSheets(salesRows, [
    { io: IO_A, liName: 'LI_A1_TestCase_SEG_A1' },
    { io: IO_A, liName: 'LI_A2_TestCase_SEG_A2' },
    { io: IO_B, liName: 'LI_B1_TestCase_SEG_B1' },
  ]);
  const result = parse(sheets, worksheets);
  assert.equal(result.liList.length, 3, 'LI 3 行');
  const li3 = findLiBySeg(result, 'SEG_B1');
  assert.ok(li3, 'IO_B の LI 存在');
  assert.equal(li3.ioName, IO_B, 'IO_B 行の IO名は自身の値（merge 範囲外）');
  assert.equal(li3.fields.startTime, '', 'IO_B の開始時間は真正空白 → IO_A の 10:00 を継承しない');
  assert.equal(li3.fields.endTime, '', 'IO_B の終了時間も空のまま');
  const li2 = findLiBySeg(result, 'SEG_A2');
  assert.equal(li2.fields.startTime, '10:00', 'LI2 は引き続き merge 左上値');
});

// ══════════════════ N3: 跨 IO 同名 SEG — ALL_IO_FALLBACK 誤結合防止 ══════════════════
test('N3: 跨 IO に同名 SEG が存在しても merged continuation は元 IO に限定マッチする', () => {
  const { parse } = loadParser();
  const [h6, h7] = salesHeaderRows();
  const data = salesDataRows([
    { idx: '1', io: IO_A, seg: 'SEG_A1', timeSpec: 'あり', startDate: '2026/8/18(aaa)', startTime: '10:00', endDate: '2026/8/23(aaa)', endTime: '23:59' },
    { idx: '2', io: '', seg: 'SEG_A2', timeSpec: 'あり', startDate: '', startTime: '', endDate: '', endTime: '' },
  ]);
  const salesRows = [[], [], [], [], [], h6, h7, [], data[0], data[1]];
  const worksheets = { [SALES]: { '!merges': MERGE_COLS.map(c => merge(8, c, 9, c)) } };
  // 運用者用シートでは IO_B を先に定義（ioMap 順序で IO_B が先頭）。
  // IO_B 側に SEG_A2 と同一名の LI（同名長の正式名）が存在する。
  const sheets = buildSheets(salesRows, [
    { io: IO_B, liName: 'LI_B1_TestCase_SEG_A2' },
    { io: IO_A, liName: 'LI_A1_TestCase_SEG_A1' },
    { io: IO_A, liName: 'LI_A2_TestCase_SEG_A2' },
  ]);
  const result = parse(sheets, worksheets);
  const li2 = findLiBySeg(result, 'SEG_A2');
  assert.ok(li2, 'LI2 存在');
  // 旧コード（ALL_IO_FALLBACK）では score 同点・index 若い IO_B 側 LI_B1_TestCase_SEG_A2 に誤結合。
  assert.equal(li2.name, 'LI_A2_TestCase_SEG_A2', 'SEG_A2 は IO_A 側の正式 LI にマッチ');
  assert.equal(li2.ioName, IO_A, '誤って IO_B に掛からない');
});

// ══════════════════ 降級防御: worksheets 未提供 ══════════════════
test('worksheets に !merges がない場合は従来動作（空のまま）でクラッシュしない', () => {
  const { parse } = loadParser();
  const { sheets } = buildMainCase();
  const result = parse(sheets, {}); // worksheets 空
  const li2 = findLiBySeg(result, 'SEG_A2');
  assert.ok(li2, 'LI2 存在（クラッシュしない）');
  // merges 情報がないため merged セルは空のまま（従来動作への降級）
  assert.equal(li2.fields.startTime, '', 'merges なし → 空文字のまま');
});

// ══════════════════ 封板保護（リグレッションガード） ══════════════════
test('封板保護: LI Time Fix（sf.startTime/sf.endTime 主データソース）は変更されない', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /compareYoutubeLiTime\(sf\.startTime\|\|\s*''/);
  assert.match(html, /compareYoutubeLiTime\(sf\.endTime\|\|\s*''/);
  assert.doesNotMatch(html, /compareYoutubeLiTime\(sf\.daypart/);
});

test('封板保護: CR Optional Schema Fix（sentinel -1）は変更されない', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /longHeadline:-1,\s*description:-1,\s*companion:-1/);
  assert.match(html, /readOptionalColumn/);
});
