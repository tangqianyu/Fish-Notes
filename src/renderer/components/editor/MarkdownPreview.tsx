import { useMemo, useCallback, forwardRef, type MouseEvent } from 'react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  value: string;
  className?: string;
}

const EXTERNAL_LINK_RE = /^(https?|mailto|tel):/i;

function renderMarkdown(md: string): string {
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

  // marked doesn't emit target/rel on links; add them so Electron's
  // setWindowOpenHandler can route external links to the default browser.
  html = html.replace(
    /<a (?![^>]*\btarget=)/g,
    '<a target="_blank" rel="noopener noreferrer" ',
  );

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
