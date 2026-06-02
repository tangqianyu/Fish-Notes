import { useMemo, useCallback, forwardRef, type MouseEvent } from 'react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  value: string;
  className?: string;
}

const EXTERNAL_LINK_RE = /^(https?|mailto|tel):/i;

// Standard Markdown collapses 2+ consecutive blank lines into a single paragraph
// break. Users typing extra Enter expect that vertical whitespace to show up in
// preview/export, so we inject visible "&nbsp;" paragraphs for each blank beyond
// the first. Code fences are skipped so multi-line code blocks keep their blanks.
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

function renderMarkdown(md: string): string {
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
  for (let i = 0; i < tagPlaceholders.length; i++) {
    html = html.replace(
      `%%HASHTAG_${i}%%`,
      `<span class="hashtag">${tagPlaceholders[i]}</span>`,
    );
  }

  // marked doesn't emit target/rel on links; add them so Electron's
  // setWindowOpenHandler can route external links to the default browser.
  html = html.replace(
    /<a (?![^>]*\btarget=)/g,
    '<a target="_blank" rel="noopener noreferrer" ',
  );

  // Tag blank-line paragraphs (the &nbsp; rows we injected) so CSS can collapse
  // their margins and match source's per-line spacing.
  html = html.replace(/<p>\s*&nbsp;\s*<\/p>/g, '<p class="md-blank">&nbsp;</p>');

  return html;
}

const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  ({ value, className }, ref) => {
    const html = useMemo(() => renderMarkdown(value), [value]);

    const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !EXTERNAL_LINK_RE.test(href)) return;
      e.preventDefault();
      window.open(href, '_blank');
    }, []);

    return (
      <div
        ref={ref}
        className={`markdown-preview prose prose-sm max-w-none ${className ?? ''}`}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
