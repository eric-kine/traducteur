"""
Top S'ASSUR — Application de prise en charge en kinésithérapie.

Application Streamlit clé en main : un seul fichier, aucune installation
compliquée. Elle couvre les 5 étapes (accueil, zone douloureuse, établissement,
rendez-vous, reçu PDF) et un espace administration.

Pensée pour le Cameroun et le secteur informel : simple, en français, sans
compte pour le patient, montants en FCFA, reçu téléchargeable.
"""

import io
import os
import sqlite3
import uuid
from datetime import date, datetime, time, timedelta

import streamlit as st
from fpdf import FPDF

BASE = "top_sassur.db"

# ===========================================================================
# ★  PARAMÈTRES À PERSONNALISER  —  modifiez seulement les valeurs ci-dessous
# ===========================================================================

# --- Identité de marque ---
MARQUE_NOM = "Top S'ASSUR"
COULEUR_PRINCIPALE = "#1565C0"     # couleur principale, code hexadécimal (bleu)
LOGO_FICHIER = "logo.png"          # nom du fichier logo, à placer À CÔTÉ de app.py (ignoré s'il n'existe pas)

# --- Montant du reçu (en FCFA), différent selon le type d'établissement ---
MONTANT_PAR_TYPE = {
    "Hôpital": 20000,
    "Clinique": 15000,
    "Centre de kinésithérapie": 10000,
}
MONTANT_DEFAUT = 15000  # utilisé si le type d'établissement n'est pas dans la liste ci-dessus


def montant_pour_type(type_etab):
    return MONTANT_PAR_TYPE.get(type_etab, MONTANT_DEFAUT)

# --- Établissements partenaires proposés au démarrage ---
# Format : ("Nom", "Type", "Ville"). Type : "Hôpital", "Clinique" ou "Centre de kinésithérapie".
ETABLISSEMENTS_DEFAUT = [
    ("Hôpital Général de Douala", "Hôpital", "Douala"),
    ("Hôpital Central de Yaoundé", "Hôpital", "Yaoundé"),
    ("Clinique de la Kiné Bonanjo", "Clinique", "Douala"),
    ("Centre de Kinésithérapie Bastos", "Centre de kinésithérapie", "Yaoundé"),
    ("Clinique Régionale de Bafoussam", "Clinique", "Bafoussam"),
]

# --- Textes de la page d'accueil ---
ACCUEIL_TITRE = "La kinésithérapie accessible à tous"
ACCUEIL_TEXTE = (
    "Top S'ASSUR facilite votre prise en charge en kinésithérapie : "
    "neurologie, traumatologie, rhumatologie, gynécologie, orthopédie et "
    "bien-être corporel. Choisissez votre zone de douleur, votre établissement, "
    "votre rendez-vous — et repartez avec un reçu officiel."
)
ACCUEIL_CARTES = [
    ("🦴 Soulager", "Des soins ciblés selon votre douleur."),
    ("🏥 Se rapprocher", "Un réseau d'établissements partenaires."),
    ("🤝 Mission sociale", "Pensé pour tous, secteur informel inclus."),
]

# ===========================================================================
#  (Le reste du fichier ne nécessite normalement aucune modification.)
# ===========================================================================

# Horaires d'ouverture utilisés pour proposer les créneaux
HEURE_DEBUT = 8      # ouverture 08h
HEURE_FIN = 17       # fermeture 17h
PAS_MINUTES = 30

# Zones douloureuses proposées (nom affiché, spécialité kiné associée)
ZONES = [
    ("Cou", "Neurologie / Traumatologie"),
    ("Épaule", "Orthopédie / Traumatologie"),
    ("Omoplate", "Orthopédie"),
    ("Dos", "Rhumatologie"),
    ("Fesse", "Traumatologie"),
    ("Hanche", "Orthopédie / Rhumatologie"),
    ("Cuisse", "Traumatologie"),
    ("Genou", "Orthopédie / Traumatologie"),
    ("Jambe", "Traumatologie"),
    ("Cheville", "Traumatologie"),
    ("Pied", "Orthopédie"),
]


def _hex_vers_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _assombrir(rgb, facteur=0.78):
    return "#%02x%02x%02x" % tuple(int(x * facteur) for x in rgb)


COULEUR_RGB = _hex_vers_rgb(COULEUR_PRINCIPALE)
COULEUR_FONCE = _assombrir(COULEUR_RGB)
LOGO_PRESENT = bool(LOGO_FICHIER) and os.path.exists(LOGO_FICHIER)


# ---------------------------------------------------------------------------
# Base de données (SQLite, créée automatiquement)
# ---------------------------------------------------------------------------

def connexion():
    conn = sqlite3.connect(BASE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = connexion()
    c = conn.cursor()
    c.execute(
        """CREATE TABLE IF NOT EXISTS etablissements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL, type TEXT, ville TEXT, actif INTEGER DEFAULT 1)"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS rendez_vous (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT UNIQUE,
            patient_nom TEXT, patient_prenom TEXT, patient_tel TEXT,
            zone TEXT, etablissement TEXT, ville TEXT,
            date_rdv TEXT, heure_rdv TEXT,
            montant INTEGER, cree_le TEXT)"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS recus (
            numero TEXT PRIMARY KEY, reference TEXT, pdf BLOB, cree_le TEXT)"""
    )
    # Créneau unique par établissement / date / heure
    c.execute(
        """CREATE UNIQUE INDEX IF NOT EXISTS idx_creneau
           ON rendez_vous (etablissement, date_rdv, heure_rdv)"""
    )
    if c.execute("SELECT COUNT(*) FROM etablissements").fetchone()[0] == 0:
        c.executemany(
            "INSERT INTO etablissements (nom, type, ville) VALUES (?,?,?)",
            ETABLISSEMENTS_DEFAUT,
        )
    conn.commit()
    conn.close()


def lister_etablissements(actifs_seulement=True):
    conn = connexion()
    req = "SELECT * FROM etablissements"
    if actifs_seulement:
        req += " WHERE actif = 1"
    req += " ORDER BY ville, nom"
    lignes = conn.execute(req).fetchall()
    conn.close()
    return lignes


def ajouter_etablissement(nom, type_, ville):
    conn = connexion()
    conn.execute("INSERT INTO etablissements (nom, type, ville) VALUES (?,?,?)", (nom, type_, ville))
    conn.commit()
    conn.close()


def supprimer_etablissement(eid):
    conn = connexion()
    conn.execute("DELETE FROM etablissements WHERE id = ?", (eid,))
    conn.commit()
    conn.close()


def creneaux_pris(etablissement, jour):
    conn = connexion()
    lignes = conn.execute(
        "SELECT heure_rdv FROM rendez_vous WHERE etablissement = ? AND date_rdv = ?",
        (etablissement, jour),
    ).fetchall()
    conn.close()
    return {l["heure_rdv"] for l in lignes}


def enregistrer_rendez_vous(donnees):
    """Insère le RDV et le reçu. Renvoie (reference, numero_recu, pdf_bytes) ou lève une erreur."""
    reference = "RDV-" + uuid.uuid4().hex[:6].upper()
    numero = "REC-" + reference.split("-")[1]
    maintenant = datetime.now().isoformat(timespec="seconds")

    conn = connexion()
    try:
        conn.execute(
            """INSERT INTO rendez_vous
               (reference, patient_nom, patient_prenom, patient_tel, zone,
                etablissement, ville, date_rdv, heure_rdv, montant, cree_le)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                reference, donnees["nom"], donnees["prenom"], donnees["tel"], donnees["zone"],
                donnees["etablissement"], donnees["ville"], donnees["date_rdv"],
                donnees["heure_rdv"], donnees["montant"], maintenant,
            ),
        )
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError("Ce créneau vient d'être réservé. Choisissez un autre horaire.")

    pdf_bytes = construire_recu_pdf(reference, numero, donnees, maintenant)
    conn.execute(
        "INSERT INTO recus (numero, reference, pdf, cree_le) VALUES (?,?,?,?)",
        (numero, reference, pdf_bytes, maintenant),
    )
    conn.commit()
    conn.close()
    return reference, numero, pdf_bytes


def statistiques():
    conn = connexion()
    total = conn.execute("SELECT COUNT(*) FROM rendez_vous").fetchone()[0]
    recus = conn.execute("SELECT COUNT(*) FROM recus").fetchone()[0]
    etab = conn.execute("SELECT COUNT(*) FROM etablissements WHERE actif = 1").fetchone()[0]
    par_zone = conn.execute(
        "SELECT zone, COUNT(*) n FROM rendez_vous GROUP BY zone ORDER BY n DESC"
    ).fetchall()
    derniers = conn.execute(
        "SELECT * FROM rendez_vous ORDER BY id DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return {"total": total, "recus": recus, "etab": etab, "par_zone": par_zone, "derniers": derniers}


# ---------------------------------------------------------------------------
# Génération du reçu PDF
# ---------------------------------------------------------------------------

def construire_recu_pdf(reference, numero, donnees, emis_le_iso):
    emis = datetime.fromisoformat(emis_le_iso)
    pdf = FPDF(format="A4")
    pdf.add_page()

    # Bandeau coloré (couleur de marque)
    r, g, b = COULEUR_RGB
    pdf.set_fill_color(r, g, b)
    pdf.rect(0, 0, 210, 34, style="F")
    if LOGO_PRESENT:
        try:
            pdf.image(LOGO_FICHIER, x=172, y=6, h=22)  # logo à droite du bandeau
        except Exception:
            pass
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_xy(15, 10)
    pdf.cell(0, 10, _latin(MARQUE_NOM))
    pdf.set_font("Helvetica", "", 11)
    pdf.set_xy(15, 21)
    pdf.cell(0, 8, "Recu de prise en charge - Kinesitherapie")

    # Numéro + date
    pdf.set_text_color(32, 32, 32)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_xy(15, 45)
    pdf.cell(0, 8, f"Recu N. {numero}")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(95, 99, 104)
    pdf.set_xy(15, 53)
    pdf.cell(0, 6, f"Emis le {emis.strftime('%d/%m/%Y a %H:%M')}")

    # Détails
    lignes = [
        ("Reference RDV", reference),
        ("Patient", f"{donnees['nom']} {donnees['prenom']}"),
        ("Telephone", donnees["tel"] or "-"),
        ("Zone concernee", donnees["zone"]),
        ("Etablissement", donnees["etablissement"]),
        ("Ville", donnees["ville"]),
        ("Date du rendez-vous", _fr_date(donnees["date_rdv"])),
        ("Heure", donnees["heure_rdv"]),
    ]
    y = 68
    for label, valeur in lignes:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(95, 99, 104)
        pdf.set_xy(15, y)
        pdf.cell(60, 8, _latin(label))
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(32, 32, 32)
        pdf.set_xy(75, y)
        pdf.cell(0, 8, _latin(str(valeur)))
        y += 11

    # Encadré « montant à régler » mis en évidence
    pdf.set_fill_color(235, 242, 251)  # bleu très clair
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(0.6)
    pdf.rect(15, y + 2, 180, 16, style="DF")
    pdf.set_text_color(r, g, b)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_xy(20, y + 6)
    pdf.cell(0, 8, _latin(f"Montant a regler : {donnees['montant']} FCFA"))

    # Mentions
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(95, 99, 104)
    pdf.set_xy(15, 265)
    pdf.multi_cell(
        180, 5,
        _latin(
            "Document genere automatiquement par Top S'ASSUR. Conservez-le comme "
            "justificatif de prise en charge. Ce recu ne constitue pas une facture "
            "fiscale. Vos donnees personnelles sont traitees de facon confidentielle."
        ),
    )

    sortie = pdf.output()
    return bytes(sortie)


def _latin(texte):
    """fpdf2 (polices standard) gère le latin-1 ; on remplace les caractères hors table."""
    return texte.encode("latin-1", "replace").decode("latin-1")


def _fr_date(iso):
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    except Exception:
        return iso


# ---------------------------------------------------------------------------
# Interface
# ---------------------------------------------------------------------------

st.set_page_config(page_title=MARQUE_NOM, page_icon="➕", layout="centered")

st.markdown(
    f"""
    <style>
      .stButton>button[kind="primary"] {{ background:{COULEUR_PRINCIPALE}; border:none; }}
      .stButton>button[kind="primary"]:hover {{ background:{COULEUR_FONCE}; }}
      .stDownloadButton>button {{ background:{COULEUR_PRINCIPALE}; color:#fff; border:none; }}
      .stDownloadButton>button:hover {{ background:{COULEUR_FONCE}; color:#fff; }}
      div[data-testid="stFormSubmitButton"]>button {{ background:{COULEUR_PRINCIPALE}; color:#fff; border:none; }}
      div[data-testid="stFormSubmitButton"]>button:hover {{ background:{COULEUR_FONCE}; color:#fff; }}
      .titre-vert {{ color:{COULEUR_FONCE}; }}
      .carte-info {{ background:#eef4f1; border-left:4px solid {COULEUR_PRINCIPALE};
                     padding:14px 16px; border-radius:12px; }}
    </style>
    """,
    unsafe_allow_html=True,
)

init_db()

# État de navigation
if "etape" not in st.session_state:
    st.session_state.etape = 0
    st.session_state.choix = {}

etat = st.session_state
choix = etat.choix


def aller(n):
    etat.etape = n


# --- Barre latérale : espace administration ---
with st.sidebar:
    st.header("Espace administration")
    mot_de_passe = st.text_input("Mot de passe admin", type="password")
    # st.secrets lève une erreur s'il n'existe aucun fichier secrets.toml :
    # on retombe alors sur le mot de passe par défaut.
    try:
        mdp_attendu = st.secrets.get("ADMIN_PASSWORD", "admin1234")
    except Exception:
        mdp_attendu = "admin1234"
    admin_ok = bool(mot_de_passe) and mot_de_passe == mdp_attendu
    if mot_de_passe and not admin_ok:
        st.error("Mot de passe incorrect.")
    if admin_ok:
        st.success("Connecté.")

if LOGO_PRESENT:
    st.image(LOGO_FICHIER, width=150)
st.title(f"➕ {MARQUE_NOM}")
st.caption("Prise en charge en kinésithérapie — simple, rapide, avec reçu officiel.")


# ===========================================================================
# MODE ADMINISTRATION
# ===========================================================================
if admin_ok:
    st.header("Tableau de bord")
    stats = statistiques()
    c1, c2, c3 = st.columns(3)
    c1.metric("Rendez-vous", stats["total"])
    c2.metric("Reçus émis", stats["recus"])
    c3.metric("Établissements actifs", stats["etab"])

    st.subheader("Établissements partenaires")
    with st.form("ajout_etab", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)
        nom = col1.text_input("Nom")
        type_ = col2.selectbox("Type", ["Hôpital", "Clinique", "Centre de kinésithérapie"])
        ville = col3.text_input("Ville")
        if st.form_submit_button("Ajouter l'établissement", type="primary") and nom and ville:
            ajouter_etablissement(nom, type_, ville)
            st.success(f"« {nom} » ajouté.")
            st.rerun()

    for e in lister_etablissements(actifs_seulement=False):
        col1, col2 = st.columns([5, 1])
        col1.write(f"**{e['nom']}** — {e['type']} · {e['ville']}")
        if col2.button("Supprimer", key=f"del{e['id']}"):
            supprimer_etablissement(e["id"])
            st.rerun()

    st.subheader("Derniers rendez-vous")
    if stats["derniers"]:
        st.dataframe(
            [
                {
                    "Référence": d["reference"], "Patient": f"{d['patient_nom']} {d['patient_prenom']}",
                    "Zone": d["zone"], "Établissement": d["etablissement"],
                    "Date": _fr_date(d["date_rdv"]), "Heure": d["heure_rdv"],
                    "Montant (FCFA)": d["montant"],
                }
                for d in stats["derniers"]
            ],
            use_container_width=True, hide_index=True,
        )
    else:
        st.info("Aucun rendez-vous pour le moment.")
    st.stop()


# ===========================================================================
# PARCOURS PATIENT (5 étapes)
# ===========================================================================
etapes_noms = ["Accueil", "Zone", "Établissement", "Rendez-vous", "Reçu"]
if etat.etape > 0:
    st.progress(etat.etape / (len(etapes_noms) - 1), text=f"Étape : {etapes_noms[etat.etape]}")

# --- MODULE 1 : Accueil ---
if etat.etape == 0:
    st.markdown(f"### {ACCUEIL_TITRE}")
    st.write(ACCUEIL_TEXTE)
    colonnes = st.columns(len(ACCUEIL_CARTES))
    for col, (titre, texte) in zip(colonnes, ACCUEIL_CARTES):
        col.markdown(f"**{titre}**\n\n{texte}")
    st.write("")
    if st.button("Commencer →", type="primary"):
        aller(1)
        st.rerun()

# --- MODULE 2 : Zone douloureuse ---
elif etat.etape == 1:
    st.subheader("Où avez-vous mal ?")
    st.caption("Choisissez la zone concernée.")
    cols = st.columns(3)
    for i, (nom, spec) in enumerate(ZONES):
        marque = "✅ " if choix.get("zone") == nom else ""
        if cols[i % 3].button(f"{marque}{nom}", key=f"z{i}", use_container_width=True):
            choix["zone"] = nom
            choix["specialite"] = spec
            st.rerun()
    if choix.get("zone"):
        st.markdown(
            f"<div class='carte-info'>Zone sélectionnée : <b>{choix['zone']}</b> — {choix['specialite']}</div>",
            unsafe_allow_html=True,
        )
    col1, col2 = st.columns(2)
    if col1.button("← Retour"):
        aller(0); st.rerun()
    if col2.button("Continuer →", type="primary", disabled=not choix.get("zone")):
        aller(2); st.rerun()

# --- MODULE 3 : Établissement ---
elif etat.etape == 2:
    st.subheader("Choisissez un établissement")
    etabs = lister_etablissements()
    noms = [
        f"{e['nom']} — {e['type']} · {e['ville']} · {montant_pour_type(e['type'])} FCFA"
        for e in etabs
    ]
    if noms:
        defaut = choix.get("_index_etab", 0)
        idx = st.radio("Établissements partenaires", range(len(noms)),
                       format_func=lambda i: noms[i], index=min(defaut, len(noms) - 1))
        choix["_index_etab"] = idx
        choix["etablissement"] = etabs[idx]["nom"]
        choix["ville"] = etabs[idx]["ville"]
        choix["type_etab"] = etabs[idx]["type"]
        choix["montant"] = montant_pour_type(etabs[idx]["type"])
    else:
        st.warning("Aucun établissement disponible. Contactez l'administration.")
    col1, col2 = st.columns(2)
    if col1.button("← Retour"):
        aller(1); st.rerun()
    if col2.button("Continuer →", type="primary", disabled=not choix.get("etablissement")):
        aller(3); st.rerun()

# --- MODULE 4 : Rendez-vous ---
elif etat.etape == 3:
    st.subheader("Votre rendez-vous")
    jour = st.date_input("Jour", min_value=date.today(),
                         value=max(date.today(), choix.get("_date_obj", date.today())))
    choix["_date_obj"] = jour
    choix["date_rdv"] = jour.isoformat()

    pris = creneaux_pris(choix["etablissement"], choix["date_rdv"])
    creneaux = []
    t = datetime.combine(jour, time(HEURE_DEBUT))
    fin = datetime.combine(jour, time(HEURE_FIN))
    while t < fin:
        creneaux.append(t.strftime("%H:%M"))
        t += timedelta(minutes=PAS_MINUTES)
    libres = [h for h in creneaux if h not in pris]

    if libres:
        choix["heure_rdv"] = st.radio("Créneaux disponibles", libres, horizontal=True,
                                      index=libres.index(choix["heure_rdv"]) if choix.get("heure_rdv") in libres else 0)
    else:
        st.warning("Aucun créneau libre ce jour. Choisissez une autre date.")
        choix["heure_rdv"] = None

    col1, col2 = st.columns(2)
    if col1.button("← Retour"):
        aller(2); st.rerun()
    if col2.button("Continuer →", type="primary", disabled=not choix.get("heure_rdv")):
        aller(4); st.rerun()

# --- MODULE 5 : Coordonnées + validation + reçu ---
elif etat.etape == 4:
    if choix.get("_reference"):
        # Reçu déjà généré
        st.success(f"Rendez-vous confirmé ! Reçu **{choix['_numero']}** généré.")
        st.balloons()
        st.download_button(
            "⬇️ Télécharger le reçu PDF", data=choix["_pdf"],
            file_name=f"{choix['_numero']}.pdf", mime="application/pdf", type="primary",
        )
        if st.button("Nouveau rendez-vous"):
            etat.choix = {}
            aller(0); st.rerun()
    else:
        st.subheader("Vos coordonnées")
        with st.form("coordonnees"):
            nom = st.text_input("Nom")
            prenom = st.text_input("Prénom")
            tel = st.text_input("Téléphone", placeholder="+237…")
            consent = st.checkbox(
                "J'accepte que mes données soient traitées de façon confidentielle pour ce rendez-vous."
            )
            st.markdown("**Récapitulatif**")
            st.write(f"- Zone : **{choix.get('zone')}**")
            st.write(f"- Établissement : **{choix.get('etablissement')}** ({choix.get('ville')})")
            st.write(f"- Date : **{_fr_date(choix.get('date_rdv',''))}** à **{choix.get('heure_rdv')}**")
            st.write(f"- Montant : **{choix.get('montant', MONTANT_DEFAUT)} FCFA**")
            envoye = st.form_submit_button("✓ Enregistrer", type="primary")

        if envoye:
            if not nom or not prenom:
                st.error("Merci d'indiquer votre nom et prénom.")
            elif not consent:
                st.error("Le consentement est nécessaire pour enregistrer le rendez-vous.")
            else:
                try:
                    ref, numero, pdf_bytes = enregistrer_rendez_vous(
                        {
                            "nom": nom, "prenom": prenom, "tel": tel,
                            "zone": choix["zone"], "etablissement": choix["etablissement"],
                            "ville": choix["ville"], "date_rdv": choix["date_rdv"],
                            "heure_rdv": choix["heure_rdv"],
                            "montant": choix.get("montant", MONTANT_DEFAUT),
                        }
                    )
                    choix["_reference"], choix["_numero"], choix["_pdf"] = ref, numero, pdf_bytes
                    st.rerun()
                except ValueError as e:
                    st.error(str(e))

        if st.button("← Retour"):
            aller(3); st.rerun()

st.divider()
st.caption("Top S'ASSUR · Données confidentielles · Montants en FCFA")
