// ============================================================
// 惠海 QC ポータル - 用户认证 & 使用日志 API
// Sheet ID: 1GlYrGBSwztn6dr3d70XzXiLcoBF7H9VELnWOAs5Nd5Y
// Sheets: users / logs / pending
// ============================================================

const SHEET_ID = '1GlYrGBSwztn6dr3d70XzXiLcoBF7H9VELnWOAs5Nd5Y';
const SECRET = 'huihai_qc_2026_secret_key';
const TOKEN_EXPIRY_HOURS = 8;

// 允许注册的邮箱尾缀（白名单）
const ALLOWED_DOMAINS = ['@hakuhodody-one.co.jp', '@dac.co.jp', '@adpro-inc.co.jp', '@huihai-info.com'];
const CODE_EXPIRY_MINUTES = 10; // 验证码有效期

// ==================== doPost 路由 ====================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'sendCode':
        return handleSendCode(data);
      case 'verify':
        return handleVerify(data);
      case 'login':
        return handleLogin(data);
      case 'log':
        return handleLog(data);
      default:
        return json({ ok: false, error: '未知操作' });
    }
  } catch (err) {
    return json({ ok: false, error: err.toString() });
  }
}

// ==================== 1. 发送验证码 ====================

function handleSendCode(data) {
  const { email, name, password, department } = data;
  if (!email || !name || !password) {
    return json({ ok: false, error: '邮箱、姓名、密码为必填项' });
  }

  // 检查邮箱尾缀
  const allowed = ALLOWED_DOMAINS.some(d => email.toLowerCase().endsWith(d));
  if (!allowed) {
    return json({ ok: false, error: '仅限公司邮箱注册（' + ALLOWED_DOMAINS.join(' / ') + '）' });
  }

  // 检查是否已注册
  const usersSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('users');
  const usersData = usersSheet.getDataRange().getValues();
  for (let i = 0; i < usersData.length; i++) {
    if (usersData[i][0] === email) {
      return json({ ok: false, error: '该邮箱已注册' });
    }
  }

  // 生成6位验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = sha256(password + email);

  // 存入 pending sheet（清除该邮箱旧记录）
  const pendingSheet = getOrCreateSheet('pending');
  removePendingByEmail(pendingSheet, email);
  const expiry = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
  pendingSheet.appendRow([email, code, name, hash, department || '', jstNow(), expiry.toISOString()]);

  // 发送验证码邮件
  try {
    GmailApp.sendEmail(email,
      '【惠海QCポータル】メール認証コード / 邮箱验证码',
      name + ' 様\n\n' +
      '惠海QCポータルへのご登録ありがとうございます。\n' +
      '下記の認証コードを登録画面に入力してください。\n\n' +
      '■ 認証コード：' + code + '\n' +
      '■ 有効期限：' + CODE_EXPIRY_MINUTES + '分間\n\n' +
      '※このメールに心当たりがない場合は、そのまま削除してください。\n\n' +
      '---\n' +
      '惠海QCポータル システム管理者'
    );
  } catch (mailErr) {
    return json({ ok: false, error: '验证码邮件发送失败: ' + mailErr.toString() });
  }

  return json({ ok: true, message: '验证码已发送至 ' + email + '，有效期' + CODE_EXPIRY_MINUTES + '分钟' });
}

// ==================== 2. 验证码确认 + 注册 ====================

function handleVerify(data) {
  const { email, code } = data;
  if (!email || !code) {
    return json({ ok: false, error: '邮箱和验证码为必填项' });
  }

  const pendingSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('pending');
  if (!pendingSheet) return json({ ok: false, error: '验证码已过期，请重新获取' });

  const rows = pendingSheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === email) {
      // 检查过期
      if (new Date(rows[i][6]) < new Date()) {
        pendingSheet.deleteRow(i + 1);
        return json({ ok: false, error: '验证码已过期，请重新获取' });
      }
      // 检查验证码（Sheet可能把纯数字转成number，统一转string比较）
      if (String(rows[i][1]) !== String(code)) {
        return json({ ok: false, error: '验证码错误' });
      }

      // 验证成功，完成注册
      const name = rows[i][2];
      const hash = rows[i][3];
      const dept = rows[i][4];
      const usersSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('users');
      usersSheet.appendRow([email, name, hash, dept || '', jstNow(), '担当']);

      // 删除pending记录
      pendingSheet.deleteRow(i + 1);
      return json({ ok: true, message: '注册成功！请登录。' });
    }
  }
  return json({ ok: false, error: '未找到验证请求，请重新获取验证码' });
}

// ==================== 登录 ====================

function handleLogin(data) {
  const { email, password } = data;
  if (!email || !password) {
    return json({ ok: false, error: '邮箱和密码为必填项' });
  }

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('users');
  const rows = sheet.getDataRange().getValues();
  const hash = sha256(password + email);

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === email && rows[i][2] === hash) {
      const token = generateToken(email);
      return json({
        ok: true,
        token: token,
        user: {
          email: rows[i][0],
          name: rows[i][1],
          department: rows[i][3] || '',
          position: rows[i][5] || '担当'
        }
      });
    }
  }
  return json({ ok: false, error: '邮箱或密码错误' });
}

// ==================== 使用日志 ====================

function handleLog(data) {
  const { token, tool, diffCount, criticalCount, note } = data;
  if (!token) return json({ ok: false, error: '未授权' });

  const user = verifyToken(token);
  if (!user) return json({ ok: false, error: 'Token无效或已过期' });

  const nowJST = new Date();
  const ts = Utilities.formatDate(nowJST, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const yyyy = Utilities.formatDate(nowJST, 'Asia/Tokyo', 'yyyy');
  const mm = Utilities.formatDate(nowJST, 'Asia/Tokyo', 'MM');
  const monthLabel = yyyy + '年' + mm + '月';

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('logs');
  sheet.appendRow([
    ts,                    // A: 时间 2026/06/30 12:36:01
    user.email,            // B: 邮箱
    user.name,             // C: 姓名
    user.dept || '',       // D: 课室
    tool || '',            // E: 工具名
    diffCount || 0,        // F: 差異数量
    criticalCount || 0,    // G: 差異数
    note || '',            // H: 備考
    monthLabel             // I: 月統計
  ]);
  return json({ ok: true });
}

// ==================== Token 工具 ====================

function generateToken(email) {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + TOKEN_EXPIRY_HOURS);
  const payload = email + '|' + expiry.getTime() + '|' + SECRET;
  const sig = sha256(payload);
  // token = base64(email|expiry|sig)
  return Utilities.base64Encode(Utilities.newBlob(email + '|' + expiry.getTime() + '|' + sig).getBytes());
}

function verifyToken(token) {
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = decoded.split('|');
    if (parts.length !== 3) return null;
    const email = parts[0];
    const expiry = parseInt(parts[1]);
    const sig = parts[2];

    if (Date.now() > expiry) return null; // 过期

    const expected = sha256(email + '|' + expiry + '|' + SECRET);
    if (sig !== expected) return null;

    // 从 users 表查姓名
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('users');
    const rows = sheet.getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === email) {
        return { email: email, name: rows[i][1], dept: rows[i][3] || '', position: rows[i][5] || '担当' };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ==================== 工具函数 ====================

function jstNow() {
  // 返回日本时间 ISO 字符串 (UTC+9)
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd\'T\'HH:mm:ss.SSS+09:00');
}

function sha256(input) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== CORS 预检 ====================
function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ==================== Pending 辅助 ====================

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(['email','code','name','password_hash','department','requested_at','expiry']);
  }
  return sheet;
}

function removePendingByEmail(sheet, email) {
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === email) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ==================== 允许跨域 ====================

function doGet(e) {
  return json({ ok: true, message: '惠海QC API is running' });
}

// ============================================================
// 使用日志汇总 — rebuildSummary()
// 从 logs 原始明细生成 summary 汇总表
// ============================================================

const SUMMARY_HEADERS = [
  '集計日',       // A: 2026/07/09
  '対象月',       // B: 2026年07月
  'メール',       // C: user@mail.com
  '氏名',         // D: 山田太郎
  '課室',         // E: 第一クリエイティブ課
  'ツール名',     // F: DV360设定检查
  '実行回数',     // G: logs 表该组总条数
  '有効利用回数', // H: 15 分钟内重复只算 1 次
  '差異件数合計', // I: diffCount 字段合计
  '初回利用時間', // J: 该组最早一条的时间
  '最終利用時間', // K: 该组最后一条的时间
  '備考',         // L: 预留
];

// ツール名の日本語表示マッピング（summary 表のみ適用、logs 原始データ不変）
const TOOL_NAME_JA = {
  'DV360设定检查':             'DV360設定チェック',
  'AmazonDSP设定检查':         'Amazon DSP設定チェック',
  'AmazonDSP設定検査':         'Amazon DSP設定チェック',
  'Amazon DSP設定チェック':    'Amazon DSP設定チェック',
  'Excel对比':                 'Excel比較',
  'Excel清洗':                 'Excelクレンジング',
  '読売 符号检查':             '読売 記号チェック',
  '読売 图片解析':             '読売 画像解析',
  '読売 画像解析导出':         '読売 画像解析',
  '読売 URL解析':              '読売 URL抽出',
  '読売 URL抽出导出':          '読売 URL抽出',
  '読売 文本比对-逐行':        '読売 テキスト比較-行単位',
  '読売 文本比对-升序':        '読売 テキスト比較-昇順',
  '読売 文本比对-包含关系':    '読売 テキスト比較-包含関係',
  '読売管理-记录操作':         '読売管理-記録操作',
  '文本比对-逐行':             'テキスト比較-行単位',
  '文本比对-升序':             'テキスト比較-昇順',
  '文本比对-包含关系':         'テキスト比較-包含関係',
  '文本比对-符号检查':         'テキスト比較-記号チェック',
  '图片对比':                  '画像比較',
  'OCR文字提取':               'OCR文字抽出',
};

function rebuildSummary() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ---- 1. 读取 logs ----
  const logsSheet = ss.getSheetByName('logs');
  if (!logsSheet) { throw new Error('logs sheet not found'); }

  const logsData = logsSheet.getDataRange().getValues();
  if (logsData.length <= 1) {
    // 只有表头或空，清空 summary 后退出
    clearAndWriteSummary(ss, []);
    return;
  }

  // 表头在第 0 行，数据从第 1 行开始
  // A:时间 B:邮箱 C:姓名 D:课室 E:工具名 F:diffCount G:criticalCount H:備考 I:月統計
  // (index: 0=t, 1=email, 2=name, 3=dept, 4=tool, 5=diff, 6=critical, 7=note, 8=month)

  // ---- 2. 解析并分组 ----
  // key = date + '|' + email + '|' + tool
  const groups = {};  // key → { email, name, dept, tool, date, month, records: [{ts, diff}] }

  for (let r = 1; r < logsData.length; r++) {
    const row = logsData[r];
    const email = String(row[1] || '').trim();
    const name  = String(row[2] || '').trim();
    const dept  = String(row[3] || '').trim();
    const tool  = String(row[4] || '').trim();
    const diff  = parseFloat(row[5]) || 0;
    const parsedTs = parseLogTimestamp(row[0]);
    // 月份：优先使用 logs 表 I列「月統計」，确保为字符串
    const rawMonth = row[8];
    const month = rawMonth instanceof Date
      ? Utilities.formatDate(rawMonth, 'Asia/Tokyo', 'yyyy年MM月')
      : String(rawMonth || '').trim();
    if (!parsedTs || !email || !tool) continue;  // 跳过空行或无效时间

    const dateStr = Utilities.formatDate(parsedTs, 'Asia/Tokyo', 'yyyy/MM/dd');
    const key = dateStr + '|' + email + '|' + tool;

    if (!groups[key]) {
      groups[key] = {
        email, name, dept, tool,
        date: dateStr,
        month: month || Utilities.formatDate(parsedTs, 'Asia/Tokyo', 'yyyy年MM月'),
        records: []
      };
    }

    groups[key].records.push({ ts: parsedTs, diff: diff });
    // 以最后一条覆盖方式保留最新的 name / dept
    if (name) groups[key].name = name;
    if (dept) groups[key].dept = dept;
  }

  // ---- 3. 每个组计算统计值 ----
  const summaryRows = [];

  Object.values(groups).forEach(group => {
    const records = group.records;
    // 按时间升序排列
    records.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    const rawCount = records.length;
    const totalDiff = records.reduce((sum, r) => sum + r.diff, 0);
    const firstTime = formatJst(records[0].ts);
    const lastTime  = formatJst(records[records.length - 1].ts);

    // 有效使用次数：15 分钟间隔去重
    let effectiveCount = 0;
    let lastEffectiveTs = null;
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;

    records.forEach(r => {
      if (lastEffectiveTs === null) {
        // 第一条算 1 次
        effectiveCount++;
        lastEffectiveTs = r.ts.getTime();
      } else {
        const gap = r.ts.getTime() - lastEffectiveTs;
        if (gap >= FIFTEEN_MIN_MS) {
          effectiveCount++;
          lastEffectiveTs = r.ts.getTime();
        }
      }
    });

    summaryRows.push([
      group.date,
      group.month,
      group.email,
      group.name,
      group.dept,
      TOOL_NAME_JA[group.tool] || group.tool,  // 日志展示→日本語表示
      rawCount,
      effectiveCount,
      totalDiff,
      firstTime,
      lastTime,
      ''  // 备注预留
    ]);
  });

  // ---- 4. 排序：日期降序 → 课室 → 姓名 → 工具名 ----
  summaryRows.sort((a, b) => {
    // 日期降序
    const dateCmp = b[0].localeCompare(a[0]);
    if (dateCmp !== 0) return dateCmp;
    // 课室
    const deptCmp = (a[4] || '').localeCompare(b[4] || '');
    if (deptCmp !== 0) return deptCmp;
    // 姓名
    const nameCmp = (a[3] || '').localeCompare(b[3] || '');
    if (nameCmp !== 0) return nameCmp;
    // 工具名
    return (a[5] || '').localeCompare(b[5] || '');
  });

  // ---- 5. 写入 summary sheet ----
  clearAndWriteSummary(ss, summaryRows);
}

/**
 * 清空 summary sheet 并写入表头和汇总数据
 */
function clearAndWriteSummary(ss, rows) {
  let sheet = ss.getSheetByName('summary');
  if (!sheet) {
    sheet = ss.insertSheet('summary');
  }

  // 清空旧内容
  sheet.clear();

  // 写入表头
  const headers = [SUMMARY_HEADERS];
  const dataRange = headers.concat(rows);

  if (dataRange.length > 0) {
    sheet.getRange(1, 1, dataRange.length, SUMMARY_HEADERS.length)
      .setValues(dataRange);
  }

  // 表头加粗
  sheet.getRange(1, 1, 1, SUMMARY_HEADERS.length).setFontWeight('bold');

  // 自动调整列宽（取表头和前 5 行数据的最宽值做参考）
  sheet.autoResizeColumns(1, SUMMARY_HEADERS.length);
}

/**
 * 解析日志时间戳 "2026/06/30 12:36:01" → Date
 * 假设已经是 JST（日本时间），不做时区转换
 */
function parseLogTimestamp(tsRaw) {
  try {
    // 如果已经是 Date 对象且有效，直接返回
    if (tsRaw instanceof Date && !isNaN(tsRaw.getTime())) {
      return tsRaw;
    }
    // 如果是字符串，解析 "2026/06/30 12:36:01"
    const parts = String(tsRaw).split(/[\/ :]/);
    if (parts.length < 6) return null;
    const year  = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;  // JS 0-based
    const day   = parseInt(parts[2]);
    const hour  = parseInt(parts[3]);
    const min   = parseInt(parts[4]);
    const sec   = parseInt(parts[5]);
    return new Date(year, month, day, hour, min, sec);
  } catch(e) {
    return null;
  }
}

/**
 * Date → "2026/06/30 12:36:01" 格式
 */
function formatJst(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  const h  = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s  = String(date.getSeconds()).padStart(2, '0');
  return `${y}/${mo}/${d} ${h}:${mi}:${s}`;
}

/**
 * summary 后台统计を毎日複数回自動更新するトリガーを作成する。
 * 手动执行一次即可，之后由 GAS 自动执行 rebuildSummary()。
 */
function installDailySummaryTriggers() {
  const targetFunction = 'rebuildSummary';

  // 避免重复安装：先删除既有 rebuildSummary 的时间触发器
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === targetFunction) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 每天 10点、14点、17点左右自动刷新 summary
  [10, 14, 17].forEach(hour => {
    ScriptApp.newTrigger(targetFunction)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();
  });
}
