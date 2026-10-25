/* ============================================================
   qc-header.js — 惠海 QC 门户 公共 Header 组件（P1 候选）
   版本：1.0.0
   ------------------------------------------------------------
   职责边界（严格）：
     ・只负责公共 UI：品牌 / 工具标题 / 徽标 / 用户信息显示 / 返回门户
     ・不做认证、不做授权、不发请求、不读写 Token
     ・不替换 document.body，不猜测页面结构，只往显式挂载节点内渲染

   依赖：
     ・qc-auth.js  ——  仅由页面调用 guardPage() 取得 user 后传入（组件不引用）
     ・tool_logos.js ——  可选。存在 window.toolLogoSVG(id) 时用于取工具图标

   用法（页面侧）：
     <div id="qcHeaderMount"></div>
     <script src="qc-auth.js"></script>
     <script src="tool_logos.js"></script>
     <script src="qc-header.js"></script>
     <script>
       var u = guardPage();
       if (!u) { ...既存の未ログイン処理... }
       else {
         QCHeader.mount({
           target: '#qcHeaderMount',      // 显式挂载节点（必填）
           title: 'Excel清洗',            // 工具标题（必填）
           iconId: 'excelClean',          // tool_logos.js 的 key（可选）
           badges: [{ text: '完全本地运行', tone: 'ok' }],  // 可选
           note: '清除Excel中的不可见字符',  // 可选：原 back-nav 的业务说明
           user: u,                       // 由页面通过 guardPage() 取得
           logo: 'assets/brand/huihai-logo.png'  // 可选：官方 LOGO
         });
       }
     </script>

   内部吸顶元素：
     组件挂载后会把实测总高写入 :root 的 --qc-header-h，
     表格 thead / 结果区 header 等请使用 top: var(--qc-header-h)。
   ============================================================ */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  var DEFAULTS = {
    target: '#qcHeaderMount',
    title: '',
    note: '',
    badges: [],
    iconId: '',
    iconSVG: '',
    logo: '',
    logoAlt: '惠海信息技术',
    homeHref: 'index.html',
    homeLabel: '返回门户',
    portalTitle: '惠海 QC 门户',
    portalSub: 'BPO QUALITY CHECK',
    user: null,
    // P2-B：可选插槽（不传时 DOM 与 P2-A 完全一致）
    brandActions: '',   // 第一行右侧、用户信息之前的自定义 HTML（语言切换、刷新按钮等）
    toolExtra: ''       // 第二行末尾的自定义 HTML（更新时间戳等）
  };

  var state = {
    mounted: false,
    height: 0,
    config: null
  };

  // ---------- 工具函数 ----------

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveIcon(cfg) {
    // 优先使用 tool_logos.js 的导出（浏览器下为 window.toolLogoSVG）
    var fn = (typeof global.toolLogoSVG === 'function') ? global.toolLogoSVG : null;
    if (cfg.iconId && fn) {
      var svg = fn(cfg.iconId);
      if (svg && String(svg).indexOf('<svg') === 0) return String(svg);
    }
    if (cfg.iconSVG && String(cfg.iconSVG).indexOf('<svg') === 0) return String(cfg.iconSVG);
    return '';   // 取不到就不显示图标（不使用 Emoji 代替）
  }

  function badgesHTML(badges) {
    if (!badges || !badges.length) return '';
    var html = '';
    for (var i = 0; i < badges.length; i++) {
      var b = badges[i];
      if (!b) continue;
      var text = (typeof b === 'string') ? b : (b.text || '');
      if (!text) continue;
      var tone = (b && b.tone) ? ' is-' + String(b.tone).replace(/[^a-z]/gi, '') : '';
      html += '<span class="qc-badge' + tone + '">' + esc(text) + '</span>';
    }
    return html;
  }

  function userHTML(user) {
    if (!user) return '<span class="qc-user is-empty"></span>';
    var name = esc(user.name || '');
    var mail = esc(user.email || '');
    var html = '<span class="qc-user">';
    if (name) html += '<span class="qc-user-name">' + name + '</span>';
    if (mail) html += '<span class="qc-user-mail">' + mail + '</span>';
    if (!name && !mail) html += '<span class="qc-user-name">—</span>';
    html += '</span>';
    return html;
  }

  function template(cfg, iconSVG) {
    var hasLogo = !!cfg.logo;
    // ★ FIX1：本试点不再使用徽标。没有徽标时不输出空的 .qc-badges 容器（避免多余间距节点）。
    var badgesStr = badgesHTML(cfg.badges);

    var logoHTML =
      '<span class="qc-logo-plate' + (hasLogo ? '' : ' is-empty') + '">' +
        (hasLogo
          ? '<img class="qc-logo" id="qcHeaderLogo" src="' + esc(cfg.logo) + '" alt="' + esc(cfg.logoAlt) + '">'
          : '') +
      '</span>';

    return '' +
      '<div class="qc-row qc-row-brand">' +
        '<div class="qc-inner">' +
          '<div class="qc-brand">' +
            logoHTML +
            '<span class="qc-portal">' +
              '<span class="qc-portal-title">' + esc(cfg.portalTitle) + '</span>' +
              '<span class="qc-portal-sub">' + esc(cfg.portalSub) + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="qc-actions">' +
            (cfg.brandActions ? '<span class="qc-extra-actions">' + cfg.brandActions + '</span>' : '') +
            userHTML(cfg.user) +
            '<a class="qc-return" id="qcHeaderReturn" href="' + esc(cfg.homeHref) + '">' +
              '&#8592; ' + esc(cfg.homeLabel) +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="qc-row qc-row-tool">' +
        '<div class="qc-inner">' +
          '<div class="qc-tool">' +
            (iconSVG ? '<span class="qc-tool-icon" aria-hidden="true">' + iconSVG + '</span>' : '') +
            '<span class="qc-tool-title">' + esc(cfg.title) + '</span>' +
            (badgesStr ? '<span class="qc-badges">' + badgesStr + '</span>' : '') +
          '</div>' +
          (cfg.note ? '<div class="qc-tool-meta">' + esc(cfg.note) + '</div>' : '') +
          (cfg.toolExtra ? '<span class="qc-tool-extra">' + cfg.toolExtra + '</span>' : '') +
        '</div>' +
      '</div>';
  }

  // ---------- 高度同步（为后续页面的内部吸顶提供偏移量） ----------

  function syncHeight() {
    var host = document.getElementById('qcHeaderMount');
    if (!host) return state.height;
    var h = host.getBoundingClientRect ? host.getBoundingClientRect().height : 0;
    if (!h) h = host.offsetHeight || 0;
    if (h > 0) {
      state.height = Math.round(h);
      document.documentElement.style.setProperty('--qc-header-h', state.height + 'px');
    }
    return state.height;
  }

  var resizeBound = false;
  function bindResize() {
    if (resizeBound) return;
    resizeBound = true;
    var pending = false;
    function onResize() {
      if (pending) return;
      pending = true;
      var raf = global.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
      raf(function () { pending = false; syncHeight(); });
    }
    global.addEventListener('resize', onResize);
    global.addEventListener('load', function () { syncHeight(); });
  }

  // ---------- 对外 API ----------

  function mount(config) {
    var cfg = {};
    for (var k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) cfg[k] = DEFAULTS[k];
    }
    if (config) {
      for (var k2 in config) {
        if (Object.prototype.hasOwnProperty.call(config, k2) && config[k2] !== undefined) {
          cfg[k2] = config[k2];
        }
      }
    }

    var host = document.querySelector(cfg.target);
    if (!host) {
      if (global.console && console.warn) {
        console.warn('[QCHeader] mount target not found: ' + cfg.target);
      }
      return false;
    }

    var iconSVG = resolveIcon(cfg);
    host.classList.add('qc-header');
    host.setAttribute('role', 'banner');
    host.innerHTML = template(cfg, iconSVG);   // 只替换挂载节点内部，不触碰 body

    // 官方 LOGO 加载失败时隐藏承载板（避免出现破图或替代图形）
    var logo = document.getElementById('qcHeaderLogo');
    if (logo) {
      logo.addEventListener('error', function () {
        var plate = logo.parentNode;
        if (plate && plate.classList) plate.classList.add('is-empty');
        if (logo.parentNode) logo.parentNode.removeAttribute('title');
      });
    }

    state.mounted = true;
    state.config = cfg;
    bindResize();
    syncHeight();
    return true;
  }

  // P2-B：语言切换后更新工具标题 / 说明（只改文本，不重建 DOM）
  function setTitle(text) {
    var el = document.querySelector('#qcHeaderMount .qc-tool-title');
    if (!el) return false;
    el.textContent = String(text == null ? '' : text);
    if (state.config) state.config.title = String(text == null ? '' : text);
    return true;
  }

  function setNote(text) {
    var el = document.querySelector('#qcHeaderMount .qc-tool-meta');
    if (!el) return false;
    el.textContent = String(text == null ? '' : text);
    if (state.config) state.config.note = String(text == null ? '' : text);
    return true;
  }

  function setUser(user) {
    var host = document.getElementById('qcHeaderMount');
    if (!host) return false;
    var current = host.querySelector('.qc-actions .qc-user');
    if (!current) return false;
    var wrap = document.createElement('span');
    wrap.innerHTML = userHTML(user);
    current.parentNode.replaceChild(wrap.firstChild, current);
    if (state.config) state.config.user = user;
    return true;
  }

  function getOffset() {
    return state.height || 0;
  }

  function isMounted() {
    return state.mounted;
  }

  global.QCHeader = {
    version: VERSION,
    mount: mount,
    setUser: setUser,
    setTitle: setTitle,
    setNote: setNote,
    getOffset: getOffset,
    isMounted: isMounted,
    syncHeight: syncHeight
  };
})(typeof window !== 'undefined' ? window : this);
