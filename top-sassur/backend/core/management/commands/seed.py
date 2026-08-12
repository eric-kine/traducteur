"""Jeu de données initial : zones douloureuses, établissements, compte admin.

Idempotent : peut être relancé sans créer de doublons.
Usage : python manage.py seed
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import Etablissement, Zone

ZONES = [
    ("cou", "Cou", "Neurologie / Traumatologie", 1),
    ("epaule", "Épaule", "Orthopédie / Traumatologie", 2),
    ("omoplate", "Omoplate", "Orthopédie", 3),
    ("dos", "Dos", "Rhumatologie", 4),
    ("fesse", "Fesse", "Traumatologie", 5),
    ("hanche", "Hanche", "Orthopédie / Rhumatologie", 6),
    ("cuisse", "Cuisse", "Traumatologie", 7),
    ("genou", "Genou", "Orthopédie / Traumatologie", 8),
    ("jambe", "Jambe", "Traumatologie", 9),
    ("cheville", "Cheville", "Traumatologie", 10),
    ("pied", "Pied", "Orthopédie", 11),
]

ETABLISSEMENTS = [
    ("Hôpital Général de Douala", "HOPITAL", "Douala", "Rue de l'Hôpital, Akwa"),
    ("Hôpital Central de Yaoundé", "HOPITAL", "Yaoundé", "Avenue Henri Dunant"),
    ("Clinique de la Kiné Bonanjo", "CLINIQUE", "Douala", "Bonanjo"),
    ("Centre de Kinésithérapie Bastos", "CENTRE", "Yaoundé", "Quartier Bastos"),
    ("Clinique Régionale de Bafoussam", "CLINIQUE", "Bafoussam", "Centre-ville"),
]


class Command(BaseCommand):
    help = "Charge les données initiales de Top S'ASSUR"

    def handle(self, *args, **options):
        for code, libelle, specialite, ordre in ZONES:
            Zone.objects.update_or_create(
                code=code, defaults={"libelle": libelle, "specialite": specialite, "ordre": ordre}
            )
        self.stdout.write(self.style.SUCCESS(f"{len(ZONES)} zones chargées."))

        for nom, type_, ville, adresse in ETABLISSEMENTS:
            Etablissement.objects.update_or_create(
                nom=nom, defaults={"type": type_, "ville": ville, "adresse": adresse, "actif": True}
            )
        self.stdout.write(self.style.SUCCESS(f"{len(ETABLISSEMENTS)} établissements chargés."))

        User = get_user_model()
        username = os.environ.get("DJANGO_ADMIN_USER", "admin")
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "admin1234")
        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, email="", password=password)
            self.stdout.write(self.style.SUCCESS(f"Compte admin '{username}' créé."))
        else:
            self.stdout.write(f"Compte admin '{username}' déjà présent.")
