import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import { marked } from 'marked';
import * as schema from './schema';

let db: ReturnType<typeof drizzle<typeof schema>>;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'fish-notes.db');
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Create tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_trashed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );

    -- FTS5 for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title, content, content=notes, content_rowid=rowid
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
  `);

  // Migration: add is_pinned column to tags if missing (for existing databases)
  const tagColumns = sqlite.pragma('table_info(tags)') as { name: string }[];
  if (!tagColumns.some((c) => c.name === 'is_pinned')) {
    sqlite.exec('ALTER TABLE tags ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0');
  }

  // Migration: add is_pinned column to notes if missing
  const noteColumns = sqlite.pragma('table_info(notes)') as { name: string }[];
  if (!noteColumns.some((c) => c.name === 'is_pinned')) {
    sqlite.exec('ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0');
  }

  // Migration: Markdown → HTML content format
  const noteColsAfter = sqlite.pragma('table_info(notes)') as { name: string }[];
  if (!noteColsAfter.some((c) => c.name === 'content_format')) {
    sqlite.exec("ALTER TABLE notes ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown'");
    sqlite.exec("ALTER TABLE notes ADD COLUMN content_text TEXT NOT NULL DEFAULT ''");

    // Convert existing markdown notes to HTML
    const mdNotes = sqlite.prepare(
      "SELECT id, content FROM notes WHERE content_format = 'markdown' AND content != ''"
    ).all() as { id: string; content: string }[];

    const updateStmt = sqlite.prepare(
      "UPDATE notes SET content = ?, content_text = ?, content_format = 'html' WHERE id = ?"
    );

    for (const note of mdNotes) {
      const htmlContent = convertMarkdownToHtml(note.content);
      const plainText = stripHtmlTags(htmlContent);
      updateStmt.run(htmlContent, plainText, note.id);
    }

    // Mark empty notes as html too
    sqlite.exec("UPDATE notes SET content_format = 'html' WHERE content = ''");

    // Rebuild FTS index with plain text
    sqlite.exec("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");
  }

  // Update FTS triggers to use content_text for search indexing
  sqlite.exec(`
    DROP TRIGGER IF EXISTS notes_ai;
    DROP TRIGGER IF EXISTS notes_ad;
    DROP TRIGGER IF EXISTS notes_au;

    CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content_text);
    END;

    CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content_text);
    END;

    CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content_text);
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content_text);
    END;
  `);

  db = drizzle(sqlite, { schema });
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function convertMarkdownToHtml(markdown: string): string {
  // Protect #tag patterns from being parsed as headings
  // Replace inline #tags (not at start-of-line heading position) with placeholder
  const tagPlaceholders: string[] = [];
  let processed = markdown.replace(
    /(?<=\s|^)#([\p{L}\p{N}_][\p{L}\p{N}_/]*)/gu,
    (match) => {
      const idx = tagPlaceholders.length;
      tagPlaceholders.push(match);
      return `%%HASHTAG_${idx}%%`;
    }
  );

  const html = marked.parse(processed, { async: false }) as string;

  // Restore #tag placeholders as styled spans
  let result = html;
  for (let i = 0; i < tagPlaceholders.length; i++) {
    result = result.replace(
      `%%HASHTAG_${i}%%`,
      `<span class="hashtag">${tagPlaceholders[i]}</span>`
    );
  }

  return result;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
