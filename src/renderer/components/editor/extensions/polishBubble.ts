import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export interface PolishSelectionInfo {
  from: number;
  to: number;
  text: string;
}

/** 选区文字至少要这么长，才会显示润色 bubble。避免误触。 */
const MIN_LENGTH = 4;

/**
 * 监听 CodeMirror 选区变化，当选中文字 >= MIN_LENGTH 时通过回调汇报选区
 * 信息；选区清空或太短时回调 null。React 层据此决定是否渲染浮动按钮。
 */
export function polishBubbleExtension(
  onChange: (sel: PolishSelectionInfo | null) => void,
): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet && !update.docChanged) return;
    const main = update.state.selection.main;
    if (main.empty) {
      onChange(null);
      return;
    }
    const text = update.state.sliceDoc(main.from, main.to);
    if (text.trim().length < MIN_LENGTH) {
      onChange(null);
      return;
    }
    onChange({ from: main.from, to: main.to, text });
  });
}
