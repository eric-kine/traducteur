/* =========================================================================
   ICE LAB — Logique du site (catalogue, panier, commande)
   Aucune dépendance externe. Panier persistant via localStorage.
   ========================================================================= */
(function () {
  "use strict";

  /* --------------------------- Catalogue produits ---------------------- */
  const PRODUITS = [
    {
      id: "sac-2kg",
      nom: "Sac de glaçons 2 kg",
      desc: "Glaçons classiques cristallins, parfaits pour les boissons du quotidien et les apéritifs.",
      prix: 3.5,
      img: "assets/img/sac-classique.svg",
      poids: "2 kg",
      cond: "≈ 120 glaçons",
      badge: null,
      vedette: true,
    },
    {
      id: "sac-5kg",
      nom: "Sac de glaçons 5 kg",
      desc: "Le format familial. Idéal pour les repas entre amis, barbecues et grandes tablées.",
      prix: 6.9,
      img: "assets/img/sac-grand.svg",
      poids: "5 kg",
      cond: "≈ 300 glaçons",
      badge: "Best-seller",
      vedette: true,
    },
    {
      id: "vrac-10kg",
      nom: "Glaçons en vrac 10 kg",
      desc: "Caisse isotherme réutilisable. Le meilleur rapport quantité/prix pour bars et restaurants.",
      prix: 11.9,
      img: "assets/img/glacons-vrac.svg",
      poids: "10 kg",
      cond: "Caisse isotherme",
      badge: null,
      vedette: true,
    },
    {
      id: "pack-event",
      nom: "Pack événementiel 20 kg",
      desc: "Trois sacs livrés en glacière. Pensé pour mariages, soirées et événements pros.",
      prix: 21.9,
      img: "assets/img/pack-evenementiel.svg",
      poids: "20 kg",
      cond: "3 sacs + glacière",
      badge: "Événement",
      vedette: true,
    },
    {
      id: "sphere-2kg",
      nom: "Glaçons sphériques Premium 2 kg",
      desc: "Sphères lentes à fondre, transparence parfaite. La signature des cocktails et whiskies.",
      prix: 5.9,
      img: "assets/img/glacons-spheriques.svg",
      poids: "2 kg",
      cond: "≈ 40 sphères",
      badge: "Premium",
      vedette: false,
    },
    {
      id: "pilee-4kg",
      nom: "Glace pilée 4 kg",
      desc: "Éclats fins et réguliers pour granités, plateaux de fruits de mer et cocktails frappés.",
      prix: 5.5,
      img: "assets/img/glace-pilee.svg",
      poids: "4 kg",
      cond: "Éclats fins",
      badge: null,
      vedette: false,
    },
  ];

  const FRAIS_LIVRAISON = 4.9;
  const SEUIL_FRANCO = 30; // livraison offerte au-delà de ce montant
  const CLE_PANIER = "icelab_panier_v1";

  /* --------------------------- Utilitaires ----------------------------- */
  const euro = (n) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const produitParId = (id) => PRODUITS.find((p) => p.id === id);
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* --------------------------- État du panier -------------------------- */
  function lirePanier() {
    try {
      return JSON.parse(localStorage.getItem(CLE_PANIER)) || {};
    } catch (e) {
      return {};
    }
  }
  function ecrirePanier(panier) {
    localStorage.setItem(CLE_PANIER, JSON.stringify(panier));
    majAffichagePanier();
  }
  function ajouterAuPanier(id, qte) {
    qte = Math.max(1, parseInt(qte, 10) || 1);
    const panier = lirePanier();
    panier[id] = (panier[id] || 0) + qte;
    ecrirePanier(panier);
    const p = produitParId(id);
    toast(`${p ? p.nom : "Produit"} ajouté au panier`);
  }
  function definirQuantite(id, qte) {
    const panier = lirePanier();
    qte = parseInt(qte, 10) || 0;
    if (qte <= 0) delete panier[id];
    else panier[id] = qte;
    ecrirePanier(panier);
  }
  function retirerDuPanier(id) {
    const panier = lirePanier();
    delete panier[id];
    ecrirePanier(panier);
  }
  function viderPanier() {
    localStorage.removeItem(CLE_PANIER);
    majAffichagePanier();
  }
  function nbArticles() {
    return Object.values(lirePanier()).reduce((s, q) => s + q, 0);
  }
  function sousTotal() {
    const panier = lirePanier();
    return Object.entries(panier).reduce((s, [id, q]) => {
      const p = produitParId(id);
      return p ? s + p.prix * q : s;
    }, 0);
  }
  function fraisLivraison() {
    const st = sousTotal();
    if (st === 0 || st >= SEUIL_FRANCO) return 0;
    return FRAIS_LIVRAISON;
  }
  function total() {
    return sousTotal() + fraisLivraison();
  }

  /* --------------------------- Icônes SVG ------------------------------ */
  const ICONE_MOINS = "−";
  const ICONE_PLUS = "+";

  /* --------------------------- Rendu catalogue ------------------------- */
  function carteProduitHTML(p) {
    const badge = p.badge
      ? `<span class="badge ${p.vedette ? "badge--vedette" : ""}">${p.badge}</span>`
      : "";
    return `
      <article class="carte-produit reveal" data-id="${p.id}">
        <div class="carte-produit__media">
          ${badge}
          <img src="${p.img}" alt="${p.nom} — ICE LAB" loading="lazy" width="200" height="150">
        </div>
        <div class="carte-produit__corps">
          <h3>${p.nom}</h3>
          <p class="carte-produit__desc">${p.desc}</p>
          <div class="carte-produit__meta">
            <span class="puce">${p.poids}</span>
            <span class="puce">${p.cond}</span>
          </div>
          <div class="carte-produit__pied">
            <span class="prix">${euro(p.prix)}</span>
            <div class="qte" data-qte>
              <button type="button" aria-label="Diminuer" data-moins>${ICONE_MOINS}</button>
              <input type="number" value="1" min="1" max="99" aria-label="Quantité pour ${p.nom}">
              <button type="button" aria-label="Augmenter" data-plus>${ICONE_PLUS}</button>
            </div>
          </div>
          <div class="carte-produit__actions">
            <button type="button" class="btn btn--primaire" data-ajouter="${p.id}">Ajouter au panier</button>
          </div>
        </div>
      </article>`;
  }

  function rendreCatalogue() {
    const grilleComplete = $("#grille-produits");
    if (grilleComplete) {
      grilleComplete.innerHTML = PRODUITS.map(carteProduitHTML).join("");
    }
    const grilleVedette = $("#produits-vedette");
    if (grilleVedette) {
      grilleVedette.innerHTML = PRODUITS.filter((p) => p.vedette).map(carteProduitHTML).join("");
    }
    brancherCartes();
  }

  function brancherCartes() {
    $$("[data-qte]").forEach((groupe) => {
      const input = $("input", groupe);
      $("[data-moins]", groupe).addEventListener("click", () => {
        input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
      });
      $("[data-plus]", groupe).addEventListener("click", () => {
        input.value = Math.min(99, (parseInt(input.value, 10) || 1) + 1);
      });
    });
    $$("[data-ajouter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const carte = btn.closest(".carte-produit");
        const input = carte ? $("[data-qte] input", carte) : null;
        ajouterAuPanier(btn.dataset.ajouter, input ? input.value : 1);
        ouvrirTiroir();
      });
    });
  }

  /* --------------------------- Tiroir panier --------------------------- */
  function ligneTiroirHTML(id, qte) {
    const p = produitParId(id);
    if (!p) return "";
    return `
      <div class="ligne-panier" data-ligne="${id}">
        <div class="ligne-panier__img"><img src="${p.img}" alt="${p.nom}"></div>
        <div class="ligne-panier__info">
          <h4>${p.nom}</h4>
          <div class="prix-u">${euro(p.prix)} · ${p.poids}</div>
          <div class="ligne-panier__bas">
            <div class="qte" data-qte-ligne="${id}">
              <button type="button" aria-label="Diminuer" data-l-moins>${ICONE_MOINS}</button>
              <input type="number" value="${qte}" min="1" max="99" aria-label="Quantité">
              <button type="button" aria-label="Augmenter" data-l-plus>${ICONE_PLUS}</button>
            </div>
            <button type="button" class="supprimer" data-supprimer="${id}">Retirer</button>
          </div>
        </div>
      </div>`;
  }

  function rendreTiroir() {
    const corps = $("#tiroir-corps");
    const pied = $("#tiroir-pied");
    if (!corps) return;
    const panier = lirePanier();
    const ids = Object.keys(panier);
    if (ids.length === 0) {
      corps.innerHTML = `
        <div class="tiroir__vide">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <p>Votre panier est vide.<br>Découvrez nos glaçons livrés en un clic&nbsp;!</p>
          <a href="boutique.html" class="btn btn--primaire">Voir la boutique</a>
        </div>`;
      if (pied) pied.hidden = true;
      return;
    }
    corps.innerHTML = ids.map((id) => ligneTiroirHTML(id, panier[id])).join("");
    if (pied) {
      pied.hidden = false;
      $("#tiroir-total").textContent = euro(sousTotal());
      const info = $("#tiroir-livraison");
      if (info) {
        const reste = SEUIL_FRANCO - sousTotal();
        info.textContent = reste > 0
          ? `Plus que ${euro(reste)} pour la livraison offerte 🚚`
          : "Livraison offerte 🎉";
      }
    }
    brancherLignesTiroir();
  }

  function brancherLignesTiroir() {
    $$("[data-qte-ligne]").forEach((groupe) => {
      const id = groupe.dataset.qteLigne;
      const input = $("input", groupe);
      $("[data-l-moins]", groupe).addEventListener("click", () => definirQuantite(id, (parseInt(input.value, 10) || 1) - 1));
      $("[data-l-plus]", groupe).addEventListener("click", () => definirQuantite(id, (parseInt(input.value, 10) || 1) + 1));
      input.addEventListener("change", () => definirQuantite(id, input.value));
    });
    $$("[data-supprimer]").forEach((btn) => {
      btn.addEventListener("click", () => retirerDuPanier(btn.dataset.supprimer));
    });
  }

  function ouvrirTiroir() {
    const t = $("#tiroir"); const o = $("#overlay");
    if (t) t.classList.add("ouvert");
    if (o) o.classList.add("ouvert");
    document.body.style.overflow = "hidden";
  }
  function fermerTiroir() {
    const t = $("#tiroir"); const o = $("#overlay");
    if (t) t.classList.remove("ouvert");
    if (o) o.classList.remove("ouvert");
    document.body.style.overflow = "";
  }

  /* --------------------------- Maj globale ----------------------------- */
  function majAffichagePanier() {
    const n = nbArticles();
    $$(".panier-compte").forEach((el) => {
      el.textContent = n;
      el.style.display = n > 0 ? "flex" : "none";
    });
    rendreTiroir();
    rendreRecapCommande();
  }

  /* --------------------------- Page commande --------------------------- */
  function rendreRecapCommande() {
    const zone = $("#recap-lignes");
    if (!zone) return;
    const panier = lirePanier();
    const ids = Object.keys(panier);
    const boutonPayer = $("#btn-payer");
    if (ids.length === 0) {
      zone.innerHTML = `<p class="recap__vide">Votre panier est vide.<br><a href="boutique.html">Retour à la boutique →</a></p>`;
      $("#recap-totaux").hidden = true;
      if (boutonPayer) boutonPayer.disabled = true;
      return;
    }
    $("#recap-totaux").hidden = false;
    if (boutonPayer) boutonPayer.disabled = false;
    zone.innerHTML = ids.map((id) => {
      const p = produitParId(id);
      const q = panier[id];
      return `<div class="recap__ligne">
        <span>${p.nom} <strong>×${q}</strong></span>
        <span>${euro(p.prix * q)}</span>
      </div>`;
    }).join("");
    $("#recap-soustotal").textContent = euro(sousTotal());
    const fr = fraisLivraison();
    $("#recap-livraison").textContent = fr === 0 ? "Offerte" : euro(fr);
    $("#recap-total").textContent = euro(total());
  }

  function initCommande() {
    const form = $("#form-commande");
    if (!form) return;

    // Sélection du mode de paiement
    $$(".paiement").forEach((opt) => {
      opt.addEventListener("click", () => {
        $$(".paiement").forEach((o) => o.classList.remove("selectionne"));
        opt.classList.add("selectionne");
        const radio = $("input", opt);
        if (radio) radio.checked = true;
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (nbArticles() === 0) {
        toast("Votre panier est vide.");
        return;
      }
      if (!form.reportValidity()) return;
      const donnees = new FormData(form);
      const email = donnees.get("email");
      const numero = "ICL-" + Date.now().toString().slice(-6);
      viderPanier();
      const zone = $("#commande-contenu");
      if (zone) {
        zone.innerHTML = `
          <div class="message-ok" style="max-width:620px;margin:0 auto;text-align:center;padding:2.5rem;">
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#1c7a45" stroke-width="2" style="margin:0 auto 1rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round"/><path d="M22 4 12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <h2 style="color:#146034;">Commande confirmée&nbsp;!</h2>
            <p><strong>Merci pour votre commande n°${numero}.</strong></p>
            <p>Un e-mail de confirmation vient d'être envoyé à <strong>${email}</strong> avec le récapitulatif et le suivi de livraison. Vos glaçons arrivent bien au frais&nbsp;! 🧊</p>
            <a href="boutique.html" class="btn btn--primaire mt-2">Continuer mes achats</a>
          </div>`;
        zone.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  /* --------------------------- Formulaire contact ---------------------- */
  function initContact() {
    const form = $("#form-contact");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      form.style.display = "none";
      const ok = $("#contact-ok");
      if (ok) { ok.hidden = false; ok.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  /* --------------------------- Toast ----------------------------------- */
  let toastTimer;
  function toast(message) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${message}</span>`;
    el.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
  }

  /* --------------------------- Menu mobile ----------------------------- */
  function initMenu() {
    const toggle = $("#menu-toggle");
    const nav = $("#nav-principal");
    if (toggle && nav) {
      toggle.addEventListener("click", () => nav.classList.toggle("mobile-ouvert"));
    }
    $$("[data-ouvrir-panier]").forEach((b) => b.addEventListener("click", ouvrirTiroir));
    const fermer = $("#tiroir-fermer");
    const overlay = $("#overlay");
    if (fermer) fermer.addEventListener("click", fermerTiroir);
    if (overlay) overlay.addEventListener("click", fermerTiroir);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerTiroir(); });
  }

  /* --------------------------- Apparition au défilement ---------------- */
  function initReveal() {
    const cibles = $$(".reveal");
    if (!("IntersectionObserver" in window) || cibles.length === 0) {
      cibles.forEach((c) => c.classList.add("visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    cibles.forEach((c) => io.observe(c));
  }

  /* --------------------------- Année pied de page ---------------------- */
  function initAnnee() {
    $$("[data-annee]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* --------------------------- Démarrage ------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    rendreCatalogue();
    initMenu();
    initCommande();
    initContact();
    initAnnee();
    majAffichagePanier();
    initReveal();
  });

  // Expose minimal pour tests éventuels
  window.ICELAB = { PRODUITS, ajouterAuPanier, lirePanier, total };
})();
