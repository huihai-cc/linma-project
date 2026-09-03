'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const codeGs = fs.readFileSync(path.join(projectRoot, 'Code.gs'), 'utf8');

const expectedHeaders = {
  logs: ['时间', '邮件', '名前', '課室', 'ツール名', '差異数量', '利用回数/既有字段', '備考', '月統計', '案件名', '案件Session ID'],
  summary: ['集計日', '対象月', 'メール', '氏名', '課室', 'ツール名', '実行回数', '有効利用回数', '差異件数合計', '初回利用時間', '最終利用時間', '備考'],
  case_summary: ['集計日', '対象月', 'メール', '氏名', '課室', 'ツール名', '案件名', '案件Session ID', '実行回数', '差異件数合計', '初回利用時間', '最終利用時間'],
};

const expectedWidths = {
  logs: [150, 220, 90, 65, 190, 85, 85, 280, 100, 260, 140],
  summary: [105, 100, 220, 90, 65, 190, 85, 100, 100, 155, 155, 260],
  case_summary: [105, 100, 220, 90, 65, 190, 280, 140, 85, 100, 155, 155],
};

class FakeSheet {
  constructor(name, values) {
    this.name = name;
    this.values = values.map(row => row.slice());
    this.frozenRows = 0;
    this.widths = {};
    this.formatCalls = [];
    this.rowHeights = [];
    this.autoResizeCalls = [];
    this.appendedRows = [];
  }

  getLastRow() {
    return this.values.length;
  }

  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }

  setFrozenRows(rows) {
    this.frozenRows = rows;
  }

  setColumnWidth(column, width) {
    this.widths[column] = width;
  }

  getRange(row, column, numRows, numColumns) {
    const range = {
      setVerticalAlignment: alignment => {
        this.formatCalls.push({ row, column, numRows, numColumns, type: 'verticalAlignment', value: alignment });
        return range;
      },
      setWrap: enabled => {
        this.formatCalls.push({ row, column, numRows, numColumns, type: 'wrap', value: enabled });
        return range;
      },
      setValues: values => {
        this.values = JSON.parse(JSON.stringify(values));
        return range;
      },
      setFontWeight: () => range,
    };
    return range;
  }

  appendRow(row) {
    this.appendedRows.push(row.slice());
    this.values.push(row.slice());
  }

  autoResizeColumns() {
    this.autoResizeCalls.push('columns');
  }

  autoResizeRows() {
    this.autoResizeCalls.push('rows');
  }
}

function createHarness() {
  const sheets = new Map([
    ['logs', new FakeSheet('logs', [expectedHeaders.logs, ['old']])],
    ['summary', new FakeSheet('summary', [expectedHeaders.summary, ['summary-data']])],
    ['case_summary', new FakeSheet('case_summary', [expectedHeaders.case_summary, ['case-data']])],
  ]);
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) {
      const sheet = new FakeSheet(name, []);
      sheets.set(name, sheet);
      return sheet;
    },
  };
  const context = {
    SpreadsheetApp: { openById: () => spreadsheet },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType: () => ({ text }) }),
    },
    Utilities: {
      formatDate(date, timezone, pattern) {
        if(pattern === 'yyyy/MM/dd HH:mm:ss') return '2026/09/03 12:34:56';
        if(pattern === 'yyyy') return '2026';
        if(pattern === 'MM') return '09';
        if(pattern === 'yyyy年MM月') return '2026年09月';
        return String(date);
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

test('formatBackendSheets 为 logs/summary/case_summary 应用固定列宽与表头格式', () => {
  const harness = createHarness();

  harness.context.formatBackendSheets();

  for (const sheetName of Object.keys(expectedWidths)) {
    const sheet = harness.sheets.get(sheetName);
    assert.equal(sheet.frozenRows, 1, `${sheetName} 应冻结首行`);
    assert.deepEqual(
      expectedWidths[sheetName].map((width, index) => sheet.widths[index + 1]),
      expectedWidths[sheetName],
      `${sheetName} 列宽不正确`,
    );
    assert.deepEqual(
      sheet.formatCalls.map(call => [call.type, call.value]),
      [['verticalAlignment', 'middle'], ['wrap', false]],
      `${sheetName} 应垂直居中且关闭自动换行`,
    );
    assert.deepEqual(sheet.autoResizeCalls, [], `${sheetName} 不应自动 resize 或改变行高`);
  }
});

test('格式化不修改三张表既有数据、表头或过滤结构', () => {
  const harness = createHarness();
  const before = new Map([...harness.sheets].map(([name, sheet]) => [name, JSON.stringify(sheet.values)]));
  const filters = new Map([...harness.sheets].map(([name]) => [name, { preserved: true }]));

  harness.context.formatBackendSheets();

  for (const [name, sheet] of harness.sheets) {
    assert.equal(JSON.stringify(sheet.values), before.get(name), `${name} 数据/表头不应改变`);
    assert.deepEqual(filters.get(name), { preserved: true }, `${name} 过滤结构不应改变`);
  }
});

test('formatBackendSheets 不改变现有 summary 与 case_summary 的统计结果数据', () => {
  const harness = createHarness();
  const summaryBefore = JSON.parse(JSON.stringify(harness.sheets.get('summary').values));
  const caseSummaryBefore = JSON.parse(JSON.stringify(harness.sheets.get('case_summary').values));

  harness.context.formatBackendSheets();

  assert.deepEqual(harness.sheets.get('summary').values, summaryBefore);
  assert.deepEqual(harness.sheets.get('case_summary').values, caseSummaryBefore);
});

test('格式化不改变 handleLog 的既有 A-K 日志写入契约', () => {
  const harness = createHarness();
  harness.context.verifyToken = () => ({ email: 'user@example.com', name: 'User', dept: 'Dept' });

  harness.context.handleLog({
    token: 'token',
    tool: 'DV360设定检查',
    diffCount: 3,
    criticalCount: 1,
    note: 'note',
    caseName: '案件 A',
    caseSessionId: 'session-a',
  });

  const row = harness.sheets.get('logs').appendedRows[0];
  assert.equal(row.length, 11);
  assert.equal(row[4], 'DV360设定检查');
  assert.equal(row[5], 3);
  assert.equal(row[9], '案件 A');
  assert.equal(row[10], 'session-a');
});

test('既有三张表的表头内容与 A2 schema 保持不变', () => {
  const harness = createHarness();

  harness.context.formatBackendSheets();

  for (const [sheetName, header] of Object.entries(expectedHeaders)) {
    assert.deepEqual(harness.sheets.get(sheetName).values[0], header);
  }
});
