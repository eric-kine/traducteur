"""
Traducteur de documents - Word / PDF / PowerPoint
Application Streamlit gratuite, sans limite de taille, sans compte.
Auteur : généré avec Claude pour un usage simple, clé en main.
"""

import io
import time
import copy
import streamlit as st
from deep_translator import GoogleTranslator
from langdetect import detect, DetectorFactory

DetectorFactory.seed = 0  # résultats de détection de langue stables

# ---------------------------------------------------------------------------
# Configuration générale
# ---------------------------------------------------------------------------

st.set_page_config(page_title="Traducteur de documents", page_icon="🌍", layout="centered")

LANGUES = {
    "Français": "fr",
    "Anglais": "en",
    "Allemand": "de",
    "Espagnol": "es",
    "Italien": "it",
    "Portugais": "pt",
    "Néerlandais": "nl",
    "Polonais": "pl",
    "Russe": "ru",
    "Turc": "tr",
    "Roumain": "ro",
    "Grec": "el",
    "Suédois": "sv",
    "Arabe": "ar",
    "Chinois (simplifié)": "zh-CN",
    "Japonais": "ja",
    "Coréen": "ko",
}

# Codes renvoyés par langdetect -> nom lisible, pour afficher la langue détectée
CODE_VERS_NOM = {code.split("-")[0]: nom for nom, code in LANGUES.items()}

MAX_BLOC = 4500  # taille max d'un morceau de texte envoyé au traducteur (limite technique du service gratuit)


# ---------------------------------------------------------------------------
# Fonctions de traduction de texte brut (avec découpage automatique)
# ---------------------------------------------------------------------------

def decouper_texte(texte, taille_max=MAX_BLOC):
    """Découpe un long texte en morceaux, en essayant de couper sur des phrases."""
    if len(texte) <= taille_max:
        return [texte]

    morceaux = []
    reste = texte
    while len(reste) > taille_max:
        coupe = reste.rfind(". ", 0, taille_max)
        if coupe == -1:
            coupe = reste.rfind(" ", 0, taille_max)
        if coupe == -1:
            coupe = taille_max
        morceaux.append(reste[:coupe + 1])
        reste = reste[coupe + 1:]
    if reste:
        morceaux.append(reste)
    return morceaux


def traduire_texte(texte, langue_source, langue_cible, cache):
    """Traduit un texte, avec cache pour éviter de retraduire deux fois la même chose."""
    texte = texte if texte else ""
    if not texte.strip():
        return texte

    if texte in cache:
        return cache[texte]

    try:
        src = "auto" if langue_source == "auto" else langue_source
        traducteur = GoogleTranslator(source=src, target=langue_cible)
        morceaux = decouper_texte(texte)
        resultats = []
        for morceau in morceaux:
            for tentative in range(3):
                try:
                    resultats.append(traducteur.translate(morceau))
                    break
                except Exception:
                    time.sleep(1.5)
            else:
                resultats.append(morceau)  # en dernier recours, on garde le texte original
        resultat = "".join(resultats)
    except Exception:
        resultat = texte  # si la traduction échoue totalement, on ne casse pas le document

    cache[texte] = resultat
    return resultat


# ---------------------------------------------------------------------------
# Traduction d'un fichier Word (.docx)
# ---------------------------------------------------------------------------

def traduire_docx(fichier, langue_source, langue_cible, barre, cache):
    from docx import Document

    doc = Document(fichier)

    # On rassemble tous les paragraphes à traduire : corps, tableaux, en-têtes, pieds de page
    paragraphes = list(doc.paragraphs)
    for table in doc.tables:
        for ligne in table.rows:
            for cellule in ligne.cells:
                paragraphes.extend(cellule.paragraphs)
    for section in doc.sections:
        paragraphes.extend(section.header.paragraphs)
        paragraphes.extend(section.footer.paragraphs)

    total = max(len(paragraphes), 1)
    for i, p in enumerate(paragraphes):
        texte_original = p.text
        if texte_original.strip():
            texte_traduit = traduire_texte(texte_original, langue_source, langue_cible, cache)
            _remplacer_texte_paragraphe(p, texte_traduit)
        barre.progress(min((i + 1) / total, 1.0))

    sortie = io.BytesIO()
    doc.save(sortie)
    sortie.seek(0)
    return sortie


def _remplacer_texte_paragraphe(paragraphe, nouveau_texte):
    """Remplace le texte d'un paragraphe en conservant la mise en forme du premier run."""
    if not paragraphe.runs:
        paragraphe.add_run(nouveau_texte)
        return
    paragraphe.runs[0].text = nouveau_texte
    for run in paragraphe.runs[1:]:
        run.text = ""


# ---------------------------------------------------------------------------
# Traduction d'un fichier PowerPoint (.pptx)
# ---------------------------------------------------------------------------

def traduire_pptx(fichier, langue_source, langue_cible, barre, cache):
    from pptx import Presentation

    prs = Presentation(fichier)

    formes_texte = []
    for slide in prs.slides:
        for shape in slide.shapes:
            _collecter_formes(shape, formes_texte)

    total = max(len(formes_texte), 1)
    for i, shape in enumerate(formes_texte):
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                if p.text.strip():
                    texte_traduit = traduire_texte(p.text, langue_source, langue_cible, cache)
                    _remplacer_texte_paragraphe(p, texte_traduit)
        elif shape.has_table:
            for ligne in shape.table.rows:
                for cellule in ligne.cells:
                    for p in cellule.text_frame.paragraphs:
                        if p.text.strip():
                            texte_traduit = traduire_texte(p.text, langue_source, langue_cible, cache)
                            _remplacer_texte_paragraphe(p, texte_traduit)
        barre.progress(min((i + 1) / total, 1.0))

    sortie = io.BytesIO()
    prs.save(sortie)
    sortie.seek(0)
    return sortie


def _collecter_formes(shape, liste):
    """Récupère récursivement toutes les formes contenant du texte (y compris dans des groupes)."""
    if shape.shape_type == 6:  # GROUP
        for sous_forme in shape.shapes:
            _collecter_formes(sous_forme, liste)
    else:
        if getattr(shape, "has_text_frame", False) or getattr(shape, "has_table", False):
            liste.append(shape)


# ---------------------------------------------------------------------------
# Traduction d'un fichier PDF
# ---------------------------------------------------------------------------

def traduire_pdf(fichier, langue_source, langue_cible, barre, cache):
    import fitz  # PyMuPDF

    donnees = fichier.read()
    doc = fitz.open(stream=donnees, filetype="pdf")

    total_pages = max(len(doc), 1)
    for num_page, page in enumerate(doc):
        blocs = page.get_text("dict")["blocks"]
        for bloc in blocs:
            if bloc.get("type") != 0:  # 0 = bloc de texte, on ignore les images
                continue
            for ligne in bloc.get("lines", []):
                texte_ligne = "".join(span["text"] for span in ligne["spans"])
                if not texte_ligne.strip():
                    continue

                rect = fitz.Rect(ligne["bbox"])
                span_ref = ligne["spans"][0]
                taille_police = span_ref.get("size", 11)
                couleur = span_ref.get("color", 0)

                texte_traduit = traduire_texte(texte_ligne, langue_source, langue_cible, cache)

                # On masque le texte original avec un rectangle blanc, puis on écrit la traduction
                page.draw_rect(rect, color=None, fill=(1, 1, 1))
                page.insert_textbox(
                    rect,
                    texte_traduit,
                    fontsize=max(taille_police * 0.9, 6),
                    fontname="helv",
                    color=_int_vers_rgb(couleur),
                    align=0,
                )
        barre.progress(min((num_page + 1) / total_pages, 1.0))

    sortie = io.BytesIO()
    doc.save(sortie)
    sortie.seek(0)
    return sortie


def _int_vers_rgb(couleur_int):
    r = ((couleur_int >> 16) & 255) / 255
    g = ((couleur_int >> 8) & 255) / 255
    b = (couleur_int & 255) / 255
    return (r, g, b)


# ---------------------------------------------------------------------------
# Détection automatique de la langue du document
# ---------------------------------------------------------------------------

def extraire_echantillon(donnees, extension, taille_max=3000):
    """Extrait un court échantillon de texte du document pour détecter la langue."""
    morceaux = []
    try:
        if extension == "docx":
            from docx import Document
            doc = Document(io.BytesIO(donnees))
            for p in doc.paragraphs:
                if p.text.strip():
                    morceaux.append(p.text)
                if sum(len(m) for m in morceaux) >= taille_max:
                    break
        elif extension == "pptx":
            from pptx import Presentation
            prs = Presentation(io.BytesIO(donnees))
            for slide in prs.slides:
                for shape in slide.shapes:
                    if getattr(shape, "has_text_frame", False) and shape.text_frame.text.strip():
                        morceaux.append(shape.text_frame.text)
                if sum(len(m) for m in morceaux) >= taille_max:
                    break
        elif extension == "pdf":
            import fitz
            doc = fitz.open(stream=donnees, filetype="pdf")
            for page in doc:
                texte = page.get_text().strip()
                if texte:
                    morceaux.append(texte)
                if sum(len(m) for m in morceaux) >= taille_max:
                    break
    except Exception:
        return ""
    return " ".join(morceaux)[:taille_max]


def detecter_langue(donnees, extension):
    """Renvoie (code, nom) de la langue détectée, ou (None, None) en cas d'échec."""
    echantillon = extraire_echantillon(donnees, extension)
    if not echantillon.strip():
        return None, None
    try:
        code = detect(echantillon)
    except Exception:
        return None, None
    return code, CODE_VERS_NOM.get(code, code)


# ---------------------------------------------------------------------------
# Interface utilisateur
# ---------------------------------------------------------------------------

st.title("🌍 Traducteur de documents")
st.caption("Word (.docx) · PDF (.pdf) · PowerPoint (.pptx) — gratuit, sans compte, sans limite de taille")

with st.expander("ℹ️ À savoir avant de commencer"):
    st.markdown(
        """
- La langue du document est **détectée automatiquement**, ou vous pouvez la choisir vous-même.
- La mise en page (titres, tableaux, puces, images) est **très bien conservée pour Word et PowerPoint**.
- Pour les **PDF**, le résultat est très correct sur des documents simples (texte + images), mais peut être
  légèrement imparfait sur des mises en page très complexes (plusieurs colonnes, texte artistique). La sortie
  d'un PDF vers une écriture non latine (arabe, chinois, japonais, coréen) peut ne pas s'afficher correctement ;
  pour ces langues, privilégiez les formats Word ou PowerPoint.
- Les documents volumineux sont traduits automatiquement par petits morceaux : il n'y a pas de limite de taille,
  mais un très gros document peut prendre quelques minutes.
- Aucune donnée n'est conservée par l'application après la traduction.
        """
    )

fichier_televerse = st.file_uploader(
    "Déposez votre document ici",
    type=["docx", "pdf", "pptx"],
)

col1, col2 = st.columns(2)
with col1:
    detection_auto = st.checkbox("Détecter la langue source automatiquement", value=True)
    if not detection_auto:
        nom_source = st.selectbox("Langue source", list(LANGUES.keys()), index=0)
with col2:
    nom_cible = st.selectbox("Traduire vers", list(LANGUES.keys()), index=1)

if fichier_televerse is not None:
    extension = fichier_televerse.name.split(".")[-1].lower()
    langue_cible = LANGUES[nom_cible]
    donnees = fichier_televerse.getvalue()  # octets lus une seule fois

    if detection_auto:
        langue_source = "auto"
        code_detecte, nom_detecte = detecter_langue(donnees, extension)
        if nom_detecte:
            st.info(f"🔎 Langue détectée : **{nom_detecte}**")
    else:
        langue_source = LANGUES[nom_source]
        code_detecte = langue_source

    # On évite de traduire un document vers sa propre langue.
    meme_langue = (
        code_detecte is not None
        and code_detecte.split("-")[0] == langue_cible.split("-")[0]
    )
    if meme_langue:
        st.warning(
            f"La langue source et la langue de sortie semblent identiques "
            f"(**{nom_cible}**). Choisissez une autre langue de sortie."
        )

    if st.button("Traduire le document", type="primary", disabled=meme_langue):
        cache = {}
        barre = st.progress(0.0)
        statut = st.empty()
        statut.write("Traduction en cours, merci de patienter…")

        try:
            source = io.BytesIO(donnees)
            if extension == "docx":
                resultat = traduire_docx(source, langue_source, langue_cible, barre, cache)
                nom_sortie = fichier_televerse.name.replace(".docx", f"_{langue_cible}.docx")
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif extension == "pptx":
                resultat = traduire_pptx(source, langue_source, langue_cible, barre, cache)
                nom_sortie = fichier_televerse.name.replace(".pptx", f"_{langue_cible}.pptx")
                mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            elif extension == "pdf":
                resultat = traduire_pdf(source, langue_source, langue_cible, barre, cache)
                nom_sortie = fichier_televerse.name.replace(".pdf", f"_{langue_cible}.pdf")
                mime = "application/pdf"
            else:
                st.error("Format non pris en charge.")
                resultat = None

            if resultat is not None:
                statut.success("Traduction terminée ✅")
                st.download_button(
                    "⬇️ Télécharger le document traduit",
                    data=resultat,
                    file_name=nom_sortie,
                    mime=mime,
                    type="primary",
                )
        except Exception as e:
            st.error(f"Une erreur est survenue pendant la traduction : {e}")
