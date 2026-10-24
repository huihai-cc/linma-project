// ============================================================
// 工具使用状况管理 看板 - 纯计算逻辑模块
// usage_dashboard_logic.js
// ------------------------------------------------------------
// 设计原则：
//   1. 本文件不接触 DOM、不发起网络请求，只做「汇总数据 → 视图数据」的纯计算。
//   2. 因此可在 Node 环境下直接做单元测试（tests/usage_dashboard_logic.test.js）。
//   3. 统计口径严格沿用 GAS rebuildSummary() 产出的 summary 表：
//        実行回数   = summary G 列
//        有効利用回数 = summary H 列（15 分去重后的口径，由 GAS 计算）
//        差異件数合計 = summary I 列
//      本模块只做「加总 / 分组 / 排序」，不重新定义任何口径，
//      也不从执行次数推算案件数或节省工时。
//   4. 时间字段一律当作字符串处理（yyyy/MM/dd、yyyy/MM/dd HH:mm:ss），
//      按字典序比较即等价于按时间比较，避免浏览器时区影响。
// ============================================================
(function (global) {
  'use strict';

  var SUMMARY_FIELDS = [
    'date', 'month', 'email', 'name', 'dept',
    'tool', 'exec', 'eff', 'diff', 'first', 'last'
  ];

  var UNKNOWN_DEPT_LABEL = '(課室未設定)';
  var UNKNOWN_TOOL_LABEL = '(ツール名未設定)';

  // ---------- 基础工具 ----------

  function str(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function toInt(v) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : 0;
  }

  function pad2(v) {
    var s = String(v);
    return s.length >= 2 ? s : '0' + s;
  }

  // 千分位。不使用 toLocaleString，避免不同浏览器/环境的差异。
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

  function formatDateTime(v) {
    return str(v) || '—';
  }

  // summary 行（数组）→ 对象
  function rowFromArray(arr) {
    if (!arr || !arr.length) return null;
    var row = {};
    for (var i = 0; i < SUMMARY_FIELDS.length; i++) {
      row[SUMMARY_FIELDS[i]] = arr[i];
    }
    row.date = str(row.date);
    row.month = str(row.month);
    row.email = str(row.email);
    row.name = str(row.name);
    row.dept = str(row.dept);
    row.tool = str(row.tool);
    row.exec = toInt(row.exec);
    row.eff = toInt(row.eff);
    row.diff = toInt(row.diff);
    row.first = str(row.first);
    row.last = str(row.last);
    return row;
  }

  function normalizeRows(rawRows) {
    var out = [];
    if (!rawRows || !rawRows.length) return out;
    for (var i = 0; i < rawRows.length; i++) {
      var row = rowFromArray(rawRows[i]);
      if (!row) continue;
      // 与 GAS 侧一致：没有时间/邮箱/工具名的行不参与统计
      if (!row.date || !row.email || !row.tool) continue;
      out.push(row);
    }
    return out;
  }

  // 対象月 'yyyy年MM月' → 'yyyy-MM'；缺失时回退到 集計日
  function monthKeyOf(row) {
    if (!row) return '';
    var m = /^(\d{4})年(\d{1,2})月$/.exec(str(row.month));
    if (m) return m[1] + '-' + pad2(m[2]);
    var d = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(str(row.date));
    if (d) return d[1] + '-' + pad2(d[2]);
    return '';
  }

  function monthLabelOf(monthKey) {
    var m = /^(\d{4})-(\d{2})$/.exec(str(monthKey));
    if (!m) return str(monthKey) || '—';
    return m[1] + '年' + m[2] + '月';
  }

  function shiftMonth(monthKey, delta) {
    var m = /^(\d{4})-(\d{2})$/.exec(str(monthKey));
    if (!m) return '';
    var total = parseInt(m[1], 10) * 12 + (parseInt(m[2], 10) - 1) + delta;
    var y = Math.floor(total / 12);
    var mo = total % 12;
    if (mo < 0) { mo += 12; y -= 1; }
    return String(y) + '-' + pad2(mo + 1);
  }

  function monthRange(startKey, endKey) {
    var out = [];
    if (!startKey || !endKey) return out;
    var cur = startKey;
    var guard = 0;
    while (cur && cur <= endKey && guard < 240) {
      out.push(cur);
      cur = shiftMonth(cur, 1);
      guard++;
    }
    return out;
  }

  function currentMonthKey(now) {
    var d = now || new Date();
    return String(d.getFullYear()) + '-' + pad2(d.getMonth() + 1);
  }

  // ---------- 过滤 ----------

  function asArray(v) {
    if (!v) return [];
    if (Object.prototype.toString.call(v) === '[object Array]') return v.filter(function (x) { return str(x) !== ''; });
    return str(v) === '' ? [] : [str(v)];
  }

  // filter: { dept, month, date, from, to, emails, tools }
  function filterRows(rows, filter) {
    var f = filter || {};
    var depts = asArray(f.dept);
    var emails = asArray(f.emails || f.email);
    var tools = asArray(f.tools || f.tool);
    var month = str(f.month);
    var date = str(f.date);
    var from = str(f.from);
    var to = str(f.to);

    var out = [];
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (depts.length && depts.indexOf(r.dept) < 0) continue;
      if (emails.length && emails.indexOf(r.email) < 0) continue;
      if (tools.length && tools.indexOf(r.tool) < 0) continue;
      if (month && monthKeyOf(r) !== month) continue;
      if (date && r.date !== date) continue;
      if (from && r.date < from) continue;
      if (to && r.date > to) continue;
      out.push(r);
    }
    return out;
  }

  function distinctValues(rows, key) {
    var seen = {};
    var out = [];
    for (var i = 0; i < (rows || []).length; i++) {
      var v = rows[i][key];
      if (!Object.prototype.hasOwnProperty.call(seen, v)) {
        seen[v] = true;
        out.push(v);
      }
    }
    return out;
  }

  // 课室清单：基线 ∪ users 表 ∪ 实际数据。
  // 基线来自 index.html 的注册课室选项（人工核实过的清单），
  // 因此「本月该课室暂时没有使用记录」不会把课室从清单里删掉。
  function buildDepartmentList(baseline, userDepts, rowDepts) {
    var out = [];
    var seen = {};
    function push(v) {
      var s = str(v);
      if (!s) return;
      if (Object.prototype.hasOwnProperty.call(seen, s)) return;
      seen[s] = true;
      out.push(s);
    }
    (baseline || []).forEach(push);
    (userDepts || []).forEach(push);
    (rowDepts || []).forEach(push);
    return out;
  }

  // ---------- 通用聚合 ----------

  function emptyAgg() {
    return { exec: 0, eff: 0, diff: 0, rows: 0, first: '', last: '' };
  }

  function addToAgg(agg, row) {
    agg.exec += row.exec;
    agg.eff += row.eff;
    agg.diff += row.diff;
    agg.rows += 1;
    if (row.first && (!agg.first || row.first < agg.first)) agg.first = row.first;
    if (row.last && (!agg.last || row.last > agg.last)) agg.last = row.last;
    return agg;
  }

  function sumRows(rows) {
    var agg = emptyAgg();
    for (var i = 0; i < (rows || []).length; i++) addToAgg(agg, rows[i]);
    return agg;
  }

  function sortByExecDesc(list, valueKey) {
    var k = valueKey || 'exec';
    return list.slice().sort(function (a, b) {
      if (b[k] !== a[k]) return b[k] - a[k];
      return String(a.label || a.name || a.tool || a.dept || '')
        .localeCompare(String(b.label || b.name || b.tool || b.dept || ''));
    });
  }

  // ---------- 总览 ----------

  // 分组聚合：keyFn 决定分组键，initFn 只在首次遇到该键时调用
  function groupAggregate(rows, keyFn, initFn) {
    var map = {};
    var order = [];
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      var k = keyFn(r);
      if (!Object.prototype.hasOwnProperty.call(map, k)) {
        map[k] = emptyAgg();
        map[k].key = k;
        if (initFn) initFn(map[k], r);
        order.push(k);
      }
      addToAgg(map[k], r);
    }
    return order.map(function (k) { return map[k]; });
  }

  function computeOverview(rows, opts) {
    var o = opts || {};
    var month = str(o.month) || currentMonthKey();
    var deptFilter = str(o.dept);
    var trendMonths = o.trendMonths || 12;

    var deptScoped = filterRows(rows, { dept: deptFilter });      // 趋势用（不限月份）
    var monthRows = filterRows(deptScoped, { month: month });

    var total = sumRows(monthRows);

    // 课室排名（含未设定课室的记录，保证「全部门 = 各课室合计」恒等）
    var deptSeenUsers = {};
    var deptSeenTools = {};
    var deptGroups = groupAggregate(monthRows, function (r) {
      return r.dept || '__UNKNOWN__';
    }, function (agg, r) {
      agg.dept = r.dept;
      agg.label = r.dept || UNKNOWN_DEPT_LABEL;
      agg.userCount = 0;
      agg.toolCount = 0;
      deptSeenUsers[agg.key] = {};
      deptSeenTools[agg.key] = {};
    });
    monthRows.forEach(function (r) {
      var k = r.dept || '__UNKNOWN__';
      if (!deptSeenUsers[k]) { deptSeenUsers[k] = {}; deptSeenTools[k] = {}; }
      deptSeenUsers[k][r.email] = true;
      deptSeenTools[k][r.tool] = true;
    });
    deptGroups.forEach(function (g) {
      g.userCount = Object.keys(deptSeenUsers[g.key] || {}).length;
      g.toolCount = Object.keys(deptSeenTools[g.key] || {}).length;
    });

    // 工具排名
    var toolSeenUsers = {};
    var toolSeenDepts = {};
    var toolGroups = groupAggregate(monthRows, function (r) {
      return r.tool || '__UNKNOWN__';
    }, function (agg, r) {
      agg.tool = r.tool;
      agg.label = r.tool || UNKNOWN_TOOL_LABEL;
      agg.userCount = 0;
      agg.deptCount = 0;
      toolSeenUsers[agg.key] = {};
      toolSeenDepts[agg.key] = {};
    });
    monthRows.forEach(function (r) {
      var k = r.tool || '__UNKNOWN__';
      if (!toolSeenUsers[k]) { toolSeenUsers[k] = {}; toolSeenDepts[k] = {}; }
      toolSeenUsers[k][r.email] = true;
      toolSeenDepts[k][r.dept || '__UNKNOWN__'] = true;
    });
    toolGroups.forEach(function (g) {
      g.userCount = Object.keys(toolSeenUsers[g.key] || {}).length;
      g.deptCount = Object.keys(toolSeenDepts[g.key] || {}).length;
    });

    // 月度趋势：以选中月为终点，连续 trendMonths 个月（无数据的月份补 0）
    var allMonths = [];
    deptScoped.forEach(function (r) {
      var mk = monthKeyOf(r);
      if (mk && allMonths.indexOf(mk) < 0) allMonths.push(mk);
    });
    allMonths.sort();
    var windowStart = shiftMonth(month, -(trendMonths - 1));
    // 数据起始月晚于窗口起点时，从数据起始月开始（避免前置一串无意义的 0）
    var trendStart = (allMonths.length && allMonths[0] > windowStart) ? allMonths[0] : windowStart;
    if (trendStart > month) trendStart = windowStart;
    var range = monthRange(trendStart, month);
    var byMonth = {};
    deptScoped.forEach(function (r) {
      var mk = monthKeyOf(r);
      if (!byMonth[mk]) byMonth[mk] = emptyAgg();
      addToAgg(byMonth[mk], r);
    });
    var trend = range.map(function (mk) {
      var agg = byMonth[mk] || emptyAgg();
      return {
        monthKey: mk,
        label: monthLabelOf(mk),
        shortLabel: mk.replace(/^\d{4}-/, '') + '月',
        exec: agg.exec,
        eff: agg.eff,
        diff: agg.diff,
        hasData: !!byMonth[mk]
      };
    });

    var deptRanking = sortByExecDesc(deptGroups);
    var toolRanking = sortByExecDesc(toolGroups);

    return {
      month: month,
      monthLabel: monthLabelOf(month),
      dept: deptFilter,
      hasData: monthRows.length > 0,
      rowCount: monthRows.length,
      execTotal: total.exec,
      effTotal: total.eff,
      diffTotal: total.diff,
      activeUsers: distinctValues(monthRows, 'email').length,
      activeDepts: deptGroups.length,
      activeTools: toolGroups.length,
      topTool: toolRanking.length ? { tool: toolRanking[0].label, exec: toolRanking[0].exec } : null,
      deptRanking: deptRanking,
      toolRanking: toolRanking,
      monthlyTrend: trend,
      availableMonths: allMonths
    };
  }

  // ---------- 月度统计（人员 × 工具 矩阵） ----------

  function computeMonthlyMatrix(rows, opts) {
    var o = opts || {};
    var month = str(o.month) || currentMonthKey();
    var scoped = filterRows(rows, {
      dept: o.dept,
      month: month,
      emails: o.emails,
      tools: o.tools
    });

    // 工具列：按执行次数降序（同数按名称），来自实际统计
    var toolAgg = groupAggregate(scoped, function (r) { return r.tool || '__UNKNOWN__'; }, function (g, r, seen) {
      if (!seen) { g.label = r.tool || UNKNOWN_TOOL_LABEL; }
    });
    var toolCols = sortByExecDesc(toolAgg).map(function (g) { return g.label; });

    var personMap = {};
    var personOrder = [];
    scoped.forEach(function (r) {
      var key = r.email;
      var label = r.tool || UNKNOWN_TOOL_LABEL;
      if (!personMap[key]) {
        personMap[key] = {
          email: r.email,
          name: r.name,
          dept: r.dept,
          perTool: {},
          execTotal: 0,
          effTotal: 0,
          diffTotal: 0,
          last: '',
          first: '',
          rowCount: 0
        };
        personOrder.push(key);
      }
      var p = personMap[key];
      if (r.name) p.name = r.name;
      if (r.dept) p.dept = r.dept;
      if (!p.perTool[label]) p.perTool[label] = { exec: 0, eff: 0, diff: 0, rows: 0 };
      p.perTool[label].exec += r.exec;
      p.perTool[label].eff += r.eff;
      p.perTool[label].diff += r.diff;
      p.perTool[label].rows += 1;
      p.execTotal += r.exec;
      p.effTotal += r.eff;
      p.diffTotal += r.diff;
      p.rowCount += 1;
      if (r.first && (!p.first || r.first < p.first)) p.first = r.first;
      if (r.last && (!p.last || r.last > p.last)) p.last = r.last;
    });

    var people = personOrder.map(function (k) { return personMap[k]; });

    var sortKey = str(o.sort) || 'execDesc';
    people.sort(function (a, b) {
      if (sortKey === 'execAsc') {
        if (a.execTotal !== b.execTotal) return a.execTotal - b.execTotal;
      } else if (sortKey === 'effDesc') {
        if (b.effTotal !== a.effTotal) return b.effTotal - a.effTotal;
      } else if (sortKey === 'lastDesc') {
        if (b.last !== a.last) return b.last < a.last ? -1 : 1;
      } else {
        if (b.execTotal !== a.execTotal) return b.execTotal - a.execTotal;
      }
      return str(a.name || a.email).localeCompare(str(b.name || b.email));
    });

    var colTotals = {};
    toolCols.forEach(function (t) { colTotals[t] = { exec: 0, eff: 0, diff: 0 }; });
    people.forEach(function (p) {
      toolCols.forEach(function (t) {
        var c = p.perTool[t];
        if (!c) return;
        colTotals[t].exec += c.exec;
        colTotals[t].eff += c.eff;
        colTotals[t].diff += c.diff;
      });
    });

    var grand = sumRows(scoped);

    return {
      month: month,
      monthLabel: monthLabelOf(month),
      toolColumns: toolCols,
      people: people,
      colTotals: colTotals,
      total: grand,
      hasData: people.length > 0,
      sort: sortKey
    };
  }

  // ---------- 日度统计 ----------

  function computeDailyRows(rows, opts) {
    var o = opts || {};
    var date = str(o.date);
    var filtered = filterRows(rows, {
      dept: o.dept,
      date: date,
      emails: o.emails,
      tools: o.tools
    });
    filtered.sort(function (a, b) {
      if (a.last !== b.last) return a.last < b.last ? 1 : -1;
      return str(a.name || a.email).localeCompare(str(b.name || b.email));
    });
    var total = sumRows(filtered);
    return {
      date: date,
      rows: filtered,
      total: total,
      hasData: filtered.length > 0,
      availableDates: distinctValues(filterRows(rows, { dept: o.dept }), 'date').sort().reverse()
    };
  }

  // ---------- 人员分析 ----------

  function computePersonStats(rows, opts) {
    var o = opts || {};
    var month = str(o.month) || currentMonthKey();
    var prevMonth = o.prevMonth || shiftMonth(month, -1);
    var deptFilter = str(o.dept);

    var monthRows = filterRows(rows, { dept: deptFilter, month: month });
    var prevRows = filterRows(rows, { dept: deptFilter, month: prevMonth });

    var map = {};
    var order = [];
    function ensure(email, name, dept) {
      if (!map[email]) {
        map[email] = {
          email: email, name: name, dept: dept,
          exec: 0, eff: 0, diff: 0, rowCount: 0,
          tools: [], toolCount: 0, first: '', last: '',
          prevExec: 0, prevEff: 0, prevRowCount: 0, hasRecords: false
        };
        order.push(email);
      }
      return map[email];
    }

    monthRows.forEach(function (r) {
      var p = ensure(r.email, r.name, r.dept);
      var label = r.tool || UNKNOWN_TOOL_LABEL;
      var entry = null;
      for (var i = 0; i < p.tools.length; i++) {
        if (p.tools[i].tool === label) { entry = p.tools[i]; break; }
      }
      if (!entry) {
        entry = { tool: label, exec: 0, eff: 0, diff: 0 };
        p.tools.push(entry);
      }
      entry.exec += r.exec;
      entry.eff += r.eff;
      entry.diff += r.diff;
      p.exec += r.exec;
      p.eff += r.eff;
      p.diff += r.diff;
      p.rowCount += 1;
      p.hasRecords = true;
      if (r.name) p.name = r.name;
      if (r.dept) p.dept = r.dept;
      if (r.first && (!p.first || r.first < p.first)) p.first = r.first;
      if (r.last && (!p.last || r.last > p.last)) p.last = r.last;
    });

    prevRows.forEach(function (r) {
      var p = ensure(r.email, r.name, r.dept);
      p.prevExec += r.exec;
      p.prevEff += r.eff;
      p.prevRowCount += 1;
    });

    // 没有使用记录的员工：用可信的 users 名册补齐（明确标记 hasRecords=false）
    var roster = o.roster || [];
    roster.forEach(function (m) {
      if (!m || !m.email) return;
      if (deptFilter && str(m.dept) !== deptFilter) return;
      var p = ensure(str(m.email), str(m.name), str(m.dept));
      if (!p.name && m.name) p.name = str(m.name);
      if (!p.dept && m.dept) p.dept = str(m.dept);
    });

    var people = order.map(function (k) {
      var p = map[k];
      p.tools.sort(function (a, b) {
        if (b.exec !== a.exec) return b.exec - a.exec;
        return a.tool.localeCompare(b.tool);
      });
      p.toolCount = p.tools.length;
      p.toolsLabel = p.tools.map(function (t) { return t.tool; }).join(' / ');
      p.prevDiffExec = p.exec - p.prevExec;
      return p;
    });

    people.sort(function (a, b) {
      if (b.exec !== a.exec) return b.exec - a.exec;
      return str(a.name || a.email).localeCompare(str(b.name || b.email));
    });

    var total = sumRows(monthRows);

    return {
      month: month,
      monthLabel: monthLabelOf(month),
      prevMonth: prevMonth,
      prevMonthLabel: monthLabelOf(prevMonth),
      dept: deptFilter,
      people: people,
      total: total,
      hasData: people.length > 0
    };
  }

  // ---------- 工具分析 ----------

  function computeToolStats(rows, opts) {
    var o = opts || {};
    var deptFilter = str(o.dept);
    var from = str(o.from);
    var to = str(o.to);

    var scoped = filterRows(rows, { dept: deptFilter, from: from, to: to });

    var map = {};
    var order = [];
    scoped.forEach(function (r) {
      var label = r.tool || UNKNOWN_TOOL_LABEL;
      if (!map[label]) {
        map[label] = {
          tool: label, exec: 0, eff: 0, diff: 0, rowCount: 0,
          users: {}, depts: {}, first: '', last: '', months: {}
        };
        order.push(label);
      }
      var t = map[label];
      t.exec += r.exec;
      t.eff += r.eff;
      t.diff += r.diff;
      t.rowCount += 1;
      t.users[r.email] = true;
      t.depts[r.dept || '__UNKNOWN__'] = true;
      if (r.first && (!t.first || r.first < t.first)) t.first = r.first;
      if (r.last && (!t.last || r.last > t.last)) t.last = r.last;
      var mk = monthKeyOf(r);
      if (!t.months[mk]) t.months[mk] = { exec: 0, eff: 0 };
      t.months[mk].exec += r.exec;
      t.months[mk].eff += r.eff;
    });

    // 趋势区间：优先用 from/to，否则用数据中的月份范围（最多 12 个月）
    var allMonths = [];
    scoped.forEach(function (r) {
      var mk = monthKeyOf(r);
      if (mk && allMonths.indexOf(mk) < 0) allMonths.push(mk);
    });
    allMonths.sort();
    var startKey = from ? str(from).slice(0, 7).replace('/', '-') : (allMonths.length ? allMonths[0] : '');
    var endKey = to ? str(to).slice(0, 7).replace('/', '-') : (allMonths.length ? allMonths[allMonths.length - 1] : '');
    if (startKey && endKey) {
      var range = monthRange(startKey, endKey);
      if (range.length > 12) range = range.slice(range.length - 12);
      allMonths = range;
    }

    var tools = order.map(function (k) {
      var t = map[k];
      t.userCount = Object.keys(t.users).length;
      t.deptCount = Object.keys(t.depts).length;
      t.trend = allMonths.map(function (mk) {
        var m = t.months[mk] || { exec: 0, eff: 0 };
        return { monthKey: mk, label: monthLabelOf(mk), shortLabel: mk.replace(/^\d{4}-/, '') + '月', exec: m.exec, eff: m.eff };
      });
      t.trendMax = t.trend.reduce(function (mx, p) { return Math.max(mx, p.exec); }, 0);
      delete t.users;
      delete t.depts;
      delete t.months;
      return t;
    });

    tools.sort(function (a, b) {
      if (b.exec !== a.exec) return b.exec - a.exec;
      return a.tool.localeCompare(b.tool);
    });

    return {
      dept: deptFilter,
      from: from,
      to: to,
      months: allMonths,
      tools: tools,
      total: sumRows(scoped),
      hasData: tools.length > 0
    };
  }

  // ---------- 图表几何（本地实现，不引入图表库） ----------

  // 横向柱状图：返回百分比宽度，供 CSS 直接渲染
  function buildBarChart(items, opts) {
    var o = opts || {};
    var valueKey = o.valueKey || 'value';
    var labelKey = o.labelKey || 'label';
    var list = (items || []).map(function (it) {
      return { label: str(it[labelKey]) || '—', value: toInt(it[valueKey]), raw: it };
    });
    var max = list.reduce(function (mx, it) { return Math.max(mx, it.value); }, 0);
    list.forEach(function (it) {
      it.max = max;
      it.pct = max > 0 ? (it.value / max) * 100 : 0;
      it.widthPct = max > 0 ? (it.value / max) * 100 : 0;
      it.displayPct = max > 0 ? Math.round((it.value / max) * 1000) / 10 : 0;
    });
    return { max: max, bars: list, isEmpty: list.length === 0 || max === 0 };
  }

  // 折线图：在 0..100 的视口坐标内计算点位（viewBox="0 0 100 100"）
  function buildLineChart(series, opts) {
    var o = opts || {};
    var valueKey = o.valueKey || 'value';
    var labelKey = o.labelKey || 'label';
    var padTop = typeof o.padTop === 'number' ? o.padTop : 8;
    var padBottom = typeof o.padBottom === 'number' ? o.padBottom : 8;
    var list = (series || []).map(function (s) {
      return { label: str(s[labelKey]) || '', value: toInt(s[valueKey]), raw: s };
    });
    var max = list.reduce(function (mx, s) { return Math.max(mx, s.value); }, 0);
    var plotHeight = 100 - padTop - padBottom;
    var points = list.map(function (s, i) {
      var x = list.length <= 1 ? 50 : (i / (list.length - 1)) * 100;
      var ratio = max > 0 ? s.value / max : 0;
      var y = padTop + (1 - ratio) * plotHeight;
      return {
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        label: s.label,
        value: s.value,
        raw: s.raw
      };
    });
    var polyline = points.map(function (p) { return p.x + ',' + p.y; }).join(' ');
    var zeroY = padTop + plotHeight;
    var areaPath = points.length
      ? 'M' + points[0].x + ',' + zeroY + ' ' +
        points.map(function (p) { return 'L' + p.x + ',' + p.y; }).join(' ') +
        ' L' + points[points.length - 1].x + ',' + zeroY + ' Z'
      : '';
    return {
      max: max,
      points: points,
      polyline: polyline,
      areaPath: areaPath,
      zeroY: Math.round(zeroY * 1000) / 1000,
      padTop: padTop,
      padBottom: padBottom,
      isEmpty: list.length === 0 || max === 0
    };
  }

  // 迷你趋势条（工具分析用）：每个工具一行小柱状图
  function buildSparkline(trend, opts) {
    var o = opts || {};
    var valueKey = o.valueKey || 'exec';
    var list = (trend || []).map(function (t) { return { label: t.shortLabel || t.label, value: toInt(t[valueKey]) }; });
    var max = list.reduce(function (mx, t) { return Math.max(mx, t.value); }, 0);
    return list.map(function (t) {
      return {
        label: t.label,
        value: t.value,
        pct: max > 0 ? (t.value / max) * 100 : 0,
        isZero: t.value === 0
      };
    });
  }

  // ---------- 汇总自检（全部门 = 各课室合计） ----------

  function verifyDepartmentTotals(overview) {
    if (!overview || !overview.deptRanking) return { ok: false, reason: 'no data' };
    var execSum = overview.deptRanking.reduce(function (s, g) { return s + g.exec; }, 0);
    var effSum = overview.deptRanking.reduce(function (s, g) { return s + g.eff; }, 0);
    return {
      ok: execSum === overview.execTotal && effSum === overview.effTotal,
      execSum: execSum,
      effSum: effSum,
      execTotal: overview.execTotal,
      effTotal: overview.effTotal
    };
  }

  var UsageLogic = {
    SUMMARY_FIELDS: SUMMARY_FIELDS,
    UNKNOWN_DEPT_LABEL: UNKNOWN_DEPT_LABEL,
    UNKNOWN_TOOL_LABEL: UNKNOWN_TOOL_LABEL,
    str: str,
    toInt: toInt,
    pad2: pad2,
    formatInt: formatInt,
    formatDateTime: formatDateTime,
    rowFromArray: rowFromArray,
    normalizeRows: normalizeRows,
    monthKeyOf: monthKeyOf,
    monthLabelOf: monthLabelOf,
    shiftMonth: shiftMonth,
    monthRange: monthRange,
    currentMonthKey: currentMonthKey,
    filterRows: filterRows,
    distinctValues: distinctValues,
    buildDepartmentList: buildDepartmentList,
    sumRows: sumRows,
    computeOverview: computeOverview,
    computeMonthlyMatrix: computeMonthlyMatrix,
    computeDailyRows: computeDailyRows,
    computePersonStats: computePersonStats,
    computeToolStats: computeToolStats,
    buildBarChart: buildBarChart,
    buildLineChart: buildLineChart,
    buildSparkline: buildSparkline,
    verifyDepartmentTotals: verifyDepartmentTotals
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UsageLogic;
  }
  if (global) {
    global.UsageLogic = UsageLogic;
  }
})(typeof window !== 'undefined' ? window : null);
