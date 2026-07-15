// ============================================================
// 惠海 QC ポータル - 共享认证 & 日志模块 qc-auth.js
// GAS URL 需要在部署后替换
// ============================================================

// ⚠️ 部署GAS后，把下面的URL替换为实际的Web App URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw8vN6yeZ4Mrphhdojd7T69hwQM_LM_OZnjgHrZub1EYHkZ4oEol6vrQfNrk1xEXjEF/exec';

// ==================== 认证检查 ====================

function checkAuth() {
  const session = getSession();
  if (!session || !session.token) {
    // 未登录，跳回主页
    if (window.location.pathname.indexOf('index.html') === -1 && window.location.pathname !== '/' && window.location.pathname !== '') {
      window.location.href = 'index.html';
    }
    return null;
  }
  // ★ 客户端侧校验 token 是否过期（base64 解码，无需请求 GAS）
  try {
    const decoded = atob(session.token);
    const parts = decoded.split('|');
    const expiry = parseInt(parts[1]);
    if (!isNaN(expiry) && Date.now() > expiry) {
      localStorage.removeItem('qc_session');
      if (!window._qc_token_expired) {
        window._qc_token_expired = true;
        alert('ログイン状態が期限切れです。再ログインしてください。\n登录状态已过期，请重新登录。');
        window.location.href = 'index.html';
      }
      return null;
    }
  } catch(e) {
    // token 解析失败，清除登录状态
    localStorage.removeItem('qc_session');
    window.location.href = 'index.html';
    return null;
  }
  return session.user;
}

function getSession() {
  try {
    const raw = localStorage.getItem('qc_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getUser() {
  const session = getSession();
  return session ? session.user : null;
}

function logout() {
  localStorage.removeItem('qc_session');
  window.location.href = 'index.html';
}

// ==================== API 调用 ====================

async function apiCall(action, data) {
  try {
    // 用 text/plain 避免 CORS preflight（GAS 不支持 OPTIONS）
    var fetchStart = Date.now();
    var payload = JSON.stringify({ action: action, tool: data.tool, diffCount: data.diffCount, criticalCount: data.criticalCount, note: data.note, hasToken: !!data.token });
    console.info('[apiCall] fetching', { action: action, endpoint: GAS_URL.substring(0, 60) + '...' });
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    });
    console.info('[apiCall] response status', { action: action, status: resp.status, statusText: resp.statusText, durationMs: Date.now() - fetchStart });
    var responseText = await resp.text();
    console.info('[apiCall] response body', { action: action, body: responseText.substring(0, 200) });
    const result = JSON.parse(responseText);
    // 统一处理 token 过期 / 未授权（只对 log 等需要 token 的接口返回）
    if (!result.ok && result.error && (
      result.error.includes('Token') || result.error === '未授权'
    )) {
      console.warn('[apiCall] token expired, clearing session');
      localStorage.removeItem('qc_session');
      if (!window._qc_token_expired) {
        window._qc_token_expired = true;
        alert('ログイン状態が期限切れです。再ログインしてください。\n登录状态已过期，请重新登录。');
        window.location.href = 'index.html';
      }
      return { ok: false, error: '登录已过期' };
    }
    return result;
  } catch (e) {
    console.error('[apiCall] failed', { action: action, name: e && e.name, message: e && e.message });
    return { ok: false, error: '网络错误: ' + (e && e.message) };
  }
}

async function loginUser(email, password) {
  const result = await apiCall('login', { email, password });
  if (result.ok) {
    localStorage.setItem('qc_session', JSON.stringify({
      token: result.token,
      user: result.user
    }));
  }
  return result;
}

// 发送验证码（注册第一步）
async function sendVerifyCode(email, name, password, department) {
  return await apiCall('sendCode', { email, name, password, department });
}

// 验证码确认（注册第二步）
async function verifyEmailCode(email, code) {
  return await apiCall('verify', { email, code });
}

async function sendLog(tool, diffCount, criticalCount, note) {
  var session = getSession();
  console.info('[sendLog] start', {
    tool: tool,
    diffCount: diffCount,
    criticalCount: criticalCount,
    note: note,
    hasSession: !!session,
    hasToken: !!(session && session.token),
    tokenLength: (session && session.token) ? String(session.token).length : 0,
    endpoint: GAS_URL ? GAS_URL.substring(0, 60) + '...' : 'undefined'
  });
  if (!session) {
    console.warn('[sendLog] blocked: no session');
    return { ok: false, error: '未登录' };
  }
  try {
    var result = await apiCall('log', {
      token: session.token,
      tool: tool,
      diffCount: diffCount || 0,
      criticalCount: criticalCount || 0,
      note: note || ''
    });
    console.info('[sendLog] response', { ok: result.ok, error: result.error, tool: tool });
    return result;
  } catch(e) {
    console.error('[sendLog] failed', { name: e && e.name, message: e && e.message, tool: tool });
    return { ok: false, error: 'sendLog error: ' + (e && e.message) };
  }
}

// ==================== 页面级认证守卫 ====================

// 在非 index.html 的工具页面中调用此函数
function guardPage() {
  const user = checkAuth();
  if (!user) return false;
  // 在控制台显示当前用户
  console.log('QC Portal - 当前用户:', user.name, '|', user.email);
  return user;
}
