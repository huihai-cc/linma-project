// Amazon DSP Online Video の実ファイル Gate。
// 使用方法:
//   node tests/amazon_dsp_video_real.verify.js <設定表.xlsx> <ダウンロード.xlsx>
// 実ファイルは読み取り専用で扱い、比較結果を JSON で出力する。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx');

const htmlPath = path.join(__dirname, '..', 'amazon_dsp_check.html');
const [settingPath, downloadPath] = process.argv.slice(2);
if(!settingPath || !downloadPath){
  console.error('使用方法: node tests/amazon_dsp_video_real.verify.js <設定表.xlsx> <ダウンロード.xlsx>');
  process.exit(2);
}

function createElement(initialValue = ''){
  return {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, cloneNode() { return this; }, dataset: {},
    disabled: false, files: [], innerHTML: '', parentNode: { replaceChild() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute() {}, scrollIntoView() {}, setAttribute() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
  };
}

function loadAmazonApi(){
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(match => match[1])
    .find(script => script.includes('resolveCreativeDownloadDateTime'));
  if(!source) throw new Error('Amazon DSP application script not found');

  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id){
      if(!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const logs = { log: [], warn: [], error: [] };
  const exportBlock = `
window.__amazonRealApi = {
  detectDownloadSystemAuto: detectDownloadSystemAuto,
  readSettingTableDSPVideo: readSettingTableDSPVideo,
  readDownloadDataVideoMulti: readDownloadDataVideoMulti,
  readCreativeSettingDataMulti: readCreativeSettingDataMulti,
  readCreativeDownloadDataMulti: readCreativeDownloadDataMulti,
  checkAmazon: checkAmazon,
};
`;
  const instrumented = source.replace(/\}\)\(\);\s*$/, exportBlock + '\n})();');
  const sandbox = {
    Blob, DecompressionStream: globalThis.DecompressionStream, Encoding: {},
    FileReader: function FileReader() {}, JSZip: {}, Map, Promise, Response, Set,
    TextDecoder, Uint8Array, URL, alert() {}, atob: globalThis.atob,
    console: {
      log(...args){ logs.log.push(args.join(' ')); },
      warn(...args){ logs.warn.push(args.join(' ')); },
      error(...args){ logs.error.push(args.join(' ')); },
    },
    document, sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: (s) => String(s ?? ''), XLSX,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: htmlPath });
  return { api: sandbox.__amazonRealApi, logs };
}

function normalizeName(value){
  return String(value ?? '').normalize('NFKC').replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function getColumn(item, key){
  return item.colResults.find(col => col.key === key) || null;
}

function compactSetting(row){
  return {
    liName: row.__LI_NAME__,
    media: row.media,
    mobile_env: row.mobile_env,
    mobileSource: row.__MOBILE_ENV_SOURCE__ || '',
    product: row.product_small,
    ssp: row.ssp,
    language: row.language,
    domain: row.domain_bl,
    brandTier: row.brand_inventory_tier,
    brandExclusions: row.brand_exclusions,
    viewability: row.viewability_pct,
    unmeasured: row.viewability_excl,
    videoInit: row.video_init,
    videoSize: row.video_size,
    videoCompletion: row.video_comp,
    position: row.position,
    audience: row.audience,
  };
}

const { api, logs } = loadAmazonApi();
const settingWb = XLSX.readFile(settingPath, { cellFormula: false, cellStyles: false });
const downloadWb = XLSX.readFile(downloadPath, { cellFormula: false, cellStyles: false });
const wbsS = [{ wb: settingWb, fileName: path.basename(settingPath) }];
const wbsD = [{ wb: downloadWb, fileName: path.basename(downloadPath) }];
const systemResult = api.detectDownloadSystemAuto(wbsD, wbsS);
const settingRows = api.readSettingTableDSPVideo(settingWb);
const downloadData = api.readDownloadDataVideoMulti(wbsD);
const checkResult = systemResult.system === 'amazon_dsp_video'
  ? api.checkAmazon(wbsS, wbsD, 'amazon_dsp_video', 'initial')
  : null;
const crSetting = api.readCreativeSettingDataMulti(
  wbsS, 'initial', settingRows.map(row => row.__LI_NAME__)
);
const crDownload = api.readCreativeDownloadDataMulti(wbsD);
const cr = checkResult ? (checkResult.creative || {}) : {};
const items = checkResult ? checkResult.items : [];

const settingNameSet = new Set(settingRows.map(row => normalizeName(row.__LI_NAME__)).filter(Boolean));
const downloadRows = Object.values(downloadData.liMap || {});
const exactMatches = downloadRows.filter(row => settingNameSet.has(normalizeName(row['Line name*'])));
const targetAudienceLi = 'Refa_MISAMO_VIDEO_Off_MISAMO Fan_2609';
const targetItem = items.find(item => item.liName === targetAudienceLi);

const itemSummaries = items.map(item => {
  const field = key => getColumn(item, key);
  return {
    liName: item.liName,
    found: item.found,
    matchedName: item.matchedName,
    onlineVideo: field('Video Ad Content Type*'),
    mobile: field('Mobile environment'),
    product: field('Product categories*'),
    supply: field('Supply source'),
    language: field('Language targeting'),
    viewability: field('Amazon viewability'),
    unmeasured: field('Unmeasured viewability'),
    brandTier: field('Brand suitability inventory tier'),
    brandExclusions: field('Brand suitability content exclusion categories'),
    videoInit: field('Video initiation type'),
    videoSize: field('Video player size'),
    videoCompletion: field('Video completion'),
    positionIn: field('In-stream position'),
    positionOut: field('Out-stream position'),
    domain: field('Domain Targeting - (READ ONLY)'),
    domainNote: item.__domain_note__ || '',
    audience: field('Audience names'),
  };
});

const summary = {
  settingSheet: settingWb.SheetNames.includes('動画_LineItem設定シート'),
  downloadSheet: downloadData.files.some(file => file.sheet === 'VIDEO LINE ITEMS'),
  systemResult,
  settingRows: settingRows.map(compactSetting),
  settingLiCount: settingRows.length,
  downloadLiCount: Object.keys(downloadData.liMap || {}).length,
  liExactMatchCount: exactMatches.length,
  liNotFoundCount: items.filter(item => !item.found).length,
  items: itemSummaries,
  audienceTarget: targetItem ? {
    liName: targetItem.liName,
    result: getColumn(targetItem, 'Audience names'),
    settingAudience: targetItem.colResults.find(col => col.key === 'Audience names')?.sVal || '',
    downloadAudience: targetItem.colResults.find(col => col.key === 'Audience names')?.dVal || '',
    note: targetItem.__audience_diff__ || '',
  } : null,
  creative: {
    settingCount: crSetting.rows.length,
    downloadAssociationCount: crDownload.rows.length,
    matchCount: cr.matchCount,
    nameMatchCount: (cr.items || []).filter(item => item.matchStatus === 'match').length,
    notFoundCount: cr.notFoundCount,
    errorCount: cr.errorCount,
  },
  logs: { warnCount: logs.warn.length, errorCount: logs.error.length },
};
console.log(JSON.stringify(summary, null, 2));

const structuralPass = summary.settingSheet && summary.downloadSheet &&
  summary.systemResult.determined && summary.systemResult.system === 'amazon_dsp_video' &&
  summary.settingLiCount === 4 && summary.downloadLiCount === 4 &&
  summary.liExactMatchCount === 4 && summary.liNotFoundCount === 0;
const itemPass = items.length === 4 && items.every(item =>
  item.found &&
  getColumn(item, 'Video Ad Content Type*')?.result === true &&
  getColumn(item, 'Mobile environment')?.result === true &&
  getColumn(item, 'Product categories*')?.result === true &&
  getColumn(item, 'Supply source')?.result === true &&
  getColumn(item, 'Language targeting')?.result === true &&
  getColumn(item, 'Amazon viewability')?.result === true &&
  getColumn(item, 'Unmeasured viewability')?.result === true &&
  getColumn(item, 'Brand suitability inventory tier')?.result === true &&
  getColumn(item, 'Brand suitability content exclusion categories')?.result === true &&
  getColumn(item, 'Video initiation type')?.result === true &&
  getColumn(item, 'Video player size')?.result === true &&
  getColumn(item, 'Video completion')?.result === true &&
        getColumn(item, 'In-stream position')?.result === true &&
        getColumn(item, 'Out-stream position')?.result === true &&
        getColumn(item, 'Domain Targeting - (READ ONLY)')?.result === null &&
        /CSVではDomain Targeting「Yes」まで確認可能/.test(item.__domain_note__ || '') &&
        !getColumn(item, 'Base supply bid*')
);
const audiencePass = !!targetItem && getColumn(targetItem, 'Audience names')?.result === false &&
  /MISAMO商品閲覧層|MISAMO商品購買層|MISAMO出演作品閲覧層/.test(targetItem.__audience_diff__ || '');
const crPass = summary.creative.settingCount === 4 &&
  summary.creative.downloadAssociationCount === 4 &&
  summary.creative.matchCount === 4 &&
  summary.creative.nameMatchCount === 4 &&
  summary.creative.notFoundCount === 0 &&
  summary.creative.errorCount === 0;
console.error(JSON.stringify({ REAL_GATE: structuralPass && itemPass && audiencePass && crPass ? 'PASS' : 'FAIL', structuralPass, itemPass, audiencePass, crPass }));
process.exitCode = structuralPass && itemPass && audiencePass && crPass ? 0 : 1;
