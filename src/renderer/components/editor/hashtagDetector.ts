import type { Editor } from 'tinymce';

const HASHTAG_REGEX = /#([\p{L}\p{N}_][\p{L}\p{N}_/]*)/gu;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleHashtagDetection(editor: Editor): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => detectAndStyleHashtags(editor), 300);
}

function detectAndStyleHashtags(editor: Editor): void {
  const body = editor.getBody();
  if (!body) return;

  // Identify the text node the cursor is currently in — we must NOT touch it
  const rng = editor.selection.getRng();
  const cursorNode = rng.startContainer;

  // Clean up stale hashtag spans first (text was edited away from a tag)
  const existingSpans = body.querySelectorAll('span.hashtag');
  existingSpans.forEach((span) => {
    const spanText = span.textContent || '';
    HASHTAG_REGEX.lastIndex = 0;
    if (!HASHTAG_REGEX.test(spanText)) {
      const textNode = document.createTextNode(spanText);
      span.replaceWith(textNode);
    }
  });

  // Walk all text nodes, skipping the one under the cursor
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip the text node containing the cursor to prevent cursor jumping
      if (node === cursorNode) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('code, pre, span.hashtag')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text);
  }

  if (textNodes.length === 0) return;

  // Process in reverse to avoid index shifting
  for (const textNode of textNodes.reverse()) {
    const text = textNode.textContent || '';
    HASHTAG_REGEX.lastIndex = 0;
    const matches = [...text.matchAll(HASHTAG_REGEX)];
    if (matches.length === 0) continue;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      const matchStart = match.index!;
      if (matchStart > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, matchStart)));
      }
      const span = document.createElement('span');
      span.className = 'hashtag';
      span.textContent = match[0];
      frag.appendChild(span);
      lastIndex = matchStart + match[0].length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(frag);
  }
}
