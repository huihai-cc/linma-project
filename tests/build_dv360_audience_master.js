'use strict';

// DV360 Google Audience Master 内嵌ビルドスクリプト
// data/dv360_google_audience_master.csv → gzip → base64 → dv360_check.html の
// // BEGIN GENERATED DV360 AUDIENCE MASTER ... // END GENERATED DV360 AUDIENCE MASTER を置換する。
// 用法: node tests/build_dv360_audience_master.js [--check] [--input マスターCSV] [--html dv360_check.html]

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const EXPECTED_HEADERS = [
  'audience_id', 'audience_name', 'audience_type', 'type',
  'category', 'parent', 'source', 'updated_at',
];
const DEFAULT_INPUT = path.join(__dirname, '..', 'data', 'dv360_google_audience_master.csv');
const DEFAULT_HTML = path.join(__dirname, '..', 'dv360_check.html');
const BEGIN = '// BEGIN GENERATED DV360 AUDIENCE MASTER';
const END = '// END GENERATED DV360 AUDIENCE MASTER';
const VALID_AUDIENCE_TYPES = new Set(['AFFINITY', 'IN_MARKET', 'LIFE_EVENT', 'EXTENDED_DEMOGRAPHIC']);
const VALID_TYPES = new Set(['affinity', 'in_market', 'life_event', 'extended_demographic']);
const LEGACY_BY_AUDIENCE_TYPE = Object.freeze({
  AFFINITY: 'affinity',
  IN_MARKET: 'in_market',
  LIFE_EVENT: 'life_event',
  EXTENDED_DEMOGRAPHIC: 'extended_demographic',
});

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

function validateAudienceRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('CSV contains no audience rows');
  const headers = rows[0].map((v, i) => i === 0 ? String(v).replace(/^﻿/, '') : String(v));
  if (JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS)) {
    throw new Error(`unexpected CSV header: ${headers.join(',')}`);
  }
  const entries = [];
  const seenIds = new Set();
  const duplicateIds = [];
  const seenNames = new Map(); // name → [ids]（同名複数IDを保持）
  const duplicateNames = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.length !== EXPECTED_HEADERS.length) {
      // 末尾の空セル欠落を許容（CSV 行末カンマなし）→ 埋める
      while (row.length < EXPECTED_HEADERS.length) row.push('');
    }
    const record = Object.fromEntries(EXPECTED_HEADERS.map((h, c) => [h, String(row[c] ?? '').trim()]));
    // Audience ID は文字列として保持（Number 化禁止）
    if (!/^\d{5,12}$/.test(record.audience_id)) {
      throw new Error(`invalid audience ID at row ${index + 1}: ${record.audience_id}`);
    }
    if (!VALID_AUDIENCE_TYPES.has(record.audience_type)) {
      throw new Error(`invalid audience type at row ${index + 1}: ${record.audience_type}`);
    }
    if (!VALID_TYPES.has(record.type)) throw new Error(`invalid type at row ${index + 1}: ${record.type}`);
    if (LEGACY_BY_AUDIENCE_TYPE[record.audience_type] !== record.type) {
      throw new Error(`audience type mismatch at row ${index + 1}: ${record.audience_type}/${record.type}`);
    }
    if (!record.audience_name) throw new Error(`missing audience name at row ${index + 1}`);
    if (!record.source) throw new Error(`missing source at row ${index + 1}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.updated_at)) {
      throw new Error(`invalid updated_at at row ${index + 1}: ${record.updated_at}`);
    }
    if (seenIds.has(record.audience_id)) duplicateIds.push(record.audience_id);
    seenIds.add(record.audience_id);
    if (seenNames.has(record.audience_name)) duplicateNames.push(record.audience_name);
    seenNames.set(record.audience_name, (seenNames.get(record.audience_name) || []).concat(record.audience_id));
    // [id, type, category, parent, name, canonicalType, source, updatedAt] のコンパクト配列
    entries.push([
      record.audience_id,
      record.type,
      record.category,
      record.parent,
      record.audience_name,
      record.audience_type,
      record.source,
      record.updated_at,
    ]);
  }
  // ID 昇順（文字列比較ではなく数値比較）
  entries.sort((a, b) => Number(a[0]) - Number(b[0]));
  return { entries, duplicateIds: [...new Set(duplicateIds)], duplicateNames: [...new Set(duplicateNames)] };
}

function makeGeneratedBlock(entries) {
  const gzip = zlib.gzipSync(Buffer.from(JSON.stringify(entries)), { mtime: 0 });
  return `${BEGIN}\nconst AUDIENCE_TARGET_MASTER_GZIP_BASE64 = '${gzip.toString('base64')}';\n${END}`;
}

function replaceGeneratedBlock(html, block) {
  const markedPattern = /\/\/ BEGIN GENERATED DV360 AUDIENCE MASTER\r?\n[\s\S]*?\/\/ END GENERATED DV360 AUDIENCE MASTER/;
  const markedMatches = html.match(new RegExp(markedPattern.source, 'g')) || [];
  if (markedMatches.length === 1) return html.replace(markedPattern, block);
  if (markedMatches.length > 1) throw new Error('HTML contains multiple Audience Master generated blocks');
  const legacyPattern = /const AUDIENCE_TARGET_MASTER_GZIP_BASE64\s*=\s*'[^']+';/;
  const legacyMatches = html.match(new RegExp(legacyPattern.source, 'g')) || [];
  if (legacyMatches.length !== 1) throw new Error('HTML must contain exactly one legacy Audience Master constant');
  return html.replace(legacyPattern, block);
}

function buildAudienceMaster({ inputPath = DEFAULT_INPUT, htmlPath = DEFAULT_HTML, check = false } = {}) {
  const csv = fs.readFileSync(inputPath, 'utf8');
  const { entries, duplicateIds, duplicateNames } = validateAudienceRows(parseCsv(csv));
  const block = makeGeneratedBlock(entries);
  const originalHtml = fs.readFileSync(htmlPath, 'utf8');
  const nextHtml = replaceGeneratedBlock(originalHtml, block);
  const changed = originalHtml !== nextHtml;
  if (check && changed) throw new Error('Audience Master generated output differs from HTML');
  if (!check && changed) fs.writeFileSync(htmlPath, nextHtml, 'utf8');
  return {
    recordCount: entries.length,
    affinityCount: entries.filter(e => e[1] === 'affinity').length,
    inMarketCount: entries.filter(e => e[1] === 'in_market').length,
    lifeEventCount: entries.filter(e => e[1] === 'life_event').length,
    extendedDemographicCount: entries.filter(e => e[1] === 'extended_demographic').length,
    duplicateIds,
    duplicateNames,
    changed,
  };
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
    const result = buildAudienceMaster(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { EXPECTED_HEADERS, parseCsv, validateAudienceRows, buildAudienceMaster };
