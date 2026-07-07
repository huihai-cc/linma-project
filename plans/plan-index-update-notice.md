# 方案：首页右侧栏「近期更新」+ 点击查看全履历

## 需求概要
1. 首页（index.html）的「📢 近期更新」从顶部位置改到**右侧栏**
2. 最多显示 5 条，最新在上
3. 点击条目可展开查看**完整诉求履历**（全部历史记录）

## 涉及文件
- `index.html` — 唯一需要修改的文件

## 更新内容数据

```javascript
const UPDATE_LOG = [
    {
        date: '2026/07/03',
        requester: '苗青',
        tool: 'Excel 対比',
        title: '新增 .xlsb 格式支持 + 浮点精度优化',
        detail: 'Excel 对比工具现在支持 .xlsb（Excel Binary Workbook）格式的上传和对比。同时优化了数值比较逻辑，之前因为 Excel 公式计算产生的微小浮点误差（如 1744.31 vs 1744.3100000000002）会被误标为差异，现在会自动四舍五入到小数点后 2 位再比较，只有真正差 0.01 以上的才会被标出来。',
        note: '',
    },
    {
        date: '2026/07/03',
        requester: '张微',
        tool: 'Amazon DSP 設定チェック',
        title: '表格行高可以调整了',
        detail: '上传表格和下载数据进行对比后，在结果显示区的「列の表示切替」下方出现了「📏 行高調整」的滑块和输入框。拖动滑块就能让表格行变大或变小，方便查看内容多的单元格。如果某个格子文字被截断了，双击格子就能展开看全部内容，再双击收回。',
        note: '点「リセット」不会重置行高设置，刷新页面也会保持你上次调好的高度。',
    },
    // 后续更新在这里追加
];
```

## UI 设计方案

### 布局变更

```
┌─ .container (grid: 1fr 280px) ─────────────────┐
│                                                  │
│  ┌─ left: accordions ──────┐  ┌─ right column ┐ │
│  │  共通ツール              │  │  📢 近期更新  │ │
│  │  1課 広告設定チェック   │  │  2026/07/03   │ │
│  │  2課 ...                │  │  ┌─────────┐  │ │
│  │  3課 ...                │  │  │ 苗青    │  │ │
│  │  定例会報告書           │  │  │ Excel対比│  │ │
│  │                          │  │  ├─────────┤  │ │
│  │                          │  │  │ 张微    │  │ │
│  │                          │  │  │ Amazon  │  │ │
│  │                          │  │  └─────────┘  │ │
│  │                          │  │  [查看全部→]  │ │
│  └──────────────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────┘
```

### 右侧栏卡片样式
- 圆角白色卡片，带阴影，与手风琴风格一致
- 左侧浅色竖条（accent bar）标识
- 标题「📢 近期更新」固定，带底部分隔线
- 每条：日期（灰色小字）+ 诉求者标签 + 标题（加粗）
- 鼠标悬停高亮
- 底部「查看全部 →」按钮

### 完整履历弹窗
- 点击条目 或「查看全部」→ 弹出半透明遮罩 + 居中模态框
- 模态框标题：「📋 更新履历」
- 列表：全部历史，最新在上
- 每条完整显示：日期、诉求者、工具、标题、详细说明、注意事项
- 底部「关闭」按钮

### 交互行为
- 右侧栏 sticky 定位（随页面滚动固定）
- 点击单个条目 → 弹出履历弹窗并定位到该条
- 点击「查看全部」→ 弹出履历弹窗从第一条开始
- 关闭弹窗 → 回到首页

## 实现步骤

### Step 1: CSS 追加（约 40 行）
追加到现有 `<style>` 中：

```css
/* ===== 右侧栏 ===== */
.container {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 20px;
    align-items: start;
}

.sidebar {
    position: sticky;
    top: 20px;
    background: white;
    border-radius: 10px;
    border: 1px solid #e4e8ed;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    overflow: hidden;
}

.sidebar-header {
    padding: 14px 16px 10px;
    font-size: 0.88rem;
    font-weight: bold;
    color: #2c3e50;
    border-bottom: 1px solid #eee;
}

.update-card {
    padding: 10px 16px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid #f0f0f0;
}
.update-card:hover { background: #f8f9fa; }
.update-card:last-child { border-bottom: none; }

.update-card-date {
    font-size: 0.7rem;
    color: #95a5a6;
}
.update-card-requester {
    display: inline-block;
    background: #3498db;
    color: white;
    border-radius: 3px;
    padding: 0 6px;
    font-size: 0.65rem;
    margin-left: 4px;
}
.update-card-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: #2c3e50;
    margin-top: 2px;
    line-height: 1.4;
}

.sidebar-footer {
    padding: 10px 16px;
    text-align: center;
    border-top: 1px solid #eee;
}
.sidebar-footer button {
    background: none;
    border: none;
    color: #3498db;
    font-size: 0.78rem;
    cursor: pointer;
    padding: 4px 12px;
}
.sidebar-footer button:hover { text-decoration: underline; }

/* ===== 履历弹窗 ===== */
.modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 20px;
    overflow-y: auto;
}
.modal-overlay.show { display: flex; }

.modal-box {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    overflow: hidden;
}
.modal-header {
    padding: 18px 24px;
    background: #1a252f;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
    font-weight: bold;
}
.modal-close {
    background: none;
    border: none;
    color: #bdc3c7;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px 8px;
}
.modal-close:hover { color: white; }

.modal-body {
    padding: 16px 24px 24px;
    max-height: 70vh;
    overflow-y: auto;
}

.modal-entry {
    padding: 14px 0;
    border-bottom: 1px solid #eee;
}
.modal-entry:last-child { border-bottom: none; }

.modal-entry-meta {
    font-size: 0.75rem;
    color: #95a5a6;
    margin-bottom: 4px;
}
.modal-entry-requester {
    background: #3498db;
    color: white;
    border-radius: 3px;
    padding: 0 6px;
    font-size: 0.65rem;
    margin-left: 4px;
}
.modal-entry-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 6px;
}
.modal-entry-detail {
    font-size: 0.82rem;
    color: #555;
    line-height: 1.6;
    white-space: pre-wrap;
}
.modal-entry-note {
    margin-top: 8px;
    padding: 8px 12px;
    background: #fff8e1;
    border-radius: 6px;
    font-size: 0.78rem;
    color: #856404;
}

/* ===== 移动端响应 ===== */
@media (max-width: 768px) {
    .container {
        grid-template-columns: 1fr;
    }
    .sidebar {
        position: static;
    }
}
```

### Step 2: HTML 结构调整（约 5 行）
将 `.container` 改为 grid 容器，追加右侧栏：

```html
<div class="container" id="mainContainer">
    <!-- 左侧：现有 accordions -->
    <div id="leftCol">
        <!-- ===== 共通ツール ===== -->
        <div class="accordion" id="acc-common"> ... </div>
        <!-- ===== 1課 ===== -->
        <div class="accordion" id="acc-ka1"> ... </div>
        ...
    </div>

    <!-- 右侧：更新栏 -->
    <div class="sidebar" id="rightSidebar">
        <div class="sidebar-header">📢 近期更新</div>
        <div id="updateCardList"></div>
        <div class="sidebar-footer">
            <button onclick="openUpdateModal()">查看全部更新 →</button>
        </div>
    </div>
</div>
```

### Step 3: JavaScript 追加（约 50 行）
在页面底部脚本中追加：

```javascript
// ===== 更新履历 =====
const UPDATE_LOG = [ /* 上面定义的数据 */ ];
const MAX_SIDEBAR = 5;

function renderSidebarUpdates() {
    const list = document.getElementById('updateCardList');
    if (!list) return;
    const items = UPDATE_LOG.slice(0, MAX_SIDEBAR);
    list.innerHTML = items.map((item, i) => `
        <div class="update-card" onclick="openUpdateModal(${i})">
            <div>
                <span class="update-card-date">${item.date}</span>
                <span class="update-card-requester">${item.requester}</span>
            </div>
            <div class="update-card-title">[${item.tool}] ${item.title}</div>
        </div>
    `).join('');
}

function openUpdateModal(focusIndex) {
    const overlay = document.getElementById('updateModal');
    if (!overlay) return;
    const body = overlay.querySelector('.modal-body');
    body.innerHTML = UPDATE_LOG.map((item, i) => `
        <div class="modal-entry" ${i === focusIndex ? 'id="modal-focus-entry"' : ''}>
            <div class="modal-entry-meta">
                ${item.date}
                <span class="modal-entry-requester">${item.requester}</span>
                <span style="color:#999;margin-left:6px;">${item.tool}</span>
            </div>
            <div class="modal-entry-title">${item.title}</div>
            <div class="modal-entry-detail">${item.detail}</div>
            ${item.note ? `<div class="modal-entry-note">⚠️ ${item.note}</div>` : ''}
        </div>
    `).join('');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        const el = document.getElementById('modal-focus-entry');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function closeUpdateModal() {
    const overlay = document.getElementById('updateModal');
    if (overlay) {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// 点击遮罩关闭弹窗
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) closeUpdateModal();
});

// 页面加载时渲染
document.addEventListener('DOMContentLoaded', function() {
    renderSidebarUpdates();
    // 原有逻辑继续保留...
});
```

追加弹窗 HTML（放在 `</div><!-- mainSection end -->` 之前或 body 末尾）：

```html
<!-- 更新履历弹窗 -->
<div class="modal-overlay" id="updateModal" onclick="closeUpdateModal()">
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <span>📋 更新履历</span>
            <button class="modal-close" onclick="closeUpdateModal()">✕</button>
        </div>
        <div class="modal-body"></div>
    </div>
</div>
```

## 注意事项
- ❌ 不要修改现有 accordion 结构和样式
- ❌ 不要修改登录/注册逻辑
- ✅ `.container` 改为 grid 布局，不影响内部元素
- ✅ 右侧栏 sticky 定位仅在桌面生效，移动端回退到单列
- ✅ 更新日志数据用 JS 数组维护，追加新条目即可
- ✅ 弹窗遮罩点击关闭
- ✅ modal 中按 Esc 键也应关闭（可加键盘事件）

## 验证步骤
1. 打开首页，确认左侧手风琴、右侧更新栏并排显示
2. 向下滚动，确认右侧栏 sticky 固定
3. 确认最多显示 5 条更新，最新在上
4. 点击某条更新 → 弹出履历弹窗，自动滚动到该条
5. 点击「查看全部更新」→ 弹出履历弹窗显示全部
6. 点击遮罩 / ✕ 按钮 → 弹窗关闭
7. 缩窄浏览器窗口到 < 768px → 右侧栏移到下方，不再 sticky

## 更新条目（首批）

| 日期 | 诉求者 | 工具 | 标题 |
|------|--------|------|------|
| 2026/07/03 | 苗青 | Excel 対比 | 新增 .xlsb 格式支持 + 浮点精度优化 |
| 2026/07/03 | 张微 | Amazon DSP 設定チェック | 表格行高可以调整了 |
