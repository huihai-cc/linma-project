// OTT 2026-08-07 改修スペックテスト（Deal 人工確認 / Geography 英文 / Daypart ID 反解 / Time Zone / IO 予算動的%）
// 対象: dv360_check.html 内 OTT 専用ロジック（YouTube / Amazon DSP 非対象）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../xlsx.full.min.js');
const JSZip = require('../jszip.min.js');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'dv360_check.html');
const ottRoot = 'D:/業務用/開発用/テスト用アイル/設定用/DV360/OTT';

function createElement(v) {
  return {
    addEventListener(){}, appendChild(){},
    classList:{add(){},remove(){},contains(){return false}},
    closest(){return null}, dataset:{}, disabled:false, files:[], innerHTML:'',
    querySelector(){return null}, querySelectorAll(){return[]}, scrollIntoView(){},
    style:{display:'',setProperty(){}}, textContent:'', value:v||'',
  };
}

function loadDv360Api() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const source = scripts.map(m => m[1]).find(s => s.includes('function parseSdfData'));
  assert.ok(source);
  const exp = '\n' +
'window.__api = {\n' +
'  decodeDv360DaypartId, parseDv360DaypartTargeting, parseOttSettingDaypart,\n' +
'  mergeContinuousDv360Dayparts, buildOttDaypartCoverageKey, compareOttDaypart,\n' +
'  canonicalGeoName, compareGeography,\n' +
'  compareLI_OTT_Deal, compareLI_OTT_Targeting, compareLI_OTT_Geography, compareLI_OTT_Demographic,\n' +
'  resolveOttColumns, findOttBudgetNetColumn,\n' +
'  normNum, compareField,\n' +
'  parseOttSetting, parseSdfData, compareLI,\n' +
'  ensureGeoMasterLoaded,\n' +
'  setMediaType: function(v){mediaType=v;},\n' +
'  setSelectedDv360CaseType: typeof setSelectedDv360CaseType==="function"?setSelectedDv360CaseType:undefined,\n' +
'};\n';
  const inst = source.replace(/\}\)\(\);\s*$/, exp + '\n})();');
  const elems = new Map([['dv-case-select', createElement('initial')]]);
  const doc = {
    body:createElement(), documentElement:createElement(),
    getElementById(id){if(!elems.has(id))elems.set(id,createElement());return elems.get(id);},
    querySelector(){return null}, querySelectorAll(){return[]},
  };
  const sb = {
    Blob, DecompressionStream:globalThis.DecompressionStream, Encoding:{},
    FileReader:function(){}, JSZip:{}, Map,Promise,Response,Set,TextDecoder,Uint8Array,URL,XLSX:{},
    alert(){}, atob:globalThis.atob, console:{log(){},warn(){},error(){}},
    document:doc, sessionStorage:{getItem(){return null},setItem(){}},
  };
  sb.window = sb;
  vm.runInNewContext(inst, sb, {filename:htmlPath});
  return sb.__api;
}

function parseWorkbook(fp) {
  const wb = XLSX.read(fs.readFileSync(fp), {type:'buffer', cellDates:true});
  const sheets = {};
  for(const sn of wb.SheetNames) sheets[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:'', raw:false});
  return {sheets, sheetNames:wb.SheetNames};
}

async function parseSdfZip(fp) {
  const buf = fs.readFileSync(fp);
  const zip = await JSZip.loadAsync(buf);
  const csvFiles = [];
  for(const [fn, entry] of Object.entries(zip.files)) {
    if(entry.dir) continue;
    const blob = await entry.async('blob');
    const buffer = Buffer.from(await blob.arrayBuffer());
    let text;
    try { text = new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
    catch(e){ try{text=new TextDecoder('shift_jis',{fatal:true}).decode(buffer);}catch(e2){text=new TextDecoder('utf-8').decode(buffer);} }
    const lines = text.split(/\r?\n/);
    const rows = [];
    for(const line of lines) {
      if(!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^\uFEFF/,'').replace(/^"|"$/g,'').trim());
      if(cols.some(c=>c)) rows.push(cols);
    }
    if(rows.length) csvFiles.push({name:fn, rows});
  }
  return csvFiles;
}

const api = loadDv360Api();
function findItem(items, label) { return items.find(i => i.label === label); }

// ─────────────────────────────────────────────
// 1. Deal ID — 人工確認ルール
// ─────────────────────────────────────────────
const DEAL_UUID = 'e4e5dc18-3d0f-41a2-ab0c-9fdef79ac6f4';
function dealSetting(dealId) {
  return { fields: {
    dealId: dealId||'',
    resolvedDealInfo: dealId ? {source:'direct', dealId, dealName:'JP_HANNAN RIBIYO', isTemplateDeal:false} : {source:'none', dealId:''},
  }};
}
function dealDownload(privateDealRaw) {
  return { fields:{}, rawFields:{'Private Deal Group Targeting Include': privateDealRaw||''} };
}

test('D-1: 設定表 UUID + SDF 空 → warning', () => {
  const item = api.compareLI_OTT_Deal(dealSetting(DEAL_UUID), dealDownload(''))[0];
  assert.equal(item.result, 'warning');
});

test('D-2: 設定表 UUID + SDF 数字ID → warning（自動比較しない）', () => {
  const item = api.compareLI_OTT_Deal(dealSetting(DEAL_UUID), dealDownload('29126340'))[0];
  assert.equal(item.result, 'warning');
});

test('D-3: Deal は絶対に mismatch にならない', () => {
  const a = api.compareLI_OTT_Deal(dealSetting(DEAL_UUID), dealDownload(''))[0];
  const b = api.compareLI_OTT_Deal(dealSetting(DEAL_UUID), dealDownload('29126340'))[0];
  assert.equal(a.result, 'warning');
  assert.equal(b.result, 'warning');
  assert.notEqual(a.result, 'mismatch');
  assert.notEqual(b.result, 'mismatch');
});

test('D-4: 提示に「DV360管理画面」を含む', () => {
  const item = api.compareLI_OTT_Deal(dealSetting(DEAL_UUID), dealDownload('29126340'))[0];
  assert.ok(item.mpDetail.includes('DV360管理画面'), item.mpDetail);
  // 旧メッセージ（誤解を招く「SDFにPrivate Deal Group設定がありません」）は使わない
  assert.ok(!item.mpDetail.includes('SDFにPrivate Deal Group設定がありません'), item.mpDetail);
});

test('D-5: 双方 Deal なし → ok（(Deal設定なし) 表示）', () => {
  const item = api.compareLI_OTT_Deal(dealSetting(''), dealDownload(''))[0];
  assert.equal(item.result, 'ok');
  assert.equal(item.sVal, '(Deal設定なし)');
  assert.equal(item.dVal, '(Deal設定なし)');
});

// ─────────────────────────────────────────────
// 2. Geography — 設定表英文記載
// ─────────────────────────────────────────────
test('G-6: Saitama, Japan（都道府県）↔ 20634 → ok', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('Saitama, Japan（都道府県）', '20634', '');
  assert.equal(r.result, 'ok', r.detail);
});

test('G-7: Gunma, Japan（都道府県）↔ 20633 → ok', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('Gunma, Japan（都道府県）', '20633', '');
  assert.equal(r.result, 'ok', r.detail);
});

test('G-8: Ibaraki, Japan（都道府県）↔ 20631 → ok', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('Ibaraki, Japan（都道府県）', '20631', '');
  assert.equal(r.result, 'ok', r.detail);
});

test('G-9: 埼玉県 ↔ 20634 → ok（日文既存規則）', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('埼玉県', '20634', '');
  assert.equal(r.result, 'ok', r.detail);
});

test('G-10: 異なる都道府県 → mismatch', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('Saitama, Japan（都道府県）', '20633', '');
  assert.equal(r.result, 'mismatch', r.detail);
});

test('G-10b: 設定表「埼玉県 / Saitama, Japan」も同一 entity', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('埼玉県 / Saitama, Japan', '20634', '');
  assert.equal(r.result, 'ok', r.detail);
});

test('G-10c: SDF 側「埼玉県 / Saitama, Japan (Code: 20634)」形式 → ok', async () => {
  await api.ensureGeoMasterLoaded();
  const r = api.compareGeography('Saitama, Japan（都道府県）', '埼玉県 / Saitama, Japan (Code: 20634)', '');
  assert.equal(r.result, 'ok', r.detail);
});

// ─────────────────────────────────────────────
// 3. Daypart ID デコーダー
// ─────────────────────────────────────────────
test('DP-11: 304096 → 月 10:00–24:00', () => {
  const d = api.decodeDv360DaypartId('304096');
  assert.ok(d);
  assert.equal(d.dayIndex, 0);
  assert.equal(d.day, '月');
  assert.equal(d.startMinutes, 600);
  assert.equal(d.endMinutes, 1440);
  assert.equal(d.start, '10:00');
  assert.equal(d.end, '24:00');
});

test('DP-12: 310096 → 火 00:00–24:00', () => {
  const d = api.decodeDv360DaypartId('310096');
  assert.ok(d);
  assert.equal(d.dayIndex, 1);
  assert.equal(d.day, '火');
  assert.equal(d.startMinutes, 0);
  assert.equal(d.endMinutes, 1440);
});

test('DP-13: 360096 → 日 00:00–24:00', () => {
  const d = api.decodeDv360DaypartId('360096');
  assert.ok(d);
  assert.equal(d.dayIndex, 6);
  assert.equal(d.day, '日');
});

test('DP-14: 7 個 ID 全て正しく解析（304096〜360096）', () => {
  const ids = ['304096','310096','320096','330096','340096','350096','360096'];
  const days = ['月','火','水','木','金','土','日'];
  const parsed = api.parseDv360DaypartTargeting(ids.join('; '));
  assert.equal(parsed.known, true);
  assert.equal(parsed.segments.length, 7);
  parsed.segments.forEach((seg, i) => {
    assert.equal(seg.dayIndex, i);
    assert.equal(seg.day, days[i]);
    if(i === 0){ assert.equal(seg.start, '10:00'); assert.equal(seg.end, '24:00'); }
    else { assert.equal(seg.start, '00:00'); assert.equal(seg.end, '24:00'); }
  });
  // 表示用: 月10:00〜24:00 / 火〜日 00:00〜24:00 に統合される
  const merged = api.mergeContinuousDv360Dayparts(parsed.segments);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].startDayIndex, 0);
  assert.equal(merged[0].endDayIndex, 0);
  assert.equal(merged[1].startDayIndex, 1);
  assert.equal(merged[1].endDayIndex, 6);
});

test('DP-15: 不正 ID → warning、crash しない', () => {
  const r = api.compareOttDaypart('月：10:00～0:00', '999999;');
  assert.equal(r.result, 'warning');
  assert.equal(r.dVal, '999999;'); // 生ID表示（設定なしと誤認させない）
  const r2 = api.compareOttDaypart('月：10:00～0:00', '304096;999999;');
  assert.equal(r2.result, 'warning');
  assert.equal(r2.dVal, '304096;999999;');
});

// ─────────────────────────────────────────────
// 4. Daypart 比較
// ─────────────────────────────────────────────
const SEVEN_IDS = '304096; 310096; 320096; 330096; 340096; 350096; 360096;';

test('DP-16: 月：10:00～0:00 ↔ 7 ID → ok（連続指定同一）', () => {
  const r = api.compareOttDaypart('月：10:00～0:00', SEVEN_IDS);
  assert.equal(r.result, 'ok', r.result + ' s=' + r.sVal + ' d=' + r.dVal);
  // 前端表示: D がデコード済み名表示であること（素のID列ではない）
  assert.ok(r.dVal.includes('月 10:00～24:00'), r.dVal);
  assert.ok(r.dVal.includes('火～日 00:00～24:00'), r.dVal);
  assert.ok(!r.dVal.includes('304096'), 'D display should not show raw IDs');
});

test('DP-17: 同値・区切り違い（; と空白）→ ok', () => {
  const a = api.compareOttDaypart('月：10:00～0:00', SEVEN_IDS);
  const b = api.compareOttDaypart('月：10:00～0:00', '304096;310096;320096;330096;340096;350096;360096;');
  assert.equal(a.result, 'ok');
  assert.equal(b.result, 'ok');
});

test('DP-18: 日曜日が欠けている → mismatch', () => {
  const r = api.compareOttDaypart('月：10:00～0:00', '304096; 310096; 320096; 330096; 340096; 350096;');
  assert.equal(r.result, 'mismatch');
});

test('DP-19: 月曜日終了が 24:00 でない → mismatch', () => {
  // 304080 = 月 10:00–20:00
  const r = api.compareOttDaypart('月：10:00～0:00', '304080; 310096; 320096; 330096; 340096; 350096; 360096;');
  assert.equal(r.result, 'mismatch');
});

test('DP-19b: 設定表記法バリエーション全て解析可能', () => {
  for(const s of ['月：10:00～0:00','月:10:00~0:00','月：10:00〜0:00','月：10:00～00:00','月曜日 10:00-24:00']){
    const p = api.parseOttSettingDaypart(s);
    assert.equal(p.known, true, s);
    assert.equal(p.segments.length, 1, s);
    assert.equal(p.segments[0].dayIndex, 0, s);
    assert.equal(p.segments[0].startMinutes, 600, s);
    assert.equal(p.segments[0].endMinutes, 1440, s);
  }
});

// ─────────────────────────────────────────────
// 5. Daypart Time Zone
// ─────────────────────────────────────────────
function tzSetting(daypart) {
  return { fields:{ daypart: daypart||'', language:'', environment:'', devicePC:'', deviceSP:'', deviceCTV:'' }};
}
function tzDownload(daypart, tz) {
  return { fields:{ daypartTargeting: daypart||'', daypartTimeZone: tz||'' }, rawFields:{ 'Daypart Targeting Time Zone': tz||'' }};
}
function tzItem(sDaypart, dDaypart, dTz) {
  const items = api.compareLI_OTT_Targeting(tzSetting(sDaypart), tzDownload(dDaypart, dTz));
  return findItem(items, 'Daypart Time Zone');
}

test('TZ-20: Daypart なし + Time Zone 空 → 非表示（ok/非表示）', () => {
  const item = tzItem('', '', '');
  assert.equal(item, undefined, 'should be hidden');
});

test('TZ-21: Daypart あり + Advertiser → ok（S:想定 Advertiser / D: Advertiser）', () => {
  const item = tzItem('月：10:00～0:00', SEVEN_IDS, 'Advertiser');
  assert.ok(item, 'should have TZ item');
  assert.equal(item.result, 'ok');
  assert.equal(item.sVal, '想定: Advertiser');
  assert.equal(item.dVal, 'Advertiser');
});

test('TZ-22: Daypart あり + Local → warning（Advertiser 想定メッセージ）', () => {
  const item = tzItem('月：10:00～0:00', SEVEN_IDS, 'Local');
  assert.ok(item);
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail.includes('Advertiser を想定'), item.mpDetail);
});

test('TZ-23: Daypart あり + Time Zone 空 → warning（取得できません）', () => {
  const item = tzItem('月：10:00～0:00', SEVEN_IDS, '');
  assert.ok(item);
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail.includes('Time Zone が取得できません'), item.mpDetail);
});

test('TZ-24: Daypart なし + Time Zone Advertiser のみ → warning（無意味な単独指定）', () => {
  const item = tzItem('', '', 'Advertiser');
  assert.ok(item);
  assert.equal(item.result, 'warning');
  assert.ok(item.mpDetail.includes('のみ設定'), item.mpDetail);
});

// ─────────────────────────────────────────────
// 6. IO 予算 — 動的 % 表頭
// ─────────────────────────────────────────────
test('B-25: 設定予算(98%) 正常解析', () => {
  const r31 = ['NO','Jno','IO名 (記入用)','IO名 (管理画面登録用)','全体予算','設定予算(98%)','開始日'];
  const col = api.resolveOttColumns(r31, []);
  assert.equal(col.IO_BUDGET_NET, 5);
  assert.equal(col.IO_BUDGET_GROSS, 4);
});

test('B-26: 設定予算(99%) 正常解析（実案件 2026-08-07）', () => {
  const r31 = ['NO','Jno','IO名 (記入用)','IO名 (管理画面登録用)','全体予算','設定予算(99%)','開始日'];
  const col = api.resolveOttColumns(r31, []);
  assert.equal(col.IO_BUDGET_NET, 5);
});

test('B-27: 全角括弧 設定予算（98%） 正常解析', () => {
  const r31 = ['NO','全体予算','設定予算（98%）','開始日'];
  const col = api.resolveOttColumns(r31, []);
  assert.equal(col.IO_BUDGET_NET, 2);
});

test('B-28: 単独「設定予算」（ユニーク列）正常解析', () => {
  const r31 = ['NO','設定予算','全体予算','開始日'];
  const col = api.resolveOttColumns(r31, []);
  assert.equal(col.IO_BUDGET_NET, 1);
});

test('B-29: 全体予算 を budgetNet として誤認識しない', () => {
  const r31 = ['NO','全体予算','開始日'];
  const col = api.resolveOttColumns(r31, []);
  assert.equal(col.IO_BUDGET_NET, -1);
  assert.equal(col.IO_BUDGET_GROSS, 1);
});

test('B-30: ¥1,084,251 / 1,084,251 / 1084251 全て同一正規化', () => {
  const n1 = api.normNum('¥1,084,251');
  const n2 = api.normNum('1,084,251');
  const n3 = api.normNum('1084251');
  assert.equal(n1, '1084251');
  assert.equal(n2, '1084251');
  assert.equal(n3, '1084251');
  assert.equal(api.compareField(n1, n3), 'ok');
});

// ─────────────────────────────────────────────
// 7. 実案件パイプライン（Case 003: daypart / Case 005: 予算+地域+Deal）
// ─────────────────────────────────────────────
async function getSettingAndDownload(caseId) {
  const dir = path.join(ottRoot, caseId);
  const xf = fs.readdirSync(dir).find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const zf = fs.readdirSync(dir).find(f => f.endsWith('.zip'));
  api.setMediaType('ott');
  if(api.setSelectedDv360CaseType) api.setSelectedDv360CaseType('initial');
  const {sheets, sheetNames} = parseWorkbook(path.join(dir, xf));
  const setting = api.parseOttSetting(sheets, sheetNames, xf);
  const csvFiles = await parseSdfZip(path.join(dir, zf));
  const download = api.parseSdfData(csvFiles);
  return {setting, download};
}

test('R-31: Case 003 実案件 — 曜日と時間（火：10:00～0:00 ↔ 月10:00～24:00/火～日 00:00～24:00）mismatch', async () => {
  // 2026-08-07 設定表更新（月→火）に伴い期待値を mismatch へ変更（比較結果として正しい）
  const {setting, download} = await getSettingAndDownload('003');
  const sLi = setting.liList.find(li => String(li.fields.daypart||'').includes('10:00'));
  const dLi = download.liList.find(li => String(li.fields.daypartTargeting||'').includes('304096'));
  assert.ok(sLi, 'setting daypart row');
  assert.ok(dLi, 'sdf daypart row');
  const items = api.compareLI_OTT_Targeting(sLi, dLi);
  const daypartItem = findItem(items, '曜日と時間');
  assert.ok(daypartItem, 'daypart item');
  assert.equal(daypartItem.result, 'mismatch', daypartItem.result + ' s=' + daypartItem.sVal + ' d=' + daypartItem.dVal);
  const tzItem = findItem(items, 'Daypart Time Zone');
  assert.ok(tzItem, 'tz item');
  assert.equal(tzItem.result, 'ok', tzItem.result);
});

test('R-32: Case 005 実案件 — 設定予算(99%) 列解決で budgetNet 取得', async () => {
  const {setting} = await getSettingAndDownload('005');
  const io = setting.ioList.find(io => io.name.includes('埼玉'));
  assert.ok(io, '埼玉 IO');
  assert.ok(String(io.fields.budgetNet||'').includes('1,084,251'), 'budgetNet=' + io.fields.budgetNet);
});

test('R-33: Case 005 実案件 — Saitama, Japan（都道府県）↔ SDF 20634 → ok + Deal は要確認', async () => {
  await api.ensureGeoMasterLoaded();
  const {setting, download} = await getSettingAndDownload('005');
  const sLi = setting.liList.find(li => String(li.fields.geo||'').includes('Saitama'));
  const dLi = download.liList.find(li => String(li.fields.geographyTargetingInclude||'').includes('20634'));
  assert.ok(sLi, 'setting Saitama LI');
  assert.ok(dLi, 'sdf 20634 LI');
  const geoItems = api.compareLI_OTT_Geography(sLi, dLi);
  const geoItem = findItem(geoItems, '地域 / Geography Targeting');
  assert.ok(geoItem, 'geo item');
  assert.equal(geoItem.result, 'ok', geoItem.result + ' ' + geoItem.detail);
  const dealItems = api.compareLI_OTT_Deal(sLi, dLi);
  const dealItem = findItem(dealItems, 'Deal ID');
  assert.ok(dealItem, 'deal item');
  assert.equal(dealItem.result, 'warning');
  assert.ok(dealItem.mpDetail.includes('DV360管理画面'), dealItem.mpDetail);
});
