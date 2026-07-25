/**
 * excel_formula_cleaner_worker.js v4.1
 * ZIP/XML级Excel轻量化处理 - 字节级性能优化版
 * 核心优化：
 * 1. 使用 uint8array 字节级扫描，避免创建100MB+ UTF-16字符串
 * 2. 预计算字节模式，单次遍历完成检测
 * 3. 每 Sheet处理后释放内存
 * 4. 精确分阶段计时 + 心跳消息
 * v4.1: 常量/公式区分判定 - 只有非公式常量单元格才算真实业务数据
 */
'use strict';
/* global importScripts, postMessage */

let cancelled = false;
let JSZip = null;

function loadLibs() {
  if (JSZip) return true;
  try {
    importScripts('./jszip.min.js');
    JSZip = self.JSZip;
    return true;
  } catch (e) {
    postMessage({ type: 'error', message: 'JSZip加载失败: ' + e.message });
    return false;
  }
}

self.onmessage = function (e) {
  const msg = e.data;
  switch (msg.type) {
    case 'detect': handleDetect(msg.buffer, msg.fileName); break;
    case 'process': handleProcess(msg.buffer, msg.fileName, msg.options); break;
    case 'cancel': cancelled = true; break;
    default: postMessage({ type: 'error', message: '未知消息: ' + msg.type });
  }
};

// ========== 字节模式工具 ==========
const enc = new TextEncoder();
const dec = new TextDecoder('latin1'); // latin1: 1字节=1字符，不丢失数据

// 预计算常用模式的字节数组
const PAT = {
  rowOpen: enc.encode('<row '),
  rowClose: enc.encode('</row>'),
  sheetData: enc.encode('<sheetData'),
  sheetDataClose: enc.encode('</sheetData>'),
  fOpen: enc.encode('<f>'),
  fOpenAttr: enc.encode('<f '),
  vOpen: enc.encode('<v>'),
  vClose: enc.encode('</v>'),
  cOpen: enc.encode('<c '),
  cClose: enc.encode('</c>'),
  dimension: enc.encode('<dimension'),
  refAttr: enc.encode('ref="'),
  rAttr: enc.encode('r="'),
  selfClose: enc.encode('/>'),
  tagClose: enc.encode('>'),
};

// 字节级indexOf：在bytes[start..end]中搜索pattern
function bIndexOf(bytes, pattern, start, end) {
  const pLen = pattern.length;
  const limit = (end !== undefined ? end : bytes.length) - pLen;
  outer:
  for (let i = start; i <= limit; i++) {
    if (bytes[i] === pattern[0]) {
      for (let j = 1; j < pLen; j++) {
        if (bytes[i + j] !== pattern[j]) continue outer;
      }
      return i;
    }
  }
  return -1;
}

// 字节级lastIndexOf
function bLastIndexOf(bytes, pattern, end) {
  const pLen = pattern.length;
  for (let i = end - pLen; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < pLen; j++) {
      if (bytes[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

// 从字节中提取数字（r="12345"中的12345）
function extractNumber(bytes, start, end) {
  let num = 0;
  for (let i = start; i < end; i++) {
    const c = bytes[i];
    if (c >= 48 && c <= 57) num = num * 10 + (c - 48);
    else break;
  }
  return num;
}

// 从字节中提取值字符串（<v>...</v>之间的内容）
function extractValue(bytes, vStart, vEnd) {
  // vStart指向<v>之后, vEnd指向</v>之前
  const len = vEnd - vStart;
  if (len === 0) return '';
  if (len > 200) return dec.decode(bytes.subarray(vStart, vStart + 200)); // 截断超长值
  return dec.decode(bytes.subarray(vStart, vEnd));
}

// 检查行内容中是否存在非公式常量单元格（有<v>无<f>的<c>元素）
function hasNonFormulaConstant(bytes, contentStart, contentEnd) {
  let cPos = contentStart;
  while (cPos < contentEnd) {
    const cStart = bIndexOf(bytes, PAT.cOpen, cPos, contentEnd);
    if (cStart === -1) break;

    // 找单元格结束：</c> 或 />
    const cClose = bIndexOf(bytes, PAT.cClose, cStart + 3, contentEnd);
    const cSelfClose = bIndexOf(bytes, PAT.selfClose, cStart + 3, contentEnd);

    // 确定单元格边界
    let cellContentEnd;
    if (cSelfClose !== -1 && (cClose === -1 || cSelfClose < cClose)) {
      // 自闭合 <c .../> — 无内容，跳过
      cPos = cSelfClose + 2;
      continue;
    }
    if (cClose === -1) break;
    cellContentEnd = cClose;

    // 检查该单元格是否有公式
    const cellHasF = bIndexOf(bytes, PAT.fOpen, cStart, cellContentEnd) !== -1 ||
                     bIndexOf(bytes, PAT.fOpenAttr, cStart, cellContentEnd) !== -1;

    if (!cellHasF) {
      // 非公式单元格 — 检查是否有<v>且非空
      const vi = bIndexOf(bytes, PAT.vOpen, cStart, cellContentEnd);
      if (vi !== -1) {
        const ve = bIndexOf(bytes, PAT.vClose, vi + 3, cellContentEnd);
        if (ve !== -1 && ve > vi + 3) {
          // 有非空常量值 → 真实业务数据
          return true;
        }
      }
    }

    cPos = cClose + 4; // skip </c>
  }
  return false;
}

// ========== 计时日志 ==========
function timingLog(stage, t0, extra) {
  const now = performance.now();
  postMessage({
    type: 'timing',
    stage,
    elapsedMs: Math.round(now - t0),
    ...extra
  });
}

// ========== 第一步：无效尾部检测 ==========
async function handleDetect(buffer, fileName) {
  cancelled = false;
  if (!loadLibs()) return;
  const t0 = performance.now();
  const fileSize = buffer.byteLength;

  postMessage({ type: 'progress', phase: 'worker_start', message: 'Worker已启动，正在打开压缩包...' });
  timingLog('worker-start', t0, { fileBytes: fileSize });

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    postMessage({ type: 'error', message: 'ZIP读取失败: ' + e.message });
    return;
  }
  const zipTime = performance.now() - t0;
  postMessage({ type: 'progress', phase: 'zip_done', message: `压缩包打开完成 (${(zipTime/1000).toFixed(1)}秒)` });
  timingLog('zip-load-complete', t0, { fileBytes: fileSize, zipMs: Math.round(zipTime) });

  // 解析workbook.xml（小文件，用string即可）
  const wbFile = zip.file('xl/workbook.xml');
  if (!wbFile) { postMessage({ type: 'error', message: '找不到xl/workbook.xml' }); return; }
  const wbXml = await wbFile.async('string');
  const sheetNames = parseSheetNames(wbXml);
  timingLog('workbook-parsed', t0, { sheetCount: sheetNames.length });

  // 解析rels
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const relsMap = parseRels(relsXml || '');
  const sheetFiles = mapSheetFiles(wbXml, relsMap);

  postMessage({ type: 'progress', phase: 'detect', message: `正在检测 ${sheetNames.length} 个Sheet...`, total: sheetNames.length, current: 0 });

  const results = [];
  for (let i = 0; i < sheetNames.length; i++) {
    if (cancelled) { postMessage({ type: 'cancelled' }); return; }
    const name = sheetNames[i];
    const filePath = sheetFiles[name];
    if (!filePath) { results.push({ name, skip: true, reason: '文件路径未找到' }); continue; }

    const full = 'xl/' + filePath;
    const file = zip.file(full);
    if (!file) { results.push({ name, skip: true, reason: 'XML文件不存在' }); continue; }

    postMessage({ type: 'progress', phase: 'detect', message: `正在检测Sheet ${i+1}/${sheetNames.length}: ${name}`, total: sheetNames.length, current: i + 1, sheetName: name });

    try {
      const sheetT0 = performance.now();
      // 关键优化：获取字节数组而非字符串
      const bytes = await file.async('uint8array');
      const readMs = performance.now() - sheetT0;

      const info = analyzeSheetBytes(bytes, name, t0);
      info.readMs = Math.round(readMs);
      info.analyzeMs = Math.round(performance.now() - sheetT0 - readMs);
      info.xmlBytes = bytes.length;
      results.push(info);

      timingLog('sheet-done', t0, { sheet: name, readMs: info.readMs, analyzeMs: info.analyzeMs, xmlMB: (bytes.length / 1048576).toFixed(1) });
    } catch (e) {
      results.push({ name, skip: true, reason: '解析失败: ' + e.message });
    }
  }

  const detectTime = performance.now() - t0;
  timingLog('detect-complete', t0, { fileBytes: fileSize });
  postMessage({ type: 'detection', data: { sheets: results, sheetCount: sheetNames.length, detectTime: Math.round(detectTime), zipTime: Math.round(zipTime), fileName, fileSize } });
}

// ========== 解析Sheet名（小文件用string） ==========
function parseSheetNames(wbXml) {
  const names = [];
  const re = /<sheet[^>]+name="([^"]*)"[^>]*\/?>/g;
  let m;
  while ((m = re.exec(wbXml)) !== null) {
    names.push(decodeXmlEntities(m[1]));
  }
  return names;
}

function decodeXmlEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

function parseRels(relsXml) {
  const map = {};
  const re = /<Relationship[^>]+Id="([^"]*)"[^>]+Target="([^"]*)"[^>]*\/?>/g;
  let m;
  while ((m = re.exec(relsXml)) !== null) map[m[1]] = m[2];
  return map;
}

function mapSheetFiles(wbXml, relsMap) {
  const result = {};
  const re = /<sheet\s[^>]*\/?>/g;
  let m;
  while ((m = re.exec(wbXml)) !== null) {
    const tag = m[0];
    const nameM = tag.match(/name="([^"]*)"/);
    const ridM = tag.match(/r:id="([^"]*)"/);
    if (nameM && ridM) {
      const name = decodeXmlEntities(nameM[1]);
      if (relsMap[ridM[1]]) result[name] = relsMap[ridM[1]];
    }
  }
  return result;
}

// ========== 字节级Sheet分析（核心优化） ==========
function analyzeSheetBytes(bytes, sheetName, globalT0) {
  const result = { name: sheetName, skip: false };
  const len = bytes.length;

  // 获取dimension
  const dimIdx = bIndexOf(bytes, PAT.dimension, 0, Math.min(len, 5000));
  if (dimIdx !== -1) {
    const refStart = bIndexOf(bytes, PAT.refAttr, dimIdx, dimIdx + 100);
    if (refStart !== -1) {
      const refEnd = bIndexOf(bytes, enc.encode('"'), refStart + 5, refStart + 100);
      if (refEnd !== -1) result.dimension = dec.decode(bytes.subarray(refStart + 5, refEnd));
    }
  }
  if (!result.dimension) result.dimension = '';
  let dimMaxRow = 0;
  if (result.dimension) {
    const parts = result.dimension.split(':');
    if (parts.length === 2) dimMaxRow = parseInt(parts[1].replace(/[A-Z]+/g, '')) || 0;
    else dimMaxRow = parseInt(parts[0].replace(/[A-Z]+/g, '')) || 0;
  }
  result.dimMaxRow = dimMaxRow;

  // 找sheetData边界
  const sdStart = bIndexOf(bytes, PAT.sheetData, 0, Math.min(len, 10000));
  const sdEnd = bIndexOf(bytes, PAT.sheetDataClose, Math.max(0, len - 100000));
  if (sdStart === -1 || sdEnd === -1) { result.skip = true; result.reason = '无sheetData'; return result; }

  result.xmlLength = len;

  // ===== 核心扫描：字节级indexOf + 常量/公式区分 =====
  let maxRow = 0;
  let lastBusinessRow = 0;
  let lastFormulaRow = 0;
  let totalFormulas = 0;
  let rowCount = 0;

  let pos = sdStart;

  while (pos < sdEnd) {
    // 找下一个 <row
    const rowStart = bIndexOf(bytes, PAT.rowOpen, pos, sdEnd);
    if (rowStart === -1) break;

    // 找row标签结束 >
    const tagEnd = bIndexOf(bytes, PAT.tagClose, rowStart, rowStart + 500);
    if (tagEnd === -1) break;

    // 提取行号 r="数字"
    let rowNum = 0;
    const rAttrIdx = bIndexOf(bytes, PAT.rAttr, rowStart, tagEnd);
    if (rAttrIdx !== -1) {
      const numStart = rAttrIdx + 3;
      const numEnd = bIndexOf(bytes, enc.encode('"'), numStart, numStart + 10);
      if (numEnd !== -1) rowNum = extractNumber(bytes, numStart, numEnd);
    }

    // 检查自闭合 <row ... />
    const selfCloseIdx = bIndexOf(bytes, PAT.selfClose, rowStart, tagEnd + 2);
    if (selfCloseIdx !== -1 && selfCloseIdx <= tagEnd + 1) {
      // 自闭合row（空行）
      if (rowNum > maxRow) maxRow = rowNum;
      rowCount++;
      pos = selfCloseIdx + 2;
      continue;
    }

    // 找 </row>
    const rowEnd = bIndexOf(bytes, PAT.rowClose, tagEnd, sdEnd);
    if (rowEnd === -1) break;

    if (rowNum > maxRow) maxRow = rowNum;
    rowCount++;

    const contentStart = tagEnd + 1;
    const contentEnd = rowEnd;

    if (contentEnd > contentStart) {
      // 检查是否有公式 <f> 或 <f
      const fIdx = bIndexOf(bytes, PAT.fOpen, contentStart, contentEnd);
      const fIdx2 = bIndexOf(bytes, PAT.fOpenAttr, contentStart, contentEnd);
      const hasF = (fIdx !== -1) || (fIdx2 !== -1);

      if (hasF) {
        if (rowNum > lastFormulaRow) lastFormulaRow = rowNum;
        // 公式计数
        let fPos = contentStart;
        let fCount = 0;
        while (fPos < contentEnd) {
          const nextF = bIndexOf(bytes, PAT.fOpen, fPos, contentEnd);
          const nextF2 = bIndexOf(bytes, PAT.fOpenAttr, fPos, contentEnd);
          let nf = -1;
          if (nextF !== -1 && (nf === -1 || nextF < nf)) nf = nextF;
          if (nextF2 !== -1 && (nf === -1 || nextF2 < nf)) nf = nextF2;
          if (nf === -1) break;
          fCount++;
          fPos = nf + 3;
        }
        totalFormulas += fCount;

        // === 新判定逻辑：区分常量单元格 vs 公式缓存 ===
        // 规则：只有非公式常量单元格（有<v>无<f>）才算真实业务数据
        // 公式缓存值（无论是否为0）不单独构成业务行
        let hasConstData = false;

        // 快速路径：统计<v>数量，如果<=公式数则全部是公式缓存
        let vCount = 0;
        let vScanPos = contentStart;
        while (vScanPos < contentEnd) {
          const nextV = bIndexOf(bytes, PAT.vOpen, vScanPos, contentEnd);
          if (nextV === -1) break;
          vCount++;
          vScanPos = nextV + 3;
        }

        if (vCount > fCount) {
          // 存在非公式常量值 → 逐单元格检查
          hasConstData = hasNonFormulaConstant(bytes, contentStart, contentEnd);
        }
        // 如果 vCount <= fCount，所有值都是公式缓存 → 不是业务行

        if (hasConstData && rowNum > lastBusinessRow) lastBusinessRow = rowNum;
      } else {
        // 无公式行 - 所有<v>都是常量，检查非空值
        let vPos = contentStart;
        let hasBusinessConst = false;
        while (vPos < contentEnd && !hasBusinessConst) {
          const vi = bIndexOf(bytes, PAT.vOpen, vPos, contentEnd);
          if (vi === -1) break;
          const ve = bIndexOf(bytes, PAT.vClose, vi + 3, contentEnd);
          if (ve === -1) break;
          const vLen = ve - vi - 3;
          // 常量单元格：任何非空值都是真实数据（包括0）
          if (vLen > 0) hasBusinessConst = true;
          vPos = ve + 4;
        }
        if (hasBusinessConst && rowNum > lastBusinessRow) lastBusinessRow = rowNum;
      }
    }

    pos = rowEnd + 6; // skip </row>

    // 进度报告（每50000行）
    if (rowCount % 50000 === 0) {
      postMessage({ type: 'progress', phase: 'detect_scan', message: `正在分析 ${sheetName}: 已扫描 ${rowCount.toLocaleString()} 行...`, sheetName });
    }
  }

  result.maxRow = maxRow;
  result.lastBusinessRow = lastBusinessRow;
  result.lastFormulaRow = lastFormulaRow;
  result.totalFormulas = totalFormulas;
  result.rowCount = rowCount;

  // 计算尾部
  const candidateEnd = lastBusinessRow;
  result.candidateEndRow = candidateEnd;
  result.tailStartRow = candidateEnd > 0 ? candidateEnd + 1 : 0;
  result.tailRows = lastFormulaRow > candidateEnd ? lastFormulaRow - candidateEnd : 0;
  result.removableRows = maxRow > candidateEnd ? maxRow - candidateEnd : 0;

  // 尾部公式分析（采样）
  if (result.tailRows > 0) {
    const tailInfo = analyzeTailSampledBytes(bytes, sdStart, sdEnd, candidateEnd, lastFormulaRow);
    result.tailFormulas = tailInfo.count;
    result.tailZero = tailInfo.zero;
    result.tailEmpty = tailInfo.empty;
    result.tailError = tailInfo.error;
    result.tailOther = tailInfo.other;
    result.tailTemplates = tailInfo.templates;
    result.tailColumns = tailInfo.columns;
    result.hasDataAfterTail = tailInfo.hasDataAfter;
  } else {
    result.tailFormulas = 0;
    result.tailZero = 0; result.tailEmpty = 0; result.tailError = 0; result.tailOther = 0;
    result.tailTemplates = [];
    result.tailColumns = [];
    result.hasDataAfterTail = false;
  }

  // 安全等级判定
  result.safety = judgeSafety(result);
  return result;
}

// ========== 尾部采样分析（字节级，多点采样） ==========
function analyzeTailSampledBytes(bytes, sdStart, sdEnd, cutRow, maxRow) {
  let count = 0, zero = 0, empty = 0, error = 0, other = 0;
  const templates = {};
  const columns = new Set();
  const errorTypes = ['#REF!', '#VALUE!', '#N/A', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!'];
  let hasDataAfter = false;

  // 找尾部起始行 r="cutRow+1"
  const marker = enc.encode(`r="${cutRow + 1}"`);
  let startIdx = bIndexOf(bytes, marker, sdStart, sdEnd);
  while (startIdx !== -1 && startIdx < sdEnd) {
    const tagStart = bLastIndexOf(bytes, PAT.rowOpen, startIdx);
    if (tagStart !== -1 && startIdx - tagStart < 80) break;
    startIdx = bIndexOf(bytes, marker, startIdx + 1, sdEnd);
  }
  if (startIdx === -1 || startIdx >= sdEnd) return { count, zero, empty, error, other, templates: [], columns: [], hasDataAfter: false };

  let pos = bLastIndexOf(bytes, PAT.rowOpen, startIdx);
  if (pos === -1) pos = startIdx;
  let sampled = 0;
  const sampleLimit = 2000;

  while (pos < sdEnd && sampled < sampleLimit) {
    const rowStart = bIndexOf(bytes, PAT.rowOpen, pos, sdEnd);
    if (rowStart === -1) break;
    const tagEnd = bIndexOf(bytes, PAT.tagClose, rowStart, rowStart + 500);
    if (tagEnd === -1) break;
    const rowEnd = bIndexOf(bytes, PAT.rowClose, tagEnd, sdEnd);
    if (rowEnd === -1) break;

    const contentStart = tagEnd + 1;

    // 公式计数和模板
    let fPos = contentStart;
    while (fPos < rowEnd) {
      const nf1 = bIndexOf(bytes, PAT.fOpen, fPos, rowEnd);
      const nf2 = bIndexOf(bytes, PAT.fOpenAttr, fPos, rowEnd);
      let fs = -1;
      if (nf1 !== -1 && (fs === -1 || nf1 < fs)) fs = nf1;
      if (nf2 !== -1 && (fs === -1 || nf2 < fs)) fs = nf2;
      if (fs === -1) break;
      count++;
      if (Object.keys(templates).length < 5) {
        const fContentStart = bIndexOf(bytes, PAT.tagClose, fs, fs + 100);
        const fEnd = bIndexOf(bytes, enc.encode('</f>'), fContentStart + 1, rowEnd);
        if (fContentStart !== -1 && fEnd !== -1) {
          const formula = dec.decode(bytes.subarray(fContentStart + 1, Math.min(fEnd, fContentStart + 61)));
          const tmpl = formula.replace(/\d+/g, 'N').substring(0, 50);
          if (!templates[tmpl]) templates[tmpl] = { count: 0, sample: formula.substring(0, 60) };
          templates[tmpl].count++;
        }
      }
      fPos = fs + 3;
    }

    // 缓存值统计（公式结果占位判定）
    let vPos = contentStart;
    while (vPos < rowEnd) {
      const vi = bIndexOf(bytes, PAT.vOpen, vPos, rowEnd);
      if (vi === -1) break;
      const ve = bIndexOf(bytes, PAT.vClose, vi + 3, rowEnd);
      if (ve === -1) break;
      const val = extractValue(bytes, vi + 3, ve);
      if (val === '0' || val === '' || val === '0.0') zero++;
      else if (errorTypes.includes(val) || val.startsWith('#')) error++;
      else if (val.trim() === '' || val === '&quot;' || val === '"' || val === '-' || val === '--' || val === 'N/A' || val === 'FALSE') empty++;
      else { other++; hasDataAfter = true; }
      vPos = ve + 4;
    }

    // 列信息
    if (columns.size < 20) {
      const refIdx = bIndexOf(bytes, PAT.rAttr, contentStart, rowEnd);
      if (refIdx !== -1) {
        const refEnd = bIndexOf(bytes, enc.encode('"'), refIdx + 3, refIdx + 20);
        if (refEnd !== -1) {
          const ref = dec.decode(bytes.subarray(refIdx + 3, refEnd));
          const col = ref.replace(/\d+/g, '');
          if (col) columns.add(col);
        }
      }
    }

    pos = rowEnd + 6;
    sampled++;
  }

  // === 多点采样：检查尾部中段和末段是否有真实数据 ===
  const totalTailRows = maxRow - cutRow;
  if (totalTailRows > 5000 && !hasDataAfter) {
    // 采样尾部中间位置（约50%处）和末尾（约95%处）
    const midRow = cutRow + Math.floor(totalTailRows * 0.5);
    const endRow = cutRow + Math.floor(totalTailRows * 0.95);
    const checkPoints = [midRow, endRow];
    for (const cpRow of checkPoints) {
      if (hasDataAfter) break;
      const cpMarker = enc.encode(`r="${cpRow}"`);
      let cpIdx = bIndexOf(bytes, cpMarker, sdStart, sdEnd);
      if (cpIdx === -1) continue;
      // 找该行内容
      const cpRowStart = bLastIndexOf(bytes, PAT.rowOpen, cpIdx);
      if (cpRowStart === -1) continue;
      const cpTagEnd = bIndexOf(bytes, PAT.tagClose, cpRowStart, cpRowStart + 500);
      if (cpTagEnd === -1) continue;
      const cpRowEnd = bIndexOf(bytes, PAT.rowClose, cpTagEnd, sdEnd);
      if (cpRowEnd === -1) continue;
      // 检查该行是否有非公式常量单元格（真实业务数据）
      const cpContentStart = cpTagEnd + 1;
      if (hasNonFormulaConstant(bytes, cpContentStart, cpRowEnd)) {
        hasDataAfter = true;
        other++;
      }
    }
  }

  // 按比例估算公式数
  if (sampled < totalTailRows && sampled > 0 && count > 0) {
    count = Math.round((count / sampled) * totalTailRows);
  }

  const topTemplates = Object.entries(templates)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([t, info]) => ({ template: t, count: info.count, sample: info.sample }));

  return { count, zero, empty, error, other, templates: topTemplates, columns: Array.from(columns).slice(0, 20), hasDataAfter };
}

// ========== 安全等级判定 ==========
function judgeSafety(info) {
  if (info.tailRows < 100) return 'none';
  if (info.lastBusinessRow >= info.lastFormulaRow) return 'none';
  if (info.tailRows < 1000) return 'manual';
  if (info.tailOther > 0) return 'manual';
  if (info.hasDataAfterTail) return 'manual';
  if (info.tailRows >= 1000 && info.tailOther === 0 && !info.hasDataAfterTail) return 'safe';
  return 'manual';
}

// ========== 第二步+第三步：处理（裁剪+可选值化） ==========
async function handleProcess(buffer, fileName, options) {
  cancelled = false;
  if (!loadLibs()) return;
  const t0 = performance.now();

  const { trimSheets, formulaMode, formulaSheets } = options;

  postMessage({ type: 'progress', phase: 'zip_read', message: '正在打开Excel压缩包...' });
  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch (e) { postMessage({ type: 'error', message: 'ZIP读取失败: ' + e.message }); return; }
  const zipReadTime = performance.now() - t0;
  postMessage({ type: 'progress', phase: 'zip_done', message: `压缩包打开完成 (${(zipReadTime/1000).toFixed(1)}秒)` });

  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const sheetNames = parseSheetNames(wbXml || '');
  const relsMap = parseRels(relsXml || '');
  const sheetFiles = mapSheetFiles(wbXml || '', relsMap);

  let totalTrimmedRows = 0, totalTrimmedFormulas = 0, totalConverted = 0, totalSkipped = 0;
  const perSheet = [];
  const errors = [];

  // 裁剪处理
  const trimStart = performance.now();
  for (let i = 0; i < trimSheets.length; i++) {
    if (cancelled) { postMessage({ type: 'cancelled' }); return; }
    const { name, cutRow } = trimSheets[i];
    const filePath = sheetFiles[name];
    if (!filePath) { errors.push({ name, error: '文件路径未找到' }); continue; }
    const fullPath = 'xl/' + filePath;
    const file = zip.file(fullPath);
    if (!file) { errors.push({ name, error: 'XML不存在' }); continue; }

    postMessage({ type: 'progress', phase: 'trim', message: `正在裁剪 ${name} (${i + 1}/${trimSheets.length})...`, current: i + 1, total: trimSheets.length });

    try {
      // 裁剪需要字符串操作（因为要重建XML）
      const xml = await file.async('string');
      const trimmed = trimSheetXml(xml, cutRow);
      if (trimmed) {
        zip.file(fullPath, trimmed.xml);
        totalTrimmedRows += trimmed.removedRows;
        totalTrimmedFormulas += trimmed.removedFormulas;
        perSheet.push({ name, removedRows: trimmed.removedRows, removedFormulas: trimmed.removedFormulas });
        postMessage({ type: 'progress', phase: 'trim', message: `已裁剪 ${name}: 删除${trimmed.removedRows.toLocaleString()}行, ${trimmed.removedFormulas.toLocaleString()}个公式`, current: i + 1, total: trimSheets.length });
      } else {
        errors.push({ name, error: '找不到裁剪点' });
      }
    } catch (e) {
      errors.push({ name, error: e.message });
    }
  }
  const trimTime = performance.now() - trimStart;

  // 公式值化处理
  let convertTime = 0;
  if (formulaMode !== 'keep') {
    const convertStart = performance.now();
    const targetSheets = formulaMode === 'all' ? sheetNames : (formulaSheets || []);
    for (let i = 0; i < targetSheets.length; i++) {
      if (cancelled) { postMessage({ type: 'cancelled' }); return; }
      const name = targetSheets[i];
      const filePath = sheetFiles[name];
      if (!filePath) continue;
      const fullPath = 'xl/' + filePath;
      const file = zip.file(fullPath);
      if (!file) continue;

      postMessage({ type: 'progress', phase: 'convert', message: `正在值化公式 ${name} (${i + 1}/${targetSheets.length})...`, current: i + 1, total: targetSheets.length });

      try {
        const xml = await file.async('string');
        const converted = convertFormulas(xml);
        zip.file(fullPath, converted.xml);
        totalConverted += converted.converted;
        totalSkipped += converted.skipped;
      } catch (e) {
        errors.push({ name, error: '值化失败: ' + e.message });
      }
    }
    convertTime = performance.now() - convertStart;
    await removeCalcChain(zip);
  } else if (totalTrimmedRows > 0) {
    await removeCalcChain(zip);
  }

  // 压缩输出
  postMessage({ type: 'progress', phase: 'compress', message: '正在重新压缩文件，此阶段可能无法立即取消...' });
  const compressStart = performance.now();
  let outBuf;
  try {
    outBuf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  } catch (e) {
    postMessage({ type: 'error', message: '压缩失败: ' + e.message });
    return;
  }
  const compressTime = performance.now() - compressStart;

  const totalTime = performance.now() - t0;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const baseName = fileName.replace(/\.xlsx$/i, '');
  const outName = `${baseName}_軽量化_${dateStr}.xlsx`;

  postMessage({
    type: 'result',
    data: {
      buffer: outBuf, outputName: outName, outputSize: outBuf.byteLength, inputSize: buffer.byteLength,
      totalTrimmedRows, totalTrimmedFormulas, totalConverted, totalSkipped,
      trimmedSheetCount: perSheet.length, perSheet, errors, formulaMode,
      timing: { totalTime: Math.round(totalTime), zipReadTime: Math.round(zipReadTime), trimTime: Math.round(trimTime), convertTime: Math.round(convertTime), compressTime: Math.round(compressTime) }
    }
  }, [outBuf]);
}

// ========== XML裁剪（字符串级 - 需要重建XML） ==========
function trimSheetXml(xml, cutRow) {
  const sdStart = xml.indexOf('<sheetData');
  const sdEnd = xml.indexOf('</sheetData>');
  if (sdStart === -1 || sdEnd === -1) return null;

  // 找cutRow+1的<row>位置
  const nextRow = cutRow + 1;
  let cutPos = findRowStartInXml(xml, nextRow, sdStart, sdEnd);

  if (cutPos === -1) {
    // 找cutRow之后任何更大的row
    let searchPos = sdStart;
    while (searchPos < sdEnd) {
      const rowIdx = xml.indexOf('<row ', searchPos);
      if (rowIdx === -1 || rowIdx >= sdEnd) break;
      const rIdx = xml.indexOf('r="', rowIdx);
      const tagEnd = xml.indexOf('>', rowIdx);
      if (rIdx !== -1 && rIdx < tagEnd) {
        const numEnd = xml.indexOf('"', rIdx + 3);
        const rn = parseInt(xml.substring(rIdx + 3, numEnd)) || 0;
        if (rn > cutRow) { cutPos = rowIdx; break; }
      }
      searchPos = tagEnd + 1;
    }
  }

  if (cutPos === -1) return null;

  // 计算删除量
  let removedRows = 0, removedFormulas = 0;
  let countPos = cutPos;
  while (countPos < sdEnd) {
    const nextRow2 = xml.indexOf('<row ', countPos);
    if (nextRow2 === -1 || nextRow2 >= sdEnd) break;
    removedRows++;
    countPos = nextRow2 + 5;
  }
  countPos = cutPos;
  while (countPos < sdEnd) {
    const nextF = xml.indexOf('<f', countPos);
    if (nextF === -1 || nextF >= sdEnd) break;
    const afterF = xml[nextF + 2];
    if (afterF === '>' || afterF === ' ' || afterF === '/') removedFormulas++;
    countPos = nextF + 2;
  }

  // 重建XML
  const before = xml.substring(0, sdStart);
  const keptData = xml.substring(sdStart, cutPos);
  const afterSheetData = xml.substring(sdEnd + 12);
  let newXml = before + keptData + '</sheetData>' + afterSheetData;

  // 更新dimension
  const dimIdx = newXml.indexOf('<dimension');
  if (dimIdx !== -1) {
    const refStart = newXml.indexOf('ref="', dimIdx);
    if (refStart !== -1 && refStart - dimIdx < 50) {
      const refEnd = newXml.indexOf('"', refStart + 5);
      const oldRef = newXml.substring(refStart + 5, refEnd);
      const parts = oldRef.split(':');
      if (parts.length === 2) {
        const endCol = parts[1].replace(/\d+/g, '');
        const newRef = `${parts[0]}:${endCol}${cutRow}`;
        newXml = newXml.substring(0, refStart + 5) + newRef + newXml.substring(refEnd);
      }
    }
  }

  return { xml: newXml, removedRows, removedFormulas };
}

function findRowStartInXml(xml, rowNum, sdStart, sdEnd) {
  const marker = `r="${rowNum}"`;
  let searchFrom = sdStart;
  while (searchFrom < sdEnd) {
    const idx = xml.indexOf(marker, searchFrom);
    if (idx === -1 || idx >= sdEnd) return -1;
    const tagStart = xml.lastIndexOf('<row', idx);
    if (tagStart !== -1 && idx - tagStart < 80) return tagStart;
    searchFrom = idx + 1;
  }
  return -1;
}

// ========== 公式值化（XML级） ==========
function convertFormulas(xml) {
  let converted = 0, skipped = 0;

  const cellRe = /(<c\s[^>]*>)([\s\S]*?)(<\/c>)/g;
  let newXml = xml.replace(cellRe, (match, openTag, inner, closeTag) => {
    if (openTag.includes('t="e"')) {
      if (inner.includes('<f>') || inner.includes('<f ')) skipped++;
      return match;
    }
    const fMatch = inner.match(/<f(?:\s[^>]*)?>[^<]*<\/f>/);
    if (!fMatch) return match;
    const vMatch = inner.match(/<v>[^<]*<\/v>/);
    if (!vMatch) { skipped++; return match; }
    converted++;
    const newInner = inner.replace(/<f(?:\s[^>]*)?>[^<]*<\/f>/, '');
    let newOpen = openTag;
    if (newOpen.includes('t="str"')) newOpen = newOpen.replace(/\s*t="str"/, '');
    return newOpen + newInner + closeTag;
  });

  return { xml: newXml, converted, skipped };
}

// ========== calcChain处理 ==========
async function removeCalcChain(zip) {
  if (zip.file('xl/calcChain.xml')) zip.remove('xl/calcChain.xml');
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    const ct = await ctFile.async('string');
    zip.file('[Content_Types].xml', ct.replace(/<Override[^>]*calcChain[^>]*\/?>/g, ''));
  }
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (relsFile) {
    const rels = await relsFile.async('string');
    zip.file('xl/_rels/workbook.xml.rels', rels.replace(/<Relationship[^>]*calcChain[^>]*\/?>/g, ''));
  }
}
