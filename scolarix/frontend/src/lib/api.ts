import type { ApiErrorBody, AuthResponse } from '@scolarix/shared';

/** Erreur renvoyée par l'API, avec le détail champ par champ si disponible. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

// Le jeton d'accès reste en mémoire (jamais dans localStorage) : un script
// malveillant injecté ne peut pas le voler durablement. La session longue
// repose sur le cookie httpOnly géré par le navigateur.
let accessToken: string | null = null;
let onSessionLost: () => void = () => {};

export const tokenStore = {
  set: (t: string | null) => (accessToken = t),
  get: () => accessToken,
  onSessionLost: (fn: () => void) => (onSessionLost = fn),
};

async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiError(
    res.status,
    body?.error.code ?? 'UNKNOWN',
    body?.error.message ?? `Erreur ${res.status}`,
    body?.error.details,
  );
}

// Une seule demande de rafraîchissement à la fois, même si 5 requêtes échouent ensemble.
let refreshing: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => (refreshing = null));
  return refreshing;
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown; raw?: boolean };

/**
 * Appel à l'API. Si le jeton d'accès a expiré (401), on rafraîchit la
 * session une fois puis on rejoue la requête.
 */
export async function api<T>(path: string, { body, headers, raw, ...init }: Options = {}, retry = true): Promise<T> {
  // FormData (envoi de fichier) : le navigateur fixe lui-même l'en-tête multipart
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
    const session = await refreshSession();
    if (session) return api<T>(path, { body, headers, raw, ...init }, false);
    accessToken = null;
    onSessionLost();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  if (raw) return (await res.blob()) as T;
  return res.json() as Promise<T>;
}
