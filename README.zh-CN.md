<div align="center">

# 🐟 Fish Notes

一款类似 [Bear](https://bear.app/zh/) 的桌面 Markdown 笔记应用 · React + Electron + TypeScript

本地优先 · AI 辅助（Claude）· 全文搜索 · 端到端加密 · 多主题 · 标签组织

[English](./README.md) · 简体中文

[![Release](https://img.shields.io/github/v/release/tangqianyu/Fish-Notes?label=下载&logo=github)](https://github.com/tangqianyu/Fish-Notes/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](https://github.com/tangqianyu/Fish-Notes/releases/latest)

![Fish Notes](./docs/screenshots/hero.png)

</div>

## 下载

前往 **[Releases 页面](https://github.com/tangqianyu/Fish-Notes/releases/latest)** 下载对应平台的安装包：

| 平台    | 文件                              |
| ------- | --------------------------------- |
| macOS   | `.dmg`（Apple Silicon / Intel）   |
| Windows | `Setup.exe`                       |

> macOS 应用未签名，首次打开若提示「无法验证开发者」，请右键点击应用图标选择「打开」，或在「系统设置 → 隐私与安全性」中放行。

## 界面预览

|              编辑器（分屏）               |               多主题                |
| :---------------------------------------: | :---------------------------------: |
| ![编辑器](./docs/screenshots/editor.png) | ![主题](./docs/screenshots/themes.png) |

## 技术栈

| 层面     | 选型                                                |
| -------- | --------------------------------------------------- |
| 桌面框架 | Electron 40 + Electron Forge + Vite 5               |
| 前端     | React 18 + TypeScript 5.7                           |
| UI/样式  | Tailwind CSS 3 + CSS Variables                      |
| 编辑器   | CodeMirror 6（Markdown 源码 + 实时高亮）            |
| 预览渲染 | marked（GFM + breaks）                              |
| 数据库   | better-sqlite3 + Drizzle ORM                        |
| 全文搜索 | SQLite FTS5                                         |
| 加密     | AES-256-GCM + scrypt                                |
| AI       | Claude Code CLI（`claude -p`，本机 OAuth token）    |
| 国际化   | i18next + react-i18next                             |
| 导出     | marked → HTML / Markdown 直写 / Electron printToPDF |
| 包管理   | yarn                                                |

## 功能

### AI（基于 Claude）

- **生成标题** — 点标题栏旁的 ✨ 按钮，一键把笔记内容概括成简洁标题
- **润色文字** — 选中任意段落，弹出气泡交给 Claude 润色，保持原意和 Markdown 语法不变
- **走你自己的 Claude Code CLI** — 在设置里粘贴一次 `claude setup-token` 生成的 OAuth token 即可；无第三方服务器，请求从你本机直连 Anthropic

> 需本机安装 [Claude Code CLI](https://docs.claude.com/en/docs/claude-code)（`npm install -g @anthropic-ai/claude-code`）。在 **设置 → AI** 中填写 token 和模型（默认 `claude-sonnet-4-6`）。

### 编辑

- **Markdown 编辑器** — 基于 CodeMirror 6，源码 + 实时高亮，4 主题适配
- **3 视图切换** — MD 源码 / Preview 渲染 / Split 左右分屏（带同步滚动），状态持久化
- **快捷输入** — 工具栏 + 键盘快捷键，覆盖加粗 / 斜体 / 标题 / 引用 / 链接 / 代码 / 列表 / 任务等
- **表格支持** — 网格选择器插入对齐表格、一键格式化整理列宽（CJK / 全角字符正确计算显示宽度）
- **智能行为** — 列表续行、空列表回车退出、括号自动闭合
- **平台感知** — 工具栏 tooltip 自动显示 `⌘` (Mac) 或 `Ctrl+` (Win/Linux)

### 组织

- **标签系统** — 通过 TagBar 直接管理，支持嵌套标签 `#parent/child`，侧边栏标签树展示
- **全文搜索** — 基于 SQLite FTS5，纯文本索引（去 Markdown 语法）
- **回收站** — 软删除、恢复、永久删除
- **置顶** — 笔记和标签都支持置顶

### 体验

- **多主题** — Light / Dark / Solarized / Anime 四套主题
- **多语言** — 中文 / 英文
- **自动保存** — 500ms 防抖，Cmd+S 立即保存
- **三栏布局** — 侧边栏 | 笔记列表 | 编辑器，可拖拽调整宽度
- **macOS 原生窗口** — 隐藏标题栏，traffic lights 集成
- **外链处理** — 预览中点击链接用系统默认浏览器打开

### 安全

- **端到端加密** — AES-256-GCM 加密笔记内容，scrypt 派生密钥
- **会话锁定** — 密钥仅缓存在内存，锁定即清除
- **加密笔记不进 FTS** — 不被搜索命中

### 媒体

- **图片支持** — 拖拽、粘贴、`![]()` 工具栏按钮三种方式
- **本地存储** — 自定义 `fish-image://` 协议，UUID 命名

### 导出

- **多格式** — Markdown (.md) / HTML (.html) / PDF (.pdf)

## 快捷键

### 编辑器视图

| 快捷键         | 功能             |
| -------------- | ---------------- |
| `Cmd/Ctrl + 1` | MD 源码模式      |
| `Cmd/Ctrl + 2` | Preview 预览模式 |
| `Cmd/Ctrl + 3` | Split 分屏模式   |

### Markdown 格式

| 快捷键                 | 功能        |
| ---------------------- | ----------- |
| `Cmd/Ctrl + B`         | 粗体        |
| `Cmd/Ctrl + I`         | 斜体        |
| `Cmd/Ctrl + Shift + S` | 删除线      |
| `Cmd/Ctrl + 1~6`       | 一~六级标题 |
| `Cmd/Ctrl + K`         | 链接        |
| `Cmd/Ctrl + E`         | 行内代码    |
| `Cmd/Ctrl + Shift + E` | 代码块      |
| `Cmd/Ctrl + Shift + .` | 引用        |
| `Cmd/Ctrl + Shift + L` | 无序列表    |
| `Cmd/Ctrl + Shift + O` | 有序列表    |
| `Cmd/Ctrl + Shift + T` | 任务列表    |

### 应用

| 快捷键         | 功能     |
| -------------- | -------- |
| `Cmd/Ctrl + S` | 立即保存 |

## 开发

```bash
# 安装依赖
yarn install

# 启动开发模式
yarn start

# ESLint 检查
yarn run lint

# Prettier 格式化
yarn run format

# 类型检查
npx tsc --noEmit

# 打包应用
yarn make
```

## 发布新版本

打包和上传由 GitHub Actions（[`.github/workflows/release.yml`](./.github/workflows/release.yml)）自动完成：推送一个 `v*` 标签即触发 macOS / Windows 两平台并行打包，产物自动上传到对应的 Release。

```bash
# 1. 更新 package.json 里的 version，提交
# 2. 打标签并推送
git tag v1.0.1
git push origin v1.0.1
```

几分钟后到 [Releases](https://github.com/tangqianyu/Fish-Notes/releases) 查看自动生成的发布与安装包。

> macOS 产物未做代码签名 / 公证。如需消除「无法验证开发者」提示，需配置 Apple 开发者证书并在 workflow 中加入签名步骤。

## 项目结构

```
src/
├── main.ts                              # Electron 主进程入口
├── preload.ts                           # IPC 桥接，暴露 window.api
├── main/
│   ├── database/                        # SQLite 数据层（schema, CRUD, FTS5, 迁移）
│   ├── ipc/                             # IPC 处理器（笔记/标签/搜索/加密/导出）
│   ├── export/                          # 导出模块（Markdown/HTML/PDF）
│   ├── markdown.ts                      # 共享 MD 工具（marked、turndown、strip、detect）
│   ├── encryption.ts                    # AES-256-GCM + scrypt
│   └── images.ts                        # fish-image:// 协议图片存储
└── renderer/
    ├── main.tsx                         # React 入口
    ├── App.tsx                          # 根组件 + providers
    ├── index.css                        # Tailwind + CodeMirror + Markdown 预览样式
    ├── components/
    │   ├── Layout.tsx                   # 三栏布局 + 快捷键
    │   ├── Sidebar.tsx                  # 侧边栏（导航 + 标签树）
    │   ├── NoteList.tsx                 # 笔记列表
    │   ├── Editor.tsx                   # 编辑器容器 + 导出菜单
    │   ├── TagBar.tsx                   # 标签管理栏
    │   ├── TitleBar.tsx                 # macOS 拖拽区域
    │   ├── SearchBar.tsx                # 全文搜索弹窗
    │   ├── PasswordPrompt.tsx           # 密码输入弹窗
    │   ├── Settings.tsx                 # 主题 + 加密设置
    │   ├── Tooltip.tsx                  # Portal-based tooltip，支持 kbd 快捷键
    │   └── editor/
    │       ├── MarkdownEditor.tsx       # 3 Tab 切换主入口
    │       ├── CodeMirrorView.tsx       # CodeMirror 6 封装
    │       ├── MarkdownPreview.tsx      # marked 渲染 + 外链处理
    │       ├── EditorToolbar.tsx        # 工具栏（i18n + 平台快捷键）
    │       ├── TablePicker.tsx          # 8×8 表格网格选择器
    │       └── extensions/              # CodeMirror 扩展（commands / smart / image / themes）
    ├── contexts/                        # React Context（AppContext, ThemeContext）
    ├── hooks/                           # 自定义 Hooks（useAutoSave）
    ├── utils/                           # 工具函数（tagParser, mdUtils）
    ├── i18n/                            # i18n 配置 + 翻译文件
    ├── types/                           # TypeScript 类型定义
    └── styles/themes/                   # 主题 CSS 变量（4 个主题）
```

## 数据库

SQLite 文件位置：`~/Library/Application Support/Fish Notes/`（macOS）

**四张表**：

- `notes` — id, title, content (Markdown), content_text (FTS 纯文本), content_format, content_html_legacy (HTML→MD 迁移备份), created_at, updated_at, is_trashed, is_pinned, is_locked
- `tags` — id, name (unique), parent_id, is_pinned
- `note_tags` — note_id, tag_id（多对多）
- `app_settings` — key, value（密码哈希、盐值等）

启动时自动执行 schema 迁移（`database/index.ts`），含历史的 md ↔ html 双向迁移。

## License

MIT
