/**
 * 首页（index.html）更新履歴 — 2026-10-22 Amazon DSP 009〜014 リリース分の構造検証。
 *
 * 検証内容:
 *  1. UPDATE_LOG が JavaScript として妥当で、各エントリが必要フィールドを持つ
 *  2. 2026/10/22 の Amazon DSP エントリが「修正点ごとに 6 件」存在する（要約 1 件にまとめていない）
 *  3. 提出者は 张微、ツール名は Amazon DSP 設定チェック
 *  4. 既存の履歴（最古のエントリ）が削除されていない
 *  5. Amazon DSP ナビゲーション入口が重複追加されていない
 *
 * 製品コードは変更しない（読み取りのみ）。
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const source = fs.readFileSync(INDEX, 'utf8');

const EXPECTED_TITLES = [
  'フリークエンシー（FQ）の全角数字表記に対応',
  '設定シートの「【管理画面設定用】ラインアイテム名」を認識',
  'エリアシートの横並び複数ブロックを LI ごとに照合',
  'Audience の AND NOT（空白なし表記）を正しく解釈',
  'カスタムセグメント参照シート（第N希望・国別デモグラ）の解析に対応',
  '不一致箇所の強調表示を5秒に延長',
];

function loadUpdateLog() {
  const start = source.indexOf('var UPDATE_LOG=[');
  assert.notEqual(start, -1, 'UPDATE_LOG 宣言が存在すること');
  const end = source.indexOf('\n];', start);
  assert.notEqual(end, -1, 'UPDATE_LOG が閉じていること');
  const raw = vm.runInNewContext(`${source.slice(start, end + 3)}\nUPDATE_LOG`);
  // VM サンドボックス生成の配列はプロトタイプが異なるため、ホスト側の配列へ変換する
  return JSON.parse(JSON.stringify(raw));
}

const LOG = loadUpdateLog();
const todayEntries = LOG.filter(e => e.date === '2026/10/22' && e.tool === 'Amazon DSP 設定チェック');

test('HOME-1 UPDATE_LOG が解析でき、全エントリに必須フィールドがある', () => {
  assert.ok(Array.isArray(LOG), 'UPDATE_LOG は配列であること');
  assert.ok(LOG.length > 60, `履歴件数が想定より少ない: ${LOG.length}`);
  for (const e of LOG) {
    if (e.date === '2026/10/22') continue; // 本リリース分は HOME-2 で個別検証
    assert.ok(typeof e.date === 'string' && e.date.length >= 8, 'date 欠落');
    assert.ok(typeof e.requester === 'string' && e.requester.length > 0, `requester 欠落: ${e.date}`);
    assert.ok(typeof e.tool === 'string' && e.tool.length > 0, `tool 欠落: ${e.date}`);
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `title 欠落: ${e.date}`);
  }
});

test('HOME-2 2026/10/22 の Amazon DSP エントリが 6 件（修正点ごとに分割）存在する', () => {
  assert.equal(todayEntries.length, 6, `本リリースのエントリ数: ${todayEntries.length}`);
  assert.deepEqual(todayEntries.map(e => e.title_ja), EXPECTED_TITLES);
});

test('HOME-3 提出者は 张微、日付は 2026/10/22、必須フィールドが埋まっている', () => {
  for (const e of todayEntries) {
    assert.equal(e.requester, '张微', `提出者不一致: ${e.title_ja}`);
    assert.equal(e.date, '2026/10/22');
    assert.equal(e.tool, 'Amazon DSP 設定チェック');
    assert.ok(['fix', 'improve', 'add', 'new'].includes(e.type), `type 不正: ${e.type}`);
    assert.ok(e.detail && e.detail.length > 20, `detail 不足: ${e.title_ja}`);
    assert.ok(e.detail_ja && e.detail_ja.length > 20, `detail_ja 不足: ${e.title_ja}`);
    assert.ok(e.summary && e.summary.length > 5, `summary 不足: ${e.title_ja}`);
    assert.ok(e.summary_ja && e.summary_ja.length > 5, `summary_ja 不足: ${e.title_ja}`);
  }
});

test('HOME-4 既存履歴が削除されていない（最古エントリの保持）', () => {
  const oldest = LOG[LOG.length - 1];
  assert.equal(oldest.date, '2026/07/03', `最古エントリの日付が変わっている: ${oldest.date}`);
  assert.equal(oldest.title, '表格行高可以调整了', `最古エントリの内容が変わっている: ${oldest.title}`);
  // 既知の過去エントリが履歴から消えていないこと（一例）
  assert.ok(LOG.some(e => e.date === '2026/09/24' && /セグメント条件/.test(e.title)),
    '既存の過去エントリが削除されている');
});

test('HOME-5 Amazon DSP ナビゲーション入口が重複していない', () => {
  const refs = (source.match(/href:'amazon_dsp_check\.html'/g) || []).length;
  assert.equal(refs, 1, `Amazon DSP 入口定義の数: ${refs}`);
});

test('HOME-6 index.html のインラインスクリプトが構文として成立する', () => {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1);
  scripts.forEach((m, i) => {
    assert.doesNotThrow(() => new vm.Script(m[1]), `index.html script block #${i + 1} の構文エラー`);
  });
});

test('HOME-7 正式版 amazon_dsp_check.html が封板値である', () => {
  const sha = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, 'amazon_dsp_check.html'))).digest('hex');
  assert.equal(sha, 'db838fa8a992fee3d1569ad04f1db67c64a2bd125336443bed9f650e09c4b89d');
});
