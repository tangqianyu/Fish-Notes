import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

export type AppTheme =
  | 'light'
  | 'dark'
  | 'solarized'
  | 'anime'
  | 'anime-night'
  | 'cinnamoroll'
  | 'cinnamoroll-night'
  | 'kuromi'
  | 'kuromi-night'
  | 'melody'
  | 'melody-night'
  | 'totoro'
  | 'totoro-night'
  | 'ink'
  | 'ink-night';

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
  /** When set, headings render as gradient text (background-clip: text). */
  headingGradient?: string;
}

const PALETTES: Record<AppTheme, Palette> = {
  light: {
    background: '#ffffff',
    foreground: '#3d4257',
    caret: '#7c5cfc',
    selection: 'rgba(124, 92, 252, 0.18)',
    selectionMatch: 'rgba(59, 130, 246, 0.12)',
    lineHighlight: 'rgba(93, 103, 246, 0.04)',
    gutter: '#ffffff',
    gutterText: '#a6abc4',
    border: '#e7e9f4',
    heading: '#5b5ff0',
    headingGradient: 'linear-gradient(135deg, #3b82f6, #7c5cfc)',
    link: '#5b5ff0',
    quote: '#878ca0',
    emphasis: '#4b5068',
    strong: '#171923',
    code: '#7c5cfc',
    codeBg: '#f0f1f8',
    list: '#3b82f6',
    meta: '#a6abc4',
  },
  dark: {
    background: '#12141f',
    foreground: '#c5c9e2',
    caret: '#9d7bff',
    selection: 'rgba(157, 123, 255, 0.25)',
    selectionMatch: 'rgba(91, 156, 255, 0.16)',
    lineHighlight: 'rgba(125, 124, 255, 0.06)',
    gutter: '#12141f',
    gutterText: '#585e7c',
    border: '#232739',
    heading: '#8cb0ff',
    headingGradient: 'linear-gradient(135deg, #8cb0ff, #c0a6ff)',
    link: '#8cb0ff',
    quote: '#7c82a0',
    emphasis: '#a9aec9',
    strong: '#e8eaf6',
    code: '#c0a6ff',
    codeBg: '#1b2033',
    list: '#5b9cff',
    meta: '#585e7c',
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
    background: '#fffbf5',
    foreground: '#5c4a42',
    caret: '#d96bc8',
    selection: 'rgba(217, 107, 200, 0.20)',
    selectionMatch: 'rgba(255, 147, 87, 0.14)',
    lineHighlight: 'rgba(232, 120, 90, 0.05)',
    gutter: '#fffbf5',
    gutterText: '#c4b3a5',
    border: '#f0e3d3',
    heading: '#c2532f',
    headingGradient: 'linear-gradient(135deg, #f27a3f, #c95fbf)',
    link: '#c95fbf',
    quote: '#a18a7e',
    emphasis: '#6e5a52',
    strong: '#392e2b',
    code: '#c95fbf',
    codeBg: '#f5e9db',
    list: '#e8794b',
    meta: '#c4b3a5',
  },
  cinnamoroll: {
    background: '#fbfdff',
    foreground: '#46586d',
    caret: '#6fbbf0',
    selection: 'rgba(111, 187, 240, 0.22)',
    selectionMatch: 'rgba(155, 168, 248, 0.16)',
    lineHighlight: 'rgba(111, 187, 240, 0.05)',
    gutter: '#fbfdff',
    gutterText: '#a9c0d6',
    border: '#dfecf8',
    heading: '#3e8fd8',
    headingGradient: 'linear-gradient(135deg, #4fa3e8, #8290f0)',
    link: '#4fa3e8',
    quote: '#93a9be',
    emphasis: '#5e7288',
    strong: '#3a4a5c',
    code: '#8290f0',
    codeBg: '#e8f2fc',
    list: '#4fa3e8',
    meta: '#a9c0d6',
  },
  'cinnamoroll-night': {
    background: '#1c2340',
    foreground: '#c3cdec',
    caret: '#b69cff',
    selection: 'rgba(126, 166, 255, 0.28)',
    selectionMatch: 'rgba(182, 156, 255, 0.18)',
    lineHighlight: 'rgba(126, 166, 255, 0.07)',
    gutter: '#1c2340',
    gutterText: '#5d6890',
    border: '#2a335c',
    heading: '#9bc4ff',
    headingGradient: 'linear-gradient(135deg, #9bc4ff, #d0b8ff)',
    link: '#9bc4ff',
    quote: '#7d89af',
    emphasis: '#afbbdd',
    strong: '#e6ecff',
    code: '#d0b8ff',
    codeBg: '#283158',
    list: '#9bc4ff',
    meta: '#5d6890',
  },
  'anime-night': {
    background: '#14142b',
    foreground: '#bcb8e2',
    caret: '#c77bff',
    selection: 'rgba(199, 123, 255, 0.25)',
    selectionMatch: 'rgba(110, 141, 255, 0.18)',
    lineHighlight: 'rgba(150, 125, 255, 0.07)',
    gutter: '#14142b',
    gutterText: '#625e93',
    border: '#272652',
    heading: '#8fa6ff',
    headingGradient: 'linear-gradient(135deg, #8fa6ff, #d89bff)',
    link: '#8fa6ff',
    quote: '#918dbe',
    emphasis: '#b3afda',
    strong: '#ebe9ff',
    code: '#d89bff',
    codeBg: '#201f45',
    list: '#8fa6ff',
    meta: '#625e93',
  },
  kuromi: {
    background: '#faf8fc',
    foreground: '#453956',
    caret: '#8b5cd6',
    selection: 'rgba(139, 92, 214, 0.20)',
    selectionMatch: 'rgba(232, 92, 168, 0.14)',
    lineHighlight: 'rgba(139, 92, 214, 0.05)',
    gutter: '#faf8fc',
    gutterText: '#b3a5c8',
    border: '#e7dff1',
    heading: '#8b5cd6',
    headingGradient: 'linear-gradient(135deg, #8b5cd6, #e85ca8)',
    link: '#a85cd6',
    quote: '#9b8bb0',
    emphasis: '#5a4b6e',
    strong: '#2e2438',
    code: '#d6559e',
    codeBg: '#efe8f7',
    list: '#8b5cd6',
    meta: '#b3a5c8',
  },
  'kuromi-night': {
    background: '#171223',
    foreground: '#cfc2e4',
    caret: '#f065b8',
    selection: 'rgba(196, 124, 255, 0.25)',
    selectionMatch: 'rgba(240, 101, 184, 0.18)',
    lineHighlight: 'rgba(160, 108, 232, 0.07)',
    gutter: '#171223',
    gutterText: '#66588a',
    border: '#2c2244',
    heading: '#c98bf5',
    headingGradient: 'linear-gradient(135deg, #b98bf5, #f58bc8)',
    link: '#c98bf5',
    quote: '#7e6f96',
    emphasis: '#b5a6cc',
    strong: '#ece4f8',
    code: '#f58bc8',
    codeBg: '#261d3d',
    list: '#b98bf5',
    meta: '#66588a',
  },
  melody: {
    background: '#fffafb',
    foreground: '#59434d',
    caret: '#ec5f94',
    selection: 'rgba(236, 95, 148, 0.18)',
    selectionMatch: 'rgba(249, 139, 176, 0.13)',
    lineHighlight: 'rgba(236, 95, 148, 0.045)',
    gutter: '#fffafb',
    gutterText: '#c4a8b3',
    border: '#f6dfe7',
    heading: '#e0608e',
    headingGradient: 'linear-gradient(135deg, #f27ba8, #de5a8c)',
    link: '#de5a8c',
    quote: '#b195a0',
    emphasis: '#6e5560',
    strong: '#46323c',
    code: '#d8548a',
    codeBg: '#f9e4eb',
    list: '#ef7aa6',
    meta: '#c4a8b3',
  },
  'melody-night': {
    background: '#241521',
    foreground: '#dbc0cd',
    caret: '#f48eb4',
    selection: 'rgba(244, 142, 180, 0.25)',
    selectionMatch: 'rgba(224, 106, 164, 0.16)',
    lineHighlight: 'rgba(244, 142, 180, 0.06)',
    gutter: '#241521',
    gutterText: '#7c5c70',
    border: '#3c2536',
    heading: '#f48eb4',
    headingGradient: 'linear-gradient(135deg, #f7a3c3, #e06aa4)',
    link: '#f48eb4',
    quote: '#9a7288',
    emphasis: '#d0aec0',
    strong: '#f7e6ee',
    code: '#f7a3c3',
    codeBg: '#3a2433',
    list: '#f48eb4',
    meta: '#7c5c70',
  },
  totoro: {
    background: '#fbfbf4',
    foreground: '#49543f',
    caret: '#5b8a46',
    selection: 'rgba(107, 163, 94, 0.20)',
    selectionMatch: 'rgba(192, 133, 82, 0.15)',
    lineHighlight: 'rgba(107, 163, 94, 0.05)',
    gutter: '#fbfbf4',
    gutterText: '#a9b399',
    border: '#e1e7d1',
    heading: '#4e8a57',
    headingGradient: 'linear-gradient(135deg, #4e8a57, #8ab04e)',
    link: '#4e8a57',
    quote: '#97a588',
    emphasis: '#5c6b51',
    strong: '#33402c',
    code: '#b9793f',
    codeBg: '#eaf0dc',
    list: '#5b8a46',
    meta: '#a9b399',
  },
  'totoro-night': {
    background: '#16211a',
    foreground: '#bccbb0',
    caret: '#a8d88a',
    selection: 'rgba(158, 214, 130, 0.22)',
    selectionMatch: 'rgba(228, 208, 107, 0.16)',
    lineHighlight: 'rgba(158, 214, 130, 0.06)',
    gutter: '#16211a',
    gutterText: '#5c6f56',
    border: '#2a3b28',
    heading: '#a8d88a',
    headingGradient: 'linear-gradient(135deg, #a8d88a, #e0d878)',
    link: '#a8d88a',
    quote: '#74886f',
    emphasis: '#abc2a2',
    strong: '#e4eedd',
    code: '#e0d878',
    codeBg: '#253a23',
    list: '#a8d88a',
    meta: '#5c6f56',
  },
  ink: {
    background: '#f9f6ef',
    foreground: '#3c362e',
    caret: '#2b2723',
    selection: 'rgba(60, 56, 52, 0.15)',
    selectionMatch: 'rgba(176, 58, 46, 0.12)',
    lineHighlight: 'rgba(60, 56, 52, 0.04)',
    gutter: '#f9f6ef',
    gutterText: '#b3a992',
    border: '#e4dece',
    heading: '#2b2723',
    link: '#b03a2e',
    quote: '#9c9485',
    emphasis: '#5a544b',
    strong: '#1d1a16',
    code: '#96622e',
    codeBg: '#eee8d9',
    list: '#6b6153',
    meta: '#b3a992',
  },
  'ink-night': {
    background: '#1e1c19',
    foreground: '#cfc8ba',
    caret: '#e8e2d6',
    selection: 'rgba(232, 226, 214, 0.14)',
    selectionMatch: 'rgba(224, 106, 90, 0.15)',
    lineHighlight: 'rgba(232, 226, 214, 0.05)',
    gutter: '#1e1c19',
    gutterText: '#6a6458',
    border: '#33302a',
    heading: '#e8e2d6',
    link: '#e06a5a',
    quote: '#7d766a',
    emphasis: '#b3ab9c',
    strong: '#f2ecdf',
    code: '#d9a86a',
    codeBg: '#2e2b26',
    list: '#a89f8e',
    meta: '#6a6458',
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
        // Prefer CJK-monospace fonts (strict 2:1 with ASCII) when installed;
        // otherwise the system CJK fallback kicks in.
        fontFamily:
          '"Sarasa Mono SC", "Sarasa Mono SC Nerd", "Source Han Code JP", "Noto Sans Mono CJK SC", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
    { dark: theme === 'dark' || theme.endsWith('-night') },
  );

  // Gradient text for headings (anime themes); falls back to a solid color.
  const headingColor = p.headingGradient
    ? {
        background: p.headingGradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    : { color: p.heading };

  const highlight = HighlightStyle.define([
    { tag: t.heading1, ...headingColor, fontWeight: 'bold', fontSize: '1.5em' },
    { tag: t.heading2, ...headingColor, fontWeight: 'bold', fontSize: '1.3em' },
    { tag: t.heading3, ...headingColor, fontWeight: 'bold', fontSize: '1.15em' },
    { tag: [t.heading4, t.heading5, t.heading6], ...headingColor, fontWeight: 'bold' },
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
