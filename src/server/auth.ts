import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const FALLBACK_SIGNING_KEY = crypto.randomBytes(32).toString('hex');

function getSigningKey(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : FALLBACK_SIGNING_KEY;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export function verifyEnvPasscode(input: string, envPasscode: string): boolean {
  const hashA = crypto.createHash('sha256').update(input).digest();
  const hashB = crypto.createHash('sha256').update(envPasscode).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

interface TokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

export function issueAdminToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    role: 'admin',
    iat: now,
    exp: now + 60 * 60 * 12,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > now;
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Autentikasi admin diperlukan.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Sesi admin tidak valid atau sudah kedaluwarsa.' });
    return;
  }
  next();
}
