import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

interface SearchBarProps {
  onClose: () => void;
}

function SearchBar({ onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteData[]>([]);
  const { selectNote, setViewMode } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const res = await window.api.search.notes(value);
      setResults(res);
    }, 200);
  }, []);

  const handleSelect = useCallback(
    (noteId: string) => {
      setViewMode('all');
      selectNote(noteId);
      onClose();
    },
    [selectNote, setViewMode, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15%] bg-black/30" onClick={onClose}>
      <div
        className="w-[560px] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索笔记..."
            className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {results.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelect(note.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900 truncate">
                  {note.title || '无标题'}
                </div>
                <div className="text-xs text-gray-400 mt-1 truncate">
                  {note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim().slice(0, 100)}
                </div>
              </button>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            未找到匹配的笔记
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchBar;
