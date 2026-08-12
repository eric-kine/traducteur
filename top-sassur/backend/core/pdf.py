"""Génération du reçu officiel PDF (module 5) avec ReportLab."""

import io
from datetime import datetime

from django.core.files.base import ContentFile
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

VERT = colors.HexColor("#0F9D58")
GRIS = colors.HexColor("#5F6368")
NOIR = colors.HexColor("#202124")


def _ligne(c, x, y, label, valeur):
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 10)
    c.drawString(x, y, label)
    c.setFillColor(NOIR)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 55 * mm, y, str(valeur))


def construire_recu_pdf(recu):
    """Retourne un ContentFile PDF prêt à enregistrer dans recu.fichier."""
    rdv = recu.rendez_vous
    tampon = io.BytesIO()
    c = canvas.Canvas(tampon, pagesize=A4)
    largeur, hauteur = A4

    # Bandeau
    c.setFillColor(VERT)
    c.rect(0, hauteur - 40 * mm, largeur, 40 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20 * mm, hauteur - 22 * mm, "Top S'ASSUR")
    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, hauteur - 30 * mm, "Reçu de prise en charge — Kinésithérapie")

    # Bloc numéro / date
    c.setFillColor(NOIR)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(20 * mm, hauteur - 55 * mm, f"Reçu N° {recu.numero}")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 10)
    emis_le = recu.cree_le if recu.pk else datetime.now()
    c.drawString(20 * mm, hauteur - 61 * mm, f"Émis le {emis_le.strftime('%d/%m/%Y à %H:%M')}")

    # Détails
    y = hauteur - 80 * mm
    saut = 12 * mm
    _ligne(c, 20 * mm, y, "Référence RDV", rdv.reference); y -= saut
    _ligne(c, 20 * mm, y, "Patient", f"{rdv.patient_nom} {rdv.patient_prenom}"); y -= saut
    _ligne(c, 20 * mm, y, "Zone concernée", rdv.zone.libelle); y -= saut
    _ligne(c, 20 * mm, y, "Établissement", rdv.etablissement.nom); y -= saut
    _ligne(c, 20 * mm, y, "Ville", rdv.etablissement.ville); y -= saut
    _ligne(c, 20 * mm, y, "Date du rendez-vous", rdv.date_rdv.strftime("%d/%m/%Y")); y -= saut
    _ligne(c, 20 * mm, y, "Heure", rdv.heure_rdv.strftime("%H:%M")); y -= saut
    _ligne(c, 20 * mm, y, "Montant", f"{recu.montant:.0f} {recu.devise}"); y -= saut

    # Cadre montant
    c.setStrokeColor(VERT)
    c.setLineWidth(1.2)
    c.roundRect(20 * mm, y - 6 * mm, largeur - 40 * mm, 3 * mm, 1 * mm, stroke=1, fill=0)

    # Pied de page / mention légale
    c.setFillColor(GRIS)
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(
        20 * mm, 22 * mm,
        "Document généré automatiquement par Top S'ASSUR. Conservez-le comme justificatif de prise en charge.",
    )
    c.drawString(
        20 * mm, 17 * mm,
        "Ce reçu ne constitue pas une facture fiscale. Toute donnée personnelle est traitée de façon confidentielle.",
    )

    c.showPage()
    c.save()
    tampon.seek(0)
    return ContentFile(tampon.read(), name=f"{recu.numero}.pdf")
