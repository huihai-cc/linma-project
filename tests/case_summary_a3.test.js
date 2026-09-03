'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const codeGs = fs.readFileSync(path.join(projectRoot, 'Code.gs'), 'utf8');

const SUMMARY_HEADERS = [
  '集計日', '対象月', 'メール', '氏名', '課室', 'ツール名',
  '実行回数', '有効利用回数', '差異件数合計', '初回利用時間', '最終利用時間', '備考',
];
const CASE_SUMMARY_HEADERS = [
  '集計日', '対象月', 'メール', '氏名', '課室', 'ツール名',
  '案件名', '案件Session ID', '実行回数', '差異件数合計', '初回利用時間', '最終利用時間',
];

class FakeSheet {
  constructor(name, values = []) {
    this.name = name;
    this.values = values.map(row => row.slice());
    this.frozenRows = 0;
    this.widths = {};
  }

  getDataRange() {
    return { getValues: () => this.values.map(row => row.slice()) };
  }

  clear() {
    this.values = [];
  }

  getLastRow() {
    return this.values.length;
  }

  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getRange(row, column, numRows, numColumns) {
    const range = {
      setValues: values => {
        assert.equal(row, 1);
        assert.equal(column, 1);
        assert.equal(numRows, values.length);
        assert.equal(numColumns, values[0].length);
        this.values = JSON.parse(JSON.stringify(values));
        return range;
      },
      setFontWeight: () => range,
      setVerticalAlignment: () => range,
      setWrap: () => range,
    };
    return range;
  }

  appendRow(row) {
    this.values.push(row.slice());
  }

  setFrozenRows(rows) {
    this.frozenRows = rows;
  }

  setColumnWidth(column, width) {
    this.widths[column] = width;
  }
}

function formatDate(date, pattern) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  if (pattern === 'yyyy/MM/dd') return `${year}/${month}/${day}`;
  if (pattern === 'yyyy年MM月') return `${year}年${month}月`;
  if (pattern === 'yyyy/MM/dd HH:mm:ss') return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
  if (pattern === 'yyyy') return String(year);
  if (pattern === 'MM') return month;
  return String(date);
}

function createHarness(logRows) {
  const sheets = new Map([
    ['logs', new FakeSheet('logs', logRows)],
    ['summary', new FakeSheet('summary', [SUMMARY_HEADERS])],
  ]);
  const errorLogs = [];
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
  };
  const context = {
    SpreadsheetApp: { openById: () => spreadsheet },
    Utilities: { formatDate: (date, timezone, pattern) => formatDate(date, pattern) },
    Date,
    JSON,
    Math,
    console: {
      error: (...args) => errorLogs.push(args),
      log() {},
      warn() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(codeGs, context, { filename: 'Code.gs' });
  return { context, sheets, spreadsheet, errorLogs };
}

function baseLogs(rows) {
  return [
    ['时间', '邮箱', '姓名', '课室', '工具名', '差异数量', '既有字段', '備考', '月統計', '案件名', '案件Session ID'],
    ...rows,
  ];
}

function normalLog({ timestamp = '2026/08/01 09:00:00', diff = 2 } = {}) {
  return [timestamp, 'user@example.com', 'User', 'Dept', 'AmazonDSP设定检查', diff, 1, '', '2026年08月', '案件 A', 'session-a'];
}

test('rebuildSummary 完成 summary 写入后调用 rebuildCaseSummary', () => {
  const harness = createHarness(baseLogs([normalLog()]));
  const calls = [];
  harness.context.clearAndWriteSummary = () => calls.push('summary');
  harness.context.rebuildCaseSummary = () => calls.push('case_summary');

  harness.context.rebuildSummary();

  assert.deepEqual(calls, ['summary', 'case_summary']);
});

test('rebuildSummary 在空日志分支完成 summary 写入后也刷新 case_summary', () => {
  const harness = createHarness(baseLogs([]));
  const calls = [];
  harness.context.clearAndWriteSummary = () => calls.push('summary');
  harness.context.rebuildCaseSummary = () => calls.push('case_summary');

  harness.context.rebuildSummary();

  assert.deepEqual(calls, ['summary', 'case_summary']);
});

test('rebuildCaseSummary 保留独立手动执行入口，只刷新案件汇总', () => {
  const harness = createHarness(baseLogs([normalLog()]));

  harness.context.rebuildCaseSummary();

  assert.deepEqual(harness.sheets.get('case_summary').values, [
    CASE_SUMMARY_HEADERS,
    ['2026/08/01', '2026年08月', 'user@example.com', 'User', 'Dept', 'Amazon DSP設定チェック',
      '案件 A', 'session-a', 1, 2, '2026/08/01 09:00:00', '2026/08/01 09:00:00'],
  ]);
  assert.deepEqual(harness.sheets.get('summary').values, [SUMMARY_HEADERS]);
});

test('rebuildCaseSummary 不会递归调用 rebuildSummary', () => {
  const harness = createHarness(baseLogs([normalLog()]));
  let recursiveCalls = 0;
  harness.context.rebuildSummary = () => { recursiveCalls++; };

  harness.context.rebuildCaseSummary();

  assert.equal(recursiveCalls, 0);
});

test('case_summary 重建失败时 summary 已写入结果仍保留', () => {
  const harness = createHarness(baseLogs([normalLog({ diff: 7 })]));
  harness.context.rebuildCaseSummary = () => { throw new Error('case summary failed'); };

  assert.doesNotThrow(() => harness.context.rebuildSummary());
  assert.deepEqual(harness.sheets.get('summary').values, [
    SUMMARY_HEADERS,
    ['2026/08/01', '2026年08月', 'user@example.com', 'User', 'Dept', 'Amazon DSP設定チェック',
      1, 1, 7, '2026/08/01 09:00:00', '2026/08/01 09:00:00', ''],
  ]);
});

test('case_summary 重建错误会通过 console.error 记录且不被静默吞掉', () => {
  const harness = createHarness(baseLogs([normalLog()]));
  const failure = new Error('case summary failed');
  harness.context.rebuildCaseSummary = () => { throw failure; };

  harness.context.rebuildSummary();

  assert.equal(harness.errorLogs.length, 1);
  assert.match(String(harness.errorLogs[0][0]), /rebuildCaseSummary/);
  assert.equal(harness.errorLogs[0][1], failure);
});

test('installDailySummaryTriggers 仍只安装 10/14/17 点的 rebuildSummary Trigger', () => {
  const harness = createHarness(baseLogs([]));
  const created = [];
  const deleted = [];
  const existing = [{ getHandlerFunction: () => 'rebuildSummary' }];
  harness.context.ScriptApp = {
    getProjectTriggers: () => existing,
    deleteTrigger: trigger => deleted.push(trigger),
    newTrigger: handler => ({
      timeBased() { return this; },
      everyDays() { return this; },
      atHour(hour) { this.hour = hour; return this; },
      create() { created.push({ handler, hour: this.hour }); return {}; },
    }),
  };

  harness.context.installDailySummaryTriggers();

  assert.equal(deleted.length, 1);
  assert.deepEqual(created, [
    { handler: 'rebuildSummary', hour: 10 },
    { handler: 'rebuildSummary', hour: 14 },
    { handler: 'rebuildSummary', hour: 17 },
  ]);
  assert.equal(created.some(trigger => trigger.handler === 'rebuildCaseSummary'), false);
});

test('rebuildSummary 的既有工具使用统计结果不变', () => {
  const harness = createHarness(baseLogs([
    normalLog({ timestamp: '2026/08/01 09:00:00', diff: 2 }),
    normalLog({ timestamp: '2026/08/01 09:20:00', diff: 3 }),
  ]));

  harness.context.rebuildSummary();

  assert.deepEqual(harness.sheets.get('summary').values, [
    SUMMARY_HEADERS,
    ['2026/08/01', '2026年08月', 'user@example.com', 'User', 'Dept', 'Amazon DSP設定チェック',
      2, 2, 5, '2026/08/01 09:00:00', '2026/08/01 09:20:00', ''],
  ]);
});

test('rebuildCaseSummary 的既有案件级统计结果不变', () => {
  const harness = createHarness(baseLogs([
    normalLog({ timestamp: '2026/08/01 09:00:00', diff: 2 }),
    normalLog({ timestamp: '2026/08/01 09:20:00', diff: 3 }),
  ]));

  harness.context.rebuildCaseSummary();

  assert.deepEqual(harness.sheets.get('case_summary').values, [
    CASE_SUMMARY_HEADERS,
    ['2026/08/01', '2026年08月', 'user@example.com', 'User', 'Dept', 'Amazon DSP設定チェック',
      '案件 A', 'session-a', 2, 5, '2026/08/01 09:00:00', '2026/08/01 09:20:00'],
  ]);
});
