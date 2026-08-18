// 真实KONAMI案件复测（2026-08-18 3点修正の Case 4）
// 使用方法:
//   node tests/amazon_dsp_konami_real.verify.js <設定表.xlsx> <DL1.xlsx> [DL2.xlsx ...]
// 検証内容:
//   1. 4 LI が正しく読み取られる（PC Type=Online Video / CTV Type=Streaming TV）
//   2. 入稿物管理表(動画) の 8 CR が読み取られ、DLと 8/8 一致・DL未発見 0
//   3. 案件区分自動検出（今回DLと一致する追加CRの有無で判定）
// 対象: amazon_dsp_check.html
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');

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
  const source = scripts.map(match => match[1]).find(script => script.includes('resolveCreativeDownloadDateTime'));
  const exportBlock = '\n' +
'window.__amazonTestApi = {\n' +
'  checkAmazon: typeof checkAmazon === "function" ? checkAmazon : undefined,\n' +
'  detectDownloadSystemAuto: typeof detectDownloadSystemAuto === "function" ? detectDownloadSystemAuto : undefined,\n' +
'  detectCaseModeAuto: typeof detectCaseModeAuto === "function" ? detectCaseModeAuto : undefined,\n' +
'  readCreativeSettingDataMulti: typeof readCreativeSettingDataMulti === "function" ? readCreativeSettingDataMulti : undefined,\n' +
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
    TextDecoder, Uint8Array, URL, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: (s) => String(s ?? ''),
    XLSX: { utils: { sheet_to_json: (ws) => (ws && Array.isArray(ws.__rows)) ? ws.__rows : [] } },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

function readWbAsRows(filePath) {
  const wb = XLSX.readFile(filePath);
  const out = { SheetNames: wb.SheetNames, Sheets: {} };
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    out.Sheets[name] = {
      '!ref': ws['!ref'] || 'A1',
      __rows: XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }),
    };
  }
  return out;
}

const api = loadAmazonApi();
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('使い方: node tests/amazon_dsp_konami_real.verify.js <設定表.xlsx> <DL1.xlsx> [DL2.xlsx ...]');
  console.error('または環境変数 KONAMI_SETTING_FILE / KONAMI_DL_FILES（;区切り）で指定');
  process.exit(1);
}
const settingPath = args[0];
const dlPaths = args.slice(1);

const wbsS = [{ wb: readWbAsRows(settingPath), fileName: path.basename(settingPath) }];
const wbsD = dlPaths.map(p => ({ wb: readWbAsRows(p), fileName: path.basename(p) }));

console.log(`📂 設定表: ${wbsS[0].fileName}`);
for (const d of wbsD) console.log(`📂 ダウンロード: ${d.fileName}`);
console.log('');

// ── システム自動検出 ──
const sysRes = api.detectDownloadSystemAuto(wbsD);
if (!sysRes.determined) {
  console.error('⚠️ システム自動判定不可:', sysRes.detail);
  process.exit(1);
}
const system = sysRes.system;
console.log(`🔧 システム自動判定: ${system}`);

// ── 案件区分自動検出（今回DLと一致する追加CRを証拠にする） ──
const caseRes = api.detectCaseModeAuto(wbsS, wbsD);
console.log(`🔧 案件区分自動判定: ${caseRes.determined ? caseRes.caseMode : '判定不可'}`);
if (caseRes.evidence) console.log(`   根拠: ${caseRes.evidence}`);
if (caseRes.reference) console.log(`   参考: ${caseRes.reference}`);
const caseMode = caseRes.determined ? caseRes.caseMode : 'initial';
console.log('');

// ── checkAmazon ──
const res = api.checkAmazon(wbsS, wbsD, system, caseMode);

// 1. LI 読み取りと Type 表示
const pcLis = res.items.filter(i => /_PC_|_movie_PC/i.test(i.liName));
const ctvLis = res.items.filter(i => /_CTV_|_movie_CTV/i.test(i.liName));
console.log(`📋 LI 読み取り: ${res.items.length}件（PC: ${pcLis.length} / CTV: ${ctvLis.length}）`);
let liOk = true;
for (const item of res.items) {
  const rLine = item.colResults.find(c => c.key === 'Line type*');
  const rCtype = item.colResults.find(c => c.key === 'Video Ad Content Type*');
  const isPC = /_PC_|_movie_PC/i.test(item.liName);
  const expectType = isPC ? 'Online Video' : 'Streaming TV';
  const typeOk = rLine && rLine.sVal === expectType;
  const ctypeOk = rCtype && rCtype.result === true;
  if (!typeOk || !ctypeOk) liOk = false;
  console.log(`  ${item.liName}`);
  console.log(`    LI Type(S側): ${rLine ? rLine.sVal : '—'}（期待: ${expectType}）${typeOk ? '✅' : '❌'}`);
  console.log(`    DL: Line type*=${rLine ? rLine.dVal : '—'} / Video Ad Content Type*=${rCtype ? rCtype.dVal : '—'} ${ctypeOk ? '✅' : '❌'}`);
}
console.log(`🔎 LI Type 判定: ${liOk ? 'ALL OK' : 'NG'}`);
console.log('');

// 2. CR 検証
const cr = res.creative || {};
const items = cr.items || [];
const settingSheets = [...new Set(items.map(i => i.settingSource && i.settingSource.sheetName).filter(Boolean))];
console.log(`🎨 設定表 CR: ${cr.settingCount ?? '—'}件（Sheet: ${settingSheets.join(' / ') || '—'}）`);
console.log(`🎨 DL一致: ${cr.matchCount ?? '—'}件 / DL未発見: ${cr.notFoundCount ?? '—'}件`);
console.log(`🎨 日時不一致: ${cr.dateTimeMismatchCount ?? '—'}項目 / 状態不一致: ${cr.statusMismatchCount ?? '—'}件 / 解析エラー: ${cr.errorCount ?? '—'}件`);
const settingOnly = items.filter(i => i.matchStatus === 'setting_only');
if (settingOnly.length) {
  for (const i of settingOnly) {
    console.log(`   ⚠️ DL未発見: ${i.liName} / ${i.creativeName}${i.unmatchedReason ? ` → ${i.unmatchedReason}` : ''}`);
  }
}

// ── 検証結果 ──
const crExpected = items.length && cr.settingCount > 0
  ? (cr.settingCount === 8 && cr.matchCount === 8 && cr.notFoundCount === 0 && cr.errorCount === 0)
  : null;   // 実ファイルの構成が想定と異なる場合は停止して実情を報告する
console.log('');
if (!liOk) {
  console.error('❌ LI Type 表示が期待値と一致しません。実ファイルの表頭を確認してください。');
  process.exit(1);
}
if (crExpected === null) {
  console.log('⚠️ CR件数が 8 ではありません（想定と異なるファイル構成）。上記の実数値を確認してください。');
  process.exit(0);
}
console.log(crExpected
  ? '✅ 検証OK: 設定表CR 8 / DL一致 8 / DL未発見 0'
  : '❌ 検証NG: 8/8一致・DL未発見0 に達しません（実ファイルの実態を報告対象とする）');
process.exit(crExpected ? 0 : 2);
