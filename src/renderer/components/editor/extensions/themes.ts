import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

export type AppTheme = 'light' | 'dark' | 'solarized' | 'anime';

interface Palette {
  background: string;
  foreground: string;
  caret: string;
  selection: string;
  selectionMatch: string;
  lineHighlight: string;
  gutter: string;
  gutterText: string;
  border: string;
  heading: string;
  link: string;
  quote: string;
  emphasis: string;
  strong: string;
  code: string;
  codeBg: string;
  list: string;
  meta: string;
}

const PALETTES: Record<AppTheme, Palette> = {
  light: {
    background: '#ffffff',
    foreground: '#111827',
    caret: '#1d4ed8',
    selection: 'rgba(59, 130, 246, 0.18)',
    selectionMatch: 'rgba(59, 130, 246, 0.10)',
    lineHighlight: 'rgba(59, 130, 246, 0.04)',
    gutter: '#ffffff',
    gutterText: '#9ca3af',
    border: '#e5e7eb',
    heading: '#1e40af',
    link: '#2563eb',
    quote: '#6b7280',
    emphasis: '#4b5563',
    strong: '#111827',
    code: '#9333ea',
    codeBg: '#f3f4f6',
    list: '#3b82f6',
    meta: '#9ca3af',
  },
  dark: {
    background: '#1a1a2e',
    foreground: '#e2e8f0',
    caret: '#60a5fa',
    selection: 'rgba(96, 165, 250, 0.25)',
    selectionMatch: 'rgba(96, 165, 250, 0.15)',
    lineHighlight: 'rgba(96, 165, 250, 0.06)',
    gutter: '#1a1a2e',
    gutterText: '#64748b',
    border: '#1e293b',
    heading: '#93c5fd',
    link: '#60a5fa',
    quote: '#94a3b8',
    emphasis: '#cbd5e1',
    strong: '#f1f5f9',
    code: '#f0abfc',
    codeBg: '#0f3460',
    list: '#60a5fa',
    meta: '#64748b',
  },
  solarized: {
    background: '#fdf6e3',
    foreground: '#073642',
    caret: '#268bd2',
    selection: 'rgba(38, 139, 210, 0.20)',
    selectionMatch: 'rgba(38, 139, 210, 0.12)',
    lineHighlight: 'rgba(38, 139, 210, 0.04)',
    gutter: '#fdf6e3',
    gutterText: '#93a1a1',
    border: '#e0d9c4',
    heading: '#cb4b16',
    link: '#268bd2',
    quote: '#586e75',
    emphasis: '#586e75',
    strong: '#073642',
    code: '#d33682',
    codeBg: '#eee8d5',
    list: '#268bd2',
    meta: '#93a1a1',
  },
  anime: {
    background: '#fef5f8',
    foreground: '#2d1b30',
    caret: '#e84393',
    selection: 'rgba(232, 67, 147, 0.18)',
    selectionMatch: 'rgba(232, 67, 147, 0.10)',
    lineHighlight: 'rgba(232, 67, 147, 0.04)',
    gutter: '#fef5f8',
    gutterText: '#a88aab',
    border: '#f0d4e0',
    heading: '#e84393',
    link: '#a855f7',
    quote: '#a88aab',
    emphasis: '#6b4c6e',
    strong: '#2d1b30',
    code: '#d946ef',
    codeBg: '#f3e4ed',
    list: '#e84393',
    meta: '#a88aab',
  },
};

export function createEditorTheme(theme: AppTheme): Extension {
  const p = PALETTES[theme];

  const base = EditorView.theme(
    {
      '&': {
        backgroundColor: p.background,
        color: p.foreground,
        fontSize: '15px',
        height: '100%',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-content': {
        caretColor: p.caret,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        padding: '16px',
        lineHeight: '1.6',
      },
      '.cm-line': { padding: '0' },
      '.cm-cursor': { borderLeftColor: p.caret, borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: p.selection,
      },
      '.cm-selectionMatch': { backgroundColor: p.selectionMatch },
      '.cm-activeLine': { backgroundColor: p.lineHighlight },
      '.cm-gutters': {
        backgroundColor: p.gutter,
        color: p.gutterText,
        border: 'none',
      },
      '.cm-activeLineGutter': { backgroundColor: p.lineHighlight },
      '.cm-scroller': { overflow: 'auto' },
    },
    { dark: theme === 'dark' },
  );

  const highlight = HighlightStyle.define([
    { tag: t.heading1, color: p.heading, fontWeight: 'bold', fontSize: '1.5em' },
    { tag: t.heading2, color: p.heading, fontWeight: 'bold', fontSize: '1.3em' },
    { tag: t.heading3, color: p.heading, fontWeight: 'bold', fontSize: '1.15em' },
    { tag: [t.heading4, t.heading5, t.heading6], color: p.heading, fontWeight: 'bold' },
    { tag: t.strong, color: p.strong, fontWeight: 'bold' },
    { tag: t.emphasis, color: p.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: p.meta },
    { tag: t.link, color: p.link, textDecoration: 'underline' },
    { tag: t.url, color: p.link },
    { tag: t.quote, color: p.quote, fontStyle: 'italic' },
    { tag: t.monospace, color: p.code, backgroundColor: p.codeBg },
    { tag: t.list, color: p.list },
    { tag: t.meta, color: p.meta },
    { tag: t.processingInstruction, color: p.meta },
    { tag: t.contentSeparator, color: p.meta },
    { tag: t.atom, color: p.link },
  ]);

  return [base, syntaxHighlighting(highlight)];
}
