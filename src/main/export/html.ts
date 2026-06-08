import { writeFileSync } from 'node:fs';
import { markdownToHtml } from '../markdown';

export function exportHtml(filePath: string, title: string, markdown: string): void {
  const bodyHtml = markdownToHtml(markdown);
  const document = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #d1d5db; margin: 1em 0; padding: 0.25em 1em; color: #4b5563; }
    li { margin: 0.25em 0; }
    p.md-blank { margin: 0; line-height: 1.6; }
    img { max-width: 100%; }
    table { border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #d1d5db; padding: 0.5em 0.75em; }
    th { background: #f3f4f6; }
    .hashtag { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 0.1em 0.4em; border-radius: 0.375rem; font-weight: 500; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  writeFileSync(filePath, document, 'utf-8');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
