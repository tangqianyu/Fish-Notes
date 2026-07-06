import crypto from 'node:crypto';
import { promisify } from 'node:util';

// Async scrypt keeps the main process responsive: the sync variant blocks the event
// loop for ~50-100ms per call (and password ops do several), freezing the whole UI.
const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

// scrypt parameters
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 32;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

// Session-level cached encryption key
let cachedKey: Buffer | null = null;

export function setCachedKey(key: Buffer): void {
  cachedKey = key;
}

export function clearCachedKey(): void {
  cachedKey = null;
}

export function getCachedKey(): Buffer | null {
  return cachedKey;
}

export function isKeyReady(): boolean {
  return cachedKey !== null;
}

/** Hash a password with a random salt using scrypt */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return {
    hash: derived.toString('base64'),
    salt: salt.toString('base64'),
  };
}

/** Verify a password against a stored hash and salt */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const saltBuf = Buffer.from(salt, 'base64');
  const derived = await scryptAsync(password, saltBuf, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  const expected = Buffer.from(hash, 'base64');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/** Derive a 32-byte AES encryption key from a password and salt */
export async function deriveEncryptionKey(password: string, keySalt: string): Promise<Buffer> {
  const saltBuf = Buffer.from(keySalt, 'base64');
  return scryptAsync(password, saltBuf, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

/** Encrypt plaintext with AES-256-GCM, returns base64(iv + authTag + ciphertext) */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/** Decrypt base64(iv + authTag + ciphertext) with AES-256-GCM */
export function decrypt(encryptedBase64: string, key: Buffer): string {
  const combined = Buffer.from(encryptedBase64, 'base64');
  const iv = combined.subarray(0, IV_LEN);
  const authTag = combined.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = combined.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
