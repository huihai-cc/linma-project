'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const JSZip = require('../jszip.min.js');
const XLSX = require('../xlsx.full.min.js');

const htmlPath = path.join(__dirname, '..', 'dv360_check.html');

function createElement(initialValue = '') {
  const classNames = new Set();
  return {
    addEventListener() {}, appendChild() {}, closest() { return null; },
    classList: {
      add(...names) { names.forEach(name => classNames.add(name)); },
      remove(...names) { names.forEach(name => classNames.delete(name)); },
      toggle(name) { if (classNames.has(name)) classNames.delete(name); else classNames.add(name); },
      contains(name) { return classNames.has(name); },
    },
    dataset: {}, disabled: false, files: [], innerHTML: '',
    getAttribute(name) { return name === 'onclick' ? 'runCheck()' : null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    scrollIntoView() {}, style: { display: '', setProperty() {} },
    textContent: '', value: initialValue,
  };
}

class AsyncFileReader {
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then(buffer => {
      if (this.onload) this.onload({ target: { result: buffer } });
    }, error => {
      if (this.onerror) this.onerror(error);
    });
  }
}

function loadApi() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).find(script => script.includes('function parseSdfData'));
  assert.ok(source, 'DV360 application script exists');

  const exportBlock = `
window.__unifiedApi = {
  classifyDv360UploadFile: typeof classifyDv360UploadFile === 'function' ? classifyDv360UploadFile : null,
  classifyDv360UnifiedFiles: typeof classifyDv360UnifiedFiles === 'function' ? classifyDv360UnifiedFiles : null,
  assignDv360UnifiedFiles: typeof assignDv360UnifiedFiles === 'function' ? assignDv360UnifiedFiles : null,
  validateDv360UnifiedRole: typeof validateDv360UnifiedRole === 'function' ? validateDv360UnifiedRole : null,
  legacyHandleFiles: typeof dvHandleFiles === 'function' ? dvHandleFiles : null,
  getControlState: () => ({
    barVisible: document.getElementById('control-bar').classList.contains('show'),
    buttonDisabled: !!document.getElementById('dv-check-btn').disabled,
    buttonOnclick: document.getElementById('dv-check-btn').getAttribute('onclick'),
  }),
  handleUnifiedFiles: typeof dvUnifiedHandleFiles === 'function' ? dvUnifiedHandleFiles : null,
  removeUnifiedFile: typeof dvRemoveUnifiedFile === 'function' ? dvRemoveUnifiedFile : null,
  showLegacyMode: typeof dvShowLegacyUploadMode === 'function' ? dvShowLegacyUploadMode : null,
  showUnifiedMode: typeof dvShowUnifiedUploadMode === 'function' ? dvShowUnifiedUploadMode : null,
  resetAll: typeof resetAll === 'function' ? resetAll : null,
  setUnifiedRole: (index, role) => {
    if (dvUnifiedClassifications[index]) dvUnifiedClassifications[index].manualRole = role;
    renderDv360UnifiedUploadState();
  },
  getAssignedFiles: () => ({
    setting: dvSettingFiles.map(file => file.name),
    download: dvDownloadFiles.map(file => file.name),
  }),
};`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);
  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return createElement(); },
  };
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: AsyncFileReader, JSZip, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, XLSX, alert() {}, atob: globalThis.atob,
    console: { log() {}, warn() {}, error() {} }, document,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    setTimeout, clearTimeout,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__unifiedApi;
}

function namedBlob(name, value, type = 'application/octet-stream') {
  const blob = new Blob([value], { type });
  Object.defineProperty(blob, 'name', { value: name });
  Object.defineProperty(blob, 'lastModified', { value: 1 });
  return blob;
}

function assignedNames(api) {
  return JSON.parse(JSON.stringify(api.getAssignedFiles()));
}

function controlState(api) {
  return JSON.parse(JSON.stringify(api.getControlState()));
}

function makeSettingFile(name = 'setting.xlsx') {
  return makeSettingWorkbookFile(name, '設定シート', [
    ['NO', 'IO名', '広告申込情報名（管理画面登録用）', '広告申込情報タイプ'],
    ['', '', '', ''],
    ['1', 'IO-A', 'LI-A', 'ディスプレイ'],
  ]);
}

function makeSettingWorkbookFile(name, sheetName, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  Object.defineProperty(blob, 'name', { value: name });
  Object.defineProperty(blob, 'lastModified', { value: 1 });
  return blob;
}

function makeSdfCsvFile(name = 'SDF-LineItems.csv') {
  const csv = [
    'Line Item Id,Io Id,Name,Status',
    'li-1,io-1,LI-A,Active',
  ].join('\n');
  return namedBlob(name, csv, 'text/csv');
}

async function makeSdfZipFile(name = 'download.zip') {
  const zip = new JSZip();
  zip.file('SDF-LineItems.csv', [
    'Line Item Id,Io Id,Name,Status',
    'li-1,io-1,LI-A,Active',
  ].join('\n'));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return namedBlob(name, bytes, 'application/zip');
}

async function makeNonSdfZipFile(name = 'not-sdf.zip') {
  const zip = new JSZip();
  zip.file('readme.txt', 'not an SDF export');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return namedBlob(name, bytes, 'application/zip');
}

test('统一上传可将真实 setting.xlsx 与 download.zip 自动分配到两类', async () => {
  const api = loadApi();
  assert.equal(typeof api.classifyDv360UploadFile, 'function');
  assert.equal(typeof api.assignDv360UnifiedFiles, 'function');

  const setting = makeSettingFile();
  const download = await makeSdfZipFile();
  const classified = await Promise.all([
    api.classifyDv360UploadFile(setting),
    api.classifyDv360UploadFile(download),
  ]);
  const result = api.assignDv360UnifiedFiles(classified);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.setting.file.name, 'setting.xlsx');
  assert.equal(result.download.file.name, 'download.zip');
  assert.deepEqual(assignedNames(api), {
    setting: ['setting.xlsx'],
    download: ['download.zip'],
  });
});

test('统一上传可识别 xlsx + csv，且不依赖拖入顺序', async () => {
  const api = loadApi();
  const setting = makeSettingFile('setting.xlsx');
  const download = makeSdfCsvFile('SDF-LineItems.csv');
  const classified = await Promise.all([
    api.classifyDv360UploadFile(download),
    api.classifyDv360UploadFile(setting),
  ]);
  const result = api.classifyDv360UnifiedFiles(classified);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(assignedNames(api), {
    setting: ['setting.xlsx'],
    download: ['SDF-LineItems.csv'],
  });
});

test('统一上传在文件数、角色重复或格式证据不足时 fail closed', async () => {
  const api = loadApi();
  const settingA = makeSettingFile('setting-a.xlsx');
  const settingB = makeSettingFile('setting-b.xlsx');
  const downloadA = await makeSdfZipFile('download-a.zip');
  const downloadB = await makeSdfZipFile('download-b.zip');

  const one = await api.classifyDv360UploadFile(settingA);
  assert.equal(api.assignDv360UnifiedFiles([one]).ok, false);

  const three = await Promise.all([
    api.classifyDv360UploadFile(settingA),
    api.classifyDv360UploadFile(downloadA),
    api.classifyDv360UploadFile(downloadB),
  ]);
  assert.equal(api.assignDv360UnifiedFiles(three).ok, false);

  const twoSettings = await Promise.all([
    api.classifyDv360UploadFile(settingA),
    api.classifyDv360UploadFile(settingB),
  ]);
  assert.equal(api.assignDv360UnifiedFiles(twoSettings).ok, false);
  assert.match(api.assignDv360UnifiedFiles(twoSettings).errors.join(' '), /分别指定|同一角色/);

  const twoDownloads = await Promise.all([
    api.classifyDv360UploadFile(downloadA),
    api.classifyDv360UploadFile(downloadB),
  ]);
  assert.equal(api.assignDv360UnifiedFiles(twoDownloads).ok, false);
  assert.match(api.assignDv360UnifiedFiles(twoDownloads).errors.join(' '), /分别指定|同一角色/);
});

test('ZIP 无标准 SDF、损坏 XLSX 时禁止自动或手动绕过校验', async () => {
  const api = loadApi();
  const setting = makeSettingFile();
  const emptyZip = await makeNonSdfZipFile();
  const corrupted = namedBlob('corrupt.xlsx', 'not an xlsx file', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const emptyZipClassification = await api.classifyDv360UploadFile(emptyZip);
  assert.equal(emptyZipClassification.candidates.download, false);
  assert.match(emptyZipClassification.reasons.join(' '), /標準SDF|标准SDF/);

  const badXlsxClassification = await api.classifyDv360UploadFile(corrupted);
  assert.equal(badXlsxClassification.readable, false, JSON.stringify(badXlsxClassification));
  assert.equal(api.validateDv360UnifiedRole(badXlsxClassification, 'setting').ok, false);

  const classified = await Promise.all([
    api.classifyDv360UploadFile(setting),
    api.classifyDv360UploadFile(emptyZip),
  ]);
  assert.equal(api.assignDv360UnifiedFiles(classified, ['setting', 'download']).ok, false);
});

test('不支持的扩展名也显示具体文件并保持 fail closed', async () => {
  const api = loadApi();
  const unsupported = namedBlob('notes.pdf', 'not supported', 'application/pdf');
  const classification = await api.classifyDv360UploadFile(unsupported);
  assert.equal(classification.readable, false);
  assert.match(classification.reasons.join(' '), /notes\.pdf/);
  assert.equal(api.assignDv360UnifiedFiles([classification, classification]).ok, false);
});

test('手动指定角色仍需通过角色可读性校验', async () => {
  const api = loadApi();
  const setting = makeSettingFile();
  const download = await makeSdfZipFile();
  const classified = await Promise.all([
    api.classifyDv360UploadFile(setting),
    api.classifyDv360UploadFile(download),
  ]);

  const manual = api.assignDv360UnifiedFiles(classified, ['setting', 'download']);
  assert.equal(manual.ok, true, JSON.stringify(manual));
  assert.equal(manual.status, 'manual');

  const wrong = api.assignDv360UnifiedFiles(classified, ['download', 'setting']);
  assert.equal(wrong.ok, false);
  assert.match(wrong.errors.join(' '), /setting\.xlsx.*ダウンロード|download\.zip.*設定表/);
  assert.deepEqual(assignedNames(api), { setting: [], download: [] });
});

test('既存入口・保護対象関数・旧二つの input は残る', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /id="dv-input-setting"/);
  assert.match(html, /id="dv-input-download"/);
  assert.match(html, /onclick="runCheck\(\)"/);
  assert.match(html, /function detectMediaType\(/);
  assert.match(html, /function extractZip\(/);
  assert.match(html, /function parseXlsx\(/);
  assert.match(html, /function parseCsv\(/);
  assert.match(html, /function parseSdfData\(/);
  assert.match(html, /function runCheck\(/);
  const classifierStart = html.indexOf('async function classifyDv360UploadFile');
  const classifierEnd = html.indexOf('function dvUnifiedClassificationRole');
  assert.ok(classifierStart >= 0 && classifierEnd > classifierStart);
  assert.doesNotMatch(html.slice(classifierStart, classifierEnd), /detectMediaType\s*\(/);
});

test('設定表 role marker 覆盖 Display、YouTube、OTT，且不使用媒体默认值', async () => {
  const api = loadApi();
  const cases = [
    ['display-setting.xlsx', '設定シート', [['NO', 'IO名', '広告申込情報名（管理画面登録用）', '広告申込情報タイプ'], ['', '', '', ''], ['1', 'IO-A', 'LI-A', 'ディスプレイ']], 'display'],
    ['youtube-setting.xlsx', '運用者用', [['キャンペーン名', 'IO名', '広告申込情報名'], ['CP-A', 'IO-A', 'LI-A']], 'youtube'],
    ['ott-setting.xlsx', '設定シート (OTT)', [['NO', 'IO名', '全体予算'], ['1', 'IO-A', '1000']], 'ott'],
  ];
  for (const [name, sheetName, rows, mediaType] of cases) {
    const classification = await api.classifyDv360UploadFile(makeSettingWorkbookFile(name, sheetName, rows));
    assert.equal(classification.candidates.setting, true, `${mediaType} is a setting candidate`);
    assert.equal(classification.suggestedRole, 'setting');
    assert.equal(classification.settingEvidence[0].mediaType, mediaType);
  }
});

test('旧双上传模式仍可分别写入原有数组', () => {
  const api = loadApi();
  assert.equal(typeof api.legacyHandleFiles, 'function');
  api.legacyHandleFiles('setting', [makeSettingFile()]);
  api.legacyHandleFiles('download', [makeSdfCsvFile()]);
  assert.deepEqual(assignedNames(api), {
    setting: ['setting.xlsx'],
    download: ['SDF-LineItems.csv'],
  });
});

test('统一上传两角色有效时显示并启用原检查按钮', async () => {
  const api = loadApi();
  await api.handleUnifiedFiles([makeSettingFile(), await makeSdfZipFile()]);
  assert.deepEqual(controlState(api), {
    barVisible: true,
    buttonDisabled: false,
    buttonOnclick: 'runCheck()',
  });
});

test('统一上传缺少 setting 或 download 时隐藏检查按钮', async () => {
  const settingOnlyApi = loadApi();
  await settingOnlyApi.handleUnifiedFiles([makeSettingFile()]);
  assert.equal(controlState(settingOnlyApi).barVisible, false);

  const downloadOnlyApi = loadApi();
  await downloadOnlyApi.handleUnifiedFiles([await makeSdfZipFile()]);
  assert.equal(controlState(downloadOnlyApi).barVisible, false);
});

test('统一上传 fail-closed 时隐藏检查按钮', async () => {
  const api = loadApi();
  await api.handleUnifiedFiles([makeSettingFile('setting-a.xlsx'), makeSettingFile('setting-b.xlsx')]);
  const state = controlState(api);
  assert.equal(state.barVisible, false);
  assert.equal(state.buttonDisabled, false);
});

test('删除统一上传文件后立即隐藏检查按钮', async () => {
  const api = loadApi();
  await api.handleUnifiedFiles([makeSettingFile(), await makeSdfZipFile()]);
  assert.equal(controlState(api).barVisible, true);
  api.removeUnifiedFile(0);
  assert.equal(controlState(api).barVisible, false);
});

test('统一上传手动指定成功后恢复检查按钮', async () => {
  const api = loadApi();
  await api.handleUnifiedFiles([makeSettingFile(), await makeSdfZipFile()]);
  api.setUnifiedRole(0, 'setting');
  api.setUnifiedRole(1, 'download');
  assert.equal(controlState(api).barVisible, true);
  assert.equal(controlState(api).buttonDisabled, false);
});

test('reset 后统一上传检查按钮恢复隐藏', async () => {
  const api = loadApi();
  await api.handleUnifiedFiles([makeSettingFile(), await makeSdfZipFile()]);
  assert.equal(controlState(api).barVisible, true);
  api.resetAll();
  assert.equal(controlState(api).barVisible, false);
});

test('检查按钮仍只保留原 runCheck 入口', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.equal((html.match(/id="dv-check-btn"/g) || []).length, 1);
  assert.equal((html.match(/onclick="runCheck\(\)"/g) || []).length, 1);
});

test('旧手动上传模式继续使用原按钮状态逻辑', () => {
  const api = loadApi();
  api.showLegacyMode();
  api.legacyHandleFiles('setting', [makeSettingFile()]);
  assert.equal(controlState(api).barVisible, true);
  api.showUnifiedMode();
  assert.equal(controlState(api).barVisible, false);
});
