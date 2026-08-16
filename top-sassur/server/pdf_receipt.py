"""Génération de reçu PDF côté serveur, en Python pur (aucune dépendance).

Produit un PDF A4 une page avec les polices standard Helvetica / Helvetica-Bold
(intégrées à tous les lecteurs PDF, donc rien à embarquer). Le texte est encodé
en WinAnsi (cp1252) pour gérer correctement les accents français.
"""
from __future__ import annotations

import re

# Espaces Unicode (fine, insécable, etc.) à normaliser vers une espace simple.
_SPACES = re.compile("[\u2000-\u200A\u202F\u2007\u2009\u00A0\u2028\u2029]")


def _win(s: str) -> bytes:
    s = _SPACES.sub(" ", str(s))
    return s.encode("cp1252", errors="replace")


def _esc(s: str) -> bytes:
    return _win(s).replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def _text(x: int, y: int, size: int, font: bytes, s: str) -> bytes:
    return b"BT /%b %d Tf %d %d Td (%b) Tj ET\n" % (font, size, x, y, _esc(s))


def _qr_content(url: str, *, right: float = 535, top: float = 828, box: float = 78) -> bytes:
    """Dessine un QR code (vers ``url``) en rectangles vectoriels noirs, en haut à
    droite du reçu. Rendu pur : la matrice vient de la librairie ``qrcode`` (sans
    Pillow). Si ``qrcode`` est absent, retourne un contenu vide (QR simplement omis).
    """
    try:
        import qrcode  # dépendance légère, pur Python pour la matrice
    except Exception:
        return b""
    q = qrcode.QRCode(border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url)
    q.make(fit=True)
    matrix = q.get_matrix()
    n = len(matrix)
    ms = box / n
    x0 = right - box
    # Fond blanc sous le QR (garantit le contraste même sur un aplat coloré).
    out = b"1 1 1 rg\n%.2f %.2f %.2f %.2f re f\n" % (x0 - 2, top - box - 2, box + 4, box + 4)
    out += b"0 0 0 rg\n"
    for r, rowvals in enumerate(matrix):
        for ccol, dark in enumerate(rowvals):
            if dark:
                x = x0 + ccol * ms
                y = top - (r + 1) * ms
                out += b"%.2f %.2f %.2f %.2f re\n" % (x, y, ms + 0.3, ms + 0.3)
    out += b"f\n"
    return out


def build_receipt_pdf(*, brand: str, subtitle: str, rows: list[tuple[str, str]],
                      total_label: str, total_value: str, footer_lines: list[str],
                      qr_url: str | None = None, qr_caption: str = "") -> bytes:
    c = b""
    if qr_url:
        c += _qr_content(qr_url)
        if qr_caption:
            c += b"0.45 0.52 0.47 rg\n" + _text(470, 742, 8, b"F1", qr_caption)
    c += b"0.12 0.46 0.20 rg\n" + _text(60, 792, 22, b"F2", brand)
    c += b"0.35 0.42 0.37 rg\n" + _text(60, 774, 11, b"F1", subtitle)
    c += b"0.17 0.55 0.20 RG 2 w 60 766 m 535 766 l S\n"
    c += b"0.08 0.14 0.10 rg\n"
    y = 738
    for label, val in rows:
        c += _text(60, y, 11, b"F1", label)
        c += _text(230, y, 11, b"F2", val)
        c += b"0.89 0.93 0.89 RG 0.6 w 60 %d m 535 %d l S\n" % (y - 8, y - 8)
        y -= 30
    y -= 6
    c += b"0.17 0.57 0.26 rg\n" + _text(60, y, 15, b"F2", total_label)
    c += _text(360, y, 15, b"F2", total_value)
    c += b"0.45 0.52 0.47 rg\n"
    fy = y - 46
    for line in footer_lines:
        c += _text(60, fy, 9, b"F1", line)
        fy -= 16

    objs = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: (b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>"),
        4: b"<< /Length %d >>\nstream\n%b\nendstream" % (len(c), c),
        5: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        6: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    }

    pdf = b"%PDF-1.4\n"
    offsets = {}
    for i in range(1, 7):
        offsets[i] = len(pdf)
        pdf += b"%d 0 obj\n%b\nendobj\n" % (i, objs[i])
    xref_start = len(pdf)
    pdf += b"xref\n0 7\n0000000000 65535 f \n"
    for i in range(1, 7):
        pdf += b"%010d 00000 n \n" % offsets[i]
    pdf += b"trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % xref_start
    return pdf
