export function stripMarkdown(md: string): string {
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

export function extractTitleFromMarkdown(md: string, fallback = '无标题'): string {
  if (!md) return fallback;
  const h1 = md.match(/^#\s+(.+?)\s*$/m);
  if (h1) return stripMarkdown(h1[1]) || fallback;
  const firstLine = md.split('\n').find((line) => line.trim().length > 0);
  return firstLine ? stripMarkdown(firstLine) || fallback : fallback;
}

export function buildNotePreview(md: string, max = 80): string {
  return stripMarkdown(md).slice(0, max);
}
