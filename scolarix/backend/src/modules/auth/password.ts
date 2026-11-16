import bcrypt from 'bcryptjs';

const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Hash factice comparé quand l'email n'existe pas : la réponse prend le même
 * temps qu'avec un vrai compte, ce qui empêche de deviner quels emails existent.
 */
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', ROUNDS);
