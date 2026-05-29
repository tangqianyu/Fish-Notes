# Fish Notes

Bear 风格的笔记应用，使用 React + Electron + TypeScript 构建。

## 技术栈

- **桌面**: Electron 40 + Electron Forge + Vite 5
- **前端**: React 18 + TypeScript 5.7 + Tailwind CSS 3
- **编辑器**: CodeMirror 6（Markdown 源码 + 实时高亮）+ marked（预览渲染）
- **数据库**: SQLite (better-sqlite3) + Drizzle ORM + FTS5 全文搜索
- **架构**: Main/Renderer 进程分离，通过 IPC 通信

## 常用命令

```bash
yarn start          # 启动开发环境
yarn run lint       # ESLint 检查
yarn run format     # Prettier 格式化
yarn run package    # 打包应用
yarn run make       # 生成安装包
npx tsc --noEmit    # 类型检查（忽略 MAIN_WINDOW_VITE 相关错误，那些是 Forge 注入的全局变量）
```

## 项目结构

```
src/
├── main.ts                              # Electron 主进程入口
├── preload.ts                           # IPC bridge，暴露 window.api
├── main/
│   ├── database/
│   │   ├── index.ts                     # DB 初始化，WAL 模式，FTS5，迁移（含历史 md↔html 双向迁移）
│   │   ├── schema.ts                    # Drizzle schema: notes, tags, noteTags
│   │   ├── notes.ts                     # 笔记 CRUD + 加密/解密 + 解锁时 legacy HTML→MD 转换
│   │   ├── tags.ts                      # 标签管理（增删改查、置顶、重命名）
│   │   └── search.ts                    # FTS5 搜索（索引 content_text 纯文本）
│   ├── ipc/
│   │   ├── handlers.ts                  # 主 IPC handler 注册（含加密相关）
│   │   └── exportHandlers.ts            # 导出（Markdown/HTML/PDF）
│   ├── export/                          # 导出实现（Markdown 直接写、HTML/PDF 用 marked 渲染）
│   ├── markdown.ts                      # 共享 MD 工具：htmlToMarkdown / markdownToHtml / strip / detect
│   ├── encryption.ts                    # AES-256-GCM 加密 + scrypt 密码哈希
│   └── images.ts                        # 图片存储管理（fish-image:// 协议，UUID 命名）
├── renderer/
│   ├── main.tsx                         # React DOM 入口
│   ├── App.tsx                          # 根组件 + providers
│   ├── index.css                        # Tailwind + CodeMirror + Markdown 预览样式
│   ├── components/
│   │   ├── Layout.tsx                   # 三栏布局（侧边栏/笔记列表/编辑器），可拖拽调整
│   │   ├── Sidebar.tsx                  # 标签树 + 导航 + 右键菜单
│   │   ├── NoteList.tsx                 # 当前视图的笔记列表 + 加密右键菜单
│   │   ├── Editor.tsx                   # 编辑器容器，useAutoSave + 导出菜单 + 加密锁定
│   │   ├── TagBar.tsx                   # 标签管理栏
│   │   ├── TitleBar.tsx                 # macOS 拖拽区域
│   │   ├── Tooltip.tsx                  # 通用 tooltip（portal、200ms 延迟、kbd 样式快捷键）
│   │   ├── editor/
│   │   │   ├── MarkdownEditor.tsx       # 主入口：MD/Preview/Split 三 Tab 切换 + 工具栏 + 同步滚动
│   │   │   ├── CodeMirrorView.tsx       # CodeMirror 6 封装（接口: defaultValue + onChange）
│   │   │   ├── MarkdownPreview.tsx      # marked 渲染 + prose 样式 + hashtag span + 外链处理
│   │   │   ├── EditorToolbar.tsx        # Markdown 快捷输入工具栏（Tooltip + 平台感知快捷键）
│   │   │   ├── TablePicker.tsx          # 8×8 网格选择器（hover 高亮、点击插入对齐表格）
│   │   │   └── extensions/
│   │   │       ├── markdownCommands.ts  # 工具栏 + 键盘共享命令（toggleBold/List/insertTable/formatTable...）
│   │   │       ├── smartTyping.ts       # 列表续行 / 空列表退出 keymap
│   │   │       ├── imageHandling.ts     # 拖拽/粘贴图片 → fish-image:// 协议
│   │   │       └── themes.ts            # 4 个 app 主题对应的 CodeMirror 主题
│   │   ├── SearchBar.tsx                # 全文搜索弹窗
│   │   ├── PasswordPrompt.tsx           # 密码输入弹窗（加密功能）
│   │   └── Settings.tsx                 # 主题设置（light/dark/solarized/anime）+ 密码管理
│   ├── contexts/
│   │   ├── AppContext.tsx               # 全局状态：笔记、标签、视图模式、标签管理 actions、加密状态
│   │   └── ThemeContext.tsx             # 主题状态
│   ├── hooks/useAutoSave.ts            # 500ms 防抖保存
│   ├── utils/
│   │   ├── tagParser.ts                # 构建标签树
│   │   └── mdUtils.ts                  # stripMarkdown / extractTitleFromMarkdown / buildNotePreview
│   ├── styles/themes/variables.css     # CSS 变量（四个主题 + 标签颜色）
│   └── types/global.d.ts              # window.api 类型定义
```

## 核心数据流

### 编辑保存
- **内容保存**: 用户输入 → CodeMirror updateListener → MarkdownEditor.handleChange → Editor.handleChange（跳过无变化内容）→ useAutoSave(500ms 防抖) → AppContext.updateNoteContent → stripMarkdown 提取纯文本 → IPC 保存 content + contentText 到 SQLite + dispatch 更新状态
- **标题保存**: title input onChange → 独立的 useAutoSave(500ms) → updateNoteTitle → IPC 保存
- **快捷保存**: Cmd+S 由 CodeMirror keymap 捕获，绕过防抖直接触发 onSave

### 编辑器（CodeMirror 6 + marked）

**接口稳定性**: `MarkdownEditor` 对外接口和原 `TinyMCEEditor` 保持一致：`{ defaultValue: string, onChange: (md: string) => void }`，上层 Editor.tsx 几乎零修改。

**3 Tab 切换**: MD（纯源码）/ Preview（纯渲染）/ Split（左右分屏，百分比同步滚动）。状态持久化到 localStorage（`fish-notes:editor-mode`）。Cmd+1/2/3 切换。

**工具栏**: 默认显示，覆盖 B/I/S/H(下拉 1-6)/quote/link/inline-code/code-block/ul/ol/task/image/hr/table-picker/format-table。每个按钮带 Tooltip（label + 平台感知 kbd 快捷键），通过 localStorage `fish-notes:editor-toolbar` 控制显隐。

**Markdown 快捷输入**（4 层叠加）:
1. **键盘快捷键**: Cmd+B/I/E/K/Shift+S/Shift+E/Shift+L/Shift+O/Shift+T/Shift+. + Cmd+1~6（标题）
2. **工具栏按钮**: 复用第 1 层的 command 实现；`HeadingMenu`/`TableMenu` 是带 dropdown 的复合按钮
3. **Slash 命令**: 暂未实现（Phase 2）
4. **智能行为**: closeBrackets 自动闭合括号、列表续行（Enter）、空列表回车退出

**表格支持**:
- `insertTable(rows, cols)` 命令插入对齐的空表模板，光标落在首个 header 单元格
- `formatTable` 命令检测光标当前行所在的表格，找每列最大宽度，重排所有单元格 padding 一致，保留对齐标记（`:--` / `--:`）
- `TablePicker` 是网格选择器组件，hover 高亮左上区域，顶部显示 "N × M"，点击触发 `insertTable`

**主题适配**: `extensions/themes.ts` 为 4 个 app 主题各写一份 EditorView.theme + HighlightStyle，通过 `useTheme()` 选择。编辑器以 `noteId-theme-language` 为 React key，主题/语言切换时完全重建。

**图片处理**: `imageHandling.ts` 在 CodeMirror DOM 上挂 drop/paste 事件 → window.api.images.saveFromBuffer → 插入 `![](fish-image://uuid)`。

**外部链接**: `MarkdownPreview` 渲染后 regex 给所有 `<a>` 加 `target="_blank" rel="noopener"`，再加一层 click 兜底拦截 http/https/mailto/tel 协议调 `window.open(href, '_blank')`，最终由 main.ts 的 `setWindowOpenHandler` 路由到 `shell.openExternal`，用系统默认浏览器打开。

### 标签系统
- **标签管理**: 标签通过 TagBar 的 `+` 按钮直接添加/移除，不从编辑器内容中自动解析
- **嵌套标签**: `#parent/child/grandchild`，`/` 分隔，数据库存储完整路径，侧边栏通过 `buildTagTree()` 动态构建树形结构
- **TagBar**: 显示当前笔记标签（蓝色药丸 + × 移除），`+` 按钮弹出搜索框，可选择已有标签或输入新名称创建
- **侧边栏**: 树形展示所有标签，显示笔记数量（排除已删除），缩进表示层级（每级 16px）
- **右键菜单**: 置顶/取消置顶、重命名、删除标签；菜单自动调整位置防溢出
- **置顶**: 置顶标签排在最前，显示 📌 图标，状态通过 `tags.isPinned` 持久化
- **自动标签**: 在标签视图下新建笔记时自动添加该标签
- **清理**: 移除标签后调用 `cleanupUnused()` 删除孤立标签

### 笔记加密系统
- 使用 AES-256-GCM 对笔记内容进行端到端加密，密码通过 scrypt 哈希
- 用户在 Settings 中设置密码，密码哈希和盐值存储在 `app_settings` 表
- 会话管理: 验证密码后密钥缓存在内存中，锁定会话时清除
- 加密笔记的 `content_text` 被清空（从 FTS 索引中移除，不可搜索）
- 修改密码时自动用新密钥重新加密所有已加密笔记
- 移除密码时自动解密所有笔记
- Editor 打开加密笔记时先弹出 PasswordPrompt，验证后获取解密内容
- NoteList 右键菜单支持"加密笔记"/"移除加密"操作
- **Legacy HTML 自动转换**: 编辑器切换到 Markdown 之前已加密的笔记在解锁/移除密码时，decrypt 后自动经 turndown 转 Markdown 并改写 `content_format='markdown'`
- IPC: `window.api.encryption.*`（密码管理）+ `window.api.notes.lock/unlock/getDecrypted`

### 图片系统
- 支持拖拽、粘贴、`![]()` 工具栏按钮三种方式插入图片
- 图片存储在 `~/.config/Fish Notes/images/`，UUID 命名
- 自定义 `fish-image://` 协议访问本地图片
- IPC: `window.api.images.saveFromPath()` / `saveFromBuffer()` / `pickFile()`
- 支持格式: PNG, JPEG, GIF, WebP, BMP, SVG

### IPC 通信
renderer 通过 `window.api.*` 调用 → preload.ts → ipcRenderer.invoke → handlers.ts → database 函数

## 数据库

SQLite 文件位置: `~/Library/Application Support/Fish Notes/`(macOS)

**四张表**:
- `notes`: id, title, content (Markdown), content_text (纯文本, FTS用), content_format, content_html_legacy (备份), created_at, updated_at, is_trashed, is_pinned, is_locked
- `tags`: id, name (unique), parent_id, is_pinned
- `note_tags`: note_id, tag_id（多对多关联）
- `app_settings`: key, value（存储加密密码哈希、盐值等配置）

**迁移**: 在 `database/index.ts` 中用 `pragma('table_info')` 检查并 ALTER TABLE。当前包含两次主要内容格式迁移：
1. （历史）`md → html`: 旧 DB 中 markdown 笔记升级时转 HTML
2. （当前）`html → markdown`: 启动时把所有非加密 HTML 笔记经 turndown 转回 Markdown，原 HTML 备份到 `content_html_legacy`。加密笔记跳过，由 `notes.unlockNote` 在解锁时按需转换

**FTS5**: 触发器索引 title + content_text（纯文本，不含 Markdown 语法）

## 注意事项

- 无测试框架，依赖 `npx tsc --noEmit` 做类型检查
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME` 是 Electron Forge 注入的全局变量，tsc 会报错但不影响运行
- 修改 main 进程代码（database, ipc, preload）后需要重启 `yarn start`，Vite HMR 只对 renderer 生效
- 数据库操作全在 main 进程，renderer 不能直接访问
- 图片存储在 userData 目录，通过自定义协议 `fish-image://` 在编辑器中显示
- `turndown` 仍在依赖中，因为加密笔记的 legacy HTML→MD 转换需要它；待所有用户的旧加密笔记都被访问过一次后可考虑移除
