from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()
router.register("zones", views.ZoneViewSet, basename="zone")
router.register("etablissements", views.EtablissementViewSet, basename="etablissement")
router.register("rendez-vous", views.RendezVousViewSet, basename="rendezvous")

urlpatterns = [
    path("", include(router.urls)),
    path("recus/<str:numero>/telecharger/", views.telecharger_recu, name="telecharger-recu"),
    path("admin/statistiques/", views.statistiques, name="statistiques"),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
