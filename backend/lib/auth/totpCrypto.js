import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'v1';

function keyFromEnv() {
  const value = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error('TOTP_ENCRYPTION_KEY must be configured');
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must be a 32-byte base64 or hex key');
  return key;
}

export function encryptTotpSecret(secret) {
  if (!secret) return secret;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keyFromEnv(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${PREFIX}:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptTotpSecret(value) {
  if (!value) return value;
  // Existing plaintext secrets remain readable; callers can rewrite them encrypted.
  if (!value.startsWith(`${PREFIX}:`)) return value;
  try {
    const [, iv, tag, ciphertext] = value.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyFromEnv(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export const isEncryptedTotpSecret = (value) => typeof value === 'string' && value.startsWith(`${PREFIX}:`);
