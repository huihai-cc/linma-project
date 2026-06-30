// ============================================================
// 惠海 QC ポータル - 共享认证 & 日志模块 qc-auth.js
// GAS URL 需要在部署后替换
// ============================================================

// ⚠️ 部署GAS后，把下面的URL替换为实际的Web App URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyjzKwirxa1Fk4MG_pT5fFSpmevfOAgTldUdO3dvP3WFEDlzu5VRIfC9aUfbbywCqFV/exec';

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
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    });
    const result = await resp.json();
    return result;
  } catch (e) {
    console.error('API Error:', e);
    return { ok: false, error: '网络错误: ' + e.message };
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
  const session = getSession();
  if (!session) return { ok: false, error: '未登录' };
  return await apiCall('log', {
    token: session.token,
    tool: tool,
    diffCount: diffCount || 0,
    criticalCount: criticalCount || 0,
    note: note || ''
  });
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
