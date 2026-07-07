# AI Team 工作站操作手册

## 🎯 核心理念

```
🧠 我 (Claude)   = 想（规划 / 审查 / 发号施令）
💻 Codex         = 做（读取计划 / 写代码 / 实现）
⚙️ CC (CLI)      = 跑（部署 / 批量任务 / 自动化）
```

---

## 🖥️ VSCode 窗口布局设置

### 第一步：左侧面板放 Codex

1. 点击 VSCode 左侧活动栏的 **Codex 图标**
2. 右键 Codex 面板标题 → **Move to Primary Side Bar**（保持在左侧）
3. 如果 Codex 已经左侧了，跳过

### 第二步：底部 Terminal 分两栏

1. `Ctrl+`` 打开 Terminal
2. 点击 Terminal 右上角 **Split Terminal**（分栏图标）
3. **Tab 1**: `claude` → 进入交互模式（这是我）
4. **Tab 2**: 保留为 Shell（跑 git、npm、`claude -p` 等）

### 第三步：右侧布局

默认 VSCode 右侧就是 Explorer + 编辑器区，创建新文件或预览效果时：

- 浏览文件：点击左侧活动栏 Explorer 图标（或拖到右侧）
- 预览页面：`Ctrl+Shift+P` → `Simple Browser: Show` → 输入 `http://localhost:5500`

> 💡 推荐安装 [Live Server](vscode:extension/ritwickdey.LiveServer) 扩展，右键 HTML 文件选 "Open with Live Server"

---

## 🔄 日常工作流

### 场景 1：实现新功能

```
你: "我想加一个XX工具"

[我]  /plan -- 输出 PLAN.md
     ↓
[你]  告诉 Codex: "读取 PLAN.md，按步骤 1 开始实现"
     ↓
[Codex] 写代码
     ↓
[我]  /code-review 审查改动
     ↓  ⬅ 如果有问题，Codex 修正后我再看一遍
[CC]  git commit + deploy
     ↓
[Browser] 预览确认
```

### 场景 2：修 Bug

```
你: "XX功能有bug"

[我]  分析问题 → 输出修复方案（附在 PLAN.md）
     ↓
[Codex] 读取方案 → 修代码
     ↓
[我]  审查修复
     ↓
[Browser] 验证修复效果
```

### 场景 3：代码审查已有改动

```
你: "帮我审查一下改动的代码"

[我]  /code-review high
     ↓
[我]  输出审查报告 → 需要改的地方
     ↓
[Codex] 按报告修改
     ↓
[我]  /code-review 再次确认
```

---

## 📝 关键命令速查

### 对我（Claude - Terminal Tab1）

| 命令 | 作用 |
|------|------|
| `/plan 实现XX` | 出方案计划，输出 PLAN.md |
| `/code-review` | 审查当前改动 |
| `/code-review high --fix` | 审查并自动修复 |
| 直接聊天说需求 | 我帮你想方案 |

### 对 Codex（左侧面板）

| 操作 | 作用 |
|------|------|
| "读取 WORKFLOW.md" | 让 Codex 了解工作流程 |
| "读取 PLAN.md，按步骤1实现" | 开始执行计划 |
| "修改 XX 文件的 YY 问题" | 具体修改任务 |
| "帮我看一下这个文件的实现" | Codex 解释代码 |

### 对 CC（Terminal Tab2）

| 命令 | 作用 |
|------|------|
| `claude -p "读取PLAN.md并部署"` | 让 CC 执行计划中的部署步骤 |
| `git add . && git commit -m "msg"` | 提交代码 |
| `npm install xx` | 安装依赖 |

---

## 📋 模板文件

### PLAN.md 模板

项目根目录的 `PLAN.md` 是核心桥梁文件，我每次出方案都会按此格式输出：

```markdown
# 方案：[功能名称]

## 需求概要
一句话描述要做什么

## 架构设计
- 涉及文件：xxx.html, xxx.js
- 核心逻辑：如何实现
- UI 变更：什么样子

## 实现步骤
- [ ] Step 1: 创建/修改 xxx
- [ ] Step 2: 实现核心逻辑
- [ ] Step 3: 联调测试

## 注意事项
- 潜在坑点
- 边界情况
```

---

## ✅ 快速启动清单

第一次用这套工作流时：

1. [ ] 左侧面板确认 Codex 已就位
2. [ ] Terminal 分两栏：`claude` + Shell
3. [ ] 安装 Live Server 扩展
4. [ ] 测试走一遍：让我出个方案 → Codex 实现 → 我审查
