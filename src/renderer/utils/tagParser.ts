/**
 * Parse #tags from HTML content.
 * Supports nested tags like #parent/child.
 * Extracts from <span class="hashtag"> elements and bare #tag text.
 * Ignores tags inside code/pre blocks.
 */
export function parseTags(content: string): string[] {
  const tags = new Set<string>();
  const tagRegex = /#([\p{L}\p{N}_][\p{L}\p{N}_/]*)/gu;

  // Extract from hashtag spans
  const spanRegex = /<span class="hashtag">#([\p{L}\p{N}_][\p{L}\p{N}_/]*)<\/span>/gu;
  let match;
  while ((match = spanRegex.exec(content)) !== null) {
    tags.add(match[1]);
  }

  // Also extract bare #tags from plain text (strip code/pre blocks and HTML tags)
  const cleaned = content
    .replace(/<code[\s>][\s\S]*?<\/code>/gi, '')
    .replace(/<pre[\s>][\s\S]*?<\/pre>/gi, '')
    .replace(/<[^>]*>/g, ' ');

  while ((match = tagRegex.exec(cleaned)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

/**
 * Build a tree structure from flat tag names.
 * e.g. ["work", "work/project", "personal"] =>
 * [{ name: "work", children: [{ name: "project", children: [] }] }, { name: "personal", children: [] }]
 */
export interface TagTreeNode {
  id: string;
  name: string;
  fullName: string;
  noteCount: number;
  isPinned: boolean;
  children: TagTreeNode[];
}

export function buildTagTree(tags: TagData[]): TagTreeNode[] {
  const roots: TagTreeNode[] = [];
  const nodeMap = new Map<string, TagTreeNode>();

  // Sort so parents come before children
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  for (const tag of sorted) {
    const parts = tag.name.split('/');
    const node: TagTreeNode = {
      id: tag.id,
      name: parts[parts.length - 1],
      fullName: tag.name,
      noteCount: tag.noteCount,
      isPinned: tag.isPinned,
      children: [],
    };
    nodeMap.set(tag.name, node);

    if (parts.length > 1) {
      const parentName = parts.slice(0, -1).join('/');
      const parent = nodeMap.get(parentName);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  // Pinned tags first, then alphabetical
  roots.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.fullName.localeCompare(b.fullName);
  });

  return roots;
}
