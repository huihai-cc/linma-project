# 计划：Amazon DSP 行高调整功能修复

## 1. 问题现象确认

- **功能**: Amazon DSP 設定チェック結果表格可修改行高
- **当前表现**: 结果栏右上角有行高滑块(20-80px)和数字输入框(20-200px)，但拖动/输入后行高无变化
- **期望表现**: 拖动滑块或输入数值后，所有数据行的高度同步改变
- **严重度**: 中（功能缺失，但不影响对比结果正确性）

## 2. 需要检查的文件

| 文件 | 用途 |
|------|------|
| `amazon_dsp_check.html` | 唯一需要修改的文件（单页应用，全部逻辑在此） |

## 3. 可能原因列表（按排查优先级排列）

### P0 - 高概率

1. **`#sc-main-table` 选择器匹配失败**
   - `scUpdateRowHeight` 中使用 `document.querySelectorAll('#sc-main-table td')`
   - 表ID是 `id="sc-main-table"`，但渲染在 `result.innerHTML=html` 后
   - 需要确认 DOM 中确实存在该 ID 的元素

2. **`SC_ROW_HEIGHT` 变量闭包引用问题**
   - `let SC_ROW_HEIGHT = 28` 定义在 IIFE 内
   - `window.scUpdateRowHeight` 也声明在 IIFE 内，闭包可访问
   - 但 inline 事件 `oninput="scUpdateRowHeight(this.value)"` 解析为全局查找
   - 需确认 `window.scUpdateRowHeight` 是否真的存在（函数后面没有语法错误提前终止）

3. **`td.style.height` 在表格布局中无效**
   - 表使用 `table-layout:fixed`
   - 浏览器可能不遵守 `td` 上的 CSS `height`，改用 `min-height` 或忽略
   - 如果表格单元格的内容撑不开指定高度，浏览器可能不需要填满指定高度

### P1 - 中概率

4. **`border-bottom:3px` 和 `border-collapse:collapse` 组合问题**
   - 下载行有 `border-bottom: 3px solid #ddd`
   - `border-collapse: collapse` 后边距合并可能导致高度计算偏差

5. **rowspan 单元格干扰行高**
   - LI名称和No.列使用 `rowspan="2"`
   - 如果不给 rowspan 单元格设 height，两行的总高度可能由 rowspan 单元格内容决定，而非独立行的 height

6. **`overflow:hidden` + `white-space:nowrap` 组合引起截断但不改变行高**
   - height 设置后内容被截断，但行高实际未变

### P2 - 低概率

7. **使用 `addEventListener` 和 inline `oninput` 双重绑定导致冲突**
   - 渲染时既有 `oninput` 属性，又有 `setTimeout` 中 `addEventListener('input')`
   - 两者都会触发，但应该不会互相影响

8. **滑块事件未正确触发**
   - 滑块的 `step="2"` 导致值总是偶数，可能和预期不符但不是功能性问题

## 4. 复现步骤

1. 用浏览器打开 `amazon_dsp_check.html`
2. 选择「Amazon DSP（Display）」子类型
3. 拖入一个設定表 Excel 文件（如 `AS_XXXX_設定シート.xlsx`）
4. 拖入一个ダウンロードデータ Excel 文件（如 `Display line items.xlsx`）
5. 点击「🔍 チェック開始」
6. 等待对比结果渲染
7. 观察结果栏右上角的「行高」滑块和输入框
8. 拖动滑块到最大值 80，或输入框输入 80
9. 预期：所有数据行的行高变为 80px
10. 实际：行高无变化

## 5. 修改策略

### 5.1 诊断步骤（Codex 先在 Console 中验证）

```javascript
// 打开 DevTools Console 执行以下诊断:

// 1) 确认函数存在
typeof window.scUpdateRowHeight   // 应为 "function"

// 2) 确认表存在
document.querySelectorAll('#sc-main-table').length   // 应为 1

// 3) 确认 td 单元格存在
document.querySelectorAll('#sc-main-table td').length  // 应 > 0

// 4) 手动调用测试
scUpdateRowHeight(80)
document.querySelector('#sc-main-table td').style.height  // 应为 "80px"

// 5) 检查高度是否在渲染后实际生效
document.querySelector('#sc-main-table td').offsetHeight  // 应为 80
```

### 5.2 修复方案（根据诊断结果选择）

**方案A（如果 `td.style.height` 被浏览器忽略）**：
- 改为在 `<tr>` 上设置行高（`rowHeight` 对 `tr` 更可靠）
- 选择器改为 `#sc-main-table tr.sc-li-row` 跳过 IO 标题行
- 使用 `tr.style.height = val + 'px'`
- 同时保留 `td` 的 `vertical-align: middle` 让内容垂直居中

**方案B（如果 `#sc-main-table` ID 选择失败）**：
- 改用 class 选择或更具体的父级选择器
- 确认 `id` 在 `innerHTML` 渲染后确实在 DOM 中
- 添加后备选择器

**方案C（如果 rowspan 干扰）**：
- 在设置高度时，确保 rowspan 单元格也获得相同高度
- 或者只设置行内非 rowspan 单元格的高度，让 rowspan 自动适应

**方案D（最稳健 - 推荐）**：
- 不依赖 CSS height
- 使用 `<tr><td style="line-height: Xpx">...</td></tr>` 方式
- 或者设置 `td` 的 `min-height` + `height` 双重确保

### 5.3 具体修改点

**必须修改的部分：**

1. **`amazon_dsp_check.html` — `scUpdateRowHeight` 函数**
   - 位置：约第 4293 行
   - 需改为在 `<tr>` 上设 `height`（而非 `<td>`）
   - 选择器改为 `#sc-main-table tr.sc-li-row`
   - 需要跳过 IO 标题行（无 `sc-li-row` class）

2. **`amazon_dsp_check.html` — 行渲染模板**
   - 位置：约第 3945-3954 行（设定値行）、3971-4003 行（下载値行）
   - 目前的 `height:${SC_ROW_HEIGHT}px` 在 `<td>` 上可以保留作为后备
   - 如方案A有效，需在 `<tr>` 上也添加 `style="height:${SC_ROW_HEIGHT}px"`

3. **`amazon_dsp_check.html` — 未找到行（notfound）**
   - 位置：约第 3924-3930 行
   - 也需要给 `<td>` 添加 `height` 或让行高一致

4. **`amazon_dsp_check.html` — IO 分组标题行**
   - 位置：约第 3855 行
   - 保持 `data-io-header="1"` 属性被 `scUpdateRowHeight` 跳过

## 6. 验证步骤

1. **功能验证**（浏览器中操作）：
   - 打开 `amazon_dsp_check.html`
   - 上传测试文件 → 执行对比 → 拖动滑块到 80
   - 确认所有数据行高度变为约 80px
   - 再拖动到 30 → 确认高度缩小
   - 双击某个单元格 → 展开内容 → 再双击 → 折叠回设定高度

2. **边缘情况验证**：
   - 数字输入框输入 200 → 确认高度变为 200px
   - 数字输入框输入 10（低于最小值）→ 确认被 clamp 到 20
   - 切换「不一致のみ」过滤模式 → 确认高度依然有效
   - 切换 IO 过滤 → 确认高度依然有效
   - 点击「リセット」→ 重新对比 → 确认高度重置为 28px

3. **回归验证**：
   - 确认对比结果本身（一致性判断、差异信息）不受影响
   - 确认寄存LI、列显隐、列宽拖动等功能不受影响
   - 确认 PVA/OTT 子类型切换正常

## 7. 给 Codex 的执行指令

> 👋 Codex，请执行以下任务：

### Step 1: 诊断
打开 `amazon_dsp_check.html`，在 DevTools Console 中执行：

```js
// 1a: 确认函数
console.log('scUpdateRowHeight:', typeof window.scUpdateRowHeight);
console.log('SC_ROW_HEIGHT:', window.SC_ROW_HEIGHT);

// 1b: 确认 DOM
console.log('#sc-main-table count:', document.querySelectorAll('#sc-main-table').length);
console.log('td count:', document.querySelectorAll('#sc-main-table td').length);

// 1c: 测试调用
if (typeof window.scUpdateRowHeight === 'function') {
  scUpdateRowHeight(80);
  const firstTd = document.querySelector('#sc-main-table td');
  console.log('After set td.style.height:', firstTd.style.height);
  console.log('After set td.offsetHeight:', firstTd.offsetHeight);
}
```

将输出结果记录在 `plans/diagnosis-output.md`。

### Step 2: 确定修复方案
根据诊断结果选择 5.2 中的方案：
- 如果 `td.style.height` 变了但 `offsetHeight` 没变 → 用方案A（tr 上设 height）
- 如果 `#sc-main-table` 没找到 → 用方案B
- 如果有 JS 错误 → 修复语法/引用问题

推荐优先尝试 **方案A**（最稳妥，直接控制行高）。

### Step 3: 实施修改

**3a：修改 `scUpdateRowHeight` 函数**
将目标从 `<td>` 改为 `<tr>`：

```js
// 在 #sc-main-table 中找所有数据行（非IO标题的tr）
document.querySelectorAll('#sc-main-table tbody tr').forEach(tr => {
  // 跳过IO分组标题（有 data-io-header 的 td 所在的 tr）
  if (tr.querySelector('td[data-io-header]')) return;
  tr.style.height = val + 'px';
  // tr 下的 td 也同步设置（双重保险）
  tr.querySelectorAll('td').forEach(td => {
    td.style.height = val + 'px';
  });
});
```

**3b：修改渲染模板**
- 在设定値行的 `<tr>` 上添加 `style="height:${SC_ROW_HEIGHT}px"`
- 在下载値行的 `<tr>` 上添加 `style="height:${SC_ROW_HEIGHT}px"`
- 在 not found 行的 `<tr>` 上添加 `style="height:${SC_ROW_HEIGHT}px"`
- IO 标题行不需要加（保持 `height:36px`）

**3c：更新 ondblclick**
- `td` 的 `ondblclick` 中的高度值保持用 `${SC_ROW_HEIGHT}` 变量（已有）
- `scUpdateRowHeight` 中的正则替换逻辑保留

### Step 4: 验证
按第 6 节的验证步骤逐条操作，确认修复有效。

### Step 5: 提交
```bash
git add amazon_dsp_check.html
git commit -m "fix: Amazon DSP行高调整功能修复

- 改为在 <tr> 上设 height 确保行高生效
- 渲染模板中 <tr> 也添加动态高度
- 保留 td 高度作为双重保障
- 不改变现有对比逻辑

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 注意事项

- ❌ **不要重构**。只修复行高问题，不改变文件结构、不重写函数、不优化代码
- ❌ **不要修改对比逻辑**。`checkAmazon`, `matchAndCompareDSP`, `matchAndCompareVideo` 等核心函数禁止触碰
- ❌ **不要在 IO 标题行上加高度**。IO 标题保持 `height:36px;line-height:36px`
- ✅ **双重写保障**：`tr` 和 `td` 都设 `height`，浏览器至少会认一个
- ✅ **保留 grid 布局**：表和列的宽度（`table-layout:fixed` + `colgroup`）不要改动
- ✅ **修完必须验证**：用 Live Server 打开页面实际上传文件测试
