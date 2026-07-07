# PLAN.md

## 项目
my-qc-web
文件: C:\Users\BPO\Desktop\my-qc-web\amazon_dsp_check.html

## 执行模式
- Roo Code 模式: Code（通用编码）

## 当前问题
行高调整功能已部分实现（SC_ROW_HEIGHT + 滑块），但有以下问题需要修复：

### 问题 1：重新渲染时行高重置
`renderSCResult()` 函数末尾（line 4152）写死了 `SC_ROW_HEIGHT = 28`，每次切换系统或重新运行检查，用户调整的行高都会丢失。

### 问题 2：列宽调整后不持久化
列宽拖拽调整（scColResizeStart / scColResizeLI）只在当前渲染有效，切换系统或重新检查后列宽回到默认值。

## 修复方案

### Fix 1：行高保持用户设定
- 删除 line 4152 的 `SC_ROW_HEIGHT = 28;`
- 在 `scUpdateRowHeight()` 中将当前值保存到 `sessionStorage.setItem('sc_row_height', val)`
- 在脚本加载时（约 line 244 附近），从 `sessionStorage.getItem('sc_row_height')` 读取恢复
- 滑块 input 的 value 也要用恢复后的值

### Fix 2：列宽持久化
- 在 `_scColResizeEnd()` 中保存当前所有列宽到 `sessionStorage`
  - 格式：`{ col_0: 120, col_1: 150, col_li: 180, col_no: 40 }`
- 在 `renderSCResult()` 渲染表格时，从 sessionStorage 读取已保存的列宽
  - COL_NO_W / COL_LI_W / COL_ITEM_W 使用保存值，没有保存值时才用默认值
- 列的唯一标识用 col.key（如 "Line Item Type"、"Brand suitability content exclusion categories" 等）

### Fix 3：正确应用行高到所有元素
确保以下元素都使用 `${SC_ROW_HEIGHT}px`：
- IO 名行（data-io-header）的 height
- "见つかりませんでした" 行的 height
- 所有 td、tr 元素

## 实现步骤
1. 添加 sessionStorage 读写函数（saveRowHeight / loadRowHeight / saveColWidths / loadColWidth）
2. 修改 scUpdateRowHeight() 加入保存逻辑
3. 删除 line 4152 的 `SC_ROW_HEIGHT = 28;`
4. 修改 renderSCResult() 从 sessionStorage 恢复列宽
5. 修改 _scColResizeEnd() 保存当前列宽
6. 确保滑块初始值从 sessionStorage 读取
