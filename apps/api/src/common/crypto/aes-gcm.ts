import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

export interface EncryptedPayload {
  algorithm: 'aes-256-gcm';
  ciphertext: string; // base64
  iv: string;         // base64
  tag: string;        // base64
}

/**
 * Derives a deterministic 32-byte (256-bit) encryption key from the environment
 * or provided secret key.
 */
export function deriveEncryptionKey(customSecret?: string): Buffer {
  const secret =
    customSecret ||
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY ||
    process.env.APP_SECRET ||
    process.env.DATABASE_URL ||
    'gympulse-master-interim-payment-key-32b-fallback';

  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive string data with AES-256-GCM.
 * Uses NIST-recommended 96-bit (12-byte) IV and produces a 128-bit authentication tag.
 */
export function encryptAes256Gcm(plaintext: string, customSecret?: string): EncryptedPayload {
  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string for AES-256-GCM encryption');
  }

  const key = deriveEncryptionKey(customSecret);
  const iv = randomBytes(12); // 96-bit IV
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    algorithm: 'aes-256-gcm',
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload, verifying authenticity tag.
 */
export function decryptAes256Gcm(payload: EncryptedPayload, customSecret?: string): string {
  if (!payload || payload.algorithm !== 'aes-256-gcm' || !payload.ciphertext || !payload.iv || !payload.tag) {
    throw new Error('Invalid EncryptedPayload format for AES-256-GCM');
  }

  const key = deriveEncryptionKey(customSecret);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(payload.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
