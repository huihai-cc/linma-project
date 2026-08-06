// 真实文件复测（Audience names 双向比較）
// 使用方法:
//   node tests/amazon_dsp_real_file.verify.js [設定表.xlsx] [BulkSheetExport.xlsx]
//   引数なし: あらかじめ実ファイルから抽出済みの tests/pva_testdata_0805.json を使う
//   引数あり: 実ファイルを直接読む（内部で python + openpyxl により JSON 化）
//
// 検証シナリオ:
//   1. 原設定表 vs 一致ダウンロードデータ → true
//   2. 設定表から Group1/Group2/Group3 を各1個以上削除（ダウンロードはそのまま）→ false
//      ＋「ダウンロードにあるが設定表にない」に削除分が明示される
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

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
  const exportBlock = '\n' +
'window.__amazonTestApi = {\n' +
'  _readSegmentSheetDynamic: typeof _readSegmentSheetDynamic === "function" ? _readSegmentSheetDynamic : undefined,\n' +
'  _readAreaSheetFromRows: typeof _readAreaSheetFromRows === "function" ? _readAreaSheetFromRows : undefined,\n' +
'  findAreaSheetForLI: typeof findAreaSheetForLI === "function" ? findAreaSheetForLI : undefined,\n' +
'  getAudienceNamesCheckFn: function(){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === "Audience names") : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  getLocationCheckFn: function(key){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === key) : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  getColumnCheckFn: function(key){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === key) : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  auditVideoFieldCoverage: typeof auditVideoFieldCoverage === "function" ? auditVideoFieldCoverage : undefined,\n' +
'  getRegistry: function(){ return { setting: VIDEO_SETTING_FIELD_REGISTRY, ignoreS: VIDEO_SETTING_FIELD_IGNORE_RULES, ignoreD: VIDEO_DOWNLOAD_FIELD_IGNORE_RULES }; },\n' +
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

// xlsx → JSON（python + openpyxl 経由）
// ※ Windows のコマンドラインは日本語ファイル名の渡しが不安定なため、
//    パスは環境変数 PVA_VERIFY_FILE 経由で渡す
function xlsxToJson(filePath) {
  const script = `
import openpyxl, json, os
wb = openpyxl.load_workbook(os.environ['PVA_VERIFY_FILE'], data_only=True)
out = {}
for n in wb.sheetnames:
    if ('セグメント' in n or 'エリア' in n) and '空' not in n:
        ws = wb[n]
        rows = []
        for row in ws.iter_rows():
            vals = ['' if c.value is None else str(c.value) for c in row]
            if any(v.strip() for v in vals): rows.append(vals)
        out[n] = rows
if 'DISPLAY LINE ITEMS' in wb.sheetnames:
    ws = wb['DISPLAY LINE ITEMS']
    rows = []
    for row in ws.iter_rows(max_col=60):
        vals = ['' if c.value is None else str(c.value) for c in row]
        rows.append(vals)
    out['__BULK__'] = rows
print(json.dumps(out, ensure_ascii=False))
`;
  const res = spawnSync('py', ['-W', 'ignore', '-c', script],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PVA_VERIFY_FILE: filePath, PYTHONIOENCODING: 'utf-8' } });
  if (res.status !== 0) {
    console.error('python 実行失敗:', (res.stderr || '').slice(0, 500));
    process.exit(1);
  }
  return JSON.parse(res.stdout);
}

const api = loadAmazonApi();
const checkFn = api.getAudienceNamesCheckFn();
const parseSeg = api._readSegmentSheetDynamic;

const args = process.argv.slice(2);
let data;
if (args.length >= 1) {
  console.log(`📂 設定表: ${args[0]}`);
  const parsed = xlsxToJson(args[0]);
  data = { [path.basename(args[0])]: parsed };
  if (args.length >= 2) console.log(`📂 ダウンロード: ${args[1]}`);
} else {
  const jsonPath = path.join(__dirname, 'pva_testdata_0805.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('pva_testdata_0805.json がありません。実ファイルを引数で指定するか、JSON を生成してください。');
    process.exit(1);
  }
  data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const keys = Object.keys(data);
  console.log(`📂 抽出済み実データ（${keys.length}ファイル）から検証`);
}

// ── セグメントシート解析（実ファイル） ──
const segSheets = [];
for (const [key, v] of Object.entries(data)) {
  for (const [sheetName, rows] of Object.entries(v)) {
    if (sheetName === '__BULK__') continue;
    const seg = parseSeg(rows);
    if (seg.groups.length > 0) segSheets.push({ key, sheetName, seg });
  }
}
if (segSheets.length === 0) { console.error('セグメントシートを解析できませんでした'); process.exit(1); }

// 実ファイルから「ダウンロード相当」のデータを探す
function findBulkData() {
  for (const v of Object.values(data)) {
    if (!v.__BULK__) continue;
    const rows = v.__BULK__;
    const hdr = rows[0] || [];
    const iAr = hdr.indexOf('Audiences - include');
    const iAt = hdr.indexOf('Audience names');
    if (iAr < 0 || iAt < 0) continue;
    const dataRows = rows.slice(1).filter(r => String(r[iAt] || '').trim());
    if (dataRows.length > 0) {
      return { ar: String(dataRows[0][iAr] || ''), at: String(dataRows[0][iAt] || '') };
    }
  }
  return null;
}
const bulk = findBulkData();
if (bulk) console.log('📥 実ダウンロードファイルにデータ行あり → 直接比較に使用');
else console.log('📥 実ダウンロードファイルは空テンプレート（データ行なし）→ 設定表から一致データを構築して検証');

// ── 検証 ──
let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}\n${detail || ''}`); }
}

for (const { key, sheetName, seg } of segSheets) {
  console.log(`\n══════════ ${key} / ${sheetName} ══════════`);

  const includeGroups = seg.groups.filter(g => g.type === 'Include');
  const excludeGroups = seg.groups.filter(g => g.type === 'Exclude');
  console.log(`  設定表: Include ${includeGroups.length}組 / Exclude ${excludeGroups.length}組`);

  // ダウンロード側データ構築（一致版）
  const allInc = [...new Set(includeGroups.flatMap(g => g.segments))];
  const allExc = [...new Set(excludeGroups.flatMap(g => g.segments))];
  let ar = '', at = '';
  let id = 100001;
  const idMap = new Map();
  const assign = (name) => {
    if (!idMap.has(name)) idMap.set(name, String(id++));
    return idMap.get(name);
  };
  if (bulk) { ar = bulk.ar; at = bulk.at; }
  else {
    const incIds = allInc.map(assign);
    const excIds = allExc.map(assign);
    const incGroupsStr = includeGroups.map(g => `(${g.segments.map(assign).join('; ')})`).join('');
    const excGroupsStr = excludeGroups.map(g => `[NOT ${g.segments.map(assign).join('; ')}]`).join('');
    ar = incGroupsStr + excGroupsStr;
    at = [...allInc, ...allExc].map(n => `${n} (${assign(n)})`).join('; ');
  }

  const dlRow = { 'Audiences - include': ar, 'Audience names': at };
  const makeS = (groups) => ({
    audience: 'セグメントシート参照',
    __LI_NAME__: 'LI-TEST',
    __SEGMENT_SHEET__: { groups: groups.map(g => ({ type: g.type, segments: g.segments })) },
  });

  // シナリオ1: 原設定表（一致）→ true
  const r1 = checkFn(makeS(seg.groups), dlRow['Audience names'], dlRow);
  ok(r1 === true, `シナリオ1: 原設定表 vs 一致ダウンロード → true`, JSON.stringify(makeS(seg.groups).__audience_diff__));

  // シナリオ2: Group1/2/3 から各1個削除（ダウンロード不変）→ false
  const modifiedGroups = seg.groups.map((g, gi) => ({
    type: g.type,
    segments: g.segments.length > 1 ? g.segments.slice(0, -1) : g.segments, // 各組から最後の1個を削除
  }));
  // 実際に削除された名前（各組1個以上）
  const removedNames = [];
  seg.groups.forEach((g, gi) => {
    if (g.segments.length > 1) removedNames.push(g.segments[g.segments.length - 1]);
  });
  const s2 = makeS(modifiedGroups);
  const r2 = checkFn(s2, dlRow['Audience names'], dlRow);
  ok(r2 === false, `シナリオ2: 各Groupから${removedNames.length}個削除 → false`, JSON.stringify(s2.__audience_diff__));
  if (r2 === false) {
    ok(s2.__audience_diff__.includes('【Include：ダウンロードにあるが設定表にない】'),
      `差異に「Include：ダウンロードにあるが設定表にない」が明示される`, s2.__audience_diff__);
    const allRemovedShown = removedNames.every(n => s2.__audience_diff__.includes(n));
    ok(allRemovedShown, `削除分 ${removedNames.length} 個すべてが名前表示される`, `削除: ${removedNames.join(' / ')}\n${s2.__audience_diff__}`);
  }
}

// ── エリアシート 実ファイル検証（熊本県 除外ケース） ──
const checkTargeting = api.getLocationCheckFn('Location targeting 1 of 2');
const checkExcluding = api.getLocationCheckFn('Location excluding 1 of 2');

for (const [key, v] of Object.entries(data)) {
  for (const [sheetName, rows] of Object.entries(v)) {
    if (!sheetName.includes('エリア')) continue;
    const area = api._readAreaSheetFromRows(rows);
    console.log(`\n══════════ ${key} / ${sheetName} ══════════`);
    console.log(`  targeted=${JSON.stringify(area.targeted)} excluded=${JSON.stringify(area.excluded)}`);

    const makeS = (extra) => ({
      __LI_NAME__: 'PVA_Curel_Face_SummerCP_18',
      __SYSTEM__: 'amazon_pva',
      deal_type: '',
      location: '別紙エリアシート参照',
      __AREA_SHEET__: area,
      __AREA_SHEET_NAME__: sheetName,
      __AREA_SHEET_DEBUG__: sheetName,
      __AREA_SHEET_AMBIGUOUS__: false,
      ...(extra || {}),
    });

    // シナリオA: エリアシートの実内容に沿った一致検証
    //   （DL側もエリアシートの内容と一致させた場合 → 両列とも 一致/null）
    const sA = makeS();
    const dlTgtA = area.targeted.map(a => `PREFECTURE:${a.replace(/\s*Prefecture\s*$/i, '')}, JP`).join('; ');
    const dlExcA = area.excluded.map(a => `PREFECTURE:${a.replace(/\s*Prefecture\s*$/i, '')}, JP`).join('; ');
    const rTgtA = checkTargeting(sA, dlTgtA);
    const rExcA = checkExcluding(sA, dlExcA);
    ok(area.targeted.length > 0
        ? rTgtA === true
        : rTgtA === null,
      `配信地域（含む）: targeted=${area.targeted.length} → ${area.targeted.length > 0 ? '一致' : 'チェック対象外'}`, JSON.stringify(sA.__location_diff__));
    ok(area.excluded.length > 0
        ? rExcA === true
        : rExcA === null,
      `除外地域: excluded=${area.excluded.length} → ${area.excluded.length > 0 ? '一致' : 'チェック対象外'}`, JSON.stringify(sA.__location_excl_diff__));

    // シナリオB: DLに福岡が多出 → 不一致（excluded がある場合のみ）
    if (area.excluded.length > 0) {
      const sB = makeS();
      const dlExcB = dlExcA ? dlExcA + '; PREFECTURE:Fukuoka, JP' : 'PREFECTURE:Fukuoka, JP';
      const rExcB = checkExcluding(sB, dlExcB);
      ok(rExcB === false, `DL除外に福岡が多出 → 不一致`, JSON.stringify(sB.__location_excl_diff__));
      if (rExcB === false) {
        ok(sB.__location_excl_diff__.includes('【除外地域：ダウンロードにあるがエリアシートにない】')
          && sB.__location_excl_diff__.includes('Fukuoka'),
          `差異に「DLにあるがエリアシートにない：Fukuoka」が明示される`, sB.__location_excl_diff__);
      }
    }

    // シナリオC: DL除外に1個欠落 → 不一致
    if (area.excluded.length >= 2) {
      const sC = makeS();
      const rest = area.excluded.slice(1).map(a => `PREFECTURE:${a.replace(/\s*Prefecture\s*$/i, '')}, JP`).join('; ');
      const rExcC = checkExcluding(sC, rest);
      ok(rExcC === false, `DL除外に1個欠落 → 不一致`, JSON.stringify(sC.__location_excl_diff__));
      if (rExcC === false) {
        ok(sC.__location_excl_diff__.includes(area.excluded[0]),
          `欠落分「${area.excluded[0]}」が明示される`, sC.__location_excl_diff__);
      }
    }

    // 本案（03 キュレル）の特別検証: 除外「熊本県」 vs PREFECTURE:Kumamoto, JP
    if (area.excluded.some(a => a.includes('Kumamoto')) && area.targeted.length === 0) {
      const sK = makeS();
      const rTgtK = checkTargeting(sK, '');
      const rExcK = checkExcluding(sK, 'PREFECTURE:Kumamoto, JP');
      ok(rTgtK === null, `本案: 配信地域（含む）チェック対象外`, JSON.stringify(sK.__location_diff__));
      ok(rExcK === true, `本案: 除外「熊本県」 vs PREFECTURE:Kumamoto, JP → 一致`, JSON.stringify(sK.__location_excl_diff__));
    }
  }
}

// 多エリアシート（02 谷川建設）の一意特定
for (const [key, v] of Object.entries(data)) {
  const areaSheets = Object.entries(v)
    .filter(([n]) => n.includes('エリア'))
    .map(([name, rows]) => ({ name, data: api._readAreaSheetFromRows(rows) }));
  if (areaSheets.length >= 2) {
    const ln = 'PVA_テストLI';
    const res = api.findAreaSheetForLI(areaSheets, ln, '別紙エリアシート参照');
    ok(res.data === null && res.ambiguous === true,
      `多エリアシート（${areaSheets.length}枚）でLI名が一致しない → 判定不可（先頭を使わない）`, res.debug);
    const res2 = api.findAreaSheetForLI(areaSheets, 'LI_hiroshima', '別紙エリアシート参照');
    ok(res2.ambiguous === false && res2.name.includes('hiroshima'),
      `LI名「LI_hiroshima」→ エリアシート（LI_hiroshima）が一意に採用される`, res2.name);
  }
}

// ── Frequency 実ファイル検証（zenrosai ケース） ──
const checkFreq = api.getColumnCheckFn('Frequency Caps');
for (const [key, v] of Object.entries(data)) {
  // 設定表側: 主設定シートから Frequency 列を抽出（シンプルに LI 名 + Frequency のペアは
  // ここでは確認せず、checkFn 単体で「設定値 vs DL値」の判定を検証する）
  if (key.includes('zenrosai')) {
    const s = { __LI_NAME__: 'PVA_PD_insurance_15s', __SYSTEM__: 'amazon_pva', deal_type: '', frequency: '1回/22日' };
    const dlRow = { 'Line name*': 'PVA_PD_insurance_15s', 'Frequency Caps': '' };
    const r = checkFreq(s, dlRow['Frequency Caps']);
    ok(r === false, `Frequency: 設定「1回/22日」 vs DL空 → 不一致(false)`, JSON.stringify(r));
    // 等価ケース
    const r2 = checkFreq(s, '[User, 1, 22, Days]');
    ok(r2 === true, `Frequency: 設定「1回/22日」 vs [User,1,22,Days] → 一致(true)`);
    // DLに値が有るが設定空
    const r3 = checkFreq({ ...s, frequency: '' }, 'FrequencyCap1:[User, 1, 22, Days]');
    ok(r3 === false, `Frequency: 設定空 vs DL有 → 不一致(false)`);
  }
}

// ── デフォルト値判定（zenrosai 実データ） ──
{
  const checkCtx = api.getColumnCheckFn('Target Categories using only contextual signals?');
  const checkMobile = api.getColumnCheckFn('Mobile app targeting - include or exclude');
  const checkDtz = api.getColumnCheckFn('Daypart targeting timezone');
  const s = {
    __LI_NAME__: 'PVA_PD_insurance_15s', __SYSTEM__: 'amazon_pva', deal_type: '',
    timezone: "Account's time zone", daypart: '指定なし（ALL）',
  };
  // VIDEO LINE ITEMS 実データ: col35=Yes / col71=Exclude / col56(daypart tz)=空
  const rCtx = checkCtx(s, 'Yes');
  const rMob = checkMobile(s, 'Exclude');
  const rDtz = checkDtz(s, '');
  ok(rCtx === true, `コンテキストシグナルのみ使用: DL「Yes」→ 一致(true)`);
  ok(rMob === true, `モバイルアプリターゲティング: DL「Exclude」→ 一致(true)`);
  ok(rDtz === true, `デイパート時間帯: 設定「Account's time zone」＋DL空 → 一致(true)`);
  // 未登録項目に含まれない
  const w = api.auditVideoFieldCoverage(s, { 'Line name*': 'PVA_PD_insurance_15s', 'Target Categories using only contextual signals?': 'Yes', 'Mobile app targeting - include or exclude': 'Exclude' });
  ok(w.length === 0, `未登録項目に含まれない（${w.length}件）`, JSON.stringify(w));
}

// ── 双向フィールドカバレッジ監査（実ファイル発見リスト） ──
console.log('\n══════════ カバレッジ監査（実ファイル） ══════════');
const registry = api.getRegistry();
const dlKeysSet = new Set((typeof api.getColumnKeys !== 'undefined' ? [] : []));
const foundSetting = new Map();   // field -> [values]
const foundDownload = new Map();  // field -> [values]
for (const [key, v] of Object.entries(data)) {
  if (v.__VIDEO_BULK__) {
    const rows = v.__VIDEO_BULK__;
    const hdr = rows[0] || [];
    for (let ri = 2; ri < rows.length; ri++) {   // テンプレート指示行(1)をスキップ
      const dlRow = {};
      hdr.forEach((h, ci) => { if (h) dlRow[h] = rows[ri][ci] || ''; });
      dlRow.__FILE_D__ = key;
      const w = api.auditVideoFieldCoverage({ __LI_NAME__: 'LI' }, dlRow);
      for (const item of w) {
        if (item.side !== 'download') continue;
        if (!foundDownload.has(item.field)) foundDownload.set(item.field, new Set());
        foundDownload.get(item.field).add(item.value);
      }
    }
  }
  for (const [sheetName, rows] of Object.entries(v)) {
    if (sheetName.startsWith('__')) continue;
    if (!sheetName.includes('設定シート') && !sheetName.startsWith('PVA設定') && sheetName !== 'PVA設定シート ') continue;
    // 簡易：sRow を直接作れないため、設定表側の監査は代表的なフィールドで確認
  }
}
console.log('【ダウンロード側 未カバー発見リスト】（人工確認待ち）:');
if (foundDownload.size === 0) console.log('  （なし）');
for (const [field, values] of [...foundDownload.entries()].sort()) {
  console.log(`  ⚠️ ${field} → 値例: ${[...values].slice(0, 3).join(' / ')}`);
}

// 設定表側：実データ（zenrosai）の代表フィールドで監査
const settingSample = {
  __LI_NAME__: 'PVA_PD_insurance_15s', __IO_NAME__: 'IO', __SYSTEM__: 'amazon_pva',
  frequency: '1回/22日',
  video_format: 'In-stream only',   // 実値あり（未登録フィールド）
  video_size: 'Any',                // テンプレート既定値
  video_comp: 'No targeting',       // テンプレート既定値
  language: 'チェック無し',          // テンプレート既定値
  twitch: 'Twitchなし',             // テンプレート既定値
  daypart: '指定なし（ALL）',
  mobile_env: 'ALL',
  content: 'MPデフォルト除外',
};
const settingWarnings = api.auditVideoFieldCoverage(settingSample, {});
console.log('【設定表側 未カバー発見リスト】（人工確認待ち）:');
if (settingWarnings.length === 0) console.log('  （なし）');
for (const w of settingWarnings) {
  console.log(`  ⚠️ ${w.label}（値: ${w.value}）→ ${w.reason}`);
}

console.log(`\n===== 結果: pass=${pass} / fail=${fail} =====`);
process.exit(fail > 0 ? 1 : 0);
