const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'region_check.html');
const fixturePath = path.join(projectRoot, 'tests/fixtures/amazon_region_master.json');

function createElement(initialValue) {
  if (initialValue === undefined) initialValue = '';
  const el = {
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    closest() { return null; }, dataset: {}, disabled: false, files: [], innerHTML: '',
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {},
    style: { display: '', setProperty() {} }, textContent: '', value: initialValue,
    dispatchEvent() {},
  };
  el[Symbol.iterator] = function* () { yield el; };
  return el;
}

function createSelect(options) {
  const el = createElement();
  el.options = options || [];
  el.selectedIndex = 0;
  Object.defineProperty(el, 'value', {
    get() { return this.options[this.selectedIndex]?.value || ''; },
    set(v) { this.selectedIndex = this.options.findIndex(o => o.value === v); }
  });
  return el;
}

function loadScript() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const mainScript = scripts.map(match => match[1]).find(script => script.includes('CONFIRMED_REGION_MASTER'));
  assert.ok(mainScript, 'region_check.html should have main script');
  return mainScript;
}

function runInSandbox(scriptSource) {
  const elements = new Map();
  const document = {
    body: createElement(), documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) {
        if (id === 'mediaSelect') {
          elements.set(id, createSelect([
            { value: 'dv360', text: 'DV360設定依頼' },
            { value: 'toyokeizai', text: '東洋経済新報社' },
            { value: 'amazon', text: 'Amazon DSP' },
          ]));
        } else {
          elements.set(id, createElement());
        }
      }
      return elements.get(id);
    },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  const sandbox = {
    ...globalThis,
    document,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    Event: class FakeEvent {
      constructor(type, opts = {}) {
        this.type = type;
        this.bubbles = opts.bubbles || false;
        this.cancelable = opts.cancelable || false;
        this.defaultPrevented = false;
        this.target = null;
      }
      preventDefault() { this.defaultPrevented = true; }
      stopPropagation() {}
    },
    window: null,
  };
  sandbox.window = sandbox;
  try {
    vm.runInNewContext(scriptSource, sandbox, { filename: htmlPath });
  } catch (e) {
    console.error('Sandbox error:', e.message);
    console.error('Stack:', e.stack);
    throw e;
  }
  return sandbox;
}

const scriptSource = loadScript();

test('Amazon UI integration tests', async () => {
  const sandbox = runInSandbox(scriptSource);

  // Helper to get media config
  const getMediaConfig = () => {
    const sel = sandbox.document.getElementById('mediaSelect');
    return { media: sel.value, label: sel.options[sel.selectedIndex].text };
  };

  // 1. mediaSelect exists amazon option
  const mediaSelect = sandbox.document.getElementById('mediaSelect');
  assert.ok(mediaSelect, 'mediaSelect should exist');
  const amazonOption = Array.from(mediaSelect.options).find(o => o.value === 'amazon');
  assert.ok(amazonOption, 'Amazon option should exist in mediaSelect');
  assert.equal(amazonOption.text, 'Amazon DSP');

  // 2. Default media is DV360
  assert.equal(getMediaConfig().media, 'dv360', 'Default media should be dv360');

  // 3. HTML built-in Amazon cities exactly 255
  assert.ok(sandbox.AMAZON_CONFIRMED_REGION_MASTER, 'AMAZON_CONFIRMED_REGION_MASTER should exist');
  const amazonCities = sandbox.AMAZON_CONFIRMED_REGION_MASTER.filter(m => m.municipalityJp);
  assert.equal(amazonCities.length, 255, 'Amazon cities should be 255');

  // 4. HTML built-in 255 matches fixture exactly
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const fixtureByKey = new Map(fixture.map(f => [f.municipalityJp, f]));
  const htmlByKey = new Map(amazonCities.map(m => [m.municipalityJp, m]));
  assert.equal(fixtureByKey.size, 255, 'Fixture should have 255 entries');
  assert.equal(htmlByKey.size, 255, 'HTML should have 255 city entries');
  for (const [jp, fixtureEntry] of fixtureByKey) {
    const htmlEntry = htmlByKey.get(jp);
    assert.ok(htmlEntry, `HTML should contain ${jp}`);
    assert.equal(htmlEntry.displayName, fixtureEntry.displayName, `displayName mismatch for ${jp}`);
    assert.equal(htmlEntry.prefectureJp, fixtureEntry.prefectureJp, `prefectureJp mismatch for ${jp}`);
    assert.equal(htmlEntry.level, fixtureEntry.level, `level mismatch for ${jp}`);
  }

  // 5. Amazon prefectures exactly 47 and unique
  const amazonPrefs = sandbox.AMAZON_PREFECTURE_MASTER;
  assert.ok(amazonPrefs, 'AMAZON_PREFECTURE_MASTER should exist');
  assert.equal(amazonPrefs.length, 47, 'Amazon prefectures should be 47');
  const prefSet = new Set(amazonPrefs.map(m => m.prefectureJp));
  assert.equal(prefSet.size, 47, 'Amazon prefectures should be unique');

  // 6. Amazon total master = 302
  const master = sandbox.getMaster('amazon');
  assert.equal(master.confirmed.length, 302, 'Amazon total master should be 302');
  assert.equal(master.candidate.length, 0, 'Amazon candidate should be 0');

  // 7. Amazon candidate = 0
  assert.equal(master.candidate.length, 0, 'Amazon candidate should be 0');

  // 8. Amazon does not access DV360 candidate
  const dv360Candidate = sandbox.CANDIDATE_REGION_MASTER.filter(m => m.media === 'dv360');
  assert.ok(dv360Candidate.length > 0, 'DV360 should have candidates');
  const amazonConfirmed = sandbox.AMAZON_CONFIRMED_REGION_MASTER;
  for (const c of amazonConfirmed) {
    assert.ok(!c.media || c.media === 'amazon', 'Amazon confirmed should not have dv360 media');
  }

  // 9. 静岡県伊東市 → Ito, Shizuoka, JP / OK_市区町村
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const findMatches = sandbox.findMatches;
  const result1 = findMatches({ raw: '静岡県伊東市', prefecture: '静岡県', municipality: '伊東市', parsed: '静岡県 / 伊東市' });
  assert.equal(result1.status, 'OK_市区町村');
  assert.equal(result1.displayName, 'Ito, Shizuoka, JP');

  // 10. 伊東市 → Ito, Shizuoka, JP / OK_市区町村（Amazonでは単一市区町村も直接confirmed命中）
  const result2 = findMatches({ raw: '伊東市', prefecture: '', municipality: '伊東市', parsed: '（都道府県なし）伊東市' });
  assert.equal(result2.status, 'OK_市区町村');
  assert.equal(result2.displayName, 'Ito, Shizuoka, JP');
  assert.equal(result2.note, '');

  // 11. 東京都 → Tokyo, JP / OK_都道府県
  const result3 = findMatches({ raw: '東京都', prefecture: '東京都', municipality: '', parsed: '東京都' });
  assert.equal(result3.status, 'OK_都道府県');
  assert.equal(result3.displayName, 'Tokyo, JP');

  // 12. 東京都存在しない市 → Tokyo, JP / WARN_市区町村未登録
  const result4 = findMatches({ raw: '東京都存在しない市', prefecture: '東京都', municipality: '存在しない市', parsed: '東京都 / 存在しない市' });
  assert.equal(result4.status, 'WARN_市区町村未登録');
  assert.equal(result4.displayName, 'Tokyo, JP');

  // 13. 存在しない市 → NG_未識別
  const result5 = findMatches({ raw: '存在しない市', prefecture: '', municipality: '存在しない市', parsed: '（都道府県なし）存在しない市' });
  assert.equal(result5.status, 'NG_未識別');

  // 14. Amazon results don't contain ', Japan'
  for (const m of sandbox.AMAZON_CONFIRMED_REGION_MASTER) {
    assert.ok(!m.displayName.includes(', Japan'), `Amazon displayName should not contain ', Japan': ${m.displayName}`);
  }
  for (const m of sandbox.AMAZON_PREFECTURE_MASTER) {
    assert.ok(!m.displayName.includes(', Japan'), `Amazon pref displayName should not contain ', Japan': ${m.displayName}`);
  }

  // 15. DV360 東京都 still outputs Tokyo, Japan
  mediaSelect.value = 'dv360';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const dv360Master = sandbox.getMaster('dv360');
  const tokyoPref = dv360Master.confirmed.find(m => m.prefectureJp === '東京都' && !m.municipalityJp);
  assert.ok(tokyoPref, 'DV360 should have 東京都');
  assert.equal(tokyoPref.displayName, 'Tokyo, Japan');

  // 16. DV360 representative city unchanged
  const misato = dv360Master.confirmed.find(m => m.municipalityJp === '三郷市');
  assert.ok(misato, 'DV360 should have 三郷市');
  assert.equal(misato.displayName, 'Misato, Saitama, Japan');

  // 17. Toyokeizai unchanged
  mediaSelect.value = 'toyokeizai';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  assert.ok(typeof sandbox.runToyokeizaiConversion === 'function', 'Toyokeizai conversion should exist');
  assert.ok(sandbox.TOYOKEIZAI_PREF_MAP, 'Toyokeizai pref map should exist');

  // 18. Media switching refreshes master
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const amazonMasterAfterSwitch = sandbox.getMaster('amazon');
  assert.equal(amazonMasterAfterSwitch.confirmed.length, 302, 'Amazon master should be 302 after switch');
  assert.equal(amazonMasterAfterSwitch.candidate.length, 0, 'Amazon candidate should be 0 after switch');

  mediaSelect.value = 'dv360';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const dv360MasterAfterSwitch = sandbox.getMaster('dv360');
  assert.ok(dv360MasterAfterSwitch.candidate.length > 0, 'DV360 should have candidates after switch');

  // 19. Amazon log name
  assert.ok(scriptSource.includes('地域表記変換チェック-AmazonDSP'), 'Amazon log name should be in source');

  // 20. Amazon copy logic copies only conversion results
  assert.ok(typeof sandbox.copyConversionResults === 'function', 'copyConversionResults should exist');

  // 21. All 255 A1 fixture entries pass through Amazon conversion logic
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const findAmazonMatches = sandbox.findAmazonMatches;
  const amazonMasterEntries = sandbox.AMAZON_CONFIRMED_REGION_MASTER;
  let passCount = 0;
  for (const entry of fixture) {
    const result = findAmazonMatches(
      { prefecture: entry.prefectureJp, municipality: entry.municipalityJp },
      amazonMasterEntries
    );
    if (result.status === 'OK_市区町村' || result.status === 'OK_都道府県') {
      passCount++;
    }
  }
  assert.equal(passCount, 255, 'All 255 fixture entries should pass Amazon conversion');

  // A2-1: Amazon単一市区町村はOK_市区町村（WARN_都道府県推定ではない）
  let amazonCityOkCount = 0;
  let amazonCityWarnCount = 0;
  let amazonCityNgCount = 0;
  for (const entry of fixture) {
    if (!entry.municipalityJp) continue;
    const result = findAmazonMatches(
      { prefecture: '', municipality: entry.municipalityJp },
      amazonMasterEntries
    );
    if (result.status === 'OK_市区町村') {
      amazonCityOkCount++;
      assert.equal(result.displayName, entry.displayName, `displayName mismatch for ${entry.municipalityJp}`);
      assert.equal(result.note, '', `note should be empty for ${entry.municipalityJp}`);
    } else if (result.status === 'WARN_都道府県推定') {
      amazonCityWarnCount++;
    } else if (result.status === 'NG_未識別') {
      amazonCityNgCount++;
    }
  }
  assert.equal(amazonCityOkCount, 255, 'All 255 Amazon cities should be OK_市区町村 when entered alone');
  assert.equal(amazonCityWarnCount, 0, 'Amazon single city input should have 0 WARN_都道府県推定');
  assert.equal(amazonCityNgCount, 0, 'Amazon single city input should have 0 NG_未識別');

  // 代表案例：宗像市単一入力
  const resultMunakata = findAmazonMatches(
    { prefecture: '', municipality: '宗像市' },
    amazonMasterEntries
  );
  assert.equal(resultMunakata.status, 'OK_市区町村');
  assert.equal(resultMunakata.displayName, 'Munakata, Fukuoka, JP');

  // A2-1: Amazon結果HTMLにlevel suffixを含まない
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const sampleInputs = ['静岡県伊東市', '伊東市', '宗像市', '東京都千代田区', '鳳珠郡'];
  for (const input of sampleInputs) {
    const parsed = sandbox.parseLine ? sandbox.parseLine(input) : { raw: input, prefecture: input.includes('県') || input.includes('都') || input.includes('府') ? input.slice(0, 3) : '', municipality: input.includes('県') || input.includes('都') || input.includes('府') ? input.slice(3) : input, parsed: input };
    const matchResult = findMatches(parsed);
    if (matchResult.displayName) {
      assert.ok(!matchResult.displayName.includes('（市区町村）'), `Amazon displayName should not contain suffix: ${matchResult.displayName}`);
      assert.ok(!matchResult.displayName.includes('（都道府県）'), `Amazon displayName should not contain suffix: ${matchResult.displayName}`);
    }
  }

  // A2-1: DV360のWARN_都道府県推定ロジックは変更しない
  mediaSelect.value = 'dv360';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const dv360Result = findMatches({ raw: '三郷市', prefecture: '', municipality: '三郷市', parsed: '（都道府県なし）三郷市' });
  assert.equal(dv360Result.status, 'WARN_都道府県推定', 'DV360 single city should still return WARN_都道府県推定');
  assert.equal(dv360Result.displayName, 'Misato, Saitama, Japan');

  // A2-1: renderResults内でmediaを明示取得（グローバル依存排除）
  assert.ok(scriptSource.includes('const media = getMediaConfig().media;'), 'renderResults should explicitly declare media');

  // 22. HTML inline JavaScript syntax PASS
  assert.ok(typeof sandbox.getMaster === 'function', 'getMaster should be defined');
  assert.ok(typeof sandbox.findMatches === 'function', 'findMatches should be defined');
  assert.ok(typeof sandbox.updateMediaUI === 'function', 'updateMediaUI should be defined');
  assert.ok(typeof sandbox.renderMasterTable === 'function', 'renderMasterTable should be defined');
  assert.ok(typeof sandbox.loadSample === 'function', 'loadSample should be defined');
  assert.ok(typeof sandbox.copyConversionResults === 'function', 'copyConversionResults should be defined');

  // 23. Offline safety check - no external file reads in HTML
  const offlineUnsafe = [
    'fetch(',
    'XMLHttpRequest',
    'import(',
    'require(',
    'fs.read',
    'fs.write',
    'fs.create',
    'http://',
    'https://'
  ];
  for (const unsafe of offlineUnsafe) {
    assert.ok(!scriptSource.includes(unsafe), `HTML script should not contain ${unsafe}`);
  }

  // 24. git diff --check
  const { execSync } = require('child_process');
  try {
    const result = execSync('git diff --check', { cwd: projectRoot, encoding: 'utf8' });
    assert.ok(!result, 'git diff --check should pass');
  } catch (e) {
    if (e.stdout && e.stdout.trim()) {
      assert.fail('git diff --check failed: ' + e.stdout);
    }
  }

  // A2-2: Amazon都道府县省略入力支持
  // 大阪（省略）
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const resultOsakaShort = findMatches({ raw: '大阪', prefecture: '大阪', municipality: '', parsed: '大阪' });
  assert.equal(resultOsakaShort.status, 'OK_都道府県', '大阪 should resolve to Osaka, JP');
  assert.equal(resultOsakaShort.displayName, 'Osaka, JP');

  // 大阪府（正式）
  const resultOsakaFull = findMatches({ raw: '大阪府', prefecture: '大阪府', municipality: '', parsed: '大阪府' });
  assert.equal(resultOsakaFull.status, 'OK_都道府県');
  assert.equal(resultOsakaFull.displayName, 'Osaka, JP');

  // 東京／東京都
  const resultTokyoShort = findMatches({ raw: '東京', prefecture: '東京', municipality: '', parsed: '東京' });
  assert.equal(resultTokyoShort.status, 'OK_都道府県');
  assert.equal(resultTokyoShort.displayName, 'Tokyo, JP');
  const resultTokyoFull = findMatches({ raw: '東京都', prefecture: '東京都', municipality: '', parsed: '東京都' });
  assert.equal(resultTokyoFull.status, 'OK_都道府県');
  assert.equal(resultTokyoFull.displayName, 'Tokyo, JP');

  // 京都／京都府
  const resultKyotoShort = findMatches({ raw: '京都', prefecture: '京都', municipality: '', parsed: '京都' });
  assert.equal(resultKyotoShort.status, 'OK_都道府県');
  assert.equal(resultKyotoShort.displayName, 'Kyoto, JP');
  const resultKyotoFull = findMatches({ raw: '京都府', prefecture: '京都府', municipality: '', parsed: '京都府' });
  assert.equal(resultKyotoFull.status, 'OK_都道府県');
  assert.equal(resultKyotoFull.displayName, 'Kyoto, JP');

  // 福岡／福岡県
  const resultFukuokaShort = findMatches({ raw: '福岡', prefecture: '福岡', municipality: '', parsed: '福岡' });
  assert.equal(resultFukuokaShort.status, 'OK_都道府県');
  assert.equal(resultFukuokaShort.displayName, 'Fukuoka, JP');
  const resultFukuokaFull = findMatches({ raw: '福岡県', prefecture: '福岡県', municipality: '', parsed: '福岡県' });
  assert.equal(resultFukuokaFull.status, 'OK_都道府県');
  assert.equal(resultFukuokaFull.displayName, 'Fukuoka, JP');

  // 沖縄／沖縄県
  const resultOkinawaShort = findMatches({ raw: '沖縄', prefecture: '沖縄', municipality: '', parsed: '沖縄' });
  assert.equal(resultOkinawaShort.status, 'OK_都道府県');
  assert.equal(resultOkinawaShort.displayName, 'Okinawa, JP');
  const resultOkinawaFull = findMatches({ raw: '沖縄県', prefecture: '沖縄県', municipality: '', parsed: '沖縄県' });
  assert.equal(resultOkinawaFull.status, 'OK_都道府県');
  assert.equal(resultOkinawaFull.displayName, 'Okinawa, JP');

  // 北海道（正式のみ、省略なし）
  const resultHokkaido = findMatches({ raw: '北海道', prefecture: '北海道', municipality: '', parsed: '北海道' });
  assert.equal(resultHokkaido.status, 'OK_都道府県');
  assert.equal(resultHokkaido.displayName, 'Hokkaido, JP');

  // 北海（誤削除）→ NG_未識別
  const resultHokkai = findMatches({ raw: '北海', prefecture: '北海', municipality: '', parsed: '北海' });
  assert.equal(resultHokkai.status, 'NG_未識別', '北海 should not match 北海道');

  // 全47都道府県（正式名称）
  const allPrefs = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  const prefDisplayMap = {'北海道':'Hokkaido, JP','青森県':'Aomori, JP','岩手県':'Iwate, JP','宮城県':'Miyagi, JP','秋田県':'Akita, JP','山形県':'Yamagata, JP','福島県':'Fukushima, JP','茨城県':'Ibaraki, JP','栃木県':'Tochigi, JP','群馬県':'Gunma, JP','埼玉県':'Saitama, JP','千葉県':'Chiba, JP','東京都':'Tokyo, JP','神奈川県':'Kanagawa, JP','新潟県':'Niigata, JP','富山県':'Toyama, JP','石川県':'Ishikawa, JP','福井県':'Fukui, JP','山梨県':'Yamanashi, JP','長野県':'Nagano, JP','岐阜県':'Gifu, JP','静岡県':'Shizuoka, JP','愛知県':'Aichi, JP','三重県':'Mie, JP','滋賀県':'Shiga, JP','京都府':'Kyoto, JP','大阪府':'Osaka, JP','兵庫県':'Hyogo, JP','奈良県':'Nara, JP','和歌山県':'Wakayama, JP','鳥取県':'Tottori, JP','島根県':'Shimane, JP','岡山県':'Okayama, JP','広島県':'Hiroshima, JP','山口県':'Yamaguchi, JP','徳島県':'Tokushima, JP','香川県':'Kagawa, JP','愛媛県':'Ehime, JP','高知県':'Kochi, JP','福岡県':'Fukuoka, JP','佐賀県':'Saga, JP','長崎県':'Nagasaki, JP','熊本県':'Kumamoto, JP','大分県':'Oita, JP','宮崎県':'Miyazaki, JP','鹿児島県':'Kagoshima, JP','沖縄県':'Okinawa, JP'};
  let formalPrefOk = 0;
  for (const pref of allPrefs) {
    const r = findMatches({ raw: pref, prefecture: pref, municipality: '', parsed: pref });
    if (r.status === 'OK_都道府県' && r.displayName === prefDisplayMap[pref]) {
      formalPrefOk++;
    }
  }
  assert.equal(formalPrefOk, 47, 'All 47 formal prefectures should resolve correctly');

  // 46個省略名称（北海道除く）
  const abbreviations = ['青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','神奈川','東京','新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重','滋賀','京都','大阪','兵庫','奈良','和歌山','鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'];
  let abbrOk = 0;
  for (const abbr of abbreviations) {
    let full;
    if (abbr === '東京') full = '東京都';
    else if (abbr === '京都') full = '京都府';
    else if (abbr === '大阪') full = '大阪府';
    else full = abbr + '県';
    const expectedDisplay = prefDisplayMap[full];
    const r = findMatches({ raw: abbr, prefecture: abbr, municipality: '', parsed: abbr });
    if (r.status === 'OK_都道府県' && r.displayName === expectedDisplay) {
      abbrOk++;
    }
  }
  assert.equal(abbrOk, 46, 'All 46 abbreviations should resolve correctly');

  // Amazon 255条市区町村単一入力仍全部OK_市区町村
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  let cityOkCount = 0;
  for (const entry of fixture) {
    if (!entry.municipalityJp) continue;
    const r = findMatches({ raw: entry.municipalityJp, prefecture: '', municipality: entry.municipalityJp, parsed: '（都道府県なし）' + entry.municipalityJp });
    if (r.status === 'OK_市区町村' && r.displayName === entry.displayName) {
      cityOkCount++;
    }
  }
  assert.equal(cityOkCount, 255, 'All 255 Amazon cities should still be OK_市区町村 when entered alone');

  // 宗像市仍输出Munakata, Fukuoka, JP
  assert.ok(resultMunakata.status === 'OK_市区町村' && resultMunakata.displayName === 'Munakata, Fukuoka, JP', 'Munakata should still be OK_市区町村');

  // A2-3: 真实调用路径测试（parseLine -> resolveAmazonPrefectureAlias -> findMatches）
  const realPathTests = [
    { input: '東京', expectedStatus: 'OK_都道府県', expectedDisplay: 'Tokyo, JP' },
    { input: '東京都', expectedStatus: 'OK_都道府県', expectedDisplay: 'Tokyo, JP' },
    { input: '大阪', expectedStatus: 'OK_都道府県', expectedDisplay: 'Osaka, JP' },
    { input: '大阪府', expectedStatus: 'OK_都道府県', expectedDisplay: 'Osaka, JP' },
    { input: '京都', expectedStatus: 'OK_都道府県', expectedDisplay: 'Kyoto, JP' },
    { input: '京都府', expectedStatus: 'OK_都道府県', expectedDisplay: 'Kyoto, JP' },
    { input: '福岡', expectedStatus: 'OK_都道府県', expectedDisplay: 'Fukuoka, JP' },
    { input: '福岡県', expectedStatus: 'OK_都道府県', expectedDisplay: 'Fukuoka, JP' },
    { input: '沖縄', expectedStatus: 'OK_都道府県', expectedDisplay: 'Okinawa, JP' },
    { input: '沖縄県', expectedStatus: 'OK_都道府県', expectedDisplay: 'Okinawa, JP' },
    { input: '北海道', expectedStatus: 'OK_都道府県', expectedDisplay: 'Hokkaido, JP' },
    { input: '北海', expectedStatus: 'NG_未識別', expectedDisplay: '' },
  ];
  for (const tc of realPathTests) {
    const parsed = sandbox.parseLine(tc.input);
    const result = findMatches(parsed);
    assert.equal(result.status, tc.expectedStatus, `${tc.input} status should be ${tc.expectedStatus}`);
    if (tc.expectedDisplay) {
      assert.equal(result.displayName, tc.expectedDisplay, `${tc.input} displayName should be ${tc.expectedDisplay}`);
      assert.ok(result.displayName.endsWith(', JP'), `${tc.input} displayName should end with ", JP"`);
      assert.ok(!result.displayName.includes(', Japan'), `${tc.input} displayName should not contain ", Japan"`);
      assert.ok(!result.displayName.includes('（都道府県）'), `${tc.input} displayName should not contain level suffix`);
      assert.ok(!result.displayName.includes('（市区町村）'), `${tc.input} displayName should not contain level suffix`);
      assert.equal(result.note, '', `${tc.input} note should be empty`);
    } else {
      assert.ok(!result.displayName, `${tc.input} should have empty displayName`);
    }
  }

  // A2-3: Amazon Master刷新验证
  mediaSelect.value = 'amazon';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const amazonMasterCount = sandbox.getMaster('amazon').confirmed.length;
  assert.equal(amazonMasterCount, 302, 'Amazon master should show 302 after media switch');

  // DV360入力「大阪」保持原有行为
  mediaSelect.value = 'dv360';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  const dv360OsakaResult = findMatches({ raw: '大阪', prefecture: '', municipality: '大阪', parsed: '（都道府県なし）大阪' });
  assert.equal(dv360OsakaResult.status, 'NG_未識別', 'DV360 should not resolve abbreviated prefecture 大阪');

  // 東洋経済新報社不受影响
  mediaSelect.value = 'toyokeizai';
  mediaSelect.dispatchEvent(new sandbox.Event('change'));
  assert.ok(typeof sandbox.runToyokeizaiConversion === 'function', 'Toyokeizai should still work');
});
