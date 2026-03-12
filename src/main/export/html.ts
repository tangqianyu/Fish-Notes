import { writeFileSync } from 'node:fs';

export function exportHtml(filePath: string, title: string, content: string): void {
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
    li { margin: 0.25em 0; }
    img { max-width: 100%; }
    .hashtag { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 0.1em 0.4em; border-radius: 0.375rem; font-weight: 500; }
  </style>
</head>
<body>
${content}
</body>
</html>`;

  writeFileSync(filePath, document, 'utf-8');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
