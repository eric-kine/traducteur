import { toast } from 'sonner';
import { api } from './api';

/**
 * Ouvre un document de l'API (PDF ou aperçu HTML) dans un nouvel onglet.
 * L'onglet est ouvert immédiatement (sinon le navigateur bloque la fenêtre),
 * puis rempli quand le document est prêt. Renvoie true si tout s'est bien passé.
 */
export async function openDocument(path: string, filename = 'document.pdf'): Promise<boolean> {
  const win = window.open('', '_blank');
  win?.document.write('<p style="font-family:sans-serif;padding:2rem">Génération du document…</p>');
  try {
    const blob = await api<Blob>(path, { raw: true });
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else Object.assign(document.createElement('a'), { href: url, download: filename }).click();
    return true;
  } catch (e) {
    win?.close();
    toast.error(e instanceof Error ? e.message : 'Impossible de générer le document');
    return false;
  }
}
