'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');

function createStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    dump() { return { ...store }; },
  };
}

function fakeDate(now) {
  class FakeDate extends Date {
    static now() { return now; }
  }
  FakeDate.parse = Date.parse;
  FakeDate.UTC = Date.UTC;
  return FakeDate;
}

function loadCaseSession(now, storage) {
  let uuidCounter = 0;
  const context = {
    Date: fakeDate(now),
    JSON,
    Math,
    crypto: { randomUUID: () => 'session-' + now + '-' + (++uuidCounter) },
    localStorage: storage,
    console: { warn() {}, error() {} },
  };
  context.window = context;
  vm.runInNewContext(
    fs.existsSync(path.join(projectRoot, 'qc-case-session.js'))
      ? fs.readFileSync(path.join(projectRoot, 'qc-case-session.js'), 'utf8')
      : '',
    context,
    { filename: 'qc-case-session.js' },
  );
  return context.QCCaseSession;
}

function loadAuth(storage, requests) {
  const context = {
    Date,
    JSON,
    Math,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    localStorage: storage,
    window: { location: { pathname: '/amazon_dsp_check.html', href: '' } },
    alert() {},
    console: { log() {}, info() {}, warn() {}, error() {} },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ ok: true }) };
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(projectRoot, 'qc-auth.js'), 'utf8'), context, {
    filename: 'qc-auth.js',
  });
  return context;
}

function read(name) {
  return fs.readFileSync(path.join(projectRoot, name), 'utf8');
}

test('案件 Session 创建时立即写入 10 分钟 TTL，并可按用户取得有效 Session', () => {
  const now = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(now, storage);
  assert.ok(api, 'qc-case-session.js should expose QCCaseSession');

  const scopeKey = 'amazon:amazon_dsp';
  const created = api.createCaseSession(scopeKey, '  案件 Alpha  ', { email: 'user@example.com' });
  assert.deepEqual(JSON.parse(JSON.stringify(created)), {
    caseName: '案件 Alpha',
    sessionId: 'session-1700000000000-1',
    userEmail: 'user@example.com',
    lastUsedAt: now,
    expiresAt: now + 10 * 60 * 1000,
  });
  assert.deepEqual(JSON.parse(storage.dump().qc_case_sessions)[scopeKey], JSON.parse(JSON.stringify(created)));
  assert.deepEqual(JSON.parse(JSON.stringify(api.getActiveCaseSession(scopeKey, { email: 'user@example.com' }))),
    JSON.parse(JSON.stringify(created)));
  assert.equal(api.getActiveCaseSession(scopeKey, { email: 'other@example.com' }), null);
});

test('案件名为空时不能创建；过期后必须重新 gate', () => {
  const now = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(now, storage);
  const scopeKey = 'dv360:youtube';
  assert.throws(() => api.createCaseSession(scopeKey, '   ', { email: 'user@example.com' }), /案件名不能为空/);
  const first = api.ensureCaseSession(scopeKey, { email: 'user@example.com' }, () => '案件 Beta');
  assert.equal(first.created, true);
  const expiredApi = loadCaseSession(now + 10 * 60 * 1000, storage);
  assert.equal(expiredApi.getActiveCaseSession(scopeKey, { email: 'user@example.com' }), null);
  const second = expiredApi.ensureCaseSession(scopeKey, { email: 'user@example.com' }, () => '案件 Gamma');
  assert.equal(second.created, true);
  assert.equal(second.session.caseName, '案件 Gamma');
});

test('10 分钟内沿用旧 Session，変更会立即生成新的 sessionId', () => {
  const now = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(now, storage);
  const scopeKey = 'amazon:amazon_pva';
  const first = api.ensureCaseSession(scopeKey, { email: 'user@example.com' }, () => '案件 Alpha');
  const reused = api.ensureCaseSession(scopeKey, { email: 'user@example.com' }, () => {
    throw new Error('active session should not prompt');
  });
  assert.equal(reused.created, false);
  assert.equal(reused.session.sessionId, first.session.sessionId);

  const changed = api.changeCaseSession(scopeKey, '案件 Beta', { email: 'user@example.com' });
  assert.notEqual(changed.sessionId, first.session.sessionId);
  assert.equal(changed.caseName, '案件 Beta');
  assert.equal(changed.lastUsedAt, now);
  assert.equal(changed.expiresAt, now + 10 * 60 * 1000);
});

test('执行 snapshot 固定日志案件；成功 touch 延长 TTL，用户中途変更时不覆盖新 Session', () => {
  const start = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(start, storage);
  const scopeKey = 'amazon:amazon_dsp';
  const first = api.createCaseSession(scopeKey, '案件 Alpha', { email: 'user@example.com' });
  const snapshot = api.snapshotCaseSession(scopeKey, first);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    scopeKey,
    caseName: '案件 Alpha',
    sessionId: first.sessionId,
  });

  const successAt = start + 90_000;
  const successApi = loadCaseSession(successAt, storage);
  const touched = successApi.touchCaseSession(snapshot, { email: 'user@example.com' });
  assert.equal(touched.lastUsedAt, successAt);
  assert.equal(touched.expiresAt, successAt + 10 * 60 * 1000);

  const changed = successApi.changeCaseSession(scopeKey, '案件 Beta', { email: 'user@example.com' });
  const laterApi = loadCaseSession(successAt + 1_000, storage);
  assert.equal(laterApi.touchCaseSession(snapshot, { email: 'user@example.com' }), null);
  assert.deepEqual(JSON.parse(storage.dump().qc_case_sessions)[scopeKey], JSON.parse(JSON.stringify(changed)));
});

test('sendLog 保持旧调用兼容，并在新调用中发送 caseName / caseSessionId', async () => {
  const storage = createStorage({
    qc_session: JSON.stringify({ token: 'test-token', user: { email: 'user@example.com' } }),
  });
  const requests = [];
  const auth = loadAuth(storage, requests);
  await auth.sendLog('旧工具', 2, 1, 'old note');
  await auth.sendLog('DV360设定检查', 3, 1, 'new note', '案件 Alpha', 'session-1');

  const oldPayload = JSON.parse(requests[0].options.body);
  const newPayload = JSON.parse(requests[1].options.body);
  assert.equal(oldPayload.caseName, '', '旧 sendLog 调用应发送空案件名');
  assert.equal(oldPayload.caseSessionId, '', '旧 sendLog 调用应发送空 Session ID');
  assert.equal(newPayload.caseName, '案件 Alpha');
  assert.equal(newPayload.caseSessionId, 'session-1');
});

test('Code.gs 只在 handleLog 追加 J/K，summary 与 Trigger 契约保持旧结构', () => {
  const gs = read('Code.gs');
  const handleStart = gs.indexOf('function handleLog(');
  const summaryStart = gs.indexOf('function rebuildSummary(');
  assert.ok(handleStart >= 0 && summaryStart > handleStart);
  const handleBlock = gs.slice(handleStart, summaryStart);
  assert.match(handleBlock, /caseName/);
  assert.match(handleBlock, /caseSessionId/);
  assert.match(handleBlock, /monthLabel/);
  assert.match(handleBlock, /caseName\s*\|\|\s*''/);
  assert.match(handleBlock, /caseSessionId\s*\|\|\s*''/);
  assert.match(gs, /key = dateStr \+ '\\|' \+ email \+ '\\|' \+ tool/);
  assert.match(gs, /const SUMMARY_HEADERS\s*=\s*\[/);
  assert.match(gs, /'備考',\s*\/\/ L:/);
  assert.match(gs, /targetFunction\s*=\s*'rebuildSummary'/);
  const rebuildBlock = gs.slice(summaryStart, gs.indexOf('const CASE_SUMMARY_HEADERS'));
  assert.doesNotMatch(rebuildBlock, /caseSessionId|caseName/);
});

test('Amazon/DV360 只在既定执行入口接入 shared Session，并保留首页与核心比较入口', () => {
  const amazon = read('amazon_dsp_check.html');
  const dv = read('dv360_check.html');
  assert.match(amazon, /<script\s+src=["']qc-case-session\.js["']/);
  assert.match(dv, /<script\s+src=["']qc-case-session\.js["']/);
  assert.match(amazon, /QCCaseSession\.ensureCaseSession/);
  assert.match(amazon, /QCCaseSession\.snapshotCaseSession/);
  assert.match(amazon, /QCCaseSession\.touchCaseSession/);
  assert.match(dv, /QCCaseSession\.ensureCaseSession/);
  assert.match(dv, /QCCaseSession\.snapshotCaseSession/);
  assert.match(dv, /QCCaseSession\.touchCaseSession/);
  assert.match(amazon, /function checkAmazon\(/);
  assert.match(dv, /function buildComparisonTree\(/);
  assert.match(dv, /async function runCheck\(/);
  assert.match(amazon, /scCheckRunning/);
  assert.match(dv, /dvCheckRunning/);
  assert.match(amazon, /sendLog\([\s\S]*executionCase/);
  assert.match(dv, /sendLog\([\s\S]*executionCase/);
  const amazonRender = amazon.slice(amazon.indexOf('function renderScResult('), amazon.indexOf('// ===== 以下、既存関数'));
  assert.equal((amazonRender.match(/sendLog\(/g) || []).length, 2,
    'Amazon 初期/CR追加两条分支各自只有一个日志调用点');
  const dvRenderStart = dv.indexOf('function renderStats(');
  const dvRender = dv.slice(dvRenderStart, dv.indexOf('// ===== Phase 6:', dvRenderStart));
  assert.equal((dvRender.match(/sendLog\(/g) || []).length, 1,
    'DV360 renderStats 只有一个日志调用点');
  assert.match(amazon, /if\(scCheckRunning\) return;/);
  assert.match(dv, /if\(dvCheckRunning\) return;/);
  assert.doesNotMatch(read('index.html'), /qc_case_session|qc-case-session/);
});
