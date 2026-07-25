/**
 * qc-i18n.js — QC Portal 国际化框架
 * 
 * 【开发规范】
 * 1. 新增用户可见文案时必须同时追加中文和日文到 QC_I18N 字典。
 * 2. HTML静态文案使用 data-i18n="key" 属性。
 * 3. JS动态文案使用 t(key, params) 函数。
 * 4. 不允许直接在业务逻辑中散落中日文字符串。
 * 5. Sheet名、文件名、用户输入和后台原始值不得翻译。
 * 6. 缺少翻译时回退到中文，并在 console.warn 提示 key。
 * 7. 支持变量替换: t('selectedSheets', { selected: 3, total: 40 })
 * 
 * 使用方式:
 *   <span data-i18n="portalTitle">惠海 QC 门户</span>
 *   <input data-i18n-placeholder="emailPlaceholder">
 *   <div data-i18n-html="safetyHtml">...</div>
 *   JS: t('key'), t('key', {var: value})
 */
'use strict';

var QC_I18N = {
  'zh-CN': {
    // === 共通 ===
    portalTitle: '🛠️ 惠海 QC 门户',
    logout: '退出',
    commonTools: '共通工具',
    recentUpdates: '📢 近期更新',
    viewAllUpdates: '查看全部更新 →',
    updateModalTitle: '📋 更新履历',
    updateNew: '🆕 新功能',
    updateAdd: '➕ 功能追加',
    updateImprove: '🔧 改善',
    updateFix: '🐛 修复',
    updateGroupNew: '新功能',
    updateGroupAdd: '功能追加',
    updateGroupFix: '改善・修复',
    preparing: '准备中',
    managerOnly: '管理者专用',
    backHome: '← 返回主页',
    backNav: '← 返回导航页',
    localOnly: '🔒 完全本地处理',

    // === index 卡片 ===
    textCompareTitle: '文本对比工具',
    textCompareDesc: '逐行比较・包含关系・符号检查，支持完全一致行颜色区分和重复位置快速定位',
    excelCleanTitle: 'Excel清洗',
    excelCleanDesc: '清除多余数据・整形',
    excelLightTitle: 'Excel文件轻量化',
    excelLightDesc: '清理无效公式尾部，可选公式值化，提升大型文件的打开和处理速度',
    excelCompareTitle: 'Excel对比',
    excelCompareDesc: '两个文件的差异检查',
    imageCompareTitle: '图片对比',
    imageCompareDesc: '图片并排比较',

    // === index 课室 ===
    ka1Title: '广告设定检查・入稿',
    ka2Title: '2课 工具',
    ka3Title: '3课 工具',
    ka4Title: '4课 工具',
    ka5Title: '5课 工具',
    ka6Title: '6课 工具',
    reportTitle: '定例会报告书',

    // === index 登录 ===
    login: '登录',
    register: '注册',
    emailPlaceholder: '公司邮箱',
    passwordPlaceholder: '密码',
    loginBtn: '登 录',
    forgotPassword: '忘记密码？',
    verifying: '⏳ 正在验证...',
    verifyingBtn: '验证中...',
    loginSuccess: '登录成功！',
    loginFail: '登录失败',
    userNameLabel: '姓名',
    deptPlaceholder: '选择课室（可选）',
    regPwdPlaceholder: '设置密码（4位以上）',
    sendCode: '发送验证码',
    regHint: '仅限公司邮箱注册（@hakuhodody-one / @dac / @adpro-inc / @huihai-info）',
    codeInputPlaceholder: '请输入6位验证码',
    verifyAndRegister: '验证并注册',
    resendCode: '← 重新发送验证码',

    // === Excel轻量化 (cleaner) ===
    cleanerTitle: '📊 Excel文件轻量化',
    cleanerBadge: '🔒 完全本地处理 | ZIP/XML v4.1',
    cleanerSubDesc: '清理无效公式尾部，生成轻量版Excel。原文件不修改。',
    cleanerStep1: '无效尾部检测',
    cleanerStep2: '公式处理设置',
    cleanerStep3: '生成并下载',
    cleanerSafetyTitle: '🛡️ 安全说明',
    cleanerSafety1: '文件只在浏览器本地处理，不上传服务器。',
    cleanerSafety2: '原文件不会被修改或覆盖，工具生成新文件。',
    cleanerSafety3: '使用ZIP/XML级直接处理，不解析全部单元格到内存。',
    cleanerSafety4: '输出文件用于校正、确认和归档。如需追加数据请使用原文件。',
    cleanerUploadDrop: '拖拽Excel文件到此处',
    cleanerUploadSub: '或点击选择文件（仅支持 .xlsx）',
    cleanerDetecting: '正在检测...',
    cleanerGenerating: '正在生成轻量版...',
    cleanerGenerateBtn: '🚀 生成轻量化文件',
    cleanerDownloadBtn: '⬇️ 下载轻量化文件',
    cleanerCancelBtn: '取消',
    cleanerSheetName: 'Sheet名',
    cleanerCurrentEnd: '当前末行',
    cleanerRealEnd: '真实数据末行',
    cleanerRemoveRows: '可删除行数',
    cleanerTailFormulas: '尾部公式数',
    cleanerJudgment: '判定',
    cleanerAction: '操作',
    cleanerDetail: '详情',
    cleanerSafe: '安全可清理',
    cleanerManual: '建议人工确认',
    cleanerNone: '不自动处理',
    cleanerFormulaKeep: '保留公式',
    cleanerFormulaAll: '全部值化',
    cleanerFormulaSelect: '指定Sheet值化',
    cleanerConfirmTitle: '确认生成',
    cleanerConfirmMsg: '即将生成轻量化文件，是否继续？',
    cleanerConfirmYes: '确认生成',
    cleanerConfirmNo: '取消',
    cleanerError: '处理失败',
    cleanerSelectAll: '全选',
    cleanerDetectComplete: '检测完成',
    cleanerEstTime: '预计时间',
    cleanerElapsed: '已用时间',
    cleanerTimeout60: '处理时间较长，请耐心等待...',
    cleanerTimeout120: '文件较大，处理仍在进行中...',
    cleanerTimeout300: '处理时间异常，建议检查文件是否过大或浏览器内存不足。',
    cleanerFooter: 'Excel文件轻量化 v4.1 ZIP/XML | JSZip 3.10.1 | 全部在浏览器内完成',

    // === Excel对比 (compare) ===
    compareTitle: '📊 Excel对比',
    compareBadge: '🔒 完全本地运行',
    compareSubDesc: '对比两个Excel文件的差异',
    compareModeLabel: '对比模式：',
    compareModeExcel: '📊 Excel对比',
    compareModeZip: '🗜️ ZIP包对比',
    compareModeFast: '⚡ 大文件高速模式',
    compareFastIndicator: '⚡ 高速模式',
    compareFileA: '文件A',
    compareFileB: '文件B',
    compareStart: '📊 开始对比',
    compareCancel: '⏹ 取消',
    compareDiffContent: '内容差异',
    compareDiffBgColor: '背景颜色',
    compareDiffFontColor: '字体颜色',
    compareDiffFormula: '公式',
    compareDiffTextbox: '文本框',
    compareProcessing: '正在处理...',
    compareComplete: '比较完成',
    compareNoDiff: '未发现差异',
    compareError: '处理出错',
    compareLargeFileWarn: '浏览器处理上限可能超出。（文件超过300MB）',
    compareFastSuggestTitle: '⚡ 检测到大容量文件',
    compareFastSuggestDesc: '高速模式下仅比较选择的Sheet，差异以简易列表显示。',
    compareFastEnable: '⚡ 启用高速模式',
    compareFastDismiss: '继续使用标准模式',
    compareSelectSheets: '选择要比较的Sheet',
    compareSelectedSheets: '已选择 {selected} / {total} 个Sheet',
    compareFileALabel: '📊 文件 A（旧版本／原版）',
    compareFileBLabel: '📊 文件 B（新版本／对照）',
    compareDropA: '拖入 Excel 文件 A',
    compareDropB: '拖入 Excel 文件 B',
    compareDropSupport: '支持 .xlsx / .xls / .xlsm / .xlsb',
    compareReset: '🗑️ 重新选择',
    compareBgColorOpt: '🎨 背景颜色',
    compareFontColorOpt: '🔤 字体颜色',
    compareColorNote: '⚠ 条件格式颜色可能无法识别',
    compareExport: '💾 导出HTML报告',
    compareHideEq: '🙈 隐藏相同行',
    compareShowAll: '👁️ 显示全部行',
    compareSheetTitle: '📋 选择要对比的 Sheet',
    compareSelectAll: '全选',
    compareDeselectAll: '全不选',
    compareStandardStart: '▶ 开始通常比较',
    compareFastStart: '⚡ 开始高速比较',
    compareViewLabel: '视图：',
    compareViewCell: '📊 单元格',
    compareViewBgColor: '🎨 背景颜色',
    compareViewFontColor: '🔤 字体颜色',
    compareViewFormula: '🔢 公式',
    compareViewTextbox: '📝 文本框',
    compareReading: '⏳ 正在读取...',
    compareCancelled: '⚠️ 已取消比较 — 以下结果为<b>不完整</b>',
    compareFastCtrlInfo: '请选择要对比的Sheet',
    compareOversizeRecommend: '强烈建议使用大文件高速模式。',
  },

  'ja-JP': {
    // === 共通 ===
    portalTitle: '🛠️ 恵海 QC ポータル',
    logout: 'ログアウト',
    commonTools: '共通ツール',
    recentUpdates: '📢 最近の更新',
    viewAllUpdates: 'すべての更新を見る →',
    updateModalTitle: '📋 更新履歴',
    updateNew: '🆕 新機能',
    updateAdd: '➕ 機能追加',
    updateImprove: '🔧 改善',
    updateFix: '🐛 修正',
    updateGroupNew: '新機能',
    updateGroupAdd: '機能追加',
    updateGroupFix: '改善・修正',
    preparing: '準備中',
    managerOnly: '管理者専用',
    backHome: '← メインページに戻る',
    backNav: '← ナビゲーションに戻る',
    localOnly: '🔒 完全ローカル処理',

    // === index 卡片 ===
    textCompareTitle: 'テキスト比較ツール',
    textCompareDesc: '行単位比較・包含関係・記号チェック、完全一致行の色分けと重複位置への快速定位に対応',
    excelCleanTitle: 'Excel クリーニング',
    excelCleanDesc: '不要データの除去・整形',
    excelLightTitle: 'Excelファイル軽量化',
    excelLightDesc: '不要な数式末尾を整理し、数式の値化によって大容量ファイルを軽量化',
    excelCompareTitle: 'Excel 比較',
    excelCompareDesc: '2ファイルの差分チェック',
    imageCompareTitle: '画像比較',
    imageCompareDesc: '画像の並べて比較',

    // === index 课室 ===
    ka1Title: '広告設定チェック・入稿',
    ka2Title: '2課 ツール',
    ka3Title: '3課 ツール',
    ka4Title: '4課 ツール',
    ka5Title: '5課 ツール',
    ka6Title: '6課 ツール',
    reportTitle: '定例会報告書',

    // === index 登录 ===
    login: 'ログイン',
    register: '新規登録',
    emailPlaceholder: '社用メールアドレス',
    passwordPlaceholder: 'パスワード',
    loginBtn: 'ログイン',
    forgotPassword: 'パスワードをお忘れですか？',
    verifying: '⏳ 認証中...',
    verifyingBtn: '認証中...',
    loginSuccess: 'ログイン成功！',
    loginFail: 'ログイン失敗',
    userNameLabel: '氏名',
    deptPlaceholder: '課室を選択（任意）',
    regPwdPlaceholder: 'パスワード設定（4文字以上）',
    sendCode: '認証コード送信',
    regHint: '社用メールアドレスのみ登録可能（@hakuhodody-one / @dac / @adpro-inc / @huihai-info）',
    codeInputPlaceholder: '6桁の認証コードを入力',
    verifyAndRegister: '認証して登録',
    resendCode: '← 認証コードを再送信',

    // === Excel轻量化 (cleaner) ===
    cleanerTitle: '📊 Excelファイル軽量化',
    cleanerBadge: '🔒 完全ローカル処理 | ZIP/XML v4.1',
    cleanerSubDesc: '不要な数式末尾を整理し、軽量化版Excelを生成。元ファイルは変更しません。',
    cleanerStep1: '不要末尾検出',
    cleanerStep2: '数式処理設定',
    cleanerStep3: '生成・ダウンロード',
    cleanerSafetyTitle: '🛡️ セキュリティ説明',
    cleanerSafety1: 'ファイルはブラウザ内でローカル処理され、サーバーへのアップロードはありません。',
    cleanerSafety2: '元ファイルは変更・上書きされず、ツールは新しいファイルを生成します。',
    cleanerSafety3: 'ZIP/XMLレベルで直接処理し、全セルをメモリに展開しません。',
    cleanerSafety4: '出力ファイルは校正・確認・保管用です。データ追加は元ファイルを使用してください。',
    cleanerUploadDrop: 'Excelファイルをここにドラッグ',
    cleanerUploadSub: 'またはクリックしてファイルを選択（.xlsxのみ対応）',
    cleanerDetecting: '検出中...',
    cleanerGenerating: '軽量化版を生成中...',
    cleanerGenerateBtn: '🚀 軽量化ファイルを生成',
    cleanerDownloadBtn: '⬇️ 軽量化ファイルをダウンロード',
    cleanerCancelBtn: 'キャンセル',
    cleanerSheetName: 'Sheet名',
    cleanerCurrentEnd: '現在の最終行',
    cleanerRealEnd: '実データ最終行',
    cleanerRemoveRows: '削除可能行数',
    cleanerTailFormulas: '末尾数式数',
    cleanerJudgment: '判定',
    cleanerAction: '操作',
    cleanerDetail: '詳細',
    cleanerSafe: '安全に清理可能',
    cleanerManual: '手動確認推奨',
    cleanerNone: '自動処理なし',
    cleanerFormulaKeep: '数式を保持',
    cleanerFormulaAll: 'すべて値化',
    cleanerFormulaSelect: 'Sheet指定で値化',
    cleanerConfirmTitle: '生成確認',
    cleanerConfirmMsg: '軽量化ファイルを生成します。続行しますか？',
    cleanerConfirmYes: '生成する',
    cleanerConfirmNo: 'キャンセル',
    cleanerError: '処理失敗',
    cleanerSelectAll: '全選択',
    cleanerDetectComplete: '検出完了',
    cleanerEstTime: '予想時間',
    cleanerElapsed: '経過時間',
    cleanerTimeout60: '処理に時間がかかっています。お待ちください...',
    cleanerTimeout120: 'ファイルが大きいため、処理を続行中です...',
    cleanerTimeout300: '処理時間が異常です。ファイルが大きすぎるかブラウザのメモリ不足の可能性があります。',
    cleanerFooter: 'Excelファイル軽量化 v4.1 ZIP/XML | JSZip 3.10.1 | すべてブラウザ内で完了',

    // === Excel对比 (compare) ===
    compareTitle: '📊 Excel比較',
    compareBadge: '🔒 完全ローカル実行',
    compareSubDesc: '2つのExcelファイルの差分を比較',
    compareModeLabel: '比較モード：',
    compareModeExcel: '📊 Excel比較',
    compareModeZip: '🗜️ ZIPパッケージ比較',
    compareModeFast: '⚡ 大容量ファイル高速モード',
    compareFastIndicator: '⚡ 高速モード',
    compareFileA: 'ファイルA',
    compareFileB: 'ファイルB',
    compareStart: '📊 比較開始',
    compareCancel: '⏹ キャンセル',
    compareDiffContent: '内容差分',
    compareDiffBgColor: '背景色',
    compareDiffFontColor: '文字色',
    compareDiffFormula: '数式',
    compareDiffTextbox: 'テキストボックス',
    compareProcessing: '処理中...',
    compareComplete: '比較完了',
    compareNoDiff: '差分は見つかりませんでした',
    compareError: '処理エラー',
    compareLargeFileWarn: 'ブラウザの処理上限を超える可能性があります。（ファイルが300MBを超えています）',
    compareFastSuggestTitle: '⚡ 大容量ファイルを検出しました',
    compareFastSuggestDesc: '高速モードでは選択したSheetのみを比較し、差異一覧を簡易表示します。',
    compareFastEnable: '⚡ 高速モードを有効にする',
    compareFastDismiss: '標準モードを続行',
    compareSelectSheets: '比較するSheetを選択',
    compareSelectedSheets: '{selected} / {total} Sheetを選択中',
    compareFileALabel: '📊 ファイル A（旧バージョン／原版）',
    compareFileBLabel: '📊 ファイル B（新バージョン／対照）',
    compareDropA: 'Excel ファイル A をドロップ',
    compareDropB: 'Excel ファイル B をドロップ',
    compareDropSupport: '.xlsx / .xls / .xlsm / .xlsb 対応',
    compareReset: '🗑️ 再選択',
    compareBgColorOpt: '🎨 背景色',
    compareFontColorOpt: '🔤 文字色',
    compareColorNote: '⚠ 条件付き書式の色は識別できない場合があります',
    compareExport: '💾 HTMLレポート出力',
    compareHideEq: '🙈 同一行を非表示',
    compareShowAll: '👁️ すべての行を表示',
    compareSheetTitle: '📋 比較するSheetを選択',
    compareSelectAll: '全選択',
    compareDeselectAll: '全解除',
    compareStandardStart: '▶ 通常比較を開始',
    compareFastStart: '⚡ 高速比較を開始',
    compareViewLabel: 'ビュー：',
    compareViewCell: '📊 セル',
    compareViewBgColor: '🎨 背景色',
    compareViewFontColor: '🔤 文字色',
    compareViewFormula: '🔢 数式',
    compareViewTextbox: '📝 テキストボックス',
    compareReading: '⏳ 読み込み中...',
    compareCancelled: '⚠️ 比較をキャンセルしました — 以下の結果は<b>不完全</b>です',
    compareFastCtrlInfo: '比較するSheetを選択してください',
    compareOversizeRecommend: '大容量ファイル高速モードのご利用を強く推奨します。',
  }
};

// ========== 核心函数 ==========

function getLanguage() {
  try {
    var lang = localStorage.getItem('qc_language');
    if (lang === 'ja-JP' || lang === 'zh-CN') return lang;
  } catch (e) { /* localStorage不可用 */ }
  return 'zh-CN';
}

function setLanguage(lang) {
  if (lang !== 'zh-CN' && lang !== 'ja-JP') lang = 'zh-CN';
  try { localStorage.setItem('qc_language', lang); } catch (e) {}
  applyI18n();
  // 更新语言切换按钮高亮
  updateLangSwitchUI();
}

function t(key, params) {
  var lang = getLanguage();
  var dict = QC_I18N[lang] || QC_I18N['zh-CN'];
  var text = dict[key];
  if (text === undefined) {
    // 回退到中文
    text = QC_I18N['zh-CN'][key];
    if (text === undefined) {
      console.warn('[i18n] Missing key: ' + key);
      return key;
    }
    if (lang !== 'zh-CN') console.warn('[i18n] Missing "' + lang + '" for key: ' + key + ', fallback to zh-CN');
  }
  // 变量替换
  if (params) {
    for (var k in params) {
      if (params.hasOwnProperty(k)) {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      }
    }
  }
  return text;
}

function applyI18n() {
  // 设置页面 lang 属性
  var currentLang = getLanguage();
  document.documentElement.lang = (currentLang === 'ja-JP') ? 'ja' : 'zh-CN';
  // data-i18n → textContent
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    els[i].textContent = t(els[i].getAttribute('data-i18n'));
  }
  // data-i18n-html → innerHTML
  var htmlEls = document.querySelectorAll('[data-i18n-html]');
  for (var j = 0; j < htmlEls.length; j++) {
    htmlEls[j].innerHTML = t(htmlEls[j].getAttribute('data-i18n-html'));
  }
  // data-i18n-placeholder → placeholder
  var phEls = document.querySelectorAll('[data-i18n-placeholder]');
  for (var k = 0; k < phEls.length; k++) {
    phEls[k].placeholder = t(phEls[k].getAttribute('data-i18n-placeholder'));
  }
  // 更新页面title
  var pageTitle = document.querySelector('[data-i18n-title]');
  if (pageTitle) document.title = t(pageTitle.getAttribute('data-i18n-title'));
  updateLangSwitchUI();
}

function updateLangSwitchUI() {
  var lang = getLanguage();
  var zh = document.getElementById('langZh');
  var ja = document.getElementById('langJa');
  if (zh) zh.style.fontWeight = (lang === 'zh-CN') ? '900' : '400';
  if (ja) ja.style.fontWeight = (lang === 'ja-JP') ? '900' : '400';
  if (zh) zh.style.opacity = (lang === 'zh-CN') ? '1' : '0.6';
  if (ja) ja.style.opacity = (lang === 'ja-JP') ? '1' : '0.6';
}

/**
 * initLanguageState() — 轻量初始化，适用于尚未完整翻译的页面。
 * 只负责：读取当前语言 → 设置 document.documentElement.lang → 应用已有 data-i18n。
 * 不改变业务逻辑，不显示语言切换按钮。
 * 用法：
 *   <script src="qc-i18n.js"></script>
 *   <script>if (typeof initLanguageState === 'function') initLanguageState();</script>
 */
function initLanguageState() {
  var lang = getLanguage();
  document.documentElement.lang = (lang === 'ja-JP') ? 'ja' : 'zh-CN';
  applyI18n();
}
