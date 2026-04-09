# Fish Notes

Bear 风格的笔记应用，使用 React + Electron + TypeScript 构建。

## 技术栈

- **桌面**: Electron 40 + Electron Forge + Vite 5
- **前端**: React 18 + TypeScript 5.7 + Tailwind CSS 3
- **编辑器**: TinyMCE 6.8（开源自托管，中文语言包）
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
│   │   ├── notes.ts                     # 笔记 CRUD + 加密/解密操作
│   │   ├── tags.ts                      # 标签管理（增删改查、置顶、重命名）
│   │   └── search.ts                    # FTS5 搜索（索引 content_text 纯文本）
│   ├── ipc/
│   │   ├── handlers.ts                  # 主 IPC handler 注册（含加密相关）
│   │   └── exportHandlers.ts            # 导出（Markdown/HTML/PDF）
│   ├── export/                          # 导出实现（HTML→Markdown 用 turndown）
│   ├── encryption.ts                    # AES-256-GCM 加密 + scrypt 密码哈希
│   └── images.ts                        # 图片存储管理（fish-image:// 协议，UUID 命名）
├── renderer/
│   ├── main.tsx                         # React DOM 入口
│   ├── App.tsx                          # 根组件 + providers
│   ├── index.css                        # Tailwind + TinyMCE 容器样式
│   ├── components/
│   │   ├── Layout.tsx                   # 三栏布局（侧边栏/笔记列表/编辑器），可拖拽调整
│   │   ├── Sidebar.tsx                  # 标签树 + 导航 + 右键菜单（置顶/重命名/删除）
│   │   ├── NoteList.tsx                 # 当前视图的笔记列表 + 加密右键菜单
│   │   ├── Editor.tsx                   # 编辑器容器，useAutoSave + 导出菜单 + 加密锁定
│   │   ├── TagBar.tsx                   # 标签管理栏（当前笔记标签 + 添加/移除）
│   │   ├── TitleBar.tsx                 # macOS 拖拽区域
│   │   ├── editor/
│   │   │   └── TinyMCEEditor.tsx        # TinyMCE 编辑器（接口: defaultValue + onChange）
│   │   ├── SearchBar.tsx                # 全文搜索弹窗
│   │   ├── PasswordPrompt.tsx           # 密码输入弹窗（加密功能）
│   │   └── Settings.tsx                 # 主题设置（light/dark/solarized/anime）+ 密码管理
│   ├── contexts/
│   │   ├── AppContext.tsx               # 全局状态：笔记、标签、视图模式、标签管理 actions、加密状态
│   │   └── ThemeContext.tsx             # 主题状态
│   ├── hooks/useAutoSave.ts            # 500ms 防抖保存
│   ├── utils/
│   │   ├── tagParser.ts                # 构建标签树（parseTags 已废弃，标签改为直接添加）
│   │   └── htmlUtils.ts                # extractTitle, stripHtml 工具函数
│   ├── styles/themes/variables.css     # CSS 变量（四个主题 + 标签颜色）
│   └── types/global.d.ts              # window.api 类型定义
scripts/
└── copy-tinymce.js                     # postinstall: 复制 TinyMCE 资源到 public/
public/
└── tinymce/                            # 自托管 TinyMCE 资源（skins/icons/plugins/langs）
```

## 核心数据流

### 编辑保存
用户输入 → TinyMCE onEditorChange → HTML 字符串 → Editor.tsx handleChange → useAutoSave(500ms) → AppContext.updateNoteContent → extractTitle + stripHtml + IPC 保存

### 标签系统
- **标签管理**: 标签通过 TagBar 的 `+` 按钮直接添加/移除，不从编辑器内容中自动解析（parseTags 和 hashtagDetector 均已移除）
- **嵌套标签**: `#parent/child/grandchild`，`/` 分隔，数据库存储完整路径，侧边栏通过 `buildTagTree()` 动态构建树形结构
- **TagBar**: 显示当前笔记标签（蓝色药丸 + × 移除），`+` 按钮弹出搜索框（过滤已添加标签），可选择已有标签或输入新名称创建
- **侧边栏**: 树形展示所有标签，显示笔记数量（排除已删除），缩进表示层级（每级 16px），点击切换到该标签视图
- **右键菜单**: 置顶/取消置顶、重命名（内联编辑，仅编辑叶子名称，自动重建完整路径）、删除标签；菜单自动调整位置防溢出
- **置顶**: 置顶标签排在最前，显示 📌 图标，状态通过 `tags.isPinned` 持久化到数据库
- **删除**: 从 `note_tags` 移除关联 → 删除 `tags` 记录 → 遍历受影响笔记，用正则移除 `<span class="hashtag">#tag</span>` 和裸文本 `#tag` → 多余空格压缩 → 更新 title/content/contentText → 若当前正在查看该标签则切回 all 视图
- **重命名**: 更新 `tags` 表 name → 遍历关联笔记，正则替换 span 包裹内和裸文本中的旧标签名为新名 → 更新 title/content/contentText
- **自动标签**: 在标签视图下新建笔记时自动添加该标签
- **清理**: 移除标签后调用 `cleanupUnused()` 删除 `note_tags` 中无关联的孤立标签

### 笔记加密系统
- 使用 AES-256-GCM 对笔记内容进行端到端加密，密码通过 scrypt 哈希
- 用户在 Settings 中设置密码，密码哈希和盐值存储在 `app_settings` 表
- 加密流程: 用户设置密码 → scrypt 派生加密密钥 → AES-256-GCM 加密笔记内容（IV + authTag + 密文 → base64）
- 会话管理: 验证密码后密钥缓存在内存中，锁定会话时清除
- 加密笔记的 `content_text` 被清空（从 FTS 索引中移除，不可搜索）
- 修改密码时自动用新密钥重新加密所有已加密笔记
- 移除密码时自动解密所有笔记
- Editor 打开加密笔记时先弹出 PasswordPrompt，验证后获取解密内容
- NoteList 右键菜单支持"加密笔记"/"移除加密"操作
- IPC: `window.api.encryption.*`（密码管理）+ `window.api.notes.lock/unlock/getDecrypted`

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

**四张表**:
- `notes`: id, title, content (HTML), content_text (纯文本, FTS用), content_format, created_at, updated_at, is_trashed, is_pinned, is_locked
- `tags`: id, name (unique), parent_id, is_pinned
- `note_tags`: note_id, tag_id（多对多关联）
- `app_settings`: key, value（存储加密密码哈希、盐值等配置）

**迁移**: 在 `database/index.ts` 中用 `pragma('table_info')` 检查并 ALTER TABLE
**FTS5**: 触发器索引 title + content_text（纯文本，不含 HTML 标签）

## 编辑器（TinyMCE 6）

**关键设计**:
- 编辑器以 `noteId` 为 key，切换笔记时完全重建
- 接口: `{ defaultValue: string, onChange: (html: string) => void }`
- 内容存储为 HTML 格式（非 Markdown）
- 自托管: TinyMCE 资源在 `public/tinymce/`，通过 `tinymceScriptSrc` 加载
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
