import { marked } from 'marked';
import TurndownService from 'turndown';

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

export function markdownToHtml(md: string): string {
  if (!md) return '';

  const tagPlaceholders: string[] = [];
  const processed = md.replace(
    /(?<=\s|^)#([\p{L}\p{N}_][\p{L}\p{N}_/]*)/gu,
    (match) => {
      const idx = tagPlaceholders.length;
      tagPlaceholders.push(match);
      return `%%HASHTAG_${idx}%%`;
    },
  );

  let html = marked.parse(processed, { async: false, breaks: true, gfm: true }) as string;

  for (let i = 0; i < tagPlaceholders.length; i++) {
    html = html.replace(
      `%%HASHTAG_${i}%%`,
      `<span class="hashtag">${tagPlaceholders[i]}</span>`,
    );
  }

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
