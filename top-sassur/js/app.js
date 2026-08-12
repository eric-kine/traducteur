/* =====================================================================
   Top S'ASSUR — prototype front-end (web & mobile)
   Aucune dépendance externe. Données persistées via localStorage.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- i18n ---------------- */
  const I18N = {
    fr: {
      "brand.tagline": "Assurance Santé",
      "nav.home": "Accueil", "nav.booking": "Prendre RDV",
      "nav.patient": "Espace patient", "nav.admin": "Admin",
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
      "step3.time": "Heure du rendez-vous",
      "step3.home": "Soins à domicile (+ 3 000 FCFA)",
      "step4.title": "4. Paiement sécurisé",
      "step5.title": "5. Validation", "step5.save": "Enregistrer",
      "wiz.prev": "Précédent", "wiz.next": "Suivant",
      "patient.title": "Espace patient",
      "patient.history": "Historique des rendez-vous",
      "patient.tracking": "Suivi des zones douloureuses",
      "admin.title": "Espace administrateur",
      "admin.partners": "Gestion des partenaires",
      "admin.payments": "Suivi des paiements",
      "admin.name": "Nom de l'établissement", "admin.city": "Ville",
      "admin.price": "Tarif séance (FCFA)", "admin.add": "Ajouter",
      "foot.rights": "Assurance santé kinésithérapie",
      "foot.security": "🔒 Données patients chiffrées — conformité aux standards de protection des données médicales.",
      "receipt.download": "Télécharger le reçu PDF", "receipt.close": "Fermer",
      "pay.phone": "Numéro de téléphone", "pay.name": "Nom du titulaire",
      "pay.card": "Numéro de carte", "pay.exp": "Expiration", "pay.cvv": "CVV",
      "sum.zones": "Zones / soins", "sum.facility": "Établissement",
      "sum.date": "Date", "sum.time": "Heure", "sum.home": "Soins à domicile",
      "sum.pay": "Paiement", "sum.total": "Total à payer", "sum.yes": "Oui", "sum.no": "Non",
      "months": ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
      "dow": ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],
      "t.saved": "Rendez-vous enregistré ✓ Reçu PDF généré.",
      "t.needZone": "Sélectionnez au moins une zone ou le bien-être.",
      "t.needFacility": "Choisissez un établissement.",
      "t.needSchedule": "Choisissez une date et une heure.",
      "t.needPay": "Complétez les informations de paiement.",
      "t.added": "Partenaire ajouté ✓", "t.deleted": "Partenaire supprimé.",
      "notif.reminder": "Rappel : RDV kiné", "notif.followup": "Suivi de vos soins",
      "wellness": "Bien-être corporel",
      "receipt.for": "Reçu officiel de prise en charge",
      "receipt.ref": "Référence", "receipt.patient": "Patient",
      "receipt.present": "À présenter à l'accueil de l'établissement le jour du rendez-vous.",
      "stat.appts": "Rendez-vous", "stat.revenue": "Recettes (FCFA)",
      "stat.partners": "Partenaires", "stat.home": "Soins à domicile",
      "patient.empty": "Aucun rendez-vous pour l'instant.",
      "pdf": "Reçu PDF", "again": "Reprendre RDV",
      "guest": "Patient invité"
    },
    en: {
      "brand.tagline": "Health Insurance",
      "nav.home": "Home", "nav.booking": "Book",
      "nav.patient": "My space", "nav.admin": "Admin",
      "notif.title": "Notifications",
      "home.pill": "Health insurance • Physiotherapy",
      "home.title": "Your physio care, finally affordable.",
      "home.lead": "Top S'ASSUR makes rehabilitation affordable for informal-sector workers in Cameroon. Pick your pain, your partner clinic, your appointment — and pay with ease.",
      "home.cta": "Start my care", "home.learn": "Our mission",
      "home.stat1": "of the active population in the informal sector",
      "home.stat2": "areas of physiotherapy covered",
      "home.stat3": "official receipt for every visit",
      "home.ctaband": "Ready to take care of yourself?",
      "mission.title": "Why Top S'ASSUR?",
      "mission.lead": "In Cameroon, physiotherapy is expensive and out of reach for most. Our app pools access to care so everyone — driver, trader, craftsperson — can heal without going broke.",
      "domains.title": "Areas of care",
      "step1.title": "1. Where does it hurt?",
      "step1.hint": "Select one or more areas. No specific pain? Choose body wellness.",
      "step1.wellness": "No pain — body wellness care",
      "step2.title": "2. Choose your facility",
      "step2.hint": "Partner clinics and hospitals near you.",
      "step3.title": "3. Schedule your appointment",
      "step3.time": "Appointment time",
      "step3.home": "Home care (+ 3,000 FCFA)",
      "step4.title": "4. Secure payment",
      "step5.title": "5. Confirmation", "step5.save": "Save",
      "wiz.prev": "Back", "wiz.next": "Next",
      "patient.title": "My space",
      "patient.history": "Appointment history",
      "patient.tracking": "Pain-area tracking",
      "admin.title": "Administrator space",
      "admin.partners": "Partner management",
      "admin.payments": "Payment tracking",
      "admin.name": "Facility name", "admin.city": "City",
      "admin.price": "Session price (FCFA)", "admin.add": "Add",
      "foot.rights": "Physiotherapy health insurance",
      "foot.security": "🔒 Encrypted patient data — compliant with medical data-protection standards.",
      "receipt.download": "Download PDF receipt", "receipt.close": "Close",
      "pay.phone": "Phone number", "pay.name": "Cardholder name",
      "pay.card": "Card number", "pay.exp": "Expiry", "pay.cvv": "CVV",
      "sum.zones": "Areas / care", "sum.facility": "Facility",
      "sum.date": "Date", "sum.time": "Time", "sum.home": "Home care",
      "sum.pay": "Payment", "sum.total": "Total due", "sum.yes": "Yes", "sum.no": "No",
      "months": ["January","February","March","April","May","June","July","August","September","October","November","December"],
      "dow": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      "t.saved": "Appointment saved ✓ PDF receipt generated.",
      "t.needZone": "Select at least one area or wellness.",
      "t.needFacility": "Choose a facility.",
      "t.needSchedule": "Choose a date and time.",
      "t.needPay": "Complete the payment details.",
      "t.added": "Partner added ✓", "t.deleted": "Partner removed.",
      "notif.reminder": "Reminder: physio appointment", "notif.followup": "Care follow-up",
      "wellness": "Body wellness",
      "receipt.for": "Official care receipt",
      "receipt.ref": "Reference", "receipt.patient": "Patient",
      "receipt.present": "Present this at the facility's reception on the day of your appointment.",
      "stat.appts": "Appointments", "stat.revenue": "Revenue (FCFA)",
      "stat.partners": "Partners", "stat.home": "Home care",
      "patient.empty": "No appointments yet.",
      "pdf": "PDF receipt", "again": "Book again",
      "guest": "Guest patient"
    }
  };

  let lang = localStorage.getItem("ts_lang") || "fr";
  const t = (k) => (I18N[lang][k] !== undefined ? I18N[lang][k] : k);

  /* ---------------- static data ---------------- */
  const BENEFITS = [
    { ic: "🧠", fr: ["Neurologie", "Récupération après AVC, paralysies, troubles de l'équilibre et de la coordination."],
      en: ["Neurology", "Recovery after stroke, paralysis, balance and coordination disorders."] },
    { ic: "🦴", fr: ["Traumatologie", "Rééducation après fractures, entorses et accidents."],
      en: ["Traumatology", "Rehab after fractures, sprains and accidents."] },
    { ic: "🖐️", fr: ["Rhumatologie", "Soulagement des douleurs articulaires et de l'arthrose."],
      en: ["Rheumatology", "Relief of joint pain and osteoarthritis."] },
    { ic: "🤰", fr: ["Gynécologie", "Rééducation périnéale, suivi pré et post-natal."],
      en: ["Gynecology", "Perineal rehab, pre- and post-natal follow-up."] },
    { ic: "🦵", fr: ["Orthopédie", "Rééducation post-opératoire, prothèses, posture."],
      en: ["Orthopedics", "Post-op rehab, prostheses, posture."] },
    { ic: "🌿", fr: ["Bien-être corporel", "Massage, relaxation, prévention et entretien physique."],
      en: ["Body wellness", "Massage, relaxation, prevention and physical upkeep."] }
  ];

  // zones: id -> {fr,en, cy: y position on body map for a marker}
  const ZONES = [
    { id: "cou",      fr: "Cou",      en: "Neck" },
    { id: "epaule",   fr: "Épaule",   en: "Shoulder" },
    { id: "dos",      fr: "Dos",      en: "Back" },
    { id: "fesse",    fr: "Fesse",    en: "Buttock" },
    { id: "hanche",   fr: "Hanche",   en: "Hip" },
    { id: "cuisse",   fr: "Cuisse",   en: "Thigh" },
    { id: "genou",    fr: "Genou",    en: "Knee" },
    { id: "jambe",    fr: "Jambe",    en: "Leg" },
    { id: "cheville",  fr: "Cheville", en: "Ankle" },
    { id: "pied",     fr: "Pied",     en: "Foot" }
  ];
  const zoneName = (id) => { const z = ZONES.find(z => z.id === id); return z ? z[lang] : id; };

  const PAY_METHODS = [
    { id: "om",   label: "Orange Money", cls: "om",   badge: "OM" },
    { id: "momo", label: "MTN Mobile Money", cls: "momo", badge: "MoMo" },
    { id: "mc",   label: "MasterCard",   cls: "mc",   badge: "MC" }
  ];

  const HOME_FEE = 3000;

  /* ---------------- persisted stores ---------------- */
  const store = {
    get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };
  const DEFAULT_FACILITIES = [
    { id: "f1", name: "Clinique de la Cité Verte", city: "Yaoundé", price: 5000 },
    { id: "f2", name: "Hôpital Général de Douala", city: "Douala", price: 6000 },
    { id: "f3", name: "Centre de Kiné Bonapriso", city: "Douala", price: 5500 },
    { id: "f4", name: "Polyclinique Bonanjo", city: "Douala", price: 7000 },
    { id: "f5", name: "Clinique Odyssée", city: "Yaoundé", price: 6500 },
    { id: "f6", name: "Hôpital de District de Bafoussam", city: "Bafoussam", price: 4500 }
  ];
  let facilities = store.get("ts_facilities", null);
  if (!facilities) { facilities = DEFAULT_FACILITIES; store.set("ts_facilities", facilities); }
  let appointments = store.get("ts_appointments", []);
  let notifications = store.get("ts_notifs", []);

  /* ---------------- booking state ---------------- */
  const state = {
    step: 1,
    zones: new Set(),
    wellness: false,
    facilityId: null,
    date: null,       // ISO date string
    time: null,       // "HH:MM"
    homecare: false,
    payMethod: null,
    payValid: false,
    calMonth: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })()
  };

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmtFCFA = (n) => n.toLocaleString("fr-FR") + " FCFA";
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const facilityById = (id) => facilities.find(f => f.id === id);

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 2600);
  }

  function computeTotal() {
    let total = 0;
    const f = facilityById(state.facilityId);
    if (f) total += f.price;
    if (state.homecare) total += HOME_FEE;
    return total;
  }

  /* ---------------- i18n render ---------------- */
  function applyI18n() {
    $$("[data-i18n]").forEach(e => e.innerHTML = t(e.dataset.i18n));
    $$("[data-i18n-ph]").forEach(e => e.placeholder = t(e.dataset.i18nPh));
    document.documentElement.lang = lang;
  }

  /* ---------------- navigation ---------------- */
  function navTo(view) {
    $$(".view").forEach(v => v.hidden = v.dataset.view !== view);
    $$(".nav-link").forEach(b => b.classList.toggle("is-active", b.dataset.nav === view));
    $(".main-nav").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "booking") renderWizard();
    if (view === "patient") renderPatient();
    if (view === "admin") renderAdmin();
  }

  /* ---------------- HOME ---------------- */
  function renderHome() {
    const wrap = $("#benefits"); wrap.innerHTML = "";
    BENEFITS.forEach(b => {
      const [title, desc] = b[lang];
      wrap.appendChild(el("div", "card", `<span class="ic">${b.ic}</span><h3>${title}</h3><p>${desc}</p>`));
    });
    const grid = $("#domainsGrid"); grid.innerHTML = "";
    BENEFITS.forEach(b => {
      const [title] = b[lang];
      grid.appendChild(el("div", "domain", `<span class="ic">${b.ic}</span><strong>${title}</strong>`));
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
    $("#nextBtn").textContent = state.step === 5 ? t("step5.save") : t("wiz.next");
    $("#nextBtn").hidden = state.step === 5; // step 5 has its own save button
    const total = computeTotal();
    $("#costTag").textContent = total ? t("sum.total") + ": " + fmtFCFA(total) : "";
    if (state.step === 1) renderZones();
    if (state.step === 2) renderFacilities();
    if (state.step === 3) renderSchedule();
    if (state.step === 4) renderPayment();
    if (state.step === 5) renderSummary();
  }

  /* ----- step 1: body map + zones ----- */
  const BODY_PARTS = {
    cou:      "M92 70 h16 v14 h-16 z",
    epaule:   "M70 86 h18 v12 h-18 z M112 86 h18 v12 h-18 z",
    dos:      "M84 100 h32 v46 h-32 z",
    fesse:    "M84 148 h32 v20 h-32 z",
    hanche:   "M78 150 h12 v16 h-12 z M110 150 h12 v16 h-12 z",
    cuisse:   "M84 170 h13 v40 h-13 z M103 170 h13 v40 h-13 z",
    genou:    "M84 212 h13 v14 h-13 z M103 212 h13 v14 h-13 z",
    jambe:    "M85 228 h11 v40 h-11 z M104 228 h11 v40 h-11 z",
    cheville:  "M85 270 h11 v10 h-11 z M104 270 h11 v10 h-11 z",
    pied:     "M82 282 h16 v9 h-16 z M102 282 h16 v9 h-16 z"
  };
  function renderZones() {
    // body map
    const map = $("#bodymap");
    const paths = Object.entries(BODY_PARTS).map(([id, d]) =>
      `<path class="bp ${state.zones.has(id) ? "sel" : ""}" data-zone="${id}" d="${d}"><title>${zoneName(id)}</title></path>`
    ).join("");
    map.innerHTML = `<svg viewBox="0 0 200 300" role="img" aria-label="Silhouette corporelle">
      <path class="body-outline" d="M100 30 a14 14 0 0 1 14 14 a14 14 0 0 1 -6 11 l4 8 h14 a8 8 0 0 1 8 8 l-6 40 l-4 2 l-2 60 h-8 l-4 -34 h-20 l-4 34 h-8 l-2 -60 l-4 -2 l-6 -40 a8 8 0 0 1 8 -8 h14 l4 -8 a14 14 0 0 1 -6 -11 a14 14 0 0 1 14 -14 z" opacity="0" />
      <ellipse class="body-outline" cx="100" cy="44" rx="14" ry="15"/>
      <rect class="body-outline" x="82" y="58" width="36" height="8" rx="4"/>
      ${paths}
    </svg>`;
    map.querySelectorAll(".bp").forEach(p => p.addEventListener("click", () => toggleZone(p.dataset.zone)));

    // chips
    const chips = $("#zoneChips"); chips.innerHTML = "";
    ZONES.forEach(z => {
      const c = el("button", "zone-chip" + (state.zones.has(z.id) ? " sel" : ""), z[lang]);
      c.addEventListener("click", () => toggleZone(z.id));
      chips.appendChild(c);
    });
    $("#wellness").checked = state.wellness;
    $("#wellness").onchange = (e) => { state.wellness = e.target.checked; };
  }
  function toggleZone(id) {
    if (state.zones.has(id)) state.zones.delete(id); else state.zones.add(id);
    renderZones();
  }

  /* ----- step 2: facilities ----- */
  function renderFacilities() {
    const wrap = $("#facilities"); wrap.innerHTML = "";
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

  /* ----- step 3: calendar + clock ----- */
  function renderSchedule() { renderCalendar(); renderClock(); renderTimeslots();
    $("#homecare").checked = state.homecare;
    $("#homecare").onchange = (e) => { state.homecare = e.target.checked; updateCost(); };
  }
  function renderCalendar() {
    const { y, m } = state.calMonth;
    const cal = $("#calendar");
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    let html = `<div class="cal-head">
      <button data-cal="-1">‹</button>
      <strong>${t("months")[m]} ${y}</strong>
      <button data-cal="1">›</button></div><div class="cal-grid">`;
    t("dow").forEach(d => html += `<div class="dow">${d}</div>`);
    for (let i = 0; i < startDow; i++) html += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      const iso = dt.toISOString().slice(0, 10);
      const past = dt < today;
      const sel = state.date === iso;
      html += `<button class="cal-day ${sel ? "sel" : ""}" data-day="${iso}" ${past ? "disabled" : ""}>${d}</button>`;
    }
    html += `</div>`;
    cal.innerHTML = html;
    cal.querySelectorAll("[data-cal]").forEach(b => b.addEventListener("click", () => {
      let nm = m + Number(b.dataset.cal);
      let ny = y;
      if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; }
      state.calMonth = { y: ny, m: nm }; renderCalendar();
    }));
    cal.querySelectorAll("[data-day]").forEach(b => b.addEventListener("click", () => {
      state.date = b.dataset.day; renderCalendar();
    }));
  }
  const SLOTS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
  function renderTimeslots() {
    const wrap = $("#timeslots"); wrap.innerHTML = "";
    SLOTS.forEach(s => {
      const b = el("button", "slot" + (state.time === s ? " sel" : ""), s);
      b.addEventListener("click", () => { state.time = s; renderTimeslots(); renderClock(); });
      wrap.appendChild(b);
    });
  }
  function renderClock() {
    const c = $("#clock");
    const [hh, mm] = (state.time || "10:00").split(":").map(Number);
    const hAng = (hh % 12) * 30 + mm * 0.5;
    const mAng = mm * 6;
    c.innerHTML = `
      <div class="hand h" style="transform:rotate(${hAng}deg)"></div>
      <div class="hand m" style="transform:rotate(${mAng}deg)"></div>
      <div class="pin"></div>
      <div class="lbl">${state.time || "--:--"}</div>`;
  }

  /* ----- step 4: payment ----- */
  function renderPayment() {
    const wrap = $("#payMethods"); wrap.innerHTML = "";
    PAY_METHODS.forEach(p => {
      const sel = state.payMethod === p.id;
      const b = el("div", "paymethod" + (sel ? " sel" : ""),
        `<span class="badge ${p.cls}">${p.badge}</span> ${p.label}`);
      b.addEventListener("click", () => { state.payMethod = p.id; renderPayment(); });
      wrap.appendChild(b);
    });
    const form = $("#payForm");
    if (!state.payMethod) { form.innerHTML = `<p class="hint">${lang === "fr" ? "Sélectionnez un mode de paiement." : "Select a payment method."}</p>`; state.payValid = false; return; }
    if (state.payMethod === "mc") {
      form.innerHTML = `
        <div class="field"><label>${t("pay.name")}</label><input id="f_name" autocomplete="cc-name"></div>
        <div class="field"><label>${t("pay.card")}</label><input id="f_card" inputmode="numeric" placeholder="•••• •••• •••• ••••"></div>
        <div style="display:flex;gap:.9rem">
          <div class="field" style="flex:1"><label>${t("pay.exp")}</label><input id="f_exp" placeholder="MM/AA"></div>
          <div class="field" style="width:110px"><label>${t("pay.cvv")}</label><input id="f_cvv" inputmode="numeric" placeholder="•••"></div>
        </div>`;
    } else {
      form.innerHTML = `
        <div class="field"><label>${t("pay.name")}</label><input id="f_name"></div>
        <div class="field"><label>${t("pay.phone")}</label><input id="f_phone" inputmode="tel" placeholder="+237 6XX XXX XXX"></div>`;
    }
    form.querySelectorAll("input").forEach(i => i.addEventListener("input", validatePay));
    validatePay();
  }
  function validatePay() {
    let ok = false;
    if (state.payMethod === "mc") {
      const card = ($("#f_card")?.value || "").replace(/\s/g, "");
      ok = ($("#f_name")?.value || "").trim().length > 2 && card.length >= 12 &&
           /\d{2}\/\d{2}/.test($("#f_exp")?.value || "") && ($("#f_cvv")?.value || "").length >= 3;
    } else if (state.payMethod) {
      ok = ($("#f_name")?.value || "").trim().length > 2 && ($("#f_phone")?.value || "").replace(/\D/g, "").length >= 8;
    }
    state.payValid = ok;
    return ok;
  }

  /* ----- step 5: summary ----- */
  function renderSummary() {
    const f = facilityById(state.facilityId);
    const zonesTxt = state.zones.size
      ? [...state.zones].map(zoneName).join(", ")
      : (state.wellness ? t("wellness") : "—");
    const pm = PAY_METHODS.find(p => p.id === state.payMethod);
    const total = computeTotal();
    $("#summary").innerHTML = `
      <div class="row"><span>${t("sum.zones")}</span><strong>${zonesTxt}${state.zones.size && state.wellness ? " + " + t("wellness") : ""}</strong></div>
      <div class="row"><span>${t("sum.facility")}</span><strong>${f ? f.name + " — " + f.city : "—"}</strong></div>
      <div class="row"><span>${t("sum.date")}</span><strong>${fmtDate(state.date)}</strong></div>
      <div class="row"><span>${t("sum.time")}</span><strong>${state.time || "—"}</strong></div>
      <div class="row"><span>${t("sum.home")}</span><strong>${state.homecare ? t("sum.yes") : t("sum.no")}</strong></div>
      <div class="row"><span>${t("sum.pay")}</span><strong>${pm ? pm.label : "—"}</strong></div>
      <div class="row total"><span>${t("sum.total")}</span><strong>${fmtFCFA(total)}</strong></div>`;
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${t("months")[d.getMonth()]} ${d.getFullYear()}`;
  }

  function updateCost() {
    const total = computeTotal();
    $("#costTag").textContent = total ? t("sum.total") + ": " + fmtFCFA(total) : "";
  }

  /* ----- wizard step guards ----- */
  function canAdvance() {
    switch (state.step) {
      case 1: if (!state.zones.size && !state.wellness) { toast(t("t.needZone")); return false; } return true;
      case 2: if (!state.facilityId) { toast(t("t.needFacility")); return false; } return true;
      case 3: if (!state.date || !state.time) { toast(t("t.needSchedule")); return false; } return true;
      case 4: if (!validatePay()) { toast(t("t.needPay")); return false; } return true;
      default: return true;
    }
  }

  /* ----- save appointment + receipt ----- */
  function saveAppointment() {
    if (!canAdvance()) return; // validates payment (step 4 already passed, but re-check)
    const f = facilityById(state.facilityId);
    const ref = "TS-" + Date.now().toString(36).toUpperCase().slice(-6);
    const rec = {
      ref,
      createdAt: new Date().toISOString(),
      zones: [...state.zones],
      wellness: state.wellness,
      facility: f ? { name: f.name, city: f.city } : null,
      date: state.date, time: state.time,
      homecare: state.homecare,
      payMethod: state.payMethod,
      total: computeTotal()
    };
    appointments.unshift(rec);
    store.set("ts_appointments", appointments);
    // schedule simulated notifications
    pushNotif(t("notif.reminder"), `${f ? f.name : ""} — ${fmtDate(rec.date)} ${rec.time}`);
    pushNotif(t("notif.followup"), lang === "fr" ? "Comment évoluent vos douleurs ? Notez votre suivi." : "How is your pain evolving? Log your follow-up.");
    toast(t("t.saved"));
    showReceipt(rec);
    resetBooking();
  }

  function resetBooking() {
    state.step = 1; state.zones = new Set(); state.wellness = false; state.facilityId = null;
    state.date = null; state.time = null; state.homecare = false; state.payMethod = null; state.payValid = false;
  }

  /* ----- receipt (PDF via print) ----- */
  function showReceipt(rec) {
    const zonesTxt = rec.zones.length ? rec.zones.map(zoneName).join(", ") : (rec.wellness ? t("wellness") : "—");
    const pm = PAY_METHODS.find(p => p.id === rec.payMethod);
    $("#receipt").innerHTML = `
      <div class="rc-head">
        <img src="assets/logo.svg" alt="Top S'ASSUR">
        <div class="rc-title"><h2>Top S'ASSUR</h2><span>${t("receipt.for")}</span></div>
      </div>
      <div class="rc-row"><span>${t("receipt.ref")}</span><span class="rc-code">${rec.ref}</span></div>
      <div class="rc-row"><span>${t("receipt.patient")}</span><span>${t("guest")}</span></div>
      <div class="rc-row"><span>${t("sum.zones")}</span><span>${zonesTxt}</span></div>
      <div class="rc-row"><span>${t("sum.facility")}</span><span>${rec.facility ? rec.facility.name + " — " + rec.facility.city : "—"}</span></div>
      <div class="rc-row"><span>${t("sum.date")}</span><span>${fmtDate(rec.date)} — ${rec.time}</span></div>
      <div class="rc-row"><span>${t("sum.home")}</span><span>${rec.homecare ? t("sum.yes") : t("sum.no")}</span></div>
      <div class="rc-row"><span>${t("sum.pay")}</span><span>${pm ? pm.label : "—"}</span></div>
      <div class="rc-total"><span>${t("sum.total")}</span><span>${fmtFCFA(rec.total)}</span></div>
      <div class="rc-foot">${t("receipt.present")}<br>${new Date(rec.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}</div>`;
    $("#receiptOverlay").hidden = false;
  }

  /* ---------------- PATIENT SPACE ---------------- */
  function renderPatient() {
    const hist = $("#patientHistory");
    if (!appointments.length) { hist.innerHTML = `<p class="empty">${t("patient.empty")}</p>`; }
    else {
      hist.innerHTML = "";
      appointments.forEach(rec => {
        const zonesTxt = rec.zones.length ? rec.zones.map(zoneName).join(", ") : (rec.wellness ? t("wellness") : "—");
        const tags = rec.zones.map(z => `<span class="tag">${zoneName(z)}</span>`).join("")
          + (rec.wellness ? `<span class="tag">${t("wellness")}</span>` : "");
        const card = el("div", "record",
          `<div class="top"><span>${rec.facility ? rec.facility.name : "—"}</span><span>${fmtFCFA(rec.total)}</span></div>
           <div class="sub">${fmtDate(rec.date)} — ${rec.time}${rec.homecare ? " • " + t("sum.home") : ""}</div>
           <div class="tags">${tags}</div>
           <div class="actions"><button class="link-btn" data-ref="${rec.ref}">📄 ${t("pdf")}</button>
           <span class="rc-code" style="font-size:.72rem">${rec.ref}</span></div>`);
        card.querySelector("[data-ref]").addEventListener("click", () => showReceipt(rec));
        hist.appendChild(card);
      });
    }
    // pain tracking (aggregate)
    const track = $("#painTracking");
    const counts = {};
    appointments.forEach(r => r.zones.forEach(z => counts[z] = (counts[z] || 0) + 1));
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { track.innerHTML = `<p class="empty">${t("patient.empty")}</p>`; return; }
    const max = entries[0][1];
    track.innerHTML = entries.map(([z, c]) =>
      `<div class="bar-label"><span>${zoneName(z)}</span><span>${c}×</span></div>
       <div class="bar"><span style="width:${Math.round(c / max * 100)}%"></span></div>`).join("");
  }

  /* ---------------- ADMIN SPACE ---------------- */
  function renderAdmin() {
    const revenue = appointments.reduce((s, r) => s + r.total, 0);
    const homeCount = appointments.filter(r => r.homecare).length;
    $("#adminStats").innerHTML = `
      <div class="stat"><strong>${appointments.length}</strong><span>${t("stat.appts")}</span></div>
      <div class="stat"><strong>${revenue.toLocaleString("fr-FR")}</strong><span>${t("stat.revenue")}</span></div>
      <div class="stat"><strong>${facilities.length}</strong><span>${t("stat.partners")}</span></div>
      <div class="stat"><strong>${homeCount}</strong><span>${t("stat.home")}</span></div>`;

    const list = $("#partnerList"); list.innerHTML = "";
    facilities.forEach(f => {
      const row = el("div", "partner-row",
        `<div><strong>${f.name}</strong><br><span class="sub">📍 ${f.city} • ${fmtFCFA(f.price)}</span></div>
         <button class="del" data-id="${f.id}">✕</button>`);
      row.querySelector(".del").addEventListener("click", () => {
        facilities = facilities.filter(x => x.id !== f.id);
        store.set("ts_facilities", facilities);
        toast(t("t.deleted")); renderAdmin();
      });
      list.appendChild(row);
    });

    const pl = $("#paymentList");
    if (!appointments.length) { pl.innerHTML = `<p class="empty">${t("patient.empty")}</p>`; }
    else {
      pl.innerHTML = "";
      appointments.forEach(r => {
        const pm = PAY_METHODS.find(p => p.id === r.payMethod);
        pl.appendChild(el("div", "partner-row",
          `<div><strong>${r.ref}</strong><br><span class="sub">${pm ? pm.label : "—"} • ${fmtDate(r.date)}</span></div>
           <strong style="color:var(--green-700)">${fmtFCFA(r.total)}</strong>`));
      });
    }
  }

  /* ---------------- NOTIFICATIONS ---------------- */
  function pushNotif(title, body) {
    notifications.unshift({ title, body, at: new Date().toISOString() });
    notifications = notifications.slice(0, 12);
    store.set("ts_notifs", notifications);
    renderNotifs();
  }
  function renderNotifs() {
    const c = $("#bellCount");
    if (notifications.length) { c.hidden = false; c.textContent = notifications.length; }
    else c.hidden = true;
    const list = $("#notifList");
    list.innerHTML = notifications.length
      ? notifications.map(n => `<li><strong>${n.title}</strong><small>${n.body}</small></li>`).join("")
      : `<li><small>${lang === "fr" ? "Aucune notification." : "No notifications."}</small></li>`;
  }

  /* ---------------- events ---------------- */
  function bind() {
    // nav
    $$("[data-nav]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); navTo(b.dataset.nav); }));
    $$("[data-scroll]").forEach(b => b.addEventListener("click", () => {
      const el = document.getElementById(b.dataset.scroll); el && el.scrollIntoView({ behavior: "smooth" });
    }));
    // language
    $$(".lang").forEach(b => b.addEventListener("click", () => {
      lang = b.dataset.lang; localStorage.setItem("ts_lang", lang);
      $$(".lang").forEach(x => x.classList.toggle("is-active", x === b));
      applyI18n(); renderHome(); renderNotifs();
      const cur = $$(".view").find(v => !v.hidden)?.dataset.view;
      if (cur === "booking") renderWizard();
      if (cur === "patient") renderPatient();
      if (cur === "admin") renderAdmin();
    }));
    // burger
    $("#burger").addEventListener("click", () => $(".main-nav").classList.toggle("open"));
    // bell
    $("#bellBtn").addEventListener("click", () => { const p = $("#notifPanel"); p.hidden = !p.hidden; });
    // wizard nav
    $("#nextBtn").addEventListener("click", () => {
      if (state.step < 5 && canAdvance()) { state.step++; renderWizard(); }
    });
    $("#prevBtn").addEventListener("click", () => { if (state.step > 1) { state.step--; renderWizard(); } });
    $("#saveBtn").addEventListener("click", saveAppointment);
    // receipt
    $("#downloadPdf").addEventListener("click", () => window.print());
    $("#closeReceipt").addEventListener("click", () => $("#receiptOverlay").hidden = true);
    // admin add partner
    $("#addPartner").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#pName").value.trim(), city = $("#pCity").value.trim(), price = Number($("#pPrice").value);
      if (!name || !city || !price) return;
      facilities.push({ id: "f" + Date.now(), name, city, price });
      store.set("ts_facilities", facilities);
      e.target.reset(); toast(t("t.added")); renderAdmin();
    });
  }

  /* ---------------- init ---------------- */
  function init() {
    $("#year").textContent = new Date().getFullYear();
    $$(".lang").forEach(x => x.classList.toggle("is-active", x.dataset.lang === lang));
    applyI18n();
    renderHome();
    renderNotifs();
    bind();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
