# ICE LAB — Site e-commerce de livraison de glaçons

Site vitrine et e-commerce pour la marque **ICE LAB** — « La fraîcheur livrée chez vous ».
Site **statique** (HTML / CSS / JavaScript, sans dépendance ni build), rapide, responsive et optimisé SEO.

## 🧊 Aperçu

| Page | Fichier | Contenu |
|------|---------|---------|
| Accueil | `index.html` | Logo, slogan, atouts, produits phares, avis clients, appels à l'action |
| Boutique | `boutique.html` | Catalogue complet avec photos, descriptions (poids, conditionnement, prix), quantité et ajout au panier |
| Livraison | `livraison.html` | Zones desservies, délais, frais, tableau tarifaire par zone |
| À propos | `a-propos.html` | Présentation, engagement qualité & hygiène, valeurs de la marque |
| Contact | `contact.html` | Formulaire, téléphone, adresse **+ FAQ** |
| Commande | `commande.html` | Tunnel de commande, paiement (CB / PayPal / Mobile Money), confirmation e-mail |

## ✨ Fonctionnalités

- **Panier persistant** (localStorage) visible en haut de page, tiroir latéral, badge de quantité.
- **Sélecteur de quantité** et ajout au panier sur chaque produit.
- **Tunnel de commande** avec récapitulatif dynamique, frais de livraison automatiques
  (offerts dès 30 €) et **confirmation de commande** simulée par e-mail.
- **3 moyens de paiement** : Carte bancaire, PayPal, Mobile Money.
- **FAQ**, **avis clients**, **formulaire de contact** et numéro de téléphone (éléments de confiance).
- **Responsive** mobile / tablette / desktop, menu burger.
- **SEO** : balises `title`/`description`/`keywords` par page, Open Graph, données structurées
  Schema.org (Store, FAQPage), `sitemap.xml`, `robots.txt`, canoniques.
- **Performance** : aucune librairie JS externe, images vectorielles SVG légères, polices en `display=swap`.

## 🎨 Identité visuelle

Palette **blanc / bleu glacier / gris argenté**, design moderne, minimaliste et épuré.
Typographies : *Poppins* (titres) et *Inter* (texte).

## 🚀 Utilisation

Le site est 100 % statique : ouvrez simplement `index.html` dans un navigateur,
ou servez le dossier avec n'importe quel serveur statique :

```bash
cd site
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

### Déploiement

Compatible avec tout hébergement statique : **GitHub Pages**, Netlify, Vercel, Cloudflare Pages…
Il suffit de publier le contenu du dossier `site/`.

## ⚠️ Note

Le paiement et l'envoi d'e-mails sont **simulés côté client** à des fins de démonstration.
Pour une mise en production réelle, il faut connecter une passerelle de paiement
(Stripe, PayPal, un agrégateur Mobile Money) et un service d'e-mail transactionnel via un back-end.
