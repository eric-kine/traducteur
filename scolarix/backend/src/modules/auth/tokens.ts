import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../../config/env';

export interface AccessTokenPayload {
  sub: string; // id utilisateur
  role: Role;
  schoolId: string | null;
}

const ISSUER = 'scolarix';

/** Jeton d'accès JWT, courte durée (15 min), envoyé dans l'en-tête Authorization. */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    issuer: ISSUER,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
    return decoded as AccessTokenPayload;
  } catch {
    return null;
  }
}

/** Jeton de rafraîchissement : valeur aléatoire opaque (pas un JWT). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** Seul ce hash est enregistré en base. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const REFRESH_COOKIE = 'scolarix_rt';
