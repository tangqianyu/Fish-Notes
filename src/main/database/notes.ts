import { eq } from 'drizzle-orm';
import { getDatabase, getRawDatabase } from './index';
import { notes } from './schema';
import crypto from 'node:crypto';
import { getCachedKey, encrypt, decrypt } from '../encryption';

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

  db.insert(notes).values({
    id,
    title: '',
    content: '',
    createdAt: now,
    updatedAt: now,
  }).run();

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
  // Strip content from locked notes for the list view
  return rows.map((row) => row.isLocked ? { ...row, content: '' } : row);
}

export function getTrashedNotes(): NoteData[] {
  const db = getDatabase();
  const rows = db.select().from(notes).where(eq(notes.isTrashed, true)).all() as NoteData[];
  return rows.map((row) => row.isLocked ? { ...row, content: '' } : row);
}

export function getNote(id: string): NoteData | undefined {
  const db = getDatabase();
  const note = db.select().from(notes).where(eq(notes.id, id)).get() as NoteData | undefined;
  if (!note) return undefined;
  if (note.isLocked) {
    // Strip content — caller must use getDecryptedNote to get content
    return { ...note, content: '' };
  }
  return note;
}

/** Get decrypted content for a locked note. Requires cached key. */
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

export function updateNote(id: string, data: { title?: string; content?: string; contentText?: string }): void {
  const db = getDatabase();

  // Check if the note is locked — if so, encrypt the content before saving
  const note = db.select({ isLocked: notes.isLocked }).from(notes).where(eq(notes.id, id)).get();
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  if (note?.isLocked && data.content !== undefined) {
    const key = getCachedKey();
    if (key) {
      updateData.content = encrypt(data.content, key);
      // Clear content_text so encrypted notes aren't in FTS
      updateData.contentText = '';
    }
  }

  db.update(notes)
    .set(updateData)
    .where(eq(notes.id, id))
    .run();
}

/** Lock a note: encrypt its content and set is_locked = true */
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

/** Unlock a note: decrypt its content and set is_locked = false */
export function unlockNote(id: string): boolean {
  const key = getCachedKey();
  if (!key) return false;

  const db = getDatabase();
  const note = db.select().from(notes).where(eq(notes.id, id)).get() as NoteData | undefined;
  if (!note || !note.isLocked) return false;

  let decryptedContent = '';
  try {
    decryptedContent = note.content ? decrypt(note.content, key) : '';
  } catch {
    return false;
  }

  // Restore content_text for FTS indexing
  const contentText = stripHtmlForFts(decryptedContent);

  db.update(notes)
    .set({
      content: decryptedContent,
      contentText,
      isLocked: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(notes.id, id))
    .run();

  return true;
}

/** Re-encrypt all locked notes with a new key (used during password change) */
export function reEncryptAllNotes(oldKey: Buffer, newKey: Buffer): void {
  const rawDb = getRawDatabase();
  const rows = rawDb.prepare('SELECT id, content FROM notes WHERE is_locked = 1').all() as { id: string; content: string }[];

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

/** Decrypt all locked notes and remove locks (used when removing password) */
export function decryptAllNotes(key: Buffer): void {
  const rawDb = getRawDatabase();
  const rows = rawDb.prepare('SELECT id, content FROM notes WHERE is_locked = 1').all() as { id: string; content: string }[];

  const stmt = rawDb.prepare('UPDATE notes SET content = ?, content_text = ?, is_locked = 0 WHERE id = ?');
  const transaction = rawDb.transaction(() => {
    for (const row of rows) {
      let plaintext = '';
      if (row.content) {
        plaintext = decrypt(row.content, key);
      }
      const contentText = stripHtmlForFts(plaintext);
      stmt.run(plaintext, contentText, row.id);
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

function stripHtmlForFts(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
