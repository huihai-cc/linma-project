// Amazon DSP Creative 配信日時チェック — 空白CR日時の「LIに準ずる」継承・自動判定テスト
// 検証:
//   1. ダウンロードCRの Start Date/End Date 空白 → 対応ダウンロードLIの日時を継承（LIに準ずる）
//   2. 空白CR＋ダウンロードLI欠落 → 明確な解析エラー
//   3. CR日時が直接指定されている場合 → 従来どおりCR日時で比較
//   4. 秒・ミリ秒付きのCR日時（MM-DD-YYYY-HH-MM[-SS[.SSS]]）を分単位で比較
//   5. 96件CRで「空白を解析できない」エラーが発生しない
//   6. DISPLAY LINE ITEMS → amazon_dsp 自動判定
//   7. 案件区分（ステータス＝追加 → creative_addition / なし → initial / 表頭不足 → 判定しない）
//   8. PVA/OTT/Display のLI比較に回帰がない
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
    closest() { return null; }, cloneNode() { return this; }, dataset: {}, disabled: false,
    files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

const elements = new Map();
const document = {
  body: createElement(), documentElement: createElement(),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  },
  addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
};

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('resolveCreativeDownloadDateTime'));
  assert.ok(source, 'amazon_dsp_check application script should be present');

  const exportBlock = '\n' +
'window.__amazonTestApi = {\n' +
'  checkAmazon: typeof checkAmazon === "function" ? checkAmazon : undefined,\n' +
'  compareCreativeData: typeof compareCreativeData === "function" ? compareCreativeData : undefined,\n' +
'  parseCreativeDownloadDateTime: typeof parseCreativeDownloadDateTime === "function" ? parseCreativeDownloadDateTime : undefined,\n' +
'  resolveCreativeDownloadDateTime: typeof resolveCreativeDownloadDateTime === "function" ? resolveCreativeDownloadDateTime : undefined,\n' +
'  readCreativeDownloadDataMulti: typeof readCreativeDownloadDataMulti === "function" ? readCreativeDownloadDataMulti : undefined,\n' +
'  readCreativeSettingDataMulti: typeof readCreativeSettingDataMulti === "function" ? readCreativeSettingDataMulti : undefined,\n' +
'  readDownloadDataDSPMulti: typeof readDownloadDataDSPMulti === "function" ? readDownloadDataDSPMulti : undefined,\n' +
'  readDownloadDataVideoMulti: typeof readDownloadDataVideoMulti === "function" ? readDownloadDataVideoMulti : undefined,\n' +
'  detectDownloadSystemAuto: typeof detectDownloadSystemAuto === "function" ? detectDownloadSystemAuto : undefined,\n' +
'  detectCaseModeAuto: typeof detectCaseModeAuto === "function" ? detectCaseModeAuto : undefined,\n' +
'  autoDetectAndApply: typeof autoDetectAndApply === "function" ? autoDetectAndApply : undefined,\n' +
'  renderCreativeResultSection: typeof renderCreativeResultSection === "function" ? renderCreativeResultSection : undefined,\n' +
'  normalizeCreativeName: typeof normalizeCreativeName === "function" ? normalizeCreativeName : undefined,\n' +
'  audienceNameEquals: typeof audienceNameEquals === "function" ? audienceNameEquals : undefined,\n' +
'  parseAudienceS: typeof parseAudienceS === "function" ? parseAudienceS : undefined,\n' +
'  parseAudienceD: typeof parseAudienceD === "function" ? parseAudienceD : undefined,\n' +
'  compareAudience: typeof compareAudience === "function" ? compareAudience : undefined,\n' +
'  getEffectiveAmazonSystem: typeof getEffectiveAmazonSystem === "function" ? getEffectiveAmazonSystem : undefined,\n' +
'  getScSystem: function(){ return scSystem; },\n' +
'  getScDetectedSystem: function(){ return scDetectedSystem; },\n' +
'  getScCaseMode: function(){ return scCaseMode; },\n' +
'  setScSystem: function(v){ scSystem = v; },\n' +
'  setScWbs: function(s, d){ scWbsS = s; scWbsD = d; },\n' +
'  setManualFlags: function(sys, mode){ scSystemManual = !!sys; scCaseModeManual = !!mode; },\n' +
'  refreshSystemSelectionUI: typeof refreshSystemSelectionUI === "function" ? refreshSystemSelectionUI : undefined,\n' +
'  resetSettingCheck: typeof resetSettingCheck === "function" ? resetSettingCheck : undefined,\n' +
'};\n';
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');

  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: (s) => String(s ?? ''),
    // テスト用：ws.__rows をそのまま行配列として返す（XLSX.utils.sheet_to_json 相当）
    XLSX: { utils: { sheet_to_json: (ws) => (ws && Array.isArray(ws.__rows)) ? ws.__rows : [] } },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonTestApi;
}

const api = loadAmazonApi();

// ── データビルダー ──
function makeWb(sheets) {
  const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
  for (const [name, rows] of Object.entries(sheets)) {
    wb.Sheets[name] = { '!ref': 'A1', __rows: rows };
  }
  return wb;
}

// checkAmazon等は { wb, fileName } の配列を受け取る
function wrap(...wbs) {
  return wbs.map((wb, i) => ({ wb, fileName: `test_${i + 1}.xlsx` }));
}

// 設定表の「入稿物管理表」シート
function makeSettingCrSheet(crRows) {
  return makeWb({
    '入稿物管理表': [
      ['ラインアイテム名', '設定クリエイティブ名（自動入力）', '設定クリエイティブ名（変更した場合）',
       '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'],
      ...crRows,
    ],
  });
}

// 設定表のDSP主シート（LI設定値：LI_1）
function makeDspSettingSheet() {
  return makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Start time', 'End day', 'End time', 'Device', 'Active/Inactive'],
      ['LI_1', 'Display', '2026-08-20', '00:00', '2026-09-30', '23:59', 'All', 'ACTIVE'],
    ],
  });
}

// ダウンロード：DISPLAY LINE ITEMS（LI_1）＋ CREATIVE ASSOCIATIONS
function makeDspDownload(crRows, crStatus) {
  return makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Order name - (READ ONLY)',
       'Line start date', 'Line end date', 'Active/Inactive'],
      ['LI_1', 'Display', '', 'order1', '08-20-2026-00-00', '09-30-2026-23-59', 'ACTIVE'],
    ],
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      ...crRows,
    ],
  });
}

function makeCrRow(liName, crName, startDt, endDt, status) {
  return [liName, crName, startDt, endDt, status];
}

// 96件のCR（日時空白 → LIに準ずる継承を確認するための主ケース）
function make96BlankCrRows(status) {
  const rows = [];
  for (let i = 1; i <= 96; i++) {
    rows.push(makeCrRow('LI_1', `CR_${String(i).padStart(3, '0')}`, '', '', status));
  }
  return rows;
}

// ── 1. CR日時空白＋ダウンロードLI存在 → LIに準ずる継承（96件でエラーなし） ──
test('CR日時空白＋LI存在：96件すべて「LIに準ずる」継承でマッチし空白エラーが出ない', () => {
  const crRows = make96BlankCrRows('ACTIVE');
  const wbsS = wrap(makeSettingCrSheet(crRows.map(r => [r[0], r[1], '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''])), makeDspSettingSheet());
  const wbsD = wrap(makeDspDownload(crRows, 'ACTIVE'));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'initial');
  assert.ok(res.creative, 'creative 結果が生成される');
  assert.equal(res.creative.errorCount, 0, '解析エラーが0件');
  assert.equal(res.creative.matchCount, 96, '96件すべてマッチ');
  assert.equal(res.creative.downloadMatchedCount, 96, 'ダウンロードマッチ96件');
  assert.equal(res.creative.settingOnlyCount, 0);
  assert.equal(res.creative.downloadOnlyCount, 0);

  // 全フィールドが「LIに準ずる」継承され、エラー文言に「空白」解析失敗が無い
  const blankErrors = [];
  for (const item of res.creative.items) {
    for (const key of ['startDate', 'startTime', 'endDate', 'endTime']) {
      const f = item.fields[key];
      assert.equal(f.downloadSource, 'LIに準ずる', `${item.creativeName} ${key} はLIに準ずる継承`);
      assert.ok(f.downloadRaw.startsWith('LIに準ずる（'), `${item.creativeName} ${key} raw=${f.downloadRaw}`);
      if (f.error && f.error.includes('空白')) blankErrors.push(f.error);
    }
  }
  assert.deepEqual(blankErrors, [], '「空白」を解析できないエラーが1件も無い');

  // 画面描画で「DL：LIに準ずる（2026-08-20）」形式が出る
  const html = api.renderCreativeResultSection(res.creative);
  assert.ok(html.includes('LIに準ずる（2026-08-20）'), 'DL側表示に継承元LIの実際日時が併記される');
  assert.ok(html.includes('LIに準ずる（00:00）'), 'DL側表示に継承元LIの実際時刻が併記される');
});

// ── 2. CR日時空白＋ダウンロードLI欠落 → 明確な解析エラー ──
test('CR日時空白＋LI欠落：明確な解析エラー', () => {
  // 設定表LIシートに LI_GHOST が存在するが、ダウンロードのDISPLAY LINE ITEMSに無いケース。
  // （2026-08-18 より入稿物管理表は「今回設定表LIに紐づくCRのみ」読み込むため、
  //   LI_GHOST を設定表LIシートにも登録しておく必要がある）
  const wbsS = wrap(
    makeSettingCrSheet([['LI_GHOST', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '']]),
    makeWb({
      '設定シート': [
        ['ラインアイテム名', 'Type', 'Start day', 'Start time', 'End day', 'End time', 'Device', 'Active/Inactive'],
        ['LI_GHOST', 'Display', '2026-08-20', '00:00', '2026-09-30', '23:59', 'All', 'ACTIVE'],
      ],
    }),
  );
  // CRはあるがDISPLAY LINE ITEMSにLI_GHOSTが無い
  const wbsD = wrap(makeDspDownload([makeCrRow('LI_GHOST', 'CR_001', '', '', 'ACTIVE')], 'ACTIVE'));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'initial');
  const item = res.creative.items.find(i => i.creativeName === 'CR_001');
  assert.ok(item, 'CR_001 の項目が存在する');
  assert.equal(item.matchStatus, 'error');
  const errText = Object.values(item.fields).map(f => f.error).filter(Boolean).join(' / ');
  assert.ok(errText.includes('対応するダウンロードLIが見つかりません'),
    `エラーに継承元LI欠落が明記される：${errText}`);
});

// ── 3. CR日時直接指定 → CR日時同士で比較（LIを継承しない） ──
test('CR日時が直接指定されている場合はCR日時で比較する', () => {
  // CR_A: 設定=DL 同値 → match / CR_B: 設定とDLが異なる → mismatch（LI日時は関係しない）
  const wbsS = wrap(
    makeSettingCrSheet([
      ['LI_1', 'CR_A', '', '2026/8/25', '10:30', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_B', '', '2026/8/25', '10:30', '2026/9/30', '23:59', ''],
    ]),
    makeDspSettingSheet(),
  );
  const wbsD = wrap(makeDspDownload([
    makeCrRow('LI_1', 'CR_A', '08-25-2026-10-30', '09-30-2026-23-59', 'ACTIVE'),
    makeCrRow('LI_1', 'CR_B', '08-26-2026-11-45', '09-30-2026-23-59', 'ACTIVE'),
  ], 'ACTIVE'));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'initial');
  const a = res.creative.items.find(i => i.creativeName === 'CR_A');
  const b = res.creative.items.find(i => i.creativeName === 'CR_B');

  assert.equal(a.matchStatus, 'match', 'CR_AはCR日時で一致（LI日時と異なっても誤判定しない）');
  assert.equal(a.fields.startDate.downloadSource, '', '直接指定のCRは継承ではない');
  assert.equal(a.fields.startDate.actual, '2026-08-25');
  assert.equal(b.matchStatus, 'mismatch', 'CR_BはCR日時の相違で不一致');
  assert.equal(b.fields.startDate.actual, '2026-08-26');
  assert.equal(res.creative.dateTimeMismatchCount, 2, '開始日＋開始時間の2項目');
});

// ── 4. 秒・ミリ秒付き日時の解析 ──
test('MM-DD-YYYY-HH-MM[-SS[.SSS]] 形式の解析（比較は分まで）', () => {
  const p = api.parseCreativeDownloadDateTime('08-20-2026-00-00-15');
  assert.deepEqual({ ok: p.ok, date: p.date, time: p.time }, { ok: true, date: '2026-08-20', time: '00:00' });

  const p2 = api.parseCreativeDownloadDateTime('08-20-2026-00-00-15.234');
  assert.deepEqual({ ok: p2.ok, date: p2.date, time: p2.time }, { ok: true, date: '2026-08-20', time: '00:00' });

  // 秒が59超／ミリ秒3桁超は不正
  assert.equal(api.parseCreativeDownloadDateTime('08-20-2026-00-00-60').ok, false);
  assert.equal(api.parseCreativeDownloadDateTime('08-20-2026-00-00-15.1234').ok, false);
  assert.equal(api.parseCreativeDownloadDateTime('08-20-2026-00-00').ok, true);
  assert.equal(api.parseCreativeDownloadDateTime('08-20-2026-00-00-00.999').ok, true);

  // 継承元LIの値に秒・ミリ秒が付いていても分単位で比較できる
  const liRow = { 'Line start date': '08-20-2026-00-00-15.500' };
  const r = api.resolveCreativeDownloadDateTime('', liRow, 'Line start date');
  assert.equal(r.ok, true);
  assert.equal(r.source, 'LIに準ずる');
  assert.equal(r.date, '2026-08-20');
  assert.equal(r.time, '00:00');
});

// ── 4b. 秒付きLI継承がcheckAmazon全体でも動く ──
test('LI継承値に秒・ミリ秒があっても96件マッチする', () => {
  const crRows = make96BlankCrRows('ACTIVE');
  const wbsS = wrap(makeSettingCrSheet(crRows.map(r => [r[0], r[1], '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''])), makeDspSettingSheet());
  const dl = makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Order name - (READ ONLY)',
       'Line start date', 'Line end date', 'Active/Inactive'],
      ['LI_1', 'Display', '', 'order1', '08-20-2026-00-00-15.500', '09-30-2026-23-59', 'ACTIVE'],
    ],
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      ...crRows,
    ],
  });
  const res = api.checkAmazon(wbsS, wrap(dl), 'amazon_dsp', 'initial');
  assert.equal(res.creative.errorCount, 0);
  assert.equal(res.creative.matchCount, 96);
});

// ── CR追加案件（creative_addition）でもLI継承が効く ──
test('creative_addition：LI比較はスキップしつつ、CR空白日時はLI継承でマッチ', () => {
  const crRows = make96BlankCrRows('INACTIVE');
  const wbsS = wrap(makeSettingCrSheet(crRows.map(r => [r[0], r[1], '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'])), makeDspSettingSheet());
  const wbsD = wrap(makeDspDownload(crRows, 'INACTIVE'));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'creative_addition');
  assert.equal(res.liSkipped, true, 'CR追加案件ではLI比較をスキップ');
  assert.equal(res.items.length, 0, 'LI比較結果は空');
  assert.ok(res.creative, 'creative結果は生成される');
  assert.equal(res.creative.errorCount, 0);
  assert.equal(res.creative.matchCount, 96, '96件すべてLI継承でマッチ');
  const item = res.creative.items[0];
  assert.equal(item.fields.startDate.downloadSource, 'LIに準ずる');
});

// ── 5. 設定表側「LIに準ずる」＋DL空白CRの両継承が同時に機能する ──
test('設定表側LIに準ずる＋DL側LIに準ずるの両方でマッチ', () => {
  const crRows = [
    // 設定表側は「LIに準ずる」表記（変更した場合列は空）、DL側は日時空白 → 双方LI日時を継承して一致
    ...make96BlankCrRows('ACTIVE').map(r => [r[0], r[1], '', 'LIに準ずる', 'LIに準ずる', 'LIに準ずる', 'LIに準ずる', 'ACTIVE']),
  ];
  const wbsS = wrap(makeSettingCrSheet(crRows), makeDspSettingSheet());
  const wbsD = wrap(makeDspDownload(make96BlankCrRows('ACTIVE'), 'ACTIVE'));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'initial');
  assert.equal(res.creative.errorCount, 0);
  assert.equal(res.creative.matchCount, 96);
  const item = res.creative.items[0];
  assert.equal(item.fields.startDate.source, 'LIに準ずる', '設定表側もLIに準ずる');
  assert.equal(item.fields.startDate.downloadSource, 'LIに準ずる', 'DL側もLIに準ずる');
});

// ── 6. 自動判定：チェック対象 ──
test('自動判定：DISPLAY LINE ITEMS → amazon_dsp', () => {
  const wbsD = wrap(makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Order name - (READ ONLY)'],
      ['LI_A', 'Display', '', 'order1'],
    ],
  }));
  const r = api.detectDownloadSystemAuto(wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.system, 'amazon_dsp');
});

test('自動判定：PVA特徴のみ → amazon_pva', () => {
  const wbsD = wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line name*', 'Line type*', 'Video Ad Content Type*', 'Supply source', 'Deal selection', 'Order name - (READ ONLY)'],
      ['PVA_LI_1', 'Video', 'STREAMING_TV', '', 'Prime Video ads:ABC', 'PVA(PD)_test_io'],
    ],
  }));
  const r = api.detectDownloadSystemAuto(wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.system, 'amazon_pva');
});

test('自動判定：OTT特徴のみ → amazon_ott', () => {
  const wbsD = wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line name*', 'Line type*', 'Video Ad Content Type*', 'Supply source', 'Deal selection', 'Order name - (READ ONLY)'],
      ['OTT_LI_1', 'Video', 'STREAMING_TV', 'TVer', '', 'OTT_test_io'],
    ],
  }));
  const r = api.detectDownloadSystemAuto(wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.system, 'amazon_ott');
});

test('自動判定：DisplayとVideoの混在は判定不可（上書きしない）', () => {
  const wbsD = wrap(makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source'],
      ['LI_A', 'Display', ''],
    ],
    'VIDEO LINE ITEMS': [
      ['Line name*', 'Line type*', 'Video Ad Content Type*', 'Supply source', 'Deal selection'],
      ['PVA_LI_1', 'Video', 'STREAMING_TV', '', 'Prime Video ads:ABC'],
    ],
  }));
  const r = api.detectDownloadSystemAuto(wbsD);
  assert.equal(r.determined, false);
  assert.ok(r.detail.includes('混在'), `混在理由が表示される：${r.detail}`);
});

// ── 7. 自動判定：案件区分 ──
test('自動判定：ステータス＝追加のCRがある → creative_addition（今回DLと一致する場合のみ）', () => {
  const wbsS = wrap(makeSettingCrSheet([
    ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
    ['LI_1', 'CR_002', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
  ]));
  // 今回DL（CREATIVE ASSOCIATIONS）に CR_001 が実在する → CR追加案件の証拠になる
  const wbsD = wrap(makeWb({
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      ['LI_1', 'CR_001', '', '', 'INACTIVE'],
    ],
  }));
  const r = api.detectCaseModeAuto(wbsS, wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.caseMode, 'creative_addition');
  assert.ok(r.evidence.includes('1件'), r.evidence);
});

test('自動判定：設定表に「追加」履歴があっても今回DL未一致なら初期案件のまま（自動確定しない）', () => {
  const wbsS = wrap(makeSettingCrSheet([
    ['LI_1', 'CR_OLD', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
  ]));
  // 今回DLに CR_OLD は存在しない（過去の追加履歴のみ）
  const wbsD = wrap(makeWb({
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      ['LI_1', 'CR_OTHER', '', '', 'INACTIVE'],
    ],
  }));
  const r = api.detectCaseModeAuto(wbsS, wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.caseMode, 'initial', 'DL未一致の追加履歴だけではCR追加案件にしない');
  assert.ok(r.reference.includes('追加'), r.reference);
});

test('自動判定：ステータス＝追加が無い → initial', () => {
  const wbsS = wrap(makeSettingCrSheet([
    ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
  ]));
  const r = api.detectCaseModeAuto(wbsS);
  assert.equal(r.determined, true);
  assert.equal(r.caseMode, 'initial');
});

test('自動判定：入稿物管理表が無い → 推測しない', () => {
  const wbsS = wrap(makeWb({ '設定シート': [['A', 'B']] }));
  const r = api.detectCaseModeAuto(wbsS);
  assert.equal(r.determined, false);
  assert.ok(r.detail.includes('入稿物管理表'), r.detail);
});

test('自動判定：ステータス表頭が無い → 推測しない', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表': [
      ['ラインアイテム名', '設定クリエイティブ名（自動入力）', '配信開始日', '配信開始時間', '配信停止日', '配信停止時間'],
      ['LI_1', 'CR_001', '2026/8/20', '0:00', '2026/9/30', '23:59'],
    ],
  }));
  const r = api.detectCaseModeAuto(wbsS);
  assert.equal(r.determined, false);
});

// ── 7b. autoDetectAndApply：自動検出モード維持・手動上書きしない・失敗時は開始しない ──
test('autoDetectAndApply：選択肢は「自動検出」のまま、判定値で「自動判定：Amazon DSP（Display）」表示', () => {
  api.resetSettingCheck();   // 案件区分ドロップダウンを初期状態（初期案件）に戻す
  api.setScSystem('auto');
  api.setManualFlags(false, false);
  const sysSel = document.getElementById('sc-system-select');
  sysSel.value = 'auto';
  const wbsS = wrap(makeSettingCrSheet([
    ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
  ]));
  const wbsD = wrap(makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source'],
      ['LI_1', 'Display', ''],
    ],
  }));
  api.setScWbs(wbsS, wbsD);
  const ok = api.autoDetectAndApply();
  assert.equal(ok, true, '判定成功でチェック開始可能');
  assert.equal(api.getScSystem(), 'auto', '選択肢は「自動検出」のまま変更しない');
  assert.equal(sysSel.value, 'auto', 'ドロップダウンを自動判定値に書き換えない');
  assert.equal(api.getScDetectedSystem(), 'amazon_dsp', '判定値は scDetectedSystem に保持');
  assert.equal(api.getEffectiveAmazonSystem(), 'amazon_dsp', '有効システムは判定値');
  assert.equal(api.getScCaseMode(), 'initial');
  const info = document.getElementById('sc-auto-detect-info');
  assert.ok(info, '自動判定情報要素が存在');
  assert.ok(info.textContent.startsWith('自動判定：Amazon DSP（Display）'), info.textContent);
  // 案件区分は自動で切り替えない（安全デフォルト＝初期案件）。検出結果は参考提示のみ。
  assert.ok(info.textContent.includes('参考：ステータス＝追加のCRなし'), info.textContent);
  assert.equal(document.getElementById('sc-case-mode-select').value, 'initial', 'ドロップダウンは初期案件のまま');
});

test('autoDetectAndApply：手動変更済みの項目は上書きしない', () => {
  // 直前のテストで判定された値を記録し、autoDetectAndApply後に変化しないことを検証する
  const sysBefore = api.getScSystem();
  const detectedBefore = api.getScDetectedSystem();
  const modeBefore = api.getScCaseMode();
  api.setManualFlags(true, true);   // ユーザーが手動選択済み
  const wbsS = wrap(makeSettingCrSheet([
    ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
  ]));
  const wbsD = wrap(makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source'],
      ['LI_1', 'Display', ''],
    ],
  }));
  api.setScWbs(wbsS, wbsD);
  const info = document.getElementById('sc-auto-detect-info');
  info.textContent = '';   // 前テストの残骸をクリア
  const ok = api.autoDetectAndApply();
  assert.equal(ok, true, '手動選択があればチェック開始可能');
  assert.equal(api.getScSystem(), sysBefore, '手動選択済みのチェック対象は上書きしない');
  assert.equal(api.getScDetectedSystem(), detectedBefore, '手動選択済みなら判定値も更新しない');
  assert.equal(api.getScCaseMode(), modeBefore, '手動選択済みの案件区分は上書きしない');
  assert.equal(info.textContent, '', '手動変更時は自動判定メッセージを出さない');
});

test('autoDetectAndApply：判定できない場合はチェックを開始せず手動選択を促す', () => {
  api.setScSystem('auto');
  api.setManualFlags(false, false);
  // チェック対象も案件区分も判定不能
  const wbsS = wrap(makeWb({ '入稿物管理表': [['A', 'B', 'C']] }));
  const wbsD = wrap(makeWb({ 'VIDEO LINE ITEMS': [['Line name*', 'Line type*']] }));
  api.setScWbs(wbsS, wbsD);
  const ok = api.autoDetectAndApply();
  assert.equal(ok, false, '判定失敗時はチェックを開始しない');
  assert.equal(api.getEffectiveAmazonSystem(), '', '有効なシステムは未確定');
  const info = document.getElementById('sc-auto-detect-info');
  assert.ok(info.textContent.startsWith('⚠️'), `警告が出る：${info.textContent}`);
  assert.ok(info.textContent.includes('自動判定できません'), info.textContent);
  assert.ok(info.textContent.includes('チェック対象を選択してください'), info.textContent);
});

// ── 7c. チェック対象の「自動検出」デフォルト（DV360スタイル）・手動・reset ──
test('初期状態：チェック対象は「自動検出」(auto) で判定値なし', () => {
  api.resetSettingCheck();
  assert.equal(api.getScSystem(), 'auto', 'デフォルトは自動検出');
  assert.equal(api.getScDetectedSystem(), '', '判定値は未設定');
  assert.equal(api.getEffectiveAmazonSystem(), '', '未判定なら有効システムは空');
  assert.equal(document.getElementById('sc-system-select').value, 'auto', 'ドロップダウンが「自動検出」に戻る');
});

test('手動でPVA選択後にDisplayファイルを再アップロードしても上書きされない', () => {
  api.setScSystem('amazon_pva');     // ユーザーが手動で PVA を選択
  api.setManualFlags(true, false);
  const wbsS = wrap(makeSettingCrSheet([
    ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
  ]));
  const wbsD = wrap(makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source'],
      ['LI_1', 'Display', ''],
    ],
  }));
  api.setScWbs(wbsS, wbsD);
  const ok = api.autoDetectAndApply();
  assert.equal(ok, true);
  assert.equal(api.getScSystem(), 'amazon_pva', '手動選択が保持される');
  assert.equal(api.getEffectiveAmazonSystem(), 'amazon_pva', '有効システムは手動選択値');
  assert.equal(api.getScDetectedSystem(), '', '自動判定は実行されない');
  // 手動選択の表示（changeハンドラ相当のUI更新）
  api.refreshSystemSelectionUI();
  const info = document.getElementById('sc-auto-detect-info');
  assert.equal(info.textContent, '手動選択：Amazon DSP（PVA）');
});

test('自動判定後に手動選択へ変更すると「手動選択」表示に切り替わり、自動検出に戻すと判定値表示', () => {
  // 自動判定済みの状態を作る
  api.setScSystem('auto');
  api.setManualFlags(false, false);
  api.setScWbs(
    wrap(makeSettingCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ])),
    wrap(makeWb({
      'DISPLAY LINE ITEMS': [
        ['Line name', 'Line type', 'Supply source'],
        ['LI_1', 'Display', ''],
      ],
    })),
  );
  api.autoDetectAndApply();
  assert.equal(api.getScDetectedSystem(), 'amazon_dsp');
  const info = document.getElementById('sc-auto-detect-info');
  // 手動で PVA を選択 → 手動選択表示
  api.setScSystem('amazon_pva');
  api.setManualFlags(true, false);
  api.refreshSystemSelectionUI();
  assert.equal(info.textContent, '手動選択：Amazon DSP（PVA）');
  // 自動検出に戻す → 前回判定値を「自動判定：…」表示
  api.setScSystem('auto');
  api.setManualFlags(false, false);
  api.refreshSystemSelectionUI();
  assert.equal(info.textContent, '自動判定：Amazon DSP（Display）');
});

test('reset 後は「自動検出」に戻り、次回アップロードで再判定できる', () => {
  // 直前テストで scDetectedSystem='amazon_dsp' が残っている状態からリセット
  api.resetSettingCheck();
  assert.equal(api.getScSystem(), 'auto');
  assert.equal(api.getScDetectedSystem(), '');
  assert.equal(api.getScCaseMode(), 'initial');
  assert.equal(document.getElementById('sc-system-select').value, 'auto');
  const info = document.getElementById('sc-auto-detect-info');
  assert.equal(info.textContent, '', '自動判定メッセージもクリア');
  // reset 後に Display ファイルを判定 → 自動判定が再び動作する
  api.setManualFlags(false, false);
  api.setScWbs(
    wrap(makeSettingCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ])),
    wrap(makeWb({
      'DISPLAY LINE ITEMS': [
        ['Line name', 'Line type', 'Supply source'],
        ['LI_1', 'Display', ''],
      ],
    })),
  );
  const ok = api.autoDetectAndApply();
  assert.equal(ok, true);
  assert.equal(api.getScDetectedSystem(), 'amazon_dsp', 'reset 後は再判定される');
});

// ── 8b. Audience名の大小文字差異（設定表=90days / ダウンロード=90Days） ──
test('audienceNameEquals：大小文字の違いは同一視する', () => {
  assert.equal(
    api.audienceNameEquals('KANEBO-90days-ProductPurchases', 'KANEBO-90Days-ProductPurchases'),
    true, 'KANEBO 90days/90Days は同一');
  assert.equal(
    api.audienceNameEquals('コスメデコルテ-365days-ProductPurchases', 'コスメデコルテ-365Days-ProductPurchases'),
    true, 'コスメデコルテ 365days/365Days は同一');
  // 末尾の全角空白が付いていても同一視
  assert.equal(
    api.audienceNameEquals('KANEBO-90days-ProductPurchases　　  ', 'KANEBO-90Days-ProductPurchases'),
    true, '全角空白は無視');
  // 本当に異なる名前は false のまま
  assert.equal(
    api.audienceNameEquals('KANEBO-90days-ProductPurchases', 'LuxuryCosmetics-90Days-ProductPurchases'),
    false, '別のAudienceは不一致のまま');
});

test('compareAudience：設定表=90days（小文字） vs DL=90Days（大文字）で誤報しない', () => {
  // 実案件（2608/08001）のセル内容を再現
  const sP = api.parseAudienceS(
    'KANEBO-90days-ProductPurchases\nor\nコスメデコルテ-365days-ProductPurchases　　');
  const dP = api.parseAudienceD({
    'Audience names':
      'KANEBO-90Days-ProductPurchases (397786796911505254); ' +
      'コスメデコルテ-365Days-ProductPurchases (404837083709446070)',
    'Audiences - include': '',
  });
  const res = api.compareAudience(sP, dP);
  assert.equal(res.matched, true, '同一Audienceとしてマッチ');
  assert.equal(res.diffs.length, 0, '誤報（設定表のみ/後台のみ）が発生しない');
});

// ── 8. 既存のPVA/OTT/Display LI比較が回帰しない ──
test('PVA：LI比較が通常どおり動作する（回帰なし）', () => {
  const wbsS = wrap(makeWb({
    'PVA設定シート': [
      ['Line Item Name', 'Type', 'Start day', 'Start time', 'End day', 'End time',
       'Device type', 'Mobile environment', 'Automated optimization', 'Base supply bid',
       'Pacing', 'Frequency', 'DealID', 'Deal名', 'Time zone', 'Daypart', 'Video ad format', 'SSP'],
      ['PVA_LI_1', 'Video', '2026-08-20', '00:00', '2026-09-30', '23:59',
       'All', 'Both', '', '100', 'ASAP', '1回/22日', 'PRIMEDEAL', 'PrimeVideo Deal', 'Account time zone', '指定なし（ALL）', 'In-stream only', ''],
    ],
  }));
  const wbsD = wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line ID', 'Advertiser ID*', 'Advertiser name', 'Order ID*', 'Order name - (READ ONLY)',
       'Line type*', 'Line name*', 'Video Ad Content Type*', 'Line start date', 'Line end date',
       'Active/Inactive', 'Product categories*', 'Device type', 'Mobile environment',
       'Supply source', 'Deal selection', 'Video ad format', 'Daypart targeting timezone',
       'Automated optimization', 'Pacing profile', 'Base supply bid*', 'Maximum average CPM'],
      ['1', '2', 'adv', '3', 'PVA(PD)_test_io', 'Video', 'PVA_LI_1', 'STREAMING_TV',
       '08-20-2026-00-00', '09-30-2026-23-59', 'Pause', '', 'All', 'Both',
       '', 'Prime Video ads:PRIMEDEAL', 'In-stream only', 'Account time zone',
       '', 'ASAP', '100', ''],
    ],
  }));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_pva', 'initial');
  assert.ok(Array.isArray(res.items), 'LI比較結果が配列');
  assert.equal(res.items.length, 1, '1件のLIが比較される');
  // video LI比較itemはmatchStatusを持たない（liName/mismatchCount/colResultsで構造確認）
  assert.equal(res.items[0].liName, 'PVA_LI_1');
  assert.equal(typeof res.items[0].mismatchCount, 'number');
  assert.ok(Array.isArray(res.items[0].colResults));
  assert.equal(res.liSkipped, false);
  assert.ok(res.creative, 'Creativeチェックも同時に動作');
});

test('OTT：LI比較が通常どおり動作する（回帰なし）', () => {
  const wbsS = wrap(makeWb({
    'OTT設定シート': [
      ['Line Item Name', 'Type', 'Start day', 'Start time', 'End day', 'End time',
       'Device type', 'Mobile environment', 'Base supply bid', 'Pacing', 'Frequency',
       'Time zone', 'Daypart', 'Video ad format', 'Supply sources', 'Region'],
      ['OTT_LI_1', 'Video', '2026-08-20', '00:00', '2026-09-30', '23:59',
       'All', 'Both', '100', 'ASAP', '', 'Account time zone', '指定なし（ALL）', 'In-stream only', 'TVer', ''],
    ],
  }));
  const wbsD = wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line ID', 'Advertiser ID*', 'Order ID*', 'Order name - (READ ONLY)',
       'Line type*', 'Line name*', 'Video Ad Content Type*', 'Line start date', 'Line end date',
       'Active/Inactive', 'Device type', 'Mobile environment', 'Supply source',
       'Video ad format', 'Pacing profile', 'Base supply bid*'],
      ['1', '2', '3', 'OTT_test_io', 'Video', 'OTT_LI_1', 'STREAMING_TV',
       '08-20-2026-00-00', '09-30-2026-23-59', 'Pause', 'All', 'Both',
       'TVer', 'In-stream only', 'ASAP', '100'],
    ],
  }));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_ott', 'initial');
  assert.ok(Array.isArray(res.items));
  assert.equal(res.items.length, 1, '1件のLIが比較される');
  // video LI比較itemはmatchStatusを持たない（liName/mismatchCount/colResultsで構造確認）
  assert.equal(res.items[0].liName, 'OTT_LI_1');
  assert.equal(typeof res.items[0].mismatchCount, 'number');
  assert.ok(Array.isArray(res.items[0].colResults));
});

test('Display：LI比較が通常どおり動作する（回帰なし）', () => {
  const wbsS = wrap(makeDspSettingSheet());
  const wbsD = wrap(makeDspDownload([makeCrRow('LI_1', 'CR_A', '', '', 'ACTIVE')], 'ACTIVE'));
  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'initial');
  assert.ok(Array.isArray(res.items), 'DSPのLI比較結果が配列');
  assert.equal(res.items.length, 1, '1件のLIが比較される');
  assert.equal(res.settingCount, 1);
  assert.equal(res.downloadCount, 1);
});
