"""Modèle de données Top S'ASSUR (5 modules fonctionnels)."""

import uuid

from django.db import models

from .fields import EncryptedCharField


def _reference_courte():
    """Référence lisible et unique pour un rendez-vous (ex. RDV-4F9A2C)."""
    return "RDV-" + uuid.uuid4().hex[:6].upper()


class Zone(models.Model):
    """Zone douloureuse sélectionnable (module 2). Table de référence."""

    code = models.SlugField(unique=True)
    libelle = models.CharField(max_length=80)
    # Spécialité kiné rattachée (neurologie, traumatologie, rhumatologie, ...).
    specialite = models.CharField(max_length=60, blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "libelle"]

    def __str__(self):
        return self.libelle


class Etablissement(models.Model):
    """Hôpital ou clinique partenaire (module 3). Géré par l'administration."""

    class Type(models.TextChoices):
        HOPITAL = "HOPITAL", "Hôpital"
        CLINIQUE = "CLINIQUE", "Clinique"
        CENTRE = "CENTRE", "Centre de kinésithérapie"

    nom = models.CharField(max_length=150)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.CLINIQUE)
    ville = models.CharField(max_length=80)
    adresse = models.CharField(max_length=200, blank=True)
    telephone = models.CharField(max_length=40, blank=True)
    actif = models.BooleanField(default=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ville", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.ville})"


class RendezVous(models.Model):
    """Rendez-vous patient (module 4). Le patient n'a pas besoin de compte."""

    class Statut(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        CONFIRME = "CONFIRME", "Confirmé"
        ANNULE = "ANNULE", "Annulé"

    reference = models.CharField(max_length=20, unique=True, default=_reference_courte, editable=False)

    # Données patient minimisées ; le téléphone (donnée sensible) est chiffré au repos.
    patient_nom = models.CharField(max_length=80)
    patient_prenom = models.CharField(max_length=80)
    patient_telephone = EncryptedCharField(max_length=255, blank=True)

    zone = models.ForeignKey(Zone, on_delete=models.PROTECT, related_name="rendez_vous")
    etablissement = models.ForeignKey(Etablissement, on_delete=models.PROTECT, related_name="rendez_vous")

    date_rdv = models.DateField()
    heure_rdv = models.TimeField()
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)

    consentement_donnees = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
        constraints = [
            # Un créneau (établissement + date + heure) ne peut être réservé qu'une fois.
            models.UniqueConstraint(
                fields=["etablissement", "date_rdv", "heure_rdv"],
                condition=~models.Q(statut="ANNULE"),
                name="creneau_unique_par_etablissement",
            )
        ]

    def __str__(self):
        return f"{self.reference} — {self.patient_nom} {self.patient_prenom}"


class Recu(models.Model):
    """Reçu officiel généré à la validation (module 5)."""

    rendez_vous = models.OneToOneField(RendezVous, on_delete=models.CASCADE, related_name="recu")
    numero = models.CharField(max_length=30, unique=True)
    montant = models.DecimalField(max_digits=10, decimal_places=0, default=0)  # FCFA
    devise = models.CharField(max_length=8, default="FCFA")
    fichier = models.FileField(upload_to="recus/")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero
