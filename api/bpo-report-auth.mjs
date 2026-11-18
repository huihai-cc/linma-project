// 认证交换 / 会话同步入口（Vercel Node Function：默认导出 (req,res)=>void）
// - gate 页面：POST {token}            → GAS 校验后签发报告专属 Cookie
// - 门户首页：POST {mode:'sync',token} → 登录态变化时同步或清除报告 Cookie
// 原始 GAS Token 仅以服务端密钥加密后置于 HttpOnly Cookie，不写 URL / 日志 / 公开 HTML。
import core from '../lib/bpo-auth-core.cjs';
const {
  verifyManagerWithGas, signCookie, buildSetCookie, buildClearCookie,
  getSecret, getTtlSeconds, NO_STORE_HEADERS,
} = core;

function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries({ ...NO_STORE_HEADERS, ...(extraHeaders || {}) })) res.setHeader(k, v);
  res.end(body === null || body === undefined ? undefined : JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
      return;
    }

    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body;
    try { body = JSON.parse(raw || '{}'); }
    catch { send(res, 400, { ok: false, error: 'BAD_REQUEST' }, { 'Set-Cookie': buildClearCookie() }); return; }

    const token = body && body.token;
    if (!token || token.length < 20 || token.length > 4096) {
      send(res, 204, null, { 'Set-Cookie': buildClearCookie() });
      return;
    }

    const result = await verifyManagerWithGas(token);
    if (!result.ok) {
      console.warn('[bpo-auth] GAS verification failed', { reason: result.reason, tokenLength: token.length });
      send(res, 403, { ok: false, error: 'FORBIDDEN' }, { 'Set-Cookie': buildClearCookie() });
      return;
    }

    const secret = getSecret();
    const ttl = getTtlSeconds();
    const value = signCookie(token, Date.now() + ttl * 1000, secret);
    send(res, 204, null, { 'Set-Cookie': buildSetCookie(value, ttl) });
  } catch (e) {
    send(res, 503, { ok: false, error: 'AUTH_UNAVAILABLE' }, { 'Set-Cookie': buildClearCookie() });
  }
}
