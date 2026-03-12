import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';

interface TagBarProps {
  noteId: string;
}

function TagBar({ noteId }: TagBarProps) {
  const { state, addNoteTag, removeNoteTag } = useApp();
  const [noteTags, setNoteTags] = useState<TagData[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load tags for this note
  useEffect(() => {
    window.api.tags.getByNoteId(noteId).then(setNoteTags);
  }, [noteId, state.tags]);

  // Close popup on outside click
  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
        setInputValue('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopup]);

  // Focus input when popup opens
  useEffect(() => {
    if (showPopup) {
      inputRef.current?.focus();
    }
  }, [showPopup]);

  const handleAdd = useCallback(
    async (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed) return;
      await addNoteTag(noteId, trimmed);
      setInputValue('');
      setShowPopup(false);
    },
    [noteId, addNoteTag],
  );

  const handleRemove = useCallback(
    async (tagName: string) => {
      await removeNoteTag(noteId, tagName);
    },
    [noteId, removeNoteTag],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd(inputValue);
      } else if (e.key === 'Escape') {
        setShowPopup(false);
        setInputValue('');
      }
    },
    [inputValue, handleAdd],
  );

  // Filter existing tags for suggestions (exclude already-added ones)
  const noteTagNames = noteTags.map((t) => t.name);
  const suggestions = state.tags
    .filter((t) => !noteTagNames.includes(t.name))
    .filter((t) => !inputValue || t.name.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 min-h-[32px] flex-wrap" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
      {/* Existing tags */}
      {noteTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: 'var(--tag-bg, rgba(59,130,246,0.1))', color: 'var(--tag-text, #3b82f6)' }}
        >
          #{tag.name}
          <button
            onClick={() => handleRemove(tag.name)}
            className="ml-0.5 hover:opacity-70 leading-none"
            style={{ color: 'var(--tag-text, #3b82f6)' }}
          >
            &times;
          </button>
        </span>
      ))}

      {/* Add tag button + popup */}
      <div className="relative" ref={popupRef}>
        <button
          onClick={() => setShowPopup(!showPopup)}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs transition-colors hover:opacity-70"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {showPopup && (
          <div
            className="absolute left-0 top-full mt-1 w-52 rounded-lg shadow-lg border z-50"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-primary)' }}
          >
            <div className="p-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入标签名..."
                className="w-full px-2 py-1 text-sm rounded border outline-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="max-h-40 overflow-y-auto border-t" style={{ borderColor: 'var(--border-secondary)' }}>
                {suggestions.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAdd(tag.name)}
                    className="w-full text-left px-3 py-1.5 text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    #{tag.name}
                    <span className="ml-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      ({tag.noteCount})
                    </span>
                  </button>
                ))}
              </div>
            )}
            {inputValue && !suggestions.some((t) => t.name === inputValue.trim()) && (
              <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }}>
                <button
                  onClick={() => handleAdd(inputValue)}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  创建 <strong>#{inputValue.trim()}</strong>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TagBar;
