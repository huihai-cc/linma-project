'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'amazon_dsp_check.html');

function createElement(initialValue = '') {
  return {
    addEventListener() {}, appendChild() {}, cloneNode() { return this; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [],
    innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, setAttribute() {}, scrollIntoView() {},
    style: { display: '', opacity: '', cursor: '', setProperty() {} },
    textContent: '', value: initialValue,
  };
}

function loadAmazonApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1])
    .find(script => script.includes('window.runSettingCheck=runSettingCheck;'));
  assert.ok(source, 'amazon application script should be present');

  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const exportBlock = `
window.__amazonUnifiedTestApi = {
  classifyAmazonUploadFile: typeof classifyAmazonUploadFile === 'function' ? classifyAmazonUploadFile : undefined,
  validateAmazonUnifiedRole: typeof validateAmazonUnifiedRole === 'function' ? validateAmazonUnifiedRole : undefined,
  assignAmazonUnifiedFiles: typeof assignAmazonUnifiedFiles === 'function' ? assignAmazonUnifiedFiles : undefined,
  renderAmazonUnifiedUploadState: typeof renderAmazonUnifiedUploadState === 'function' ? renderAmazonUnifiedUploadState : undefined,
  scUnifiedRoleChange: typeof scUnifiedRoleChange === 'function' ? scUnifiedRoleChange : undefined,
  scUnifiedRemoveFile: typeof scUnifiedRemoveFile === 'function' ? scUnifiedRemoveFile : undefined,
  resetSettingCheck: typeof resetSettingCheck === 'function' ? resetSettingCheck : undefined,
  setScUploadMode: typeof setScUploadMode === 'function' ? setScUploadMode : undefined,
  getFiles: function(){ return { setting: scFilesS.slice(), download: scFilesD.slice() }; },
  getUnifiedState: function(){ return JSON.parse(JSON.stringify(scUnifiedState)); },
  getElement: function(id){ return document.getElementById(id); },
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX: {
      utils: {
        sheet_to_json: ws => (ws && Array.isArray(ws.__rows)) ? ws.__rows : [],
      },
    },
    alert() {}, atob: globalThis.atob, console: { log() {}, warn() {}, error() {} },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: value => String(value ?? ''),
    setTimeout, clearTimeout,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__amazonUnifiedTestApi;
}

function makeWb(sheets) {
  const wb = { SheetNames: Object.keys(sheets), Sheets: {} };
  for (const [name, rows] of Object.entries(sheets)) {
    wb.Sheets[name] = { '!ref': 'A1', __rows: rows };
  }
  return wb;
}

function makeFile(name) {
  return { name, size: 100, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

function makeDspSetting() {
  return makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Pacing', 'Base supply bid'],
      ['LI-SETTING', 'Display', '2026/09/01', 'standard', '1.00'],
    ],
  });
}

function makeVideoSetting() {
  return makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'DealID', 'Deal名', 'Base supply bid'],
      ['LI-VIDEO', 'Streaming TV', '2026/09/01', 'D-001', 'Deal A', '1.00'],
    ],
  });
}

function makeDspDownload() {
  return makeWb({
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Base supply bid', 'Pacing profile'],
      ['LI-SETTING', 'Display', 'Amazon', '1.00', 'standard'],
    ],
  });
}

function makeVideoDownload() {
  return makeWb({
    'VIDEO LINE ITEMS': [
      ['Line name', 'Line type', 'Video Ad Content Type', 'Order name - (READ ONLY)', 'Pacing profile'],
      ['LI-VIDEO', 'Video', 'STREAMING_TV', 'OTT order', 'standard'],
    ],
  });
}

function item(file, wb, roleOverride) {
  return { file, wb, roleOverride };
}

const api = loadAmazonApi();

test('A1-Amazon Red: setting workbook and download workbook receive distinct high-confidence roles', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());

  assert.equal(setting.role, 'setting');
  assert.equal(setting.confidence, 'high');
  assert.equal(download.role, 'download');
  assert.equal(download.confidence, 'high');
});

test('A1-Amazon Red: PVA/OTT video structures are setting/download candidates without media default guessing', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('ott-setting.xlsx'), makeVideoSetting());
  const download = api.classifyAmazonUploadFile(makeFile('ott-download.xlsx'), makeVideoDownload());

  assert.equal(setting.role, 'setting');
  assert.equal(download.role, 'download');
  assert.equal(setting.systemEvidence, undefined);
  assert.equal(download.systemEvidence, undefined);
});

test('A1-Amazon Red: order reversal does not change assignment and writes scFilesS/scFilesD', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());
  const result = api.assignAmazonUnifiedFiles([download, setting]);

  assert.equal(result.ok, true);
  assert.equal(result.settingFiles[0].name, 'setting.xlsx');
  assert.equal(result.downloadFiles[0].name, 'download.xlsx');
  assert.equal(api.getFiles().setting[0].name, 'setting.xlsx');
  assert.equal(api.getFiles().download[0].name, 'download.xlsx');
});

test('A1-Amazon Red: one file or extension-only evidence fails closed', () => {
  const unknown = api.classifyAmazonUploadFile(makeFile('unknown.xlsx'), makeWb({ Sheet1: [['not a QC table']] }));

  const result = api.assignAmazonUnifiedFiles([unknown]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown\.xlsx/);
  assert.match(result.reason, /設定表|ダウンロード|認識/);
});

test('A1-Amazon Red: same workbook satisfying both roles is not auto-assigned', () => {
  const both = api.classifyAmazonUploadFile(makeFile('mixed.xlsx'), makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Pacing', 'Base supply bid'],
      ['LI-1', 'Display', '2026/09/01', 'standard', '1.00'],
    ],
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Base supply bid', 'Pacing profile'],
      ['LI-1', 'Display', 'Amazon', '1.00', 'standard'],
    ],
  }));

  assert.equal(both.role, 'unknown');
  assert.equal(both.conflict, true);
  assert.equal(api.assignAmazonUnifiedFiles([both]).ok, false);
});

test('A1-Amazon Red: manual role override still validates the selected role', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());

  const wrong = api.assignAmazonUnifiedFiles([setting, download], { roleOverrides: ['download', 'setting'] });
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /setting.xlsx|設定表|download.xlsx|ダウンロード/);

  const correct = api.assignAmazonUnifiedFiles([setting, download], { roleOverrides: ['setting', 'download'] });
  assert.equal(correct.ok, true);
});

test('A1-Amazon Red: multiple setting/download files keep the existing array semantics', () => {
  const setting1 = api.classifyAmazonUploadFile(makeFile('setting-1.xlsx'), makeDspSetting());
  const setting2 = api.classifyAmazonUploadFile(makeFile('setting-2.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());
  const result = api.assignAmazonUnifiedFiles([setting2, download, setting1]);

  assert.equal(result.ok, true);
  assert.equal(result.settingFiles.map(file => file.name).sort().join(','), 'setting-1.xlsx,setting-2.xlsx');
  assert.equal(result.downloadFiles.length, 1);
});

test('A1-Amazon Red: all-setting and all-download combinations fail closed', () => {
  const setting1 = api.classifyAmazonUploadFile(makeFile('setting-1.xlsx'), makeDspSetting());
  const setting2 = api.classifyAmazonUploadFile(makeFile('setting-2.xlsx'), makeDspSetting());
  const download1 = api.classifyAmazonUploadFile(makeFile('download-1.xlsx'), makeDspDownload());
  const download2 = api.classifyAmazonUploadFile(makeFile('download-2.xlsx'), makeDspDownload());

  assert.equal(api.assignAmazonUnifiedFiles([setting1, setting2]).ok, false);
  assert.equal(api.assignAmazonUnifiedFiles([download1, download2]).ok, false);
});

test('A1-Amazon Red: successful unified assignment shows and enables the original check button', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());
  const result = api.assignAmazonUnifiedFiles([setting, download]);
  const controls = api.getElement('sc-controls');
  const button = api.getElement('sc-check-btn');

  assert.equal(result.ok, true);
  assert.equal(controls.style.display, 'flex');
  assert.equal(button.disabled, false);
  assert.match(api.getElement('sc-unified-state').innerHTML, /setting\.xlsx/);
  assert.match(api.getElement('sc-unified-state').innerHTML, /自動識別/);
});

test('A1-Amazon Red: failed assignment and removing one file hide and disable the original check button', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());
  api.assignAmazonUnifiedFiles([setting, download]);
  api.scUnifiedRemoveFile(0);

  assert.equal(api.getElement('sc-controls').style.display, 'none');
  assert.equal(api.getElement('sc-check-btn').disabled, true);
  assert.match(api.getElement('sc-unified-state').innerHTML, /設定表|ダウンロード/);
});

test('A1-Amazon Red: reset returns the unified state and original button to the initial disabled state', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());
  api.assignAmazonUnifiedFiles([setting, download]);
  api.resetSettingCheck();

  assert.equal(api.getUnifiedState().status, 'empty');
  assert.equal(api.getElement('sc-controls').style.display, 'none');
  assert.equal(api.getElement('sc-check-btn').disabled, true);
});

test('A1-Amazon Red: legacy mode reuses the same original button and retains legacy control semantics', () => {
  const setting = api.classifyAmazonUploadFile(makeFile('setting.xlsx'), makeDspSetting());
  const download = api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload());
  api.assignAmazonUnifiedFiles([setting, download]);
  api.setScUploadMode('legacy');

  assert.equal(api.getElement('sc-unified-upload-area').style.display, 'none');
  assert.equal(api.getElement('sc-legacy-upload-area').style.display, 'block');
  assert.equal(api.getElement('sc-controls').style.display, 'flex');
  assert.equal((fs.readFileSync(htmlPath, 'utf8').match(/id="sc-check-btn"/g) || []).length, 1);
  api.setScUploadMode('unified');
});

test('A1-Amazon Red: original execution chain remains runSettingCheck -> _runSettingCheck -> _doSettingCheck', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /id="sc-check-btn" onclick="runSettingCheck\(\)"/);
  const runStart = html.indexOf('function runSettingCheck()');
  const runEnd = html.indexOf('function _runSettingCheck()', runStart);
  const runBlock = html.slice(runStart, runEnd);
  assert.match(runBlock, /_runSettingCheck\(\)/);
  const runInner = html.slice(runEnd, html.indexOf('function readWb(', runEnd));
  assert.match(runInner, /_doSettingCheck\(/);
});

test('A1-Amazon Red: manual role selection can be completed one file at a time without losing the first choice', () => {
  const mixed1 = api.classifyAmazonUploadFile(makeFile('mixed-1.xlsx'), makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Pacing', 'Base supply bid'],
      ['LI-1', 'Display', '2026/09/01', 'standard', '1.00'],
    ],
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Base supply bid', 'Pacing profile'],
      ['LI-1', 'Display', 'Amazon', '1.00', 'standard'],
    ],
  }));
  const mixed2 = api.classifyAmazonUploadFile(makeFile('mixed-2.xlsx'), makeWb({
    '設定シート': [
      ['ラインアイテム名', 'Type', 'Start day', 'Pacing', 'Base supply bid'],
      ['LI-2', 'Display', '2026/09/01', 'standard', '1.00'],
    ],
    'DISPLAY LINE ITEMS': [
      ['Line name', 'Line type', 'Supply source', 'Base supply bid', 'Pacing profile'],
      ['LI-2', 'Display', 'Amazon', '1.00', 'standard'],
    ],
  }));

  assert.equal(api.assignAmazonUnifiedFiles([mixed1, mixed2]).ok, false);
  api.scUnifiedRoleChange(0, 'setting');
  assert.equal(api.getUnifiedState().files[0].role, 'setting');
  assert.equal(api.getFiles().setting.length, 0);
  api.scUnifiedRoleChange(1, 'download');
  assert.equal(api.getFiles().setting[0].name, 'mixed-1.xlsx');
  assert.equal(api.getFiles().download[0].name, 'mixed-2.xlsx');
});

test('A1-Amazon Red: corrupted/read-error item fails closed even with a plausible extension', () => {
  const result = api.assignAmazonUnifiedFiles([
    { file: makeFile('broken.xlsx'), error: 'workbook read failed' },
    api.classifyAmazonUploadFile(makeFile('download.xlsx'), makeDspDownload()),
  ]);

  assert.equal(result.ok, false);
  assert.match(result.reason, /broken.xlsx|读取|损坏/);
});

test('A1-Amazon Red: unified upload contract is present and legacy inputs remain', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /id=["']sc-unified-upload-area["']/);
  assert.match(html, /id=["']sc-input-unified["']/);
  assert.match(html, /id=["']sc-input-setting["']/);
  assert.match(html, /id=["']sc-input-download["']/);
  assert.match(html, /classifyAmazonUploadFile/);
  assert.match(html, /assignAmazonUnifiedFiles/);
  assert.match(html, /renderAmazonUnifiedUploadState/);
});
