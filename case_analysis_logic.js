// ============================================================
// 案件分析 表示ロジック（純計算・DOM 非依存）
// case_analysis_logic.js — USAGE_DASHBOARD_CASE_ANALYSIS_V1_CANDIDATE
// ------------------------------------------------------------
// 設計原則:
//   1. DOM もネットワークも触らない。Node でそのまま単体テストできる。
//   2. 集計（案件のまとめ・Session 去重）は GAS 側（caseStats）が行う。
//      本モジュールは「受け取った集計結果の並べ替え・表示文言・整合チェック」だけを担当する。
//   3. 差異の意味を絶対に取り違えない:
//        ・diff.last  = 最後の 1 実行の差異件数
//        ・sessions[].diffSum = その Session 内の差異合計（別物）
//        ・sameRun=true のときは「変化」ではなく 1 回だけの記録
//   4. 完了・達成・評価は判定しない（業務未確認のため）。
// ============================================================
(function (global) {
  'use strict';

  var SORT_KEYS = ['lastUsedDesc', 'execDesc', 'sessionDesc', 'caseNameAsc'];

  function str(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function toInt(v) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : 0;
  }

  function formatInt(v) {
    var n = toInt(v);
    var neg = n < 0;
    var s = String(Math.abs(n));
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s.charAt(i);
    }
    return (neg ? '-' : '') + out;
  }

  function formatDelta(v) {
    var n = toInt(v);
    return (n > 0 ? '+' : '') + formatInt(n);
  }

  // ---------- 応答の検証 ----------

  /**
   * caseStats の応答を検証する。壊れた応答を画面に流さない。
   * @returns {{ok:boolean, error?:string}}
   */
  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: '応答が空です' };
    if (payload.ok !== true) {
      return { ok: false, error: str(payload.error) || '案件データを取得できませんでした' };
    }
    if (payload.action !== 'caseStats') {
      return { ok: false, error: '想定外の応答です（action=' + str(payload.action) + '）' };
    }
    function count(v) { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0; }
    function strings(v) { return Array.isArray(v) && v.every(function (s) { return typeof s === 'string'; }); }
    function validDiff(d) {
      if (d === undefined || d === null) return true; // legacy missing information renders unknown
      if (typeof d !== 'object' || Array.isArray(d)) return false;
      if (!(d.first === null || count(d.first)) || !(d.last === null || count(d.last))) return false;
      if (!(d.delta === null || (typeof d.delta === 'number' && Number.isSafeInteger(d.delta)))) return false;
      if (d.unknownCount !== undefined && !count(d.unknownCount)) return false;
      return ['sameRun', 'orderAssumption', 'reliable'].every(function (k) { return d[k] === undefined || typeof d[k] === 'boolean'; });
    }
    function bad() { return { ok: false, error: '案件データの形式が不正です' }; }
    if (payload.meta && (typeof payload.meta !== 'object' || Array.isArray(payload.meta))) return bad();
    if (payload.meta && payload.meta.caveats !== undefined && !strings(payload.meta.caveats)) return bad();
    if (payload.toolsDetail !== undefined && (!Array.isArray(payload.toolsDetail) || !payload.toolsDetail.every(function (t) {
      return t && typeof t === 'object' && typeof t.tool === 'string' && (!t.toolLabel || typeof t.toolLabel === 'string');
    }))) return bad();
    if (payload.tools !== undefined && !strings(payload.tools)) return bad();
    if (payload.meta && payload.meta.mode === 'sessions') {
      if (!Array.isArray(payload.sessions)) return { ok: false, error: 'Session 明細の形式が不正です' };
      if (!payload.sessions.every(function (s) {
        return s && typeof s === 'object' && typeof s.sessionId === 'string' && count(s.logCount) && strings(s.assignees) && (s.diffSum === null || count(s.diffSum));
      })) return bad();
      return { ok: true };
    }
    if (!Array.isArray(payload.cases)) return { ok: false, error: '案件一覧の形式が不正です' };
    if (!payload.cases.every(function (c) {
      return c && typeof c === 'object' && typeof c.caseKey === 'string' && typeof c.caseName === 'string' && typeof c.tool === 'string' && typeof c.dept === 'string' && count(c.execCount) && count(c.sessionCount) && strings(c.assignees) && validDiff(c.diff);
    })) return bad();
    return { ok: true };
  }

  // ---------- 差異の表示 ----------

  /**
   * 差異の変化を「表示用の文言」に変換する。
   * 数値の意味を変えないこと（合計と最終を混同しない）。
   */
  function formatDiffChange(diff) {
    if (!diff || typeof diff !== 'object') {
      return { text: '確認不可', tone: 'muted', note: '差異情報がありません', showNumbers: false };
    }
    var unknown = toInt(diff.unknownCount || 0);
    var first = diff.first;
    var last = diff.last;

    // 差異件数が空値・非数値だった場合は「0 件」ではなく「確認不可」。
    // （0 と不明を混同すると、未入力の行が「差異なし」に見えてしまう）
    if (first === null || first === undefined || last === null || last === undefined) {
      return {
        text: '確認不可',
        tone: 'muted',
        note: unknown > 0
          ? '差異件数が不明なログが ' + formatInt(unknown) + ' 件あるため算出できません'
          : '差異件数を取得できませんでした',
        showNumbers: false
      };
    }
    if (diff.sameRun === true) {
      return {
        text: formatInt(last) + ' 件（1 回のみ）',
        tone: 'muted',
        note: '実行が 1 回だけのため、変化としては扱いません',
        showNumbers: false
      };
    }
    var delta = toInt(diff.delta);
    var tone = delta === 0 ? 'flat' : (delta < 0 ? 'down' : 'up');
    var notes = [];
    if (diff.orderAssumption === true) {
      notes.push('※ 初回と最終が同一秒のため、順序は行番号順（後から記録された行を最終）としています');
    }
    if (unknown > 0) {
      notes.push('※ 差異件数が不明なログが ' + formatInt(unknown) + ' 件あります（集計から除外）');
    }
    return {
      text: formatInt(first) + ' → ' + formatInt(last) + '（' + formatDelta(delta) + '）',
      tone: tone,
      note: notes.join(' / '),
      showNumbers: true
    };
  }

  /** 対応者名の要約（最大 n 名 + 他X名） */
  function formatAssignees(list, max) {
    var arr = Array.isArray(list) ? list.filter(function (x) { return str(x) !== ''; }) : [];
    if (!arr.length) return '—';
    var limit = typeof max === 'number' && max > 0 ? max : 2;
    if (arr.length <= limit) return arr.join(' / ');
    return arr.slice(0, limit).join(' / ') + ' 他 ' + (arr.length - limit) + ' 名';
  }

  // ---------- 並べ替え ----------

  function sortCases(rows, key) {
    var list = (rows || []).slice();
    var k = SORT_KEYS.indexOf(key) >= 0 ? key : 'lastUsedDesc';
    list.sort(function (a, b) {
      if (k === 'execDesc') {
        if (toInt(b.execCount) !== toInt(a.execCount)) return toInt(b.execCount) - toInt(a.execCount);
      } else if (k === 'sessionDesc') {
        if (toInt(b.sessionCount) !== toInt(a.sessionCount)) return toInt(b.sessionCount) - toInt(a.sessionCount);
      } else if (k === 'caseNameAsc') {
        var n = str(a.caseName).localeCompare(str(b.caseName));
        if (n !== 0) return n;
      } else {
        var al = str(a.lastUsed);
        var bl = str(b.lastUsed);
        if (al !== bl) return al < bl ? 1 : -1;
      }
      // 決定的な順序にするための最終キー
      var c = str(a.caseName).localeCompare(str(b.caseName));
      if (c !== 0) return c;
      var d = str(a.dept).localeCompare(str(b.dept));
      if (d !== 0) return d;
      return str(a.tool).localeCompare(str(b.tool));
    });
    return list;
  }

  // ---------- 集計（画面表示用の参考値のみ） ----------

  /**
   * 一覧の合計。案件をまたいだ単純合計であり、
   * 「ユニークな人」や「案件数」の意味は持たない。
   */
  function summarizeCases(rows) {
    var list = rows || [];
    var exec = 0;
    var sessions = 0;
    var names = Object.create(null);
    var tools = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      exec += toInt(list[i].execCount);
      sessions += toInt(list[i].sessionCount);
      (list[i].assignees || []).forEach(function (n) { if (str(n)) names[str(n)] = true; });
      if (str(list[i].tool)) tools[str(list[i].tool)] = true;
    }
    return {
      caseCount: list.length,
      execTotal: exec,
      sessionTotal: sessions,
      assigneeCount: Object.keys(names).length,
      toolCount: Object.keys(tools).length
    };
  }

  // ---------- 再取得が必要かの判定 ----------

  function sameFilters(a, b) {
    var x = a || {};
    var y = b || {};
    return str(x.dept) === str(y.dept) &&
      str(x.email) === str(y.email) &&
      str(x.tool) === str(y.tool) &&
      str(x.from) === str(y.from) &&
      str(x.to) === str(y.to) &&
      str(x.q) === str(y.q);
  }

  var CaseAnalysis = {
    SORT_KEYS: SORT_KEYS,
    str: str,
    toInt: toInt,
    formatInt: formatInt,
    formatDelta: formatDelta,
    validatePayload: validatePayload,
    formatDiffChange: formatDiffChange,
    formatAssignees: formatAssignees,
    sortCases: sortCases,
    summarizeCases: summarizeCases,
    sameFilters: sameFilters
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CaseAnalysis;
  if (global) global.CaseAnalysis = CaseAnalysis;
})(typeof window !== 'undefined' ? window : null);
