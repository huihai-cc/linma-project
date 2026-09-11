'use strict';

// 仅用于 TVer 单元测试的程序生成数据；不含真实案件、客户、素材或预算信息。
// `新規設定バルク(26.3.6時点)` 的 61 个非空字段（260605 固定模板）。
const REGISTER_HEADERS = [
  'campaign_name', 'start_datetime', 'end_datetime', 'budget_type', 'budget', 'daily_budget',
  'hourly_bid_weight', 'campaign_status', 'consumption_type', 'cv_point', 'report_target_flag',
  'tver_video_duration', 'adgroup_name', 'adgroup_start_datetime', 'adgroup_end_datetime',
  'daily_freq_cap', 'auction_type', 'price', 'adgroup_status', 'device', 'media',
  'local_broadcaster', 'bls_start_datetime', 'bls_end_datetime', 'contact_bls_survey_id',
  'non_contact_bls_survey_id', 'gender', 'start_age', 'end_age', 'pref', 'city', 'affinity',
  'demography', 'annual_income', 'tv_usage_tendency', 'carrier', 'uid_suffix', 'genre',
  'genre_exclude', 'subgenre', 'subgenre_exclude', 'contents_group', 'bid_segment',
  'upload_segment_expansion_threshold', 'bid_segment_exclude', 'dmp_segment',
  'dmp_segment_expansion_threshold', 'dmp_segment_exclude', 'store_segment', 'bls_store_segment',
  'creative_id', 'creative_name', 'url', 'tracking_url_start', 'tracking_url_first_quartile',
  'tracking_url_midpoint', 'tracking_url_third_quartile', 'tracking_url_complete', 'start_time',
  'end_time', 'status',
];
const EDIT_HEADERS = [
  ...REGISTER_HEADERS.filter(header => !['budget_type', 'tver_video_duration', 'dmp_segment'].includes(header)),
  'campaign_id', 'adgroup_id', 'ad_id',
];

if (EDIT_HEADERS.length !== 61 || REGISTER_HEADERS.length !== 61) {
  throw new Error('Synthetic TVer schema headers must contain exactly 61 columns');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeCsv(headers, rows, { bom = false } = {}) {
  const lines = [headers, ...rows].map(row => row.map(csvEscape).join(','));
  return `${bom ? '\uFEFF' : ''}${lines.join('\r\n')}`;
}

function makeRow(headers, values = {}) {
  return headers.map(header => Object.prototype.hasOwnProperty.call(values, header) ? values[header] : '');
}

function makeEditCsv(rows, options) {
  return makeCsv(EDIT_HEADERS, rows.map(values => makeRow(EDIT_HEADERS, values)), options);
}

function makeRegisterCsv(rows, options) {
  return makeCsv(REGISTER_HEADERS, rows.map(values => makeRow(REGISTER_HEADERS, values)), options);
}

function makeSettingWorkbook({
  headerRow = 27, sheetName = 'Synthetic', duplicateSheet = false,
  omitTargetingBlock = false, ambiguousCreative = false, missingBusinessHeader = false,
  duplicateBusinessHeader = false,
} = {}) {
  const header = [
    '発注CPN名', 'CPN訴求', 'CPN予算', '開始日時(yyyy/mm/dd hh:mm)', '終了日時(yyyy/mm/dd hh:mm)',
    'ターゲティング番号', 'ADG開始日時(yyyy/mm/dd hh:mm)', 'ADG終了日時(yyyy/mm/dd hh:mm)',
    '素材名', 'LP名', 'タグ訴求', '初期設定日予算', 'その他設定', '変更履歴',
  ];
  if (missingBusinessHeader) header[header.indexOf('CPN予算')] = 'missing_budget_header';
  if (duplicateBusinessHeader) header[header.indexOf('CPN予算')] = 'CPN訴求';
  const rows = Array.from({ length: headerRow }, () => ['', '', '', '']);
  rows[headerRow - 1] = header;
  rows.push([
    'Synthetic Campaign', 'Synthetic Appeal', '900', '2026/01/01 00:00', '2026/01/31 23:30',
    'T-001', '2026/01/01 00:00', '2026/01/31 23:30', 'synthetic.mp4', 'Synthetic LP',
    'Synthetic Tag', '30', 'Synthetic Other Setting', 'Synthetic Change History',
  ]);
  if (!omitTargetingBlock) {
    rows.push(['★ターゲティング', '', '', '']);
    rows.push(['ターゲティング番号', 'device', 'media', '']);
    rows.push(['T-001', 'CTV', 'synthetic-media', '']);
  }
  rows.push(['★クリエイティブ', '', '', '']);
  rows.push(['素材名', 'ファイル名', 'LP URL', '']);
  rows.push(['synthetic.mp4', 'synthetic.mp4', 'https://example.invalid/lp', '']);
  if (ambiguousCreative) rows.push(['synthetic.mp4', 'synthetic-alt.mp4', 'https://example.invalid/alt', '']);
  rows.push(['★変更履歴', '', '', '']);
  rows.push(['変更履歴', '運用メモ', 'その他設定', '']);
  rows.push(['Synthetic Change History', 'Synthetic Operation Memo', 'Synthetic Other Setting', '']);
  const sheets = { [sheetName]: rows };
  if (duplicateSheet) sheets.SyntheticDuplicate = rows.map(row => [...row]);
  return { SheetNames: Object.keys(sheets), Sheets: sheets };
}

const SETTING_HEADERS = [
  '発注CPN名', 'CPN訴求', 'CPN予算', '開始日時(yyyy/mm/dd hh:mm)', '終了日時(yyyy/mm/dd hh:mm)',
  'ターゲティング番号', 'ADG開始日時(yyyy/mm/dd hh:mm)', 'ADG終了日時(yyyy/mm/dd hh:mm)',
  '素材名', 'LP名', 'タグ訴求', '初期設定日予算', 'その他設定', '変更履歴',
];

function makeStructuredSettingWorkbook({
  headerRow = 19,
  sectionMarkerStyle = 'split',
  creativeHeaderMode = 'unique',
  creativeExplanationRows = 0,
  targetingStartColumns = [1, 7],
  targetingBatches,
  mainRows,
  operationMemo = 'Synthetic Operation Memo',
  measurementTagHeaderMode = 'unique',
  measurementTagRows,
  measurementTagBlocks,
} = {}) {
  const rows = Array.from({ length: headerRow }, () => []);
  rows[headerRow - 4] = ['', '', '', '', '', '▼運用メモ欄', operationMemo];
  rows[headerRow - 1] = [...SETTING_HEADERS];
  const defaultMainRow = {
    '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30',
    'ターゲティング番号': 'TG-01', 'ADG開始日時(yyyy/mm/dd hh:mm)': '2026/02/01 00:00',
    'ADG終了日時(yyyy/mm/dd hh:mm)': '2026/02/28 23:30', '素材名': 'synthetic-creative.mp4',
    'LP名': 'Synthetic LP', 'タグ訴求': 'Synthetic Tag', '初期設定日予算': '30',
    'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
  };
  const designRows = mainRows || [defaultMainRow];
  for (const values of designRows) rows.push(SETTING_HEADERS.map(header => values[header] ?? ''));

  rows.push(sectionMarkerStyle === 'single' ? ['★ターゲティング'] : ['★', 'ターゲティング']);
  rows.push([]);
  const defaultBatches = [[
    { number: 'TG-01', device: 'Synthetic Device A', media: 'Synthetic Media A', price: '11' },
    { number: 'TG-02', device: 'Synthetic Device B', media: 'Synthetic Media B', price: '22' },
  ]];
  const batches = targetingBatches || defaultBatches;
  const fieldRows = [
    ['ターゲティング名', 'number'], ['広告再生時間●', 'duration'], ['CPM●', 'price'],
    ['配信デバイス●', 'device'], ['放送局●', 'media'], ['性別●', 'gender'],
    ['年齢●', 'age'], ['都道府県/市区町村●', 'region'], ['興味関心●', 'audience'],
    ['番組ジャンル●', 'genre'], ['番組サブジャンル●', 'subgenre'], ['DMPセグメント', 'segment'],
    ['その他設定(ADG)', 'otherSettings'],
  ];
  for (const batch of batches) {
    for (const [label, field] of fieldRows) {
      const row = [];
      batch.forEach((group, index) => {
        const start = targetingStartColumns[index];
        if (start === undefined) return;
        row[start] = label;
        if (field === 'number') {
          row[start + 1] = group.displayName ?? 'Synthetic Target Label';
          row[start + 2] = group.number ?? '';
        } else {
          row[start + 1] = group[field] ?? (field === 'duration' ? 'Synthetic Duration' : '');
        }
      });
      rows.push(row);
    }
    rows.push([]);
  }

  rows.push(sectionMarkerStyle === 'single' ? ['★クリエイティブ'] : ['★', 'クリエイティブ']);
  for (let index = 0; index < creativeExplanationRows; index += 1) rows.push(['クリック●', `Synthetic note ${index + 1}`]);
  const creativeHeader = creativeHeaderMode === 'missing'
    ? ['素材名', 'ファイル名', 'Missing LP Header']
    : ['素材名', 'ファイル名', 'LP URL'];
  rows.push(creativeHeader);
  if (creativeHeaderMode === 'multiple') rows.push(['素材名', 'ファイル名', 'LP URL']);
  rows.push(['synthetic-creative.mp4', 'synthetic-creative.mp4', 'https://example.invalid/synthetic-lp']);
  rows.push(sectionMarkerStyle === 'single' ? ['★計測タグ'] : ['★', '計測タグ']);
  const measurementHeader = measurementTagHeaderMode === 'missing'
    ? ['タグ訴求', 'Missing Tag Header', 'タグ提供元', '計測地点', '新規/流用']
    : ['タグ訴求', 'タグ', 'タグ提供元', '計測地点', '新規/流用'];
  if (measurementTagBlocks) {
    measurementTagBlocks.forEach((block, index) => {
      rows.push(measurementHeader);
      (block.tags || []).forEach(tag => rows.push(measurementHeader.map(header => tag[header] ?? '')));
      if (index < measurementTagBlocks.length - 1) rows.push([]);
    });
  } else {
    rows.push(measurementHeader);
    if (measurementTagHeaderMode === 'multiple') rows.push(['タグ訴求', 'タグ', 'タグ提供元', '計測地点', '新規/流用']);
    const tags = measurementTagRows || [{
      'タグ訴求': 'Synthetic Tag', 'タグ': 'https://tracker.invalid/complete?x={adid}',
      'タグ提供元': 'Synthetic Vendor', '計測地点': '100%', '新規/流用': '新規',
    }];
    tags.forEach(tag => rows.push(measurementHeader.map(header => tag[header] ?? '')));
  }
  rows.push(['★', '後続区块']);
  return { SheetNames: ['Structured Synthetic'], Sheets: { 'Structured Synthetic': rows } };
}

// 仅供任务 11 批量验证测试使用：用仓库本地 SheetJS 生成最小、完全虚构的工作簿 Buffer。
// 不引入任何真实案件、客户、素材或预算信息；该方法仅在测试中被调用。
function makeMinimalSettingWorkbookBuffer(options) {
  const XLSX = require('../../xlsx.full.min.js'); // 仓库本地 SheetJS，不联网
  const workbook = makeSettingWorkbook(options || { headerRow: 27 });
  const sheetName = workbook.SheetNames[0];
  const aoa = workbook.Sheets[sheetName];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  return XLSX.write(book, { bookType: 'xlsx', type: 'buffer' });
}

module.exports = {
  EDIT_HEADERS,
  REGISTER_HEADERS,
  makeCsv,
  makeEditCsv,
  makeRegisterCsv,
  makeRow,
  makeSettingWorkbook,
  makeStructuredSettingWorkbook,
  makeMinimalSettingWorkbookBuffer,
};
