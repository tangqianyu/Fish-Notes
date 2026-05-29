import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, drawSelection, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

import { createEditorTheme, type AppTheme } from './extensions/themes';
import { smartListKeymap } from './extensions/smartTyping';
import { imageHandling } from './extensions/imageHandling';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertCodeBlock,
  insertLink,
  toggleBlockquote,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  headingCommands,
} from './extensions/markdownCommands';

export interface CodeMirrorHandle {
  view: EditorView | null;
  focus: () => void;
}

interface CodeMirrorViewProps {
  defaultValue: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  theme: AppTheme;
  className?: string;
}

const CodeMirrorView = forwardRef<CodeMirrorHandle, CodeMirrorViewProps>(
  ({ defaultValue, onChange, onSave, theme, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;

    useImperativeHandle(
      ref,
      () => ({
        get view() {
          return viewRef.current;
        },
        focus: () => viewRef.current?.focus(),
      }),
      [],
    );

    useEffect(() => {
      if (!containerRef.current) return;

      const extensions: Extension[] = [
        lineNumbers({ formatNumber: () => '' }),
        history(),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        smartListKeymap,
        imageHandling,
        keymap.of([
          { key: 'Mod-b', run: toggleBold, preventDefault: true },
          { key: 'Mod-i', run: toggleItalic, preventDefault: true },
          { key: 'Mod-Shift-s', run: toggleStrikethrough, preventDefault: true },
          { key: 'Mod-e', run: toggleInlineCode, preventDefault: true },
          { key: 'Mod-Shift-e', run: insertCodeBlock, preventDefault: true },
          { key: 'Mod-k', run: insertLink, preventDefault: true },
          { key: 'Mod-Shift-.', run: toggleBlockquote, preventDefault: true },
          { key: 'Mod-Shift-l', run: toggleBulletList, preventDefault: true },
          { key: 'Mod-Shift-o', run: toggleOrderedList, preventDefault: true },
          { key: 'Mod-Shift-t', run: toggleTaskList, preventDefault: true },
          { key: 'Mod-1', run: headingCommands(1), preventDefault: true },
          { key: 'Mod-2', run: headingCommands(2), preventDefault: true },
          { key: 'Mod-3', run: headingCommands(3), preventDefault: true },
          { key: 'Mod-4', run: headingCommands(4), preventDefault: true },
          { key: 'Mod-5', run: headingCommands(5), preventDefault: true },
          { key: 'Mod-6', run: headingCommands(6), preventDefault: true },
          {
            key: 'Mod-s',
            run: () => {
              onSaveRef.current?.();
              return true;
            },
            preventDefault: true,
          },
        ]),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        createEditorTheme(theme),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ];

      const state = EditorState.create({
        doc: defaultValue,
        extensions,
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, [theme]);

    return <div ref={containerRef} className={className} />;
  },
);

CodeMirrorView.displayName = 'CodeMirrorView';

export default CodeMirrorView;
