/** "2026-09-01" → Date (minuit UTC), pour les colonnes @db.Date. */
export const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Date → "2026-09-01" */
export const fromDate = (d: Date) => d.toISOString().slice(0, 10);
