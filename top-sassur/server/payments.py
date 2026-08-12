"""Couche de paiement — abstraction multi-fournisseurs.

Deux fournisseurs sont fournis :

- ``sandbox`` (par défaut) : simule un paiement réussi, sans réseau ni compte.
  Idéal pour tester toute l'application de bout en bout immédiatement.

- ``campay`` : intégration réelle avec l'agrégateur Campay (https://campay.net),
  très utilisé au Cameroun car il couvre à la fois **Orange Money** et
  **MTN Mobile Money**. Le client reçoit une demande de paiement (USSD/push) sur
  son téléphone et valide avec son code PIN. Activez-le en renseignant les
  variables d'environnement CAMPAY_* (voir .env.example).

Le fournisseur est choisi via la variable d'environnement ``PAYMENT_PROVIDER``.

Pour le paiement par carte (MasterCard), branchez un PSP carte (Stripe, ou l'API
carte de l'agrégateur) sur le même modèle ; il reste en sandbox par défaut ici.
"""
from __future__ import annotations

import os
import time
import uuid

import requests


class PaymentError(Exception):
    pass


def _provider() -> str:
    return os.environ.get("PAYMENT_PROVIDER", "sandbox").lower()


def initiate_payment(*, method: str, amount: int, phone: str, description: str) -> dict:
    """Lance un paiement. Retourne un dict :
    { 'status': 'success'|'pending'|'failed', 'provider': str,
      'reference': str, 'message': str }.
    """
    provider = _provider()
    if provider == "campay" and method in ("om", "momo"):
        return _campay_collect(amount=amount, phone=phone, description=description)
    # défaut : sandbox (et carte non branchée -> sandbox)
    return _sandbox(method=method, amount=amount)


def confirm_payment(reference: str) -> dict:
    """Vérifie l'état d'un paiement (utile pour les paiements 'pending')."""
    provider = _provider()
    if provider == "campay":
        return _campay_status(reference)
    return {"status": "success", "provider": "sandbox", "reference": reference,
            "message": "Paiement simulé confirmé."}


# --------------------------------------------------------------------------- #
# Sandbox
# --------------------------------------------------------------------------- #
def _sandbox(*, method: str, amount: int) -> dict:
    return {
        "status": "success",
        "provider": "sandbox",
        "reference": "SBX-" + uuid.uuid4().hex[:10].upper(),
        "message": f"Paiement simulé de {amount} FCFA via {method} accepté.",
    }


# --------------------------------------------------------------------------- #
# Campay (Orange Money + MTN MoMo au Cameroun)
# --------------------------------------------------------------------------- #
_CAMPAY_BASE = os.environ.get("CAMPAY_BASE_URL", "https://api.campay.net")


def _campay_token() -> str:
    user = os.environ.get("CAMPAY_USERNAME")
    pwd = os.environ.get("CAMPAY_PASSWORD")
    if not user or not pwd:
        raise PaymentError("Identifiants Campay manquants (CAMPAY_USERNAME/PASSWORD).")
    r = requests.post(f"{_CAMPAY_BASE}/api/token/",
                      json={"username": user, "password": pwd}, timeout=20)
    r.raise_for_status()
    return r.json()["token"]


def _norm_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("237"):
        return digits
    return "237" + digits[-9:]


def _campay_collect(*, amount: int, phone: str, description: str) -> dict:
    token = _campay_token()
    r = requests.post(
        f"{_CAMPAY_BASE}/api/collect/",
        headers={"Authorization": f"Token {token}"},
        json={
            "amount": str(amount),
            "currency": "XAF",
            "from": _norm_phone(phone),
            "description": description[:100],
        },
        timeout=30,
    )
    r.raise_for_status()
    ref = r.json().get("reference")
    if not ref:
        raise PaymentError("Réponse Campay invalide (référence absente).")
    # Le paiement est asynchrone : le client valide sur son téléphone.
    return {"status": "pending", "provider": "campay", "reference": ref,
            "message": "Confirmez le paiement sur votre téléphone (code PIN Mobile Money)."}


def _campay_status(reference: str) -> dict:
    token = _campay_token()
    r = requests.get(f"{_CAMPAY_BASE}/api/transaction/{reference}/",
                     headers={"Authorization": f"Token {token}"}, timeout=20)
    r.raise_for_status()
    status = (r.json().get("status") or "").upper()
    mapped = {"SUCCESSFUL": "success", "FAILED": "failed"}.get(status, "pending")
    return {"status": mapped, "provider": "campay", "reference": reference,
            "message": f"État Campay : {status}"}
