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

const expectedEntry = "  {date:'2026/09/03',requester:'林琳',type:'add',tool:'Amazon DSP / DV360 設定チェック',title:'案件名统计与后台案件汇总功能追加',title_ja:'案件名記録・案件別集計機能を追加',detail:'Amazon DSP / DV360 設定チェック実行時に案件名を入力し、同一媒体・同一タイプでは10分間自動保持できるようにしました。案件変更にも対応し、利用者・媒体・案件ごとの実行履歴を后台 logs に記録。あわせて案件別の実行回数・差異件数・初回／最終利用時間を case_summary に自動集計します。',detail_ja:'Amazon DSP / DV360 設定チェック実行時に案件名を入力し、同一媒体・同一タイプでは10分間自動保持できるようにしました。案件変更にも対応し、利用者・媒体・案件ごとの実行履歴を logs に記録します。さらに案件別の実行回数・差異件数・初回／最終利用時間を case_summary に自動集計します。',summary:'Amazon DSP / DV360 校正新增案件名输入、10分钟保持、案件変更及后台案件级统计。',summary_ja:'Amazon DSP / DV360 に案件名入力・10分保持・案件変更・案件別集計を追加。',note:''},";

test('首页 UPDATE_LOG 仅在最前面追加案件统计记录，历史记录保持不变', () => {
  const currentSource = fs.readFileSync(indexPath, 'utf8');
  const baselineSource = childProcess.execFileSync('git', ['show', 'HEAD:index.html'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const currentEntries = updateLogEntries(currentSource);
  const baselineEntries = updateLogEntries(baselineSource);

  assert.equal(currentEntries[0], expectedEntry);
  assert.deepEqual(currentEntries.slice(1), baselineEntries);
  assert.equal(currentEntries.length, baselineEntries.length + 1);
});
