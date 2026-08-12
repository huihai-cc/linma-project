'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fetcher = require('./fetch_google_audience_master.js');
const builder = require('./build_dv360_audience_master.js');

const projectRoot = path.join(__dirname, '..');
const masterPath = path.join(projectRoot, 'data', 'dv360_google_audience_master.csv');
const EXPECTED_HEADERS = [
  'audience_id', 'audience_name', 'audience_type', 'type',
  'category', 'parent', 'source', 'updated_at',
];

const IN_MARKET_FIXTURE = [
  'Category ID,Parent category ID,Category path',
  '80279,80186,/Software/Business & Productivity Software',
  '80535,80530,/Business Services/Business Technology/Enterprise Software/CRM Solutions',
].join('\n');

const EXTENDED_FIXTURE = [
  'Category ID,Category Name,Category Path',
  '30027,Construction Industry,/Employment/Industry/Construction Industry',
].join('\n');

test('YM-1: Google Ads CSV の5桁 Category ID を文字列として保持する', () => {
  const rows = fetcher.parseGoogleAdsAudienceCsv(IN_MARKET_FIXTURE, 'IN_MARKET', 'source.csv', '2026-08-09');
  assert.equal(rows[0].audience_id, '80279');
  assert.equal(typeof rows[0].audience_id, 'string');
});

test('YM-2: Category path の末尾を audience_name にする', () => {
  const rows = fetcher.parseGoogleAdsAudienceCsv(IN_MARKET_FIXTURE, 'IN_MARKET', 'source.csv', '2026-08-09');
  assert.equal(rows[1].audience_name, 'CRM Solutions');
});

test('YM-3: Category path の先頭を category にする', () => {
  const rows = fetcher.parseGoogleAdsAudienceCsv(IN_MARKET_FIXTURE, 'IN_MARKET', 'source.csv', '2026-08-09');
  assert.equal(rows[1].category, 'Business Services');
});

test('YM-4: Category path の直前階層を parent にする', () => {
  const rows = fetcher.parseGoogleAdsAudienceCsv(IN_MARKET_FIXTURE, 'IN_MARKET', 'source.csv', '2026-08-09');
  assert.equal(rows[1].parent, 'Enterprise Software');
});

test('YM-5: Extended demographics の Category Name を使用する', () => {
  const rows = fetcher.parseGoogleAdsAudienceCsv(EXTENDED_FIXTURE, 'EXTENDED_DEMOGRAPHIC', 'source.csv', '2026-08-09');
  assert.equal(rows[0].audience_name, 'Construction Industry');
  assert.equal(rows[0].parent, 'Industry');
});

test('YM-6: 四つの canonical audience type を legacy type に安定変換する', () => {
  assert.equal(fetcher.legacyTypeFor('AFFINITY'), 'affinity');
  assert.equal(fetcher.legacyTypeFor('IN_MARKET'), 'in_market');
  assert.equal(fetcher.legacyTypeFor('LIFE_EVENT'), 'life_event');
  assert.equal(fetcher.legacyTypeFor('EXTENDED_DEMOGRAPHIC'), 'extended_demographic');
});

test('YM-7: official record に source と updated_at を保持する', () => {
  const rows = fetcher.parseGoogleAdsAudienceCsv(IN_MARKET_FIXTURE, 'IN_MARKET', 'official-url', '2026-08-09');
  assert.equal(rows[0].source, 'official-url');
  assert.equal(rows[0].updated_at, '2026-08-09');
  assert.equal(rows[0].audience_type, 'IN_MARKET');
});

test('YM-8: CSV serializer は拡張 master header を固定する', () => {
  const csv = fetcher.serializeAudienceMasterCsv([{
    audience_id: '80279', audience_name: 'Business & Productivity Software',
    audience_type: 'IN_MARKET', type: 'in_market', category: 'Software', parent: '',
    source: 'official-url', updated_at: '2026-08-09',
  }]);
  assert.equal(csv.split(/\r?\n/)[0], EXPECTED_HEADERS.join(','));
});

test('YM-9: build validator は拡張 header と5桁 ID を受理する', () => {
  const csv = [
    EXPECTED_HEADERS.join(','),
    '80279,Business & Productivity Software,IN_MARKET,in_market,Software,,official-url,2026-08-09',
  ].join('\n');
  const result = builder.validateAudienceRows(builder.parseCsv(csv));
  assert.equal(result.entries[0][0], '80279');
});

test('YM-10: build validator は四つの canonical type を受理する', () => {
  const types = ['AFFINITY', 'IN_MARKET', 'LIFE_EVENT', 'EXTENDED_DEMOGRAPHIC'];
  const lines = types.map((t, i) => `${95000 + i},Name ${i},${t},${fetcher.legacyTypeFor(t)},Category,,source,2026-08-09`);
  const result = builder.validateAudienceRows(builder.parseCsv([EXPECTED_HEADERS.join(','), ...lines].join('\n')));
  assert.deepEqual(result.entries.map(e => e[5]), types);
});

test('YM-11: compact embedded record に canonical type/source/updated_at を保持する', () => {
  const csv = [
    EXPECTED_HEADERS.join(','),
    '95021,Business Creation,LIFE_EVENT,life_event,Life events,,official-url,2026-08-09',
  ].join('\n');
  const result = builder.validateAudienceRows(builder.parseCsv(csv));
  assert.deepEqual(result.entries[0].slice(5), ['LIFE_EVENT', 'official-url', '2026-08-09']);
});

test('YM-12: 不正 canonical type は拒否する', () => {
  const csv = [
    EXPECTED_HEADERS.join(','),
    '80279,Name,UNKNOWN,in_market,Category,,source,2026-08-09',
  ].join('\n');
  assert.throws(() => builder.validateAudienceRows(builder.parseCsv(csv)), /invalid audience type/);
});

test('YM-13: merge は旧 Studio ID と Google Ads ID を同時に保持する', () => {
  const merged = fetcher.mergeAudienceRecords([
    { audience_id: '4511689', audience_name: '料理愛好家', audience_type: 'AFFINITY', type: 'affinity', category: '', parent: '', source: 'studio', updated_at: '2026-08-09' },
    { audience_id: '80279', audience_name: 'Business & Productivity Software', audience_type: 'IN_MARKET', type: 'in_market', category: '', parent: '', source: 'google-ads', updated_at: '2026-08-09' },
  ]);
  assert.deepEqual(merged.map(r => r.audience_id).sort(), ['4511689', '80279'].sort());
});

test('YM-14: merge は完全同一 record のみ重複排除する', () => {
  const record = { audience_id: '80279', audience_name: 'Business & Productivity Software', audience_type: 'IN_MARKET', type: 'in_market', category: '', parent: '', source: 'google-ads', updated_at: '2026-08-09' };
  assert.equal(fetcher.mergeAudienceRecords([record, { ...record }]).length, 1);
});

test('YM-15: 現行 master に 011 の19 ID が全て存在し、全て IN_MARKET である', () => {
  const ids = ['80279','80444','80517','80518','80519','80521','80522','80523','80524','80525','80526','80528','80529','80530','80533','80534','80535','80536','80537'];
  const rows = builder.parseCsv(fs.readFileSync(masterPath, 'utf8'));
  const headers = rows[0];
  const records = rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
  const byId = new Map(records.map(r => [r.audience_id, r]));
  for (const id of ids) {
    assert.ok(byId.has(id), `master missing ${id}`);
    assert.equal(byId.get(id).audience_type, 'IN_MARKET', `type ${id}`);
  }
});

test('YM-16: 現行 master は LIFE_EVENT と EXTENDED_DEMOGRAPHIC を含む', () => {
  const rows = builder.parseCsv(fs.readFileSync(masterPath, 'utf8'));
  const audienceTypeIndex = rows[0].indexOf('audience_type');
  const types = new Set(rows.slice(1).map(row => row[audienceTypeIndex]));
  assert.ok(types.has('LIFE_EVENT'));
  assert.ok(types.has('EXTENDED_DEMOGRAPHIC'));
});

test('YM-17: 011 代表IDを Google 公式名称へ解決できる', () => {
  const rows = builder.parseCsv(fs.readFileSync(masterPath, 'utf8'));
  const headers = rows[0];
  const records = rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
  const byId = new Map(records.map(record => [record.audience_id, record]));
  assert.equal(byId.get('80279').audience_name, 'Business & Productivity Software');
  assert.equal(byId.get('80444').audience_name, 'Suits & Business Attire');
  assert.equal(byId.get('80517').audience_name, 'Advertising & Marketing Services');
  assert.match(byId.get('80517').source, /in-market-categories\.csv$/);
});
