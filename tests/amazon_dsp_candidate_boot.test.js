/**
 * Candidate 起動修正（FIX1）の構造ガードテスト
 *
 * 目的:
 *  1. 検証候補版が docs/.../candidate/ 配下でも依存リソースを解決できること（<base> の存在と深さ）
 *  2. 候補版にテスト専用コードが混入していないこと
 *  3. 正式版へ昇格した際に <base> を消し忘れていないこと（昇格ミスをテストで検出）
 *  4. FIX009〜FIX014 の業務修正が候補版に残っていること
 *  5. 候補版の全インラインスクリプトが構文として成立すること
 *
 * 製品コードは一切変更しない（読み取りのみ）。
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CANDIDATE = path.join(ROOT, 'docs/amazon_dsp/20261022_009_014/candidate/amazon_dsp_check.html');
const OFFICIAL = path.join(ROOT, 'amazon_dsp_check.html');
const cand = () => fs.readFileSync(CANDIDATE, 'utf8');
const offi = () => fs.readFileSync(OFFICIAL, 'utf8');

// 本テストはリポジトリ配置（docs/.../candidate/）に依存する構造アサーションのため、
// 配置ごと別ディレクトリへ複製した回帰サンドボックスでは自動 skip する。
const LAYOUT = { skip: !fs.existsSync(CANDIDATE) && '候補版が本来の配置に存在しないため skip（サンドボックス実行）' };

test('BOOT-1 候補版は <base> を1つだけ持ち、深さがプロジェクトルートに一致する', LAYOUT, () => {
  const html = cand();
  const tags = [...html.matchAll(/<base\s+href="([^"]*)"\s*\/?>/gi)];
  assert.equal(tags.length, 1, '<base> は候補版に1つだけ必要');
  const href = tags[0][1];
  assert.equal(href, '../../../../', 'candidate/ から4階層上がプロジェクトルート');
  const resolved = path.resolve(path.dirname(CANDIDATE), href);
  assert.equal(path.normalize(resolved), path.normalize(ROOT), '<base> の解決先がプロジェクトルートであること');
});

test('BOOT-2 <base> は最初の script src より前に宣言されている', LAYOUT, () => {
  const html = cand();
  const baseIdx = html.search(/<base\s+href=/i);
  const firstSrcIdx = html.search(/<script\s+src=/i);
  assert.ok(baseIdx >= 0, '<base> が存在すること');
  assert.ok(firstSrcIdx > 0, '外部 script 参照が存在すること');
  assert.ok(baseIdx < firstSrcIdx, '<base> は外部リソース読込より前でなければならない');
});

test('BOOT-3 <base> 解決先に実依存ファイルが存在する', LAYOUT, () => {
  const baseDir = path.resolve(path.dirname(CANDIDATE), '../../../../');
  for (const dep of ['qc-auth.js', 'qc-case-session.js', 'xlsx.full.min.js', 'index.html']) {
    assert.ok(fs.existsSync(path.join(baseDir, dep)), `依存ファイルが見つかりません: ${dep}`);
  }
});

test('BOOT-4 候補版は同一階層相対参照を書き換えていない（昇格差分を最小に保つ）', LAYOUT, () => {
  const html = cand();
  assert.match(html, /<script src="qc-auth\.js"><\/script>/);
  assert.match(html, /<script src="qc-case-session\.js"><\/script>/);
  assert.match(html, /s\.src = 'xlsx\.full\.min\.js';/);
  assert.doesNotMatch(html, /src="\.\.\//, '候補版で ../ 形式のパス書換を行っていないこと');
});

test('BOOT-5 候補版にテスト専用コードが混入していない', LAYOUT, () => {
  const html = cand();
  for (const marker of ['__amazonTestApi', 'require(', 'process.env', 'node:test', 'jsdom']) {
    assert.ok(!html.includes(marker), `テスト専用マーカーが混入: ${marker}`);
  }
});

test('BOOT-6 正式版に <base> 昇格漏れがない（昇格時は必ず除去）', LAYOUT, () => {
  const html = offi();
  assert.doesNotMatch(html, /<base\s+href=/i, '正式版に <base> が残っている＝昇格時に除去し忘れ');
  assert.doesNotMatch(html, /CANDIDATE_ONLY/, '正式版に CANDIDATE_ONLY コメントが残っている');
  assert.doesNotMatch(html, /src="\.\.\/\.\.\//, '正式版に階層相対参照が残っている');
});

test('BOOT-7 FIX009〜FIX014 の業務修正が候補版に残っている', LAYOUT, () => {
  const html = cand();
  const markers = {
    'FIX-UI focusDurationMs=5000': /const focusDurationMs = Number\(options\.focusDurationMs\) \|\| 5000;/,
    'FIX-009 NFKC': /normalize\('NFKC'\)/,
    'FIX-010/013 管理画面設定用': /function _preferManagementLiNameColumn\(/,
    'FIX-011 エリアブロック走査': /function _readAreaBlocksFromRows\(/,
    'FIX-012 AND NOT 接頭辞': /function _stripAudienceOperatorPrefix\(/,
    'FIX-014 候補カタログ': /function _readCandidateCatalogSheet\(/,
  };
  for (const [name, re] of Object.entries(markers)) {
    assert.match(html, re, `業務修正が失われています: ${name}`);
  }
});

test('BOOT-8 候補版の全インラインスクリプトが構文として成立する', LAYOUT, () => {
  const scripts = [...cand().matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 4, 'インラインスクリプトが想定数存在すること');
  scripts.forEach((m, i) => {
    assert.doesNotThrow(() => new vm.Script(m[1]), `script block #${i + 1} の構文エラー`);
  });
});

test('BOOT-9 正式版の SHA256 がリリース封板値のまま変わっていない', () => {
  const crypto = require('node:crypto');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(OFFICIAL)).digest('hex');
  // 2026-10-22 Amazon DSP 009〜014 リリース封板値（昇格時に更新する）
  assert.equal(sha, 'db838fa8a992fee3d1569ad04f1db67c64a2bd125336443bed9f650e09c4b89d',
    '正式版 amazon_dsp_check.html が封板値から変更されている');
});
