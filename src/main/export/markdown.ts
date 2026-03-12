import { writeFileSync } from 'node:fs';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Custom rule: hashtag spans should output their text content directly
turndown.addRule('hashtag', {
  filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('hashtag'),
  replacement: (content) => content,
});

export function exportMarkdown(filePath: string, htmlContent: string): void {
  const markdown = turndown.turndown(htmlContent);
  writeFileSync(filePath, markdown, 'utf-8');
}
