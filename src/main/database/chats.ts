import { eq, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getDatabase } from './index';
import { aiChats, aiMessages } from './schema';

export interface ChatData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageData {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  noteId: string | null;
  createdAt: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function createChat(title = ''): ChatData {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  db.insert(aiChats).values({ id, title, createdAt: now, updatedAt: now }).run();
  return { id, title, createdAt: now, updatedAt: now };
}

export function listChats(): ChatData[] {
  const db = getDatabase();
  return db.select().from(aiChats).orderBy(desc(aiChats.updatedAt)).all() as ChatData[];
}

export function getChatMessages(chatId: string): ChatMessageData[] {
  const db = getDatabase();
  return db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.chatId, chatId))
    .orderBy(aiMessages.createdAt)
    .all() as ChatMessageData[];
}

export function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  noteId?: string | null,
): ChatMessageData {
  const db = getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  db.insert(aiMessages)
    .values({ id, chatId, role, content, noteId: noteId ?? null, createdAt: now })
    .run();
  // bump the chat's updatedAt so it sorts to the top
  db.update(aiChats).set({ updatedAt: now }).where(eq(aiChats.id, chatId)).run();
  return { id, chatId, role, content, noteId: noteId ?? null, createdAt: now };
}

export function renameChat(chatId: string, title: string): void {
  const db = getDatabase();
  db.update(aiChats).set({ title }).where(eq(aiChats.id, chatId)).run();
}

export function deleteChat(chatId: string): void {
  const db = getDatabase();
  db.delete(aiChats).where(eq(aiChats.id, chatId)).run();
}
