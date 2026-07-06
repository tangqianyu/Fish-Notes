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

export const headingCommands =
  (level: 1 | 2 | 3 | 4 | 5 | 6): Command =>
  (view) =>
    applyLinePrefix(view, '#'.repeat(level) + ' ', { exclusive: [HEADING_RE] });

// ---------- Table ----------

const MIN_CELL_WIDTH = 3;
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

/**
 * 实测编辑器字体里 CJK 与 ASCII 的宽度比。
 * 严格 2:1 的中英等宽字体（Sarasa 等）返回 2；系统回退到 PingFang 之类的
 * 非 2:1 字体时返回真实比例（≈1.67），列宽按它计算才能对齐。
 */
let ratioCache: { key: string; ratio: number } | null = null;
function measureCjkRatio(view: EditorView): number {
  try {
    const cs = window.getComputedStyle(view.contentDOM);
    // 缓存键包含字体加载状态：打包字体异步加载完成前后实际渲染字体不同
    const fontsReady = document.fonts?.check?.(`${cs.fontSize} ${cs.fontFamily}`) ? '1' : '0';
    const key = `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}|${fontsReady}`;
    if (ratioCache?.key === key) return ratioCache.ratio;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return 2;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ascii = ctx.measureText('0000000000').width / 10;
    const cjk = ctx.measureText('中中中中中中中中中中').width / 10;
    let ratio = ascii > 0 ? cjk / ascii : 2;
    if (!Number.isFinite(ratio) || ratio <= 0) ratio = 2;
    if (Math.abs(ratio - 2) < 0.05) ratio = 2;
    ratioCache = { key, ratio };
    return ratio;
  } catch {
    return 2;
  }
}

/** 显示宽度，单位 = 一个 ASCII 字符宽；宽字符按实测 ratio 计 */
function displayWidth(s: string, ratio: number): number {
  let w = 0;
  for (const char of s) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    w += isWide(code) ? ratio : 1;
  }
  return w;
}

const IDEOGRAPHIC_SPACE = '\u3000';

/**
 * 生成宽度尽量接近 pad 的填充。非 2:1 字体下目标宽度是小数，纯 ASCII 空格
 * 最多差半格；混入全角空格（宽度 = ratio）后误差能压到 ~0.17 格以内。
 * ratio === 2 时纯空格即可精确命中，不会引入全角空格。
 */
function buildPadding(pad: number, ratio: number): { text: string; width: number; err: number } {
  if (pad <= 0) return { text: '', width: 0, err: Math.max(0, -pad) };
  let best = { text: '', width: 0, err: Infinity };
  const maxK = ratio > 1 ? Math.round(pad / ratio) : 0;
  for (let k = 0; k <= maxK; k++) {
    const m = Math.max(0, Math.round(pad - k * ratio));
    const width = k * ratio + m;
    const err = Math.abs(pad - width);
    // 平手时偏向更少的全角空格（源文本更干净）
    if (err < best.err - 1e-6) {
      best = { text: IDEOGRAPHIC_SPACE.repeat(k) + ' '.repeat(m), width, err };
    }
  }
  return best;
}

/**
 * 把列宽量化到整数格位：分隔行全是 ASCII 短横线，只能落在整数宽度上；
 * 目标取整后分隔线可精确对齐。在候选整数里挑一个让"最宽单元格的填充"
 * 也能被空格组合精确命中的，消掉最后一点偏差。
 */
function quantizeWidth(w: number, ratio: number): number {
  const base = Math.max(MIN_CELL_WIDTH, Math.ceil(w - 1e-6));
  if (ratio === 2) return base; // 2:1 字体下宽度本来就是整数
  for (let cand = base; cand <= base + 2; cand++) {
    if (buildPadding(cand - w, ratio).err <= 0.06) return cand;
  }
  return base;
}

function buildTableText(rows: string[][], separatorIndex: number, ratio: number): string {
  const numCols = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    while (row.length < numCols) row.push('');
  }

  const rawWidths: number[] = new Array(numCols).fill(MIN_CELL_WIDTH);
  for (let r = 0; r < rows.length; r++) {
    if (r === separatorIndex) continue;
    for (let c = 0; c < numCols; c++) {
      rawWidths[c] = Math.max(rawWidths[c], displayWidth(rows[r][c], ratio));
    }
  }
  const widths = rawWidths.map((w) => quantizeWidth(w, ratio));

  // 逐行按"累计目标宽度"渲染：每个竖线都对齐到同一目标位置，误差不随列数累积
  const renderRow = (cells: string[], isSep: boolean): string => {
    let out = '| ';
    let actual = 2;
    let target = 2;
    for (let c = 0; c < numCols; c++) {
      target += widths[c];
      if (isSep) {
        const sep = cells[c] || '---';
        const leftAlign = sep.startsWith(':');
        const rightAlign = sep.endsWith(':') && sep.length > 1;
        const d = Math.max(3, Math.round(target - actual));
        let dashes = '-'.repeat(d);
        if (leftAlign) dashes = ':' + dashes.slice(1);
        if (rightAlign) dashes = dashes.slice(0, -1) + ':';
        out += dashes;
        actual += d;
      } else {
        const cell = cells[c];
        out += cell;
        actual += displayWidth(cell, ratio);
        const padding = buildPadding(target - actual, ratio);
        out += padding.text;
        actual += padding.width;
      }
      const joint = c < numCols - 1 ? ' | ' : ' |';
      out += joint;
      actual += joint.length;
      target += joint.length;
    }
    return out;
  };

  return rows.map((row, idx) => renderRow(row, idx === separatorIndex)).join('\n');
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

    const table = buildTableText(tableRows, 1, measureCjkRatio(view));
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


export type MarkdownCommand = Command;
