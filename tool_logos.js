// ============================================================
// 工具 Logo アイコン集 — tool_logos.js
// ------------------------------------------------------------
// ・すべてインライン SVG（外部 CDN・画像ファイル不要）
// ・viewBox は 0 0 40 40、角丸 10 の正方形に統一
// ・ブランドを想起させる配色は「雰囲気」に留め、商標ロゴそのものは複製しない
// ・使い方:  toolLogoSVG('amazon')  → '<svg ...>...</svg>'
//            TOOL_LOGOS['amazon']   → 同上（生の SVG 文字列）
// ============================================================
(function (global) {
  'use strict';

  function wrap(bg, inner, extraBg) {
    return '<svg viewBox="0 0 40 40" role="img" aria-hidden="true" focusable="false" class="logo-svg">' +
      '<rect x="0" y="0" width="40" height="40" rx="10" fill="' + bg + '"/>' +
      (extraBg || '') + inner +
      '</svg>';
  }

  var TOOL_LOGOS = {
    // ---- Amazon DSP：Amazon のダークネイビー＋オレンジのスマイル矢印 ----
    amazon: wrap('#232F3E',
      '<text x="20" y="25" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" ' +
      'font-size="18" font-weight="700" fill="#ffffff">a</text>' +
      '<path d="M8 28.5 Q20 35.5 31.4 27.6" fill="none" stroke="#FF9900" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M31.6 24.6 L32.6 28.6 L28.6 28.1 Z" fill="#FF9900"/>'),

    // ---- DV360：Google 4 色のリング＋360 ----
    google360: wrap('#FFFFFF',
      '<circle cx="20" cy="20" r="13.5" fill="none" stroke="#4285F4" stroke-width="3.4" stroke-dasharray="21.2 63.6" stroke-linecap="round" transform="rotate(-90 20 20)"/>' +
      '<circle cx="20" cy="20" r="13.5" fill="none" stroke="#EA4335" stroke-width="3.4" stroke-dasharray="21.2 63.6" stroke-linecap="round" transform="rotate(0 20 20)"/>' +
      '<circle cx="20" cy="20" r="13.5" fill="none" stroke="#FBBC05" stroke-width="3.4" stroke-dasharray="21.2 63.6" stroke-linecap="round" transform="rotate(90 20 20)"/>' +
      '<circle cx="20" cy="20" r="13.5" fill="none" stroke="#34A853" stroke-width="3.4" stroke-dasharray="21.2 63.6" stroke-linecap="round" transform="rotate(180 20 20)"/>' +
      '<text x="20" y="24.2" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" ' +
      'font-size="10.5" font-weight="700" fill="#202124">360</text>',
      '<rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="#E2E8F0"/>'),

    // ---- テキスト比較：A/B 2 行と不一致記号 ----
    text: wrap('#312E81',
      '<rect x="9" y="9" width="14" height="3.6" rx="1.8" fill="#ffffff" opacity=".95"/>' +
      '<rect x="9" y="18.2" width="10" height="3.6" rx="1.8" fill="#A5B4FC"/>' +
      '<rect x="9" y="27.4" width="14" height="3.6" rx="1.8" fill="#ffffff" opacity=".95"/>' +
      '<path d="M27 12.4 L31.6 27.6" stroke="#FBBF24" stroke-width="2.6" stroke-linecap="round"/>' +
      '<circle cx="29.3" cy="20" r="1.1" fill="#FBBF24"/>'),

    // ---- Excel クリーニング：表＋ほうき ----
    excelClean: wrap('#E8F5E9',
      '<rect x="8" y="7" width="16" height="22" rx="3" fill="#217346"/>' +
      '<path d="M8 13.5h16M13 7v22" stroke="#E8F5E9" stroke-width="1.6"/>' +
      '<path d="M26.5 22.5 L33 16" stroke="#0F766E" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M24 25.5 L28.5 21 L31.5 26 L27 30.5 Z" fill="#34D399" stroke="#0F766E" stroke-width="1.2" stroke-linejoin="round"/>'),

    // ---- Excel 軽量化：表＋羽根 ----
    excelLight: wrap('#E8F5E9',
      '<rect x="7" y="9" width="15" height="21" rx="3" fill="#217346"/>' +
      '<path d="M7 15h15M12 9v21" stroke="#E8F5E9" stroke-width="1.5"/>' +
      '<path d="M24 28 C25.5 20 30 14 34 12 C33.5 18 31 25 25.5 29 Z" fill="#A7F3D0" stroke="#0F766E" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M25 28.6 L33.4 13.6" stroke="#0F766E" stroke-width="1.1"/>'),

    // ---- Excel 比較：2 枚の表と矢印 ----
    excelCompare: wrap('#E8F5E9',
      '<rect x="5.5" y="9" width="12.5" height="17" rx="2.5" fill="#217346" opacity=".95"/>' +
      '<rect x="22" y="14" width="12.5" height="17" rx="2.5" fill="#34A853" opacity=".95"/>' +
      '<path d="M7.5 14h8.5M7.5 18.5h6" stroke="#E8F5E9" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M24 19h8.5M24 23.5h6" stroke="#F1F8F3" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M18.5 12.5 L21.5 16 L18.5 19.5" fill="none" stroke="#0B5D2E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),

    // ---- 画像比較：2 枚の写真 ----
    image: wrap('#7C2D12',
      '<rect x="5.5" y="10" width="13" height="16" rx="2.5" fill="#FFF7ED" opacity=".96"/>' +
      '<rect x="21.5" y="14" width="13" height="16" rx="2.5" fill="#FED7AA"/>' +
      '<circle cx="10" cy="15.5" r="1.7" fill="#F59E0B"/>' +
      '<path d="M6 24 L10.5 19 L14 22.5 L18 18.5 L18 26 L6 26 Z" fill="#EA580C" opacity=".85"/>' +
      '<circle cx="26" cy="19.5" r="1.7" fill="#B45309"/>' +
      '<path d="M22 28 L26.5 23 L30 26.5 L34 22.5 L34 30 L22 30 Z" fill="#C2410C" opacity=".7"/>'),

    // ---- 読売 アップロード：新聞＋上矢印 ----
    yomiuriUpload: wrap('#FFFFFF',
      '<rect x="6" y="12" width="19" height="17" rx="2" fill="#E5E7EB" stroke="#111827" stroke-width="1.4"/>' +
      '<rect x="9" y="15.5" width="8" height="4.2" rx="1" fill="#E60012"/>' +
      '<path d="M9 22.5h13M9 25.5h9" stroke="#374151" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="29" cy="15" r="8" fill="#E60012"/>' +
      '<path d="M29 11 L29 19 M26 14 L29 11 L32 14" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      '<rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="#E2E8F0"/>'),

    // ---- 読売 ルール管理：クリップボード＋歯車 ----
    yomiuriRules: wrap('#FEF2F2',
      '<rect x="8" y="8" width="17" height="24" rx="2.5" fill="#ffffff" stroke="#E60012" stroke-width="1.6"/>' +
      '<rect x="12" y="5.5" width="9" height="5" rx="1.6" fill="#E60012"/>' +
      '<path d="M12 15h9M12 19h6" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="27" cy="25" r="5.4" fill="#111827"/>' +
      '<circle cx="27" cy="25" r="2" fill="#FEF2F2"/>' +
      '<path d="M27 17.4v2.1M27 30.5v2.1M19.4 25h2.1M32.5 25h2.1" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/>'),

    // ---- 原稿配列：セルを整列 ----
    manuscript: wrap('#D9822B',
      '<rect x="7" y="8" width="9" height="5" rx="1.4" fill="#ffffff" opacity=".95"/>' +
      '<rect x="7" y="15.5" width="9" height="5" rx="1.4" fill="#ffffff" opacity=".8"/>' +
      '<rect x="7" y="23" width="9" height="5" rx="1.4" fill="#ffffff" opacity=".62"/>' +
      '<path d="M19 14.5h5.5M19 22h5.5" stroke="#FFE8CC" stroke-width="1.8" stroke-linecap="round"/>' +
      '<rect x="25.5" y="8" width="8" height="20" rx="1.6" fill="none" stroke="#ffffff" stroke-width="1.8"/>' +
      '<path d="M27.5 13h4M27.5 18h4M27.5 23h4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>'),

    // ---- 地域表記変換：地図ピン ----
    region: wrap('#128E77',
      '<path d="M8 12.5 L15 9.5 L15 28.5 L8 31.5 Z" fill="#ffffff" opacity=".28"/>' +
      '<path d="M15 9.5 L23 13 L23 31.5 L15 28.5 Z" fill="#ffffff" opacity=".18"/>' +
      '<path d="M23 13 L31 10 L31 28 L23 31.5 Z" fill="#ffffff" opacity=".1"/>' +
      '<path d="M20 10c-4 0-7 3-7 6.8 0 4.9 7 11.2 7 11.2s7-6.3 7-11.2C27 13 24 10 20 10z" fill="#ffffff"/>' +
      '<circle cx="20" cy="16.8" r="2.6" fill="#128E77"/>'),

    // ---- ターゲット推薦：ブルズアイ ----
    target: wrap('#9F1239',
      '<circle cx="20" cy="20" r="12.5" fill="none" stroke="#ffffff" stroke-width="2.2" opacity=".55"/>' +
      '<circle cx="20" cy="20" r="8" fill="none" stroke="#ffffff" stroke-width="2.2" opacity=".8"/>' +
      '<circle cx="20" cy="20" r="3.6" fill="#FB7185"/>' +
      '<path d="M20 20 L32 8" stroke="#FDE68A" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M28.5 6.5 L33.5 6.5 L33.5 11.5" fill="none" stroke="#FDE68A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),

    // ---- TVer：テレビ画面＋再生 ----
    tver: wrap('#0F2B46',
      '<rect x="6" y="10" width="28" height="19" rx="3" fill="#12395C" stroke="#38BDF8" stroke-width="1.6"/>' +
      '<path d="M14 6.5 L20 10 L26 6.5" fill="none" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M17.5 15.5 L25.5 19.5 L17.5 23.5 Z" fill="#38BDF8"/>' +
      '<path d="M14 33h12" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/>'),

    // ---- 3課チェック：虫眼鏡＋チェック ----
    check3: wrap('#7E3DA2',
      '<circle cx="17.5" cy="17.5" r="8.6" fill="none" stroke="#ffffff" stroke-width="2.6"/>' +
      '<path d="M24 24 L31 31" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M13.6 17.4 L16.6 20.4 L21.6 14.8" fill="none" stroke="#F0ABFC" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),

    // ---- 定例会報告書：グラフ付きドキュメント ----
    report: wrap('#1A252F',
      '<rect x="8.5" y="6" width="23" height="28" rx="2.6" fill="#ffffff" opacity=".96"/>' +
      '<rect x="12" y="9.5" width="10" height="2.6" rx="1.3" fill="#94A3B8"/>' +
      '<rect x="12" y="22" width="3.2" height="7" rx="1" fill="#6366F1"/>' +
      '<rect x="17.4" y="18" width="3.2" height="11" rx="1" fill="#6366F1"/>' +
      '<rect x="22.8" y="15" width="3.2" height="14" rx="1" fill="#6366F1"/>' +
      '<path d="M12 14.5h15" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round"/>'),

    // ---- 工具使用状況管理：棒グラフ＋上昇矢印 ----
    usage: wrap('#475569',
      '<rect x="8" y="22" width="4.6" height="10" rx="1.4" fill="#E2E8F0"/>' +
      '<rect x="15.2" y="17" width="4.6" height="15" rx="1.4" fill="#CBD5E1"/>' +
      '<rect x="22.4" y="11.5" width="4.6" height="20.5" rx="1.4" fill="#94A3B8"/>' +
      '<rect x="29.6" y="20" width="4.6" height="12" rx="1.4" fill="#E2E8F0"/>' +
      '<path d="M9 16 L17 10 L23 13 L31 6.5" fill="none" stroke="#38BDF8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M27.5 6 L31.2 6.2 L31 10" fill="none" stroke="#38BDF8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),

    // ---- 準備中／未開通：箱 ----
    soon: wrap('#E2E8F0',
      '<path d="M20 8 L32 14 L20 20 L8 14 Z" fill="#CBD5E1"/>' +
      '<path d="M8 14 L20 20 L20 32 L8 26 Z" fill="#94A3B8"/>' +
      '<path d="M32 14 L20 20 L20 32 L32 26 Z" fill="#B9C4CF"/>'),

    // ---- 汎用（未定義 id 用） ----
    generic: wrap('#334155',
      '<rect x="9" y="9" width="9" height="9" rx="2" fill="#94A3B8"/>' +
      '<rect x="22" y="9" width="9" height="9" rx="2" fill="#CBD5E1"/>' +
      '<rect x="9" y="22" width="9" height="9" rx="2" fill="#CBD5E1"/>' +
      '<rect x="22" y="22" width="9" height="9" rx="2" fill="#94A3B8"/>'),
  };

  function toolLogoSVG(id) {
    return TOOL_LOGOS[id] || TOOL_LOGOS.generic;
  }

  if (global) {
    global.TOOL_LOGOS = TOOL_LOGOS;
    global.toolLogoSVG = toolLogoSVG;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TOOL_LOGOS: TOOL_LOGOS, toolLogoSVG: toolLogoSVG };
  }
})(typeof window !== 'undefined' ? window : null);
