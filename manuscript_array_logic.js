(function(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.ManuscriptArrayLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var DEFAULT_MAX_LINES = 100000;

  function parseItems(text) {
    return String(text == null ? '' : text)
      .split(/\r\n|\n|\r/)
      .filter(function(line) {
        return line.trim().length > 0;
      });
  }

  function parseRepeatCount(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) {
      return {
        ok: false,
        code: 'empty_repeat',
        message: '繰り返し回数を入力してください。'
      };
    }
    if (!/^\d+$/.test(raw)) {
      return {
        ok: false,
        code: 'invalid_repeat',
        message: '繰り返し回数は1以上の整数で入力してください。'
      };
    }

    var count = Number(raw);
    if (!Number.isSafeInteger(count) || count < 1) {
      return {
        ok: false,
        code: 'invalid_repeat',
        message: '繰り返し回数は1以上の整数で入力してください。'
      };
    }

    return { ok: true, value: count };
  }

  function createTransform(text, repeatValue, mode, maxLines) {
    var items = parseItems(text);
    if (items.length === 0) {
      return {
        ok: false,
        code: 'empty_input',
        message: '対象リストを入力してください。',
        inputCount: 0,
        outputCount: 0
      };
    }

    var repeat = parseRepeatCount(repeatValue);
    if (!repeat.ok) {
      return {
        ok: false,
        code: repeat.code,
        message: repeat.message,
        inputCount: items.length,
        outputCount: 0
      };
    }

    if (mode !== 'group' && mode !== 'item') {
      return {
        ok: false,
        code: 'invalid_mode',
        message: '変換モードを選択してください。',
        inputCount: items.length,
        outputCount: 0
      };
    }

    var limit = Number.isSafeInteger(maxLines) && maxLines > 0
      ? maxLines
      : DEFAULT_MAX_LINES;
    var outputCount = items.length * repeat.value;
    if (!Number.isSafeInteger(outputCount) || outputCount > limit) {
      return {
        ok: false,
        code: 'too_large',
        message: '変換結果が' + outputCount.toLocaleString('en-US') +
          '行になるため処理できません。' + limit.toLocaleString('en-US') +
          '行以下になるように調整してください。',
        inputCount: items.length,
        outputCount: outputCount
      };
    }

    var lines = [];
    var i;
    var j;
    if (mode === 'group') {
      for (i = 0; i < repeat.value; i += 1) {
        for (j = 0; j < items.length; j += 1) {
          lines.push(items[j]);
        }
      }
    } else {
      for (i = 0; i < items.length; i += 1) {
        for (j = 0; j < repeat.value; j += 1) {
          lines.push(items[i]);
        }
      }
    }

    return {
      ok: true,
      code: 'ok',
      message: '',
      items: items,
      lines: lines,
      repeatCount: repeat.value,
      inputCount: items.length,
      outputCount: outputCount,
      mode: mode
    };
  }

  function toOutputText(lines) {
    return Array.isArray(lines) ? lines.join('\n') : '';
  }

  function createWorkbook(XLSX, lines) {
    if (!XLSX || !XLSX.utils) {
      throw new Error('SheetJS is not available.');
    }
    var rows = [['変換結果']];
    (Array.isArray(lines) ? lines : []).forEach(function(line) {
      rows.push([line]);
    });
    var sheet = XLSX.utils.aoa_to_sheet(rows);
    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '変換結果');
    return workbook;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function createFilename(date) {
    var value = date instanceof Date ? date : new Date();
    return '原稿配列ジェネレーター_' +
      value.getFullYear() +
      pad2(value.getMonth() + 1) +
      pad2(value.getDate()) + '_' +
      pad2(value.getHours()) +
      pad2(value.getMinutes()) +
      pad2(value.getSeconds()) +
      '.xlsx';
  }

  return {
    DEFAULT_MAX_LINES: DEFAULT_MAX_LINES,
    parseItems: parseItems,
    parseRepeatCount: parseRepeatCount,
    createTransform: createTransform,
    toOutputText: toOutputText,
    createWorkbook: createWorkbook,
    createFilename: createFilename
  };
});
