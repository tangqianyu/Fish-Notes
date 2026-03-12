import { getDatabase } from './index';
import { sql } from 'drizzle-orm';
import { notes } from './schema';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isTrashed: boolean;
}

/**
 * Escape a raw user query into a safe FTS5 query string.
 * Each whitespace-separated token is wrapped in double quotes (FTS5 quoted term),
 * with any internal double quotes doubled. A `*` prefix operator is appended for
 * prefix matching. This prevents FTS5 syntax errors from special characters such
 * as single quotes, parentheses, or operators in user input.
 */
function buildFts5Query(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(token => '"' + token.replace(/"/g, '""') + '"*')
    .join(' ');
}

export function searchNotes(query: string): SearchResult[] {
  if (!query.trim()) return [];

  const ftsQuery = buildFts5Query(query);
  const db = getDatabase();
  const results = db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      isTrashed: notes.isTrashed,
    })
    .from(notes)
    .where(
      sql`rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ${ftsQuery}) AND ${notes.isTrashed} = 0`
    )
    .all();

  return results as SearchResult[];
}
