# Fish Notes

Bear 风格的笔记应用，使用 React + Electron + TypeScript 构建。

## 技术栈

- **桌面**: Electron 40 + Electron Forge + Vite 5
- **前端**: React 18 + TypeScript 5.7 + Tailwind CSS 3
- **编辑器**: TinyMCE 6.8（开源自托管，中文语言包，自定义 #tag 检测）
- **数据库**: SQLite (better-sqlite3) + Drizzle ORM + FTS5 全文搜索
- **架构**: Main/Renderer 进程分离，通过 IPC 通信

## 常用命令

```bash
yarn start          # 启动开发环境
yarn run lint       # ESLint 检查
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
│   │   ├── index.ts                     # DB 初始化，WAL 模式，FTS5，迁移（含 md→html 迁移）
│   │   ├── schema.ts                    # Drizzle schema: notes, tags, noteTags
│   │   ├── notes.ts                     # 笔记 CRUD
│   │   ├── tags.ts                      # 标签管理（增删改查、置顶、重命名）
│   │   └── search.ts                    # FTS5 搜索（索引 content_text 纯文本）
│   ├── ipc/
│   │   ├── handlers.ts                  # 主 IPC handler 注册
│   │   └── exportHandlers.ts            # 导出（Markdown/HTML/PDF）
│   ├── export/                          # 导出实现（HTML→Markdown 用 turndown）
│   └── images.ts                        # 图片存储管理（fish-image:// 协议，UUID 命名）
├── renderer/
│   ├── main.tsx                         # React DOM 入口
│   ├── App.tsx                          # 根组件 + providers
│   ├── index.css                        # Tailwind + TinyMCE 容器样式
│   ├── components/
│   │   ├── Layout.tsx                   # 三栏布局（侧边栏/笔记列表/编辑器），可拖拽调整
│   │   ├── Sidebar.tsx                  # 标签树 + 导航 + 右键菜单（置顶/重命名/删除）
│   │   ├── NoteList.tsx                 # 当前视图的笔记列表
│   │   ├── Editor.tsx                   # 编辑器容器，useAutoSave + 导出菜单
│   │   ├── TagBar.tsx                   # 标签管理栏（当前笔记标签 + 添加/移除）
│   │   ├── TitleBar.tsx                 # macOS 拖拽区域
│   │   ├── editor/
│   │   │   ├── TinyMCEEditor.tsx        # TinyMCE 编辑器（接口: defaultValue + onChange）
│   │   │   └── hashtagDetector.ts       # 实时 #tag 检测 + 药丸样式包裹
│   │   ├── SearchBar.tsx                # 全文搜索弹窗
│   │   └── Settings.tsx                 # 主题设置（light/dark/solarized）
│   ├── contexts/
│   │   ├── AppContext.tsx               # 全局状态：笔记、标签、视图模式、标签管理 actions
│   │   └── ThemeContext.tsx             # 主题状态
│   ├── hooks/useAutoSave.ts            # 500ms 防抖保存
│   ├── utils/
│   │   ├── tagParser.ts                # 从 HTML 解析 #tags + 构建标签树
│   │   └── htmlUtils.ts                # extractTitle, stripHtml 工具函数
│   ├── styles/themes/variables.css     # CSS 变量（三个主题 + 标签颜色）
│   └── types/global.d.ts              # window.api 类型定义
scripts/
└── copy-tinymce.js                     # postinstall: 复制 TinyMCE 资源到 public/
public/
└── tinymce/                            # 自托管 TinyMCE 资源（skins/icons/plugins/langs）
```

## 核心数据流

### 编辑保存
用户输入 → TinyMCE onEditorChange → HTML 字符串 → Editor.tsx handleChange → useAutoSave(500ms) → AppContext.updateNoteContent → extractTitle + stripHtml + parseTags() + IPC 保存 + 同步标签 + cleanupUnused

### 标签系统
- 编辑器中输入 `#tagname`，hashtagDetector 自动包裹为 `<span class="hashtag">` （蓝色药丸样式）
- 支持嵌套标签: `#parent/child`
- 标签从笔记 HTML 内容中自动解析（parseTags）
- TagBar 组件提供标签添加/移除的快捷操作
- 侧边栏右键菜单支持：置顶、重命名、删除
- 删除标签时自动从所有笔记内容中移除 `#tag` 文本和 hashtag span
- 重命名标签时自动更新所有笔记内容

### 图片系统
- 支持拖拽、粘贴、文件选择器三种方式插入图片
- 图片存储在 `~/.config/Fish Notes/images/`，UUID 命名
- 自定义 `fish-image://` 协议访问本地图片
- IPC: `window.api.images.saveFromPath()` / `saveFromBuffer()` / `pickFile()`
- 支持格式: PNG, JPEG, GIF, WebP, BMP, SVG

### IPC 通信
renderer 通过 `window.api.*` 调用 → preload.ts → ipcRenderer.invoke → handlers.ts → database 函数

## 数据库

SQLite 文件位置: `~/Library/Application Support/Fish Notes/`(macOS)

**三张表**:
- `notes`: id, title, content (HTML), content_text (纯文本, FTS用), content_format, created_at, updated_at, is_trashed, is_pinned
- `tags`: id, name (unique), parent_id, is_pinned
- `note_tags`: note_id, tag_id（多对多关联）

**迁移**: 在 `database/index.ts` 中用 `pragma('table_info')` 检查并 ALTER TABLE
**FTS5**: 触发器索引 title + content_text（纯文本，不含 HTML 标签）

## 编辑器（TinyMCE 6）

**关键设计**:
- 编辑器以 `noteId` 为 key，切换笔记时完全重建
- 接口: `{ defaultValue: string, onChange: (html: string) => void }`
- 内容存储为 HTML 格式（非 Markdown）
- 自托管: TinyMCE 资源在 `public/tinymce/`，通过 `tinymceScriptSrc` 加载
- #tag 检测: `hashtagDetector.ts` 遍历 DOM 文本节点，包裹为 `<span class="hashtag">`
- 主题适配: 根据 theme 切换 skin_url（oxide / oxide-dark）和 content_style
- 图片处理: `images_upload_handler` + paste/drop 事件对接 `window.api.images`
- 代码块: codesample 插件支持 25 种语言语法高亮
- 导出: HTML 直接导出, Markdown 用 turndown 转换, PDF 通过 HTML→printToPDF

## 注意事项

- 无测试框架，依赖 `npx tsc --noEmit` 做类型检查
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME` 是 Electron Forge 注入的全局变量，tsc 会报错但不影响运行
- 修改 main 进程代码（database, ipc, preload）后需要重启 `yarn start`，Vite HMR 只对 renderer 生效
- 数据库操作全在 main 进程，renderer 不能直接访问
- TinyMCE 资源通过 `yarn postinstall`（scripts/copy-tinymce.js）复制到 public/
- 图片存储在 userData 目录，通过自定义协议 `fish-image://` 在编辑器中显示
