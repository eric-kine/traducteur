from django.contrib import admin

from .models import Etablissement, Recu, RendezVous, Zone


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("libelle", "code", "specialite", "ordre")
    ordering = ("ordre",)


@admin.register(Etablissement)
class EtablissementAdmin(admin.ModelAdmin):
    list_display = ("nom", "type", "ville", "actif", "cree_le")
    list_filter = ("type", "actif", "ville")
    search_fields = ("nom", "ville")


@admin.register(RendezVous)
class RendezVousAdmin(admin.ModelAdmin):
    list_display = ("reference", "patient_nom", "patient_prenom", "etablissement", "date_rdv", "heure_rdv", "statut")
    list_filter = ("statut", "etablissement", "date_rdv")
    search_fields = ("reference", "patient_nom", "patient_prenom")
    readonly_fields = ("reference", "cree_le")


@admin.register(Recu)
class RecuAdmin(admin.ModelAdmin):
    list_display = ("numero", "rendez_vous", "montant", "devise", "cree_le")
    search_fields = ("numero",)
