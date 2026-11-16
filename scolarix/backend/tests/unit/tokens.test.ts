import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/modules/auth/tokens';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password';

describe('jetons', () => {
  it('signe puis vérifie un jeton d’accès', () => {
    const token = signAccessToken({ sub: 'u1', role: 'ADMIN', schoolId: null });
    expect(verifyAccessToken(token)).toMatchObject({ sub: 'u1', role: 'ADMIN' });
  });

  it('rejette un jeton signé avec un autre secret', () => {
    const forged = jwt.sign({ sub: 'u1', role: 'ADMIN' }, 'autre-secret-autre-secret-autre-secret', {
      issuer: 'scolarix',
    });
    expect(verifyAccessToken(forged)).toBeNull();
  });

  it('rejette un jeton expiré', () => {
    const expired = jwt.sign({ sub: 'u1', role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, {
      issuer: 'scolarix',
      expiresIn: -10,
    });
    expect(verifyAccessToken(expired)).toBeNull();
  });

  it('rejette un jeton "alg: none"', () => {
    const none = jwt.sign({ sub: 'u1', role: 'ADMIN', iss: 'scolarix' }, '', { algorithm: 'none' });
    expect(verifyAccessToken(none)).toBeNull();
  });

  it('génère des jetons de rafraîchissement uniques et hachés', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toEqual(b);
    expect(hashRefreshToken(a)).toHaveLength(64);
    expect(hashRefreshToken(a)).not.toContain(a);
  });
});

describe('mots de passe', () => {
  it('hache et vérifie', async () => {
    const hash = await hashPassword('Secret123');
    expect(hash).not.toContain('Secret123');
    expect(await verifyPassword('Secret123', hash)).toBe(true);
    expect(await verifyPassword('Mauvais123', hash)).toBe(false);
  });
});
