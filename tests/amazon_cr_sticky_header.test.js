// Creative detail header uses its own scrollport; no browser or GUI automation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'amazon_dsp_check.html');
const sourceHtml = fs.readFileSync(htmlPath, 'utf8');
const stylesheet = sourceHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';

function renderCreative() {
  const source = [...sourceHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('renderCreativeResultSection'));
  assert.ok(source);
  const code = source.replace(/\}\)\(\);\s*$/, '\nwindow.__renderCreative = renderCreativeResultSection;\n})();');
  const element = () => ({ addEventListener() {}, classList: { add() {}, remove() {} },
    style: {}, value: '', innerHTML: '' });
  const document = { body: element(), documentElement: element(),
    getElementById() { return element(); }, addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; } };
  const sandbox = { Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: {}, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch])); },
    setTimeout() { return 1; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {},
    sendLog() { return Promise.resolve({}); } };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: htmlPath });
  return sandbox.__renderCreative({
    caseMode: 'initial', settingCount: 1, normalScopeCount: 1, downloadMatchedCount: 1,
    notFoundCount: 0, dateTimeMismatchCount: 0, statusMismatchCount: 0,
    items: [{ liName: 'LI_1', creativeName: 'CR_1', matchStatus: 'match',
      settingSource: null, downloadSource: null, fields: {} }],
  });
}

test('RED to GREEN: only Creative header cells are sticky, opaque and below floating Navigator', () => {
  const rule = stylesheet.match(/\.sc-cr-resize-table\s+thead\s+th\s*\{([^}]*)\}/)?.[1];
  assert.ok(rule, 'Creative-only header rule exists');
  assert.match(rule, /position\s*:\s*sticky\s*;/);
  assert.match(rule, /top\s*:\s*0\s*;/);
  assert.match(rule, /background\s*:\s*#[0-9a-f]{6}\s*;/i);
  const zIndex = Number(rule.match(/z-index\s*:\s*(\d+)\s*;/)?.[1]);
  assert.ok(zIndex > 0 && zIndex < 1000);
  assert.match(stylesheet, /\.qc-mismatch-nav-floating\s*\{[^}]*position\s*:\s*fixed\s*;[^}]*z-index\s*:\s*1000\s*;/s);
});

test('Creative thead and tbody share the existing vertical and horizontal scrollport', () => {
  const html = renderCreative();
  assert.match(html, /<div class="sc-cr-scroll" style="[^"]*overflow:auto;[^"]*max-height:620px;[^"]*">/);
  const scrollContents = html.match(/<div class="sc-cr-scroll"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/)?.[1];
  assert.ok(scrollContents);
  assert.match(scrollContents, /<table class="sc-cr-resize-table"[\s\S]*?<thead>[\s\S]*?<tbody>[\s\S]*?<\/tbody>\s*<\/table>/);
  assert.equal((scrollContents.match(/<table\b/g) || []).length, 1);
  assert.doesNotMatch(html.match(/<section[^>]*>/)?.[0] || '', /position\s*:\s*sticky/);
});

test('Creative sticky selector does not target the main Amazon result table', () => {
  const rule = stylesheet.match(/\.sc-cr-resize-table\s+thead\s+th\s*\{([^}]*)\}/)?.[0] || '';
  assert.ok(rule);
  assert.doesNotMatch(rule, /#sc-main-table|#sc-head-table|\.qc-mismatch-nav-floating/);
  const html = renderCreative();
  assert.match(html, /<th[^>]*>LI名/);
  assert.match(html, /<th[^>]*>配信開始時間/);
  assert.match(html, /class="sc-cr-resizer"/);
});
