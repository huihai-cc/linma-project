// Vercel Routing Middleware：只拦截 BPO 报告书相关路径
// - 每次请求解封 HttpOnly Cookie 中的 GAS Token，并调用 GAS 复验管理者权限
// - 未通过 → 返回不含报告正文的认证交换页（并清除旧 Cookie）
// - 放行协议：官方 @vercel/functions next() 使用的 x-middleware-next=1 响应头
// - 共享核心使用 CommonJS：Vercel 将 middleware.ts 编译为 CJS，静态 import .mjs 会 ERR_REQUIRE_ESM
const core = require('./lib/bpo-auth-core.cjs');
const gateModule = require('./lib/bpo-gate-html.cjs');

const {
  verifyCookie, parseCookies, getSecret, openToken,
  verifyManagerWithGas, buildClearCookie, NO_STORE_HEADERS,
} = core;
const GATE_HTML = gateModule.GATE_HTML;

export const config = {
  matcher: [
    '/bpo_weekly_report_malin.html',
    '/bpo_weekly_report_malin.html/',
    '/bpo_weekly_report_malin%2Ehtml',
    '/bpo_weekly_report_malin%2ehtml',
    '/BPO_WEEKLY_REPORT_MALIN.HTML',
  ],
  runtime: 'nodejs',
};

function passThrough() {
  return new Response(null, { status: 200, headers: { 'x-middleware-next': '1', ...NO_STORE_HEADERS } });
}

function gate() {
  return new Response(GATE_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...NO_STORE_HEADERS,
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Set-Cookie': buildClearCookie(),
    },
  });
}

export default async function middleware(request) {
  try {
    const secret = getSecret();
    const cookies = parseCookies(request.headers.get('cookie') || '');
    const payload = verifyCookie(cookies.qc_bpo_auth, secret);
    if (!payload) return gate();
    const token = openToken(payload.t, secret);
    if (!token) return gate();
    const result = await verifyManagerWithGas(token);
    if (result.ok) return passThrough();
  } catch (e) {
    // 环境变量缺失 / 解封失败 / GAS 异常：一律拒绝
  }
  return gate();
}
