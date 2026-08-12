#!/usr/bin/env python3
"""Génère standalone.html : un fichier unique et autonome regroupant
index.html + css/styles.css + js/app.js + les images (SVG en data-URI).

Usage :  python3 build.py
"""
import base64
from pathlib import Path

here = Path(__file__).parent


def data_uri(path: Path) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    html = (here / "index.html").read_text(encoding="utf-8")
    css = (here / "css" / "styles.css").read_text(encoding="utf-8")
    js = (here / "js" / "app.js").read_text(encoding="utf-8")
    logo_uri = data_uri(here / "assets" / "logo.svg")
    rehab_uri = data_uri(here / "assets" / "rehab.svg")

    css = css.replace('url("../assets/rehab.svg")', f'url("{rehab_uri}")')
    js = js.replace("assets/logo.svg", logo_uri)

    doc = html
    doc = doc.replace(
        '<link rel="icon" href="assets/logo.svg" type="image/svg+xml" />',
        f'<link rel="icon" href="{logo_uri}" type="image/svg+xml" />',
    )
    doc = doc.replace(
        '<link rel="stylesheet" href="css/styles.css" />', f"<style>\n{css}\n</style>"
    )
    doc = doc.replace(
        '<script src="js/app.js"></script>', f"<script>\n{js}\n</script>"
    )
    doc = doc.replace('src="assets/logo.svg"', f'src="{logo_uri}"')

    assert "assets/logo.svg" not in doc, "référence logo non remplacée"
    assert "css/styles.css" not in doc and "js/app.js" not in doc

    (here / "standalone.html").write_text(doc, encoding="utf-8")
    print(f"standalone.html généré ({len(doc):,} octets)")


if __name__ == "__main__":
    main()
