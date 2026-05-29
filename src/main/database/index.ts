import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import * as schema from './schema';
import {
  htmlToMarkdown,
  markdownToHtml,
  stripHtmlForFts,
  stripMarkdownForFts,
} from '../markdown';

let db: ReturnType<typeof drizzle<typeof schema>>;
let rawDb: Database.Database;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'fish-notes.db');
  const sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

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

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title, content, content=notes, content_rowid=rowid
    );

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

  const tagColumns = sqlite.pragma('table_info(tags)') as { name: string }[];
  if (!tagColumns.some((c) => c.name === 'is_pinned')) {
    sqlite.exec('ALTER TABLE tags ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0');
  }

  const noteColumns = sqlite.pragma('table_info(notes)') as { name: string }[];
  if (!noteColumns.some((c) => c.name === 'is_pinned')) {
    sqlite.exec('ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0');
  }

  // Historical migration: Markdown → HTML (older DBs). Kept for upgrade chains.
  const noteColsAfter = sqlite.pragma('table_info(notes)') as { name: string }[];
  if (!noteColsAfter.some((c) => c.name === 'content_format')) {
    sqlite.exec("ALTER TABLE notes ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown'");
    sqlite.exec("ALTER TABLE notes ADD COLUMN content_text TEXT NOT NULL DEFAULT ''");

    const mdNotes = sqlite
      .prepare(
        "SELECT id, content FROM notes WHERE content_format = 'markdown' AND content != ''",
      )
      .all() as { id: string; content: string }[];

    const updateStmt = sqlite.prepare(
      "UPDATE notes SET content = ?, content_text = ?, content_format = 'html' WHERE id = ?",
    );

    for (const note of mdNotes) {
      const htmlContent = markdownToHtml(note.content);
      const plainText = stripHtmlForFts(htmlContent);
      updateStmt.run(htmlContent, plainText, note.id);
    }

    sqlite.exec("UPDATE notes SET content_format = 'html' WHERE content = ''");
    sqlite.exec("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");
  }

  const noteColsFinal = sqlite.pragma('table_info(notes)') as { name: string }[];
  if (!noteColsFinal.some((c) => c.name === 'is_locked')) {
    sqlite.exec('ALTER TABLE notes ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0');
  }

  // Migration: HTML → Markdown. Markdown is now the source of truth (better for AI,
  // cleaner exports). Original HTML is preserved in content_html_legacy as a safety net.
  // Locked notes are skipped here — they'll convert lazily on unlock (see notes.ts).
  const noteColsForMd = sqlite.pragma('table_info(notes)') as { name: string }[];
  if (!noteColsForMd.some((c) => c.name === 'content_html_legacy')) {
    sqlite.exec("ALTER TABLE notes ADD COLUMN content_html_legacy TEXT NOT NULL DEFAULT ''");

    const htmlNotes = sqlite
      .prepare(
        "SELECT id, content FROM notes WHERE content_format = 'html' AND content != '' AND is_locked = 0",
      )
      .all() as { id: string; content: string }[];

    const updateMdStmt = sqlite.prepare(
      "UPDATE notes SET content = ?, content_text = ?, content_html_legacy = ?, content_format = 'markdown' WHERE id = ?",
    );

    for (const note of htmlNotes) {
      const md = htmlToMarkdown(note.content);
      const plain = stripMarkdownForFts(md);
      updateMdStmt.run(md, plain, note.content, note.id);
    }

    sqlite.exec("UPDATE notes SET content_format = 'markdown' WHERE content = '' AND is_locked = 0");
    sqlite.exec("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");
  }

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

  rawDb = sqlite;
  db = drizzle(sqlite, { schema });
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function getRawDatabase(): Database.Database {
  if (!rawDb) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return rawDb;
}
