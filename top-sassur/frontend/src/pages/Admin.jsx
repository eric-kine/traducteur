import React, { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api.js";

export default function Admin() {
  const [token, setToken] = useState(null);
  const [ident, setIdent] = useState({ username: "admin", password: "" });
  const [stats, setStats] = useState(null);
  const [etabs, setEtabs] = useState([]);
  const [nouvel, setNouvel] = useState({ nom: "", type: "CLINIQUE", ville: "", adresse: "" });
  const [erreur, setErreur] = useState("");

  async function connexion(e) {
    e.preventDefault();
    setErreur("");
    try {
      const { access } = await api.login(ident.username, ident.password);
      setToken(access);
      rafraichir(access);
    } catch (err) {
      setErreur("Identifiants invalides.");
    }
  }

  async function rafraichir(t = token) {
    setStats(await api.statistiques(t));
    setEtabs(await api.etablissements());
  }

  async function ajouter(e) {
    e.preventDefault();
    setErreur("");
    try {
      await api.creerEtablissement(nouvel, token);
      setNouvel({ nom: "", type: "CLINIQUE", ville: "", adresse: "" });
      rafraichir();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer(id) {
    await api.supprimerEtablissement(id, token);
    rafraichir();
  }

  if (!token) {
    return (
      <div className="admin-login">
        <form onSubmit={connexion} className="carte-login">
          <h2>Espace administration</h2>
          {erreur && <div className="alerte">{erreur}</div>}
          <input placeholder="Identifiant" value={ident.username}
            onChange={(e) => setIdent({ ...ident, username: e.target.value })} />
          <input type="password" placeholder="Mot de passe" value={ident.password}
            onChange={(e) => setIdent({ ...ident, password: e.target.value })} />
          <button className="btn-principal">Se connecter</button>
          <Link to="/" className="lien-admin">← Retour à l'application</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="entete">
        <div className="logo"><span className="logo-pastille">＋</span> Top S'ASSUR — Admin</div>
        <Link to="/" className="lien-admin">← Application</Link>
      </header>

      {erreur && <div className="alerte">{erreur}</div>}

      {stats && (
        <section className="stats-grille">
          <div className="stat"><b>{stats.total_rdv}</b><span>Rendez-vous</span></div>
          <div className="stat"><b>{stats.total_recus}</b><span>Reçus émis</span></div>
          <div className="stat"><b>{stats.etablissements_actifs}</b><span>Établissements actifs</span></div>
        </section>
      )}

      <section className="admin-bloc">
        <h3>Ajouter un établissement partenaire</h3>
        <form onSubmit={ajouter} className="form-inline">
          <input placeholder="Nom" required value={nouvel.nom}
            onChange={(e) => setNouvel({ ...nouvel, nom: e.target.value })} />
          <select value={nouvel.type} onChange={(e) => setNouvel({ ...nouvel, type: e.target.value })}>
            <option value="HOPITAL">Hôpital</option>
            <option value="CLINIQUE">Clinique</option>
            <option value="CENTRE">Centre de kinésithérapie</option>
          </select>
          <input placeholder="Ville" required value={nouvel.ville}
            onChange={(e) => setNouvel({ ...nouvel, ville: e.target.value })} />
          <input placeholder="Adresse" value={nouvel.adresse}
            onChange={(e) => setNouvel({ ...nouvel, adresse: e.target.value })} />
          <button className="btn-principal">Ajouter</button>
        </form>
      </section>

      <section className="admin-bloc">
        <h3>Établissements ({etabs.length})</h3>
        <table className="table-admin">
          <thead><tr><th>Nom</th><th>Type</th><th>Ville</th><th></th></tr></thead>
          <tbody>
            {etabs.map((e) => (
              <tr key={e.id}>
                <td>{e.nom}</td><td>{e.type_libelle}</td><td>{e.ville}</td>
                <td><button className="btn-supprimer" onClick={() => supprimer(e.id)}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
