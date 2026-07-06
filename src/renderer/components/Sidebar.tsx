import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { buildTagTree, type TagTreeNode } from '../utils/tagParser';
import { NotesIcon, TrashIcon, PinIcon, HashIcon, SlidersIcon } from './icons';

interface SidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onSearchClick: () => void;
  onSettingsClick: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  node: TagTreeNode;
}

function Sidebar({ width, onResizeStart, onSearchClick, onSettingsClick }: SidebarProps) {
  const { t } = useTranslation();
  const { state, setViewMode, deleteTag, renameTag, togglePinTag, reorderTags } = useApp();
  const { viewMode, tags, selectedTagId } = state;

  const tagTree = useMemo(() => buildTagTree(tags), [tags]);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // drag-to-reorder (within the same sibling group)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; before: boolean } | null>(null);

  const handleDrop = useCallback(
    (siblings: TagTreeNode[], targetId: string, before: boolean) => {
      const id = dragId;
      setDragId(null);
      setDropHint(null);
      if (!id || id === targetId) return;
      // only reorder within the same level (siblings)
      if (!siblings.some((s) => s.id === id)) return;
      const ids = siblings.map((s) => s.id).filter((x) => x !== id);
      const ti = ids.indexOf(targetId);
      if (ti === -1) return;
      ids.splice(before ? ti : ti + 1, 0, id);
      reorderTags(ids);
    },
    [dragId, reorderTags],
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TagTreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!contextMenu) return;
    const { node } = contextMenu;
    setContextMenu(null);
    await deleteTag(node.id);
  }, [contextMenu, deleteTag]);

  const handleTogglePin = useCallback(async () => {
    if (!contextMenu) return;
    const { node } = contextMenu;
    setContextMenu(null);
    await togglePinTag(node.id);
  }, [contextMenu, togglePinTag]);

  const handleStartRename = useCallback(() => {
    if (!contextMenu) return;
    setEditingTagId(contextMenu.node.id);
    setEditingName(contextMenu.node.name);
    setContextMenu(null);
  }, [contextMenu]);

  const handleRenameSubmit = useCallback(
    async (node: TagTreeNode) => {
      const trimmed = editingName.trim();
      if (trimmed && trimmed !== node.name) {
        // For nested tags, rebuild full name
        const parts = node.fullName.split('/');
        parts[parts.length - 1] = trimmed;
        const newFullName = parts.join('/');
        await renameTag(node.id, newFullName);
      }
      setEditingTagId(null);
      setEditingName('');
    },
    [editingName, renameTag],
  );

  return (
    <div
      className="relative flex flex-col no-select shrink-0 transition-colors"
      style={{
        width,
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-primary)',
      }}
    >
      {/* Search */}
      <div className="px-3 pt-14 pb-2">
        <div
          onClick={onSearchClick}
          className="flex items-center px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--search-bg)',
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {t('Search')}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <SidebarItem
          icon={<NotesIcon size={15} />}
          label={t('All Notes')}
          active={viewMode === 'all'}
          onClick={() => setViewMode('all')}
        />
        <SidebarItem
          icon={<TrashIcon size={15} />}
          label={t('Trash')}
          active={viewMode === 'trash'}
          onClick={() => setViewMode('trash')}
        />

        {/* Tags */}
        <div
          className="mt-4 mb-1 px-2 text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('Tags')}
        </div>
        {tagTree.length === 0 ? (
          <div className="px-2 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
            {t('No tags')}
          </div>
        ) : (
          <TagTreeList
            nodes={tagTree}
            selectedTagId={selectedTagId}
            onSelect={(tagId) => setViewMode('tag', tagId)}
            onContextMenu={handleContextMenu}
            editingTagId={editingTagId}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onRenameSubmit={handleRenameSubmit}
            depth={0}
            dragId={dragId}
            dropHint={dropHint}
            onDragStart={setDragId}
            onDragOverNode={setDropHint}
            onDropNode={handleDrop}
            onDragEnd={() => {
              setDragId(null);
              setDropHint(null);
            }}
          />
        )}
      </nav>

      {/* Settings button */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
        <button
          onClick={onSettingsClick}
          className="w-full flex items-center px-2 py-1.5 rounded-md text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <SlidersIcon size={16} className="mr-2 shrink-0" />
          {t('Settings')}
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 transition-colors"
        onMouseDown={onResizeStart}
      />

      {/* Context menu */}
      {contextMenu && (
        <TagContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isPinned={contextMenu.node.isPinned}
          onPin={handleTogglePin}
          onRename={handleStartRename}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

interface DragProps {
  dragId: string | null;
  dropHint: { id: string; before: boolean } | null;
  onDragStart: (id: string) => void;
  onDragOverNode: (hint: { id: string; before: boolean } | null) => void;
  onDropNode: (siblings: TagTreeNode[], targetId: string, before: boolean) => void;
  onDragEnd: () => void;
}

function TagTreeList({
  nodes,
  selectedTagId,
  onSelect,
  onContextMenu,
  editingTagId,
  editingName,
  onEditingNameChange,
  onRenameSubmit,
  depth,
  dragId,
  dropHint,
  onDragStart,
  onDragOverNode,
  onDropNode,
  onDragEnd,
}: {
  nodes: TagTreeNode[];
  selectedTagId: string | null;
  onSelect: (tagId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TagTreeNode) => void;
  editingTagId: string | null;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onRenameSubmit: (node: TagTreeNode) => void;
  depth: number;
} & DragProps) {
  const sameGroup = dragId != null && nodes.some((n) => n.id === dragId);
  return (
    <>
      {nodes.map((node) => {
        const hinted = sameGroup && dropHint?.id === node.id;
        return (
          <div key={node.id}>
            {editingTagId === node.id ? (
              <RenameInput
                value={editingName}
                onChange={onEditingNameChange}
                onSubmit={() => onRenameSubmit(node)}
                depth={depth}
              />
            ) : (
              <button
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStart(node.id);
                }}
                onDragOver={(e) => {
                  if (!sameGroup || node.id === dragId) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientY < rect.top + rect.height / 2;
                  onDragOverNode({ id: node.id, before });
                }}
                onDrop={(e) => {
                  if (!sameGroup) return;
                  e.preventDefault();
                  onDropNode(nodes, node.id, dropHint?.id === node.id ? dropHint.before : true);
                }}
                onDragEnd={onDragEnd}
                onClick={() => onSelect(node.id)}
                onContextMenu={(e) => onContextMenu(e, node)}
                className={`fn-nav-item w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm ${selectedTagId === node.id ? 'fn-nav-active' : ''}`}
                style={{
                  paddingLeft: `${8 + depth * 16}px`,
                  backgroundColor: selectedTagId === node.id ? 'var(--bg-active)' : 'transparent',
                  color: selectedTagId === node.id ? 'var(--text-active)' : 'var(--text-secondary)',
                  boxShadow: hinted
                    ? `inset 0 ${dropHint?.before ? '2px' : '-2px'} 0 0 var(--text-active)`
                    : undefined,
                  opacity: dragId === node.id ? 0.4 : 1,
                }}
              >
                <span className="flex items-center truncate">
                  {node.isPinned && (
                    <PinIcon
                      size={13}
                      className="mr-1 shrink-0"
                      style={{ color: 'var(--pin-color, var(--accent-solid))' }}
                    />
                  )}
                  <HashIcon
                    size={12}
                    className="mr-1.5 shrink-0"
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                  {node.name}
                </span>
                <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>
                  {node.noteCount}
                </span>
              </button>
            )}
            {node.children.length > 0 && (
              <TagTreeList
                nodes={node.children}
                selectedTagId={selectedTagId}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                editingTagId={editingTagId}
                editingName={editingName}
                onEditingNameChange={onEditingNameChange}
                onRenameSubmit={onRenameSubmit}
                depth={depth + 1}
                dragId={dragId}
                dropHint={dropHint}
                onDragStart={onDragStart}
                onDragOverNode={onDragOverNode}
                onDropNode={onDropNode}
                onDragEnd={onDragEnd}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function RenameInput({
  value,
  onChange,
  onSubmit,
  depth,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  depth: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="flex items-center px-2 py-1" style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <span className="mr-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        #
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onSubmit();
        }}
        onBlur={onSubmit}
        className="flex-1 bg-transparent text-sm outline-none border-b min-w-0"
        style={{ color: 'var(--text-primary)', borderColor: 'var(--text-active)' }}
      />
    </div>
  );
}

function TagContextMenu({
  x,
  y,
  isPinned,
  onPin,
  onRename,
  onDelete,
}: {
  x: number;
  y: number;
  isPinned: boolean;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position if menu overflows viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className="fixed rounded-lg shadow-lg border py-1 z-[100] min-w-[140px]"
      style={{
        left: x,
        top: y,
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <ContextMenuItem label={isPinned ? t('Unpin') : t('Pin')} onClick={onPin} />
      <ContextMenuItem label={t('Rename')} onClick={onRename} />
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
      <ContextMenuItem label={t('Delete Tag')} onClick={onDelete} danger />
    </div>
  );
}

function ContextMenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left px-3 py-1.5 text-sm transition-colors hover:opacity-80"
      style={{ color: danger ? '#ef4444' : 'var(--text-secondary)' }}
    >
      {label}
    </button>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`fn-nav-item w-full flex items-center px-2 py-1.5 rounded-md text-sm ${active ? 'fn-nav-active' : ''}`}
      style={{
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
        boxShadow: active ? 'var(--accent-shadow)' : undefined,
        fontWeight: active ? 600 : undefined,
      }}
    >
      <span className="mr-2 inline-flex shrink-0">{icon}</span>
      {label}
    </button>
  );
}

export default Sidebar;
