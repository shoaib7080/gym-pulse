import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto';

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (options) {
      scrypt(password, salt, keylen, options, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    } else {
      scrypt(password, salt, keylen, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    }
  });
}

export const SCRYPT_CONFIG = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32,
};

/**
 * Hash a PIN using Node crypto.scrypt with a random 16-byte salt.
 * Result format: scrypt$<N>$<r>$<p>$<saltHex>$<derivedKeyHex>
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(pin, salt, SCRYPT_CONFIG.keyLen, {
    N: SCRYPT_CONFIG.N,
    r: SCRYPT_CONFIG.r,
    p: SCRYPT_CONFIG.p,
  })) as Buffer;

  return `scrypt$${SCRYPT_CONFIG.N}$${SCRYPT_CONFIG.r}$${SCRYPT_CONFIG.p}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verify a PIN against a stored scrypt hash using crypto.timingSafeEqual.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const expectedKeyHex = parts[5];

    if (!salt || !expectedKeyHex) {
      return false;
    }

    const expectedBuffer = Buffer.from(expectedKeyHex, 'hex');
    const derivedBuffer = (await scryptAsync(pin, salt, expectedBuffer.length, {
      N,
      r,
      p,
    })) as Buffer;

    return timingSafeEqual(derivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
