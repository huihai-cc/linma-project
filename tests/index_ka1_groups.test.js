'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

function evaluateArray(pattern, label) {
  const match = html.match(pattern);
  assert.ok(match, label + ' array was not found');
  return vm.runInNewContext('(' + match[1] + ')');
}

const tools = evaluateArray(
  /var TOOLS=(\[[\s\S]*?\]);\s*var (?:KA1_SUBGROUPS|GROUPS)=/,
  'TOOLS'
);
const subgroups = evaluateArray(
  /var KA1_SUBGROUPS=(\[[\s\S]*?\]);\s*var GROUPS=/,
  'KA1_SUBGROUPS'
);

assert.deepEqual(
  Array.from(subgroups, function(group) {
    return [group.id, group.label, group.color, group.tint, group.textColor];
  }),
  [
    ['settings', '設定チェック', '#2f7fb8', '#eaf4fb', '#245b82'],
    ['manuscript', '原稿作成・入稿', '#d9822b', '#fff4e8', '#945417'],
    ['shared', '課内共通', '#3c9267', '#ebf7ef', '#286b48']
  ]
);

const ka1Tools = Array.from(tools).filter(function(tool) {
  return tool.group === 'ka1';
});
assert.equal(ka1Tools.length, 6);

function assertTool(name, subgroup, href) {
  const matches = ka1Tools.filter(function(tool) { return tool.name === name; });
  assert.equal(matches.length, 1, name + ' should appear exactly once');
  assert.equal(matches[0].subgroup, subgroup, name + ' subgroup');
  assert.equal(matches[0].href, href, name + ' href');
  assert.notEqual(matches[0].disabled, true, name + ' should be clickable');
}

assertTool('Amazon DSP 設定チェック', 'settings', 'amazon_dsp_check.html');
assertTool('DV360 設定チェック', 'settings', 'dv360_check.html');
assertTool('読売専用 アップロード', 'manuscript', 'upload.html');
assertTool('読売ルール管理', 'manuscript', 'yomiko_kanri.html');
assertTool('原稿配列ジェネレーター', 'manuscript', 'manuscript_array_generator.html');
assertTool('地域表記変換チェック', 'shared', 'region_check.html');

assert.match(html, /class="ka1-subgroups"/);
assert.match(html, /class="tool-subgroup"/);
assert.match(html, /querySelectorAll\('\.tool-subgroup'\)/);
assert.match(html, /function getKa1Subgroup\(tool\)/);
assert.match(html, /--subgroup-color:/);
assert.match(html, /requester:'马林'[\s\S]*title:'DV360设定校正上线'/,
  'DV360 release update should be listed for 马林');

console.log('PASS 1課の三分組と6つの入口');
