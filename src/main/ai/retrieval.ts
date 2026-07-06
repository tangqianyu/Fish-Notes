import { getRawDatabase } from '../database/index';

/**
 * 轻量笔记检索（供"问笔记库"模式用）。
 *
 * 不走 FTS5：默认 unicode61 分词器不切分中文（整句成一个 token），MATCH 中文
 * 问题基本查不到。个人笔记量级（几百上千篇）直接全量扫描 content_text 打分，
 * 中英文都稳定，且无需额外索引。
 */

export interface RetrievedNote {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
}

/** 常见中文虚词/疑问词单字 —— 含这些字的 2-gram 不作为关键词 */
const CJK_STOP_CHARS = new Set(
  '的了是在有和就不都一这那些什么怎么样为吗呢吧啊呀哪个我你他她它们与或者及其到从被把对于关于请帮过很还挺篇写记要想'.split(''),
);

/** 疑问/元语言词 —— 问句里高频出现但不指向笔记内容 */
const CJK_STOP_WORDS = new Set([
  '多少',
  '哪些',
  '什么',
  '怎么',
  '怎样',
  '如何',
  '为什么',
  '时候',
  '是否',
  '没有',
  '可以',
  '应该',
  '请问',
  '帮我',
  '一下',
  '告诉',
  '知道',
  '笔记',
  '记录',
  '内容',
]);

/** 去掉首尾虚词字，返回剩余核心词 */
function trimStopChars(run: string): string {
  let start = 0;
  let end = run.length;
  while (start < end && CJK_STOP_CHARS.has(run[start])) start++;
  while (end > start && CJK_STOP_CHARS.has(run[end - 1])) end--;
  return run.slice(start, end);
}

const LATIN_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'what', 'which',
  'who', 'how', 'why', 'when', 'where', 'my', 'me', 'i', 'you', 'it', 'of', 'to', 'in',
  'on', 'for', 'and', 'or', 'about', 'with', 'can', 'could', 'please', 'help',
]);

/**
 * 从自然语言问题中抽取检索关键词：
 * - 拉丁词直接保留（≥2 字符，去停用词）
 * - 中文连续段保留整段（≤6 字）并生成所有 2-gram，滤掉纯虚词组合
 */
export function extractKeywords(question: string): string[] {
  const keywords = new Set<string>();
  const text = question.toLowerCase();

  for (const m of text.matchAll(/[a-z0-9][a-z0-9._-]+/g)) {
    const w = m[0];
    if (w.length >= 2 && !LATIN_STOPWORDS.has(w)) keywords.add(w);
  }

  for (const m of text.matchAll(/[一-鿿]+/g)) {
    const run = trimStopChars(m[0]);
    if (run.length >= 2 && run.length <= 6 && !CJK_STOP_WORDS.has(run)) {
      keywords.add(run);
    }
    for (let i = 0; i + 2 <= run.length; i++) {
      const gram = run.slice(i, i + 2);
      // 任一字是虚词字、或整词是疑问/元语言词 → 都不是有效检索词
      if (CJK_STOP_CHARS.has(gram[0]) || CJK_STOP_CHARS.has(gram[1])) continue;
      if (CJK_STOP_WORDS.has(gram)) continue;
      keywords.add(gram);
    }
  }

  return [...keywords].slice(0, 32);
}

function countOccurrences(haystack: string, needle: string, cap: number): number {
  let count = 0;
  let idx = 0;
  while (count < cap) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count++;
    idx += needle.length;
  }
  return count;
}

interface NoteRow {
  id: string;
  title: string;
  content_text: string;
  updated_at: string;
}

/** 围绕命中位置截取摘要窗口 */
function buildExcerpt(content: string, keywords: string[], maxLen: number): string {
  let hitPos = -1;
  // 用最长的命中关键词定位（更可能是核心词）
  for (const kw of [...keywords].sort((a, b) => b.length - a.length)) {
    const pos = content.indexOf(kw);
    if (pos !== -1) {
      hitPos = pos;
      break;
    }
  }
  if (hitPos === -1 || content.length <= maxLen) return content.slice(0, maxLen);
  const start = Math.max(0, hitPos - Math.floor(maxLen / 3));
  const slice = content.slice(start, start + maxLen);
  return (start > 0 ? '…' : '') + slice + (start + maxLen < content.length ? '…' : '');
}

/** Read all non-trashed, non-locked notes once (content_text is the plain-text body). */
function fetchNoteRows(): NoteRow[] {
  return getRawDatabase()
    .prepare(
      'SELECT id, title, content_text, updated_at FROM notes WHERE is_trashed = 0 AND is_locked = 0 ORDER BY updated_at DESC',
    )
    .all() as NoteRow[];
}

/** Keyword-score already-fetched rows and return the top `limit` matches. */
function scoreRows(
  rows: NoteRow[],
  keywords: string[],
  limit: number,
  excerptLen: number,
): RetrievedNote[] {
  const scored = rows
    .map((row) => {
      const title = (row.title ?? '').toLowerCase();
      const content = (row.content_text ?? '').toLowerCase();
      let score = 0;
      const hits: string[] = [];
      for (const kw of keywords) {
        // 长词权重更高；标题命中远比正文命中值钱
        const weight = kw.length >= 3 ? 2 : 1;
        const inTitle = countOccurrences(title, kw, 3);
        const inContent = countOccurrences(content, kw, 5);
        if (inTitle + inContent > 0) hits.push(kw);
        score += weight * (inTitle * 4 + inContent);
      }
      return { row, score, hits };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.row.updated_at.localeCompare(a.row.updated_at))
    .slice(0, limit);

  return scored.map(({ row, hits }) => ({
    id: row.id,
    title: row.title || '(无标题)',
    excerpt: buildExcerpt(row.content_text ?? '', hits, excerptLen),
    updatedAt: row.updated_at,
  }));
}

export function retrieveNotes(question: string, limit = 6, excerptLen = 1200): RetrievedNote[] {
  const keywords = extractKeywords(question);
  if (!keywords.length) return [];
  return scoreRows(fetchNoteRows(), keywords, limit, excerptLen);
}

/**
 * 笔记库总览：总数 + 标题/标签/更新日期清单（按更新时间倒序）。
 * 供"问笔记库"模式回答统计、清单、按标签筛选类问题。
 */
export function getLibraryOverview(maxNotes = 300, maxChars = 8000): string {
  const db = getRawDatabase();
  const total = (
    db.prepare('SELECT COUNT(*) AS c FROM notes WHERE is_trashed = 0').get() as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT n.id, n.title, n.updated_at, n.is_locked,
              (SELECT GROUP_CONCAT(t.name, ' #') FROM note_tags nt
               JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = n.id) AS tags
       FROM notes n WHERE n.is_trashed = 0
       ORDER BY n.updated_at DESC LIMIT ?`,
    )
    .all(maxNotes) as {
    id: string;
    title: string;
    updated_at: string;
    is_locked: number;
    tags: string | null;
  }[];

  let text = `共 ${total} 篇笔记（不含回收站）。标题清单（按更新时间倒序）：\n`;
  for (const r of rows) {
    const line = `- 「${r.title || '(无标题)'}」${r.tags ? ` #${r.tags}` : ''}${r.is_locked ? ' [已加密]' : ''} (${r.updated_at.slice(0, 10)})\n`;
    if (text.length + line.length > maxChars) {
      text += `…（清单过长，已截断，仅显示前若干篇）\n`;
      break;
    }
    text += line;
  }
  return text;
}

export interface KbContext {
  /** 拼好的完整知识库上下文（注入 system prompt） */
  prompt: string;
  /** 深度检索命中的笔记（UI "参考笔记" chips） */
  sources: { id: string; title: string }[];
}

/**
 * 构建"问笔记库"上下文：总览（全部标题/标签）+ 命中笔记的深摘要 + 其余笔记的开头预览。
 * 让模型浅层看到整个笔记库、深层看到相关笔记 —— 统计类和跨笔记问题都能答。
 */
export function buildKbContext(
  question: string,
  opts: { matchLimit?: number; excerptLen?: number; previewLen?: number; previewBudget?: number } = {},
): KbContext {
  const { matchLimit = 8, excerptLen = 1200, previewLen = 240, previewBudget = 8000 } = opts;

  // Read every candidate note ONCE, then reuse the same rows for both keyword scoring
  // and the "rest of the library" previews below (previously scanned the table twice).
  const rows = fetchNoteRows();
  const keywords = extractKeywords(question);
  const matched = keywords.length ? scoreRows(rows, keywords, matchLimit, excerptLen) : [];
  const matchedIds = new Set(matched.map((n) => n.id));

  let prompt = '用户开启了"问笔记库"模式，以下是用户笔记库的资料。\n\n<笔记库总览>\n';
  prompt += getLibraryOverview();
  prompt += '</笔记库总览>\n';

  if (matched.length) {
    prompt += '\n<相关笔记片段>\n';
    matched.forEach((n, i) => {
      prompt += `<笔记${i + 1} 标题=「${n.title}」 更新于=${n.updatedAt.slice(0, 10)}>\n${n.excerpt}\n</笔记${i + 1}>\n`;
    });
    prompt += '</相关笔记片段>\n';
  }

  // 其余未命中的笔记给开头预览，保证"跨全部笔记"的问题也有材料（复用上面已取的 rows）
  let previews = '';
  for (const r of rows) {
    if (matchedIds.has(r.id)) continue;
    const body = (r.content_text ?? '').trim();
    if (!body) continue;
    const snippet = body.slice(0, previewLen);
    const line = `- 「${r.title || '(无标题)'}」：${snippet}${body.length > previewLen ? '…' : ''}\n`;
    if (previews.length + line.length > previewBudget) break;
    previews += line;
  }
  if (previews) {
    prompt += `\n<其余笔记开头预览>\n${previews}</其余笔记开头预览>\n`;
  }

  prompt +=
    '\n回答要求：\n' +
    '- 统计、清单、按标签筛选类问题，直接依据〈笔记库总览〉回答\n' +
    '- 内容型问题优先引用〈相关笔记片段〉，其次参考〈其余笔记开头预览〉；预览只有开头，基于预览的判断要说明\n' +
    '- 提到某篇笔记时用「标题」标注来源\n' +
    '- 以上资料不足以回答时如实说明，不要编造笔记内容';

  return { prompt, sources: matched.map(({ id, title }) => ({ id, title })) };
}
