import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { getRawDatabase } from '../database/index';
import { stripMarkdownForFts } from '../markdown';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Claude 集成层。
 *
 * 认证方式：用户在设置里粘贴通过 `claude setup-token` 生成的 OAuth token。
 * 调用方式：spawn 本机的 `claude -p` CLI，prompt 走 stdin，结果从 stdout 读。
 *
 * 前提：
 *   - 本机已安装 Claude Code CLI：`npm install -g @anthropic-ai/claude-code`
 *   - 执行过 `claude setup-token` 并保存了 token
 */

export interface AIConfig {
  token: string;
  model: string;
  /** 可选：claude CLI 绝对路径（当自动检测失败时使用）*/
  claudePath?: string;
}

/** 暴露给 renderer 的安全视图 —— 绝不包含明文 token */
export interface PublicAIConfig {
  model: string;
  claudePath?: string;
  hasToken: boolean;
}

const DEFAULT_CONFIG: AIConfig = {
  token: '',
  model: 'claude-sonnet-4-6',
};

const SETTINGS_KEY = 'ai_config';

/** 完整配置（含 token），仅供主进程内部调用 claude CLI 使用，永不返回给 renderer。 */
export function getAIConfig(): AIConfig {
  const row = getRawDatabase()
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row?.value) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** 给 renderer 的脱敏配置：只暴露是否已配置 token，不回传 token 本身。 */
export function getAIConfigPublic(): PublicAIConfig {
  const cfg = getAIConfig();
  return { model: cfg.model, claudePath: cfg.claudePath, hasToken: !!cfg.token };
}

export function setAIConfig(cfg: AIConfig): void {
  // 空 token 表示"不修改"（renderer 的 token 输入框只写不回显），保留已存的 token。
  const existing = getAIConfig();
  const merged: AIConfig = {
    token: cfg.token?.trim() ? cfg.token : existing.token,
    model: cfg.model || existing.model,
    claudePath: cfg.claudePath,
  };
  getRawDatabase()
    .prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
    .run(SETTINGS_KEY, JSON.stringify(merged));
}

/**
 * 从登录 shell 读取 PATH —— 解决 Electron 从 GUI 启动时 PATH 没有
 * /usr/local/bin、~/.nvm/... 等路径导致找不到 `claude` 的问题。
 */
let cachedShellPath: string | undefined;
function getShellPath(): string {
  if (cachedShellPath !== undefined) return cachedShellPath;
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const out = execSync(`${shell} -lic 'echo __FISH_NOTES_PATH__=$PATH'`, {
      encoding: 'utf8',
      timeout: 3000,
    });
    const m = out.match(/__FISH_NOTES_PATH__=(.+)/);
    if (m) {
      cachedShellPath = m[1].trim();
      return cachedShellPath;
    }
  } catch {
    /* ignore */
  }
  cachedShellPath = process.env.PATH ?? '';
  return cachedShellPath;
}

function runClaude(
  prompt: string,
  opts: { model?: string; systemPrompt?: string; configOverride?: AIConfig } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cfg = opts.configOverride ?? getAIConfig();
    if (!cfg.token) {
      return reject(
        new Error('Claude token 未配置，请在设置中粘贴 `claude setup-token` 生成的 token'),
      );
    }

    const bin = cfg.claudePath || 'claude';
    // `--tools ''` disables ALL built-in tools (bash/file/etc.) — the assistant is
    // a pure chat model, never an agent that touches the filesystem or DB.
    const args = ['-p', '--output-format', 'text', '--tools', ''];
    const model = opts.model ?? cfg.model;
    if (model) args.push('--model', model);
    if (opts.systemPrompt) args.push('--append-system-prompt', opts.systemPrompt);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: getShellPath(),
      CLAUDE_CODE_OAUTH_TOKEN: cfg.token,
    };

    const proc = spawn(bin, args, { env });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            '找不到 claude CLI。请先执行：npm install -g @anthropic-ai/claude-code\n' +
              '或在设置里填写 claude 的绝对路径（可用 `which claude` 查询）',
          ),
        );
      } else {
        reject(err);
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude 退出码 ${code}: ${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export async function testClaudeConnection(
  override?: AIConfig,
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    // 若 renderer 传来的 override 没带 token（"不修改"占位），回填已存 token 用于测试。
    let configOverride: AIConfig | undefined;
    if (override) {
      const token = override.token?.trim() ? override.token : getAIConfig().token;
      configOverride = { ...DEFAULT_CONFIG, ...override, token };
    }
    const reply = await runClaude('只回复 "PONG" 两个字母，不要其他内容。', { configOverride });
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 给定一段 Markdown 笔记内容，请 Claude 总结一个标题。
 * 失败时抛错，由调用方提示。
 */
export async function suggestTitle(content: string): Promise<string> {
  const plain = stripMarkdownForFts(content).slice(0, 4000);
  if (!plain) throw new Error('笔记内容为空，无法生成标题');

  const prompt = `请为下面这段笔记内容生成一个简洁的标题。要求：
- 不超过 20 个字
- 直接概括主题，不要加引号、标点收尾、"标题："等前缀
- 与笔记同一语言
- 只返回标题本身，不要任何额外说明

笔记内容：
${plain}`;

  const raw = await runClaude(prompt, {
    systemPrompt: '你是一个简洁的标题生成助手。只输出标题文本，不要任何解释或包装。',
  });

  return raw
    .replace(/^["'《「『]+|["'》」』]+$/g, '')
    .replace(/^标题[:：]\s*/i, '')
    .trim();
}

/**
 * 润色一段（用户选中的）Markdown 文字。保留 Markdown 语法和原意，只优化表达。
 */
export async function polishText(text: string): Promise<string> {
  if (!text.trim()) throw new Error('选中的文本为空');

  const prompt = `请润色下面这段文字。严格要求：
- 保持原意、语气、视角不变
- 与原文使用相同的语言（中文还是中文，英文还是英文）
- 完整保留所有 Markdown 语法（**粗体**、*斜体*、\`代码\`、列表标记、链接、图片、标题井号等都不能动）
- 不要增加或删减信息，只让表达更通顺、自然
- 只返回润色后的文本本身，不要添加任何解释、引号、"润色后："这样的前缀

原文：
${text}`;

  const raw = await runClaude(prompt, {
    systemPrompt:
      '你是专业的文字编辑，擅长润色文章。严格只输出润色后的文本本身，不输出任何解释或包装。',
  });

  // 去掉模型有时仍会添加的代码围栏 / 引号
  return raw
    .replace(/^```(?:markdown|md)?\s*\n?/i, '')
    .replace(/\n?\s*```$/i, '')
    .trim();
}

// ---- 助手对话（流式）----

const ASSISTANT_BASE_PROMPT =
  '你是 Fish Notes 笔记应用里的 AI 助手，名叫 Fish。回答简洁友好，使用 Markdown 排版。';

const NOTE_CONTENT_CAP = 12000;

/** 把多轮对话拼成单条 prompt（无服务端会话，逐轮重发）。 */
function buildChatPrompt(messages: ChatMessage[]): string {
  if (messages.length <= 1) return messages[0]?.content ?? '';
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? '我' : '你'}：${m.content}`)
    .join('\n\n');
  const last = messages[messages.length - 1].content;
  return `这是我们之前的对话：\n\n${history}\n\n请基于以上对话继续回答我接下来的问题：\n\n${last}`;
}

/** spawn 时挂在 requestId 上的进程，供 abort 用 */
const activeChats = new Map<string, ChildProcess>();

export interface ChatStreamCallbacks {
  onDelta: (text: string) => void;
  /** extended-thinking 增量。部分模型（如 Opus 4.8）思考内容被加密，此时 text 为空、
   * 只有 estimatedTokens 计数 —— UI 据此显示"思考中 · ~N tokens"。 */
  onThinking?: (text: string, estimatedTokens?: number) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

export interface ChatContext {
  /** 绑定单篇笔记时的笔记内容 */
  noteContext?: string;
  /** "问笔记库"模式：retrieval.buildKbContext 拼好的完整上下文 */
  kbPrompt?: string;
}

/**
 * 流式对话。messages 为完整对话历史（最后一条是本轮用户问题）。
 * ctx.noteContext 存在时注入单篇笔记上下文；ctx.kbNotes 存在时注入笔记库检索结果。
 */
export function chatStream(
  requestId: string,
  messages: ChatMessage[],
  ctx: ChatContext,
  cb: ChatStreamCallbacks,
): void {
  const cfg = getAIConfig();
  if (!cfg.token) {
    cb.onError('Claude token 未配置，请在设置中粘贴 `claude setup-token` 生成的 token');
    return;
  }
  if (!messages.length) {
    cb.onError('对话内容为空');
    return;
  }

  let systemPrompt = ASSISTANT_BASE_PROMPT;
  if (ctx.noteContext && ctx.noteContext.trim()) {
    const plain = stripMarkdownForFts(ctx.noteContext).slice(0, NOTE_CONTENT_CAP);
    systemPrompt += `\n\n用户正在阅读下面这篇笔记，请优先基于它来回答；笔记之外的内容如实说明。\n\n<笔记内容>\n${plain}\n</笔记内容>`;
  } else if (ctx.kbPrompt) {
    systemPrompt += `\n\n${ctx.kbPrompt}`;
  }

  const bin = cfg.claudePath || 'claude';
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
    // disable ALL built-in tools — pure chat model, never an agent (no bash/file/sqlite3)
    '--tools',
    '',
    '--append-system-prompt',
    systemPrompt,
  ];
  if (cfg.model) args.push('--model', cfg.model);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: getShellPath(),
    CLAUDE_CODE_OAUTH_TOKEN: cfg.token,
    // 给 extended thinking 一个预算：模型自适应决定是否思考（简单问题不思考）。
    // 没有这个变量时 headless 模式完全不产生 thinking 事件。
    MAX_THINKING_TOKENS: '8000',
  };

  let proc: ChildProcess;
  try {
    proc = spawn(bin, args, { env });
  } catch (e) {
    cb.onError(e instanceof Error ? e.message : String(e));
    return;
  }
  activeChats.set(requestId, proc);

  let streamed = '';
  let resultText = '';
  let stderr = '';
  let buffer = '';

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      return; // 非 JSON 行（极少）直接忽略
    }
    if (evt.type === 'stream_event') {
      const inner = evt.event as {
        type?: string;
        delta?: { type?: string; text?: string; thinking?: string; estimated_tokens?: number };
      };
      if (inner?.type === 'content_block_delta') {
        if (inner.delta?.type === 'text_delta') {
          const t = inner.delta.text ?? '';
          streamed += t;
          cb.onDelta(t);
        } else if (inner.delta?.type === 'thinking_delta') {
          const t = inner.delta.thinking ?? '';
          const est = inner.delta.estimated_tokens;
          if (t || est) cb.onThinking?.(t, est);
        }
      }
    } else if (evt.type === 'result' && typeof evt.result === 'string') {
      resultText = evt.result;
    } else if (evt.type === 'assistant') {
      // 无 partial 时的兜底：从完整 assistant 消息里取文本
      const msg = evt.message as { content?: { type?: string; text?: string }[] } | undefined;
      const text = msg?.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      if (text && !streamed) resultText = text;
    }
  };

  proc.stdout?.on('data', (d) => {
    buffer += d.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  });
  proc.stderr?.on('data', (d) => {
    stderr += d.toString();
  });

  proc.on('error', (err) => {
    activeChats.delete(requestId);
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cb.onError(
        '找不到 claude CLI。请先执行：npm install -g @anthropic-ai/claude-code，或在设置里填写 claude 绝对路径',
      );
    } else {
      cb.onError(err.message);
    }
  });

  proc.on('close', (code) => {
    if (buffer.trim()) handleLine(buffer);
    activeChats.delete(requestId);
    const final = streamed || resultText;
    if (code === 0 || final) {
      cb.onDone(final.trim());
    } else {
      cb.onError(`claude 退出码 ${code}: ${stderr || '(无输出)'}`);
    }
  });

  proc.stdin?.write(buildChatPrompt(messages));
  proc.stdin?.end();
}

/** 中断一个进行中的对话请求 */
export function abortChat(requestId: string): void {
  const proc = activeChats.get(requestId);
  if (proc) {
    proc.kill();
    activeChats.delete(requestId);
  }
}
