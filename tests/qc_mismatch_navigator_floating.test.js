'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addMismatchTarget,
  addSummary,
  createTestNavigator,
  loadNavigatorApi,
  makeNavigatorDom,
  PAGE_CONFIG,
} = require('./qc_mismatch_navigator_test_utils.js');

function setup(page = 'amazon') {
  const dom = makeNavigatorDom();
  const navigator = createTestNavigator(page, dom);
  return { dom, navigator };
}

function floating(document) {
  return document.querySelector('.qc-mismatch-nav-floating');
}

function floatingButton(document, action) {
  return document.querySelector(`[data-qc-nav-action="${action}"]`);
}

function floatingCount(document) {
  const count = document.querySelector('.qc-mismatch-nav-count');
  return count && count.textContent;
}

for (const page of Object.keys(PAGE_CONFIG)) {
  test(`FLOAT-1: ${page} 点击 summary 后显示 Floating Navigator`, () => {
    const { dom, navigator } = setup(page);
    addMismatchTarget(dom.root, 'scope-a');
    const summary = addSummary(dom.root, 'scope-a');
    navigator.bindSummary(summary);

    summary.click();

    assert.ok(floating(dom.document));
    assert.equal(floating(dom.document).hidden, false);
  });
}

for (const page of Object.keys(PAGE_CONFIG)) {
  test(`FLOAT-2: ${page} Floating 使用 fixed 且位于 scroll container 外`, () => {
    const { dom, navigator } = setup(page);
    addMismatchTarget(dom.root, 'scope-a');
    const summary = addSummary(dom.root, 'scope-a');
    navigator.bindSummary(summary);
    summary.click();

    const panel = floating(dom.document);
    assert.equal(panel.style.position, 'fixed');
    assert.equal(dom.root.contains(panel), false);
    assert.match(loadNavigatorApi(page).html, /qc-mismatch-nav-floating[\s\S]{0,300}position\s*:\s*fixed/);
  });
}

test('FLOAT-3: summary 启动当前 scope 的第一个 mismatch 并显示 1 / 2', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'scope-a');
  addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);

  summary.click();

  assert.equal(first.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '1 / 2');
});

test('FLOAT-4: next 导航到第二个 mismatch 并显示 2 / 2', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'scope-a');
  const second = addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();

  floatingButton(dom.document, 'next').click();

  assert.equal(second.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '2 / 2');
});

test('FLOAT-5: next 在最后一个 mismatch 后循环回第一个', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'scope-a');
  addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();
  floatingButton(dom.document, 'next').click();
  floatingButton(dom.document, 'next').click();

  assert.equal(first.scrollIntoViewCalls.length, 2);
  assert.equal(floatingCount(dom.document), '1 / 2');
});

test('FLOAT-6: prev 从第一个 mismatch 循环到最后一个', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'scope-a');
  const last = addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();

  floatingButton(dom.document, 'prev').click();

  assert.equal(last.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '2 / 2');
});

test('FLOAT-7: target 横向滚动后 Floating 仍可直接操作', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'scope-a');
  const second = addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();

  floatingButton(dom.document, 'next').click();

  assert.equal(second.scrollIntoViewCalls[0].inline, 'center');
  assert.equal(floating(dom.document).hidden, false);
});

test('FLOAT-8: 切换另一 scope 后 reset index 并更新 total', () => {
  const { dom, navigator } = setup();
  const a1 = addMismatchTarget(dom.root, 'scope-a');
  addMismatchTarget(dom.root, 'scope-a');
  const b1 = addMismatchTarget(dom.root, 'scope-b');
  addMismatchTarget(dom.root, 'scope-b');
  addMismatchTarget(dom.root, 'scope-b');
  const summaryA = addSummary(dom.root, 'scope-a');
  const summaryB = addSummary(dom.root, 'scope-b');
  navigator.bindSummary(summaryA);
  navigator.bindSummary(summaryB);

  summaryA.click();
  floatingButton(dom.document, 'next').click();
  summaryB.click();

  assert.equal(b1.scrollIntoViewCalls.length, 1);
  assert.equal(a1.classList.contains('qc-mismatch-focus'), false);
  assert.equal(floatingCount(dom.document), '1 / 3');
});

test('FLOAT-9: close 隐藏 Floating、清除 scope/index/focus，并允许重新从第一个开始', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'scope-a');
  addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();
  floatingButton(dom.document, 'next').click();

  floatingButton(dom.document, 'close').click();

  assert.equal(floating(dom.document).hidden, true);
  assert.equal(first.classList.contains('qc-mismatch-focus'), false);
  summary.click();
  assert.equal(first.scrollIntoViewCalls.length, 2);
  assert.equal(floatingCount(dom.document), '1 / 2');
});

test('FLOAT-10: rerender/reset 自动关闭 Floating 并清除 stale state', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'scope-a');
  addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();
  floatingButton(dom.document, 'next').click();

  navigator.resetAll();

  assert.equal(floating(dom.document).hidden, true);
  assert.equal(first.classList.contains('qc-mismatch-focus'), false);
  summary.click();
  assert.equal(first.scrollIntoViewCalls.length, 2);
});

test('FLOAT-11: Review/Skip 不计入 Floating total', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'scope-a', { status: 'review' });
  addMismatchTarget(dom.root, 'scope-a', { status: 'skip' });
  const mismatch = addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);

  summary.click();

  assert.equal(mismatch.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FLOAT-12: hidden mismatch 不计入 Floating visible total', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'scope-a', { display: 'none' });
  const visible = addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);

  summary.click();

  assert.equal(visible.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FLOAT-13: Floating scope isolation 不导航到其他 scope', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'scope-a');
  addMismatchTarget(dom.root, 'scope-a');
  const b1 = addMismatchTarget(dom.root, 'scope-b');
  const summaryA = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summaryA);
  summaryA.click();
  floatingButton(dom.document, 'next').click();
  floatingButton(dom.document, 'next').click();

  assert.equal(b1.scrollIntoViewCalls.length, 0);
  assert.equal(floatingCount(dom.document), '1 / 2');
});

test('FLOAT-14: next 更换 focus target，Floating 本身不闪烁', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'scope-a');
  const second = addMismatchTarget(dom.root, 'scope-a');
  const summary = addSummary(dom.root, 'scope-a');
  navigator.bindSummary(summary);
  summary.click();
  const panel = floating(dom.document);

  floatingButton(dom.document, 'next').click();

  assert.equal(first.classList.contains('qc-mismatch-focus'), false);
  assert.equal(second.classList.contains('qc-mismatch-focus'), true);
  assert.equal(floating(dom.document), panel);
  assert.equal(panel.hidden, false);
});

test('FIX2-RED-1: 新结果生命周期自动显示 Floating，默认仅准备首个目标且不滚动', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'active');
  addMismatchTarget(dom.root, 'active');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('active');

  assert.equal(floating(dom.document).hidden, false);
  assert.equal(floatingCount(dom.document), '1 / 2');
  assert.equal(first.scrollIntoViewCalls.length, 0);
});

test('FIX2-RED-2: 当前 active scope 无可见 mismatch 时自动隐藏 Floating', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'inactive');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('active');

  assert.equal(floating(dom.document).hidden, true);
});

test('FIX2-RED-3: 自动 scope isolation 不包含其他 tab 的 mismatch', () => {
  const { dom, navigator } = setup();
  const active = addMismatchTarget(dom.root, 'active');
  const inactive = addMismatchTarget(dom.root, 'inactive');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('active');
  floatingButton(dom.document, 'next').click();

  assert.equal(active.scrollIntoViewCalls.length, 1);
  assert.equal(inactive.scrollIntoViewCalls.length, 0);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FIX2-RED-4: 自动显示后的 next 才执行真正导航并进入第二个目标', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'active');
  const second = addMismatchTarget(dom.root, 'active');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('active');
  assert.equal(first.scrollIntoViewCalls.length, 0);

  floatingButton(dom.document, 'next').click();

  assert.equal(first.scrollIntoViewCalls.length, 0);
  assert.equal(second.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '2 / 2');
});

test('FIX2-RED-5: local summary 点击切换到 local scope 并立即导航第一个 mismatch', () => {
  const { dom, navigator } = setup();
  const firstLocalTarget = addMismatchTarget(dom.root, 'io-a');
  addMismatchTarget(dom.root, 'io-a');
  const summary = addSummary(dom.root, 'io-a');
  navigator.bindSummary(summary);

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('__all__');
  summary.click();

  assert.equal(firstLocalTarget.scrollIntoViewCalls.length, 1);
  assert.equal(floatingCount(dom.document), '1 / 2');
});

test('FIX2-RED-6: filter/hidden refresh 更新当前 Floating total，但不触发新的滚动', () => {
  const { dom, navigator } = setup();
  const first = addMismatchTarget(dom.root, 'active');
  const second = addMismatchTarget(dom.root, 'active');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  assert.equal(typeof navigator.refresh, 'function');
  navigator.beginLifecycle('active');
  second.style.display = 'none';
  navigator.refresh('active');

  assert.equal(first.scrollIntoViewCalls.length, 0);
  assert.equal(second.scrollIntoViewCalls.length, 0);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FIX2-12: scope 暂无可见 mismatch 后恢复可见时 refresh 可重新显示', () => {
  const { dom, navigator } = setup();
  const target = addMismatchTarget(dom.root, 'active');

  navigator.beginLifecycle('active');
  target.style.display = 'none';
  navigator.refresh('active');
  assert.equal(floating(dom.document).hidden, true);

  target.style.display = '';
  navigator.refresh('active');
  assert.equal(floating(dom.document).hidden, false);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FIX2-RED-7: 手动 close 后 ordinary refresh 不会立即自动重开', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'active');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  assert.equal(typeof navigator.refresh, 'function');
  navigator.beginLifecycle('active');
  floatingButton(dom.document, 'close').click();
  navigator.refresh('active');

  assert.equal(floating(dom.document).hidden, true);
});

test('FIX2-RED-8: 新 check/tab lifecycle 会解除 manualClose 并重新自动显示', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'tab-a');
  const tabB = addMismatchTarget(dom.root, 'tab-b');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('tab-a');
  floatingButton(dom.document, 'close').click();
  navigator.beginLifecycle('tab-b');

  assert.equal(tabB.scrollIntoViewCalls.length, 0);
  assert.equal(floating(dom.document).hidden, false);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FIX2-RED-9: Review/Skip/hidden 仍沿用既有 visible mismatch 过滤', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'active', { status: 'review' });
  addMismatchTarget(dom.root, 'active', { status: 'skip' });
  addMismatchTarget(dom.root, 'active', { display: 'none' });
  const visible = addMismatchTarget(dom.root, 'active');

  assert.equal(typeof navigator.beginLifecycle, 'function');
  navigator.beginLifecycle('active');

  assert.equal(visible.scrollIntoViewCalls.length, 0);
  assert.equal(floatingCount(dom.document), '1 / 1');
});

test('FIX2-RED-10: 三媒体 summary 使用统一 trigger class 与点击提示', () => {
  for (const page of Object.keys(PAGE_CONFIG)) {
    const { html } = loadNavigatorApi(page);
    assert.match(html, /qc-mismatch-nav-trigger/);
    assert.match(html, /title="クリックしてこの範囲の不一致を確認"/);
  }
});

test('FIX2-RED-11: Floating 使用统一 warning visual contract', () => {
  for (const page of Object.keys(PAGE_CONFIG)) {
    const { html } = loadNavigatorApi(page);
    assert.match(html, /\.qc-mismatch-nav-floating[^}]*background:\s*#fff3cd/s);
    assert.match(html, /\.qc-mismatch-nav-floating[^}]*border:\s*2px\s+solid\s+#dc3545/s);
    assert.match(html, /\.qc-mismatch-nav-floating[^}]*color:\s*#842029/s);
  }
});

test('FIX2-13: Floating warning 文案包含不一致标识，计数保持独立', () => {
  const { dom, navigator } = setup();
  addMismatchTarget(dom.root, 'active');
  navigator.beginLifecycle('active');

  assert.equal(dom.document.querySelector('.qc-mismatch-nav-label').textContent, '⚠ 不一致');
  assert.equal(floatingCount(dom.document), '1 / 1');
});
