'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.html');
const tverPath = path.join(projectRoot, 'tver_check.html');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function loadUsageApi(sendLog, runtimeConsole = { log() {}, warn() {}, error() {} }) {
  const html = read(tverPath);
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('TVER_APP_MARKER'));
  assert.ok(source, 'TVer inline app script must exist');

  const exportBlock = `\nwindow.__tverReleasePrepApi = {
    buildTverUsageLogPayload: typeof buildTverUsageLogPayload === 'function' ? buildTverUsageLogPayload : undefined,
    recordTverUsage: typeof recordTverUsage === 'function' ? recordTverUsage : undefined,
    renderTverRun: typeof renderTverRun === 'function' ? renderTverRun : undefined,
  };\n`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const sandbox = {
    Blob,
    Map,
    Set,
    TextDecoder,
    Uint8Array,
    URL,
    console: runtimeConsole,
    sendLog,
    window: null,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: tverPath });
  return sandbox.__tverReleasePrepApi;
}

test('Release prep: 2課 导航只新增一个 TVer 入口并保留既有入口', () => {
  const source = read(indexPath);
  const ka2Lines = source.split(/\r?\n/).filter(line => line.includes("group:'ka2'"));
  assert.equal(ka2Lines.length, 2);
  assert.ok(ka2Lines.some(line => /name:'TVer'/.test(line) && /href:'tver_check\.html'/.test(line)));
  assert.ok(ka2Lines.some(line => /name:'ターゲット推薦ツール'/.test(line) && /href:'ターゲット推薦ツール 2\.html'/.test(line)));
});

test('Release prep: 既有返回导航在页面滚动时固定且不覆盖 TVer sticky header', () => {
  const source = read(tverPath);
  assert.equal((source.match(/<nav class="back-nav"/g) || []).length, 1);
  assert.match(source, /\.back-nav\{[^}]*position:sticky[^}]*top:0[^}]*z-index:\d+[^}]*height:36px/);
  assert.match(source, /\.tver-horizontal-sticky-header\{top:var\(--tver-back-nav-height,36px\)\}/);
  assert.match(source, /\.results-table th\{top:var\(--tver-back-nav-height,36px\)\}/);
});

test('Release prep: TVer 只接入现有 qc-auth sendLog，不创建案件级统计', () => {
  const source = read(tverPath);
  assert.match(source, /<script src="qc-auth\.js"><\/script>/);
  assert.equal((source.match(/\bsendLog\s*\(/g) || []).length, 1);
  assert.match(source, /sendLog\(payload\.tool/);
  assert.match(source, /tverPageState\.run=run;[\s\S]*?recordTverUsage\(run\);[\s\S]*?return \{ ok:true, run \}/);
  assert.doesNotMatch(source, /case_summary|caseName|caseSessionId/);
});

test('Release prep: TVer usage payload 只按既有工具级日志字段汇总状态', async () => {
  const calls = [];
  const api = loadUsageApi((...args) => {
    calls.push(args);
    return Promise.resolve({ ok: true });
  });
  assert.equal(typeof api.buildTverUsageLogPayload, 'function');
  assert.equal(typeof api.recordTverUsage, 'function');

  const run = { statusCounts: { '一致': 4, '表記ゆれ一致': 1, '不一致': 2, '需确认': 3, '未匹配': 1 } };
  assert.deepEqual(JSON.parse(JSON.stringify(api.buildTverUsageLogPayload(run))), {
    tool: 'TVer設定チェック',
    diffCount: 6,
    criticalCount: 3,
    note: '一致:4 表記ゆれ一致:1 不一致:2 需確認:3 未匹配:1',
  });

  await api.recordTverUsage(run);
  assert.deepEqual(calls, [[
    'TVer設定チェック',
    6,
    3,
    '一致:4 表記ゆれ一致:1 不一致:2 需確認:3 未匹配:1',
  ]]);
});

test('Release prep: logs 写入失败不会让 TVer 统计接线抛出到 QC 主流程', async () => {
  const api = loadUsageApi(() => Promise.reject(new Error('network unavailable')));
  const run = { statusCounts: { '一致': 1 } };
  await assert.doesNotReject(() => api.recordTverUsage(run));
});

test('UI-FIX1: 编辑 CSV 业务提示不再渲染且五状态统计值保持不变', () => {
  const api = loadUsageApi(() => Promise.resolve({ ok: true }));
  const run = {
    entries: [],
    displayTree: { roots: [], unattached: [] },
    statusCounts: { '一致': 358, '表記ゆれ一致': 0, '不一致': 2, '需确认': 27, '未匹配': 0 },
    businessRole: '編集CSV：ダウンロード時点の管理画面の現在状態と比較しています。',
    diagnostics: [],
  };
  const view = api.renderTverRun(run, { activeLevel: 'Campaign', filters: { level: 'all', status: 'all', abnormalOnly: false, keyword: '' }, document: null });
  assert.deepEqual(JSON.parse(JSON.stringify(view.statusCounts)), run.statusCounts);
  assert.equal((view.html.match(/class="status-count /g) || []).length, 3);
  assert.doesNotMatch(view.html, /class="role-note"/);
  assert.doesNotMatch(view.html, /編集CSV：ダウンロード時点の管理画面の現在状態と比較しています。/);
});

test('UI-FIX1: toolbar 通过既有 flex 布局保持控件同行并在小窗口允许换行', () => {
  const source = read(tverPath);
  assert.match(source, /\.tver-action-result\{[^}]*display:flex[^}]*align-items:center[^}]*gap:10px/);
  assert.match(source, /\.tver-result-summary \.status-counts\{[^}]*display:flex[^}]*align-items:center[^}]*gap:10px/);
  assert.match(source, /\.tver-result-summary \.status-count\{[^}]*display:flex[^}]*align-items:center/);
  assert.match(source, /\.tver-action-result \.btn,\.tver-result-summary \.status-count\{[^}]*min-height:46px/);
  assert.match(source, /@media\(max-width:760px\)[\s\S]*?\.tver-result-summary\{[^}]*flex-basis:100%/);
});
