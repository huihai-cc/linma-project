// BPO 报告书服务端认证核心（CommonJS，兼容 Vercel middleware 编译产物）
// - Cookie 只含 AES-256-GCM 加密后的 GAS Token + HMAC + 短过期，HttpOnly 且不可被 JS 读取
// - 每次报告请求都由 middleware 解封 Token 并调用 GAS 复验（权限撤销即时生效）
const crypto = require('node:crypto');

const REPORT_PATH = '/bpo_weekly_report_malin.html';
const COOKIE_NAME = 'qc_bpo_auth';
const AUTH_ENDPOINT = '/api/bpo-report-auth';
const DEFAULT_TTL_SECONDS = 600;
const COOKIE_VERSION = 2;

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow',
};

function requireEnv(name, validate) {
  const value = process.env[name];
  if (!value || !validate(value)) throw new Error('MISSING_ENV:' + name);
  return value;
}
function getSecret() { return requireEnv('QC_BPO_AUTH_SECRET', v => v.length >= 32); }
function getGasUrl() { return requireEnv('GAS_URL', v => /^https?:\/\/[^\s]+$/.test(v)); }
function getTtlSeconds() {
  const raw = process.env.QC_BPO_AUTH_TTL_SECONDS;
  if (!raw) return DEFAULT_TTL_SECONDS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 60 || n > 7200) throw new Error('INVALID_TTL');
  return n;
}
function deriveKey(secret) { return crypto.createHash('sha256').update(secret).digest(); }
function mac(payloadB64, secret) { return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url'); }

function sealToken(token, secret) {
  if (typeof token !== 'string' || !token) throw new Error('INVALID_TOKEN');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ct = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), ct.toString('base64url'), tag.toString('base64url')].join('.');
}
function openToken(sealed, secret) {
  try {
    const parts = String(sealed).split('.');
    if (parts.length !== 3) return null;
    const [iv, ct, tag] = parts.map(x => Buffer.from(x, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch { return null; }
}
function signCookie(token, expiresAtMs, secret) {
  const payload = Buffer.from(JSON.stringify({ v: COOKIE_VERSION, t: sealToken(token, secret), exp: expiresAtMs })).toString('base64url');
  return payload + '.' + mac(payload, secret);
}
function verifyCookie(value, secret, nowMs = Date.now()) {
  if (typeof value !== 'string' || value.length < 24) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = Buffer.from(mac(payloadB64, secret), 'base64url');
  let actual;
  try { actual = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || payload.v !== COOKIE_VERSION || typeof payload.t !== 'string') return null;
  if (!Number.isFinite(payload.exp) || nowMs >= payload.exp) return null;
  return payload;
}
function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    if (key) out[key] = part.slice(i + 1).trim();
  });
  return out;
}
function buildSetCookie(value, ttlSeconds) {
  return COOKIE_NAME + '=' + value + '; Path=' + REPORT_PATH + '; HttpOnly; Secure; SameSite=Lax; Max-Age=' + ttlSeconds;
}
function buildClearCookie() {
  return COOKIE_NAME + '=; Path=' + REPORT_PATH + '; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
async function verifyManagerWithGas(token, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const gasUrl = options.gasUrl || getGasUrl();
  const timeoutMs = options.timeoutMs || 25000;
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return { ok: false, reason: 'INVALID_TOKEN' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'usageStats', token }),
      signal: controller.signal,
    });
    if (!resp || !resp.ok) return { ok: false, reason: 'GAS_HTTP_' + (resp ? resp.status : 'NO_RESPONSE') };
    let data;
    try { data = JSON.parse(await resp.text()); } catch { return { ok: false, reason: 'GAS_BAD_JSON' }; }
    if (!data || data.ok !== true) return { ok: false, reason: data && data.code ? String(data.code) : 'GAS_DENIED' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'GAS_EXCEPTION_' + (e && e.name ? e.name : 'Error') };
  } finally { clearTimeout(timer); }
}

module.exports = {
  REPORT_PATH, COOKIE_NAME, AUTH_ENDPOINT, DEFAULT_TTL_SECONDS, NO_STORE_HEADERS,
  getSecret, getGasUrl, getTtlSeconds, sealToken, openToken, signCookie, verifyCookie,
  parseCookies, buildSetCookie, buildClearCookie, verifyManagerWithGas,
};
