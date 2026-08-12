from rest_framework import serializers

from .models import Etablissement, Recu, RendezVous, Zone


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = ["id", "code", "libelle", "specialite", "ordre"]


class EtablissementSerializer(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Etablissement
        fields = ["id", "nom", "type", "type_libelle", "ville", "adresse", "telephone", "actif", "cree_le"]
        read_only_fields = ["cree_le"]


class RecuSerializer(serializers.ModelSerializer):
    url_telechargement = serializers.SerializerMethodField()

    class Meta:
        model = Recu
        fields = ["numero", "montant", "devise", "cree_le", "url_telechargement"]

    def get_url_telechargement(self, obj):
        return f"/api/recus/{obj.numero}/telecharger/"


class RendezVousSerializer(serializers.ModelSerializer):
    zone_libelle = serializers.CharField(source="zone.libelle", read_only=True)
    etablissement_nom = serializers.CharField(source="etablissement.nom", read_only=True)
    recu = RecuSerializer(read_only=True)

    class Meta:
        model = RendezVous
        fields = [
            "id", "reference", "patient_nom", "patient_prenom", "patient_telephone",
            "zone", "zone_libelle", "etablissement", "etablissement_nom",
            "date_rdv", "heure_rdv", "statut", "consentement_donnees", "cree_le", "recu",
        ]
        read_only_fields = ["reference", "statut", "cree_le"]
        # Le téléphone est accepté en écriture mais jamais renvoyé en clair par l'API publique.
        extra_kwargs = {"patient_telephone": {"write_only": True}}

    def validate_consentement_donnees(self, valeur):
        if not valeur:
            raise serializers.ValidationError(
                "Le consentement au traitement des données est requis pour prendre rendez-vous."
            )
        return valeur

    def validate(self, data):
        etab = data.get("etablissement")
        date_rdv = data.get("date_rdv")
        heure_rdv = data.get("heure_rdv")
        deja_pris = (
            RendezVous.objects.filter(
                etablissement=etab, date_rdv=date_rdv, heure_rdv=heure_rdv
            )
            .exclude(statut=RendezVous.Statut.ANNULE)
            .exists()
        )
        if deja_pris:
            raise serializers.ValidationError("Ce créneau est déjà réservé. Choisissez un autre horaire.")
        return data
