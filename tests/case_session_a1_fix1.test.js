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
    crypto: { randomUUID: () => 'fix1-session-' + now + '-' + (++uuidCounter) },
    localStorage: storage,
    console: { warn() {}, error() {} },
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'qc-case-session.js'), 'utf8'), context, {
    filename: 'qc-case-session.js',
  });
  return context.QCCaseSession;
}

const user = { email: 'user@example.com' };

test('Amazon DSP 与 DV360 不得共享案件 Session', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  const amazon = api.createCaseSession('amazon:amazon_dsp', 'Amazon A', user);
  const dv = api.ensureCaseSession('dv360:youtube', user, () => 'YouTube B');

  assert.equal(dv.created, true, '新媒体 scope 没有有效 Session 时必须重新输入');
  assert.equal(dv.session.caseName, 'YouTube B');
  assert.notEqual(dv.session.sessionId, amazon.sessionId);
  assert.equal(api.getActiveCaseSession('amazon:amazon_dsp', user).caseName, 'Amazon A');
});

test('Amazon 不同 canonical 类型不得共享 Session', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  const dsp = api.createCaseSession('amazon:amazon_dsp', 'DSP A', user);
  const pva = api.ensureCaseSession('amazon:amazon_pva', user, () => 'PVA B');

  assert.equal(pva.created, true);
  assert.notEqual(pva.session.sessionId, dsp.sessionId);
  assert.equal(api.getActiveCaseSession('amazon:amazon_dsp', user).caseName, 'DSP A');
  assert.equal(api.getActiveCaseSession('amazon:amazon_pva', user).caseName, 'PVA B');
});

test('DV360 不同 canonical 类型不得共享 Session', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  const youtube = api.createCaseSession('dv360:youtube', 'YT A', user);
  const display = api.ensureCaseSession('dv360:display', user, () => 'Display B');

  assert.equal(display.created, true);
  assert.notEqual(display.session.sessionId, youtube.sessionId);
  assert.equal(api.getActiveCaseSession('dv360:youtube', user).caseName, 'YT A');
  assert.equal(api.getActiveCaseSession('dv360:display', user).caseName, 'Display B');
});

test('同一 scope 在 10 分钟内继续复用，超过 TTL 才重新输入', () => {
  const start = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(start, storage);
  const first = api.ensureCaseSession('dv360:ott', user, () => 'OTT A');
  const reused = api.ensureCaseSession('dv360:ott', user, () => {
    throw new Error('有效 Session 不应再次要求案件名');
  });
  assert.equal(reused.created, false);
  assert.equal(reused.session.sessionId, first.session.sessionId);

  const expiredApi = loadCaseSession(start + 10 * 60 * 1000, storage);
  const renewed = expiredApi.ensureCaseSession('dv360:ott', user, () => 'OTT B');
  assert.equal(renewed.created, true);
  assert.notEqual(renewed.session.sessionId, first.session.sessionId);
});

test('切到其他 scope 后返回，原 scope 的有效案件可恢复', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  const amazon = api.createCaseSession('amazon:amazon_dsp', 'Amazon A', user);
  api.createCaseSession('dv360:youtube', 'YouTube B', user);

  const returned = api.ensureCaseSession('amazon:amazon_dsp', user, () => {
    throw new Error('原 scope 仍有效，不应重新输入');
  });
  assert.equal(returned.created, false);
  assert.equal(returned.session.sessionId, amazon.sessionId);
  assert.equal(returned.session.caseName, 'Amazon A');
});

test('変更只修改当前 scope，不删除或覆盖其他 scope', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  const amazon = api.createCaseSession('amazon:amazon_dsp', 'Amazon A', user);
  const youtube = api.createCaseSession('dv360:youtube', 'YouTube A', user);
  const changed = api.changeCaseSession('dv360:youtube', 'YouTube B', user);

  assert.notEqual(changed.sessionId, youtube.sessionId);
  assert.equal(api.getCaseSession('amazon:amazon_dsp').sessionId, amazon.sessionId);
  assert.equal(api.getCaseSession('amazon:amazon_dsp').caseName, 'Amazon A');
  assert.equal(api.getCaseSession('dv360:youtube').caseName, 'YouTube B');
});

test('不同 scope 的 sessionId 必须不同', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  const ids = [
    api.createCaseSession('amazon:amazon_dsp', 'A', user).sessionId,
    api.createCaseSession('amazon:amazon_pva', 'B', user).sessionId,
    api.createCaseSession('dv360:youtube', 'C', user).sessionId,
    api.createCaseSession('dv360:display', 'D', user).sessionId,
  ];
  assert.equal(new Set(ids).size, ids.length);
});

test('各 scope TTL 独立：touch 一个 scope 不会延长另一个 scope', () => {
  const start = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(start, storage);
  const amazon = api.createCaseSession('amazon:amazon_dsp', 'Amazon A', user);
  api.createCaseSession('dv360:youtube', 'YouTube A', user);
  const snapshot = api.snapshotCaseSession('amazon:amazon_dsp', amazon);

  const touchApi = loadCaseSession(start + 5 * 60 * 1000, storage);
  const touched = touchApi.touchCaseSession(snapshot, user);
  assert.equal(touched.lastUsedAt, start + 5 * 60 * 1000);

  const laterApi = loadCaseSession(start + 11 * 60 * 1000, storage);
  assert.ok(laterApi.getActiveCaseSession('amazon:amazon_dsp', user));
  assert.equal(laterApi.getActiveCaseSession('dv360:youtube', user), null);
});

test('userEmail 隔离继续有效，并且不同用户不会读取其他用户的 scope Session', () => {
  const storage = createStorage();
  const api = loadCaseSession(1_700_000_000_000, storage);
  api.createCaseSession('amazon:amazon_dsp', 'User A case', user);
  assert.equal(api.getActiveCaseSession('amazon:amazon_dsp', { email: 'other@example.com' }), null);

  const other = api.ensureCaseSession('amazon:amazon_dsp', { email: 'other@example.com' }, () => 'User B case');
  assert.equal(other.created, true);
  assert.equal(api.getActiveCaseSession('amazon:amazon_dsp', user), null);
  assert.equal(api.getActiveCaseSession('amazon:amazon_dsp', { email: 'other@example.com' }).caseName, 'User B case');
});

test('execution snapshot 同时冻结 scopeKey、caseName、sessionId', () => {
  const start = 1_700_000_000_000;
  const storage = createStorage();
  const api = loadCaseSession(start, storage);
  const amazon = api.createCaseSession('amazon:amazon_dsp', 'Amazon A', user);
  const snapshot = api.snapshotCaseSession('amazon:amazon_dsp', amazon);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    scopeKey: 'amazon:amazon_dsp',
    caseName: 'Amazon A',
    sessionId: amazon.sessionId,
  });

  api.changeCaseSession('dv360:youtube', 'YouTube B', user);
  const touched = loadCaseSession(start + 30_000, storage).touchCaseSession(snapshot, user);
  assert.equal(touched.caseName, 'Amazon A');
  assert.equal(touched.lastUsedAt, start + 30_000);
  assert.equal(loadCaseSession(start + 30_000, storage).getCaseSession('dv360:youtube').caseName, 'YouTube B');
});

test('A1 的 sendLog 与 Code.gs J/K 契约保持不变', () => {
  const auth = fs.readFileSync(path.join(projectRoot, 'qc-auth.js'), 'utf8');
  const gs = fs.readFileSync(path.join(projectRoot, 'Code.gs'), 'utf8');
  assert.match(auth, /caseName: caseName \|\| ''/);
  assert.match(auth, /caseSessionId: caseSessionId \|\| ''/);
  assert.match(gs, /caseName \|\| '',\s*\/\/ J:/);
  assert.match(gs, /caseSessionId \|\| ''\s*\/\/ K:/);
  assert.match(gs, /const SUMMARY_HEADERS\s*=\s*\[/);
  assert.doesNotMatch(gs.slice(gs.indexOf('function rebuildSummary('), gs.indexOf('const CASE_SUMMARY_HEADERS')), /caseName|caseSessionId/);
});

test('两页使用现有 canonical 类型生成 scoped key，并将 gate 放在类型确定后、比较前', () => {
  const amazon = fs.readFileSync(path.join(projectRoot, 'amazon_dsp_check.html'), 'utf8');
  const dv = fs.readFileSync(path.join(projectRoot, 'dv360_check.html'), 'utf8');
  assert.match(amazon, /amazon:\$\{system\}/);
  assert.match(dv, /dv360:\$\{type\}/);

  const amazonRun = amazon.indexOf('function _runSettingCheck(');
  const amazonAuto = amazon.indexOf('autoDetectAndApply()', amazonRun);
  const amazonGate = amazon.indexOf('ensureScCaseSession(', amazonRun);
  const amazonCompare = amazon.indexOf('_doSettingCheck(', amazonRun);
  assert.ok(amazonAuto < amazonGate && amazonGate < amazonCompare);

  const dvRun = dv.indexOf('async function runCheck(');
  const dvType = dv.indexOf('mediaType=getEffectiveMediaType(autoDetected)', dvRun);
  const dvGate = dv.indexOf('ensureDvCaseSession(', dvRun);
  const dvCompare = dv.indexOf('ensureGeoMasterLoaded()', dvRun);
  assert.ok(dvType < dvGate && dvGate < dvCompare);
  assert.match(amazon, /QCCaseSession\.snapshotCaseSession\(scopeKey/);
  assert.match(dv, /QCCaseSession\.snapshotCaseSession\(scopeKey/);
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'qc-case-session.js'), 'utf8'), /qc_case_session\b/);
});
