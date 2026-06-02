import { spawn, execSync } from 'node:child_process';
import { getRawDatabase } from '../database/index';
import { stripMarkdownForFts } from '../markdown';

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

const DEFAULT_CONFIG: AIConfig = {
  token: '',
  model: 'claude-sonnet-4-6',
};

const SETTINGS_KEY = 'ai_config';

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

export function setAIConfig(cfg: AIConfig): void {
  getRawDatabase()
    .prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
    .run(SETTINGS_KEY, JSON.stringify(cfg));
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
  opts: { model?: string; systemPrompt?: string } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cfg = getAIConfig();
    if (!cfg.token) {
      return reject(new Error('Claude token 未配置，请在设置中粘贴 `claude setup-token` 生成的 token'));
    }

    const bin = cfg.claudePath || 'claude';
    const args = ['-p', '--output-format', 'text'];
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
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(
          '找不到 claude CLI。请先执行：npm install -g @anthropic-ai/claude-code\n' +
          '或在设置里填写 claude 的绝对路径（可用 `which claude` 查询）',
        ));
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

export async function testClaudeConnection(): Promise<
  { ok: true; reply: string } | { ok: false; error: string }
> {
  try {
    const reply = await runClaude('只回复 "PONG" 两个字母，不要其他内容。');
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
