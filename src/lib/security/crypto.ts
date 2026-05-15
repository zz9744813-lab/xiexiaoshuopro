/**
 * API key encryption per spec 8.2.8 / 33.2.
 * Uses AES-256-GCM with a master key from ENCRYPTION_KEY env.
 *
 * The api_key is never returned to frontend; only secret_id is referenced.
 * For MVP single-user we keep secrets in a simple table (extension); for now
 * we store ciphertext directly inside api_providers.metadata.encrypted_api_key.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || k.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY env is required (>= 16 chars). Refusing to encrypt with weak key.',
    );
  }
  // Derive a 32-byte key
  return scryptSync(k, 'xxsp-salt-v1', 32);
}

export interface EncryptedBlob {
  v: 1;
  iv: string; // base64
  tag: string; // base64
  data: string; // base64
}

export function encryptSecret(plain: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const buf = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: buf.toString('base64'),
  };
}

export function decryptSecret(blob: EncryptedBlob): string {
  if (blob.v !== 1) throw new Error('Unsupported encrypted blob version');
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const data = Buffer.from(blob.data, 'base64');
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
