(function(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.ManuscriptArrayPage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function createPageController(elements, dependencies) {
    var Logic = dependencies.logic;
    var currentMode = 'group';
    var currentLines = [];

    function setMessage(text, type) {
      elements.message.textContent = text || '';
      elements.message.classList.toggle('error', type === 'error');
      elements.message.classList.toggle('success', type === 'success');
    }

    function setButtons(enabled) {
      elements.copyButton.disabled = !enabled;
      elements.downloadButton.disabled = !enabled;
    }

    function renderMode() {
      var groupActive = currentMode === 'group';
      elements.groupButton.classList.toggle('active', groupActive);
      elements.itemButton.classList.toggle('active', !groupActive);
      elements.groupButton.setAttribute('aria-selected', groupActive ? 'true' : 'false');
      elements.itemButton.setAttribute('aria-selected', groupActive ? 'false' : 'true');
    }

    function renderEmpty() {
      currentLines = [];
      elements.result.value = '';
      elements.inputCount.textContent = '0 件';
      elements.outputCount.textContent = '0 行';
      setButtons(false);
      setMessage('', '');
    }

    function update() {
      var result = Logic.createTransform(
        elements.source.value,
        elements.repeat.value,
        currentMode,
        Logic.DEFAULT_MAX_LINES
      );
      elements.inputCount.textContent = result.inputCount + ' 件';

      if (!result.ok) {
        currentLines = [];
        elements.outputCount.textContent = result.outputCount + ' 行';
        elements.result.value = '';
        setButtons(false);
        setMessage(result.message, 'error');
        return result;
      }

      currentLines = result.lines.slice();
      elements.outputCount.textContent = result.outputCount + ' 行';
      elements.result.value = Logic.toOutputText(currentLines);
      setButtons(true);
      setMessage('', '');
      return result;
    }

    function setMode(mode) {
      if (mode !== 'group' && mode !== 'item') {
        return false;
      }
      currentMode = mode;
      renderMode();
      update();
      return true;
    }

    async function copy() {
      if (currentLines.length === 0) {
        setMessage('コピーできる変換結果がありません。', 'error');
        return false;
      }
      try {
        await dependencies.copyText(Logic.toOutputText(currentLines));
        setMessage(currentLines.length + '行をコピーしました。', 'success');
        return true;
      } catch (error) {
        setMessage('クリップボードにコピーできませんでした。', 'error');
        return false;
      }
    }

    function download() {
      if (currentLines.length === 0) {
        setMessage('ダウンロードできる変換結果がありません。', 'error');
        return false;
      }
      try {
        dependencies.downloadLines(currentLines.slice());
        setMessage('Excelファイルをダウンロードしました。', 'success');
        return true;
      } catch (error) {
        setMessage('Excelファイルを作成できませんでした。', 'error');
        return false;
      }
    }

    function clearAll() {
      elements.source.value = '';
      elements.repeat.value = '1';
      renderEmpty();
    }

    renderMode();
    renderEmpty();

    return {
      update: update,
      setMode: setMode,
      copy: copy,
      download: download,
      clearAll: clearAll,
      getMode: function() { return currentMode; },
      getLines: function() { return currentLines.slice(); }
    };
  }

  return {
    createPageController: createPageController
  };
});
