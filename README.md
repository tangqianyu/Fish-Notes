# Fish Notes

一款类似 [Bear](https://bear.app/zh/) 的桌面笔记应用，使用 React + Electron 构建。

## 技术栈

| 层面 | 选型 |
|------|------|
| 桌面框架 | Electron 40 + Electron Forge + Vite 5 |
| 前端 | React 18 + TypeScript 5.7 |
| UI/样式 | Tailwind CSS 3 + CSS Variables |
| 编辑器 | TinyMCE 6.8（开源自托管，中文语言包） |
| 数据库 | better-sqlite3 + Drizzle ORM |
| 全文搜索 | SQLite FTS5 |
| 导出 | Turndown (HTML→Markdown)、Electron printToPDF |
| 包管理 | yarn |

## 功能

- **富文本编辑** — 基于 TinyMCE，支持标题、粗体、斜体、列表、代码块（25 种语言语法高亮）、引用、表格、待办事项、表情等
- **#标签系统** — 在笔记中使用 `#标签名` 自动解析，支持嵌套标签 `#parent/child`，侧边栏标签树展示，TagBar 快捷管理
- **图片支持** — 拖拽、粘贴、文件选择器插入图片，自动存储到本地 (`fish-image://` 协议)
- **全文搜索** — 基于 SQLite FTS5，快速搜索所有笔记内容
- **多主题切换** — Light / Dark / Solarized 三套主题
- **笔记导出** — 支持导出为 Markdown (.md)、HTML (.html)、PDF (.pdf)
- **回收站** — 软删除、恢复、永久删除
- **自动保存** — 编辑内容 500ms 防抖自动保存
- **三栏布局** — 侧边栏 | 笔记列表 | 编辑器，支持拖拽调整宽度
- **macOS 原生窗口** — 隐藏标题栏，traffic lights 集成
- **中文界面** — UI 全中文，TinyMCE 中文语言包

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + N` | 新建笔记 |
| `Cmd/Ctrl + S` | 立即保存 |
| `Cmd/Ctrl + Shift + F` | 全文搜索 |
| `Cmd/Ctrl + ,` | 打开设置 |

## 开发

```bash
# 安装依赖
yarn install

# 启动开发模式
yarn start

# ESLint 检查
yarn run lint

# 类型检查
npx tsc --noEmit

# 打包应用
yarn make
```

## 项目结构

```
src/
├── main.ts                    # Electron 主进程入口
├── preload.ts                 # IPC 桥接，暴露 window.api
├── main/
│   ├── database/              # SQLite 数据层 (schema, CRUD, FTS5)
│   ├── ipc/                   # IPC 处理器 (笔记/标签/搜索/导出)
│   ├── export/                # 导出模块 (Markdown/HTML/PDF)
│   └── images.ts              # 图片存储管理 (fish-image:// 协议)
└── renderer/
    ├── main.tsx               # React 入口
    ├── App.tsx                # 根组件
    ├── components/
    │   ├── Layout.tsx         # 三栏布局 + 快捷键
    │   ├── Sidebar.tsx        # 侧边栏 (导航 + 标签树)
    │   ├── NoteList.tsx       # 笔记列表
    │   ├── Editor.tsx         # 编辑器容器 + 导出菜单
    │   ├── TagBar.tsx         # 标签管理栏
    │   ├── TitleBar.tsx       # macOS 拖拽区域
    │   ├── SearchBar.tsx      # 全文搜索弹窗
    │   ├── Settings.tsx       # 主题设置
    │   └── editor/
    │       ├── TinyMCEEditor.tsx    # TinyMCE 富文本编辑器
    │       └── hashtagDetector.ts   # #tag 实时检测
    ├── contexts/              # React Context (AppContext, ThemeContext)
    ├── hooks/                 # 自定义 Hooks (useAutoSave)
    ├── utils/                 # 工具函数 (tagParser, htmlUtils)
    ├── types/                 # TypeScript 类型定义
    └── styles/themes/         # 主题 CSS 变量
scripts/
└── copy-tinymce.js            # postinstall: 复制 TinyMCE 资源到 public/
public/
└── tinymce/                   # 自托管 TinyMCE 资源 (skins/icons/plugins/langs)
```

## License

MIT
