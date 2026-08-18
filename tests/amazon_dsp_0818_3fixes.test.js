// Amazon DSP 2026-08-18 3点修正 专项テスト
//   Case 1: 案件区分自動検出（今回DLと一致する追加CRだけを証拠にする）
//   Case 2: LI Type 表示値（設定表原値）と比較値（正規化コード）の分離
//   Case 3: 複数「入稿物管理表」の取り違え防止（全有効Sheet読み込み＋LI紐づけ）
// 対象: amazon_dsp_check.html
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

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
'  detectCaseModeAuto: typeof detectCaseModeAuto === "function" ? detectCaseModeAuto : undefined,\n' +
'  readCreativeSettingDataMulti: typeof readCreativeSettingDataMulti === "function" ? readCreativeSettingDataMulti : undefined,\n' +
'  readCreativeDownloadDataMulti: typeof readCreativeDownloadDataMulti === "function" ? readCreativeDownloadDataMulti : undefined,\n' +
'  compareCreativeData: typeof compareCreativeData === "function" ? compareCreativeData : undefined,\n' +
'  renderCreativeResultSection: typeof renderCreativeResultSection === "function" ? renderCreativeResultSection : undefined,\n' +
'  normalizeCreativeName: typeof normalizeCreativeName === "function" ? normalizeCreativeName : undefined,\n' +
'  normalizeCreativeNameForCompare: typeof normalizeCreativeNameForCompare === "function" ? normalizeCreativeNameForCompare : undefined,\n' +
'  normalizeVideoContentTypeFromSetting: typeof normalizeVideoContentTypeFromSetting === "function" ? normalizeVideoContentTypeFromSetting : undefined,\n' +
'  getColumnCheckFn: function(key){\n' +
'    const col = (typeof DL_COLUMNS_VIDEO !== "undefined") ? DL_COLUMNS_VIDEO.find(c => c.key === key) : undefined;\n' +
'    return col ? col.checkFn : undefined;\n' +
'  },\n' +
'  autoDetectAndApply: typeof autoDetectAndApply === "function" ? autoDetectAndApply : undefined,\n' +
'  detectDownloadSystemAuto: typeof detectDownloadSystemAuto === "function" ? detectDownloadSystemAuto : undefined,\n' +
'  getScSystem: function(){ return scSystem; },\n' +
'  getScDetectedSystem: function(){ return scDetectedSystem; },\n' +
'  getScCaseMode: function(){ return scCaseMode; },\n' +
'  setScSystem: function(v){ scSystem = v; },\n' +
'  setScCaseMode: function(v){ scCaseMode = v; },\n' +
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

function wrap(...wbs) {
  return wbs.map((wb, i) => ({ wb, fileName: `test_${i + 1}.xlsx` }));
}

const CR_HEADER = ['ラインアイテム名', '設定クリエイティブ名（自動入力）', '設定クリエイティブ名（変更した場合）',
  '配信開始日', '配信開始時間', '配信停止日', '配信停止時間', 'ステータス'];

function makeCrSheet(crRows) {
  return [CR_HEADER, ...crRows];
}

function makeDspSettingSheet() {
  return makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Start time', 'End day', 'End time', 'Device', 'Active/Inactive'],
      ['LI_1', 'Display', '2026-08-20', '00:00', '2026-09-30', '23:59', 'All', 'ACTIVE'],
    ],
  });
}

function makeDspDownload(crRows, liNames) {
  const lis = liNames.map(n =>
    [n, 'Display', '', 'order1', '08-20-2026-00-00', '09-30-2026-23-59', 'ACTIVE']);
  return makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Order name - (READ ONLY)',
       'Line start date', 'Line end date', 'Active/Inactive'],
      ...lis,
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

// ============================================================
// Case 1｜案件区分自動検出
// ============================================================

test('1-1 設定表に「追加」履歴があっても今回DL未一致なら初期案件（自動確定しない）', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表': makeCrSheet([
      ['LI_1', 'CR_OLD_1', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
      ['LI_1', 'CR_OLD_2', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
    ]),
  }));
  // 今回DLには別のCRしか無い
  const wbsD = wrap(makeWb({
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      makeCrRow('LI_1', 'CR_OTHER', '08-20-2026-00-00', '09-30-2026-23-59', 'INACTIVE'),
    ],
  }));
  const r = api.detectCaseModeAuto(wbsS, wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.caseMode, 'initial', 'DL未一致の追加履歴だけではCR追加案件にしない');
  assert.equal(r.evidence, '');
  assert.ok(r.reference.includes('追加') && r.reference.includes('自動確定せず'), r.reference);
});

test('1-1b ダウンロードデータ自体が無い場合は初期案件（証拠不足で自動確定しない）', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表': makeCrSheet([
      ['LI_1', 'CR_OLD_1', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
    ]),
  }));
  const r = api.detectCaseModeAuto(wbsS, undefined);
  assert.equal(r.determined, true);
  assert.equal(r.caseMode, 'initial');
  assert.ok(r.reference.includes('追加'), r.reference);
});

test('1-2 設定表の追加CRが今回DLと一致 → CR追加案件（根拠付き）', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表': makeCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
      ['LI_1', 'CR_002', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
    ]),
  }));
  // DLに CR_001 のみ実在 → 証拠1件
  const wbsD = wrap(makeWb({
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      makeCrRow('LI_1', 'CR_001', '08-20-2026-00-00', '09-30-2026-23-59', 'INACTIVE'),
    ],
  }));
  const r = api.detectCaseModeAuto(wbsS, wbsD);
  assert.equal(r.determined, true);
  assert.equal(r.caseMode, 'creative_addition');
  assert.ok(r.evidence.includes('今回DLと一致する追加CR 1件'), r.evidence);
});

test('1-2b 全角Ｘ/半角xの表記差は正規化により証拠として一致する', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表': makeCrSheet([
      ['LI_1', 'CR_001×2', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
    ]),
  }));
  const wbsD = wrap(makeWb({
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      makeCrRow('LI_1', 'CR_001x2', '08-20-2026-00-00', '09-30-2026-23-59', 'INACTIVE'),
    ],
  }));
  const r = api.detectCaseModeAuto(wbsS, wbsD);
  assert.equal(r.caseMode, 'creative_addition', '表記差は既存CR正規化で等価扱い');
});

test('1-3 ユーザーが手動で初期案件を選択 → 自動検出は上書きしない', () => {
  api.resetSettingCheck();
  api.setScSystem('auto');
  api.setManualFlags(false, true);   // 案件区分のみ手動選択済み
  const wbsS = wrap(
    makeWb({
      '入稿物管理表': makeCrSheet([
        ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
      ]),
    }),
    makeDspSettingSheet(),
  );
  const wbsD = wrap(makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source'],
      ['LI_1', 'Display', ''],
    ],
    'CREATIVE ASSOCIATIONS': [
      ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
      makeCrRow('LI_1', 'CR_001', '', '', 'INACTIVE'),
    ],
  }));
  api.setScWbs(wbsS, wbsD);
  const ok = api.autoDetectAndApply();
  assert.equal(ok, true);
  assert.equal(api.getScCaseMode(), 'initial', '手動選択の初期案件を自動検出が上書きしない');
  const info = document.getElementById('sc-auto-detect-info');
  assert.ok(!info.textContent.includes('CR追加案件'), `追加案件に書き換えない：${info.textContent}`);
});

test('Case A 追加CRが今回DLと一致 → 提示あり・案件区分は初期案件のまま（自動切り替えなし）', () => {
  api.resetSettingCheck();
  api.setScSystem('auto');
  api.setManualFlags(false, false);
  api.setScWbs(
    wrap(makeWb({
      '入稿物管理表': makeCrSheet([
        ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
      ]),
    }), makeDspSettingSheet()),
    wrap(makeWb({
      'DISPLAY LINE ITEMS': [['Line name', 'Line type', 'Supply source'], ['LI_1', 'Display', '']],
      'CREATIVE ASSOCIATIONS': [
        ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
        makeCrRow('LI_1', 'CR_001', '', '', 'INACTIVE'),
      ],
    })),
  );
  api.autoDetectAndApply();
  const info = document.getElementById('sc-auto-detect-info');
  // 💡 提示は表示する
  assert.ok(info.textContent.includes('💡 CR追加の可能性あり'), info.textContent);
  assert.ok(info.textContent.includes('今回DLと一致する追加CR 1件'), info.textContent);
  // 案件区分は自動で切り替えない（安全デフォルト＝初期案件）
  assert.equal(api.getScCaseMode(), 'initial', '案件区分は初期案件のまま');
  assert.equal(document.getElementById('sc-case-mode-select').value, 'initial', 'ドロップダウンも初期案件のまま');
});

test('Case A2 追加履歴があっても今回DL未一致 → 参考のみ・案件区分は初期案件', () => {
  api.resetSettingCheck();
  api.setManualFlags(false, false);
  api.setScWbs(
    wrap(makeWb({
      '入稿物管理表': makeCrSheet([
        ['LI_1', 'CR_OLD', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
      ]),
    }), makeDspSettingSheet()),
    wrap(makeWb({
      'DISPLAY LINE ITEMS': [['Line name', 'Line type', 'Supply source'], ['LI_1', 'Display', '']],
      'CREATIVE ASSOCIATIONS': [
        ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
        makeCrRow('LI_1', 'CR_OTHER', '', '', 'INACTIVE'),
      ],
    })),
  );
  api.autoDetectAndApply();
  const info = document.getElementById('sc-auto-detect-info');
  assert.ok(info.textContent.includes('参考：設定表に「追加」記載あり（自動確定せず）'), info.textContent);
  assert.equal(api.getScCaseMode(), 'initial', 'DL未一致でも初期案件のまま');
});

test('Case B 追加CRなし → 案件区分は初期案件', () => {
  api.resetSettingCheck();
  api.setScSystem('auto');
  api.setManualFlags(false, false);
  api.setScWbs(
    wrap(makeWb({
      '入稿物管理表': makeCrSheet([
        ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '新規'],
      ]),
    }), makeDspSettingSheet()),
    wrap(makeWb({
      'DISPLAY LINE ITEMS': [['Line name', 'Line type', 'Supply source'], ['LI_1', 'Display', '']],
      'CREATIVE ASSOCIATIONS': [
        ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
        makeCrRow('LI_1', 'CR_001', '', '', 'ACTIVE'),
      ],
    })),
  );
  api.autoDetectAndApply();
  assert.equal(api.getScCaseMode(), 'initial');
  const info = document.getElementById('sc-auto-detect-info');
  assert.ok(!info.textContent.includes('CR追加'), info.textContent);
});

test('Case C ユーザーが手動でCR追加案件を選択 → 自動処理後も creative_addition を維持', () => {
  api.resetSettingCheck();
  api.setScSystem('auto');
  api.setScCaseMode('creative_addition');   // ユーザー手動選択相当
  api.setManualFlags(false, true);          // 案件区分は手動選択済み
  api.setScWbs(
    wrap(
      makeWb({
        '入稿物管理表': makeCrSheet([
          ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', '追加'],
        ]),
      }),
      makeDspSettingSheet(),
    ),
    wrap(makeWb({
      'DISPLAY LINE ITEMS': [['Line name', 'Line type', 'Supply source'], ['LI_1', 'Display', '']],
      'CREATIVE ASSOCIATIONS': [
        ['Line name', 'Creative name', 'Start date', 'End date', 'Active/Inactive'],
        makeCrRow('LI_1', 'CR_001', '', '', 'INACTIVE'),
      ],
    })),
  );
  const ok = api.autoDetectAndApply();
  assert.equal(ok, true);
  assert.equal(api.getScCaseMode(), 'creative_addition', '自動ロジックが初期案件に戻さない');
  const info = document.getElementById('sc-auto-detect-info');
  assert.ok(info.textContent.includes('Amazon DSP（Display）'), info.textContent);
  assert.ok(!info.textContent.includes('💡'), '手動選択時はCR追加提示を出さない');
  assert.ok(!info.textContent.includes('参考：'), '手動選択時は案件区分の参考も出さない');
});

test('Case D システム自動判定：Display / PVA / OTT が正しく判別される', () => {
  const dsp = api.detectDownloadSystemAuto(wrap(makeWb({
    'DISPLAY LINE ITEMS': [['Line name', 'Line type', 'Supply source'], ['LI_1', 'Display', '']],
  })));
  assert.equal(dsp.determined, true);
  assert.equal(dsp.system, 'amazon_dsp');

  const pva = api.detectDownloadSystemAuto(wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Video Ad Content Type*'],
      ['LI_PVA', 'Video', '', 'STREAMING_TV'],
    ],
  })));
  assert.equal(pva.determined, true);
  assert.equal(pva.system, 'amazon_pva');

  const ott = api.detectDownloadSystemAuto(wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Video Ad Content Type*'],
      ['LI_CTV', 'Video', 'TWITCH', 'STREAMING_TV'],
    ],
  })));
  assert.equal(ott.determined, true);
  assert.equal(ott.system, 'amazon_ott');
});

// ============================================================
// Case 2｜LI Type 表示値と比較値の分離
// ============================================================

test('2 normalizeVideoContentTypeFromSetting 正規化', () => {
  const n = api.normalizeVideoContentTypeFromSetting;
  assert.equal(n('Online Video'), 'ONLINE_VIDEO');
  assert.equal(n('Streaming TV'), 'STREAMING_TV');
  assert.equal(n('ONLINE_VIDEO'), 'ONLINE_VIDEO');   // コード表記のままでも冪等
  assert.equal(n('Streaming_TV'), 'STREAMING_TV');
  assert.equal(n('　Online Video　'), 'ONLINE_VIDEO'); // 全角空白
  assert.equal(n('Video'), '');                        // 未知 → 自動一致させない
  assert.equal(n(''), '');
  assert.equal(n(undefined), '');
});

test('2 checkFn：設定表 Online Video ↔ DL ONLINE_VIDEO → match', () => {
  const fn = api.getColumnCheckFn('Video Ad Content Type*');
  assert.ok(fn, 'Video Ad Content Type* checkFn が存在');
  assert.equal(fn({ media: 'Online Video' }, 'ONLINE_VIDEO'), true);
  assert.equal(fn({ media: 'Online Video' }, 'STREAMING_TV'), false, 'PC/CTVの取り違えは不一致');
});

test('2 checkFn：設定表 Streaming TV ↔ DL STREAMING_TV → match', () => {
  const fn = api.getColumnCheckFn('Video Ad Content Type*');
  assert.equal(fn({ media: 'Streaming TV' }, 'STREAMING_TV'), true);
  assert.equal(fn({ media: 'Streaming TV' }, 'ONLINE_VIDEO'), false);
});

test('2 checkFn：設定表Typeが未知なら自動一致させない（null）', () => {
  const fn = api.getColumnCheckFn('Video Ad Content Type*');
  assert.equal(fn({ media: '' }, 'STREAMING_TV'), null);
  assert.equal(fn({ media: 'Video' }, 'STREAMING_TV'), null, '固定値で自動一致させない');
});

test('2 E2E：4LI（PC×2 / CTV×2）のS側表示は設定表原値、比較は正規化コード', () => {
  const LIS = {
    'LI_Twitch_KONAMI_US_movie_PC_1': 'Online Video',
    'LI_Twitch_KONAMI_US_movie_PC_2': 'Online Video',
    'LI_Twitch_KONAMI_US_movie_CTV_1': 'Streaming TV',
    'LI_Twitch_KONAMI_US_movie_CTV_2': 'Streaming TV',
  };
  const wbsS = wrap(makeWb({
    'PVA設定シート': [
      ['Line Item Name', 'Type', 'Start day', 'Start time', 'End day', 'End time',
       'Device type', 'Mobile environment', 'Automated optimization', 'Base supply bid',
       'Pacing', 'Frequency', 'DealID', 'Deal名', 'Time zone', 'Daypart', 'Video ad format', 'SSP'],
      ...Object.entries(LIS).map(([li, type]) =>
        [li, type, '2026-08-20', '00:00', '2026-09-30', '23:59',
         'All', 'Both', '', '100', 'ASAP', '', 'PRIMEDEAL', 'PrimeVideo Deal',
         'Account time zone', '指定なし（ALL）', 'In-stream only', '']),
    ],
  }));
  const dlRows = Object.entries(LIS).map(([li, type]) => [
    '1', '2', '3', 'KONAMI_Twitch_IO', 'Video', li,
    type === 'Online Video' ? 'ONLINE_VIDEO' : 'STREAMING_TV',
    '08-20-2026-00-00', '09-30-2026-23-59', 'Pause',
    'All', 'Both', '', 'In-stream only', 'ASAP', '100',
  ]);
  const wbsD = wrap(makeWb({
    'VIDEO LINE ITEMS': [
      ['Line ID', 'Advertiser ID*', 'Order ID*', 'Order name - (READ ONLY)',
       'Line type*', 'Line name*', 'Video Ad Content Type*', 'Line start date', 'Line end date',
       'Active/Inactive', 'Device type', 'Mobile environment', 'Supply source',
       'Video ad format', 'Pacing profile', 'Base supply bid*'],
      ...dlRows,
    ],
  }));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_pva', 'initial');
  assert.equal(res.items.length, 4, '4 LI が読み取られる');
  for (const li of Object.keys(LIS)) {
    const item = res.items.find(i => i.liName === li);
    assert.ok(item, `${li} が見つかる`);
    const settingType = LIS[li];
    const dlCode = settingType === 'Online Video' ? 'ONLINE_VIDEO' : 'STREAMING_TV';
    const rLine = item.colResults.find(c => c.key === 'Line type*');
    const rCtype = item.colResults.find(c => c.key === 'Video Ad Content Type*');
    assert.equal(rLine.sVal, settingType, `${li}: S側は設定表原値（Line type*）`);
    assert.equal(rLine.dVal, 'Video', `${li}: DL構造フィールドはVideo`);
    assert.equal(rLine.result, true, `${li}: Line type* 一致`);
    assert.equal(rCtype.sVal, settingType, `${li}: S側は設定表原値（Video Ad Content Type*）`);
    assert.equal(rCtype.dVal, dlCode, `${li}: DLは${dlCode}`);
    assert.equal(rCtype.result, true, `${li}: VideoコンテンツType 一致`);
  }
  assert.equal(res.items.reduce((s, i) => s + i.mismatchCount, 0), 0, '全体でmismatchなし');
});

// ============================================================
// Case 3｜複数「入稿物管理表」の取り違え防止
// ============================================================

function makeMultiCrSheets(order) {
  const sheets = {
    '入稿物管理表(静止画)': makeCrSheet([]),
    '入稿物管理表(動画)': makeCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_002', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_003', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_004', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_005', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_006', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_007', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_008', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
  };
  const wb = makeWb(sheets);
  if (order === 'reversed') wb.SheetNames.reverse();
  return wb;
}

test('3 静止画/動画の両方に有効ヘッダーがありCRは動画のみ → 動画CRを全件読み取る（Sheet順序に依存しない）', () => {
  for (const order of ['normal', 'reversed']) {
    const wbsS = wrap(makeMultiCrSheets(order));
    const res = api.readCreativeSettingDataMulti(wbsS, 'initial', ['LI_1']);
    assert.equal(res.rows.length, 8, `${order}: 8件のCRが読み取られる`);
    for (const row of res.rows) {
      assert.equal(row.source.sheetName, '入稿物管理表(動画)', `${order}: 取り違えなし`);
      assert.equal(row.liName, 'LI_1');
    }
    assert.ok(res.rows.every(r => r.creativeName && r.creativeName.startsWith('CR_00')), 'CR名が取れている');
  }
});

test('3 同一（LI,CR）が両Sheetに存在 → 重複して読み込まない（動画Sheet優先）', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表(静止画)': makeCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
    '入稿物管理表(動画)': makeCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
      ['LI_1', 'CR_002', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
  }));
  const res = api.readCreativeSettingDataMulti(wbsS, 'initial', ['LI_1']);
  assert.equal(res.rows.length, 2, 'CR_001は重複しない');
  const cr1 = res.rows.find(r => r.creativeName === 'CR_001');
  assert.equal(cr1.source.sheetName, '入稿物管理表(動画)', '重複時は動画Sheetの行を採用');
});

test('3 今回設定LIに紐づかないLIのCRは含めない（LIフィルター）', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表(静止画)': makeCrSheet([
      ['LI_DISPLAY_A', 'CR_STILL_1', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
    '入稿物管理表(動画)': makeCrSheet([
      ['LI_1', 'CR_001', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
  }));
  const res = api.readCreativeSettingDataMulti(wbsS, 'initial', ['LI_1']);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].creativeName, 'CR_001');
});

test('3 settingLiNames を渡さない場合は従来どおり全CRを読み込む（後方互換）', () => {
  const wbsS = wrap(makeWb({
    '入稿物管理表(静止画)': makeCrSheet([
      ['LI_A', 'CR_A1', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
    '入稿物管理表(動画)': makeCrSheet([
      ['LI_B', 'CR_B1', '', '2026/8/20', '0:00', '2026/9/30', '23:59', ''],
    ]),
  }));
  const res = api.readCreativeSettingDataMulti(wbsS, 'initial');
  assert.equal(res.rows.length, 2, 'LI名での絞り込みなしなら両SheetのCRを読む');
});

test('3 E2E：入稿物管理表(動画)の8CRがDLと8/8一致し、DL未発見が0件', () => {
  const crRows = Array.from({ length: 8 }, (_, i) =>
    ['LI_1', `CR_00${i + 1}`, '', '2026/8/20', '0:00', '2026/9/30', '23:59', '']);
  const dlCrRows = Array.from({ length: 8 }, (_, i) =>
    makeCrRow('LI_1', `CR_00${i + 1}`, '08-20-2026-00-00', '09-30-2026-23-59', 'ACTIVE'));
  const wbsS = wrap(
    makeWb({
      '入稿物管理表(静止画)': makeCrSheet([]),
      '入稿物管理表(動画)': makeCrSheet(crRows),
    }),
    makeDspSettingSheet(),
  );
  const wbsD = wrap(makeDspDownload(dlCrRows, ['LI_1']));

  const res = api.checkAmazon(wbsS, wbsD, 'amazon_dsp', 'initial');
  assert.ok(res.creative, 'creative結果が生成される');
  assert.equal(res.creative.settingCount, 8, '動画Sheetの8CRが読み取られる');
  assert.equal(res.creative.matchCount, 8, '8/8一致');
  assert.equal(res.creative.notFoundCount, 0, 'DL未発見0件');
  assert.equal(res.creative.errorCount, 0);
  assert.equal(res.creative.downloadOnlyCount, 0);
  for (const item of res.creative.items) {
    assert.equal(item.settingSource.sheetName, '入稿物管理表(動画)', '設定源は動画Sheet');
    assert.equal(item.matchStatus, 'match');
  }
});

test('3 診断：exact未一致のCRは自動matchせず「候補」を提示するだけ', () => {
  const settingData = {
    rows: [{
      liName: 'LI_1', creativeName: 'CR_001×', creativeNameSource: '自動入力', settingStatus: '',
      startDate: '2026/8/20', startTime: '0:00', endDate: '2026/9/30', endTime: '23:59',
      source: { fileName: 's.xlsx', sheetName: '入稿物管理表', rowNumber: 2 },
    }],
    files: [], diagnostics: [],
  };
  const downloadData = {
    rows: [{
      liName: 'LI_1', creativeName: 'CR_001 x',
      startDateTime: '08-20-2026-00-00', endDateTime: '09-30-2026-23-59', activeStatus: 'ACTIVE',
      source: { fileName: 'd.xlsx', sheetName: 'CREATIVE ASSOCIATIONS', rowNumber: 2 },
    }],
    files: [], diagnostics: [],
  };
  const res = api.compareCreativeData(settingData, downloadData, [], 'initial', {});
  // initial案件ではDL側のみのCRも download_only として追加されるため、設定表側アイテムを探す
  const item = res.items.find(i => i.settingSource);
  assert.ok(item, '設定表側アイテムが存在');
  assert.equal(item.matchStatus, 'setting_only', '表記差だけでは自動matchしない');
  assert.ok(item.unmatchedReason.includes('候補：CR_001 x'),
    `候補提示が出る：${item.unmatchedReason}`);
});
