import { EditorView, keymap } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

const BULLET_RE = /^(\s*)([-*+])\s+(\[ \]\s+)?(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)\.\s+(.*)$/;

function continueList(view: EditorView): boolean {
  const { state } = view;
  if (state.selection.ranges.length !== 1) return false;
  const range = state.selection.main;
  if (!range.empty) return false;

  const line = state.doc.lineAt(range.from);

  const bulletMatch = line.text.match(BULLET_RE);
  if (bulletMatch) {
    const [, indent, marker, task, rest] = bulletMatch;
    if (!rest.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: EditorSelection.cursor(line.from),
      });
      return true;
    }
    const prefix = `${indent}${marker} ${task ? '[ ] ' : ''}`;
    const insert = `\n${prefix}`;
    view.dispatch({
      changes: { from: range.from, to: range.from, insert },
      selection: EditorSelection.cursor(range.from + insert.length),
      scrollIntoView: true,
    });
    return true;
  }

  const orderedMatch = line.text.match(ORDERED_RE);
  if (orderedMatch) {
    const [, indent, num, rest] = orderedMatch;
    if (!rest.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: EditorSelection.cursor(line.from),
      });
      return true;
    }
    const next = parseInt(num, 10) + 1;
    const insert = `\n${indent}${next}. `;
    view.dispatch({
      changes: { from: range.from, to: range.from, insert },
      selection: EditorSelection.cursor(range.from + insert.length),
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

export const smartListKeymap = keymap.of([
  {
    key: 'Enter',
    run: continueList,
  },
]);
