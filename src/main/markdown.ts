import { marked } from 'marked';
import TurndownService from 'turndown';
import sanitizeHtml from 'sanitize-html';

// Node-side HTML sanitizer (htmlparser2-based — no jsdom/canvas). Strips scripts,
// event handlers and dangerous URLs from note content before it's written to an
// exported .html/.pdf. Mirrors the renderer's DOMPurify whitelist.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'strong', 'em', 'del', 's', 'hr', 'br', 'span', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    span: ['class'],
    code: ['class'],
    input: ['type', 'checked', 'disabled'],
    th: ['align'],
    td: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'fish-image'],
  // data: URLs only on <img>, never on links (data:text/html is an XSS vector).
  allowedSchemesByTag: { img: ['http', 'https', 'fish-image', 'data'] },
  allowProtocolRelative: false,
};

function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndown.addRule('hashtag', {
  filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).classList.contains('hashtag'),
  replacement: (content) => content,
});

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndown.turndown(html);
}

// Inject "&nbsp;" paragraphs for each blank line beyond the first so that user-typed
// extra Enter keys produce visible vertical space (matches preview behavior).
function preserveBlankLines(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let consecutiveBlank = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      consecutiveBlank = 0;
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      consecutiveBlank = 0;
      continue;
    }
    if (line.trim() === '') {
      consecutiveBlank++;
      if (consecutiveBlank === 1) {
        result.push('');
      } else {
        result.push('&nbsp;');
        result.push('');
      }
    } else {
      consecutiveBlank = 0;
      result.push(line);
    }
  }

  return result.join('\n');
}

export function markdownToHtml(md: string): string {
  if (!md) return '';

  const tagPlaceholders: string[] = [];
  const processed = preserveBlankLines(md).replace(
    /(?<=\s|^)#([\p{L}\p{N}_][\p{L}\p{N}_/]*)/gu,
    (match) => {
      const idx = tagPlaceholders.length;
      tagPlaceholders.push(match);
      return `%%HASHTAG_${idx}%%`;
    },
  );

  let html = marked.parse(processed, { async: false, breaks: true, gfm: true }) as string;

  // Strip any dangerous HTML (scripts, event handlers, javascript: URLs) that marked
  // passes through from note content, before our own trusted post-processing.
  html = sanitize(html);

  for (let i = 0; i < tagPlaceholders.length; i++) {
    html = html.replace(`%%HASHTAG_${i}%%`, `<span class="hashtag">${tagPlaceholders[i]}</span>`);
  }

  // Tag blank-line paragraphs so the matching CSS can zero out their margins.
  // (sanitize-html decodes &nbsp; to U+00A0, so match either form.)
  html = html.replace(/<p>\s*(?:&nbsp;|\u00a0)\s*<\/p>/g, '<p class="md-blank">&nbsp;</p>');

  return html;
}

export function stripMarkdownForFts(md: string): string {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^-{3,}\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripHtmlForFts(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const HTML_TAG_PROBE = /<\/?(p|h[1-6]|div|span|ul|ol|li|code|pre|a|img|table|strong|em|b|i|br)\b/i;

export function looksLikeHtml(content: string): boolean {
  return HTML_TAG_PROBE.test(content);
}
