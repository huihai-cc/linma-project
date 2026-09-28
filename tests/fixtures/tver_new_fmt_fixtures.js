'use strict';

// NEW FMT（2609 以降のテンプレ）専用の合成 fixture。
// 実案件（D:\業務用\開発用\2課設定依頼\新FMT の 4 案）の構造のみを再現し、
// 顧客名・素材名・予算などの実データは一切含まない（すべて Synthetic）。
//
// 実案件で確認済みの OLD→NEW 差分：
//  1. 主業務表に「デバイス」列が追加（ターゲティング番号 と ADG開始日時 の間）。
//  2. 主業務表の「タグ訴求」が「タグ訴求(0%)」「タグ訴求(100%)」の 2 列に分割。
//  3. ターゲティング block に「オークションタイプ」行が追加（label | '-' | 業務値）。
// ターゲティング block の '-' はテンプレ marker（旧 FMT にも存在する）。

const NEW_FMT_SETTING_HEADERS = [
  '発注CPN名', 'CPN訴求', 'CPN予算', '開始日時(yyyy/mm/dd hh:mm)', '終了日時(yyyy/mm/dd hh:mm)',
  'ターゲティング番号', 'デバイス', 'ADG開始日時(yyyy/mm/dd hh:mm)', 'ADG終了日時(yyyy/mm/dd hh:mm)',
  '素材名', 'LP名', 'タグ訴求(0%)', 'タグ訴求(100%)', '初期設定日予算', 'その他設定', '変更履歴',
];

// 実案件（新FMT ①2415）のターゲティング block を実測した槽構造：
//   slot0（anchor+1）= テンプレ marker（'-' / '○' / 空）
//   slot1（anchor+2）= 業務値（ターゲティング名のみ slot1=番号, slot2=表示名）
//   slot2 以降       = 補足（OS指定なし・変換後デバイス・セグメント注記など）
// marker は全行に一律ではなく、テンプレが実際に置いている行だけに存在する。
// 特に DMPセグメント 行には marker が無く、slot1/slot2 は ※ 注記のみ。
const NEW_FMT_TARGETING_FIELDS = [
  { label: 'ターゲティング名', field: 'number', marker: '' },
  { label: 'オークションタイプ', field: 'auction', marker: '-' },
  { label: '広告再生時間●', field: 'duration', marker: '-' },
  { label: 'CPM●', field: 'price', marker: '-' },
  {
    label: '配信デバイス●', field: 'device', marker: '-',
    notes: [{ slot: 2, text: 'OS指定なし' }, { slot: 3, text: 'スマートデバイス, Connected TV, PC' }],
  },
  { label: '性別●', field: 'gender', marker: '' },
  { label: '年齢●', field: 'age', marker: '○' },
  {
    label: 'DMPセグメント', field: 'segment', marker: '',
    notes: [{ slot: 1, text: '※セグメント名' }, { slot: 2, text: '※セグメントID' }],
  },
  { label: 'その他設定(ADG)', field: 'otherSettings', marker: '' },
];

// 実案件（新FMT ①②）で確認した、ターゲティング grid 右側の「▼デバイス変換」注記列ブロック。
// 先頭列の '▼デバイス変換' が注記ブロックの開始マーカーであり、ターゲティング grid の一部ではない。
// 旧 FMT のターゲティング block にはこの注記ブロックが存在しない。
const NEW_FMT_ANNOTATION_COLUMN = 17;
const NEW_FMT_ANNOTATION_MARKER = '▼デバイス変換';
const NEW_FMT_ANNOTATION_BY_LABEL = {
  'ターゲティング名': [NEW_FMT_ANNOTATION_MARKER, '※slackの転送時にデバイス順をSP→PC→CTVに固定してもらうので、リリース後マスタは黄色部分だけでOK'],
  '広告再生時間●': ['Connected TV, スマートデバイス, PC', 'SP／PC／CTV'],
  'CPM●': ['PC, Connected TV, スマートデバイス', 'SP／PC／CTV'],
  '配信デバイス●': ['PC, スマートデバイス, Connected TV', 'SP／PC／CTV'],
};

function makeNewFmtSettingWorkbook({
  headerRow = 19,
  targetingStartColumns = [1, 6],
  mainRows,
  targetingBatches,
  measurementTagBlocks,
  annotationBlock = true,
} = {}) {
  const rows = Array.from({ length: headerRow }, () => []);
  rows[headerRow - 4] = ['', '', '', '', '', '▼運用メモ欄', 'Synthetic Operation Memo'];
  rows[headerRow - 1] = [...NEW_FMT_SETTING_HEADERS];

  const defaultMainRow = {
    '発注CPN名': 'Synthetic Campaign', 'CPN訴求': 'Synthetic Appeal', 'CPN予算': '900',
    '開始日時(yyyy/mm/dd hh:mm)': '2026/09/18 00:00', '終了日時(yyyy/mm/dd hh:mm)': '2026/09/27 23:45',
    'ターゲティング番号': '1', 'デバイス': 'ios, android, pc',
    'ADG開始日時(yyyy/mm/dd hh:mm)': '', 'ADG終了日時(yyyy/mm/dd hh:mm)': '',
    '素材名': 'synthetic-creative.mp4', 'LP名': 'Synthetic LP',
    'タグ訴求(0%)': '', 'タグ訴求(100%)': 'SPPC',
    '初期設定日予算': '30', 'その他設定': 'Synthetic Other Setting', '変更履歴': 'Synthetic Change History',
  };
  const designRows = mainRows || [defaultMainRow];
  for (const values of designRows) rows.push(NEW_FMT_SETTING_HEADERS.map(header => values[header] ?? ''));

  rows.push(['★', 'ターゲティング']);
  rows.push([]);
  const defaultBatches = [[
    { number: '1', device: 'SP／PC／CTV', price: '1,800', duration: '30秒(23-37秒)' },
  ]];
  const batches = targetingBatches || defaultBatches;
  batches.forEach((batch, batchIndex) => {
    for (const spec of NEW_FMT_TARGETING_FIELDS) {
      const row = [];
      batch.forEach((group, index) => {
        const start = targetingStartColumns[index];
        if (start === undefined) return;
        row[start] = spec.label;
        if (spec.field === 'number') {
          row[start + 1] = group.statusHint ?? '';
          row[start + 2] = group.number ?? '';
          row[start + 3] = group.displayName ?? '';
          return;
        }
        if (spec.field === 'auction') {
          row[start + 1] = group.auctionMarker === undefined ? spec.marker : group.auctionMarker;
          row[start + 2] = group.auction ?? '';
          return;
        }
        row[start + 1] = spec.marker;
        row[start + 2] = group[spec.field] ?? '';
        (spec.notes || []).forEach(note => { row[start + 1 + note.slot] = note.text; });
      });
      // 注記列ブロックは実案件同様、最初のバッチにのみ存在する。
      const annotation = annotationBlock && batchIndex === 0 ? NEW_FMT_ANNOTATION_BY_LABEL[spec.label] : null;
      if (annotation) {
        annotation.forEach((text, offset) => { row[NEW_FMT_ANNOTATION_COLUMN + offset] = text; });
      }
      rows.push(row);
    }
    rows.push([]);
  });

  rows.push(['★', 'クリエイティブ']);
  rows.push(['素材名', 'ファイル名', 'LP URL']);
  rows.push(['synthetic-creative.mp4', 'synthetic-creative.mp4', 'https://example.invalid/synthetic-lp']);
  rows.push(['★', '計測タグ']);
  const tagBlocks = measurementTagBlocks || [[
    { 'タグ訴求': 'SPPC', 'タグ': 'https://tracker.invalid/complete-sppc?x={adid}' },
    { 'タグ訴求': 'CTV', 'タグ': 'https://tracker.invalid/complete-ctv?x={adid}' },
  ]];
  tagBlocks.forEach((tags, index) => {
    if (index > 0) rows.push([]);
    rows.push(['タグベンダー', 'Synthetic Vendor', '100%地点']);
    rows.push(['タグ訴求', 'タグ', '新規/流用']);
    tags.forEach(tag => rows.push(['タグ訴求', 'タグ', '新規/流用'].map(header => tag[header] ?? '')));
  });
  rows.push(['★', '後続区块']);
  return { SheetNames: ['New Fmt Synthetic'], Sheets: { 'New Fmt Synthetic': rows } };
}

module.exports = { NEW_FMT_SETTING_HEADERS, makeNewFmtSettingWorkbook };
