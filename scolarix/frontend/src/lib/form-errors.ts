import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from './api';

/** Affiche les erreurs de l'API sous les bons champs, sinon dans une notification. */
export function applyApiErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiError && err.details) {
    for (const [field, messages] of Object.entries(err.details)) {
      setError(field as Path<T>, { message: messages[0] });
    }
    return;
  }
  toast.error(err instanceof Error ? err.message : 'Une erreur est survenue');
}
