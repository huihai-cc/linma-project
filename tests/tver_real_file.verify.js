'use strict';

// ②～⑨批量真实文件「只读」验证入口。
// 设计约束（docs/superpowers/plans/2026-08-17-tver-setting-qc.md 任务 11）：
//  - 仅使用仓库本地 xlsx.full.min.js、fs 与 Node vm；不联网、不加载 npm/CDN 库。
//  - readWorkbookFromPath 用二进制 Buffer 经本地 SheetJS 解析真实 .xlsx。
//  - --root 入口遍历每案一份 .xlsx 与一份 .csv；必须要求 --root，拒绝缺文件/多候选文件而不猜选。
//  - XLSX 解析失败则该案失败退出，绝不「只比 CSV」冒充通过。
//  - 本脚本不含真实路径、真实内容或断言用 ID；不向仓库写入任何真实资料。
//  - 仅对每案向 stdout 输出一行 JSON；退出码反映读取/XLSX 解析/CSV 解析/比较失败。

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'tver_check.html');

function createElementStub() {
  return {
    addEventListener() {}, appendChild() {}, setAttribute() {}, remove() {}, click() {},
    classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, files: [],
    innerHTML: '', style: {}, textContent: '', value: '',
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

function loadTverApi() {
  if (!fs.existsSync(htmlPath)) throw new Error(`tver_check.html not found at ${htmlPath}`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1]).find(script => script.includes('TVER_APP_MARKER'));
  if (!source) throw new Error('TVer inline app (TVER_APP_MARKER) not found in tver_check.html');

  // 注入仅测试用导出块（在 IIFE 结束前）。仅暴露只读验证所需函数，不改变任何业务逻辑。
  const exportBlock = `\nwindow.__tverVerifyApi = {
    parseCsvText: typeof parseCsvText === 'function' ? parseCsvText : undefined,
    detectTverCsvSchema: typeof detectTverCsvSchema === 'function' ? detectTverCsvSchema : undefined,
    parseTverSettingWorkbook: typeof parseTverSettingWorkbook === 'function' ? parseTverSettingWorkbook : undefined,
    buildEditTree: typeof buildEditTree === 'function' ? buildEditTree : undefined,
    buildRegisterTree: typeof buildRegisterTree === 'function' ? buildRegisterTree : undefined,
    matchTverEntities: typeof matchTverEntities === 'function' ? matchTverEntities : undefined,
    buildRunFromModels: typeof buildRunFromModels === 'function' ? buildRunFromModels : undefined,
    createTverConversionContext: typeof createTverConversionContext === 'function' ? createTverConversionContext : undefined,
    settingParseBlockingIssue: typeof settingParseBlockingIssue === 'function' ? settingParseBlockingIssue : undefined,
    getTverIdDictionaries: typeof getTverIdDictionaries === 'function' ? getTverIdDictionaries : undefined,
    validateIdDictionaries: typeof validateIdDictionaries === 'function' ? validateIdDictionaries : undefined,
    summarizeValidationRun: typeof summarizeValidationRun === 'function' ? summarizeValidationRun : undefined,
  };\n`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, `${exportBlock}\n})();`);

  const document = {
    body: createElementStub(), documentElement: createElementStub(),
    getElementById() { return createElementStub(); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return createElementStub(); },
  };
  const sandbox = {
    Blob, Map, Set, TextDecoder, Uint8Array, URL, console, document,
    XLSX, // 真实 .xlsx 经 SheetJS sheet_to_json 解析时需要
    window: null,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return sandbox.__tverVerifyApi;
}

let cachedApi = null;
function getTverApi() {
  if (!cachedApi) cachedApi = loadTverApi();
  return cachedApi;
}

function readWorkbookFromPath(filePath) {
  const buffer = fs.readFileSync(filePath);
  return XLSX.read(buffer, { type: 'buffer', cellDates: true });
}

function collectCases(root) {
  const all = fs.readdirSync(root, { withFileTypes: true });
  const xlsxAtRoot = all.filter(entry => !entry.isDirectory() && /\.xlsx$/i.test(entry.name));
  const csvAtRoot = all.filter(entry => !entry.isDirectory() && /\.csv$/i.test(entry.name));
  const subdirs = all.filter(entry => entry.isDirectory());
  const cases = [];
  if (xlsxAtRoot.length === 1 && csvAtRoot.length === 1) {
    cases.push({ name: path.basename(root), dir: root });
  }
  subdirs.forEach(sub => cases.push({ name: sub.name, dir: path.join(root, sub.name) }));
  return cases;
}

function processCase(caseInfo, api) {
  const result = { case: caseInfo.name, ok: false };
  let items;
  try {
    items = fs.readdirSync(caseInfo.dir, { withFileTypes: true }).filter(entry => !entry.isDirectory());
  } catch (err) {
    result.error = `cannot read case directory: ${err && err.message ? err.message : String(err)}`;
    return result;
  }
  const xlsxFiles = items.filter(entry => /\.xlsx$/i.test(entry.name));
  const csvFiles = items.filter(entry => /\.csv$/i.test(entry.name));
  // 不猜选：每案必须恰好一份 .xlsx 与一份 .csv。
  if (xlsxFiles.length !== 1) {
    result.error = `expected exactly one .xlsx in case '${caseInfo.name}', found ${xlsxFiles.length}`;
    return result;
  }
  if (csvFiles.length !== 1) {
    result.error = `expected exactly one .csv in case '${caseInfo.name}', found ${csvFiles.length}`;
    return result;
  }
  const xlsxPath = path.join(caseInfo.dir, xlsxFiles[0].name);
  const csvPath = path.join(caseInfo.dir, csvFiles[0].name);

  let workbook;
  try {
    workbook = readWorkbookFromPath(xlsxPath); // XLSX 解析失败则该案直接失败
  } catch (err) {
    result.error = `xlsx read failed: ${err && err.message ? err.message : String(err)}`;
    return result;
  }

  const settingModel = api.parseTverSettingWorkbook(workbook, { fileName: xlsxPath });
  if (!settingModel) {
    result.error = 'setting workbook parse returned no model';
    return result;
  }
  // 与正式页面 runTverCheck 的 settingParseBlockingIssue 完全一致：仅 4 类主结构错误阻断整案。
  const blockingIssue = api.settingParseBlockingIssue(settingModel);
  if (blockingIssue) {
    result.error = `setting workbook parse blocking: ${blockingIssue.code}`;
    return result;
  }
  // 非阻断 diagnostics（字段级 / 模板警告）保留在 summary，不阻断整案。
  result.settingDiagnostics = settingModel.diagnostics || [];

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const parsedCsv = api.parseCsvText(csvText, { fileName: csvPath });
  if (!parsedCsv.schema.kind) {
    result.error = 'csv schema not recognized';
    return result;
  }

  const dictionaryState = api.validateIdDictionaries(api.getTverIdDictionaries());
  if (!dictionaryState.valid) {
    result.error = 'embedded id dictionaries invalid';
    return result;
  }

  const csvTree = parsedCsv.schema.kind === 'edit-with-ids'
    ? api.buildEditTree(parsedCsv)
    : api.buildRegisterTree(parsedCsv);
  const matching = api.matchTverEntities(settingModel, csvTree, {
    schemaKind: parsedCsv.schema.kind,
    conversionContext: api.createTverConversionContext(parsedCsv.schema.kind, csvTree),
  });
  const run = api.buildRunFromModels(settingModel, csvTree, matching, parsedCsv);
  result.ok = true;
  result.summary = api.summarizeValidationRun(run);
  return result;
}

function main() {
  let root = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root') { root = args[i + 1]; i += 1; }
  }
  if (!root) {
    process.stderr.write('usage: node tests/tver_real_file.verify.js --root <path>\n');
    process.exit(2);
    return;
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    process.stderr.write(`root path not found or not a directory: ${root}\n`);
    process.exit(2);
    return;
  }
  const api = getTverApi();
  const cases = collectCases(root);
  if (cases.length === 0) {
    process.stderr.write(`no cases found under root: ${root}\n`);
    process.exit(2);
    return;
  }
  let anyFailure = false;
  cases.forEach(c => {
    const res = processCase(c, api);
    process.stdout.write(JSON.stringify(res) + '\n');
    if (!res.ok) anyFailure = true;
  });
  process.exit(anyFailure ? 1 : 0);
}

module.exports = { readWorkbookFromPath, getTverApi, collectCases, processCase };

if (require.main === module) main();
