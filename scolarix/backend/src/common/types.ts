import type { Role } from '@prisma/client';

/** Utilisateur connecté, attaché à la requête par le middleware `authenticate`. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  schoolId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
