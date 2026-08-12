/* =====================================================================
   Top S'ASSUR — interface connectée au serveur (version production).
   Comptes patients + admin, données partagées, paiement, reçu PDF serveur.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- i18n ---------------- */
  const I18N = {
    fr: {
      "brand.tagline": "Assurance Santé",
      "nav.home": "Accueil", "nav.booking": "Prendre RDV", "nav.patient": "Espace patient", "nav.admin": "Admin",
      "notif.title": "Notifications",
      "home.pill": "Assurance santé • Kinésithérapie",
      "home.title": "Vos soins de kiné, enfin accessibles.",
      "home.lead": "Top S'ASSUR rend la rééducation abordable pour les acteurs du secteur informel au Cameroun. Choisissez votre douleur, votre clinique partenaire, votre rendez-vous — et payez en toute simplicité.",
      "home.cta": "Démarrer ma prise en charge", "home.learn": "Notre mission",
      "home.stat1": "de la population active dans l'informel",
      "home.stat2": "domaines de kinésithérapie couverts",
      "home.stat3": "reçu officiel à chaque RDV",
      "home.ctaband": "Prêt à prendre soin de vous ?",
      "mission.title": "Pourquoi Top S'ASSUR ?",
      "mission.lead": "Au Cameroun, les frais de kinésithérapie sont élevés et hors de portée de la majorité. Notre application mutualise l'accès aux soins pour que chacun — chauffeur, commerçante, artisan — puisse se soigner sans se ruiner.",
      "domains.title": "Domaines pris en charge",
      "step1.title": "1. Où avez-vous mal ?",
      "step1.hint": "Sélectionnez une ou plusieurs zones. Aucune douleur particulière ? Optez pour le bien-être corporel.",
      "step1.wellness": "Pas de douleur — soins de bien-être corporel",
      "step2.title": "2. Choisissez votre établissement",
      "step2.hint": "Cliniques et hôpitaux partenaires près de chez vous.",
      "step3.title": "3. Planifiez votre rendez-vous",
      "step3.time": "Heure du rendez-vous", "step3.home": "Soins à domicile (+ 3 000 FCFA)",
      "step4.title": "4. Paiement sécurisé",
      "step5.title": "5. Validation", "step5.save": "Enregistrer et payer",
      "wiz.prev": "Précédent", "wiz.next": "Suivant",
      "patient.title": "Espace patient", "patient.history": "Historique des rendez-vous",
      "patient.tracking": "Suivi des zones douloureuses", "patient.empty": "Aucun rendez-vous pour l'instant.",
      "admin.title": "Espace administrateur", "admin.partners": "Gestion des partenaires",
      "admin.payments": "Suivi des paiements", "admin.name": "Nom de l'établissement",
      "admin.city": "Ville", "admin.price": "Tarif séance (FCFA)", "admin.add": "Ajouter",
      "foot.rights": "Assurance santé kinésithérapie",
      "foot.security": "🔒 Données patients chiffrées — conformité aux standards de protection des données médicales.",
      "receipt.download": "Télécharger le reçu PDF", "receipt.close": "Fermer",
      "pay.phone": "Numéro de téléphone", "pay.name": "Nom du titulaire",
      "pay.card": "Numéro de carte", "pay.exp": "Expiration", "pay.cvv": "CVV",
      "sum.zones": "Zones / soins", "sum.facility": "Établissement", "sum.date": "Date", "sum.time": "Heure",
      "sum.home": "Soins à domicile", "sum.pay": "Paiement", "sum.total": "Total à payer",
      "sum.yes": "Oui", "sum.no": "Non",
      "months": ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
      "dow": ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],
      "t.saved": "Rendez-vous confirmé ✓ Reçu PDF disponible.",
      "t.needZone": "Sélectionnez au moins une zone ou le bien-être.",
      "t.needFacility": "Choisissez un établissement.",
      "t.needSchedule": "Choisissez une date et une heure.",
      "t.needPay": "Complétez les informations de paiement.",
      "t.added": "Partenaire ajouté ✓", "t.deleted": "Partenaire supprimé.",
      "t.registered": "Compte créé ✓", "t.loggedin": "Connecté ✓", "t.loggedout": "Déconnecté.",
      "wellness": "Bien-être corporel",
      "receipt.for": "Reçu officiel de prise en charge", "receipt.ref": "Référence",
      "receipt.patient": "Patient", "receipt.present": "À présenter à l'accueil de l'établissement le jour du rendez-vous.",
      "stat.appts": "Rendez-vous", "stat.revenue": "Recettes (FCFA)", "stat.partners": "Partenaires",
      "stat.home": "Soins à domicile", "stat.patients": "Patients",
      "pdf": "Reçu PDF",
      "auth.login": "Se connecter", "auth.register": "Créer un compte", "auth.name": "Nom complet",
      "auth.phone": "Téléphone", "auth.password": "Mot de passe",
      "auth.loginTitle": "Connexion", "auth.registerTitle": "Créer un compte",
      "auth.loginSub": "Accédez à vos rendez-vous et reçus.", "auth.registerSub": "Quelques secondes suffisent.",
      "auth.noAccount": "Pas encore de compte ?", "auth.haveAccount": "Déjà inscrit ?",
      "auth.logout": "Déconnexion", "auth.gate": "Connectez-vous pour voir vos rendez-vous et reçus.",
      "auth.needLogin": "Connectez-vous pour finaliser votre rendez-vous.",
      "admin.loginTitle": "Connexion administrateur", "admin.username": "Identifiant",
      "admin.gate": "Espace réservé à l'administrateur.", "admin.logout": "Déconnexion admin",
      "pay.processing": "Traitement du paiement…", "pay.pending": "Confirmez le paiement sur votre téléphone (code PIN Mobile Money)…",
      "pay.success": "Paiement confirmé ✓", "pay.failed": "Paiement échoué. Veuillez réessayer.",
      "testi.title": "Ils nous font confiance", "testi.lead": "Des patients du secteur informel racontent leur expérience.",
      "testi.empty": "Soyez le premier à partager votre expérience.",
      "testi.share": "Partager mon expérience", "testi.shareHint": "Votre témoignage encourage d'autres patients à se soigner.",
      "testi.rating": "Votre note", "testi.city": "Ville (facultatif)",
      "testi.placeholder": "Racontez votre expérience avec Top S'ASSUR…",
      "testi.submit": "Publier mon témoignage", "testi.thanks": "Merci pour votre témoignage ✓",
      "testi.needText": "Écrivez au moins 10 caractères.", "testi.share2": "Partager", "testi.copied": "Témoignage copié ✓",
      "rewards.title": "Mes récompenses", "rewards.points": "points", "rewards.level": "Niveau",
      "rewards.sessions": "séances suivies", "rewards.next": "Prochain palier",
      "rewards.badges": "Mes badges", "rewards.empty": "Réservez et suivez vos séances pour débloquer des badges.",
      "err.generic": "Une erreur est survenue.", "hello": "Bonjour"
    },
    en: {
      "brand.tagline": "Health Insurance",
      "nav.home": "Home", "nav.booking": "Book", "nav.patient": "My space", "nav.admin": "Admin",
      "notif.title": "Notifications",
      "home.pill": "Health insurance • Physiotherapy",
      "home.title": "Your physio care, finally affordable.",
      "home.lead": "Top S'ASSUR makes rehabilitation affordable for informal-sector workers in Cameroon. Pick your pain, your partner clinic, your appointment — and pay with ease.",
      "home.cta": "Start my care", "home.learn": "Our mission",
      "home.stat1": "of the active population in the informal sector",
      "home.stat2": "areas of physiotherapy covered", "home.stat3": "official receipt for every visit",
      "home.ctaband": "Ready to take care of yourself?",
      "mission.title": "Why Top S'ASSUR?",
      "mission.lead": "In Cameroon, physiotherapy is expensive and out of reach for most. Our app pools access to care so everyone — driver, trader, craftsperson — can heal without going broke.",
      "domains.title": "Areas of care",
      "step1.title": "1. Where does it hurt?",
      "step1.hint": "Select one or more areas. No specific pain? Choose body wellness.",
      "step1.wellness": "No pain — body wellness care",
      "step2.title": "2. Choose your facility", "step2.hint": "Partner clinics and hospitals near you.",
      "step3.title": "3. Schedule your appointment",
      "step3.time": "Appointment time", "step3.home": "Home care (+ 3,000 FCFA)",
      "step4.title": "4. Secure payment", "step5.title": "5. Confirmation", "step5.save": "Save and pay",
      "wiz.prev": "Back", "wiz.next": "Next",
      "patient.title": "My space", "patient.history": "Appointment history",
      "patient.tracking": "Pain-area tracking", "patient.empty": "No appointments yet.",
      "admin.title": "Administrator space", "admin.partners": "Partner management",
      "admin.payments": "Payment tracking", "admin.name": "Facility name", "admin.city": "City",
      "admin.price": "Session price (FCFA)", "admin.add": "Add",
      "foot.rights": "Physiotherapy health insurance",
      "foot.security": "🔒 Encrypted patient data — compliant with medical data-protection standards.",
      "receipt.download": "Download PDF receipt", "receipt.close": "Close",
      "pay.phone": "Phone number", "pay.name": "Cardholder name", "pay.card": "Card number",
      "pay.exp": "Expiry", "pay.cvv": "CVV",
      "sum.zones": "Areas / care", "sum.facility": "Facility", "sum.date": "Date", "sum.time": "Time",
      "sum.home": "Home care", "sum.pay": "Payment", "sum.total": "Total due", "sum.yes": "Yes", "sum.no": "No",
      "months": ["January","February","March","April","May","June","July","August","September","October","November","December"],
      "dow": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      "t.saved": "Appointment confirmed ✓ PDF receipt available.",
      "t.needZone": "Select at least one area or wellness.",
      "t.needFacility": "Choose a facility.", "t.needSchedule": "Choose a date and time.",
      "t.needPay": "Complete the payment details.",
      "t.added": "Partner added ✓", "t.deleted": "Partner removed.",
      "t.registered": "Account created ✓", "t.loggedin": "Signed in ✓", "t.loggedout": "Signed out.",
      "wellness": "Body wellness",
      "receipt.for": "Official care receipt", "receipt.ref": "Reference",
      "receipt.patient": "Patient", "receipt.present": "Present this at the facility's reception on the day of your appointment.",
      "stat.appts": "Appointments", "stat.revenue": "Revenue (FCFA)", "stat.partners": "Partners",
      "stat.home": "Home care", "stat.patients": "Patients",
      "pdf": "PDF receipt",
      "auth.login": "Sign in", "auth.register": "Create account", "auth.name": "Full name",
      "auth.phone": "Phone", "auth.password": "Password",
      "auth.loginTitle": "Sign in", "auth.registerTitle": "Create account",
      "auth.loginSub": "Access your appointments and receipts.", "auth.registerSub": "Takes a few seconds.",
      "auth.noAccount": "No account yet?", "auth.haveAccount": "Already registered?",
      "auth.logout": "Sign out", "auth.gate": "Sign in to see your appointments and receipts.",
      "auth.needLogin": "Sign in to complete your appointment.",
      "admin.loginTitle": "Administrator sign in", "admin.username": "Username",
      "admin.gate": "Administrator area only.", "admin.logout": "Admin sign out",
      "pay.processing": "Processing payment…", "pay.pending": "Confirm the payment on your phone (Mobile Money PIN)…",
      "pay.success": "Payment confirmed ✓", "pay.failed": "Payment failed. Please try again.",
      "testi.title": "They trust us", "testi.lead": "Informal-sector patients share their experience.",
      "testi.empty": "Be the first to share your experience.",
      "testi.share": "Share my experience", "testi.shareHint": "Your story encourages other patients to seek care.",
      "testi.rating": "Your rating", "testi.city": "City (optional)",
      "testi.placeholder": "Tell us about your experience with Top S'ASSUR…",
      "testi.submit": "Publish my testimonial", "testi.thanks": "Thank you for your testimonial ✓",
      "testi.needText": "Write at least 10 characters.", "testi.share2": "Share", "testi.copied": "Testimonial copied ✓",
      "rewards.title": "My rewards", "rewards.points": "points", "rewards.level": "Level",
      "rewards.sessions": "sessions completed", "rewards.next": "Next tier",
      "rewards.badges": "My badges", "rewards.empty": "Book and complete sessions to unlock badges.",
      "err.generic": "Something went wrong.", "hello": "Hello"
    }
  };
  let lang = localStorage.getItem("ts_lang") || "fr";
  const t = (k) => (I18N[lang][k] !== undefined ? I18N[lang][k] : k);

  /* ---------------- data ---------------- */
  const BENEFITS = [
    { ic: "🧠", fr: ["Neurologie", "Récupération après AVC, paralysies, troubles de l'équilibre."], en: ["Neurology", "Recovery after stroke, paralysis, balance disorders."] },
    { ic: "🦴", fr: ["Traumatologie", "Rééducation après fractures, entorses et accidents."], en: ["Traumatology", "Rehab after fractures, sprains and accidents."] },
    { ic: "🖐️", fr: ["Rhumatologie", "Soulagement des douleurs articulaires et de l'arthrose."], en: ["Rheumatology", "Relief of joint pain and osteoarthritis."] },
    { ic: "🤰", fr: ["Gynécologie", "Rééducation périnéale, suivi pré et post-natal."], en: ["Gynecology", "Perineal rehab, pre- and post-natal follow-up."] },
    { ic: "🦵", fr: ["Orthopédie", "Rééducation post-opératoire, prothèses, posture."], en: ["Orthopedics", "Post-op rehab, prostheses, posture."] },
    { ic: "🌿", fr: ["Bien-être corporel", "Massage, relaxation, prévention et entretien physique."], en: ["Body wellness", "Massage, relaxation, prevention and upkeep."] }
  ];
  const ZONES = [
    { id: "cou", fr: "Cou", en: "Neck" }, { id: "epaule", fr: "Épaule", en: "Shoulder" },
    { id: "dos", fr: "Dos", en: "Back" }, { id: "fesse", fr: "Fesse", en: "Buttock" },
    { id: "hanche", fr: "Hanche", en: "Hip" }, { id: "cuisse", fr: "Cuisse", en: "Thigh" },
    { id: "genou", fr: "Genou", en: "Knee" }, { id: "jambe", fr: "Jambe", en: "Leg" },
    { id: "cheville", fr: "Cheville", en: "Ankle" }, { id: "pied", fr: "Pied", en: "Foot" }
  ];
  const zoneName = (id) => { const z = ZONES.find(z => z.id === id); return z ? z[lang] : id; };
  const PAY_METHODS = [
    { id: "om", label: "Orange Money", cls: "om", badge: "OM" },
    { id: "momo", label: "MTN Mobile Money", cls: "momo", badge: "MoMo" },
    { id: "mc", label: "MasterCard", cls: "mc", badge: "MC" }
  ];
  const HOME_FEE = 3000;

  /* ---------------- auth state ---------------- */
  let token = localStorage.getItem("ts_token") || null;
  let patient = JSON.parse(localStorage.getItem("ts_patient") || "null");
  let adminToken = localStorage.getItem("ts_admin_token") || null;

  /* ---------------- API ---------------- */
  async function api(path, { method = "GET", body, auth, admin } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (admin && adminToken) headers["Authorization"] = "Bearer " + adminToken;
    else if (auth && token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch("/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || t("err.generic"));
    return data;
  }

  /* ---------------- booking state ---------------- */
  const state = {
    step: 1, zones: new Set(), wellness: false, facilityId: null,
    date: null, time: null, homecare: false, payMethod: null, payValid: false,
    calMonth: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })()
  };
  let facilities = [];

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmtFCFA = (n) => n.toLocaleString("fr-FR") + " FCFA";
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const facilityById = (id) => facilities.find(f => f.id === id);
  function toast(msg) { const e = $("#toast"); e.textContent = msg; e.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => e.hidden = true, 2800); }
  function computeTotal() { let x = 0; const f = facilityById(state.facilityId); if (f) x += f.price; if (state.homecare) x += HOME_FEE; return x; }
  function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return `${d.getDate()} ${t("months")[d.getMonth()]} ${d.getFullYear()}`; }

  function applyI18n() {
    $$("[data-i18n]").forEach(e => e.innerHTML = t(e.dataset.i18n));
    $$("[data-i18n-ph]").forEach(e => e.placeholder = t(e.dataset.i18nPh));
    document.documentElement.lang = lang;
  }

  /* ---------------- navigation ---------------- */
  function currentView() { const v = $$(".view").find(v => !v.hidden); return v ? v.dataset.view : "home"; }
  function navTo(view) {
    $$(".view").forEach(v => v.hidden = v.dataset.view !== view);
    $$(".nav-link").forEach(b => b.classList.toggle("is-active", b.dataset.nav === view));
    $(".main-nav").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "booking") renderWizard();
    if (view === "patient") renderPatient();
    if (view === "admin") renderAdmin();
  }

  /* ---------------- account UI ---------------- */
  function renderAccount() {
    const a = $("#account");
    if (patient) {
      a.innerHTML = `<span class="account__name">${t("hello")}, ${patient.name.split(" ")[0]}</span>
        <button class="btn btn--ghost btn--sm" id="logoutBtn">${t("auth.logout")}</button>`;
      $("#logoutBtn").addEventListener("click", logout);
    } else {
      a.innerHTML = `<button class="btn btn--primary btn--sm" id="loginBtn">${t("auth.login")}</button>`;
      $("#loginBtn").addEventListener("click", () => openAuth("login"));
    }
  }
  function logout() {
    token = null; patient = null;
    localStorage.removeItem("ts_token"); localStorage.removeItem("ts_patient");
    renderAccount(); toast(t("t.loggedout"));
    if (currentView() === "patient") renderPatient();
  }

  /* ---------------- auth modal ---------------- */
  let authMode = "login", authOnSuccess = null;
  function openAuth(mode, onSuccess) {
    authMode = mode; authOnSuccess = onSuccess || null;
    $("#authErr").classList.remove("show");
    $("#authForm").reset();
    updateAuthModal();
    $("#authModal").hidden = false;
    setTimeout(() => $("#auPhone").focus(), 50);
  }
  function closeAuth() { $("#authModal").hidden = true; authOnSuccess = null; }
  function updateAuthModal() {
    const reg = authMode === "register";
    $("#authTitle").textContent = t(reg ? "auth.registerTitle" : "auth.loginTitle");
    $("#authSub").textContent = t(reg ? "auth.registerSub" : "auth.loginSub");
    $("#fldName").hidden = !reg;
    $("#authSubmit").textContent = t(reg ? "auth.register" : "auth.login");
    $("#authSwitch").innerHTML = reg
      ? `${t("auth.haveAccount")} <button type="button" id="toLogin">${t("auth.login")}</button>`
      : `${t("auth.noAccount")} <button type="button" id="toRegister">${t("auth.register")}</button>`;
    const sw = $("#toLogin") || $("#toRegister");
    if (sw) sw.addEventListener("click", () => { authMode = reg ? "login" : "register"; updateAuthModal(); });
  }
  async function submitAuth(e) {
    e.preventDefault();
    const err = $("#authErr");
    const phone = $("#auPhone").value.trim(), pass = $("#auPass").value;
    try {
      let data;
      if (authMode === "register") {
        data = await api("/auth/register", { method: "POST", body: { name: $("#auName").value.trim(), phone, password: pass } });
        toast(t("t.registered"));
      } else {
        data = await api("/auth/login", { method: "POST", body: { phone, password: pass } });
        toast(t("t.loggedin"));
      }
      token = data.token; patient = data.patient;
      localStorage.setItem("ts_token", token);
      localStorage.setItem("ts_patient", JSON.stringify(patient));
      const cb = authOnSuccess;               // capture avant closeAuth (qui le remet à null)
      closeAuth(); renderAccount(); refreshNotifs();
      if (cb) cb(); else if (currentView() === "patient") renderPatient();
    } catch (ex) {
      err.textContent = ex.message; err.classList.add("show");
    }
  }

  /* ---------------- HOME ---------------- */
  const stars = (n) => "★★★★★☆☆☆☆☆".slice(5 - n, 10 - n);
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function renderHome() {
    const wrap = $("#benefits"); wrap.innerHTML = "";
    BENEFITS.forEach(b => { const [ti, de] = b[lang]; wrap.appendChild(el("div", "card", `<span class="ic">${b.ic}</span><h3>${ti}</h3><p>${de}</p>`)); });
    const grid = $("#domainsGrid"); grid.innerHTML = "";
    BENEFITS.forEach(b => grid.appendChild(el("div", "domain", `<span class="ic">${b.ic}</span><strong>${b[lang][0]}</strong>`)));
    renderTestimonials();
  }
  async function renderTestimonials() {
    const grid = $("#testiGrid"); if (!grid) return;
    let list = [];
    try { list = await api("/testimonials"); } catch { list = []; }
    if (!list.length) { grid.innerHTML = `<p class="empty">${t("testi.empty")}</p>`; return; }
    grid.innerHTML = "";
    list.slice(0, 6).forEach(x => {
      const initial = (x.name || "?").trim().charAt(0).toUpperCase();
      grid.appendChild(el("figure", "testi",
        `<div class="testi__stars" aria-label="${x.rating}/5">${stars(x.rating)}</div>
         <blockquote>“${escapeHtml(x.body)}”</blockquote>
         <figcaption><span class="testi__ava">${initial}</span>
           <span><strong>${escapeHtml(x.name)}</strong>${x.city ? `<em>📍 ${escapeHtml(x.city)}</em>` : ""}</span></figcaption>`));
    });
  }

  /* ---------------- WIZARD ---------------- */
  const STEP_KEYS = ["step1.title", "step2.title", "step3.title", "step4.title", "step5.title"];
  function renderStepsBar() {
    const bar = $("#stepsBar"); bar.innerHTML = "";
    STEP_KEYS.forEach((k, i) => {
      const n = i + 1;
      const li = el("li", "", `<span class="n">${n}</span>${t(k).replace(/^\d+\.\s*/, "")}`);
      if (n < state.step) li.classList.add("is-done");
      if (n === state.step) li.classList.add("is-current");
      bar.appendChild(li);
    });
  }
  function renderWizard() {
    renderStepsBar();
    $$(".step").forEach(s => s.hidden = Number(s.dataset.step) !== state.step);
    $("#prevBtn").disabled = state.step === 1;
    $("#nextBtn").hidden = state.step === 5;
    updateCost();
    if (state.step === 1) renderZones();
    if (state.step === 2) renderFacilities();
    if (state.step === 3) renderSchedule();
    if (state.step === 4) renderPayment();
    if (state.step === 5) renderSummary();
  }
  function updateCost() { const x = computeTotal(); $("#costTag").textContent = x ? t("sum.total") + ": " + fmtFCFA(x) : ""; }

  const BODY_PARTS = {
    cou: "M92 70 h16 v14 h-16 z", epaule: "M70 86 h18 v12 h-18 z M112 86 h18 v12 h-18 z",
    dos: "M84 100 h32 v46 h-32 z", fesse: "M84 148 h32 v20 h-32 z",
    hanche: "M78 150 h12 v16 h-12 z M110 150 h12 v16 h-12 z",
    cuisse: "M84 170 h13 v40 h-13 z M103 170 h13 v40 h-13 z",
    genou: "M84 212 h13 v14 h-13 z M103 212 h13 v14 h-13 z",
    jambe: "M85 228 h11 v40 h-11 z M104 228 h11 v40 h-11 z",
    cheville: "M85 270 h11 v10 h-11 z M104 270 h11 v10 h-11 z",
    pied: "M82 282 h16 v9 h-16 z M102 282 h16 v9 h-16 z"
  };
  function renderZones() {
    const map = $("#bodymap");
    const paths = Object.entries(BODY_PARTS).map(([id, d]) =>
      `<path class="bp ${state.zones.has(id) ? "sel" : ""}" data-zone="${id}" d="${d}"><title>${zoneName(id)}</title></path>`).join("");
    map.innerHTML = `<svg viewBox="0 0 200 300" role="img" aria-label="Silhouette corporelle">
      <ellipse class="body-outline" cx="100" cy="44" rx="14" ry="15"/>
      <rect class="body-outline" x="82" y="58" width="36" height="8" rx="4"/>${paths}</svg>`;
    map.querySelectorAll(".bp").forEach(p => p.addEventListener("click", () => toggleZone(p.dataset.zone)));
    const chips = $("#zoneChips"); chips.innerHTML = "";
    ZONES.forEach(z => { const c = el("button", "zone-chip" + (state.zones.has(z.id) ? " sel" : ""), z[lang]); c.addEventListener("click", () => toggleZone(z.id)); chips.appendChild(c); });
    $("#wellness").checked = state.wellness;
    $("#wellness").onchange = (e) => { state.wellness = e.target.checked; };
  }
  function toggleZone(id) { if (state.zones.has(id)) state.zones.delete(id); else state.zones.add(id); renderZones(); }

  function renderFacilities() {
    const wrap = $("#facilities"); wrap.innerHTML = "";
    if (!facilities.length) { wrap.innerHTML = `<p class="empty">…</p>`; return; }
    facilities.forEach(f => {
      const sel = state.facilityId === f.id;
      const card = el("label", "facility" + (sel ? " sel" : ""),
        `<input type="radio" name="facility" ${sel ? "checked" : ""}>
         <div><h4>${f.name}</h4><span class="meta">📍 ${f.city}</span>
         <span class="price">${fmtFCFA(f.price)} / ${lang === "fr" ? "séance" : "session"}</span></div>`);
      card.addEventListener("click", () => { state.facilityId = f.id; renderFacilities(); updateCost(); });
      wrap.appendChild(card);
    });
  }

  function renderSchedule() {
    renderCalendar(); renderClock(); renderTimeslots();
    $("#homecare").checked = state.homecare;
    $("#homecare").onchange = (e) => { state.homecare = e.target.checked; updateCost(); };
  }
  function renderCalendar() {
    const { y, m } = state.calMonth, cal = $("#calendar");
    const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let html = `<div class="cal-head"><button data-cal="-1">‹</button><strong>${t("months")[m]} ${y}</strong><button data-cal="1">›</button></div><div class="cal-grid">`;
    t("dow").forEach(d => html += `<div class="dow">${d}</div>`);
    for (let i = 0; i < startDow; i++) html += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m, d), iso = dt.toISOString().slice(0, 10), past = dt < today, sel = state.date === iso;
      html += `<button class="cal-day ${sel ? "sel" : ""}" data-day="${iso}" ${past ? "disabled" : ""}>${d}</button>`;
    }
    cal.innerHTML = html + `</div>`;
    cal.querySelectorAll("[data-cal]").forEach(b => b.addEventListener("click", () => {
      let nm = m + Number(b.dataset.cal), ny = y;
      if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; }
      state.calMonth = { y: ny, m: nm }; renderCalendar();
    }));
    cal.querySelectorAll("[data-day]").forEach(b => b.addEventListener("click", () => { state.date = b.dataset.day; renderCalendar(); }));
  }
  const SLOTS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
  function renderTimeslots() {
    const wrap = $("#timeslots"); wrap.innerHTML = "";
    SLOTS.forEach(s => { const b = el("button", "slot" + (state.time === s ? " sel" : ""), s); b.addEventListener("click", () => { state.time = s; renderTimeslots(); renderClock(); }); wrap.appendChild(b); });
  }
  function renderClock() {
    const [hh, mm] = (state.time || "10:00").split(":").map(Number);
    $("#clock").innerHTML = `<div class="hand h" style="transform:rotate(${(hh % 12) * 30 + mm * 0.5}deg)"></div>
      <div class="hand m" style="transform:rotate(${mm * 6}deg)"></div><div class="pin"></div>
      <div class="lbl">${state.time || "--:--"}</div>`;
  }

  function renderPayment() {
    const wrap = $("#payMethods"); wrap.innerHTML = "";
    PAY_METHODS.forEach(p => {
      const sel = state.payMethod === p.id;
      const b = el("div", "paymethod" + (sel ? " sel" : ""), `<span class="badge ${p.cls}">${p.badge}</span> ${p.label}`);
      b.addEventListener("click", () => { state.payMethod = p.id; renderPayment(); });
      wrap.appendChild(b);
    });
    const form = $("#payForm");
    if (!state.payMethod) { form.innerHTML = `<p class="hint">${lang === "fr" ? "Sélectionnez un mode de paiement." : "Select a payment method."}</p>`; state.payValid = false; return; }
    if (state.payMethod === "mc") {
      form.innerHTML = `<div class="field"><label>${t("pay.name")}</label><input id="f_name"></div>
        <div class="field"><label>${t("pay.card")}</label><input id="f_card" inputmode="numeric" placeholder="•••• •••• •••• ••••"></div>
        <div style="display:flex;gap:.9rem"><div class="field" style="flex:1"><label>${t("pay.exp")}</label><input id="f_exp" placeholder="MM/AA"></div>
        <div class="field" style="width:110px"><label>${t("pay.cvv")}</label><input id="f_cvv" inputmode="numeric" placeholder="•••"></div></div>`;
    } else {
      form.innerHTML = `<div class="field"><label>${t("pay.name")}</label><input id="f_name"></div>
        <div class="field"><label>${t("pay.phone")}</label><input id="f_phone" inputmode="tel" placeholder="+237 6XX XXX XXX"></div>`;
    }
    form.querySelectorAll("input").forEach(i => i.addEventListener("input", validatePay));
    validatePay();
  }
  function validatePay() {
    let ok = false;
    if (state.payMethod === "mc") {
      const card = ($("#f_card")?.value || "").replace(/\s/g, "");
      ok = ($("#f_name")?.value || "").trim().length > 2 && card.length >= 12 && /\d{2}\/\d{2}/.test($("#f_exp")?.value || "") && ($("#f_cvv")?.value || "").length >= 3;
    } else if (state.payMethod) {
      ok = ($("#f_name")?.value || "").trim().length > 2 && ($("#f_phone")?.value || "").replace(/\D/g, "").length >= 8;
    }
    state.payValid = ok; return ok;
  }
  function payPhone() { return ($("#f_phone")?.value || "").trim(); }

  function renderSummary() {
    const f = facilityById(state.facilityId);
    const zonesTxt = state.zones.size ? [...state.zones].map(zoneName).join(", ") : (state.wellness ? t("wellness") : "—");
    const pm = PAY_METHODS.find(p => p.id === state.payMethod);
    $("#summary").innerHTML = `
      <div class="row"><span>${t("sum.zones")}</span><strong>${zonesTxt}${state.zones.size && state.wellness ? " + " + t("wellness") : ""}</strong></div>
      <div class="row"><span>${t("sum.facility")}</span><strong>${f ? f.name + " — " + f.city : "—"}</strong></div>
      <div class="row"><span>${t("sum.date")}</span><strong>${fmtDate(state.date)}</strong></div>
      <div class="row"><span>${t("sum.time")}</span><strong>${state.time || "—"}</strong></div>
      <div class="row"><span>${t("sum.home")}</span><strong>${state.homecare ? t("sum.yes") : t("sum.no")}</strong></div>
      <div class="row"><span>${t("sum.pay")}</span><strong>${pm ? pm.label : "—"}</strong></div>
      <div class="row total"><span>${t("sum.total")}</span><strong>${fmtFCFA(computeTotal())}</strong></div>`;
  }

  function canAdvance() {
    switch (state.step) {
      case 1: if (!state.zones.size && !state.wellness) { toast(t("t.needZone")); return false; } return true;
      case 2: if (!state.facilityId) { toast(t("t.needFacility")); return false; } return true;
      case 3: if (!state.date || !state.time) { toast(t("t.needSchedule")); return false; } return true;
      case 4: if (!validatePay()) { toast(t("t.needPay")); return false; } return true;
      default: return true;
    }
  }

  /* ----- save + pay ----- */
  let saving = false;
  async function saveAppointment() {
    if (saving) return;
    if (!validatePay()) { toast(t("t.needPay")); return; }
    if (!token) { openAuth("login", saveAppointment); toast(t("auth.needLogin")); return; }
    saving = true;
    const btn = $("#saveBtn"); btn.disabled = true;
    const status = $("#payStatus");
    try {
      const appt = await api("/appointments", { method: "POST", auth: true, body: {
        zones: [...state.zones], wellness: state.wellness, facility_id: state.facilityId,
        date: state.date, time: state.time, homecare: state.homecare
      }});
      state.step = 4; renderWizard();
      status.className = "pay-status show"; status.textContent = t("pay.processing");
      const pay = await api("/payments", { method: "POST", auth: true, body: {
        appointment_id: appt.id, method: state.payMethod, phone: payPhone()
      }});
      let finalStatus = pay.status;
      if (pay.status === "pending") {
        status.textContent = t("pay.pending");
        finalStatus = await pollPayment(pay.payment_id);
      }
      if (finalStatus === "success") {
        status.className = "pay-status show"; status.textContent = t("pay.success");
        toast(t("t.saved"));
        const full = await api("/appointments?lang=" + lang, { auth: true });
        const saved = full.find(a => a.id === appt.id) || appt;
        showReceipt(saved);
        refreshNotifs();
        resetBooking();
      } else {
        status.textContent = t("pay.failed");
      }
    } catch (ex) {
      status.className = "pay-status show"; status.textContent = ex.message;
    } finally {
      saving = false; btn.disabled = false;
    }
  }
  function pollPayment(pid) {
    return new Promise((resolve) => {
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        try {
          const r = await api(`/payments/${pid}/status`, { auth: true });
          if (r.status === "success" || r.status === "failed" || tries > 40) { clearInterval(iv); resolve(r.status); }
        } catch { clearInterval(iv); resolve("failed"); }
      }, 3000);
    });
  }
  function resetBooking() {
    state.step = 1; state.zones = new Set(); state.wellness = false; state.facilityId = null;
    state.date = null; state.time = null; state.homecare = false; state.payMethod = null; state.payValid = false;
  }

  /* ----- receipt ----- */
  let currentReceipt = null;
  function showReceipt(a) {
    currentReceipt = a;
    const zonesTxt = (a.zoneLabels && a.zoneLabels.length) ? a.zoneLabels.join(", ")
      : (a.zones && a.zones.length ? a.zones.map(zoneName).join(", ") : (a.wellness ? t("wellness") : "—"));
    const pm = PAY_METHODS.find(p => p.id === state.payMethod);
    $("#receipt").innerHTML = `
      <div class="rc-head"><img src="assets/logo.svg" alt="Top S'ASSUR">
        <div class="rc-title"><h2>Top S'ASSUR</h2><span>${t("receipt.for")}</span></div></div>
      <div class="rc-row"><span>${t("receipt.ref")}</span><span class="rc-code">${a.ref}</span></div>
      <div class="rc-row"><span>${t("receipt.patient")}</span><span>${patient ? patient.name : "—"}</span></div>
      <div class="rc-row"><span>${t("sum.zones")}</span><span>${zonesTxt}</span></div>
      <div class="rc-row"><span>${t("sum.facility")}</span><span>${a.facility ? a.facility.name + " — " + a.facility.city : "—"}</span></div>
      <div class="rc-row"><span>${t("sum.date")}</span><span>${fmtDate(a.date)} — ${a.time}</span></div>
      <div class="rc-row"><span>${t("sum.home")}</span><span>${a.homecare ? t("sum.yes") : t("sum.no")}</span></div>
      <div class="rc-total"><span>${t("sum.total")}</span><span>${fmtFCFA(a.total)}</span></div>
      <div class="rc-foot">${t("receipt.present")}</div>`;
    $("#receiptOverlay").hidden = false;
  }
  async function downloadReceiptPDF() {
    if (!currentReceipt) return;
    try {
      const res = await fetch(`/api/appointments/${currentReceipt.id}/receipt.pdf?lang=${lang}`, {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) throw new Error(t("err.generic"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "recu-top-sassur-" + currentReceipt.ref + ".pdf";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (ex) { toast(ex.message); }
  }

  /* ---------------- PATIENT ---------------- */
  async function renderPatient() {
    const gate = $("#patientGate"), content = $("#patientContent");
    if (!token) {
      content.hidden = true; gate.hidden = false;
      gate.innerHTML = `<div class="gate"><p>${t("auth.gate")}</p><button class="btn btn--primary" id="patientLogin">${t("auth.login")}</button></div>`;
      $("#patientLogin").addEventListener("click", () => openAuth("login", () => renderPatient()));
      return;
    }
    gate.hidden = true; content.hidden = false;
    let appts = [];
    try { appts = await api("/appointments?lang=" + lang, { auth: true }); }
    catch (ex) { if (String(ex.message).length) { logout(); return renderPatient(); } }
    const hist = $("#patientHistory");
    if (!appts.length) hist.innerHTML = `<p class="empty">${t("patient.empty")}</p>`;
    else {
      hist.innerHTML = "";
      appts.forEach(a => {
        const tags = (a.zoneLabels || []).map(z => `<span class="tag">${z}</span>`).join("") + (a.wellness ? `<span class="tag">${t("wellness")}</span>` : "");
        const paid = a.status === "paid";
        const card = el("div", "record",
          `<div class="top"><span>${a.facility ? a.facility.name : "—"}</span><span>${fmtFCFA(a.total)}</span></div>
           <div class="sub">${fmtDate(a.date)} — ${a.time}${a.homecare ? " • " + t("sum.home") : ""}</div>
           <div class="tags">${tags}</div>
           <div class="actions">${paid ? `<button class="link-btn" data-id="${a.id}">📄 ${t("pdf")}</button>` : ""}<span class="rc-code" style="font-size:.72rem">${a.ref}</span></div>`);
        const btn = card.querySelector("[data-id]");
        if (btn) btn.addEventListener("click", () => { showReceipt(a); });
        hist.appendChild(card);
      });
    }
    const track = $("#painTracking"), counts = {};
    appts.forEach(a => (a.zones || []).forEach(z => counts[z] = (counts[z] || 0) + 1));
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) track.innerHTML = `<p class="empty">${t("patient.empty")}</p>`;
    else {
      const max = entries[0][1];
      track.innerHTML = entries.map(([z, c]) =>
        `<div class="bar-label"><span>${zoneName(z)}</span><span>${c}×</span></div><div class="bar"><span style="width:${Math.round(c / max * 100)}%"></span></div>`).join("");
    }
    renderRewards();
    renderTestiForm();
  }

  /* ---------------- REWARDS (gamification) ---------------- */
  async function renderRewards() {
    const box = $("#rewardsBox"); if (!box) return;
    let r;
    try { r = await api("/patient/rewards?lang=" + lang, { auth: true }); }
    catch { box.innerHTML = `<p class="empty">${t("rewards.empty")}</p>`; return; }
    const earned = r.badges.filter(b => b.earned);
    const next = r.badges.find(b => !b.earned);
    const pct = Math.round((r.levelProgress / r.levelSpan) * 100);
    box.innerHTML = `
      <div class="reward-head">
        <div class="reward-points"><strong>${r.points}</strong><span>${t("rewards.points")}</span></div>
        <div class="reward-level">
          <div class="reward-level__top"><span>${t("rewards.level")} ${r.level}</span><span>${r.sessions} ${t("rewards.sessions")}</span></div>
          <div class="reward-bar"><span style="width:${pct}%"></span></div>
        </div>
      </div>
      ${next ? `<div class="reward-next">${t("rewards.next")} : <strong>${next.icon} ${escapeHtml(next.title)}</strong> — ${next.progress}/${next.threshold}</div>` : ""}
      <h4 class="reward-badges-h">${t("rewards.badges")} · ${earned.length}/${r.badges.length}</h4>
      <div class="badges">
        ${r.badges.map(b => `
          <div class="badge-card ${b.earned ? "on" : "off"}" title="${escapeHtml(b.desc)}">
            <span class="badge-ic">${b.icon}</span>
            <strong>${escapeHtml(b.title)}</strong>
            <small>${escapeHtml(b.desc)}</small>
            ${b.earned ? `<span class="badge-tick">✓</span>` : `<span class="badge-prog">${b.progress}/${b.threshold}</span>`}
          </div>`).join("")}
      </div>`;
  }

  /* ---------------- TESTIMONIAL FORM ---------------- */
  function renderTestiForm() {
    const box = $("#testiFormBox"); if (!box) return;
    let rating = 5;
    box.innerHTML = `
      <div class="field">
        <label>${t("testi.rating")}</label>
        <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="star ${i <= rating ? "on" : ""}" data-v="${i}">★</button>`).join("")}</div>
      </div>
      <div class="field"><label>${t("testi.city")}</label><input id="tCity" placeholder="${lang === "fr" ? "Douala, Yaoundé…" : "Douala, Yaoundé…"}"></div>
      <div class="field"><textarea id="tBody" rows="3" placeholder="${t("testi.placeholder")}"></textarea></div>
      <button class="btn btn--primary" id="tSubmit">${t("testi.submit")}</button>`;
    const paint = () => box.querySelectorAll(".star").forEach(s => s.classList.toggle("on", Number(s.dataset.v) <= rating));
    box.querySelectorAll(".star").forEach(s => s.addEventListener("click", () => { rating = Number(s.dataset.v); paint(); }));
    $("#tSubmit").addEventListener("click", async () => {
      const body = $("#tBody").value.trim();
      if (body.length < 10) { toast(t("testi.needText")); return; }
      try {
        await api("/testimonials", { method: "POST", auth: true, body: { rating, body, city: $("#tCity").value.trim() } });
        toast(t("testi.thanks"));
        renderTestiForm();
        renderTestimonials();
      } catch (ex) { toast(ex.message); }
    });
  }

  /* ---------------- ADMIN ---------------- */
  async function renderAdmin() {
    const gate = $("#adminGate"), content = $("#adminContent");
    if (!adminToken) {
      content.hidden = true; gate.hidden = false;
      gate.innerHTML = `<div class="panel admin-login"><h3>${t("admin.loginTitle")}</h3>
        <div class="err" id="adminErr"></div>
        <div class="field"><label>${t("admin.username")}</label><input id="adUser" value="admin"></div>
        <div class="field"><label>${t("auth.password")}</label><input id="adPass" type="password"></div>
        <button class="btn btn--primary" id="adminLoginBtn" style="width:100%">${t("auth.login")}</button></div>`;
      $("#adminLoginBtn").addEventListener("click", adminLogin);
      return;
    }
    gate.hidden = true; content.hidden = false;
    try {
      const [stats, facs, pays] = await Promise.all([
        api("/admin/stats", { admin: true }), api("/facilities"), api("/admin/payments", { admin: true })
      ]);
      $("#adminStats").innerHTML = `
        <div class="stat"><strong>${stats.appointments}</strong><span>${t("stat.appts")}</span></div>
        <div class="stat"><strong>${stats.revenue.toLocaleString("fr-FR")}</strong><span>${t("stat.revenue")}</span></div>
        <div class="stat"><strong>${stats.partners}</strong><span>${t("stat.partners")}</span></div>
        <div class="stat"><strong>${stats.patients}</strong><span>${t("stat.patients")}</span></div>
        <div class="stat"><strong>${stats.homecare}</strong><span>${t("stat.home")}</span></div>`;
      const list = $("#partnerList"); list.innerHTML = "";
      facs.forEach(f => {
        const row = el("div", "partner-row",
          `<div><strong>${f.name}</strong><br><span class="sub">📍 ${f.city} • ${fmtFCFA(f.price)}</span></div><button class="del" data-id="${f.id}">✕</button>`);
        row.querySelector(".del").addEventListener("click", async () => {
          await api("/admin/facilities/" + f.id, { method: "DELETE", admin: true });
          toast(t("t.deleted")); facilities = await api("/facilities"); renderAdmin();
        });
        list.appendChild(row);
      });
      const pl = $("#paymentList");
      if (!pays.length) pl.innerHTML = `<p class="empty">${t("patient.empty")}</p>`;
      else {
        pl.innerHTML = "";
        pays.forEach(p => {
          const pm = PAY_METHODS.find(x => x.id === p.method);
          pl.appendChild(el("div", "partner-row",
            `<div><strong>${p.ref}</strong><br><span class="sub">${pm ? pm.label : p.method} • ${p.status} • ${fmtDate(p.date)}</span></div><strong style="color:var(--green-700)">${fmtFCFA(p.amount)}</strong>`));
        });
      }
    } catch (ex) { adminToken = null; localStorage.removeItem("ts_admin_token"); renderAdmin(); }
  }
  async function adminLogin() {
    const err = $("#adminErr");
    try {
      const d = await api("/admin/login", { method: "POST", body: { username: $("#adUser").value.trim(), password: $("#adPass").value } });
      adminToken = d.token; localStorage.setItem("ts_admin_token", adminToken); renderAdmin();
    } catch (ex) { err.textContent = ex.message; err.classList.add("show"); }
  }

  /* ---------------- NOTIFICATIONS ---------------- */
  async function refreshNotifs() {
    let notifs = [];
    if (token) { try { notifs = await api("/notifications", { auth: true }); } catch { notifs = []; } }
    const c = $("#bellCount");
    if (notifs.length) { c.hidden = false; c.textContent = notifs.length; } else c.hidden = true;
    $("#notifList").innerHTML = notifs.length
      ? notifs.map(n => `<li><strong>${n.title}</strong><small>${n.body}</small></li>`).join("")
      : `<li><small>${lang === "fr" ? "Aucune notification." : "No notifications."}</small></li>`;
  }

  /* ---------------- events ---------------- */
  function bind() {
    $$("[data-nav]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); navTo(b.dataset.nav); }));
    $$("[data-scroll]").forEach(b => b.addEventListener("click", () => { const e = document.getElementById(b.dataset.scroll); e && e.scrollIntoView({ behavior: "smooth" }); }));
    $$(".lang").forEach(b => b.addEventListener("click", () => {
      lang = b.dataset.lang; localStorage.setItem("ts_lang", lang);
      $$(".lang").forEach(x => x.classList.toggle("is-active", x === b));
      applyI18n(); renderHome(); renderAccount(); refreshNotifs();
      const v = currentView();
      if (v === "booking") renderWizard(); if (v === "patient") renderPatient(); if (v === "admin") renderAdmin();
    }));
    $("#burger").addEventListener("click", () => $(".main-nav").classList.toggle("open"));
    $("#bellBtn").addEventListener("click", () => { const p = $("#notifPanel"); p.hidden = !p.hidden; });
    $("#nextBtn").addEventListener("click", () => { if (state.step < 5 && canAdvance()) { state.step++; renderWizard(); } });
    $("#prevBtn").addEventListener("click", () => { if (state.step > 1) { state.step--; renderWizard(); } });
    $("#saveBtn").addEventListener("click", saveAppointment);
    $("#downloadPdf").addEventListener("click", downloadReceiptPDF);
    $("#closeReceipt").addEventListener("click", () => $("#receiptOverlay").hidden = true);
    $("#authForm").addEventListener("submit", submitAuth);
    $("#authClose").addEventListener("click", closeAuth);
    $("#addPartner").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#pName").value.trim(), city = $("#pCity").value.trim(), price = Number($("#pPrice").value);
      if (!name || !city || !price) return;
      try { await api("/admin/facilities", { method: "POST", admin: true, body: { name, city, price } });
        e.target.reset(); toast(t("t.added")); facilities = await api("/facilities"); renderAdmin();
      } catch (ex) { toast(ex.message); }
    });
  }

  /* ---------------- init ---------------- */
  async function init() {
    $("#year").textContent = new Date().getFullYear();
    $$(".lang").forEach(x => x.classList.toggle("is-active", x.dataset.lang === lang));
    applyI18n(); renderHome(); renderAccount(); bind();
    try { facilities = await api("/facilities"); } catch { facilities = []; }
    refreshNotifs();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
