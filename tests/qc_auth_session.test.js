// ============================================================
// 认证逻辑测试：首页 getValidSession + 工具页 checkAuth/guardPage + 12小时有效期
// 运行: node tests/qc_auth_session.test.js（工作目录: my-qc-web）
// ============================================================
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// ---- 模拟浏览器环境 ----
function createStorage(initial) {
  const store = Object.assign({}, initial || {});
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _dump: () => store,
  };
}

function newWindowObj(pathname) {
  return { location: { pathname: pathname, href: '' } };
}

// 加载 qc-auth.js 到 vm 沙箱，注入浏览器全局
function loadAuth(env) {
  const code = fs.readFileSync('qc-auth.js', 'utf8');
  const context = {
    console: console,
    Date: Date,
    JSON: JSON,
    Math: Math,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    localStorage: env.storage,
    window: env.windowObj,
    alert: (msg) => env.alerts.push(msg),
    fetch: () => { throw new Error('fetch should not be called in these tests'); },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

// token = base64(email|expiry|sig)，与 GAS generateToken 格式一致
function makeToken(email, expiry) {
  return Buffer.from(email + '|' + expiry + '|sig').toString('base64');
}

function setSession(storage, token, user) {
  storage.setItem('qc_session', JSON.stringify({ token: token, user: user }));
}

let caseCount = 0;
function casePass(name) {
  caseCount++;
  console.log('  ✓ ' + name);
}

// ============================================================
// Case 1: 完全未登录打开首页 → 登录页，工具列表不显示，无弹窗
// ============================================================
{
  const storage = createStorage({});
  const alerts = [];
  const ctx = loadAuth({ storage: storage, windowObj: newWindowObj('/index.html'), alerts: alerts });

  const session = ctx.getValidSession();
  assert.strictEqual(session, null, '无 session 应返回 null');
  let shown = true;
  if (ctx.getValidSession()) { shown = true; } else { shown = false; }
  assert.strictEqual(shown, false, '首页应停留在登录页（不进入 showMain）');
  assert.strictEqual(alerts.length, 0, '首页不应弹窗');
  casePass('Case1 未登录打开首页 → 登录页，无弹窗');
}

// ============================================================
// Case 2: 正常登录（后台返回有效 token）→ 首页显示
// ============================================================
{
  const storage = createStorage({});
  const alerts = [];
  const ctx = loadAuth({ storage: storage, windowObj: newWindowObj('/index.html'), alerts: alerts });
  // 模拟 loginUser 成功后后台返回的 token（expiry = 现在 + 12h）
  setSession(storage, makeToken('user@huihai-info.com', Date.now() + 12 * 60 * 60 * 1000), { name: '测试', email: 'user@huihai-info.com' });

  const session = ctx.getValidSession();
  assert.ok(session, '有效 token 应返回 session');
  assert.strictEqual(session.user.email, 'user@huihai-info.com');
  let shown = false;
  if (ctx.getValidSession()) { shown = true; }
  assert.strictEqual(shown, true, '首页应显示工具列表');
  casePass('Case2 正常登录 → 显示首页');
}

// ============================================================
// Case 3: 有效 token 重新打开首页 → 直接进入首页，无需重新登录
// ============================================================
{
  const storage = createStorage({});
  const alerts = [];
  setSession(storage, makeToken('user@huihai-info.com', Date.now() + 6 * 60 * 60 * 1000), { name: '测试', email: 'user@huihai-info.com' });
  // 模拟重新打开 index.html（新 window，localStorage 保留）
  const ctx = loadAuth({ storage: storage, windowObj: newWindowObj('/index.html'), alerts: alerts });

  assert.ok(ctx.getValidSession(), '有效 token 重新打开首页应保持登录');
  casePass('Case3 有效 token 重开首页 → 直接进入，无需重新登录');
}

// ============================================================
// Case 4: 过期 token 打开首页 → qc_session 被删除 + 登录页 + 无 alert
// ============================================================
{
  const storage = createStorage({});
  const alerts = [];
  setSession(storage, makeToken('user@huihai-info.com', Date.now() - 1000), { name: '测试', email: 'user@huihai-info.com' });
  const ctx = loadAuth({ storage: storage, windowObj: newWindowObj('/index.html'), alerts: alerts });

  const session = ctx.getValidSession();
  assert.strictEqual(session, null, '过期 token 应返回 null');
  assert.strictEqual(storage._dump().qc_session, undefined, 'qc_session 应被删除');
  assert.strictEqual(alerts.length, 0, '首页过期不应弹 alert');
  let shown = true;
  if (ctx.getValidSession()) { shown = true; } else { shown = false; }
  assert.strictEqual(shown, false, '应停留在登录页');
  casePass('Case4 过期 token 打开首页 → 清除 session，登录页，无 alert');
}

// 补充：损坏 token 也应清除（首页静默）
{
  const storage = createStorage({});
  const alerts = [];
  setSession(storage, 'not-a-valid-base64!!!', { name: 'X', email: 'x@y.z' });
  const ctx = loadAuth({ storage: storage, windowObj: newWindowObj('/index.html'), alerts: alerts });
  assert.strictEqual(ctx.getValidSession(), null, '损坏 token 应返回 null');
  assert.strictEqual(storage._dump().qc_session, undefined, '损坏 token 应清除 session');
  assert.strictEqual(alerts.length, 0);
  casePass('补充 损坏 token → 清除 session，无弹窗');
}

// ============================================================
// Case 5: 过期 token 直接访问工具页 → alert 一次 + 跳转 index.html + 不重复弹窗
// ============================================================
{
  const storage = createStorage({});
  const alerts = [];
  setSession(storage, makeToken('user@huihai-info.com', Date.now() - 1000), { name: '测试', email: 'user@huihai-info.com' });
  const w = newWindowObj('/amazon_dsp_check.html');
  const ctx = loadAuth({ storage: storage, windowObj: w, alerts: alerts });

  const user = ctx.checkAuth();
  assert.strictEqual(user, null, 'checkAuth 过期应返回 null');
  assert.strictEqual(alerts.length, 1, '应弹一次过期提示');
  assert.ok(alerts[0].includes('期限切れ') && alerts[0].includes('已过期'), '应为双语提示');
  assert.strictEqual(w.location.href, 'index.html', '应跳转回 index.html');
  // 防重复：第二次调用不再弹窗
  ctx.checkAuth();
  assert.strictEqual(alerts.length, 1, '不应重复弹窗（_qc_token_expired 防重复）');
  casePass('Case5 过期 token 直接访问工具页 → 提示一次 + 回首页，不重复弹窗');
}

// 补充：token 可 Base64 解码但 expiry 为非数字 → checkAuth/guardPage 必须拒绝访问
{
  const storage = createStorage({});
  const alerts = [];
  setSession(storage, makeToken('user@huihai-info.com', 'not-a-number'), { name: '测试', email: 'user@huihai-info.com' });
  const w = newWindowObj('/amazon_dsp_check.html');
  const ctx = loadAuth({ storage: storage, windowObj: w, alerts: alerts });

  assert.strictEqual(ctx.checkAuth(), null, 'expiry 非数字时 checkAuth 应拒绝（guardPage 返回 null）');
  assert.strictEqual(storage._dump().qc_session, undefined, '应清除 qc_session');
  assert.strictEqual(alerts.length, 1, '工具页应提示一次过期');
  assert.strictEqual(w.location.href, 'index.html', '应跳回 index.html');
  // 与 getValidSession() 行为一致：同样拒绝
  assert.strictEqual(ctx.getValidSession(), null, 'getValidSession 也应拒绝非数字 expiry');
  casePass('补充 token 可解码但 expiry 非数字 → 工具页拒绝访问，首页一致');
}

// 补充：无 session 直接访问工具页 → 跳转 index.html，无 alert
{
  const storage = createStorage({});
  const alerts = [];
  const w = newWindowObj('/dv360_check.html');
  const ctx = loadAuth({ storage: storage, windowObj: w, alerts: alerts });
  assert.strictEqual(ctx.checkAuth(), null);
  assert.strictEqual(alerts.length, 0, '未登录不应弹窗');
  assert.strictEqual(w.location.href, 'index.html', '未登录应跳回 index.html');
  casePass('补充 无 session 直接访问工具页 → 跳回首页，无弹窗');
}

// 补充：在 index.html 上调用 checkAuth（无 session）→ 不跳转
{
  const storage = createStorage({});
  const alerts = [];
  const w = newWindowObj('/index.html');
  const ctx = loadAuth({ storage: storage, windowObj: w, alerts: alerts });
  assert.strictEqual(ctx.checkAuth(), null);
  assert.strictEqual(w.location.href, '', '在 index.html 上不应跳转');
  casePass('补充 在 index.html 上 checkAuth 无 session → 不跳转');
}

// ============================================================
// Case 6: 12 小时 Token（后台 Code.gs 生成）
// expiry - 登录时间 = 12h = 43,200,000 ms
// ============================================================
{
  const gs = fs.readFileSync('Code.gs', 'utf8');
  const m = gs.match(/TOKEN_EXPIRY_HOURS\s*=\s*(\d+)/);
  assert.ok(m, 'Code.gs 中应存在 TOKEN_EXPIRY_HOURS');
  assert.strictEqual(parseInt(m[1], 10), 12, 'TOKEN_EXPIRY_HOURS 应为 12');
  assert.ok(gs.includes('expiry.setHours(expiry.getHours() + TOKEN_EXPIRY_HOURS)'), 'generateToken 应使用 TOKEN_EXPIRY_HOURS');
  assert.strictEqual(12 * 60 * 60 * 1000, 43200000, '12小时 = 43,200,000 ms');
  casePass('Case6 Code.gs TOKEN_EXPIRY_HOURS=12 → expiry-登录时间=43,200,000ms');
}

// ============================================================
// Case 7: 重新打开浏览器（12 小时内）→ 保持登录
// ============================================================
{
  const storage = createStorage({});
  const alerts = [];
  // 09:00 登录（expiry = 09:00 + 12h），13:00 重开浏览器
  const loginAt = new Date().setHours(new Date().getHours() - 4); // 4 小时前登录
  setSession(storage, makeToken('user@huihai-info.com', loginAt + 12 * 60 * 60 * 1000), { name: '测试', email: 'user@huihai-info.com' });
  const ctx = loadAuth({ storage: storage, windowObj: newWindowObj('/index.html'), alerts: alerts });

  const session = ctx.getValidSession();
  assert.ok(session, '12 小时内重开浏览器应保持登录');
  assert.strictEqual(alerts.length, 0);
  casePass('Case7 重开浏览器（12小时内）→ 保持登录，无需重新输入');
}

// ============================================================
// 工具页面 guardPage 保护保留检查（直接访问 URL 仍受保护）
// ============================================================
{
  const htmlFiles = fs.readdirSync('.', { encoding: 'utf8' })
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'index.html' && f !== 'meta_interest_qc.html' && f !== 'tver_check.html');
  const protectedPages = [];
  htmlFiles.forEach((f) => {
    const content = fs.readFileSync(f, 'utf8');
    if (/guardPage\(\)/.test(content)) { protectedPages.push(f); }
  });
  assert.ok(protectedPages.length >= 11, '至少 11 个工具页面保留 guardPage，实际: ' + protectedPages.length);
  ['amazon_dsp_check.html', 'dv360_check.html', 'excel_compare.html', 'excel_clean.html']
    .forEach((f) => assert.ok(protectedPages.includes(f), f + ' 应保留 guardPage()'));
  casePass('工具页面 guardPage 保留 (' + protectedPages.length + ' 个页面受保护)');
}

// ============================================================
// 首页初始化代码确实使用 getValidSession()
// ============================================================
{
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('var session=getValidSession();'), 'index.html 初始化应调用 getValidSession()');
  assert.ok(!/var user=getUser\(\);\s*\n\s*if\(user\)\{showMain\(\);\}/.test(html), '首页不应再用 getUser() 判断登录');
  casePass('index.html 首页初始化使用 getValidSession()');
}

console.log('\n✅ 全部 ' + caseCount + ' 组测试通过');
