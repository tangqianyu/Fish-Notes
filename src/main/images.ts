import { app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const IMAGES_DIR = path.join(app.getPath('userData'), 'images');

export function ensureImagesDir(): void {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

export function getImagesDir(): string {
  return IMAGES_DIR;
}

export function saveImageFromPath(sourcePath: string): string {
  ensureImagesDir();
  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  const uuid = crypto.randomUUID();
  const filename = `${uuid}${ext}`;
  fs.copyFileSync(sourcePath, path.join(IMAGES_DIR, filename));
  return `fish-image://${filename}`;
}

export function saveImageFromBuffer(buffer: Buffer, mimeType: string): string {
  ensureImagesDir();
  const extMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
  };
  const ext = extMap[mimeType] || '.png';
  const uuid = crypto.randomUUID();
  const filename = `${uuid}${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
  return `fish-image://${filename}`;
}

export async function pickImageFile(): Promise<string | null> {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: '选择图片',
    filters: [
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  return saveImageFromPath(filePaths[0]);
}
