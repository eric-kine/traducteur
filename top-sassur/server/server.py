"""Top S'ASSUR — serveur d'application (Flask + SQLite).

Sert l'interface web ET l'API. Les données (patients, établissements,
rendez-vous, paiements) sont stockées côté serveur : elles sont donc partagées
entre tous les appareils, contrairement à la démo hors-ligne.

Lancement :
    python server.py
puis ouvrez http://localhost:5000
"""
from __future__ import annotations

import datetime as dt
import functools
import json
import os
import sqlite3
import uuid

import jwt
from flask import Flask, g, jsonify, request, send_from_directory, Response
from werkzeug.security import check_password_hash, generate_password_hash

import payments
from pdf_receipt import build_receipt_pdf

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.join(BASE_DIR, "webapp")
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "topsassur.db"))
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
HOME_FEE = int(os.environ.get("HOME_FEE", "3000"))
TOKEN_TTL_HOURS = int(os.environ.get("TOKEN_TTL_HOURS", "168"))  # 7 jours

app = Flask(__name__, static_folder=None)

ZONES = {
    "cou": ("Cou", "Neck"), "epaule": ("Épaule", "Shoulder"), "dos": ("Dos", "Back"),
    "fesse": ("Fesse", "Buttock"), "hanche": ("Hanche", "Hip"), "cuisse": ("Cuisse", "Thigh"),
    "genou": ("Genou", "Knee"), "jambe": ("Jambe", "Leg"), "cheville": ("Cheville", "Ankle"),
    "pied": ("Pied", "Foot"),
}
DEFAULT_FACILITIES = [
    ("Clinique de la Cité Verte", "Yaoundé", 5000),
    ("Hôpital Général de Douala", "Douala", 6000),
    ("Centre de Kiné Bonapriso", "Douala", 5500),
    ("Polyclinique Bonanjo", "Douala", 7000),
    ("Clinique Odyssée", "Yaoundé", 6500),
    ("Hôpital de District de Bafoussam", "Bafoussam", 4500),
]


# --------------------------------------------------------------------------- #
# Base de données
# --------------------------------------------------------------------------- #
def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    con = sqlite3.connect(DB_PATH)
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            pw_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS facilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, city TEXT NOT NULL, price INTEGER NOT NULL,
            active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref TEXT NOT NULL UNIQUE,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            zones TEXT NOT NULL, wellness INTEGER NOT NULL DEFAULT 0,
            facility_id INTEGER REFERENCES facilities(id),
            date TEXT NOT NULL, time TEXT NOT NULL,
            homecare INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_payment',
            verify_token TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id INTEGER NOT NULL REFERENCES appointments(id),
            method TEXT NOT NULL, provider TEXT, provider_ref TEXT,
            amount INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
        );
        """
    )
    # Migration : ajoute verify_token aux bases créées avant cette fonctionnalité.
    cols = {r[1] for r in con.execute("PRAGMA table_info(appointments)").fetchall()}
    if "verify_token" not in cols:
        con.execute("ALTER TABLE appointments ADD COLUMN verify_token TEXT")
    # Créneau unique par établissement : un même établissement ne peut avoir deux
    # rendez-vous « actifs » (en attente de paiement ou payés) à la même date/heure.
    # Les soins à domicile (homecare=1) n'occupent pas de créneau d'établissement.
    con.execute(
        """CREATE UNIQUE INDEX IF NOT EXISTS ux_facility_slot
           ON appointments (facility_id, date, time)
           WHERE homecare = 0 AND status IN ('pending_payment', 'paid')"""
    )
    # seed facilities
    if con.execute("SELECT COUNT(*) FROM facilities").fetchone()[0] == 0:
        now = dt.datetime.utcnow().isoformat()
        con.executemany(
            "INSERT INTO facilities (name, city, price, active, created_at) VALUES (?,?,?,1,?)",
            [(n, c, p, now) for (n, c, p) in DEFAULT_FACILITIES],
        )
    con.commit()
    con.close()


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
def make_token(sub: str, role: str) -> str:
    payload = {
        "sub": str(sub), "role": role,
        "exp": dt.datetime.now(tz=dt.timezone.utc) + dt.timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def _identity():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        return jwt.decode(auth[7:], SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def require_patient(fn):
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        ident = _identity()
        if not ident or ident.get("role") != "patient":
            return jsonify(error="Authentification requise."), 401
        g.patient_id = int(ident["sub"])
        return fn(*a, **kw)
    return wrapper


def require_admin(fn):
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        ident = _identity()
        if not ident or ident.get("role") != "admin":
            return jsonify(error="Accès administrateur requis."), 401
        return fn(*a, **kw)
    return wrapper


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def zone_label(zid: str, lang: str) -> str:
    z = ZONES.get(zid)
    return (z[1] if lang == "en" else z[0]) if z else zid


def fmt_fcfa(n: int) -> str:
    return f"{n:,}".replace(",", " ") + " FCFA"


def public_base_url() -> str:
    """URL publique de base, pour que le QR code du reçu soit scannable depuis un
    téléphone. Priorité à PUBLIC_BASE_URL (déploiement), sinon l'hôte de la requête."""
    env = os.environ.get("PUBLIC_BASE_URL")
    if env:
        return env.rstrip("/")
    return request.url_root.rstrip("/")


def slot_taken(db: sqlite3.Connection, facility_id: int, date: str, time: str) -> bool:
    """Un créneau d'établissement est-il déjà occupé (RDV en attente ou payé) ?"""
    return db.execute(
        """SELECT 1 FROM appointments
           WHERE facility_id=? AND date=? AND time=? AND homecare=0
             AND status IN ('pending_payment', 'paid') LIMIT 1""",
        (facility_id, date, time),
    ).fetchone() is not None


def appointment_json(row: sqlite3.Row, lang: str = "fr") -> dict:
    zones = json.loads(row["zones"])
    fac = None
    if row["facility_id"]:
        f = get_db().execute("SELECT name, city FROM facilities WHERE id=?",
                             (row["facility_id"],)).fetchone()
        if f:
            fac = {"name": f["name"], "city": f["city"]}
    return {
        "id": row["id"], "ref": row["ref"], "zones": zones,
        "zoneLabels": [zone_label(z, lang) for z in zones],
        "wellness": bool(row["wellness"]), "facility": fac,
        "date": row["date"], "time": row["time"],
        "homecare": bool(row["homecare"]), "total": row["total"],
        "status": row["status"], "createdAt": row["created_at"],
    }


# --------------------------------------------------------------------------- #
# Routes — auth
# --------------------------------------------------------------------------- #
@app.post("/api/auth/register")
def register():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    phone = (d.get("phone") or "").strip()
    pw = d.get("password") or ""
    if len(name) < 2 or len(phone) < 8 or len(pw) < 6:
        return jsonify(error="Nom, téléphone (8+ chiffres) et mot de passe (6+ caractères) requis."), 400
    db = get_db()
    if db.execute("SELECT 1 FROM patients WHERE phone=?", (phone,)).fetchone():
        return jsonify(error="Ce numéro est déjà inscrit."), 409
    cur = db.execute(
        "INSERT INTO patients (name, phone, pw_hash, created_at) VALUES (?,?,?,?)",
        (name, phone, generate_password_hash(pw), dt.datetime.utcnow().isoformat()),
    )
    db.commit()
    pid = cur.lastrowid
    return jsonify(token=make_token(pid, "patient"),
                   patient={"id": pid, "name": name, "phone": phone})


@app.post("/api/auth/login")
def login():
    d = request.get_json(silent=True) or {}
    phone = (d.get("phone") or "").strip()
    pw = d.get("password") or ""
    row = get_db().execute("SELECT * FROM patients WHERE phone=?", (phone,)).fetchone()
    if not row or not check_password_hash(row["pw_hash"], pw):
        return jsonify(error="Numéro ou mot de passe incorrect."), 401
    return jsonify(token=make_token(row["id"], "patient"),
                   patient={"id": row["id"], "name": row["name"], "phone": row["phone"]})


@app.post("/api/admin/login")
def admin_login():
    d = request.get_json(silent=True) or {}
    if d.get("username") == ADMIN_USERNAME and d.get("password") == ADMIN_PASSWORD:
        return jsonify(token=make_token("admin", "admin"))
    return jsonify(error="Identifiants administrateur incorrects."), 401


# --------------------------------------------------------------------------- #
# Routes — facilities
# --------------------------------------------------------------------------- #
@app.get("/api/facilities")
def list_facilities():
    rows = get_db().execute(
        "SELECT id, name, city, price FROM facilities WHERE active=1 ORDER BY city, name"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/facilities/<int:fid>/slots")
def facility_slots(fid: int):
    """Créneaux déjà pris pour un établissement à une date donnée, afin que le
    frontend puisse les griser et empêcher toute double réservation."""
    date = (request.args.get("date") or "").strip()
    if not date:
        return jsonify(taken=[])
    rows = get_db().execute(
        """SELECT time FROM appointments
           WHERE facility_id=? AND date=? AND homecare=0
             AND status IN ('pending_payment', 'paid')""",
        (fid, date),
    ).fetchall()
    return jsonify(taken=[r["time"] for r in rows])


@app.post("/api/admin/facilities")
@require_admin
def add_facility():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    city = (d.get("city") or "").strip()
    try:
        price = int(d.get("price"))
    except (TypeError, ValueError):
        price = 0
    if not name or not city or price <= 0:
        return jsonify(error="Nom, ville et tarif (> 0) requis."), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO facilities (name, city, price, active, created_at) VALUES (?,?,?,1,?)",
        (name, city, price, dt.datetime.utcnow().isoformat()),
    )
    db.commit()
    return jsonify(id=cur.lastrowid, name=name, city=city, price=price)


@app.delete("/api/admin/facilities/<int:fid>")
@require_admin
def del_facility(fid: int):
    db = get_db()
    db.execute("UPDATE facilities SET active=0 WHERE id=?", (fid,))
    db.commit()
    return jsonify(ok=True)


# --------------------------------------------------------------------------- #
# Routes — appointments
# --------------------------------------------------------------------------- #
@app.post("/api/appointments")
@require_patient
def create_appointment():
    d = request.get_json(silent=True) or {}
    zones = [z for z in (d.get("zones") or []) if z in ZONES]
    wellness = bool(d.get("wellness"))
    if not zones and not wellness:
        return jsonify(error="Sélectionnez au moins une zone ou le bien-être."), 400
    date = (d.get("date") or "").strip()
    time = (d.get("time") or "").strip()
    if not date or not time:
        return jsonify(error="Date et heure requises."), 400
    db = get_db()
    fac = db.execute("SELECT * FROM facilities WHERE id=? AND active=1",
                     (d.get("facility_id"),)).fetchone()
    if not fac:
        return jsonify(error="Établissement invalide."), 400
    homecare = bool(d.get("homecare"))
    # Blocage des doubles réservations : un créneau d'établissement (hors domicile)
    # déjà pris — en attente de paiement ou payé — ne peut être réservé à nouveau.
    if not homecare and slot_taken(db, fac["id"], date, time):
        return jsonify(error="Ce créneau vient d'être réservé. Choisissez une autre heure."), 409
    total = fac["price"] + (HOME_FEE if homecare else 0)
    ref = "TS-" + uuid.uuid4().hex[:6].upper()
    verify_token = uuid.uuid4().hex
    try:
        cur = db.execute(
            """INSERT INTO appointments
               (ref, patient_id, zones, wellness, facility_id, date, time, homecare, total, status, verify_token, created_at)
               VALUES (?,?,?,?,?,?,?,?,?, 'pending_payment', ?, ?)""",
            (ref, g.patient_id, json.dumps(zones), int(wellness), fac["id"], date, time,
             int(homecare), total, verify_token, dt.datetime.utcnow().isoformat()),
        )
    except sqlite3.IntegrityError:
        # L'index unique a bloqué une réservation concurrente sur le même créneau.
        return jsonify(error="Ce créneau vient d'être réservé. Choisissez une autre heure."), 409
    db.commit()
    row = db.execute("SELECT * FROM appointments WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(appointment_json(row))


@app.get("/api/appointments")
@require_patient
def my_appointments():
    lang = request.args.get("lang", "fr")
    rows = get_db().execute(
        "SELECT * FROM appointments WHERE patient_id=? ORDER BY id DESC", (g.patient_id,)
    ).fetchall()
    return jsonify([appointment_json(r, lang) for r in rows])


@app.get("/api/appointments/<int:aid>/receipt.pdf")
@require_patient
def receipt_pdf(aid: int):
    lang = request.args.get("lang", "fr")
    row = get_db().execute(
        "SELECT * FROM appointments WHERE id=? AND patient_id=?", (aid, g.patient_id)
    ).fetchone()
    if not row:
        return jsonify(error="Rendez-vous introuvable."), 404
    if row["status"] != "paid":
        return jsonify(error="Reçu disponible après paiement."), 402
    # Jeton de vérification : généré rétroactivement pour les anciens rendez-vous.
    token = row["verify_token"]
    if not token:
        token = uuid.uuid4().hex
        db = get_db()
        db.execute("UPDATE appointments SET verify_token=? WHERE id=?", (token, aid))
        db.commit()
    ap = appointment_json(row, lang)
    pat = get_db().execute("SELECT name FROM patients WHERE id=?", (g.patient_id,)).fetchone()
    en = lang == "en"
    zones_txt = ", ".join(ap["zoneLabels"]) if ap["zones"] else (
        ("Body wellness" if en else "Bien-être corporel") if ap["wellness"] else "-")
    rows = [
        ("Reference" if en else "Référence", ap["ref"]),
        ("Patient", pat["name"] if pat else "-"),
        ("Areas / care" if en else "Zones / soins", zones_txt),
        ("Facility" if en else "Établissement",
         f'{ap["facility"]["name"]} - {ap["facility"]["city"]}' if ap["facility"] else "-"),
        ("Date", f'{ap["date"]} - {ap["time"]}'),
        ("Home care" if en else "Soins à domicile",
         ("Yes" if en else "Oui") if ap["homecare"] else ("No" if en else "Non")),
    ]
    verify_url = f"{public_base_url()}/verify/{token}"
    pdf = build_receipt_pdf(
        brand="Top S'ASSUR",
        subtitle="Official care receipt" if en else "Reçu officiel de prise en charge",
        rows=rows,
        total_label="Total due" if en else "Total à payer",
        total_value=fmt_fcfa(ap["total"]),
        footer_lines=[
            "Present this at the facility on the day of your appointment."
            if en else "À présenter à l'accueil de l'établissement le jour du rendez-vous.",
            dt.datetime.fromisoformat(ap["createdAt"]).strftime("%d/%m/%Y %H:%M"),
            ("Scan the QR code to verify this receipt: " if en
             else "Scannez le QR code pour vérifier ce reçu : ") + verify_url,
        ],
        qr_url=verify_url,
        qr_caption="Verify" if en else "Vérifier",
    )
    return Response(pdf, mimetype="application/pdf", headers={
        "Content-Disposition": f'inline; filename="recu-top-sassur-{ap["ref"]}.pdf"'
    })


# --------------------------------------------------------------------------- #
# Routes — payments
# --------------------------------------------------------------------------- #
def _notify(db, patient_id, title, body):
    db.execute(
        "INSERT INTO notifications (patient_id, title, body, created_at) VALUES (?,?,?,?)",
        (patient_id, title, body, dt.datetime.utcnow().isoformat()),
    )


def _finalize_paid(db, appt):
    db.execute("UPDATE appointments SET status='paid' WHERE id=?", (appt["id"],))
    fac = db.execute("SELECT name FROM facilities WHERE id=?", (appt["facility_id"],)).fetchone()
    _notify(db, appt["patient_id"], "Rappel : RDV kiné",
            f'{fac["name"] if fac else ""} — {appt["date"]} {appt["time"]}')
    _notify(db, appt["patient_id"], "Suivi de vos soins",
            "Comment évoluent vos douleurs ? Notez votre suivi.")


@app.post("/api/payments")
@require_patient
def pay():
    d = request.get_json(silent=True) or {}
    appt = get_db().execute(
        "SELECT * FROM appointments WHERE id=? AND patient_id=?",
        (d.get("appointment_id"), g.patient_id),
    ).fetchone()
    if not appt:
        return jsonify(error="Rendez-vous introuvable."), 404
    if appt["status"] == "paid":
        return jsonify(error="Ce rendez-vous est déjà payé."), 409
    method = d.get("method")
    if method not in ("om", "momo", "mc"):
        return jsonify(error="Mode de paiement invalide."), 400
    phone = (d.get("phone") or "").strip()
    try:
        res = payments.initiate_payment(
            method=method, amount=appt["total"], phone=phone,
            description=f'Top S\'ASSUR {appt["ref"]}')
    except Exception as e:  # provider / réseau
        return jsonify(error=f"Échec du paiement : {e}"), 502
    db = get_db()
    cur = db.execute(
        """INSERT INTO payments (appointment_id, method, provider, provider_ref, amount, status, created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (appt["id"], method, res["provider"], res.get("reference"), appt["total"],
         res["status"], dt.datetime.utcnow().isoformat()),
    )
    if res["status"] == "success":
        _finalize_paid(db, appt)
    db.commit()
    return jsonify(payment_id=cur.lastrowid, status=res["status"],
                   message=res.get("message", ""), appointment_id=appt["id"])


@app.get("/api/payments/<int:pid>/status")
@require_patient
def payment_status(pid: int):
    db = get_db()
    p = db.execute(
        """SELECT p.* FROM payments p JOIN appointments a ON a.id=p.appointment_id
           WHERE p.id=? AND a.patient_id=?""", (pid, g.patient_id)).fetchone()
    if not p:
        return jsonify(error="Paiement introuvable."), 404
    if p["status"] == "success":
        return jsonify(status="success")
    res = payments.confirm_payment(p["provider_ref"])
    if res["status"] != p["status"]:
        db.execute("UPDATE payments SET status=? WHERE id=?", (res["status"], pid))
        if res["status"] == "success":
            appt = db.execute("SELECT * FROM appointments WHERE id=?",
                              (p["appointment_id"],)).fetchone()
            _finalize_paid(db, appt)
        db.commit()
    return jsonify(status=res["status"], message=res.get("message", ""))


# --------------------------------------------------------------------------- #
# Routes — notifications
# --------------------------------------------------------------------------- #
@app.get("/api/notifications")
@require_patient
def list_notifications():
    rows = get_db().execute(
        "SELECT title, body, created_at FROM notifications WHERE patient_id=? ORDER BY id DESC LIMIT 20",
        (g.patient_id,),
    ).fetchall()
    return jsonify([{"title": r["title"], "body": r["body"], "at": r["created_at"]} for r in rows])


# --------------------------------------------------------------------------- #
# Routes — admin
# --------------------------------------------------------------------------- #
@app.get("/api/admin/stats")
@require_admin
def admin_stats():
    db = get_db()
    paid = "status='paid'"
    appts = db.execute(f"SELECT COUNT(*) c FROM appointments WHERE {paid}").fetchone()["c"]
    revenue = db.execute(f"SELECT COALESCE(SUM(total),0) s FROM appointments WHERE {paid}").fetchone()["s"]
    partners = db.execute("SELECT COUNT(*) c FROM facilities WHERE active=1").fetchone()["c"]
    home = db.execute(f"SELECT COUNT(*) c FROM appointments WHERE homecare=1 AND {paid}").fetchone()["c"]
    patients = db.execute("SELECT COUNT(*) c FROM patients").fetchone()["c"]
    return jsonify(appointments=appts, revenue=revenue, partners=partners,
                   homecare=home, patients=patients)


@app.get("/api/admin/appointments")
@require_admin
def admin_appointments():
    rows = get_db().execute("SELECT * FROM appointments ORDER BY id DESC LIMIT 200").fetchall()
    return jsonify([appointment_json(r) for r in rows])


@app.get("/api/admin/payments")
@require_admin
def admin_payments():
    rows = get_db().execute(
        """SELECT p.id, p.method, p.provider, p.amount, p.status, p.created_at, a.ref, a.date
           FROM payments p JOIN appointments a ON a.id=p.appointment_id
           ORDER BY p.id DESC LIMIT 200""").fetchall()
    return jsonify([dict(r) for r in rows])


# --------------------------------------------------------------------------- #
# Vérification publique d'un reçu (cible du QR code)
# --------------------------------------------------------------------------- #
def _verify_page(title: str, valid: bool, lines: list[tuple[str, str]], note: str) -> str:
    badge = ("✓ " + ("Reçu authentique" if valid else "")) if valid else "✗ Reçu introuvable"
    color = "#1f7a34" if valid else "#b3261e"
    rows = "".join(
        f'<div class="row"><span>{k}</span><strong>{v}</strong></div>' for k, v in lines
    )
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Top S'ASSUR</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #f2f7f3; color: #14231a; margin: 0; padding: 2rem 1rem; }}
  .card {{ max-width: 440px; margin: 2rem auto; background: #fff; border-radius: 18px;
    box-shadow: 0 12px 40px rgba(20,60,35,.12); overflow: hidden; }}
  .head {{ background: {color}; color: #fff; padding: 1.4rem 1.6rem; }}
  .head h1 {{ font-size: 1.05rem; margin: 0 0 .3rem; letter-spacing: .04em; }}
  .head .badge {{ font-size: 1.35rem; font-weight: 700; }}
  .body {{ padding: 1.2rem 1.6rem 1.6rem; }}
  .row {{ display: flex; justify-content: space-between; gap: 1rem;
    padding: .7rem 0; border-bottom: 1px solid #eef3ef; font-size: .95rem; }}
  .row span {{ color: #5a6b60; }} .row strong {{ text-align: right; }}
  .note {{ margin-top: 1rem; font-size: .82rem; color: #6a7a70; line-height: 1.5; }}
</style></head><body>
  <div class="card">
    <div class="head"><h1>TOP S'ASSUR</h1><div class="badge">{badge}</div></div>
    <div class="body">{rows}<p class="note">{note}</p></div>
  </div>
</body></html>"""


@app.get("/verify/<token>")
def verify_receipt(token: str):
    """Page publique confirmant l'authenticité d'un reçu SANS exposer de données
    médicales (aucune zone du corps ni symptôme). Cible du QR code du PDF."""
    row = get_db().execute(
        "SELECT * FROM appointments WHERE verify_token=?", (token,)
    ).fetchone()
    if not row or row["status"] != "paid":
        html = _verify_page(
            "Vérification", False, [],
            "Aucun reçu payé ne correspond à ce code. Vérifiez le QR code ou "
            "rapprochez-vous de Top S'ASSUR.")
        return Response(html, mimetype="text/html", status=404)
    fac = None
    if row["facility_id"]:
        fac = get_db().execute("SELECT name, city FROM facilities WHERE id=?",
                               (row["facility_id"],)).fetchone()
    lines = [
        ("Référence", row["ref"]),
        ("Établissement", f'{fac["name"]} — {fac["city"]}' if fac else
         ("Soins à domicile" if row["homecare"] else "—")),
        ("Date", f'{row["date"]} — {row["time"]}'),
        ("Statut", "Payé ✓"),
        ("Montant", fmt_fcfa(row["total"])),
    ]
    html = _verify_page(
        "Vérification", True, lines,
        "Ce reçu a bien été émis par Top S'ASSUR. Les informations médicales "
        "du patient ne sont pas divulguées sur cette page de vérification.")
    return Response(html, mimetype="text/html")


# --------------------------------------------------------------------------- #
# Frontend statique
# --------------------------------------------------------------------------- #
@app.get("/")
def index():
    return send_from_directory(WEBAPP_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path: str):
    full = os.path.join(WEBAPP_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(WEBAPP_DIR, path)
    return send_from_directory(WEBAPP_DIR, "index.html")


# Initialise la base au chargement du module : indispensable sous un serveur de
# production (gunicorn), où le bloc __main__ ci-dessous n'est pas exécuté.
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=bool(os.environ.get("DEBUG")))
