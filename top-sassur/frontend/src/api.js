// Petit client d'API sans dépendance. Toutes les routes passent par /api.

async function req(chemin, options = {}) {
  const res = await fetch(`/api${chemin}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || Object.values(j).flat().join(" ") || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  zones: () => req("/zones/"),
  etablissements: () => req("/etablissements/"),
  disponibilites: (etabId, date) => req(`/etablissements/${etabId}/disponibilites/?date=${date}`),
  creerRendezVous: (data) => req("/rendez-vous/", { method: "POST", body: JSON.stringify(data) }),
  validerRendezVous: (ref, montant) =>
    req(`/rendez-vous/${ref}/valider/`, { method: "POST", body: JSON.stringify({ montant }) }),
  urlRecu: (numero) => `/api/recus/${numero}/telecharger/`,

  // Administration
  login: (username, password) =>
    req("/auth/token/", { method: "POST", body: JSON.stringify({ username, password }) }),
  statistiques: (token) => req("/admin/statistiques/", { headers: { Authorization: `Bearer ${token}` } }),
  creerEtablissement: (data, token) =>
    req("/etablissements/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  supprimerEtablissement: (id, token) =>
    req(`/etablissements/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
};
