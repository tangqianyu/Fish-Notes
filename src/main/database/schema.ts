import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  contentText: text('content_text').notNull().default(''),
  contentFormat: text('content_format').notNull().default('markdown'),
  contentHtmlLegacy: text('content_html_legacy').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  parentId: text('parent_id'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const noteTags = sqliteTable('note_tags', {
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// AI assistant conversations
export const aiChats = sqliteTable('ai_chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const aiMessages = sqliteTable('ai_messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id')
    .notNull()
    .references(() => aiChats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull().default(''),
  // optional: which note this turn was grounded on (current-note Q&A)
  noteId: text('note_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
