# Amazon DSP 行高调整诊断记录

日期：2026-07-03

## 诊断对象

- 文件：`amazon_dsp_check.html`
- 范围：Amazon DSP 設定チェック結果表格的行高调整控件
- 样本目录：`D:\業務用\5月\测试数据\测试用文件\設定用`

## 诊断结果

1. 本地页面通过 `http://127.0.0.1:56959/amazon_dsp_check.html` 打开，登录后可进入 Amazon DSP 工具页。
2. 页面源码中存在 `#sc-main-table`、行高 slider/input、`window.scUpdateRowHeight`。
3. 浏览器自动化的 `evaluate` 运行在隔离只读环境，无法可靠读取页面主环境的 inline 全局函数，因此 `typeof window.scUpdateRowHeight` 在自动化诊断中显示为 `undefined`，判定为工具环境限制，不作为页面实际结果。
4. 使用 Node VM 对 `amazon_dsp_check.html` 内脚本做语法与执行检查，主脚本可完整执行，并能挂载 `window.scUpdateRowHeight`、`window.runSettingCheck` 等函数。
5. 定位到原实现只对 `#sc-main-table td` 设置 `height`。结果表存在两行一组结构及 `rowspan="2"` 单元格，仅设置 `td.style.height` 时，表格行高可能不按预期同步变化。

## 采用方案

采用计划中的方案 A：

- 在 `scUpdateRowHeight` 中遍历 `#sc-main-table tbody tr`
- 跳过含 `td[data-io-header]` 的 IO 标题行
- 同时给数据行 `tr` 和行内 `td` 设置 `height`
- 保留 `ondblclick` 中折叠高度值的动态替换逻辑

## 验证

- `amazon_dsp_check.html` 内 4 段脚本语法检查均通过。
- 静态检查确认：
  - 設定表行 `<tr>` 已添加 `height:${SC_ROW_HEIGHT}px`
  - ダウンロード值行 `<tr>` 已添加 `height:${SC_ROW_HEIGHT}px`
  - not found 行已补充动态高度
  - `scUpdateRowHeight` 已改为遍历 `#sc-main-table tbody tr`
  - IO 标题行仍通过 `td[data-io-header]` 跳过

## 未完成项

由于当前浏览器自动化接口未暴露文件上传 API，未能由 Codex 自动完成 Excel 上传后的拖动滑块实测。需要在页面中手动上传一组 Amazon DSP 样本后确认：

- slider 调到 80px 时数据行变高
- number 输入 200 时数据行变为约 200px
- 输入 10 时被 clamp 到 20px
- 切换过滤/IO 过滤后行高仍有效
