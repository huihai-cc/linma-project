// YouTube CR 入稿物管理表 可选字段 schema 测试（2026-09-10 CR Optional Schema Fix）
//
// 背景: parseYoutubeSetting 的 CR parser 曾用固定默认列 index 初始化
// longHeadline:19 / description:21 / companion:23，当 Header 中不存在
// 「長い見出し」「説明」「コンパニオン」（如 VRC(NonS)、YTN(FQ)、オーディオ広告 模板）时，
// 固定 index 会读取其他业务列（備考/コンパニオン列）导致跨模板错位。
// 修复: 可选字段以 sentinel -1 初始化，仅当 Header 存在时覆盖；
// 读取使用 readOptionalColumn(row,index)，index<0 时返回 ''。
//
// 本测试用合成 sheets（列布局复刻真实 workbook 的四种入稿物管理表模板）做端到端验证。
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
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n'; }
      i++;
    } else if (state === 'block') {
      if (c2 === '*/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out += '\n';
      i++;
    } else if (state === 'squote' || state === 'dquote') {
      if (c === '\\') { i += 2; continue; }
      if (c === code[i] || c === '\n') state = 'code';
      i++;
    } else if (state === 'template') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { state = 'code'; i++; continue; }
      i++;
    }
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
    parse: (sheets, sheetNames) => {
      // 执行期遇到未定义依赖时自动提取补齐后重试
      for (let round = 0; round < 80; round++) {
        try { return ctx.parseYoutubeSetting(sheets, sheetNames, 'test.xlsx', {}); }
        catch (e) {
          const m = String(e.message || '').match(/^(\w+) is not defined$/);
          if (m && load(m[1])) continue;
          throw e;
        }
      }
      throw new Error('auto-dep rounds exhausted');
    }
  };
}

const COMPANION_DEFAULT = 'チャンネル内の動画から自動生成された画像を使用する（推奨）';
const S_VRC = '入稿物管理表（VRC・VVC・VRC(FQ))';
const S_NONS = '入稿物管理表（VRC(NonS))';
const S_YTN = '入稿物管理表（YTN(FQ)）';
const S_AUD = '入稿物管理表（オーディオ広告）';

function mkRow(pairs) { const r = []; for (const [i, v] of pairs) r[i] = v; return r; }

function buildSyntheticSheets() {
  const salesHdr = mkRow([[0, 'No'], [1, 'J.No'], [3, '配信目的'], [4, 'IO名'], [5, 'セグメント内容'], [6, '動画タイプ'], [53, '使用する入稿物管理表']]);
  const salesRows = [salesHdr,
    mkRow([[0, '1'], [4, 'IO_TEST'], [5, 'SEG1'], [6, 'VRC（スキップ可）'], [53, S_VRC]]),
    mkRow([[0, '2'], [4, 'IO_TEST'], [5, 'SEG2'], [6, 'VRC（NonS）'], [53, S_NONS]]),
    mkRow([[0, '3'], [4, 'IO_TEST'], [5, 'SEG3'], [6, 'YTN'], [53, S_YTN]]),
    mkRow([[0, '4'], [4, 'IO_TEST'], [5, 'SEG4'], [6, 'オーディオ'], [53, S_AUD]])];
  const common = [[1, '依頼日'], [3, '広告掲載オーダー名※'], [4, '広告申込情報名※'], [5, '広告グループ名※'], [6, '広告名※'], [7, '掲載開始日'], [8, '掲載終了日'], [9, 'Youtube動画(URL)※'], [10, '入稿用URL（ランディングページURL）'], [11, '表示 URLの第一ドメイン']];
  const hdrVrc = mkRow([...common, [15, '行動を促すフレーズ'], [17, 'タイトル\n(省略可)'], [19, '長い見出し※'], [21, '説明※'], [23, 'コンパニオンバナー'], [24, 'クリック トラッカー URL（省略可）'], [25, '備考']]);
  const hdrNons = mkRow([...common, [15, '行動を促すフレーズ'], [17, 'タイトル\n(省略可)'], [19, 'コンパニオンバナー'], [20, 'クリック トラッカー URL（省略可）'], [21, '備考']]);
  const hdrYtn = mkRow([...common, [13, 'クリック トラッカー URL（省略可）'], [14, 'コンパニオンバナー（素材名）'], [15, '行動を促すフレーズ(省略可/VVCは必須)'], [17, 'タイトル(省略可)'], [19, '備考']]);
  const hdrAud = mkRow([...common, [13, 'クリック トラッカー URL（省略可）'], [14, '備考'], [15, '行動を促すフレーズ'], [17, 'タイトル(省略可)']]);
  const URL = 'https://www.youtube.com/watch?v=abc123';
  const sheets = {
    '記入欄_営業・業推記入用': salesRows,
    [S_VRC]: [[], [], [], [], hdrVrc, mkRow([[3, 'IO_TEST'], [4, 'SEG1'], [5, 'GP1'], [6, 'CR_VRCFULL'], [9, URL], [15, '詳しく見る'], [17, 'HH_VRC'], [19, 'LH_VRC'], [21, 'DESC_VRC'], [23, 'comp_vrc.png'], [24, 'https://ct.vrc']])],
    [S_NONS]: [[], [], [], [], hdrNons, mkRow([[3, 'IO_TEST'], [4, 'SEG2'], [5, 'GP2'], [6, 'CR_NONS'], [9, URL], [15, '詳しく見る'], [17, 'HH_NONS'], [19, COMPANION_DEFAULT], [20, 'https://ct.nons'], [21, 'NonS備考テキスト']])],
    [S_YTN]: [[], [], [], [], hdrYtn, mkRow([[3, 'IO_TEST'], [4, 'SEG3'], [5, 'GP3'], [6, 'CR_YTN'], [9, URL], [13, 'https://ct.ytn'], [14, 'ytn_comp.png'], [15, '詳しく見る'], [17, 'HH_YTN'], [19, 'YTN備考テキスト']])],
    [S_AUD]: [[], [], [], [], hdrAud, mkRow([[3, 'IO_TEST'], [4, 'SEG4'], [5, 'GP4'], [6, 'CR_AUDIO'], [9, URL], [13, 'https://ct.aud'], [14, 'Audio備考テキスト'], [15, '詳しく見る'], [17, 'HH_AUDIO'], [23, 'X列の無関係な値']])],
  };
  return { sheets, sheetNames: Object.keys(sheets) };
}

function parseSynthetic() {
  const { parse } = loadParser();
  const { sheets, sheetNames } = buildSyntheticSheets();
  return parse(sheets, sheetNames);
}

test('VRC・VVC・VRC(FQ) 模板: 長い見出し/説明/コンパニオン 各自读取正确列（T=19/V=21/X=23）', () => {
  const result = parseSynthetic();
  const cr = result.crList.find(c => c.sheet === S_VRC);
  assert.ok(cr, 'VRCfull CR 行应存在');
  assert.equal(cr.fields.longHeadline, 'LH_VRC');
  assert.equal(cr.fields.description, 'DESC_VRC');
  assert.equal(cr.fields.companionBanner, 'comp_vrc.png');
  assert.equal(cr.fields.headline, 'HH_VRC');
  assert.equal(cr.fields.clickTracker, 'https://ct.vrc');
});

test('VRC(NonS) 模板: 无 長い見出し/説明 Header → 字段为空，不误读 コンパニオン/備考 列', () => {
  const result = parseSynthetic();
  const cr = result.crList.find(c => c.sheet === S_NONS);
  assert.ok(cr, 'NonS CR 行应存在');
  assert.equal(cr.fields.longHeadline, '', 'T=19 コンパニオン列不得误入 長い見出し');
  assert.equal(cr.fields.description, '', 'V=21 備考列不得误入 説明');
  assert.equal(cr.fields.companionBanner, COMPANION_DEFAULT, 'コンパニオンバナー仍从 T=19 正确读取');
  assert.equal(cr.fields.clickTracker, 'https://ct.nons', 'クリック トラッカー U=20 经 Header 识别');
  assert.equal(cr.fields.headline, 'HH_NONS', 'タイトル R=17 经 Header 识别');
});

test('YTN(FQ) 模板: 備考(T=19) 不得误入 長い見出し；コンパニオン 经 Header 识别 O=14', () => {
  const result = parseSynthetic();
  const cr = result.crList.find(c => c.sheet === S_YTN);
  assert.ok(cr, 'YTN CR 行应存在');
  assert.equal(cr.fields.longHeadline, '', 'YTN 備考不得误入 長い見出し');
  assert.equal(cr.fields.description, '');
  assert.equal(cr.fields.companionBanner, 'ytn_comp.png');
  assert.equal(cr.fields.clickTracker, 'https://ct.ytn', 'N=13 经 Header 识别');
  assert.equal(cr.fields.headline, 'HH_YTN');
});

test('オーディオ広告 模板: 不存在的 creative optional fields 必须为空，不从任意固定列误取值', () => {
  const result = parseSynthetic();
  const cr = result.crList.find(c => c.sheet === S_AUD);
  assert.ok(cr, 'Audio CR 行应存在');
  assert.equal(cr.fields.longHeadline, '');
  assert.equal(cr.fields.description, '');
  assert.equal(cr.fields.companionBanner, '', 'X=23 等无 Header 列即使有值也不得误读');
  assert.equal(cr.fields.clickTracker, 'https://ct.aud', 'N=13 经 Header 识别');
  assert.equal(cr.fields.headline, 'HH_AUDIO');
});

test('companionBannerAssetId 查找同样使用 safe accessor（无 Asset 列时为空）', () => {
  const result = parseSynthetic();
  for (const cr of result.crList) {
    assert.equal(cr.fields.companionBannerAssetId, '');
  }
});
