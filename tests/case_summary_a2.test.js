'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const codeGs = fs.readFileSync(path.join(projectRoot, 'Code.gs'), 'utf8');
const expectedHeaders = [
  '集計日', '対象月', 'メール', '氏名', '課室', 'ツール名',
  '案件名', '案件Session ID', '実行回数', '差異件数合計', '初回利用時間', '最終利用時間',
];

class FakeSheet {
  constructor(name, values = []) {
    this.name = name;
    this.values = values.map(row => row.slice());
    this.clearCount = 0;
    this.frozenRows = 0;
    this.widths = {};
  }

  getDataRange() {
    return { getValues: () => this.values.map(row => row.slice()) };
  }

  clear() {
    this.values = [];
    this.clearCount++;
  }

  getRange(row, column, numRows, numColumns) {
    const range = {
      setValues: values => {
        assert.equal(row, 1);
        assert.equal(column, 1);
        assert.ok(numRows >= 1);
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

  getLastRow() {
    return this.values.length;
  }

  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }

  setFrozenRows(count) {
    this.frozenRows = count;
    return this;
  }

  setColumnWidth(column, width) {
    this.widths[column] = width;
    return this;
  }

  autoResizeColumns() {}
}

function createHarness(logRows, summaryRows = []) {
  const sheets = new Map([
    ['logs', new FakeSheet('logs', logRows)],
    ['summary', new FakeSheet('summary', summaryRows)],
  ]);
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
    Utilities: {
      formatDate(date, timezone, pattern) {
        if(pattern === 'yyyy年MM月') {
          return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
        }
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      },
    },
    Date,
    JSON,
    Math,
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(context);
  vm.runInContext(codeGs, context, { filename: 'Code.gs' });
  return { context, sheets, spreadsheet };
}

function baseLogs(rows) {
  return [
    ['時間', '邮箱', '姓名', '课室', '工具名', '差异数量', '既有字段', '備考', '月統計', '案件名', '案件Session ID'],
    ...rows,
  ];
}

function caseRow({
  timestamp,
  email = 'user@example.com',
  name = 'User',
  dept = 'Dept',
  tool = 'AmazonDSP设定检查',
  diff = 0,
  month = '2026年08月',
  caseName = '案件 A',
  sessionId = 'session-a',
}) {
  return [timestamp, email, name, dept, tool, diff, 1, '', month, caseName, sessionId];
}

function caseSummaryRows(harness) {
  const sheet = harness.sheets.get('case_summary');
  return sheet ? sheet.values : [];
}

function rowBySession(rows, sessionId) {
  return rows.find(row => row[7] === sessionId);
}

test('J/K 为空的历史日志被忽略，case_summary 只保留表头', () => {
  const harness = createHarness(baseLogs([
    ['2026/08/01 09:00:00', 'old@example.com', 'Old', 'Dept', '旧工具', 9, 1, '', '2026年08月', '', ''],
    ['2026/08/01 09:01:00', 'old@example.com', 'Old', 'Dept', '旧工具', 3, 1, '', '2026年08月', '案件但无ID', ''],
    ['2026/08/01 09:02:00', 'old@example.com', 'Old', 'Dept', '旧工具', 3, 1, '', '2026年08月', '', 'session-only'],
  ]));

  harness.context.rebuildCaseSummary();

  assert.deepEqual(caseSummaryRows(harness), [expectedHeaders]);
});

test('单条案件日志生成一行 case_summary', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 09:00:00', diff: 4 }),
  ]));

  harness.context.rebuildCaseSummary();

  assert.deepEqual(caseSummaryRows(harness), [
    expectedHeaders,
    ['2026/08/01', '2026年08月', 'user@example.com', 'User', 'Dept', 'Amazon DSP設定チェック',
      '案件 A', 'session-a', 1, 4, '2026/08/01 09:00:00', '2026/08/01 09:00:00'],
  ]);
});

test('同一 Session 的 3 条日志合并为一行', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 11:00:00', diff: 4 }),
    caseRow({ timestamp: '2026/08/01 09:15:00', diff: 2 }),
    caseRow({ timestamp: '2026/08/01 10:30:00', diff: 3 }),
  ]));

  harness.context.rebuildCaseSummary();

  const rows = caseSummaryRows(harness);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][8], 3);
  assert.equal(rows[1][9], 9);
});

test('同一 Session 的初回/最終利用時間取最早与最晚日志', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/02 01:00:00', diff: 1, month: '2026年08月' }),
    caseRow({ timestamp: '2026/08/01 23:59:59', diff: 1, month: '2026年08月' }),
  ]));

  harness.context.rebuildCaseSummary();

  const row = caseSummaryRows(harness)[1];
  assert.equal(row[0], '2026/08/01');
  assert.equal(row[10], '2026/08/01 23:59:59');
  assert.equal(row[11], '2026/08/02 01:00:00');
});

test('差異件数合計等于同一 Session 各日志 F 列之和', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 09:00:00', diff: 7 }),
    caseRow({ timestamp: '2026/08/01 09:01:00', diff: 0 }),
    caseRow({ timestamp: '2026/08/01 09:02:00', diff: 5 }),
  ]));

  harness.context.rebuildCaseSummary();

  assert.equal(caseSummaryRows(harness)[1][9], 12);
});

test('Amazon 与 DV360 的案件 Session 分别汇总', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 09:00:00', tool: 'AmazonDSP设定检查', caseName: 'Amazon A', sessionId: 'amazon-1' }),
    caseRow({ timestamp: '2026/08/01 09:01:00', tool: 'DV360设定检查', caseName: 'DV A', sessionId: 'dv-1' }),
  ]));

  harness.context.rebuildCaseSummary();

  const rows = caseSummaryRows(harness);
  assert.equal(rows.length, 3);
  assert.equal(rowBySession(rows, 'amazon-1')[5], 'Amazon DSP設定チェック');
  assert.equal(rowBySession(rows, 'dv-1')[5], 'DV360設定チェック');
});

test('相同 caseName 但不同 Session ID 必须生成两行', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 09:00:00', caseName: '同名案件', sessionId: 'session-1' }),
    caseRow({ timestamp: '2026/08/01 09:01:00', caseName: '同名案件', sessionId: 'session-2' }),
  ]));

  harness.context.rebuildCaseSummary();

  const rows = caseSummaryRows(harness);
  assert.equal(rows.length, 3);
  assert.ok(rowBySession(rows, 'session-1'));
  assert.ok(rowBySession(rows, 'session-2'));
});

test('不同用户即使使用相同 Session ID 也必须分开', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 09:00:00', email: 'a@example.com', name: 'A', sessionId: 'shared-id' }),
    caseRow({ timestamp: '2026/08/01 09:01:00', email: 'b@example.com', name: 'B', sessionId: 'shared-id' }),
  ]));

  harness.context.rebuildCaseSummary();

  const rows = caseSummaryRows(harness);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(row => row[7] === 'shared-id').length, 2);
});

test('case_summary 的 header 固定为 A-L 案件级 schema', () => {
  const harness = createHarness(baseLogs([]));

  harness.context.rebuildCaseSummary();

  assert.deepEqual(caseSummaryRows(harness)[0], expectedHeaders);
});

test('case_summary 使用最早 Session 日志的集計日与 logs I 月份', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/09/01 09:00:00', month: '2026年09月', sessionId: 'session-month' }),
    caseRow({ timestamp: '2026/08/31 23:59:00', month: '2026年08月', sessionId: 'session-month' }),
  ]));

  harness.context.rebuildCaseSummary();

  const row = rowBySession(caseSummaryRows(harness), 'session-month');
  assert.equal(row[0], '2026/08/31');
  assert.equal(row[1], '2026年08月');
});

test('rebuildCaseSummary 不改变现有 rebuildSummary 的结果', () => {
  const harness = createHarness(baseLogs([
    caseRow({ timestamp: '2026/08/01 09:00:00', diff: 2 }),
    caseRow({ timestamp: '2026/08/01 09:01:00', diff: 3 }),
  ]), [['既有 summary 内容']]);

  harness.context.rebuildSummary();
  const before = harness.sheets.get('summary').values.map(row => row.slice());
  harness.context.rebuildCaseSummary();
  const after = harness.sheets.get('summary').values.map(row => row.slice());

  assert.deepEqual(after, before);
  assert.equal(caseSummaryRows(harness).length, 2);
});

test('旧 logs 没有 J/K 时不会推测案件或写入 case_summary 数据行', () => {
  const harness = createHarness(baseLogs([
    ['2026/08/01 09:00:00', 'legacy@example.com', 'Legacy', 'Dept', 'DV360设定检查', 8, 1, '', '2026年08月', '', ''],
  ]));

  harness.context.rebuildCaseSummary();

  assert.equal(caseSummaryRows(harness).length, 1);
  assert.equal(harness.sheets.has('case_summary'), true);
});
