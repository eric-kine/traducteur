import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "./api.js";
import BodyMap from "./components/BodyMap.jsx";

const ETAPES = ["Accueil", "Zone", "Établissement", "Rendez-vous", "Reçu"];

export default function App() {
  const [etape, setEtape] = useState(0);
  const [zones, setZones] = useState([]);
  const [etablissements, setEtablissements] = useState([]);
  const [choix, setChoix] = useState({ zone: null, etablissement: null, date: "", heure: "" });
  const [patient, setPatient] = useState({ nom: "", prenom: "", telephone: "", consentement: false });
  const [creneaux, setCreneaux] = useState([]);
  const [recu, setRecu] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    api.zones().then(setZones).catch((e) => setErreur(e.message));
    api.etablissements().then(setEtablissements).catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => {
    if (choix.etablissement && choix.date) {
      api
        .disponibilites(choix.etablissement.id, choix.date)
        .then((d) => setCreneaux(d.creneaux))
        .catch((e) => setErreur(e.message));
    }
  }, [choix.etablissement, choix.date]);

  const aller = (n) => {
    setErreur("");
    setEtape(n);
  };

  async function enregistrer() {
    setErreur("");
    setChargement(true);
    try {
      const rdv = await api.creerRendezVous({
        patient_nom: patient.nom,
        patient_prenom: patient.prenom,
        patient_telephone: patient.telephone,
        zone: choix.zone.id,
        etablissement: choix.etablissement.id,
        date_rdv: choix.date,
        heure_rdv: choix.heure,
        consentement_donnees: patient.consentement,
      });
      const valide = await api.validerRendezVous(rdv.reference, 15000);
      setRecu(valide.recu);
      aller(4);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="app">
      <header className="entete">
        <div className="logo">
          <span className="logo-pastille">＋</span> Top S'ASSUR
        </div>
        <nav>
          <Link to="/admin" className="lien-admin">Espace administration</Link>
        </nav>
      </header>

      {etape > 0 && (
        <ol className="stepper">
          {ETAPES.map((nom, i) => (
            <li key={nom} className={i === etape ? "actif" : i < etape ? "fait" : ""}>
              <span className="num">{i}</span>
              {nom}
            </li>
          ))}
        </ol>
      )}

      {erreur && <div className="alerte">{erreur}</div>}

      <main className="contenu">
        {/* MODULE 1 — Accueil */}
        {etape === 0 && (
          <section className="accueil fade-in">
            <h1>La kinésithérapie accessible à tous</h1>
            <p className="accroche">
              Top S'ASSUR facilite votre prise en charge en kinésithérapie : neurologie,
              traumatologie, rhumatologie, gynécologie, orthopédie et bien-être corporel.
              Choisissez votre zone de douleur, votre établissement, votre rendez-vous —
              et repartez avec un reçu officiel.
            </p>
            <div className="cartes">
              <div className="carte"><b>🦴 Soulager</b><span>Des soins ciblés selon votre douleur.</span></div>
              <div className="carte"><b>🏥 Se rapprocher</b><span>Un réseau d'hôpitaux et cliniques partenaires.</span></div>
              <div className="carte"><b>🤝 Mission sociale</b><span>Pensé pour tous, y compris le secteur informel.</span></div>
            </div>
            <button className="btn-principal" onClick={() => aller(1)}>Commencer →</button>
          </section>
        )}

        {/* MODULE 2 — Zone douloureuse */}
        {etape === 1 && (
          <section className="fade-in">
            <h2>Où avez-vous mal ?</h2>
            <p className="sous-titre">Touchez la zone concernée sur le corps.</p>
            <BodyMap
              zones={zones}
              selection={choix.zone?.code}
              onSelect={(z) => setChoix({ ...choix, zone: z })}
            />
            {choix.zone && <p className="selection-info">Zone sélectionnée : <b>{choix.zone.libelle}</b> — {choix.zone.specialite}</p>}
            <div className="actions">
              <button className="btn-secondaire" onClick={() => aller(0)}>← Retour</button>
              <button className="btn-principal" disabled={!choix.zone} onClick={() => aller(2)}>Continuer →</button>
            </div>
          </section>
        )}

        {/* MODULE 3 — Établissement */}
        {etape === 2 && (
          <section className="fade-in">
            <h2>Choisissez un établissement</h2>
            <p className="sous-titre">Cochez l'hôpital ou la clinique de votre choix.</p>
            <ul className="liste-etab">
              {etablissements.map((e) => (
                <li
                  key={e.id}
                  className={choix.etablissement?.id === e.id ? "coche" : ""}
                  onClick={() => setChoix({ ...choix, etablissement: e })}
                >
                  <input type="checkbox" readOnly checked={choix.etablissement?.id === e.id} />
                  <div>
                    <b>{e.nom}</b>
                    <span>{e.type_libelle} · {e.ville}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button className="btn-secondaire" onClick={() => aller(1)}>← Retour</button>
              <button className="btn-principal" disabled={!choix.etablissement} onClick={() => aller(3)}>Continuer →</button>
            </div>
          </section>
        )}

        {/* MODULE 4 — Rendez-vous */}
        {etape === 3 && (
          <section className="fade-in">
            <h2>Votre rendez-vous</h2>
            <div className="champ">
              <label>Jour</label>
              <input
                type="date"
                min={aujourdhui}
                value={choix.date}
                onChange={(e) => setChoix({ ...choix, date: e.target.value, heure: "" })}
              />
            </div>
            {choix.date && (
              <div className="creneaux">
                {creneaux.map((c) => (
                  <button
                    key={c.heure}
                    disabled={!c.libre}
                    className={`creneau ${choix.heure === c.heure ? "actif" : ""} ${!c.libre ? "pris" : ""}`}
                    onClick={() => setChoix({ ...choix, heure: c.heure })}
                  >
                    {c.heure}
                  </button>
                ))}
              </div>
            )}
            <div className="actions">
              <button className="btn-secondaire" onClick={() => aller(2)}>← Retour</button>
              <button className="btn-principal" disabled={!choix.date || !choix.heure} onClick={() => aller(3.5)}>Continuer →</button>
            </div>
          </section>
        )}

        {/* MODULE 5 — Coordonnées + validation + reçu */}
        {etape === 3.5 && (
          <section className="fade-in">
            <h2>Vos coordonnées</h2>
            <div className="champ"><label>Nom</label>
              <input value={patient.nom} onChange={(e) => setPatient({ ...patient, nom: e.target.value })} /></div>
            <div className="champ"><label>Prénom</label>
              <input value={patient.prenom} onChange={(e) => setPatient({ ...patient, prenom: e.target.value })} /></div>
            <div className="champ"><label>Téléphone</label>
              <input value={patient.telephone} placeholder="+237…" onChange={(e) => setPatient({ ...patient, telephone: e.target.value })} /></div>
            <label className="consentement">
              <input type="checkbox" checked={patient.consentement}
                onChange={(e) => setPatient({ ...patient, consentement: e.target.checked })} />
              J'accepte que mes données soient traitées de façon confidentielle pour ce rendez-vous.
            </label>

            <div className="recap">
              <div><span>Zone</span><b>{choix.zone?.libelle}</b></div>
              <div><span>Établissement</span><b>{choix.etablissement?.nom}</b></div>
              <div><span>Date</span><b>{choix.date} à {choix.heure}</b></div>
            </div>

            <div className="actions">
              <button className="btn-secondaire" onClick={() => aller(3)}>← Retour</button>
              <button
                className="btn-enregistrer"
                disabled={!patient.nom || !patient.prenom || !patient.consentement || chargement}
                onClick={enregistrer}
              >
                {chargement ? "Enregistrement…" : "✓ Enregistrer"}
              </button>
            </div>
          </section>
        )}

        {/* Reçu généré */}
        {etape === 4 && recu && (
          <section className="fade-in confirmation">
            <div className="coche-succes">✓</div>
            <h2>Rendez-vous confirmé !</h2>
            <p>Votre reçu officiel <b>{recu.numero}</b> a été généré.</p>
            <a className="btn-principal" href={api.urlRecu(recu.numero)} target="_blank" rel="noreferrer">
              ⬇ Télécharger le reçu PDF
            </a>
            <button className="btn-secondaire" onClick={() => window.location.reload()}>Nouveau rendez-vous</button>
          </section>
        )}
      </main>

      <footer className="pied">
        Top S'ASSUR · Application de prise en charge en kinésithérapie · Données confidentielles
      </footer>
    </div>
  );
}
