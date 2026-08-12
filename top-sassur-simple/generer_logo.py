"""Génère le logo de Top S'ASSUR (logo.png). Design : badge « bouclier d'assurance »
+ croix médicale bleue + arc dynamique ambre (mouvement = kinésithérapie)."""

from PIL import Image, ImageDraw

BLEU = (21, 101, 192)       # #1565C0 couleur de marque
BLEU_FONCE = (13, 71, 143)
AMBRE = (245, 166, 35)      # #F5A623 accent dynamique
BLANC = (255, 255, 255)

S = 1024  # rendu haute résolution (supersampling), réduit ensuite
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

c = S // 2  # centre

# --- Badge : carré arrondi (squircle) blanc à bord bleu ---
marge = 90
d.rounded_rectangle([marge, marge, S - marge, S - marge], radius=200,
                    fill=BLANC, outline=BLEU, width=34)

# --- Arc dynamique ambre autour de la croix (effet mouvement / protection) ---
r = 300
d.arc([c - r, c - r, c + r, c + r], start=125, end=415, fill=AMBRE, width=42)

# --- Croix médicale bleue (deux barres arrondies) ---
bras = 250      # longueur d'un bras depuis le centre
epais = 96      # demi-épaisseur
d.rounded_rectangle([c - epais, c - bras, c + epais, c + bras], radius=40, fill=BLEU)
d.rounded_rectangle([c - bras, c - epais, c + bras, c + epais], radius=40, fill=BLEU)

# --- Battement de cœur (ECG) blanc traversant la croix : dynamisme + santé ---
ligne = [
    (c - 210, c), (c - 90, c), (c - 55, c - 70), (c - 10, c + 90),
    (c + 35, c - 60), (c + 70, c), (c + 210, c),
]
d.line(ligne, fill=BLANC, width=26, joint="curve")

# Réduction finale (anti-crénelage)
img = img.resize((512, 512), Image.LANCZOS)
img.save("logo.png")
print("logo.png généré :", img.size)
