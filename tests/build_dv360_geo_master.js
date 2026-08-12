'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const EXPECTED_HEADERS = [
  'criteria_id', 'name_en', 'canonical_name', 'parent_id', 'country_code', 'target_type',
  'status', 'level_hint', 'prefecture_id', 'prefecture_en', 'prefecture_ja',
  'dv360_sdf_field', 'source_version',
];
const DEFAULT_INPUT = 'D:\\業務用\\開発用\\テスト用アイル\\設定用\\DV360\\dv360_jp_geo_targets_2026-07-06.csv';
const DEFAULT_HTML = path.join(__dirname, '..', 'dv360_check.html');
const BEGIN = '// BEGIN GENERATED DV360 GEO MASTER';
const END = '// END GENERATED DV360 GEO MASTER';
const VALID_LEVELS = new Map([
  ['Country', 'country'],
  ['Prefecture', 'prefecture'],
  ['City', 'below_prefecture'],
  ['County', 'below_prefecture'],
  ['Neighborhood', 'below_prefecture'],
  ['Postal Code', 'below_prefecture'],
  ['Municipality', 'below_prefecture'],
  ['TV Region', 'below_prefecture'],
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  row.push(value);
  if (row.some(cell => cell !== '')) rows.push(row);
  return rows;
}

function compareCode(left, right) {
  const leftValue = BigInt(left[0]);
  const rightValue = BigInt(right[0]);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return left[0].localeCompare(right[0]);
}

function validateGeoRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('CSV contains no geo target rows');
  const headers = rows[0].map((value, index) => index === 0 ? String(value).replace(/^\uFEFF/, '') : String(value));
  if (JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS)) {
    throw new Error(`unexpected CSV header: ${headers.join(',')}`);
  }
  const entries = [];
  const seenCodes = new Set();
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.length !== EXPECTED_HEADERS.length) throw new Error(`abnormal CSV column count at row ${index + 1}`);
    const record = Object.fromEntries(EXPECTED_HEADERS.map((header, column) => [header, String(row[column] ?? '').trim()]));
    if (!/^\d+$/.test(record.criteria_id)) throw new Error(`invalid Code at row ${index + 1}`);
    if (seenCodes.has(record.criteria_id)) throw new Error(`duplicate Code: ${record.criteria_id}`);
    seenCodes.add(record.criteria_id);
    if (!record.name_en || !record.canonical_name || !record.country_code) {
      throw new Error(`missing English name or country at row ${index + 1}`);
    }
    if (VALID_LEVELS.get(record.target_type) !== record.level_hint) {
      throw new Error(`abnormal target level at row ${index + 1}: ${record.target_type}/${record.level_hint}`);
    }
    if (record.target_type === 'Prefecture' && !record.prefecture_ja) {
      throw new Error(`missing direct Japanese prefecture name at row ${index + 1}`);
    }
    const directJapaneseName = record.target_type === 'Prefecture' ? record.prefecture_ja : '';
    entries.push([
      record.criteria_id,
      record.canonical_name,
      record.target_type,
      directJapaneseName,
      record.prefecture_ja,
      record.country_code,
    ]);
  }
  return entries.sort(compareCode);
}

function makeGeneratedBlock(entries) {
  const gzip = zlib.gzipSync(Buffer.from(JSON.stringify(entries)), { mtime: 0 });
  return `${BEGIN}\nconst GEO_TARGET_MASTER_GZIP_BASE64 = '${gzip.toString('base64')}';\n${END}`;
}

function replaceGeneratedBlock(html, block) {
  const markedPattern = /\/\/ BEGIN GENERATED DV360 GEO MASTER\r?\n[\s\S]*?\/\/ END GENERATED DV360 GEO MASTER/;
  const markedMatches = html.match(new RegExp(markedPattern.source, 'g')) || [];
  if (markedMatches.length === 1) return html.replace(markedPattern, block);
  if (markedMatches.length > 1) throw new Error('HTML contains multiple Geo Master generated blocks');
  const legacyPattern = /const GEO_TARGET_MASTER_GZIP_BASE64\s*=\s*'[^']+';/;
  const legacyMatches = html.match(new RegExp(legacyPattern.source, 'g')) || [];
  if (legacyMatches.length !== 1) throw new Error('HTML must contain exactly one legacy Geo Master constant');
  return html.replace(legacyPattern, block);
}

function buildGeoMaster({ inputPath = DEFAULT_INPUT, htmlPath = DEFAULT_HTML, check = false } = {}) {
  const csv = fs.readFileSync(inputPath, 'utf8');
  const entries = validateGeoRows(parseCsv(csv));
  const block = makeGeneratedBlock(entries);
  const originalHtml = fs.readFileSync(htmlPath, 'utf8');
  const nextHtml = replaceGeneratedBlock(originalHtml, block);
  const changed = originalHtml !== nextHtml;
  if (check && changed) throw new Error('Geo Master generated output differs from HTML');
  if (!check && changed) fs.writeFileSync(htmlPath, nextHtml, 'utf8');
  return { recordCount: entries.length, entries, changed };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') options.check = true;
    else if (token === '--input') options.inputPath = argv[++index];
    else if (token === '--html') options.htmlPath = argv[++index];
    else throw new Error(`unknown argument: ${token}`);
  }
  return options;
}

if (require.main === module) {
  try {
    const result = buildGeoMaster(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({ recordCount: result.recordCount, changed: result.changed })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { EXPECTED_HEADERS, parseCsv, validateGeoRows, buildGeoMaster };
