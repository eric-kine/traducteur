"""
Champ de modèle chiffré au repos.

Les données patient sensibles (ex. numéro de téléphone) sont chiffrées avant
d'être écrites en base, avec Fernet (AES-128 en CBC + HMAC). La clé provient
de settings.FIELD_ENCRYPTION_KEY. Ainsi, une fuite du dump SQL n'expose pas
les identifiants directs des patients.
"""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

_PREFIXE = "enc:"


def _fernet():
    return Fernet(settings.FIELD_ENCRYPTION_KEY)


class EncryptedCharField(models.CharField):
    """CharField dont la valeur est chiffrée en base et déchiffrée en mémoire."""

    description = "Chaîne chiffrée au repos"

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        if isinstance(value, str) and value.startswith(_PREFIXE):
            return value  # déjà chiffré
        jeton = _fernet().encrypt(value.encode()).decode()
        return _PREFIXE + jeton

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        if not value.startswith(_PREFIXE):
            return value  # valeur historique non chiffrée
        try:
            return _fernet().decrypt(value[len(_PREFIXE):].encode()).decode()
        except InvalidToken:
            return ""
