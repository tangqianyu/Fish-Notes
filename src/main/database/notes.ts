import { eq } from 'drizzle-orm';
import { getDatabase } from './index';
import { notes } from './schema';
import crypto from 'node:crypto';

export interface NoteData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isTrashed: boolean;
  isPinned: boolean;
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
  };
}

export function getAllNotes(): NoteData[] {
  const db = getDatabase();
  return db.select().from(notes).where(eq(notes.isTrashed, false)).all() as NoteData[];
}

export function getTrashedNotes(): NoteData[] {
  const db = getDatabase();
  return db.select().from(notes).where(eq(notes.isTrashed, true)).all() as NoteData[];
}

export function getNote(id: string): NoteData | undefined {
  const db = getDatabase();
  return db.select().from(notes).where(eq(notes.id, id)).get() as NoteData | undefined;
}

export function updateNote(id: string, data: { title?: string; content?: string; contentText?: string }): void {
  const db = getDatabase();
  db.update(notes)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(notes.id, id))
    .run();
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
