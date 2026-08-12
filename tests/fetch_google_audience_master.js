'use strict';
// Google 公式「Google audiences targeting in Studio」と Google Ads API codes/formats の
// 公開CSVを統合し、data/dv360_google_audience_master.csv へ出力する。
// 用法: node tests/fetch_google_audience_master.js [出力CSVパス]
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://support.google.com/richmedia/answer/17100174?hl=ja';
const GOOGLE_ADS_SOURCE_BASE = 'https://developers.google.com/static/google-ads/api/data/tables/';
const GOOGLE_ADS_SOURCES = Object.freeze({
  AFFINITY: `${GOOGLE_ADS_SOURCE_BASE}affinity-categories.csv`,
  IN_MARKET: `${GOOGLE_ADS_SOURCE_BASE}in-market-categories.csv`,
  LIFE_EVENT: `${GOOGLE_ADS_SOURCE_BASE}life-events.csv`,
  EXTENDED_DEMOGRAPHIC: `${GOOGLE_ADS_SOURCE_BASE}extended-demographics.csv`,
});
const MASTER_HEADERS = Object.freeze([
  'audience_id', 'audience_name', 'audience_type', 'type',
  'category', 'parent', 'source', 'updated_at',
]);
const CANONICAL_TO_LEGACY = Object.freeze({
  AFFINITY: 'affinity',
  IN_MARKET: 'in_market',
  LIFE_EVENT: 'life_event',
  EXTENDED_DEMOGRAPHIC: 'extended_demographic',
});
const DEFAULT_OUT = path.join(__dirname, '..', 'data', 'dv360_google_audience_master.csv');

function fetchUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(fetchUrl(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    }).on('error', reject);
  });
}

// HTML 内の <table> を順に取り出し、各 table の直前に現れる見出しテキストを返す
function extractTablesWithHeading(html) {
  const tables = [];
  const re = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let m;
  let lastPos = 0;
  while ((m = re.exec(html)) !== null) {
    const before = html.slice(lastPos, m.index);
    const headingMatch = [...before.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].pop();
    const heading = headingMatch
      ? headingMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      : '';
    tables.push({ heading, body: m[1] });
    lastPos = m.index;
  }
  return tables;
}

function extractRows(tableBody) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = trRe.exec(tableBody)) !== null) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x =>
      x[1].replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/[​‌‍]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
    if (tds.length >= 2) rows.push(tds);
  }
  return rows;
}

function classifyType(heading) {
  if (/アフィニティ/.test(heading)) return 'affinity';
  if (/購買意向/.test(heading)) return 'in_market';
  return 'unknown';
}

function canonicalTypeFor(legacyType) {
  const hit = Object.entries(CANONICAL_TO_LEGACY).find(([, value]) => value === legacyType);
  if (!hit) throw new Error(`unknown legacy audience type: ${legacyType}`);
  return hit[0];
}

function legacyTypeFor(audienceType) {
  const value = CANONICAL_TO_LEGACY[audienceType];
  if (!value) throw new Error(`unknown audience type: ${audienceType}`);
  return value;
}

function parseCsvRows(text) {
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
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  row.push(value);
  if (row.some(cell => cell !== '')) rows.push(row);
  return rows;
}

function splitCategoryPath(pathValue) {
  const parts = String(pathValue || '').split('/').map(value => value.trim()).filter(Boolean);
  return {
    category: parts.length > 1 ? parts[0] : '',
    parent: parts.length > 1 ? parts[parts.length - 2] : '',
    leaf: parts[parts.length - 1] || '',
  };
}

function parseGoogleAdsAudienceCsv(csv, audienceType, source, updatedAt) {
  legacyTypeFor(audienceType); // canonical type validation
  const rows = parseCsvRows(csv);
  if (rows.length < 2) throw new Error(`no Google Ads audience rows: ${source}`);
  const headers = rows[0].map((value, index) => index === 0 ? value.replace(/^\uFEFF/, '') : value);
  const idIndex = headers.indexOf('Category ID');
  const nameIndex = headers.indexOf('Category Name');
  const pathIndex = headers.findIndex(value => value.toLowerCase() === 'category path');
  if (idIndex < 0 || pathIndex < 0) throw new Error(`unexpected Google Ads CSV header: ${headers.join(',')}`);
  return rows.slice(1).map(row => {
    const audienceId = String(row[idIndex] || '').trim();
    const pathParts = splitCategoryPath(row[pathIndex]);
    const audienceName = String(nameIndex >= 0 ? row[nameIndex] : pathParts.leaf).trim();
    if (!/^\d{5,12}$/.test(audienceId) || !audienceName) return null;
    return {
      audience_id: audienceId,
      audience_name: audienceName,
      audience_type: audienceType,
      type: legacyTypeFor(audienceType),
      category: pathParts.category,
      parent: pathParts.parent,
      source,
      updated_at: updatedAt,
    };
  }).filter(Boolean);
}

function parseStudioAudienceHtml(html, updatedAt) {
  const entries = [];
  for (const table of extractTablesWithHeading(html)) {
    const type = classifyType(table.heading);
    if (type === 'unknown') continue;
    for (const row of extractRows(table.body)) {
      const audienceId = row[0];
      const audienceName = row[3] || '';
      if (!/^\d{6,12}$/.test(audienceId) || !audienceName) continue;
      entries.push({
        audience_id: audienceId,
        audience_name: audienceName,
        audience_type: canonicalTypeFor(type),
        type,
        category: row[1] || '',
        parent: row[2] || '',
        source: SOURCE_URL,
        updated_at: updatedAt,
      });
    }
  }
  return entries;
}

function toCsvCell(v) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

function mergeAudienceRecords(records) {
  const seen = new Set();
  const merged = [];
  for (const record of records) {
    const key = MASTER_HEADERS.map(header => String(record[header] ?? '')).join('\u001f');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(Object.fromEntries(MASTER_HEADERS.map(header => [header, String(record[header] ?? '')])));
  }
  merged.sort((a, b) =>
    Number(a.audience_id) - Number(b.audience_id) ||
    a.audience_type.localeCompare(b.audience_type) ||
    a.audience_name.localeCompare(b.audience_name) ||
    a.source.localeCompare(b.source)
  );
  return merged;
}

function serializeAudienceMasterCsv(entries) {
  return [MASTER_HEADERS.join(',')]
    .concat(entries.map(entry => MASTER_HEADERS.map(header => toCsvCell(entry[header] || '')).join(',')))
    .join('\n') + '\n';
}

async function buildAudienceMaster(outPath, options = {}) {
  const updatedAt = options.updatedAt || new Date().toISOString().slice(0, 10);
  const sourceEntries = await Promise.all([
    fetchUrl(SOURCE_URL).then(html => parseStudioAudienceHtml(html, updatedAt)),
    ...Object.entries(GOOGLE_ADS_SOURCES).map(([audienceType, source]) =>
      fetchUrl(source).then(csv => parseGoogleAdsAudienceCsv(csv, audienceType, source, updatedAt))
    ),
  ]);
  const entries = mergeAudienceRecords(sourceEntries.flat());

  if (entries.length === 0) throw new Error('no audience entries extracted');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, serializeAudienceMasterCsv(entries), 'utf8');

  const idCounts = new Map();
  const nameCounts = new Map();
  for (const entry of entries) {
    idCounts.set(entry.audience_id, (idCounts.get(entry.audience_id) || 0) + 1);
    nameCounts.set(entry.audience_name, (nameCounts.get(entry.audience_name) || 0) + 1);
  }

  return {
    sourceUrls: [SOURCE_URL, ...Object.values(GOOGLE_ADS_SOURCES)],
    updatedAt,
    recordCount: entries.length,
    countsByAudienceType: Object.fromEntries(Object.keys(CANONICAL_TO_LEGACY).map(type => [type, entries.filter(e => e.audience_type === type).length])),
    duplicateIds: [...idCounts].filter(([, count]) => count > 1).map(([id]) => id),
    duplicateNames: [...nameCounts].filter(([, count]) => count > 1).map(([name]) => name),
    targetId: entries.find(e => e.audience_id === '4511689') || null,
    youtube011TargetId: entries.find(e => e.audience_id === '80279') || null,
    outputPath: outPath,
  };
}

if (require.main === module) {
  const outPath = process.argv[2] || DEFAULT_OUT;
  buildAudienceMaster(outPath).then(r => {
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  }).catch(e => {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildAudienceMaster,
  canonicalTypeFor,
  GOOGLE_ADS_SOURCES,
  legacyTypeFor,
  MASTER_HEADERS,
  mergeAudienceRecords,
  parseGoogleAdsAudienceCsv,
  parseStudioAudienceHtml,
  serializeAudienceMasterCsv,
  SOURCE_URL,
  splitCategoryPath,
};
