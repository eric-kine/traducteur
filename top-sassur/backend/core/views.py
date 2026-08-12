"""Vues API Top S'ASSUR."""

import logging
from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count
from django.http import FileResponse, Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from .models import Etablissement, Recu, RendezVous, Zone
from .pdf import construire_recu_pdf
from .permissions import LectureLibreEcritureAdmin
from .serializers import (
    EtablissementSerializer,
    RendezVousSerializer,
    ZoneSerializer,
)

audit = logging.getLogger("audit")

# Plage horaire d'ouverture pour la génération des créneaux (module 4).
HEURE_OUVERTURE = time(8, 0)
HEURE_FERMETURE = time(17, 0)
PAS_MINUTES = 30


class ZoneViewSet(viewsets.ReadOnlyModelViewSet):
    """Module 2 — liste des zones douloureuses (lecture seule, publique)."""

    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    permission_classes = [AllowAny]


class EtablissementViewSet(viewsets.ModelViewSet):
    """Module 3 — établissements partenaires ; CRUD réservé à l'administration."""

    serializer_class = EtablissementSerializer
    permission_classes = [LectureLibreEcritureAdmin]

    def get_queryset(self):
        qs = Etablissement.objects.all()
        # Le public ne voit que les partenaires actifs ; le staff voit tout.
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(actif=True)
        return qs

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def disponibilites(self, request, pk=None):
        """Créneaux libres d'un établissement pour une date donnée (?date=AAAA-MM-JJ)."""
        etab = self.get_object()
        date_str = request.query_params.get("date")
        if not date_str:
            return Response({"detail": "Paramètre 'date' requis (AAAA-MM-JJ)."}, status=400)
        try:
            jour = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Format de date invalide."}, status=400)

        pris = set(
            RendezVous.objects.filter(etablissement=etab, date_rdv=jour)
            .exclude(statut=RendezVous.Statut.ANNULE)
            .values_list("heure_rdv", flat=True)
        )

        creneaux = []
        curseur = datetime.combine(jour, HEURE_OUVERTURE)
        fin = datetime.combine(jour, HEURE_FERMETURE)
        while curseur < fin:
            h = curseur.time()
            creneaux.append({"heure": h.strftime("%H:%M"), "libre": h not in pris})
            curseur += timedelta(minutes=PAS_MINUTES)
        return Response({"date": date_str, "creneaux": creneaux})


class RendezVousViewSet(viewsets.ModelViewSet):
    """Module 4 & 5 — création de rendez-vous et validation (génération du reçu)."""

    serializer_class = RendezVousSerializer

    def get_queryset(self):
        # Le listing complet des rendez-vous est réservé à l'administration.
        return RendezVous.objects.select_related("zone", "etablissement", "recu")

    def get_permissions(self):
        if self.action in {"create", "valider"}:
            return [AllowAny()]
        if self.action == "retrieve":
            return [AllowAny()]  # consultable via sa référence unique
        return [IsAdminUser()]

    def get_object(self):
        # Permet de récupérer un RDV par sa référence (RDV-XXXXXX) ou son id.
        lookup = self.kwargs.get("pk", "")
        qs = self.get_queryset()
        if str(lookup).upper().startswith("RDV-"):
            obj = qs.filter(reference=lookup.upper()).first()
            if not obj:
                raise Http404
            return obj
        return super().get_object()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                rdv = serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "Ce créneau vient d'être réservé. Choisissez un autre horaire."},
                status=status.HTTP_409_CONFLICT,
            )
        audit.info("Création RDV %s (etab=%s)", rdv.reference, rdv.etablissement_id)
        return Response(self.get_serializer(rdv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """Bouton vert « Enregistrer » : confirme le RDV et génère le reçu PDF (module 5)."""
        rdv = self.get_object()
        if hasattr(rdv, "recu"):
            serializer = self.get_serializer(rdv)
            return Response(serializer.data)  # idempotent : reçu déjà émis

        montant = request.data.get("montant", 0) or 0
        with transaction.atomic():
            rdv.statut = RendezVous.Statut.CONFIRME
            rdv.save(update_fields=["statut"])
            numero = "REC-" + rdv.reference.replace("RDV-", "")
            recu = Recu(rendez_vous=rdv, numero=numero, montant=montant)
            recu.fichier = construire_recu_pdf(recu)
            recu.save()
        audit.info("Reçu %s généré pour %s", recu.numero, rdv.reference)
        return Response(self.get_serializer(rdv).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def telecharger_recu(request, numero):
    """Téléchargement du reçu PDF par son numéro (module 5)."""
    try:
        recu = Recu.objects.get(numero=numero)
    except Recu.DoesNotExist:
        raise Http404
    audit.info("Téléchargement reçu %s", recu.numero)
    return FileResponse(
        recu.fichier.open("rb"),
        as_attachment=True,
        filename=f"{recu.numero}.pdf",
        content_type="application/pdf",
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def statistiques(request):
    """Tableau de bord admin : indicateurs et reporting simples."""
    par_statut = dict(
        RendezVous.objects.values_list("statut").annotate(n=Count("id"))
    )
    par_etablissement = list(
        RendezVous.objects.values("etablissement__nom").annotate(n=Count("id")).order_by("-n")[:10]
    )
    par_zone = list(
        RendezVous.objects.values("zone__libelle").annotate(n=Count("id")).order_by("-n")
    )
    return Response(
        {
            "total_rdv": RendezVous.objects.count(),
            "total_recus": Recu.objects.count(),
            "etablissements_actifs": Etablissement.objects.filter(actif=True).count(),
            "rdv_par_statut": par_statut,
            "top_etablissements": par_etablissement,
            "rdv_par_zone": par_zone,
        }
    )
