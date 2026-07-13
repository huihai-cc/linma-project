# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

惠海 QC ポータル — BPO业务用品质检查工具集合。纯前端HTML/JS单页应用，通过手风琴面板组织多个QC工具，含邮件注册登录系统，部署于Vercel。

## 相关项目

| 目录 | 内容 |
|------|------|
| `C:\Users\BPO\Desktop\AP財務\` | JFM财务数据抽取（Python + openpyxl/xlrd），RPA脚本 |
| `C:\Users\BPO\Desktop\TL業務\tl_tool\` | Meta广告报表自动化（Python + Playwright），Chrome扩展 |
| `C:\Users\BPO\Desktop\自動転記\` | Excel自动转记 |

## 技术栈

- **前端**: 纯HTML/CSS/JS，无框架，SheetJS(xlsx)处理Excel，jsZip处理ZIP
- **后端**: 无（纯静态站点），Supabase用于认证
- **部署**: Vercel (`html-deploy` skill)

## 项目结构

```
my-qc-web/
├── index.html              # 主入口 + 登录/注册 + 手风琴工具导航
├── dv360_check.html        # DV360設定チェック（5层树形对比）
├── amazon_dsp_check.html   # Amazon DSP設定チェック
├── excel_compare.html      # Excel文件对比
├── excel_clean.html        # Excel清洗
├── image_compare.html      # 图片对比
├── tools_text.html         # 文本处理工具（多Tab）
├── upload.html             # 读卖専用チェックツール
├── yomiko_kanri.html       # 读卖管理
├── bpo_weekly_report_malin.html  # 定例会报告书
├── xlsx.full.min.js        # SheetJS
├── jszip.min.js            # JSZip
└── encoding.min.js         # 编码处理
```

## 新QC工具创建规范

所有工具HTML遵循统一模板：
1. **Header**: `background:#2c3e50`，标题 + badge标签
2. **Back-nav**: `background:#34495e`，返回主页按钮（`<a href="index.html">`）
3. **Body**: 上传区（虚线拖拽区）+ 控制栏 + 结果展示
4. **样式**: `font-family:'Segoe UI','Noto Sans SC'`，`background:#f5f5f5`
5. **按钮**: `.btn-primary`(红) / `.btn-secondary`(灰)
6. **工具需在index.html的手风琴中注册卡片链接**

## Python脚本规范（AP財務 / TL業務）

- 编码: UTF-8，路径用 `os.path.join()` + 绝对路径
- Excel: `openpyxl`(xlsx) / `xlrd`(.xls)，`data_only=True` 读取计算值
- 备份: 写入前自动备份到 `_backups/` 目录（时间戳命名）
- 日志: 分Phase输出，`[WARN]`/`[ERROR]` 前缀
- 财年: 4月~翌年3月

## Git规范

- 分支: 直接在main开发
- 提交信息: 中文，简洁描述改动内容
- Co-Authored-By: Claude <noreply@anthropic.com>

## 语言

- 代码注释: 中文或日文
- 用户界面: 中文/日文混用
- AI对话: 中文
