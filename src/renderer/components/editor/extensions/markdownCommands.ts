import { EditorView } from '@codemirror/view';
import { EditorSelection, type ChangeSpec } from '@codemirror/state';

type Command = (view: EditorView) => boolean;

function wrap(view: EditorView, before: string, after: string = before): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const newSelections = state.selection.ranges.map((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const insert = `${before}${selected}${after}`;
    changes.push({ from: range.from, to: range.to, insert });
    const anchor = range.from + before.length;
    return EditorSelection.range(anchor, anchor + selected.length);
  });
  view.dispatch({
    changes,
    selection: EditorSelection.create(newSelections, state.selection.mainIndex),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

function toggleWrap(view: EditorView, marker: string): boolean {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);

  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: inner },
      selection: EditorSelection.range(range.from, range.from + inner.length),
      scrollIntoView: true,
    });
    view.focus();
    return true;
  }

  return wrap(view, marker);
}

function applyLinePrefix(
  view: EditorView,
  prefix: string,
  options?: { exclusive?: RegExp[] },
): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const lineDeltas = new Map<number, number>();

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = state.doc.line(n);
      if (lineDeltas.has(line.from)) continue;
      let stripped = line.text;
      let oldPrefixLen = 0;
      if (options?.exclusive) {
        for (const re of options.exclusive) {
          const before = stripped;
          stripped = stripped.replace(re, '');
          if (stripped !== before) oldPrefixLen += before.length - stripped.length;
        }
      }
      changes.push({ from: line.from, to: line.to, insert: `${prefix}${stripped}` });
      lineDeltas.set(line.from, prefix.length - oldPrefixLen);
    }
  }

  const sortedDeltas = Array.from(lineDeltas.entries()).sort((a, b) => a[0] - b[0]);
  const shift = (oldPos: number): number => {
    let cumulative = 0;
    for (const [lineFrom, delta] of sortedDeltas) {
      if (lineFrom <= oldPos) cumulative += delta;
      else break;
    }
    return oldPos + cumulative;
  };

  const newRanges = state.selection.ranges.map((r) =>
    r.empty
      ? EditorSelection.cursor(shift(r.head))
      : EditorSelection.range(shift(r.anchor), shift(r.head)),
  );

  view.dispatch({
    changes,
    selection: EditorSelection.create(newRanges, state.selection.mainIndex),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

const HEADING_RE = /^#{1,6}\s+/;

export const toggleBold: Command = (view) => toggleWrap(view, '**');
export const toggleItalic: Command = (view) => toggleWrap(view, '*');
export const toggleStrikethrough: Command = (view) => toggleWrap(view, '~~');
export const toggleInlineCode: Command = (view) => toggleWrap(view, '`');

export const insertCodeBlock: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const insert = `\n\`\`\`\n${selected || ''}\n\`\`\`\n`;
  const cursor = range.from + (selected ? insert.length : 5);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(cursor),
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

export const insertLink: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const text = selected || 'text';
  const insert = `[${text}](url)`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(
      range.from + insert.length - 4,
      range.from + insert.length - 1,
    ),
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

export const insertImage: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const insert = `![](url)`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(
      range.from + insert.length - 4,
      range.from + insert.length - 1,
    ),
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

export const insertDivider: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  const prefix = line.text ? '\n\n' : '';
  const insert = `${prefix}---\n\n`;
  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length),
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

export const toggleBlockquote: Command = (view) =>
  applyLinePrefix(view, '> ', { exclusive: [/^>\s?/] });

export const toggleBulletList: Command = (view) =>
  applyLinePrefix(view, '- ', { exclusive: [/^[-*+]\s+/, /^\d+\.\s+/] });

export const toggleOrderedList: Command = (view) =>
  applyLinePrefix(view, '1. ', { exclusive: [/^[-*+]\s+/, /^\d+\.\s+/] });

export const toggleTaskList: Command = (view) =>
  applyLinePrefix(view, '- [ ] ', { exclusive: [/^[-*+]\s+(\[.\]\s+)?/, /^\d+\.\s+/] });

export const headingCommands = (level: 1 | 2 | 3 | 4 | 5 | 6): Command =>
  (view) => applyLinePrefix(view, '#'.repeat(level) + ' ', { exclusive: [HEADING_RE] });

// ---------- Table ----------

const MIN_CELL_WIDTH = 3;
const SEPARATOR_CELL = /^:?-+:?$/;

function isTableLine(text: string): boolean {
  return /^\s*\|/.test(text);
}

function parseTableLine(text: string): string[] | null {
  let t = text.trim();
  if (!t.startsWith('|')) return null;
  if (t.endsWith('|')) t = t.slice(0, -1);
  t = t.slice(1);
  return t.split('|').map((c) => c.trim());
}

// CJK ideographs, Hangul, Hiragana/Katakana, fullwidth forms, common emoji —
// all occupy 2 column-widths in a monospace font.
function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x2fffd) ||
    (code >= 0x30000 && code <= 0x3fffd)
  );
}

function displayWidth(s: string): number {
  let w = 0;
  for (const char of s) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    w += isWide(code) ? 2 : 1;
  }
  return w;
}

function padEndDisplay(s: string, width: number): string {
  const cur = displayWidth(s);
  if (cur >= width) return s;
  return s + ' '.repeat(width - cur);
}

function buildTableText(rows: string[][], separatorIndex: number): string {
  const numCols = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    while (row.length < numCols) row.push('');
  }

  const widths = new Array(numCols).fill(MIN_CELL_WIDTH);
  for (let r = 0; r < rows.length; r++) {
    if (r === separatorIndex) continue;
    for (let c = 0; c < numCols; c++) {
      widths[c] = Math.max(widths[c], displayWidth(rows[r][c]));
    }
  }

  return rows
    .map((row, idx) => {
      if (idx === separatorIndex) {
        return (
          '| ' +
          widths
            .map((w, i) => {
              const sep = row[i] || '---';
              const leftAlign = sep.startsWith(':');
              const rightAlign = sep.endsWith(':') && sep.length > 1;
              let dashes = '-'.repeat(w);
              if (leftAlign) dashes = ':' + dashes.slice(1);
              if (rightAlign) dashes = dashes.slice(0, -1) + ':';
              return dashes;
            })
            .join(' | ') +
          ' |'
        );
      }
      return '| ' + widths.map((w, i) => padEndDisplay(row[i], w)).join(' | ') + ' |';
    })
    .join('\n');
}

export function insertTable(rows: number, cols: number): Command {
  return (view) => {
    const { state } = view;
    const range = state.selection.main;
    const line = state.doc.lineAt(range.from);
    const prefix = line.text ? '\n\n' : '';

    const dataRows = Math.max(1, rows - 1);
    const tableRows: string[][] = [];
    tableRows.push(new Array(cols).fill(''));
    tableRows.push(new Array(cols).fill('---'));
    for (let i = 0; i < dataRows; i++) {
      tableRows.push(new Array(cols).fill(''));
    }

    const table = buildTableText(tableRows, 1);
    const insert = `${prefix}${table}\n`;
    const insertPos = line.to;

    // Place cursor inside the first header cell (after "| ")
    const cursorOffset = insertPos + prefix.length + 2;

    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert },
      selection: EditorSelection.cursor(cursorOffset),
      scrollIntoView: true,
    });
    view.focus();
    return true;
  };
}

export const formatTable: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const currentLine = state.doc.lineAt(range.from);
  if (!isTableLine(currentLine.text)) return false;

  let startLineNum = currentLine.number;
  while (startLineNum > 1 && isTableLine(state.doc.line(startLineNum - 1).text)) {
    startLineNum--;
  }
  let endLineNum = currentLine.number;
  while (endLineNum < state.doc.lines && isTableLine(state.doc.line(endLineNum + 1).text)) {
    endLineNum++;
  }

  const rows: string[][] = [];
  let separatorIndex = -1;
  for (let n = startLineNum; n <= endLineNum; n++) {
    const cells = parseTableLine(state.doc.line(n).text);
    if (cells === null) continue;
    if (separatorIndex === -1 && cells.length > 0 && cells.every((c) => SEPARATOR_CELL.test(c))) {
      separatorIndex = rows.length;
    }
    rows.push(cells);
  }
  if (rows.length === 0) return false;

  const formatted = buildTableText(rows, separatorIndex);
  const fromPos = state.doc.line(startLineNum).from;
  const toPos = state.doc.line(endLineNum).to;

  view.dispatch({
    changes: { from: fromPos, to: toPos, insert: formatted },
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

export type MarkdownCommand = Command;
