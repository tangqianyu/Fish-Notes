import { eq, sql } from 'drizzle-orm';
import { getDatabase } from './index';
import { tags, noteTags } from './schema';
import crypto from 'node:crypto';

export interface TagData {
  id: string;
  name: string;
  parentId: string | null;
  noteCount: number;
  isPinned: boolean;
}

export function getOrCreateTag(name: string, parentId: string | null = null): string {
  const db = getDatabase();
  const existing = db.select().from(tags).where(eq(tags.name, name)).get();

  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  db.insert(tags).values({ id, name, parentId }).run();
  return id;
}

export function getAllTags(): TagData[] {
  const db = getDatabase();
  const result = db
    .select({
      id: tags.id,
      name: tags.name,
      parentId: tags.parentId,
      noteCount: sql<number>`(SELECT COUNT(*) FROM note_tags WHERE tag_id = ${tags.id})`,
      isPinned: tags.isPinned,
    })
    .from(tags)
    .all();
  return result as TagData[];
}

export function setNoteTags(noteId: string, tagNames: string[]): void {
  const db = getDatabase();

  // Remove existing tags for the note
  db.delete(noteTags).where(eq(noteTags.noteId, noteId)).run();

  // Add new tags
  for (const name of tagNames) {
    const tagId = getOrCreateTag(name);
    db.insert(noteTags).values({ noteId, tagId }).run();
  }
}

export function getTagsByNoteId(noteId: string): TagData[] {
  const db = getDatabase();
  const result = db
    .select({
      id: tags.id,
      name: tags.name,
      parentId: tags.parentId,
      noteCount: sql<number>`(SELECT COUNT(*) FROM note_tags WHERE tag_id = ${tags.id})`,
      isPinned: tags.isPinned,
    })
    .from(tags)
    .innerJoin(noteTags, eq(noteTags.tagId, tags.id))
    .where(eq(noteTags.noteId, noteId))
    .all();
  return result as TagData[];
}

export function getNotesByTag(tagId: string): string[] {
  const db = getDatabase();
  const result = db
    .select({ noteId: noteTags.noteId })
    .from(noteTags)
    .where(eq(noteTags.tagId, tagId))
    .all();
  return result.map((r) => r.noteId);
}

export function deleteUnusedTags(): void {
  const db = getDatabase();
  db.delete(tags)
    .where(
      sql`${tags.id} NOT IN (SELECT DISTINCT tag_id FROM note_tags)`
    )
    .run();
}

/** Delete a tag and remove it from all note contents. Returns affected note IDs. */
export function deleteTag(tagId: string): string[] {
  const db = getDatabase();
  const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();
  if (!tag) return [];

  // Find all notes using this tag
  const affectedNoteIds = db
    .select({ noteId: noteTags.noteId })
    .from(noteTags)
    .where(eq(noteTags.tagId, tagId))
    .all()
    .map((r) => r.noteId);

  // Remove tag associations and the tag itself
  db.delete(noteTags).where(eq(noteTags.tagId, tagId)).run();
  db.delete(tags).where(eq(tags.id, tagId)).run();

  return affectedNoteIds;
}

/** Rename a tag. Returns the old name for content replacement. */
export function renameTag(tagId: string, newName: string): string | null {
  const db = getDatabase();
  const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();
  if (!tag) return null;

  const oldName = tag.name;
  db.update(tags).set({ name: newName }).where(eq(tags.id, tagId)).run();
  return oldName;
}

/** Toggle pin status of a tag. */
export function togglePinTag(tagId: string): boolean {
  const db = getDatabase();
  const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();
  if (!tag) return false;

  const newPinned = !tag.isPinned;
  db.update(tags).set({ isPinned: newPinned }).where(eq(tags.id, tagId)).run();
  return newPinned;
}
