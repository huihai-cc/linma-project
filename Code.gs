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
