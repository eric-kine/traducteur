import { toast } from 'sonner';
import { api } from './api';

/** Télécharge un fichier de l'API (ZIP…) sous le nom donné. */
export async function downloadFile(path: string, filename: string) {
  try {
    const blob = await api<Blob>(path, { raw: true });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: filename }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Téléchargement impossible');
    return false;
  }
}
