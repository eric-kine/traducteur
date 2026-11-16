/** Échappe le texte inséré dans le HTML (aucune donnée n'est interprétée comme du code). */
export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const frDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Logo Scolarix (vectoriel, intégré : aucune image externe). */
export const SCOLARIX_LOGO = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1e4fa3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Scolarix"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>`;

export const BASE_CSS = `
  @page { size: A4; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; color: #1f2937; font-size: 9.5pt; margin: 0; }
  .header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e4fa3; padding-bottom: 8px; }
  .brand { display: flex; flex-direction: column; align-items: center; width: 70px; font-weight: 700; color: #1e4fa3; font-size: 8pt; }
  .inst { flex: 1; text-align: center; }
  .inst h1 { margin: 0; font-size: 13pt; text-transform: uppercase; letter-spacing: .5px; }
  .inst .school { font-size: 10.5pt; font-weight: 600; margin-top: 2px; }
  .inst .contact { font-size: 7.5pt; color: #6b7280; margin-top: 2px; }
  .ref { width: 120px; text-align: right; font-size: 7.5pt; color: #4b5563; }
  .ref strong { display: block; font-family: "DejaVu Sans Mono", monospace; color: #111827; font-size: 8pt; }
  .title { text-align: center; margin: 12px 0 8px; }
  .title h2 { margin: 0; font-size: 15pt; letter-spacing: 2px; color: #1e4fa3; }
  .title p { margin: 2px 0 0; font-size: 10pt; }
  .watermark { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 80pt; font-weight: 700; color: rgba(220, 38, 38, .08); transform: rotate(-28deg); z-index: -1; }
  table { width: 100%; border-collapse: collapse; }
  .footer-note { margin-top: 8px; font-size: 7pt; color: #6b7280; }
`;
