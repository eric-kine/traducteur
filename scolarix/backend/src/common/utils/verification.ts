import crypto from 'node:crypto';
import { env } from '../../config/env';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I (lecture facile)

/** Code de vérification aléatoire de 10 caractères (≈ 50 bits : impossible à deviner). */
export function newVerificationCode() {
  return Array.from(crypto.randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Lien imprimé dans le QR code : page publique de vérification. */
export const verificationUrl = (code: string) => `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/verifier/${code}`;
