'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.html');

function updateLogEntries(source) {
  const start = source.indexOf('var UPDATE_LOG=[');
  assert.notEqual(start, -1, 'UPDATE_LOG declaration must exist');
  const end = source.indexOf('\n];', start);
  assert.notEqual(end, -1, 'UPDATE_LOG must be closed');
  return source.slice(start, end).split(/\r?\n/)
    .filter(line => line.startsWith('  {'));
}

const expectedEntries = [
  "  {date:'2026/10/19',requester:'劉 麗偉',type:'improve',tool:'TVer',title:'TVer Ad Groupマッチング精度改善',title_ja:'TVer Ad Groupマッチング精度改善',detail:'AXA生命案件で発生したAd Groupの照合不具合を修正しました。ターゲティング番号の全角・半角数字に対応し、Ad GroupとAdの紐付け精度を改善しました。また、デバイス設定の実際の差異を正しく検出できるようにしました。',detail_ja:'AXA生命案件で発生したAd Groupの照合不具合を修正しました。ターゲティング番号の全角・半角数字に対応し、Ad GroupとAdの紐付け精度を改善しました。また、デバイス設定の実際の差異を正しく検出できるようにしました。',summary:'AXA生命案件のAd Group照合を修正し、全角・半角のターゲティング番号と実際のデバイス差異に対応。',summary_ja:'AXA生命案件のAd Group照合を修正し、全角・半角のターゲティング番号と実際のデバイス差異に対応。',note:''},",
  "  {date:'2026/10/19',requester:'劉 麗偉',type:'improve',tool:'TVer',title:'TVer オークションタイプのチェック対象見直し',title_ja:'TVer オークションタイプのチェック対象見直し',detail:'現場および日本側の確認結果を踏まえ、システム側で自動決定されるオークションタイプをチェック対象外に変更しました。これにより、判定根拠のない不一致表示を解消しました。',detail_ja:'現場および日本側の確認結果を踏まえ、システム側で自動決定されるオークションタイプをチェック対象外に変更しました。これにより、判定根拠のない不一致表示を解消しました。',summary:'オークションタイプを校正対象外とし、判定根拠のない不一致表示を解消。',summary_ja:'オークションタイプを校正対象外とし、判定根拠のない不一致表示を解消。',note:''},",
];
test('首页 UPDATE_LOG 前部追加两条TVer更新记录且历史记录保持不变', () => {
  const currentSource = fs.readFileSync(indexPath, 'utf8');
  const baselineSource = childProcess.execFileSync('git', ['show', 'HEAD:index.html'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const currentEntries = updateLogEntries(currentSource);
  const baselineEntries = updateLogEntries(baselineSource);
  const baselineIncludesTverEntries = expectedEntries.every((entry, index) => baselineEntries[index] === entry);
  const historicalEntries = baselineIncludesTverEntries
    ? baselineEntries.slice(expectedEntries.length)
    : baselineEntries;

  assert.deepEqual(currentEntries.slice(0, expectedEntries.length), expectedEntries);
  assert.deepEqual(currentEntries.slice(expectedEntries.length), historicalEntries);
  assert.equal(currentEntries.length, historicalEntries.length + expectedEntries.length);
});
