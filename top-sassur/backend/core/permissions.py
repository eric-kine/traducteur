from rest_framework.permissions import SAFE_METHODS, BasePermission


class LectureLibreEcritureAdmin(BasePermission):
    """Lecture ouverte à tous ; création/modification/suppression réservées au staff.

    Utilisé pour les établissements : la liste est publique (choix du patient),
    mais seule l'administration ajoute/retire des partenaires (module 3).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)
