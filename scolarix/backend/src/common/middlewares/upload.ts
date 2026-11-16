import multer from 'multer';
import { AppError } from '../errors/AppError';

/** Envoi de fichiers en mémoire (petits fichiers uniquement), avec taille maximale. */
export const memoryUpload = (maxBytes: number) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
  });

/** Transforme les erreurs de multer en erreurs lisibles. */
export function uploadErrorMessage(err: unknown): AppError | null {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return AppError.badRequest('Fichier trop volumineux');
    return AppError.badRequest(`Envoi de fichier invalide (${err.code})`);
  }
  return null;
}

/**
 * Vérifie le VRAI type d'une image par ses premiers octets (on ne fait pas
 * confiance au nom du fichier ni au type déclaré par le navigateur).
 */
export function detectImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
