import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const JWT_EXP_SECONDS = 7 * 24 * 60 * 60; // 7 dias

/**
 * Gera uma senha forte aleatória para bootstrap administrativo
 */
export function generateStrongPassword(length = 16) {
  return crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64url').slice(0, length);
}

/**
 * Gera hash seguro com salt aleatório usando scrypt nativo do Node.js
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Senha inválida para hashing.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifica senha usando timingSafeEqual contra hash scrypt armazenado
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, salt, originalHex] = parts;
  try {
    const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    const original = Buffer.from(originalHex, 'hex');
    if (derived.length !== original.length) return false;
    return crypto.timingSafeEqual(derived, original);
  } catch {
    return false;
  }
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Assina um JWT padrão HS256 (RFC 7519)
 */
export function signJwt(payload, secret, expiresInSeconds = JWT_EXP_SECONDS) {
  if (!secret) throw new Error('JWT_SECRET obrigatório para assinar token.');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verifica e decodifica um JWT HS256
 */
export function verifyJwt(token, secret) {
  if (!token || !secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedBody, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;

  try {
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', secret).update(signingInput).digest()
    );

    const bufProvided = Buffer.from(encodedSig, 'utf8');
    const bufExpected = Buffer.from(expectedSig, 'utf8');
    if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedBody));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now >= payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Faz o parse seguro do cabeçalho Cookie HTTP
 */
export function parseCookies(cookieHeader = '') {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}
