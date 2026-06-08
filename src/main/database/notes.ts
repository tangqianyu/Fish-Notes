import { eq } from 'drizzle-orm';
import { getDatabase, getRawDatabase } from './index';
import { notes } from './schema';
import crypto from 'node:crypto';
import { getCachedKey, encrypt, decrypt } from '../encryption';
import { htmlToMarkdown, looksLikeHtml, stripMarkdownForFts } from '../markdown';

export interface NoteData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isTrashed: boolean;
  isPinned: boolean;
  isLocked: boolean;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function createNote(): NoteData {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  db.insert(notes)
    .values({
      id,
      title: '',
      content: '',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return {
    id,
    title: '',
    content: '',
    createdAt: now,
    updatedAt: now,
    isTrashed: false,
    isPinned: false,
    isLocked: false,
  };
}

export function getAllNotes(): NoteData[] {
  const db = getDatabase();
  const rows = db.select().from(notes).where(eq(notes.isTrashed, false)).all() as NoteData[];
  return rows.map((row) => (row.isLocked ? { ...row, content: '' } : row));
}

export function getTrashedNotes(): NoteData[] {
  const db = getDatabase();
  const rows = db.select().from(notes).where(eq(notes.isTrashed, true)).all() as NoteData[];
  return rows.map((row) => (row.isLocked ? { ...row, content: '' } : row));
}

export function getNote(id: string): NoteData | undefined {
  const db = getDatabase();
  const note = db.select().from(notes).where(eq(notes.id, id)).get() as NoteData | undefined;
  if (!note) return undefined;
  if (note.isLocked) {
    return { ...note, content: '' };
  }
  return note;
}

export function getDecryptedNote(id: string): NoteData | undefined {
  const db = getDatabase();
  const note = db.select().from(notes).where(eq(notes.id, id)).get() as NoteData | undefined;
  if (!note) return undefined;
  if (!note.isLocked) return note;

  const key = getCachedKey();
  if (!key) return { ...note, content: '' };

  try {
    return { ...note, content: decrypt(note.content, key) };
  } catch {
    return { ...note, content: '' };
  }
}

export function updateNote(
  id: string,
  data: { title?: string; content?: string; contentText?: string },
): void {
  const db = getDatabase();

  const note = db.select({ isLocked: notes.isLocked }).from(notes).where(eq(notes.id, id)).get();
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  if (note?.isLocked && data.content !== undefined) {
    const key = getCachedKey();
    if (key) {
      updateData.content = encrypt(data.content, key);
      updateData.contentText = '';
    }
  }

  db.update(notes).set(updateData).where(eq(notes.id, id)).run();
}

export function lockNote(id: string): boolean {
  const key = getCachedKey();
  if (!key) return false;

  const db = getDatabase();
  const note = db.select().from(notes).where(eq(notes.id, id)).get() as NoteData | undefined;
  if (!note || note.isLocked) return false;

  const encryptedContent = note.content ? encrypt(note.content, key) : '';

  db.update(notes)
    .set({
      content: encryptedContent,
      contentText: '',
      isLocked: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(notes.id, id))
    .run();

  return true;
}

export function unlockNote(id: string): boolean {
  const key = getCachedKey();
  if (!key) return false;

  const rawDb = getRawDatabase();
  const row = rawDb
    .prepare('SELECT content, content_format, content_html_legacy FROM notes WHERE id = ?')
    .get(id) as
    | { content: string; content_format: string; content_html_legacy: string }
    | undefined;
  if (!row) return false;

  let decryptedContent = '';
  try {
    decryptedContent = row.content ? decrypt(row.content, key) : '';
  } catch {
    return false;
  }

  // Lazy HTML → Markdown migration for locked notes that pre-date the editor switch.
  // The migration in database/index.ts skipped them because we can't decrypt without the key.
  let nextFormat = row.content_format || 'markdown';
  let legacy = row.content_html_legacy;
  if (decryptedContent && (nextFormat === 'html' || looksLikeHtml(decryptedContent))) {
    legacy = decryptedContent;
    decryptedContent = htmlToMarkdown(decryptedContent);
    nextFormat = 'markdown';
  }

  rawDb
    .prepare(
      'UPDATE notes SET content = ?, content_text = ?, content_format = ?, content_html_legacy = ?, is_locked = 0, updated_at = ? WHERE id = ?',
    )
    .run(
      decryptedContent,
      stripMarkdownForFts(decryptedContent),
      nextFormat,
      legacy,
      new Date().toISOString(),
      id,
    );

  return true;
}

export function reEncryptAllNotes(oldKey: Buffer, newKey: Buffer): void {
  const rawDb = getRawDatabase();
  const rows = rawDb.prepare('SELECT id, content FROM notes WHERE is_locked = 1').all() as {
    id: string;
    content: string;
  }[];

  const stmt = rawDb.prepare('UPDATE notes SET content = ? WHERE id = ?');
  const transaction = rawDb.transaction(() => {
    for (const row of rows) {
      if (!row.content) continue;
      const plaintext = decrypt(row.content, oldKey);
      const newCiphertext = encrypt(plaintext, newKey);
      stmt.run(newCiphertext, row.id);
    }
  });
  transaction();
}

export function decryptAllNotes(key: Buffer): void {
  const rawDb = getRawDatabase();
  const rows = rawDb
    .prepare(
      'SELECT id, content, content_format, content_html_legacy FROM notes WHERE is_locked = 1',
    )
    .all() as {
    id: string;
    content: string;
    content_format: string;
    content_html_legacy: string;
  }[];

  const stmt = rawDb.prepare(
    'UPDATE notes SET content = ?, content_text = ?, content_format = ?, content_html_legacy = ?, is_locked = 0 WHERE id = ?',
  );
  const transaction = rawDb.transaction(() => {
    for (const row of rows) {
      let plaintext = '';
      if (row.content) plaintext = decrypt(row.content, key);

      let format = row.content_format || 'markdown';
      let legacy = row.content_html_legacy;
      if (plaintext && (format === 'html' || looksLikeHtml(plaintext))) {
        legacy = plaintext;
        plaintext = htmlToMarkdown(plaintext);
        format = 'markdown';
      }

      stmt.run(plaintext, stripMarkdownForFts(plaintext), format, legacy, row.id);
    }
  });
  transaction();
}

export function trashNote(id: string): void {
  const db = getDatabase();
  db.update(notes)
    .set({ isTrashed: true, updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id))
    .run();
}

export function restoreNote(id: string): void {
  const db = getDatabase();
  db.update(notes)
    .set({ isTrashed: false, updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id))
    .run();
}

export function deleteNotePermanently(id: string): void {
  const db = getDatabase();
  db.delete(notes).where(eq(notes.id, id)).run();
}

export function togglePinNote(id: string): boolean {
  const db = getDatabase();
  const note = db.select({ isPinned: notes.isPinned }).from(notes).where(eq(notes.id, id)).get();
  const newPinned = !note?.isPinned;
  db.update(notes).set({ isPinned: newPinned }).where(eq(notes.id, id)).run();
  return newPinned;
}
