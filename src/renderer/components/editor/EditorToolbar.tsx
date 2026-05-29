import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorView } from '@codemirror/view';
import Tooltip from '../Tooltip';
import TablePicker from './TablePicker';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertCodeBlock,
  insertLink,
  insertImage,
  insertDivider,
  insertTable,
  formatTable,
  toggleBlockquote,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  headingCommands,
  type MarkdownCommand,
} from './extensions/markdownCommands';

interface EditorToolbarProps {
  getView: () => EditorView | null;
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function shortcut(...keys: Array<'Mod' | 'Shift' | 'Alt' | string>): string[] {
  const map: Record<string, string> = isMac
    ? { Mod: '⌘', Shift: '⇧', Alt: '⌥' }
    : { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };
  return keys.map((k) => map[k] ?? k);
}

interface ToolButton {
  key: string;
  labelKey: string;
  shortcut?: string[];
  icon: ReactNode;
  command: MarkdownCommand;
}

const icon = (path: ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

const BASIC_BUTTONS: ToolButton[] = [
  {
    key: 'bold',
    labelKey: 'Bold',
    shortcut: shortcut('Mod', 'B'),
    icon: icon(<><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></>),
    command: toggleBold,
  },
  {
    key: 'italic',
    labelKey: 'Italic',
    shortcut: shortcut('Mod', 'I'),
    icon: icon(<><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></>),
    command: toggleItalic,
  },
  {
    key: 'strike',
    labelKey: 'Strikethrough',
    shortcut: shortcut('Mod', 'Shift', 'S'),
    icon: icon(<><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" y1="12" x2="20" y2="12" /></>),
    command: toggleStrikethrough,
  },
];

const STRUCTURE_BUTTONS: ToolButton[] = [
  {
    key: 'quote',
    labelKey: 'Blockquote',
    shortcut: shortcut('Mod', 'Shift', '.'),
    icon: icon(<><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></>),
    command: toggleBlockquote,
  },
  {
    key: 'link',
    labelKey: 'Link',
    shortcut: shortcut('Mod', 'K'),
    icon: icon(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
    command: insertLink,
  },
];

const CODE_BUTTONS: ToolButton[] = [
  {
    key: 'inline-code',
    labelKey: 'Inline code',
    shortcut: shortcut('Mod', 'E'),
    icon: icon(<><polyline points="9 9 4 12 9 15" /><polyline points="15 9 20 12 15 15" /></>),
    command: toggleInlineCode,
  },
  {
    key: 'code-block',
    labelKey: 'Code block',
    shortcut: shortcut('Mod', 'Shift', 'E'),
    icon: icon(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>),
    command: insertCodeBlock,
  },
];

const LIST_BUTTONS: ToolButton[] = [
  {
    key: 'ul',
    labelKey: 'Bulleted list',
    shortcut: shortcut('Mod', 'Shift', 'L'),
    icon: icon(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>),
    command: toggleBulletList,
  },
  {
    key: 'ol',
    labelKey: 'Numbered list',
    shortcut: shortcut('Mod', 'Shift', 'O'),
    icon: icon(<><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>),
    command: toggleOrderedList,
  },
  {
    key: 'task',
    labelKey: 'Task list',
    shortcut: shortcut('Mod', 'Shift', 'T'),
    icon: icon(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
    command: toggleTaskList,
  },
];

const FORMAT_TABLE_BUTTON: ToolButton = {
  key: 'format-table',
  labelKey: 'Format table',
  icon: icon(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <path d="M21 4l-2 2M19 6l2 2" />
    </>,
  ),
  command: formatTable,
};

const MEDIA_BUTTONS: ToolButton[] = [
  {
    key: 'image',
    labelKey: 'Insert image',
    icon: icon(<><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>),
    command: insertImage,
  },
  {
    key: 'divider',
    labelKey: 'Horizontal rule',
    icon: icon(<line x1="3" y1="12" x2="21" y2="12" />),
    command: insertDivider,
  },
];

function Divider() {
  return (
    <div
      className="self-stretch w-px mx-0.5"
      style={{ backgroundColor: 'var(--border-secondary)' }}
    />
  );
}

function HeadingMenu({ getView }: { getView: () => EditorView | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <Tooltip label={t('Headings')}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-1 rounded text-sm font-bold transition-colors hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          H
        </button>
      </Tooltip>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 rounded-lg shadow-lg border py-1 z-50"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-primary)' }}
        >
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                const view = getView();
                if (view) headingCommands(level as 1)(view);
                setOpen(false);
              }}
              className="block w-32 text-left px-3 py-1.5 text-sm transition-colors hover:opacity-80"
              style={{
                color: 'var(--text-secondary)',
                fontSize: `${1.3 - level * 0.08}rem`,
                fontWeight: 700 - level * 50,
              }}
            >
              {t(`Heading ${level}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TableMenu({ getView }: { getView: () => EditorView | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <Tooltip label={t('Table')}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded transition-colors hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      </Tooltip>
      {open && (
        <TablePicker
          onSelect={(rows, cols) => {
            const view = getView();
            if (view) insertTable(rows, cols)(view);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  button,
  getView,
}: {
  button: ToolButton;
  getView: () => EditorView | null;
}) {
  const { t } = useTranslation();
  return (
    <Tooltip label={t(button.labelKey)} shortcut={button.shortcut}>
      <button
        type="button"
        onClick={() => {
          const view = getView();
          if (view) button.command(view);
        }}
        className="p-1.5 rounded transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
      >
        {button.icon}
      </button>
    </Tooltip>
  );
}

export default function EditorToolbar({ getView }: EditorToolbarProps) {
  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1 shrink-0"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-secondary)',
      }}
    >
      {BASIC_BUTTONS.map((b) => (
        <ToolbarButton key={b.key} button={b} getView={getView} />
      ))}
      <Divider />
      <HeadingMenu getView={getView} />
      {STRUCTURE_BUTTONS.map((b) => (
        <ToolbarButton key={b.key} button={b} getView={getView} />
      ))}
      <Divider />
      {CODE_BUTTONS.map((b) => (
        <ToolbarButton key={b.key} button={b} getView={getView} />
      ))}
      <Divider />
      {LIST_BUTTONS.map((b) => (
        <ToolbarButton key={b.key} button={b} getView={getView} />
      ))}
      <Divider />
      {MEDIA_BUTTONS.map((b) => (
        <ToolbarButton key={b.key} button={b} getView={getView} />
      ))}
      <Divider />
      <TableMenu getView={getView} />
      <ToolbarButton button={FORMAT_TABLE_BUTTON} getView={getView} />
    </div>
  );
}
