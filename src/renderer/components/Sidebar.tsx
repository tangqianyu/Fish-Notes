import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { buildTagTree, type TagTreeNode } from '../utils/tagParser';

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
  const { state, setViewMode, deleteTag, renameTag, togglePinTag } = useApp();
  const { viewMode, tags, selectedTagId } = state;

  const tagTree = useMemo(() => buildTagTree(tags), [tags]);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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
    await deleteTag(node.id, node.fullName);
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
        await renameTag(node.id, node.fullName, newFullName);
      }
      setEditingTagId(null);
      setEditingName('');
    },
    [editingName, renameTag],
  );

  return (
    <div
      className="relative flex flex-col no-select shrink-0 transition-colors"
      style={{ width, backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-primary)' }}
    >
      {/* Search */}
      <div className="px-3 pt-14 pb-2">
        <div
          onClick={onSearchClick}
          className="flex items-center px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--search-bg)', color: 'var(--text-tertiary)' }}
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          搜索
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <SidebarItem icon="📝" label="所有笔记" active={viewMode === 'all'} onClick={() => setViewMode('all')} />
        <SidebarItem icon="🗑️" label="回收站" active={viewMode === 'trash'} onClick={() => setViewMode('trash')} />

        {/* Tags */}
        <div className="mt-4 mb-1 px-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          标签
        </div>
        {tagTree.length === 0 ? (
          <div className="px-2 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>暂无标签</div>
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
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          设置
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

function TagTreeList({ nodes, selectedTagId, onSelect, onContextMenu, editingTagId, editingName, onEditingNameChange, onRenameSubmit, depth }: {
  nodes: TagTreeNode[];
  selectedTagId: string | null;
  onSelect: (tagId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TagTreeNode) => void;
  editingTagId: string | null;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onRenameSubmit: (node: TagTreeNode) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => (
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
              onClick={() => onSelect(node.id)}
              onContextMenu={(e) => onContextMenu(e, node)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors"
              style={{
                paddingLeft: `${8 + depth * 16}px`,
                backgroundColor: selectedTagId === node.id ? 'var(--bg-active)' : 'transparent',
                color: selectedTagId === node.id ? 'var(--text-active)' : 'var(--text-secondary)',
              }}
            >
              <span className="flex items-center truncate">
                {node.isPinned && <span className="mr-1 text-xs opacity-60">📌</span>}
                <span className="mr-1.5" style={{ color: 'var(--text-tertiary)' }}>#</span>
                {node.name}
              </span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>{node.noteCount}</span>
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
            />
          )}
        </div>
      ))}
    </>
  );
}

function RenameInput({ value, onChange, onSubmit, depth }: {
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
      <span className="mr-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>#</span>
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

function TagContextMenu({ x, y, isPinned, onPin, onRename, onDelete }: {
  x: number;
  y: number;
  isPinned: boolean;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
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
      <ContextMenuItem label={isPinned ? '取消置顶' : '置顶'} onClick={onPin} />
      <ContextMenuItem label="重命名" onClick={onRename} />
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-secondary)' }} />
      <ContextMenuItem label="删除标签" onClick={onDelete} danger />
    </div>
  );
}

function ContextMenuItem({ label, onClick, danger = false }: {
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

function SidebarItem({ icon, label, active = false, onClick }: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-2 py-1.5 rounded-md text-sm transition-colors"
      style={{
        backgroundColor: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--text-active)' : 'var(--text-secondary)',
      }}
    >
      <span className="mr-2 text-base">{icon}</span>
      {label}
    </button>
  );
}

export default Sidebar;
