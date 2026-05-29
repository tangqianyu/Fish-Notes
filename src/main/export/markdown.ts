import { writeFileSync } from 'node:fs';

export function exportMarkdown(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8');
}
