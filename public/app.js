import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js";
import { auth, db, isFirebaseConfigured, storage } from "./firebase.js";

const MXN_FORMATTER = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
});
const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});
const MAX_EVIDENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const EMPTY_TOTALS = {
  physicalAmount: 0,
  recyclingAmount: 0,
  manualDigitalAmount: 0,
  syncedDigitalAmount: 0,
  digitalAmount: 0,
  totalAmount: 0,
  donationCount: 0,
  syncStatus: "idle",
  syncError: "",
  teletonUrl: "",
  lastSuccessfulSyncAt: null,
};

const HISTORY_CONTENT = {
  summary:
    "Reciclando Goles nació como una iniciativa juvenil para unir deporte, comunidad y apoyo social con una lógica pública de seguimiento, transparencia e historial.",
  homeHighlights: [
    {
      title: "Cómo empezó",
      copy: "El proyecto comenzó como una campaña escolar solidaria impulsada por estudiantes para convertir participación deportiva y cooperación en apoyo real.",
    },
    {
      title: "Primera etapa",
      copy: "La primera campaña formal permitió probar contador, alcancías, registro de aportaciones, transparencia y cierre público sin borrar el trabajo anterior.",
    },
    {
      title: "Nueva etapa",
      copy: "Tras cerrar la primera campaña, Reciclando Goles continúa fuera de la escuela con MundialHITO 2026 y una visión más abierta hacia empresas e instituciones.",
    },
  ],
  pageIntro:
    "Reciclando Goles nació como una iniciativa juvenil para transformar el deporte y la participación comunitaria en apoyo real para causas sociales. Su historia conecta una primera campaña escolar con una nueva etapa pública y empresarial.",
  origin:
    "Reciclando Goles inició como un proyecto escolar solidario impulsado por estudiantes, con la idea de unir deporte, participación comunitaria y recaudación con causa. La meta no era solo reunir dinero, sino crear una dinámica visible, ordenada y transparente, donde cada avance pudiera registrarse y compartirse públicamente.",
  originFollowup:
    "Desde el inicio, el proyecto buscó que las personas pudieran ver el progreso de la campaña, conocer la meta, identificar las formas de aportación y revisar el cierre final sin borrar el trabajo anterior. Esa visión dio origen a una plataforma con contador, campañas, alcancías, historial y transparencia.",
  firstStage:
    "La primera campaña formal registrada fue Reciclando Goles x Teletón 2026 Semestre 1. Aunque no alcanzó la meta completa, sí dejó una base real para continuar, evidencia del proceso y una estructura capaz de crecer más allá del entorno escolar.",
  outcomes: [
    "Una campaña cerrada con total final, meta y desglose de aportaciones.",
    "Una página pública capaz de conservar historial y transparencia.",
    "Un modelo de seguimiento para alcancías, contador y evidencias.",
    "Una identidad de proyecto reconocible bajo el nombre Reciclando Goles.",
    "La posibilidad de abrir nuevas campañas sin borrar el trabajo anterior.",
  ],
  newStage:
    "Después del cierre de la primera campaña, Reciclando Goles inicia una nueva etapa fuera de la escuela. La segunda campaña toma el nombre de MundialHITO 2026 y busca ser una propuesta más memorable, deportiva y fácil de comunicar, sin perder el enfoque formal de la causa.",
  longText:
    "MundialHITO 2026 será un torneo empresarial de fútbol 7 en beneficio del Hospital Infantil Teletón de Oncología. Esta nueva etapa busca reunir a empresas locales y regionales en una jornada deportiva con causa, promoviendo actividad física, convivencia laboral y responsabilidad social empresarial.",
  principles: [
    "Transparencia: mostrar metas, avances, gastos y cierre final.",
    "Continuidad: conservar campañas anteriores como parte del historial.",
    "Impacto social: vincular deporte y participación con una causa concreta.",
    "Colaboración: unir estudiantes, empresas, familias e instituciones.",
    "Responsabilidad: separar donativos de gastos operativos como arbitraje.",
  ],
};

function getHomeSectionDefinitions() {
  return [
    { id: "active-campaign", label: "Campaña" },
    { id: "impact", label: "Datos rápidos" },
    {
      id: "piggy-banks",
      label: isTournamentCampaign(state.activeCampaign) ? "Empresas" : "Alcancías",
    },
    { id: "ranking", label: "Ranking" },
    { id: "transparency", label: "Transparencia" },
    { id: "story-highlight", label: "Historia" },
    { id: "history", label: "Historial" },
    { id: "contact", label: "Contacto" },
  ];
}

const state = {
  route: {
    kind: "home",
    campaignId: "",
  },
  activeCampaignId: "",
  activeCampaign: null,
  activeTotals: { ...EMPTY_TOTALS },
  activePiggyBanks: [],
  activeEvidence: [],
  topDonors: [],
  anonymousSummary: {
    totalAmount: 0,
    donationCount: 0,
  },
  allCampaigns: [],
  user: null,
  userRole: null,
  adminTab: "summary",
  activeSectionId: "active-campaign",
  sectionObserver: null,
  baseUnsubscribers: [],
  activeCampaignUnsubscribers: [],
  userRoleUnsubscribe: null,
};

const elements = {
  body: document.body,
  metaDescription: document.getElementById("meta-description"),
  canonicalLink: document.getElementById("canonical-link"),
  metaOgTitle: document.getElementById("meta-og-title"),
  metaOgDescription: document.getElementById("meta-og-description"),
  metaOgUrl: document.getElementById("meta-og-url"),
  metaTwitterTitle: document.getElementById("meta-twitter-title"),
  metaTwitterDescription: document.getElementById("meta-twitter-description"),
  navCurrentLink: document.getElementById("nav-current-link"),
  navContactLink: document.getElementById("nav-contact-link"),
  navMenuButton: document.getElementById("nav-menu-button"),
  siteMenu: document.getElementById("site-menu"),
  siteMenuBackdrop: document.getElementById("site-menu-backdrop"),
  siteMenuCloseButton: document.getElementById("site-menu-close"),
  siteMenuLinks: document.getElementById("site-menu-links"),
  appStatus: document.getElementById("app-status"),
  heroCampaignState: document.getElementById("hero-campaign-state"),
  heroCampaignCopy: document.getElementById("hero-campaign-copy"),
  heroCampaignName: document.getElementById("hero-campaign-name"),
  heroCampaignMeta: document.getElementById("hero-campaign-meta"),
  heroPrimaryButton: document.getElementById("hero-primary-button"),
  heroSecondaryButton: document.getElementById("hero-secondary-button"),
  activeCampaignName: document.getElementById("active-campaign-name"),
  activeCampaignStatus: document.getElementById("active-campaign-status"),
  activeCampaignSemester: document.getElementById("active-campaign-semester"),
  activeCampaignDates: document.getElementById("active-campaign-dates"),
  activeCampaignGoalLabel: document.getElementById("active-campaign-goal-label"),
  activeCampaignGoal: document.getElementById("active-campaign-goal"),
  activeCampaignCopy: document.getElementById("active-campaign-copy"),
  activeSummaryKicker: document.getElementById("active-summary-kicker"),
  activeSummaryCopy: document.getElementById("active-summary-copy"),
  activeCampaignTotal: document.getElementById("active-campaign-total"),
  activeCampaignTeletonLink: document.getElementById("active-campaign-teleton-link"),
  activeCampaignSupportButton: document.getElementById("active-campaign-support-button"),
  activeHistoryLabel: document.getElementById("active-history-label"),
  activeSecondaryStatLabel: document.getElementById("active-secondary-stat-label"),
  activeCampaignTransparencyCount: document.getElementById("active-campaign-transparency-count"),
  historyCount: document.getElementById("history-count"),
  impactKicker: document.getElementById("impact-kicker"),
  impactTitle: document.getElementById("impact-title"),
  impactDescription: document.getElementById("impact-description"),
  counterStageCopy: document.getElementById("counter-stage-copy"),
  counterBreakdownCopy: document.getElementById("counter-breakdown-copy"),
  counterTotalLabel: document.getElementById("counter-total-label"),
  counterTotal: document.getElementById("counter-total"),
  counterGoalLabel: document.getElementById("counter-goal-label"),
  counterGoal: document.getElementById("counter-goal"),
  counterPercent: document.getElementById("counter-percent"),
  counterRemaining: document.getElementById("counter-remaining"),
  counterFill: document.getElementById("counter-fill"),
  breakdownPhysicalLabel: document.getElementById("breakdown-physical-label"),
  breakdownPhysical: document.getElementById("breakdown-physical"),
  breakdownPhysicalCopy: document.getElementById("breakdown-physical-copy"),
  breakdownDigitalLabel: document.getElementById("breakdown-digital-label"),
  breakdownDigital: document.getElementById("breakdown-digital"),
  breakdownDigitalCopy: document.getElementById("breakdown-digital-copy"),
  breakdownRecyclingLabel: document.getElementById("breakdown-recycling-label"),
  breakdownRecycling: document.getElementById("breakdown-recycling"),
  breakdownRecyclingCopy: document.getElementById("breakdown-recycling-copy"),
  counterDonationCount: document.getElementById("counter-donation-count"),
  counterDonationLabel: document.getElementById("counter-donation-label"),
  counterCountdownValue: document.getElementById("counter-countdown-value"),
  counterCountdownLabel: document.getElementById("counter-countdown-label"),
  counterSyncStatus: document.getElementById("counter-sync-status"),
  counterSyncLabel: document.getElementById("counter-sync-label"),
  piggyBanksKicker: document.getElementById("piggy-banks-kicker"),
  piggyBanksTitle: document.getElementById("piggy-banks-title"),
  piggyBanksCopy: document.getElementById("piggy-banks-copy"),
  piggyBanksList: document.getElementById("piggy-banks-list"),
  piggyBanksEmpty: document.getElementById("piggy-banks-empty"),
  rankingKicker: document.getElementById("ranking-kicker"),
  rankingTitle: document.getElementById("ranking-title"),
  rankingCopy: document.getElementById("ranking-copy"),
  generalDonationsCard: document.getElementById("general-donations-card"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardEmpty: document.getElementById("leaderboard-empty"),
  transparencyKicker: document.getElementById("transparency-kicker"),
  transparencyTitle: document.getElementById("transparency-title"),
  transparencyCopy: document.getElementById("transparency-copy"),
  transparencySummaryKicker: document.getElementById("transparency-summary-kicker"),
  transparencySyncStatus: document.getElementById("transparency-sync-status"),
  transparencySyncCopy: document.getElementById("transparency-sync-copy"),
  transparencySummaryBoxKicker: document.getElementById("transparency-summary-box-kicker"),
  transparencyTotalLabel: document.getElementById("transparency-total-label"),
  transparencyTotalAmount: document.getElementById("transparency-total-amount"),
  transparencyDigitalLabel: document.getElementById("transparency-digital-label"),
  transparencyDigitalAmount: document.getElementById("transparency-digital-amount"),
  transparencyLastSyncLabel: document.getElementById("transparency-last-sync-label"),
  transparencyLastSync: document.getElementById("transparency-last-sync"),
  transparencyListKicker: document.getElementById("transparency-list-kicker"),
  transparencyListTitle: document.getElementById("transparency-list-title"),
  transparencyEvidenceCount: document.getElementById("transparency-evidence-count"),
  transparencyEvidenceList: document.getElementById("transparency-evidence-list"),
  transparencyEvidenceEmpty: document.getElementById("transparency-evidence-empty"),
  storyHighlightKicker: document.getElementById("story-highlight-kicker"),
  storyHighlightTitle: document.getElementById("story-highlight-title"),
  storyHighlightCopy: document.getElementById("story-highlight-copy"),
  storyHighlightGrid: document.getElementById("story-highlight-grid"),
  historyCampaignsList: document.getElementById("history-campaigns-list"),
  historyEmpty: document.getElementById("history-empty"),
  historyPageView: document.getElementById("history-page-view"),
  campaignDetailView: document.getElementById("campaign-detail-view"),
  donationNoticeModal: document.getElementById("donation-notice-modal"),
  donationNoticeBackdrop: document.getElementById("donation-notice-backdrop"),
  donationNoticePanel: document.getElementById("donation-notice-panel"),
  donationNoticeClose: document.getElementById("close-donation-notice-modal"),
  donationNoticeCloseButton: document.getElementById("close-donation-notice-button"),
  donationNoticeCopy: document.getElementById("donation-notice-copy"),
  donationNoticePiggyBanks: document.getElementById("donation-notice-piggy-banks"),
  donationNoticeTeletonLink: document.getElementById("donation-notice-teleton-link"),
  adminModal: document.getElementById("admin-modal"),
  adminBackdrop: document.getElementById("admin-backdrop"),
  adminLayout: document.getElementById("admin-layout"),
  adminPanel: document.getElementById("admin-panel"),
  adminModalCloseButton: document.getElementById("close-admin-modal"),
  adminAuthCard: document.getElementById("admin-auth-card"),
  adminAuthForm: document.getElementById("admin-auth-form"),
  adminEmail: document.getElementById("admin-email"),
  adminPassword: document.getElementById("admin-password"),
  adminAuthMessage: document.getElementById("admin-auth-message"),
  adminLoginButton: document.getElementById("admin-login-button"),
  adminLogoutButton: document.getElementById("admin-logout-button"),
  adminSessionCopy: document.getElementById("admin-session-copy"),
  adminRoleCopy: document.getElementById("admin-role-copy"),
  adminFallbackCard: document.getElementById("admin-fallback-card"),
  adminTabNav: document.getElementById("admin-tab-nav"),
  adminMain: document.getElementById("admin-main"),
  adminSessionBar: document.getElementById("admin-session-bar"),
  adminActiveSessionCopy: document.getElementById("admin-active-session-copy"),
  adminActiveRoleCopy: document.getElementById("admin-active-role-copy"),
  adminActiveLogoutButton: document.getElementById("admin-active-logout-button"),
  adminAccessWarning: document.getElementById("admin-access-warning"),
  adminWorkspace: document.getElementById("admin-workspace"),
  adminTabButtons: Array.from(document.querySelectorAll("[data-admin-tab-button]")),
  adminTabPanels: Array.from(document.querySelectorAll("[data-admin-tab-panel]")),
  adminSummaryCampaign: document.getElementById("admin-summary-campaign"),
  adminSummaryStatus: document.getElementById("admin-summary-status"),
  adminSummaryTotals: document.getElementById("admin-summary-totals"),
  adminSummarySync: document.getElementById("admin-summary-sync"),
  adminSyncTeletonButton: document.getElementById("admin-sync-teleton-button"),
  adminRecalculateButton: document.getElementById("admin-recalculate-button"),
  adminDonationForm: document.getElementById("admin-donation-form"),
  adminDonationName: document.getElementById("admin-donation-name"),
  adminDonationAmount: document.getElementById("admin-donation-amount"),
  adminDonationSourceType: document.getElementById("admin-donation-source-type"),
  adminDonationPiggyBank: document.getElementById("admin-donation-piggy-bank"),
  adminDonationMessage: document.getElementById("admin-donation-message"),
  adminDonationSubmit: document.getElementById("admin-donation-submit"),
  piggyBankForm: document.getElementById("piggy-bank-form"),
  piggyBankName: document.getElementById("piggy-bank-name"),
  piggyBankLocation: document.getElementById("piggy-bank-location"),
  piggyBankStatus: document.getElementById("piggy-bank-status"),
  piggyBankAccepts: document.getElementById("piggy-bank-accepts"),
  piggyBankNotes: document.getElementById("piggy-bank-notes"),
  piggyBankMessage: document.getElementById("piggy-bank-message"),
  piggyBankSubmit: document.getElementById("piggy-bank-submit"),
  adminPiggyBanksList: document.getElementById("admin-piggy-banks-list"),
  adminPiggyBankCount: document.getElementById("admin-piggy-bank-count"),
  activeCampaignForm: document.getElementById("active-campaign-form"),
  activeCampaignFieldName: document.getElementById("active-campaign-field-name"),
  activeCampaignFieldSemester: document.getElementById("active-campaign-field-semester"),
  activeCampaignFieldGoal: document.getElementById("active-campaign-field-goal"),
  activeCampaignFieldStart: document.getElementById("active-campaign-field-start"),
  activeCampaignFieldEnd: document.getElementById("active-campaign-field-end"),
  activeCampaignFieldTeletonUrl: document.getElementById("active-campaign-field-teleton-url"),
  activeCampaignMessage: document.getElementById("active-campaign-message"),
  activeCampaignSubmit: document.getElementById("active-campaign-submit"),
  adminCampaignPicker: document.getElementById("admin-campaign-picker"),
  adminCampaignPickerCount: document.getElementById("admin-campaign-picker-count"),
  evidenceForm: document.getElementById("evidence-form"),
  evidenceTitle: document.getElementById("evidence-title"),
  evidenceKind: document.getElementById("evidence-kind"),
  evidenceUrl: document.getElementById("evidence-url"),
  evidenceFile: document.getElementById("evidence-file"),
  evidenceDescription: document.getElementById("evidence-description"),
  evidenceAmount: document.getElementById("evidence-amount"),
  evidenceRecordedAt: document.getElementById("evidence-recorded-at"),
  evidenceMessage: document.getElementById("evidence-message"),
  evidenceSubmit: document.getElementById("evidence-submit"),
  adminEvidenceList: document.getElementById("admin-evidence-list"),
  adminCloseCopy: document.getElementById("admin-close-copy"),
  adminCloseMessage: document.getElementById("admin-close-message"),
  adminCloseCampaignButton: document.getElementById("admin-close-button"),
  newCampaignForm: document.getElementById("new-campaign-form"),
  newCampaignName: document.getElementById("new-campaign-name"),
  newCampaignSemester: document.getElementById("new-campaign-semester"),
  newCampaignGoal: document.getElementById("new-campaign-goal"),
  newCampaignTeletonUrl: document.getElementById("new-campaign-teleton-url"),
  newCampaignStart: document.getElementById("new-campaign-start"),
  newCampaignEnd: document.getElementById("new-campaign-end"),
  newCampaignMessage: document.getElementById("new-campaign-message"),
  newCampaignSubmit: document.getElementById("new-campaign-submit"),
  homeSections: Array.from(document.querySelectorAll("[data-home-section]")),
  sharedSections: Array.from(document.querySelectorAll("[data-shared-section]")),
};

function formatCurrency(value) {
  return MXN_FORMATTER.format(Number(value) || 0);
}

const DISPLAY_TEXT_REPAIRS = [
  ["Su Saz?n", "Su Sazón"],
  ["Pati?o", "Patiño"],
  ["campa?a", "campaña"],
  ["Campa?a", "Campaña"],
  ["Telet?n", "Teletón"],
  ["Oncolog?a", "Oncología"],
  ["f?tbol", "fútbol"],
  ["invitaci?n", "invitación"],
  ["participaci?n", "participación"],
  ["planeaci?n", "planeación"],
  ["organizaci?n", "organización"],
  ["operaci?n", "operación"],
  ["informaci?n", "información"],
  ["edici?n", "edición"],
  ["Categor?a", "Categoría"],
  ["Duraci?n", "Duración"],
];

function repairVisibleText(value) {
  let text = String(value ?? "");
  for (const [broken, fixed] of DISPLAY_TEXT_REPAIRS) {
    text = text.split(broken).join(fixed);
  }

  return text;
}

function escapeHtml(value) {
  return repairVisibleText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePathname(pathname) {
  const trimmed = String(pathname || "/").trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return trimmed.replace(/\/+$/, "") || "/";
}

function getRouteFromLocation() {
  const pathname = normalizePathname(globalThis.location?.pathname || "/");
  if (pathname === "/historia") {
    return {
      kind: "history",
      campaignId: "",
    };
  }

  if (pathname.startsWith("/campanas/")) {
    return {
      kind: "campaign-detail",
      campaignId: decodeURIComponent(pathname.slice("/campanas/".length)),
    };
  }

  return {
    kind: "home",
    campaignId: "",
  };
}

function getBasePathForRoute(route = state.route) {
  if (route.kind === "history") {
    return "/historia";
  }

  if (route.kind === "campaign-detail") {
    return `/campanas/${encodeURIComponent(route.campaignId)}`;
  }

  return "/";
}

function getAbsoluteUrl(pathname) {
  const normalizedPath = normalizePathname(pathname);
  return new URL(normalizedPath, globalThis.location.origin).toString();
}

function buildRouteHref(pathname, hash = "") {
  return `${normalizePathname(pathname)}${hash ? `#${hash}` : ""}`;
}

function updateSeoForRoute() {
  const defaultTitle = "Reciclando Goles";
  const defaultDescription =
    "Plataforma oficial de Reciclando Goles para seguir campañas semestrales, transparencia pública, alcancías activas y apoyo solidario.";
  let title = defaultTitle;
  let description = defaultDescription;
  let pathname = "/";

  if (state.route.kind === "history") {
    title = "Historia | Reciclando Goles";
    description =
      "Conoce la historia de Reciclando Goles: su origen escolar, la primera campaña cerrada y la transición hacia MundialHITO 2026.";
    pathname = "/historia";
  } else if (state.route.kind === "campaign-detail") {
    const campaign = getRouteCampaign();
    title = campaign ? `${campaign.name} | Reciclando Goles` : "Campaña | Reciclando Goles";
    description = campaign
      ? `${campaign.name}: detalle público de campaña con datos rápidos, costo por equipo, empresas invitadas, transparencia y reglamento.`
      : "Detalle público de campaña de Reciclando Goles.";
    pathname = getBasePathForRoute(state.route);
  }

  const absoluteUrl = getAbsoluteUrl(pathname);
  document.title = title;
  if (elements.metaDescription) {
    elements.metaDescription.content = description;
  }
  if (elements.canonicalLink) {
    elements.canonicalLink.href = absoluteUrl;
  }
  if (elements.metaOgTitle) {
    elements.metaOgTitle.content = title;
  }
  if (elements.metaOgDescription) {
    elements.metaOgDescription.content = description;
  }
  if (elements.metaOgUrl) {
    elements.metaOgUrl.content = absoluteUrl;
  }
  if (elements.metaTwitterTitle) {
    elements.metaTwitterTitle.content = title;
  }
  if (elements.metaTwitterDescription) {
    elements.metaTwitterDescription.content = description;
  }
}

function navigateTo(pathname, hash = "", replace = false) {
  const href = buildRouteHref(pathname, hash);
  const currentHref = `${normalizePathname(globalThis.location.pathname)}${globalThis.location.hash || ""}`;
  if (href !== currentHref) {
    const method = replace ? "replaceState" : "pushState";
    globalThis.history[method]({}, "", href);
  }

  state.route = getRouteFromLocation();
  renderAll();
  if (hash) {
    requestAnimationFrame(() => scrollToHash(hash, false));
  } else {
    requestAnimationFrame(() => globalThis.scrollTo({ top: 0, behavior: "auto" }));
  }
}

function scrollToHash(hash, smooth = true) {
  const target = document.getElementById(String(hash || "").replace(/^#/, ""));
  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "start",
  });
}

function getLegacyCampaign() {
  return (
    state.allCampaigns.find((campaign) => campaign.id === "legacy-2026-sem1") ||
    sortCampaigns(state.allCampaigns.filter((campaign) => campaign.status === "closed"))[0] ||
    null
  );
}

function getRouteCampaign() {
  if (state.route.kind !== "campaign-detail") {
    return null;
  }

  return (
    state.allCampaigns.find((campaign) => campaign.id === state.route.campaignId) ||
    (state.activeCampaign && state.activeCampaign.id === state.route.campaignId ? state.activeCampaign : null)
  );
}

function getCampaignEvidenceForRoute() {
  return state.route.kind === "campaign-detail" && state.route.campaignId === state.activeCampaignId
    ? [...state.activeEvidence]
    : [];
}

function getCurrentSectionDefinitions() {
  if (state.route.kind === "history") {
    return [
      { id: "history-hero", label: "Historia" },
      { id: "history-origin", label: "Origen" },
      { id: "history-first-campaign", label: "Primera etapa" },
      { id: "history-legacy", label: "Lo que dejó" },
      { id: "history-new-stage", label: "Nueva etapa" },
      { id: "history-principles", label: "Principios" },
      { id: "contact", label: "Contacto" },
    ];
  }

  if (state.route.kind === "campaign-detail") {
    return [
      { id: "campaign-detail-hero", label: "Campaña" },
      { id: "campaign-detail-facts", label: "Datos rápidos" },
      { id: "campaign-detail-cost", label: "Costo" },
      { id: "campaign-detail-companies", label: "Empresas" },
      { id: "campaign-detail-transparency", label: "Transparencia" },
      { id: "campaign-detail-rules", label: "Reglamento" },
      { id: "contact", label: "Contacto" },
    ];
  }

  return getHomeSectionDefinitions();
}

function updateCurrentSectionLink() {
  const definitions = getCurrentSectionDefinitions();
  const sectionLinks = definitions.filter((item) => item.id !== "contact");
  const fallback = sectionLinks[0] || { id: "contact", label: "Inicio" };
  const isContactActive = state.activeSectionId === "contact";
  const current =
    (isContactActive
      ? fallback
      : sectionLinks.find((item) => item.id === state.activeSectionId)) || fallback;
  const href = buildRouteHref(getBasePathForRoute(), current.id);
  const previousLabel = elements.navCurrentLink.textContent;
  elements.navCurrentLink.textContent = current.label;
  elements.navCurrentLink.href = href;
  elements.navCurrentLink.setAttribute("data-route", "");
  elements.navContactLink.href = buildRouteHref(getBasePathForRoute(), "contact");
  elements.navContactLink.setAttribute("data-route", "");
  elements.navCurrentLink.classList.toggle("border-secondary-container", !isContactActive);
  elements.navCurrentLink.classList.toggle("border-transparent", isContactActive);
  elements.navCurrentLink.classList.toggle("text-primary", !isContactActive);
  elements.navCurrentLink.classList.toggle("text-on-surface-variant", isContactActive);
  elements.navCurrentLink.classList.toggle("opacity-100", !isContactActive);
  elements.navCurrentLink.classList.toggle("opacity-70", isContactActive);
  elements.navCurrentLink.classList.toggle("-translate-y-0.5", !isContactActive);
  elements.navCurrentLink.classList.toggle("translate-y-0", isContactActive);
  elements.navContactLink.classList.toggle("border-secondary-container", isContactActive);
  elements.navContactLink.classList.toggle("border-transparent", !isContactActive);
  elements.navContactLink.classList.toggle("text-primary", isContactActive);
  elements.navContactLink.classList.toggle("text-on-surface-variant", !isContactActive);
  elements.navContactLink.classList.toggle("opacity-100", isContactActive);
  elements.navContactLink.classList.toggle("opacity-80", !isContactActive);
  elements.navContactLink.classList.toggle("-translate-y-0.5", isContactActive);
  elements.navContactLink.classList.toggle("translate-y-0", !isContactActive);
  if (previousLabel !== current.label && typeof elements.navCurrentLink.animate === "function") {
    elements.navCurrentLink.animate(
      [
        { opacity: 0.4, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "ease-out" }
    );
  }
}

function closeSiteMenu() {
  elements.siteMenu.classList.add("pointer-events-none", "opacity-0");
  elements.siteMenu.hidden = true;
  elements.siteMenu.setAttribute("aria-hidden", "true");
  elements.navMenuButton.setAttribute("aria-expanded", "false");
  elements.body.classList.remove("menu-open");
}

function openSiteMenu() {
  renderSiteMenu();
  elements.siteMenu.hidden = false;
  elements.siteMenu.classList.remove("pointer-events-none", "opacity-0");
  elements.siteMenu.setAttribute("aria-hidden", "false");
  elements.navMenuButton.setAttribute("aria-expanded", "true");
  elements.body.classList.add("menu-open");
  elements.siteMenuCloseButton.focus();
}

function renderSiteMenu() {
  const definitions = getCurrentSectionDefinitions();
  const links = definitions
    .map((item) => {
      const isActive = item.id === state.activeSectionId;
      const href = buildRouteHref(getBasePathForRoute(), item.id);
      return `
        <a
          class="${isActive ? "bg-primary text-white" : "bg-surface-container-low text-on-surface"} rounded-[1.35rem] px-5 py-4 text-base font-bold transition-colors hover:bg-surface-container-high hover:text-primary"
          data-route
          data-menu-link
          href="${escapeHtml(href)}"
        >
          ${escapeHtml(item.label)}
        </a>
      `;
    })
    .join("");

  const auxiliaryLinks =
    state.route.kind === "home"
      ? `
        <a class="rounded-[1.35rem] bg-white px-5 py-4 text-base font-bold text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary" data-menu-link data-route href="/historia">
          Historia completa
        </a>
      `
      : `
        <a class="rounded-[1.35rem] bg-white px-5 py-4 text-base font-bold text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary" data-menu-link data-route href="/">
          Volver al inicio
        </a>
      `;

  elements.siteMenuLinks.innerHTML = `${links}${auxiliaryLinks}`;
}

function setSectionVisibility() {
  const isHome = state.route.kind === "home";
  elements.homeSections.forEach((section) => {
    section.hidden = !isHome;
    section.classList.toggle("hidden", !isHome);
  });

  elements.historyPageView.hidden = state.route.kind !== "history";
  elements.historyPageView.classList.toggle("hidden", state.route.kind !== "history");
  elements.campaignDetailView.hidden = state.route.kind !== "campaign-detail";
  elements.campaignDetailView.classList.toggle("hidden", state.route.kind !== "campaign-detail");
}

function disconnectSectionObserver() {
  if (state.sectionObserver) {
    state.sectionObserver.disconnect();
    state.sectionObserver = null;
  }
}

function observeCurrentSections() {
  disconnectSectionObserver();
  const definitions = getCurrentSectionDefinitions();
  const targets = definitions
    .map((item) => ({
      ...item,
      element: document.getElementById(item.id),
    }))
    .filter((item) => item.element && !item.element.hidden);

  if (targets.length === 0) {
    state.activeSectionId = "contact";
    updateCurrentSectionLink();
    return;
  }

  state.activeSectionId = targets[0].id;
  updateCurrentSectionLink();

  state.sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

      if (visibleEntries.length === 0) {
        return;
      }

      const nextId = visibleEntries[0].target.id;
      if (nextId !== state.activeSectionId) {
        state.activeSectionId = nextId;
        updateCurrentSectionLink();
        renderSiteMenu();
      }
    },
    {
      rootMargin: "-18% 0px -48% 0px",
      threshold: [0.15, 0.4, 0.65],
    }
  );

  targets.forEach((item) => state.sectionObserver.observe(item.element));
}

function renderStoryHighlight() {
  elements.storyHighlightKicker.textContent = "Historia del proyecto";
  elements.storyHighlightTitle.textContent =
    "De una primera campaña escolar a una nueva etapa pública";
  elements.storyHighlightCopy.textContent = HISTORY_CONTENT.summary;
  elements.storyHighlightGrid.innerHTML = HISTORY_CONTENT.homeHighlights
    .map(
      (item) => `
        <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
          <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">${escapeHtml(
            item.title
          )}</p>
          <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(item.copy)}</p>
        </article>
      `
    )
    .join("");
}

function renderHistoryPageView() {
  if (state.route.kind !== "history") {
    elements.historyPageView.innerHTML = "";
    return;
  }

  const legacyCampaign = getLegacyCampaign();
  const summary = legacyCampaign?.summary || {};
  const detailHref = state.activeCampaign
    ? `/campanas/${encodeURIComponent(state.activeCampaign.id)}`
    : "/";

  elements.historyPageView.innerHTML = `
    <div class="mx-auto max-w-7xl px-6">
      <section class="grid gap-10 pb-14 lg:grid-cols-[1.2fr_0.8fr]" id="history-hero">
        <div class="space-y-6">
          <p class="inline-flex rounded-full bg-secondary-container px-4 py-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">Historia de Reciclando Goles</p>
          <h1 class="font-headline text-5xl font-black tracking-tight text-on-surface lg:text-7xl">De una primera campaña escolar a una nueva etapa pública</h1>
          <p class="max-w-3xl text-lg leading-relaxed text-on-surface-variant">${escapeHtml(
            HISTORY_CONTENT.pageIntro
          )}</p>
          <div class="flex flex-wrap gap-4">
            <a class="rounded-full bg-primary px-8 py-4 font-black text-white shadow-xl shadow-primary/20 transition-transform hover:-translate-y-0.5" data-route href="${escapeHtml(
              detailHref
            )}">Ver campaña activa</a>
            <a class="rounded-full bg-surface-container-highest px-8 py-4 font-bold text-primary transition-colors hover:bg-surface-container-high" data-route href="/">Volver al inicio</a>
          </div>
        </div>
        <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
          <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Resumen</p>
          <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(
            HISTORY_CONTENT.longText
          )}</p>
        </article>
      </section>

      <section class="py-10" id="history-origin">
        <div class="grid gap-8 lg:grid-cols-2">
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Cómo empezó</p>
            <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(
              HISTORY_CONTENT.origin
            )}</p>
          </article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Visión inicial</p>
            <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(
              HISTORY_CONTENT.originFollowup
            )}</p>
          </article>
        </div>
      </section>

      <section class="py-10" id="history-first-campaign">
        <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Primera campaña</p>
            <h2 class="mt-3 font-headline text-4xl font-black tracking-tight text-on-surface">${escapeHtml(
              legacyCampaign?.name || "Reciclando Goles x Teletón 2026 Semestre 1"
            )}</h2>
            <p class="mt-4 text-on-surface-variant">${escapeHtml(
              legacyCampaign ? formatDateRange(legacyCampaign.startAt, legacyCampaign.endAt) : "Sin fechas disponibles"
            )}</p>
            <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(
              HISTORY_CONTENT.firstStage
            )}</p>
          </article>
          <article class="rounded-[2rem] bg-gradient-to-br from-primary to-primary-container p-8 text-white shadow-xl shadow-primary/20">
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-secondary-container">Resultados reales</p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <div class="rounded-[1.5rem] bg-white/10 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.25em] text-white/60">Total final</p>
                <p class="mt-2 text-3xl font-black">${escapeHtml(formatCurrency(summary.totalAmount))}</p>
              </div>
              <div class="rounded-[1.5rem] bg-white/10 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.25em] text-white/60">Meta</p>
                <p class="mt-2 text-3xl font-black">${escapeHtml(formatCurrency(legacyCampaign?.goalAmount))}</p>
              </div>
              <div class="rounded-[1.5rem] bg-white/10 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.25em] text-white/60">Físico</p>
                <p class="mt-2 text-2xl font-black">${escapeHtml(formatCurrency(summary.physicalAmount))}</p>
              </div>
              <div class="rounded-[1.5rem] bg-white/10 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.25em] text-white/60">Digital</p>
                <p class="mt-2 text-2xl font-black">${escapeHtml(formatCurrency(summary.digitalAmount))}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="py-10" id="history-legacy">
        <div class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
          <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Lo que dejó la primera etapa</p>
          <div class="mt-6 grid gap-4 lg:grid-cols-2">
            ${HISTORY_CONTENT.outcomes
              .map(
                (item) => `
                  <article class="rounded-[1.5rem] bg-surface-container-low p-5">
                    <p class="leading-relaxed text-on-surface-variant">${escapeHtml(item)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="py-10" id="history-new-stage">
        <div class="grid gap-8 lg:grid-cols-2">
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Nueva etapa</p>
            <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(
              HISTORY_CONTENT.newStage
            )}</p>
          </article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Puente hacia MundialHITO 2026</p>
            <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(
              HISTORY_CONTENT.longText
            )}</p>
          </article>
        </div>
      </section>

      <section class="py-10" id="history-principles">
        <div class="rounded-[2rem] bg-surface-container-low p-8">
          <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Principios del proyecto</p>
          <div class="mt-6 grid gap-4 lg:grid-cols-2">
            ${HISTORY_CONTENT.principles
              .map(
                (item) => `
                  <article class="rounded-[1.5rem] bg-white p-5 shadow-sm">
                    <p class="leading-relaxed text-on-surface-variant">${escapeHtml(item)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function buildCampaignDetailCostCards(campaign) {
  const costBreakdown = getTournamentCostBreakdown(campaign);
  return [
    {
      label: "Donativo para HITO",
      value: formatCurrency(costBreakdown.donationAmount),
      copy: "El proceso de donativo será acompañado por HITO.",
    },
    {
      label: "Arbitraje operativo",
      value: formatCurrency(costBreakdown.refereeFee),
      copy: "La cuota operativa será cobrada por la organización y registrada por separado.",
    },
    {
      label: "Costo total por equipo",
      value: formatCurrency(costBreakdown.teamCostTotal),
      copy: "Separacion clara entre causa social y gasto operativo.",
    },
  ];
}

function renderCampaignDetailView() {
  if (state.route.kind !== "campaign-detail") {
    elements.campaignDetailView.innerHTML = "";
    return;
  }

  const campaign = getRouteCampaign();
  if (!campaign) {
    elements.campaignDetailView.innerHTML = `
      <div class="mx-auto max-w-5xl px-6">
        <div class="rounded-[2rem] bg-white p-10 text-center shadow-lg shadow-primary/10">
          <h1 class="font-headline text-4xl font-black tracking-tight text-on-surface">Campaña no encontrada</h1>
          <p class="mt-4 text-on-surface-variant">No fue posible cargar el detalle público solicitado.</p>
          <a class="mt-8 inline-flex rounded-full bg-primary px-8 py-4 font-black text-white" data-route href="/">Volver al inicio</a>
        </div>
      </div>
    `;
    return;
  }

  const evidence = getCampaignEvidenceForRoute().sort((left, right) => {
    const leftTime = timestampToDate(left.recordedAt)?.getTime() || 0;
    const rightTime = timestampToDate(right.recordedAt)?.getTime() || 0;
    return rightTime - leftTime;
  });
  const costCards = buildCampaignDetailCostCards(campaign);
  const transparencyNotes = getTournamentTransparencyNotes(campaign);

  elements.campaignDetailView.innerHTML = `
    <div class="mx-auto max-w-7xl px-6">
      <section class="grid gap-10 pb-14 lg:grid-cols-[1.15fr_0.85fr]" id="campaign-detail-hero">
        <div class="space-y-6">
          <p class="inline-flex rounded-full bg-secondary-container px-4 py-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">${escapeHtml(
            getPublicCampaignState(campaign)
          )}</p>
          <h1 class="font-headline text-5xl font-black tracking-tight text-on-surface lg:text-7xl">${escapeHtml(
            campaign.name
          )}</h1>
          <p class="max-w-3xl text-lg leading-relaxed text-on-surface-variant">${escapeHtml(
            campaign.subtitle || campaign.publicPrimaryText
          )}</p>
          <div class="flex flex-wrap gap-4">
            <a class="rounded-full bg-primary px-8 py-4 font-black text-white shadow-xl shadow-primary/20 transition-transform hover:-translate-y-0.5" href="#contact">Contacto</a>
            <a class="rounded-full bg-surface-container-highest px-8 py-4 font-bold text-primary transition-colors hover:bg-surface-container-high" data-route href="/">Volver al inicio</a>
          </div>
        </div>
        <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
          <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Resumen visible</p>
          <div class="mt-6 grid gap-4">
            <div class="rounded-[1.5rem] bg-surface-container-low p-5">
              <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Beneficiario</p>
              <p class="mt-2 text-xl font-black text-on-surface">${escapeHtml(campaign.beneficiary || "Por confirmar")}</p>
            </div>
            <div class="rounded-[1.5rem] bg-surface-container-low p-5">
              <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Sede propuesta</p>
              <p class="mt-2 text-xl font-black text-on-surface">${escapeHtml(campaign.proposedVenue || "Por confirmar")}</p>
            </div>
            <div class="rounded-[1.5rem] bg-surface-container-low p-5">
              <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Fecha</p>
              <p class="mt-2 text-xl font-black text-on-surface">${escapeHtml(campaign.dateLabel || "Por confirmar")}</p>
            </div>
          </div>
        </article>
      </section>

      <section class="py-10" id="campaign-detail-facts">
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10"><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Modalidad</p><p class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(campaign.modality || "Por confirmar")}</p></article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10"><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Categoría</p><p class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(campaign.category || "Por confirmar")}</p></article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10"><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Formato</p><p class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(campaign.competitionFormat || "Por confirmar")}</p></article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10"><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Cupo máximo</p><p class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(Number(campaign.maxTeams) > 0 ? `${campaign.maxTeams} equipos` : "Por definir")}</p></article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10"><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Duración</p><p class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(campaign.durationLabel || "Por confirmar")}</p></article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10"><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Estado</p><p class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(getPublicCampaignState(campaign))}</p></article>
        </div>
      </section>

      <section class="py-10" id="campaign-detail-cost">
        <div class="mx-auto mb-10 max-w-3xl text-center">
          <p class="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-tertiary">Costo por equipo</p>
          <h2 class="font-headline text-4xl font-black tracking-tight text-on-surface">Separación pública entre donativo y arbitraje</h2>
        </div>
        <div class="grid gap-6 lg:grid-cols-3">
          ${costCards
            .map(
              (item) => `
                <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
                  <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">${escapeHtml(
                    item.label
                  )}</p>
                  <p class="mt-3 text-4xl font-black text-on-surface">${escapeHtml(item.value)}</p>
                  <p class="mt-4 leading-relaxed text-on-surface-variant">${escapeHtml(item.copy)}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="py-10" id="campaign-detail-companies">
        <div class="mx-auto mb-10 max-w-3xl text-center">
          <p class="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-tertiary">Empresas invitadas</p>
          <h2 class="font-headline text-4xl font-black tracking-tight text-on-surface">Seguimiento empresarial</h2>
        </div>
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          ${(campaign.companies || [])
            .map(
              (company) => `
                <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
                  <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
                    humanizeCompanyStatus(company.status)
                  )}</p>
                  <h3 class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(company.name)}</h3>
                  <p class="mt-3 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(
                    getCompanyStatusCopy(company.status)
                  )}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="py-10" id="campaign-detail-transparency">
        <div class="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <p class="text-sm font-bold uppercase tracking-[0.25em] text-primary">Transparencia de fondos</p>
            <div class="mt-6 space-y-4">
              ${transparencyNotes
                .map(
                  (item) => `
                    <div class="rounded-[1.5rem] bg-surface-container-low p-5">
                      <p class="leading-relaxed text-on-surface-variant">${escapeHtml(item)}</p>
                    </div>
                  `
                )
                .join("")}
            </div>
          </article>
          <article class="rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10">
            <div class="mb-6 flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-bold uppercase tracking-[0.25em] text-primary">Evidencias públicas</p>
                <h3 class="mt-2 font-headline text-3xl font-black tracking-tight text-on-surface">Comprobantes y referencias</h3>
              </div>
              <span class="rounded-full bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface-variant">${evidence.length} registro${evidence.length === 1 ? "" : "s"}</span>
            </div>
            ${
              evidence.length > 0
                ? evidence
                    .map(
                      (item) => `
                        <article class="rounded-[1.5rem] bg-surface-container-low p-5">
                          <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
                            humanizeEvidenceKind(item.kind)
                          )}</p>
                          <h4 class="mt-2 text-xl font-black text-on-surface">${escapeHtml(item.title)}</h4>
                          <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(
                            item.description || "Sin descripción adicional."
                          )}</p>
                          ${buildEvidenceImageMarkup(item, "mt-4 h-56 w-full rounded-[1.25rem] bg-surface object-cover")}
                          <a class="mt-4 inline-flex items-center gap-2 font-bold text-primary hover:underline" href="${escapeHtml(
                            item.publicUrl
                          )}" rel="noreferrer" target="_blank">${escapeHtml(
                            buildEvidenceLinkLabel(item)
                          )}<span class="material-symbols-outlined text-base">open_in_new</span></a>
                        </article>
                      `
                    )
                    .join("")
                : '<div class="rounded-[1.5rem] border border-dashed border-outline-variant bg-surface-container-low px-6 py-10 text-center text-on-surface-variant">Aún no hay evidencias públicas registradas para esta campaña.</div>'
            }
          </article>
        </div>
      </section>

      <section class="py-10" id="campaign-detail-rules">
        <div class="mx-auto mb-10 max-w-3xl text-center">
          <p class="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-tertiary">Reglamento básico</p>
          <h2 class="font-headline text-4xl font-black tracking-tight text-on-surface">Lineamientos de la campaña</h2>
        </div>
        <div class="grid gap-4">
          ${normalizeStringArray(campaign.rules)
            .map(
              (rule, index) => `
                <article class="rounded-[1.5rem] bg-white p-6 shadow-sm">
                  <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">Punto ${index + 1}</p>
                  <p class="mt-3 leading-relaxed text-on-surface-variant">${escapeHtml(rule)}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function renderRouteViews() {
  setSectionVisibility();
  renderStoryHighlight();
  renderHistoryPageView();
  renderCampaignDetailView();
}

function timestampToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, formatter = LONG_DATE_FORMATTER) {
  const date = timestampToDate(value);
  return date ? formatter.format(date) : "Sin fecha";
}

function formatDateRange(startAt, endAt) {
  const start = timestampToDate(startAt);
  const end = timestampToDate(endAt);
  if (!start && !end) {
    return "Sin fechas configuradas";
  }

  if (start && end) {
    return `${LONG_DATE_FORMATTER.format(start)} - ${LONG_DATE_FORMATTER.format(end)}`;
  }

  return start ? `Desde ${LONG_DATE_FORMATTER.format(start)}` : `Hasta ${LONG_DATE_FORMATTER.format(end)}`;
}

function dateToLocalInputValue(value) {
  const date = timestampToDate(value);
  if (!date) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function parseDateTimeLocal(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Ingresa una fecha válida para ${fieldName}.`);
  }

  return parsed;
}

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function normalizeDonorId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "anonimo";
}

function normalizeTotals(rawTotals) {
  const totals = rawTotals || {};
  const normalized = {
    physicalAmount: roundCurrency(totals.physicalAmount),
    recyclingAmount: roundCurrency(totals.recyclingAmount),
    manualDigitalAmount: roundCurrency(totals.manualDigitalAmount),
    syncedDigitalAmount: roundCurrency(totals.syncedDigitalAmount),
    donationCount: Number(totals.donationCount) || 0,
    syncStatus: String(totals.syncStatus || "idle"),
    syncError: String(totals.syncError || ""),
    teletonUrl: String(totals.teletonUrl || ""),
    lastSuccessfulSyncAt: totals.lastSuccessfulSyncAt || null,
  };

  normalized.digitalAmount = roundCurrency(
    normalized.manualDigitalAmount + normalized.syncedDigitalAmount
  );
  normalized.totalAmount = roundCurrency(
    normalized.physicalAmount + normalized.recyclingAmount + normalized.digitalAmount
  );

  return normalized;
}

function computeTotalsSnapshot(baseTotals = {}) {
  const normalized = normalizeTotals(baseTotals);
  return {
    physicalAmount: normalized.physicalAmount,
    recyclingAmount: normalized.recyclingAmount,
    manualDigitalAmount: normalized.manualDigitalAmount,
    syncedDigitalAmount: normalized.syncedDigitalAmount,
    digitalAmount: normalized.digitalAmount,
    totalAmount: normalized.totalAmount,
    donationCount: normalized.donationCount,
    syncStatus: normalized.syncStatus,
    syncError: normalized.syncError,
    syncSource: String(baseTotals.syncSource || ""),
    teletonUrl: String(baseTotals.teletonUrl || ""),
    lastSuccessfulSyncAt: baseTotals.lastSuccessfulSyncAt || null,
  };
}

function buildSummaryFromTotals(totals) {
  return {
    totalAmount: roundCurrency(totals.totalAmount),
    physicalAmount: roundCurrency(totals.physicalAmount),
    digitalAmount: roundCurrency(totals.digitalAmount),
    recyclingAmount: roundCurrency(totals.recyclingAmount),
    donationCount: Number(totals.donationCount) || 0,
  };
}

function buildTotalsWritePayload(totals, overrides = {}) {
  const payload = {
    physicalAmount: roundCurrency(overrides.physicalAmount ?? totals.physicalAmount),
    recyclingAmount: roundCurrency(overrides.recyclingAmount ?? totals.recyclingAmount),
    manualDigitalAmount: roundCurrency(overrides.manualDigitalAmount ?? totals.manualDigitalAmount),
    syncedDigitalAmount: roundCurrency(overrides.syncedDigitalAmount ?? totals.syncedDigitalAmount),
    digitalAmount: roundCurrency(overrides.digitalAmount ?? totals.digitalAmount),
    totalAmount: roundCurrency(overrides.totalAmount ?? totals.totalAmount),
    donationCount: Number(overrides.donationCount ?? totals.donationCount) || 0,
    syncStatus: String(overrides.syncStatus ?? totals.syncStatus ?? "idle"),
    syncError: String(overrides.syncError ?? totals.syncError ?? ""),
    syncSource: String(overrides.syncSource ?? totals.syncSource ?? ""),
    teletonUrl: String(overrides.teletonUrl ?? totals.teletonUrl ?? ""),
    updatedAt: serverTimestamp(),
  };

  const lastSuccessfulSyncAt =
    overrides.lastSuccessfulSyncAt ?? totals.lastSuccessfulSyncAt ?? null;
  if (lastSuccessfulSyncAt) {
    payload.lastSuccessfulSyncAt = lastSuccessfulSyncAt;
  }

  return payload;
}

function createEmptyTotalsDocument(teletonUrl = "") {
  return computeTotalsSnapshot({
    ...EMPTY_TOTALS,
    syncStatus: "idle",
    syncError: "",
    syncSource: "",
    teletonUrl,
    lastSuccessfulSyncAt: null,
  });
}

function normalizeDonationSourceType(sourceType) {
  return ["digital", "recycling"].includes(sourceType) ? sourceType : "physical";
}

function toDisplayName(value) {
  return String(value || "").trim() || "Anonimo";
}

function buildDonorTotalsFromDonations(donationDocuments) {
  const donorMap = new Map();

  donationDocuments.forEach((item) => {
    const displayName = toDisplayName(item.name);
    const donorId = String(item.donorId || "").trim() || normalizeDonorId(displayName);
    const amount = roundCurrency(item.amount);
    const createdAt = item.createdAt || new Date();
    const existing = donorMap.get(donorId) || {
      displayName,
      totalAmount: 0,
      donationCount: 0,
      lastDonationAt: createdAt,
    };

    existing.displayName = displayName;
    existing.totalAmount = roundCurrency(existing.totalAmount + amount);
    existing.donationCount += 1;

    const currentDate = timestampToDate(existing.lastDonationAt) || new Date(0);
    const nextDate = timestampToDate(createdAt) || new Date(0);
    if (nextDate.getTime() >= currentDate.getTime()) {
      existing.lastDonationAt = createdAt;
    }

    donorMap.set(donorId, existing);
  });

  return donorMap;
}

function statusToneClass(tone) {
  return {
    info: "text-on-surface-variant",
    success: "text-emerald-700",
    error: "text-red-700",
  }[tone] || "text-on-surface-variant";
}

function showStatus(message, tone = "info") {
  const tones = {
    info: "border-secondary/20 bg-secondary-container/40 text-on-surface",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };

  elements.appStatus.className = `mx-auto mb-8 max-w-5xl rounded-2xl border px-4 py-3 text-sm font-medium ${
    tones[tone] || tones.info
  }`;
  elements.appStatus.textContent = message;
  elements.appStatus.hidden = false;
}

function clearStatus() {
  elements.appStatus.hidden = true;
  elements.appStatus.textContent = "";
}

function setMessage(element, message, tone = "info") {
  element.className = `min-h-6 text-sm font-medium ${statusToneClass(tone)}`;
  element.textContent = message;
}

function setInputValueIfIdle(element, value) {
  if (!element) {
    return;
  }

  if (document.activeElement === element) {
    return;
  }

  element.value = value;
}

function sortCampaigns(campaigns) {
  return [...campaigns].sort((left, right) => {
    const leftDate =
      timestampToDate(left.startAt)?.getTime() ||
      timestampToDate(left.createdAt)?.getTime() ||
      0;
    const rightDate =
      timestampToDate(right.startAt)?.getTime() ||
      timestampToDate(right.createdAt)?.getTime() ||
      0;
    return rightDate - leftDate;
  });
}

function humanizeCampaignStatus(status) {
  if (status === "active") {
    return "Campaña activa";
  }

  if (status === "closed") {
    return "Campaña cerrada";
  }

  return "Campaña en borrador";
}

function humanizeSyncStatus(syncStatus) {
  if (syncStatus === "success") {
    return "Seguimiento al día";
  }

  if (syncStatus === "error") {
    return "Revisión necesaria";
  }

  return "Pendiente";
}

function humanizeEvidenceKind(kind) {
  return {
    receipt: "Recibo",
    report: "Reporte",
    photo: "Foto",
    news: "Nota",
    other: "Otro",
  }[kind] || "Evidencia";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => repairVisibleText(String(item || "").trim()))
    .filter(Boolean);
}

function normalizeCompanies(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const name = repairVisibleText(String(item.name || "").trim());
      if (!name) {
        return null;
      }

      const normalizedStatus = String(item.status || "invited")
        .trim()
        .toLowerCase();

      return {
        name,
        status: ["invited", "interested", "confirmed", "paid"].includes(normalizedStatus)
          ? normalizedStatus
          : "invited",
      };
    })
    .filter(Boolean);
}

function humanizeCompanyStatus(status) {
  return {
    invited: "Invitada",
    interested: "Interesada",
    confirmed: "Confirmada",
    paid: "Pagada",
  }[String(status || "").trim().toLowerCase()] || "Invitada";
}

function getCompanyStatusCopy(status) {
  return {
    invited: "Empresa en etapa de invitación pública para esta edición.",
    interested: "Empresa que ya manifestó interés, aún sin confirmar lugar.",
    confirmed: "Empresa con intención confirmada, pendiente de pasos finales.",
    paid: "Empresa con aportación operativa registrada por separado.",
  }[String(status || "").trim().toLowerCase()] || "Empresa invitada a participar.";
}

function isTournamentCampaign(campaign) {
  return String(campaign?.campaignType || "").trim().toLowerCase() === "tournament";
}

function getPublicCampaignState(campaign) {
  return String(campaign?.publicStateLabel || "").trim() || humanizeCampaignStatus(campaign?.status);
}

function getTournamentCostBreakdown(campaign) {
  return {
    teamCostTotal: roundCurrency(campaign?.teamCostTotal),
    donationAmount: roundCurrency(campaign?.donationAmount),
    refereeFee: roundCurrency(campaign?.refereeFee),
  };
}

function getTournamentOverviewLine(campaign) {
  const fragments = [];

  if (campaign?.beneficiary) {
    fragments.push(`Beneficiario: ${campaign.beneficiary}`);
  }

  if (campaign?.proposedVenue) {
    fragments.push(`Sede propuesta: ${campaign.proposedVenue}`);
  }

  if (campaign?.dateLabel) {
    fragments.push(`Fecha: ${campaign.dateLabel}`);
  }

  return fragments.join(" · ") || "Detalles por confirmar.";
}

function getTournamentSummaryCopy(campaign) {
  const fragments = [];

  if (campaign?.modality) {
    fragments.push(campaign.modality);
  }

  if (campaign?.category) {
    fragments.push(`categoría ${String(campaign.category).toLowerCase()}`);
  }

  if (campaign?.competitionFormat) {
    fragments.push(`formato ${String(campaign.competitionFormat).toLowerCase()}`);
  }

  if (campaign?.durationLabel) {
    fragments.push(`duración ${String(campaign.durationLabel).toLowerCase()}`);
  }

  if (Number(campaign?.maxTeams) > 0) {
    fragments.push(`cupo máximo ${campaign.maxTeams} equipos`);
  }

  return fragments.join(" · ") || "Campaña deportiva en preparación.";
}

function getTournamentTransparencyNotes(campaign) {
  const configuredNotes = normalizeStringArray(campaign?.transparencyNotes);
  if (configuredNotes.length > 0) {
    return configuredNotes;
  }

  return [
    "Los $2,000 MXN por equipo corresponden al donativo en beneficio del HITO.",
    "Los $400 MXN por equipo corresponden a arbitraje operativo y se registran por separado.",
    "El proceso de donativo será acompañado por el Hospital Infantil Teletón de Oncología.",
  ];
}

function normalizeEvidenceUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch (error) {
    throw new Error("Ingresa una URL pública válida.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("La URL pública debe iniciar con http o https.");
  }

  const normalizedUrl = parsedUrl.toString();
  if (normalizedUrl.length > 500) {
    throw new Error("La URL pública es demasiado larga.");
  }

  return normalizedUrl;
}

function sanitizeStorageFileName(fileName) {
  const normalized = String(fileName || "evidencia")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const dotIndex = normalized.lastIndexOf(".");
  const baseName = (dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const extension = (dotIndex > 0 ? normalized.slice(dotIndex + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);

  return extension ? `${baseName || "evidencia"}.${extension}` : baseName || "evidencia";
}

function buildEvidenceStoragePath(campaignId, fileName) {
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `campaigns/${campaignId}/evidence/${uniqueId}-${sanitizeStorageFileName(fileName)}`;
}

function looksLikeImageUrl(url) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(parsedUrl.pathname);
  } catch (error) {
    return false;
  }
}

function isImageEvidence(item) {
  return (
    String(item?.assetType || "").trim() === "image" ||
    String(item?.mimeType || "").trim().startsWith("image/") ||
    looksLikeImageUrl(item?.publicUrl)
  );
}

function buildEvidenceLinkLabel(item) {
  if (isImageEvidence(item)) {
    return "Abrir imagen";
  }

  if (item?.kind === "photo") {
    return "Abrir enlace de foto";
  }

  return "Abrir evidencia";
}

function buildEvidenceImageMarkup(item, imageClasses) {
  if (!isImageEvidence(item) || !item?.publicUrl) {
    return "";
  }

  return `
    <a class="mt-4 block overflow-hidden rounded-[1.25rem] border border-outline-variant/30 bg-white" href="${escapeHtml(
      item.publicUrl
    )}" rel="noreferrer" target="_blank">
      <img
        alt="${escapeHtml(`Evidencia: ${item.title || "Imagen pública"}`)}"
        class="${imageClasses}"
        loading="lazy"
        src="${escapeHtml(item.publicUrl)}"
      />
    </a>
  `;
}

function mapStorageError(error, fallbackMessage) {
  const code = String(error?.code || "").trim();
  if (code === "storage/unauthorized") {
    return "Tu sesión no tiene permisos para subir o borrar esta foto.";
  }

  if (code === "storage/quota-exceeded") {
    return "El almacenamiento llegó a su límite disponible.";
  }

  if (code === "storage/canceled") {
    return "La subida de la foto fue cancelada.";
  }

  if (code === "storage/object-not-found") {
    return "La foto ya no existe en el almacenamiento.";
  }

  return error?.message || fallbackMessage;
}

async function uploadEvidenceImage(campaignId, file) {
  if (!storage) {
    throw new Error("Firebase Storage no está listo en este entorno.");
  }

  if (!(file instanceof File)) {
    throw new Error("Selecciona una foto válida para la evidencia.");
  }

  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Solo se permiten imágenes para las evidencias públicas.");
  }

  if (file.size > MAX_EVIDENCE_IMAGE_BYTES) {
    throw new Error("La foto supera el límite de 8 MB.");
  }

  const storagePath = buildEvidenceStoragePath(campaignId, file.name);
  const fileRef = storageRef(storage, storagePath);
  await uploadBytes(fileRef, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "public,max-age=3600",
  });
  const publicUrl = await getDownloadURL(fileRef);

  return {
    assetType: "image",
    fileName: sanitizeStorageFileName(file.name),
    mimeType: String(file.type || "image/jpeg"),
    publicUrl,
    storagePath,
  };
}

function buildCountdown(endAt, isActive) {
  if (!isActive) {
    return {
      value: "En espera",
      label: "Sin cierre programado por ahora",
    };
  }

  const endDate = timestampToDate(endAt);
  if (!endDate) {
    return {
      value: "Sin fecha",
      label: "Falta definir la fecha de cierre",
    };
  }

  const remainingMs = endDate.getTime() - Date.now();
  if (remainingMs <= 0) {
    return {
      value: "Cierre alcanzado",
      label: `Fecha objetivo: ${LONG_DATE_FORMATTER.format(endDate)}`,
    };
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (remainingMs >= dayMs) {
    const days = Math.ceil(remainingMs / dayMs);
    return {
      value: `${days} ${days === 1 ? "día" : "días"}`,
      label: `Cierre programado para ${LONG_DATE_FORMATTER.format(endDate)}`,
    };
  }

  if (remainingMs >= hourMs) {
    const hours = Math.ceil(remainingMs / hourMs);
    return {
      value: `${hours} ${hours === 1 ? "hora" : "horas"}`,
      label: "Restantes para el cierre",
    };
  }

  const minutes = Math.max(Math.ceil(remainingMs / minuteMs), 1);
  return {
    value: `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`,
    label: "Últimos minutos de la campaña",
  };
}

function renderHero() {
  const campaign = state.activeCampaign;
  if (!campaign) {
    elements.heroCampaignState.textContent = "Plataforma solidaria";
    elements.heroCampaignCopy.textContent =
      "No hay una campaña abierta en este momento. El sitio sigue mostrando historial, aliados y transparencia institucional.";
    elements.heroCampaignName.textContent = "Sin campaña activa";
    elements.heroCampaignMeta.textContent =
      "La siguiente edición se anunciará aquí.";
    elements.heroSecondaryButton.textContent = "Ver historia";
    elements.heroSecondaryButton.href = "/historia";
    elements.heroSecondaryButton.setAttribute("data-route", "");
    elements.heroPrimaryButton.disabled = false;
    return;
  }

  if (isTournamentCampaign(campaign)) {
    elements.heroCampaignState.textContent = getPublicCampaignState(campaign);
    elements.heroCampaignCopy.textContent =
      "La portada mantiene una lectura institucional del proyecto mientras la campaña activa vive con más detalle en su propia página pública.";
    elements.heroCampaignName.textContent = campaign.name;
    elements.heroCampaignMeta.textContent =
      campaign.subtitle || getTournamentOverviewLine(campaign);
    elements.heroSecondaryButton.textContent = "Ver campaña completa";
    elements.heroSecondaryButton.href = `/campanas/${encodeURIComponent(campaign.id)}`;
    elements.heroSecondaryButton.setAttribute("data-route", "");
    elements.heroPrimaryButton.disabled = false;
    return;
  }

  elements.heroCampaignState.textContent = humanizeCampaignStatus(campaign.status);
  elements.heroCampaignCopy.textContent = `${campaign.name} (${campaign.semesterLabel || "Sin semestre"}) reúne la meta pública, las fechas oficiales y las rutas de apoyo de esta edición.`;
  elements.heroCampaignName.textContent = campaign.name;
  elements.heroCampaignMeta.textContent =
    campaign.status === "active"
      ? `Cierre programado: ${formatDate(campaign.endAt)}`
      : "Esta campaña ya cerró y permanece en el historial institucional.";
  elements.heroSecondaryButton.textContent = "Ver ranking";
  elements.heroSecondaryButton.href = "#ranking";
  elements.heroSecondaryButton.removeAttribute("data-route");
  elements.heroPrimaryButton.disabled = false;
}

function setLinkState(linkElement, url, label) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    linkElement.classList.add("hidden");
    linkElement.removeAttribute("href");
    linkElement.removeAttribute("data-route");
    return;
  }

  linkElement.classList.remove("hidden");
  linkElement.href = safeUrl;
  linkElement.textContent = label;
  linkElement.removeAttribute("data-route");
  linkElement.setAttribute("target", "_blank");
  linkElement.setAttribute("rel", "noreferrer");
}

function renderActiveCampaignSection() {
  const campaign = state.activeCampaign;
  const totals = state.activeTotals;

  if (!campaign) {
    elements.activeCampaignName.textContent = "Sin campaña activa";
    elements.activeCampaignStatus.textContent = "Estado institucional";
    elements.activeCampaignSemester.textContent = "Plataforma oficial del proyecto";
    elements.activeCampaignDates.textContent =
      "Por ahora no hay una campaña abierta. El historial del proyecto sigue disponible más abajo.";
    elements.activeCampaignGoalLabel.textContent = "Meta activa";
    elements.activeCampaignGoal.textContent = formatCurrency(0);
    elements.activeCampaignCopy.textContent =
      "Reciclando Goles sigue funcionando como plataforma institucional mientras prepara la siguiente campaña.";
    elements.activeSummaryKicker.textContent = "Estado del proyecto";
    elements.activeSummaryCopy.textContent =
      "El tablero se reinicia por campaña, pero el historial queda visible para mantener continuidad y transparencia.";
    elements.activeCampaignTotal.textContent = formatCurrency(0);
    elements.activeHistoryLabel.textContent = "Campañas cerradas";
    elements.activeSecondaryStatLabel.textContent = "Transparencia pública";
    elements.activeCampaignTransparencyCount.textContent = "0 evidencias";
    elements.activeCampaignSupportButton.textContent = "Ver formas de apoyo";
    setLinkState(elements.activeCampaignTeletonLink, "", "");
    elements.activeCampaignSupportButton.disabled = false;
    return;
  }

  if (isTournamentCampaign(campaign)) {
    const costBreakdown = getTournamentCostBreakdown(campaign);
    const companies = campaign.companies || [];

    elements.activeCampaignName.textContent = campaign.name;
    elements.activeCampaignStatus.textContent = getPublicCampaignState(campaign);
    elements.activeCampaignSemester.textContent =
      campaign.subtitle || "Campaña deportiva con causa";
    elements.activeCampaignDates.textContent = getTournamentOverviewLine(campaign);
    elements.activeCampaignGoalLabel.textContent = "Costo por equipo";
    elements.activeCampaignGoal.textContent = formatCurrency(costBreakdown.teamCostTotal);
    elements.activeCampaignCopy.textContent =
      "La home conserva un resumen institucional. El reglamento y la operación puntual viven dentro de la página de campaña.";
    elements.activeSummaryKicker.textContent = "Cupo del torneo";
    elements.activeSummaryCopy.textContent =
      "Torneo empresarial en planeación con sede propuesta en Planet Gool, formato de eliminación directa y duración de un día.";
    elements.activeCampaignTotal.textContent =
      Number(campaign.maxTeams) > 0 ? `${campaign.maxTeams} equipos` : "Por definir";
    elements.activeHistoryLabel.textContent = "Campañas cerradas";
    elements.activeSecondaryStatLabel.textContent = "Empresas invitadas";
    elements.activeCampaignTransparencyCount.textContent = `${companies.length} empresa${
      companies.length === 1 ? "" : "s"
    }`;
    elements.activeCampaignSupportButton.textContent = "Cómo apoyar";
    elements.activeCampaignTeletonLink.classList.remove("hidden");
    elements.activeCampaignTeletonLink.href = `/campanas/${encodeURIComponent(campaign.id)}`;
    elements.activeCampaignTeletonLink.textContent = "Ver campaña completa";
    elements.activeCampaignTeletonLink.removeAttribute("target");
    elements.activeCampaignTeletonLink.removeAttribute("rel");
    elements.activeCampaignTeletonLink.setAttribute("data-route", "");
    elements.activeCampaignSupportButton.disabled = false;
    return;
  }

  elements.activeCampaignName.textContent = campaign.name;
  elements.activeCampaignStatus.textContent = humanizeCampaignStatus(campaign.status);
  elements.activeCampaignSemester.textContent = campaign.semesterLabel || "Semestre no definido";
  elements.activeCampaignDates.textContent = formatDateRange(campaign.startAt, campaign.endAt);
  elements.activeCampaignGoalLabel.textContent = "Meta activa";
  elements.activeCampaignGoal.textContent = formatCurrency(campaign.goalAmount);
  elements.activeCampaignCopy.textContent =
    campaign.status === "active"
      ? "Consulta aquí la meta vigente, las fechas oficiales y las formas públicas de apoyo de esta edición."
      : "Esta campaña ya cerró, pero su información permanece como parte del historial institucional.";
  elements.activeSummaryKicker.textContent = "Estado del proyecto";
  elements.activeSummaryCopy.textContent =
    "El tablero se reinicia por campaña, pero el historial queda visible para mantener continuidad y transparencia.";
  elements.activeCampaignTotal.textContent = formatCurrency(totals.totalAmount);
  elements.activeHistoryLabel.textContent = "Campañas cerradas";
  elements.activeSecondaryStatLabel.textContent = "Transparencia pública";
  setLinkState(
    elements.activeCampaignTeletonLink,
    campaign.teletonUrl,
    "Abrir página oficial de Teletón"
  );
  elements.activeCampaignSupportButton.disabled = false;
}

function renderCounter() {
  const campaign = state.activeCampaign;
  const totals = state.activeTotals;
  const goalAmount = Number(campaign?.goalAmount) || 0;
  const totalAmount = roundCurrency(totals.totalAmount);
  const percent = goalAmount > 0 ? Math.min((totalAmount / goalAmount) * 100, 100) : 0;

  if (isTournamentCampaign(campaign)) {
    const costBreakdown = getTournamentCostBreakdown(campaign);
    const donationSharePercent =
      costBreakdown.teamCostTotal > 0
        ? Math.round((costBreakdown.donationAmount / costBreakdown.teamCostTotal) * 100)
        : 0;

    elements.impactKicker.textContent = "Datos rápidos";
    elements.impactTitle.textContent = campaign.name || "Campaña activa";
    elements.impactDescription.textContent =
      campaign.publicPrimaryText ||
      "Torneo empresarial de fútbol 7 en beneficio del Hospital Infantil Teletón de Oncología.";
    elements.counterStageCopy.textContent = getPublicCampaignState(campaign);
    elements.counterBreakdownCopy.textContent = `${formatCurrency(
      costBreakdown.donationAmount
    )} de donativo para HITO · ${formatCurrency(
      costBreakdown.refereeFee
    )} de arbitraje operativo.`;
    elements.counterTotalLabel.textContent = "Costo total";
    elements.counterGoalLabel.textContent = "Donativo";
    elements.counterTotal.textContent = formatCurrency(costBreakdown.teamCostTotal);
    elements.counterGoal.textContent = formatCurrency(costBreakdown.donationAmount);
    elements.counterPercent.textContent = `${donationSharePercent}% donativo`;
    elements.counterRemaining.textContent = `${formatCurrency(
      costBreakdown.refereeFee
    )} corresponden a arbitraje operativo.`;
    elements.counterFill.style.width = `${Math.max(Math.min(donationSharePercent, 100), 0)}%`;

    elements.breakdownPhysicalLabel.textContent = "Donativo HITO";
    elements.breakdownPhysical.textContent = formatCurrency(costBreakdown.donationAmount);
    elements.breakdownPhysicalCopy.textContent =
      "El proceso de donativo será acompañado por HITO.";
    elements.breakdownDigitalLabel.textContent = "Arbitraje";
    elements.breakdownDigital.textContent = formatCurrency(costBreakdown.refereeFee);
    elements.breakdownDigitalCopy.textContent =
      "Cuota operativa cobrada por la organización y registrada por separado.";
    elements.breakdownRecyclingLabel.textContent = "Cupo máximo";
    elements.breakdownRecycling.textContent =
      Number(campaign.maxTeams) > 0 ? `${campaign.maxTeams} equipos` : "Por definir";
    elements.breakdownRecyclingCopy.textContent = getTournamentSummaryCopy(campaign);

    elements.counterDonationCount.textContent =
      Number(campaign.maxTeams) > 0 ? String(campaign.maxTeams) : "0";
    elements.counterDonationLabel.textContent = "Equipos máximo";
    elements.counterCountdownValue.textContent = campaign.dateLabel || "Por confirmar";
    elements.counterCountdownLabel.textContent = "Fecha del torneo";
    elements.counterSyncStatus.textContent = campaign.proposedVenue || "Por confirmar";
    elements.counterSyncLabel.textContent = "Sede propuesta";
    return;
  }

  elements.impactKicker.textContent = "Contador público";
  elements.impactTitle.textContent = "Contador de campaña";
  elements.impactDescription.textContent =
    "El avance se calcula por campaña y separa aportes físicos, digitales y equivalentes de reciclaje.";
  elements.counterTotalLabel.textContent = "Recaudado";
  elements.counterGoalLabel.textContent = "Meta";
  elements.counterTotal.textContent = formatCurrency(totalAmount);
  elements.counterGoal.textContent = formatCurrency(goalAmount);
  elements.breakdownPhysicalLabel.textContent = "Físico";
  elements.breakdownPhysical.textContent = formatCurrency(totals.physicalAmount);
  elements.breakdownPhysicalCopy.textContent = "Donativos presenciales registrados por admin.";
  elements.breakdownDigitalLabel.textContent = "Digital";
  elements.breakdownDigital.textContent = formatCurrency(totals.digitalAmount);
  elements.breakdownDigitalCopy.textContent =
    "Suma de donativos digitales manuales y sincronizados.";
  elements.breakdownRecyclingLabel.textContent = "Reciclaje";
  elements.breakdownRecycling.textContent = formatCurrency(totals.recyclingAmount);
  elements.breakdownRecyclingCopy.textContent = "Equivalente monetario del reciclaje recibido.";
  elements.counterDonationCount.textContent = String(totals.donationCount);
  elements.counterDonationLabel.textContent = "Donaciones";
  elements.counterBreakdownCopy.textContent = `Físico: ${formatCurrency(
    totals.physicalAmount
  )} · Digital: ${formatCurrency(totals.digitalAmount)} · Reciclaje: ${formatCurrency(
    totals.recyclingAmount
  )}`;
  elements.counterFill.style.width = `${percent}%`;
  elements.counterSyncStatus.textContent =
    humanizeSyncStatus(totals.syncStatus);
  elements.counterSyncLabel.textContent = "Teletón digital";

  if (!campaign) {
    elements.counterStageCopy.textContent = "Modo institucional";
    elements.counterPercent.textContent = "0% de meta";
    elements.counterRemaining.textContent = "El contador se activará con la siguiente campaña.";
    const countdown = buildCountdown(null, false);
    elements.counterCountdownValue.textContent = countdown.value;
    elements.counterCountdownLabel.textContent = countdown.label;
    return;
  }

  const remaining = Math.max(goalAmount - totalAmount, 0);
  elements.counterStageCopy.textContent =
    campaign.status === "active" ? "Campaña activa en curso" : humanizeCampaignStatus(campaign.status);
  elements.counterPercent.textContent =
    goalAmount > 0 ? `${Math.round(percent)}% de meta` : "Sin meta configurada";
  elements.counterRemaining.textContent =
    goalAmount <= 0
      ? "Configura una meta para mostrar el avance"
      : remaining > 0
        ? `Faltan ${formatCurrency(remaining)} para la meta`
        : `Meta alcanzada por ${formatCurrency(totalAmount - goalAmount)}`;

  const countdown = buildCountdown(campaign.endAt, campaign.status === "active");
  elements.counterCountdownValue.textContent = countdown.value;
  elements.counterCountdownLabel.textContent = countdown.label;
}

function getPublicPiggyBanks() {
  return state.activePiggyBanks.filter((item) => item.status === "active");
}

function renderPiggyBanks() {
  if (isTournamentCampaign(state.activeCampaign)) {
    const companies = state.activeCampaign?.companies || [];
    elements.piggyBanksKicker.textContent = "Empresas invitadas";
    elements.piggyBanksTitle.textContent = "Participación empresarial en seguimiento";
    elements.piggyBanksCopy.textContent =
      "Estas empresas forman parte de la invitación inicial de MundialHITO 2026. Su estatus puede cambiar conforme avance la planeación.";
    elements.piggyBanksList.innerHTML = "";
    elements.piggyBanksEmpty.hidden = companies.length > 0;
    elements.piggyBanksEmpty.textContent =
      "Aún no hay empresas publicadas para esta campaña.";

    companies.forEach((company) => {
      const article = document.createElement("article");
      article.className = "rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10";
      article.innerHTML = `
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
          humanizeCompanyStatus(company.status)
        )}</p>
        <h3 class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(company.name)}</h3>
        <p class="mt-3 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(
          getCompanyStatusCopy(company.status)
        )}</p>
      `;
      elements.piggyBanksList.append(article);
    });
    return;
  }

  const piggyBanks = getPublicPiggyBanks();
  elements.piggyBanksKicker.textContent = "Alcancías activas";
  elements.piggyBanksTitle.textContent = "Puntos listos para recibir apoyo";
  elements.piggyBanksCopy.textContent =
    "Cada campaña puede abrir y cerrar alcancías sin perder el histórico del proyecto.";
  elements.piggyBanksList.innerHTML = "";
  elements.piggyBanksEmpty.hidden = piggyBanks.length > 0;
  elements.piggyBanksEmpty.textContent =
    "No hay alcancías activas visibles en esta campaña.";

  piggyBanks.forEach((piggyBank) => {
    const article = document.createElement("article");
    article.className = "rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10";
    article.innerHTML = `
      <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
        humanizeCampaignStatus("active")
      )}</p>
      <h3 class="mt-3 text-2xl font-black text-on-surface">${escapeHtml(piggyBank.name)}</h3>
      <p class="mt-3 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(
        piggyBank.location || "Ubicacion por definir"
      )}</p>
      <div class="mt-5 flex flex-wrap gap-2">
        ${(piggyBank.accepts || [])
          .map(
            (item) =>
              `<span class="rounded-full bg-surface-container-low px-3 py-2 text-xs font-bold text-on-surface-variant">${escapeHtml(
                item
              )}</span>`
          )
          .join("") || '<span class="rounded-full bg-surface-container-low px-3 py-2 text-xs font-bold text-on-surface-variant">Sin categorias</span>'}
      </div>
      <p class="mt-5 text-sm text-on-surface-variant">${escapeHtml(
        piggyBank.notes || "Sin notas adicionales."
      )}</p>
    `;
    elements.piggyBanksList.append(article);
  });
}

function renderGeneralDonationsCard() {
  if (isTournamentCampaign(state.activeCampaign)) {
    elements.generalDonationsCard.innerHTML = "";
    elements.generalDonationsCard.hidden = true;
    return;
  }

  const shouldShow = Number(state.anonymousSummary.donationCount) > 0;
  elements.generalDonationsCard.innerHTML = "";
  elements.generalDonationsCard.hidden = !shouldShow;

  if (!shouldShow) {
    return;
  }

  const card = document.createElement("article");
  card.className =
    "rounded-[2rem] border border-secondary/20 bg-gradient-to-r from-secondary-container/35 to-white p-6 shadow-sm";
  card.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-6">
      <div class="space-y-2">
        <p class="text-xs font-black uppercase tracking-[0.3em] text-secondary">Donaciones generales</p>
        <h3 class="font-headline text-3xl font-black tracking-tight text-on-surface">Aportes anonimos</h3>
        <p class="text-sm text-on-surface-variant">${state.anonymousSummary.donationCount} donación${
    state.anonymousSummary.donationCount === 1 ? "" : "es"
  } fuera del ranking nominal.</p>
      </div>
      <div class="min-w-[180px] text-left sm:text-right">
        <p class="text-3xl font-black text-primary">${formatCurrency(
          state.anonymousSummary.totalAmount
        )}</p>
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">${
          state.anonymousSummary.donationCount
        } donación${state.anonymousSummary.donationCount === 1 ? "" : "es"}</p>
      </div>
    </div>
  `;
  elements.generalDonationsCard.append(card);
}

function renderLeaderboard() {
  if (isTournamentCampaign(state.activeCampaign)) {
    const campaign = state.activeCampaign;
    const costBreakdown = getTournamentCostBreakdown(campaign);
    const notes = getTournamentTransparencyNotes(campaign);

    elements.rankingKicker.textContent = "Transparencia de fondos";
    elements.rankingTitle.textContent = "Distribución pública por equipo";
    elements.rankingCopy.textContent =
      "La campaña distingue el donativo para HITO de la cuota operativa de arbitraje para evitar mezclar conceptos.";
    elements.leaderboardList.innerHTML = "";
    elements.leaderboardEmpty.hidden = true;
    elements.generalDonationsCard.innerHTML = "";
    elements.generalDonationsCard.hidden = true;

    const items = [
      {
        title: "Donativo para HITO",
        value: formatCurrency(costBreakdown.donationAmount),
        copy: notes[0] || "Monto solidario en beneficio del Hospital Infantil Teletón de Oncología.",
      },
      {
        title: "Arbitraje operativo",
        value: formatCurrency(costBreakdown.refereeFee),
        copy: notes[1] || "Cuota operativa cobrada y registrada por la organización.",
      },
      {
        title: "Costo total por equipo",
        value: formatCurrency(costBreakdown.teamCostTotal),
        copy: notes[2] || "El acompañamiento del donativo se realizará junto con HITO.",
      },
    ];

    items.forEach((item) => {
      const row = document.createElement("article");
      row.className =
        "group flex flex-wrap items-center justify-between gap-6 rounded-[2rem] bg-white p-6 shadow-sm";
      row.innerHTML = `
        <div class="space-y-2">
          <p class="text-xs font-black uppercase tracking-[0.3em] text-secondary">${escapeHtml(
            item.title
          )}</p>
          <p class="max-w-2xl text-sm text-on-surface-variant">${escapeHtml(item.copy)}</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-black text-primary">${escapeHtml(item.value)}</p>
        </div>
      `;
      elements.leaderboardList.append(row);
    });
    return;
  }

  elements.rankingKicker.textContent = "Ranking público";
  elements.rankingTitle.textContent = "Muro de Campeones";
  elements.rankingCopy.textContent =
    "Ranking acumulado por donador dentro de la campaña activa.";
  renderGeneralDonationsCard();
  elements.leaderboardList.innerHTML = "";
  const donors = state.topDonors;
  const hasContent = donors.length > 0 || state.anonymousSummary.donationCount > 0;
  elements.leaderboardEmpty.hidden = hasContent;

  donors.forEach((item, index) => {
    const accent = index === 0;
    const row = document.createElement("article");
    row.className = accent
      ? "group flex flex-wrap items-center justify-between gap-6 rounded-[2rem] border-l-8 border-secondary bg-white p-6 shadow-md"
      : "group flex flex-wrap items-center justify-between gap-6 rounded-[2rem] bg-white p-6 shadow-sm";
    row.innerHTML = `
      <div class="flex items-center gap-5">
        <div class="${
          accent
            ? "flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-xl font-black text-secondary shadow-lg"
            : "flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-highest text-xl font-black text-zinc-600"
        }">${index + 1}</div>
        <div>
          <h3 class="text-lg font-bold text-on-surface">${escapeHtml(item.displayName)}</h3>
          <p class="text-sm text-on-surface-variant">${item.donationCount} donación${
      item.donationCount === 1 ? "" : "es"
    } acumulada${item.donationCount === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div class="text-right">
        <p class="${accent ? "text-2xl font-black text-primary" : "text-2xl font-black text-on-surface"}">${formatCurrency(
      item.totalAmount
    )}</p>
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Lugar ${
          index + 1
        }</p>
      </div>
    `;
    elements.leaderboardList.append(row);
  });
}

function renderTransparency() {
  if (isTournamentCampaign(state.activeCampaign)) {
    const campaign = state.activeCampaign;
    const evidence = [...state.activeEvidence].sort((left, right) => {
      const leftDate = timestampToDate(left.recordedAt)?.getTime() || 0;
      const rightDate = timestampToDate(right.recordedAt)?.getTime() || 0;
      return rightDate - leftDate;
    });

    elements.transparencyKicker.textContent = "Transparencia";
    elements.transparencyTitle.textContent = "Seguimiento público de la campaña";
    elements.transparencyCopy.textContent =
      "La portada muestra fondos, evidencias y estado general. El reglamento completo vive dentro de la página propia de la campaña.";
    elements.transparencySummaryKicker.textContent = "Estado visible";
    elements.transparencySyncStatus.textContent = getPublicCampaignState(campaign);
    elements.transparencySyncCopy.textContent =
      "Los montos solidarios y los operativos se comunican por separado para mantener claridad pública.";
    elements.transparencySummaryBoxKicker.textContent = "Resumen de fondos";
    elements.transparencyTotalLabel.textContent = "Donativo HITO";
    elements.transparencyTotalAmount.textContent = formatCurrency(campaign.donationAmount);
    elements.transparencyDigitalLabel.textContent = "Arbitraje";
    elements.transparencyDigitalAmount.textContent = formatCurrency(campaign.refereeFee);
    elements.transparencyLastSyncLabel.textContent = "Evidencias";
    elements.transparencyLastSync.textContent = `${evidence.length} registro${
      evidence.length === 1 ? "" : "s"
    }`;
    elements.transparencyListKicker.textContent = "Evidencias públicas";
    elements.transparencyListTitle.textContent = "Comprobantes y referencias";
    elements.transparencyEvidenceCount.textContent = `${evidence.length} registro${
      evidence.length === 1 ? "" : "s"
    }`;
    elements.transparencyEvidenceList.innerHTML = "";
    elements.transparencyEvidenceEmpty.hidden = evidence.length > 0;
    elements.transparencyEvidenceEmpty.textContent =
      "Aún no hay evidencias públicas registradas para esta campaña.";

    evidence.forEach((item) => {
      const article = document.createElement("article");
      article.className = "rounded-[1.5rem] bg-surface-container-low p-5";
      article.innerHTML = `
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
              humanizeEvidenceKind(item.kind)
            )}</p>
            <h4 class="mt-2 text-xl font-black text-on-surface">${escapeHtml(item.title)}</h4>
            <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(
                            item.description || "Sin descripción adicional."
            )}</p>
          </div>
          <div class="min-w-[180px] text-left sm:text-right">
            <p class="text-sm font-bold text-primary">${
              item.amount != null ? formatCurrency(item.amount) : "Sin monto asociado"
            }</p>
            <p class="mt-1 text-xs uppercase tracking-[0.25em] text-on-surface-variant">${escapeHtml(
              formatDate(item.recordedAt)
            )}</p>
          </div>
        </div>
        ${buildEvidenceImageMarkup(item, "h-56 w-full bg-surface object-cover object-center")}
        <a class="mt-4 inline-flex items-center gap-2 font-bold text-primary hover:underline" href="${escapeHtml(
          item.publicUrl
        )}" rel="noreferrer" target="_blank">
          ${escapeHtml(buildEvidenceLinkLabel(item))} <span class="material-symbols-outlined text-base">open_in_new</span>
        </a>
      `;
      elements.transparencyEvidenceList.append(article);
    });
    return;
  }

  const totals = state.activeTotals;
  const evidence = [...state.activeEvidence].sort((left, right) => {
    const leftDate = timestampToDate(left.recordedAt)?.getTime() || 0;
    const rightDate = timestampToDate(right.recordedAt)?.getTime() || 0;
    return rightDate - leftDate;
  });

  elements.transparencySyncStatus.textContent = state.activeCampaign
    ? humanizeSyncStatus(totals.syncStatus)
    : "Modo institucional";
  elements.transparencySyncCopy.textContent = !state.activeCampaign
    ? "Cuando inicie la siguiente campaña, aquí aparecerán el seguimiento digital y las evidencias públicas."
    : totals.syncStatus === "error"
      ? totals.syncError || "El seguimiento digital necesita revisión."
      : state.activeCampaign.teletonUrl
        ? "El seguimiento digital se vincula con la página oficial de Teletón."
        : "Esta campaña todavía no tiene un enlace digital público configurado.";
  elements.transparencyTotalAmount.textContent = formatCurrency(totals.totalAmount);
  elements.transparencyDigitalAmount.textContent = formatCurrency(totals.syncedDigitalAmount);
  elements.transparencyLastSync.textContent = totals.lastSuccessfulSyncAt
    ? formatDate(totals.lastSuccessfulSyncAt, SHORT_DATE_TIME_FORMATTER)
    : "Pendiente";
  elements.transparencyEvidenceCount.textContent = `${evidence.length} registro${
    evidence.length === 1 ? "" : "s"
  }`;
  elements.activeCampaignTransparencyCount.textContent = `${evidence.length} evidencia${
    evidence.length === 1 ? "" : "s"
  }`;

  elements.transparencyEvidenceList.innerHTML = "";
  elements.transparencyEvidenceEmpty.hidden = evidence.length > 0;

  evidence.forEach((item) => {
    const article = document.createElement("article");
    article.className = "rounded-[1.5rem] bg-surface-container-low p-5";
    article.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
            humanizeEvidenceKind(item.kind)
          )}</p>
          <h4 class="mt-2 text-xl font-black text-on-surface">${escapeHtml(item.title)}</h4>
          <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">${escapeHtml(
            item.description || "Sin descripción adicional."
          )}</p>
        </div>
        <div class="min-w-[180px] text-left sm:text-right">
          <p class="text-sm font-bold text-primary">${
            item.amount != null ? formatCurrency(item.amount) : "Sin monto asociado"
          }</p>
          <p class="mt-1 text-xs uppercase tracking-[0.25em] text-on-surface-variant">${escapeHtml(
            formatDate(item.recordedAt)
          )}</p>
        </div>
      </div>
      ${buildEvidenceImageMarkup(
        item,
        "h-56 w-full bg-surface object-cover object-center"
      )}
      <a class="mt-4 inline-flex items-center gap-2 font-bold text-primary hover:underline" href="${escapeHtml(
        item.publicUrl
      )}" rel="noreferrer" target="_blank">
        ${escapeHtml(buildEvidenceLinkLabel(item))} <span class="material-symbols-outlined text-base">open_in_new</span>
      </a>
    `;
    elements.transparencyEvidenceList.append(article);
  });
}

function renderHistory() {
  const closedCampaigns = sortCampaigns(
    state.allCampaigns.filter((campaign) => campaign.status === "closed")
  );
  elements.historyCount.textContent = String(closedCampaigns.length);
  elements.historyCampaignsList.innerHTML = "";
  elements.historyEmpty.hidden = closedCampaigns.length > 0;

  closedCampaigns.forEach((campaign) => {
    const article = document.createElement("article");
    article.className = "rounded-[2rem] bg-white p-8 shadow-lg shadow-primary/10";
    article.innerHTML = `
      <p class="text-xs font-bold uppercase tracking-[0.25em] text-secondary">${escapeHtml(
        campaign.semesterLabel || "Sin semestre"
      )}</p>
      <h3 class="mt-3 font-headline text-3xl font-black tracking-tight text-on-surface">${escapeHtml(
        campaign.name
      )}</h3>
      <p class="mt-3 text-sm text-on-surface-variant">${escapeHtml(
        formatDateRange(campaign.startAt, campaign.endAt)
      )}</p>
      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="rounded-[1.5rem] bg-surface-container-low p-5">
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Total final</p>
          <p class="mt-2 text-2xl font-black text-primary">${formatCurrency(
            campaign.summary?.totalAmount
          )}</p>
        </div>
        <div class="rounded-[1.5rem] bg-surface-container-low p-5">
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Meta</p>
          <p class="mt-2 text-2xl font-black text-on-surface">${formatCurrency(campaign.goalAmount)}</p>
        </div>
      </div>
      <div class="mt-5 flex flex-wrap gap-2">
        <span class="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant">Físico ${formatCurrency(
          campaign.summary?.physicalAmount
        )}</span>
        <span class="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant">Digital ${formatCurrency(
          campaign.summary?.digitalAmount
        )}</span>
        <span class="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant">Reciclaje ${formatCurrency(
          campaign.summary?.recyclingAmount
        )}</span>
      </div>
    `;
    elements.historyCampaignsList.append(article);
  });
}

function renderDonationNotice() {
  if (isTournamentCampaign(state.activeCampaign)) {
    const campaign = state.activeCampaign;
    const costBreakdown = getTournamentCostBreakdown(campaign);
    const companies = campaign?.companies || [];

    elements.donationNoticeCopy.textContent =
      "MundialHITO 2026 está en planeación. El donativo por equipo será acompañado por HITO y la cuota de arbitraje será cobrada por la organización por separado.";
    elements.donationNoticePiggyBanks.innerHTML = [
      `${formatCurrency(costBreakdown.donationAmount)} de donativo en beneficio del HITO.`,
      `${formatCurrency(costBreakdown.refereeFee)} de arbitraje operativo registrado por separado.`,
      companies.length > 0
        ? `${companies.length} empresas en la lista inicial de invitación o seguimiento.`
        : "Aún no hay empresas publicadas.",
    ]
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    setLinkState(elements.donationNoticeTeletonLink, "", "");
    return;
  }

  const piggyBanks = getPublicPiggyBanks();
  if (!state.activeCampaign) {
    elements.donationNoticeCopy.textContent =
      "No hay una campaña abierta en este momento. La plataforma sigue mostrando historial, transparencia y preparación para futuras ediciones.";
    elements.donationNoticePiggyBanks.innerHTML = "<li>Sin alcancías activas publicadas.</li>";
    setLinkState(elements.donationNoticeTeletonLink, "", "");
    return;
  }

  elements.donationNoticeCopy.textContent =
    "Puedes apoyar con donativos, reciclaje o mediante las alcancías activas de esta campaña.";
  elements.donationNoticePiggyBanks.innerHTML =
    piggyBanks.length > 0
      ? piggyBanks
          .map(
            (item) =>
              `<li>${escapeHtml(item.name)}${item.location ? `, ${escapeHtml(item.location)}` : ""}.</li>`
          )
          .join("")
      : "<li>Sin alcancías activas visibles por el momento.</li>";
  setLinkState(elements.donationNoticeTeletonLink, state.activeCampaign.teletonUrl, "Donar en Teletón");
}

function isAdminReady() {
  return Boolean(state.user && state.userRole?.enabled === true && state.userRole?.role === "admin");
}

function renderAdminTabs() {
  if (!isAdminReady()) {
    elements.adminTabPanels.forEach((panel) => {
      panel.hidden = true;
    });
    return;
  }

  elements.adminTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === state.adminTab;
    button.className = isActive
      ? "rounded-xl bg-primary px-3.5 py-2.5 text-left text-[0.92rem] font-bold text-white"
      : "rounded-xl px-3.5 py-2.5 text-left text-[0.92rem] font-bold text-on-surface transition-colors hover:bg-white";
  });

  elements.adminTabPanels.forEach((panel) => {
    panel.hidden = panel.id !== `admin-tab-${state.adminTab}`;
  });
}

function renderAdminSummary() {
  const campaign = state.activeCampaign;
  elements.adminSummaryCampaign.textContent = campaign ? campaign.name : "Sin campaña activa";
  elements.adminSummaryStatus.textContent = campaign
    ? `${humanizeCampaignStatus(campaign.status)} · ${formatDateRange(campaign.startAt, campaign.endAt)}`
    : "Activa una campaña para habilitar las operaciones diarias.";
  elements.adminSummaryTotals.innerHTML = `
    <p>Total: ${formatCurrency(state.activeTotals.totalAmount)}</p>
    <p>Físico: ${formatCurrency(state.activeTotals.physicalAmount)}</p>
    <p>Digital: ${formatCurrency(state.activeTotals.digitalAmount)}</p>
    <p>Reciclaje: ${formatCurrency(state.activeTotals.recyclingAmount)}</p>
  `;
  elements.adminSummarySync.textContent = `${humanizeSyncStatus(state.activeTotals.syncStatus)}${
    state.activeTotals.lastSuccessfulSyncAt
      ? ` · ${formatDate(state.activeTotals.lastSuccessfulSyncAt, SHORT_DATE_TIME_FORMATTER)}`
      : ""
  }`;
}

function renderAdminDonationOptions() {
  const currentValue = elements.adminDonationPiggyBank.value;
  const options = ['<option value="">Sin alcancía específica</option>'];
  state.activePiggyBanks.forEach((piggyBank) => {
    options.push(
      `<option value="${escapeHtml(piggyBank.id)}">${escapeHtml(piggyBank.name)} (${escapeHtml(
        piggyBank.status
      )})</option>`
    );
  });
  elements.adminDonationPiggyBank.innerHTML = options.join("");
  if ([...elements.adminDonationPiggyBank.options].some((item) => item.value === currentValue)) {
    elements.adminDonationPiggyBank.value = currentValue;
  }
}

function renderAdminPiggyBanks() {
  const piggyBanks = [...state.activePiggyBanks].sort((left, right) =>
    left.name.localeCompare(right.name, "es-MX")
  );
  elements.adminPiggyBankCount.textContent = `${piggyBanks.length} registro${
    piggyBanks.length === 1 ? "" : "s"
  }`;
  elements.adminPiggyBanksList.innerHTML = piggyBanks.length
    ? piggyBanks
        .map(
          (piggyBank) => `
          <article class="admin-card rounded-[1.5rem] bg-white shadow-sm" data-piggy-bank-id="${escapeHtml(
            piggyBank.id
          )}">
            <div class="grid gap-3 md:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-[0.74rem] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Nombre</span>
                <input class="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3" data-field="name" type="text" value="${escapeHtml(
                  piggyBank.name
                )}" />
              </label>
              <label class="block">
                <span class="mb-2 block text-[0.74rem] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Estado</span>
                <select class="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3" data-field="status">
                  <option value="active" ${piggyBank.status === "active" ? "selected" : ""}>Activa</option>
                  <option value="inactive" ${piggyBank.status === "inactive" ? "selected" : ""}>Inactiva</option>
                  <option value="retired" ${piggyBank.status === "retired" ? "selected" : ""}>Retirada</option>
                </select>
              </label>
              <label class="block md:col-span-2">
                <span class="mb-2 block text-[0.74rem] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Ubicacion</span>
                <input class="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3" data-field="location" type="text" value="${escapeHtml(
                  piggyBank.location || ""
                )}" />
              </label>
              <label class="block md:col-span-2">
                <span class="mb-2 block text-[0.74rem] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Acepta</span>
                <input class="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3" data-field="accepts" type="text" value="${escapeHtml(
                  (piggyBank.accepts || []).join(", ")
                )}" />
              </label>
              <label class="block md:col-span-2">
                <span class="mb-2 block text-[0.74rem] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Notas</span>
                <textarea class="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3" data-field="notes" rows="3">${escapeHtml(
                  piggyBank.notes || ""
                )}</textarea>
              </label>
            </div>
            <div class="mt-3 flex flex-wrap gap-2.5">
              <button class="rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white" data-action="save-piggy-bank" type="button">Guardar cambios</button>
              <button class="rounded-full border border-outline-variant/50 bg-white px-4 py-2.5 text-sm font-bold text-on-surface" data-action="retire-piggy-bank" type="button">Marcar retirada</button>
            </div>
          </article>
        `
        )
        .join("")
    : '<div class="rounded-[1.5rem] border border-dashed border-outline-variant bg-white px-4 py-6 text-center text-sm text-on-surface-variant">Sin alcancías registradas para esta campaña.</div>';
}

function renderAdminCampaignPicker() {
  const campaigns = sortCampaigns(state.allCampaigns);
  elements.adminCampaignPickerCount.textContent = `${campaigns.length} registrada${
    campaigns.length === 1 ? "" : "s"
  }`;
  elements.adminCampaignPicker.innerHTML = campaigns.length
    ? campaigns
        .map((campaign) => {
          const isActive = campaign.id === state.activeCampaignId;
          const canActivate = campaign.status !== "closed" && !isActive;
          return `
            <article class="admin-card rounded-[1.5rem] bg-white shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-secondary">${escapeHtml(
                    campaign.semesterLabel || "Sin semestre"
                  )}</p>
                  <h4 class="mt-1.5 text-lg font-black text-on-surface">${escapeHtml(campaign.name)}</h4>
                  <p class="mt-2 text-sm text-on-surface-variant">${escapeHtml(
                    formatDateRange(campaign.startAt, campaign.endAt)
                  )}</p>
                </div>
                <span class="rounded-full bg-surface-container-low px-3 py-1.5 text-[0.72rem] font-bold text-on-surface-variant">${escapeHtml(
                  humanizeCampaignStatus(campaign.status)
                )}</span>
              </div>
              <div class="mt-3 flex flex-wrap gap-2.5">
                <button class="rounded-full ${
                  canActivate
                    ? "bg-primary text-white"
                    : "border border-outline-variant/50 bg-white text-on-surface"
                } px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50" data-action="activate-campaign" data-campaign-id="${escapeHtml(
            campaign.id
          )}" type="button" ${canActivate ? "" : "disabled"}>
                  ${isActive ? "Campaña activa" : campaign.status === "closed" ? "Campaña cerrada" : "Activar"}
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    : '<div class="rounded-[1.5rem] border border-dashed border-outline-variant bg-white px-4 py-6 text-center text-sm text-on-surface-variant">Aún no existen campañas en el sistema.</div>';
}

function renderAdminEvidence() {
  const evidence = [...state.activeEvidence].sort((left, right) => {
    const leftDate = timestampToDate(left.recordedAt)?.getTime() || 0;
    const rightDate = timestampToDate(right.recordedAt)?.getTime() || 0;
    return rightDate - leftDate;
  });

  elements.adminEvidenceList.innerHTML = evidence.length
    ? evidence
        .map(
          (item) => `
            <article class="admin-card rounded-[1.5rem] bg-white shadow-sm" data-evidence-id="${escapeHtml(item.id)}">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-secondary">${escapeHtml(
                    humanizeEvidenceKind(item.kind)
                  )}</p>
                  <h4 class="mt-1.5 text-lg font-black text-on-surface">${escapeHtml(item.title)}</h4>
                  <p class="mt-2 text-sm text-on-surface-variant">${escapeHtml(
                    item.description || "Sin descripción adicional."
                  )}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-bold text-primary">${
                    item.amount != null ? formatCurrency(item.amount) : "Sin monto"
                  }</p>
                  <p class="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-on-surface-variant">${escapeHtml(
                    formatDate(item.recordedAt)
                  )}</p>
                </div>
              </div>
              ${buildEvidenceImageMarkup(
                item,
                "h-44 w-full bg-surface object-cover object-center"
              )}
              <div class="mt-3 flex flex-wrap gap-2.5">
                <a class="rounded-full border border-outline-variant/50 bg-white px-4 py-2.5 text-sm font-bold text-on-surface" href="${escapeHtml(
                  item.publicUrl
                )}" rel="noreferrer" target="_blank">${escapeHtml(buildEvidenceLinkLabel(item))}</a>
                <button class="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white" data-action="delete-evidence" type="button">Eliminar</button>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="rounded-[1.5rem] border border-dashed border-outline-variant bg-white px-4 py-6 text-center text-sm text-on-surface-variant">Sin evidencias registradas para la campaña activa.</div>';
}

function renderAdminCampaignForm() {
  const campaign = state.activeCampaign;
  const isEditable = Boolean(campaign && isAdminReady());

  setInputValueIfIdle(elements.activeCampaignFieldName, campaign?.name || "");
  setInputValueIfIdle(elements.activeCampaignFieldSemester, campaign?.semesterLabel || "");
  setInputValueIfIdle(elements.activeCampaignFieldGoal, campaign ? String(campaign.goalAmount || "") : "");
  setInputValueIfIdle(elements.activeCampaignFieldStart, dateToLocalInputValue(campaign?.startAt));
  setInputValueIfIdle(elements.activeCampaignFieldEnd, dateToLocalInputValue(campaign?.endAt));
  setInputValueIfIdle(elements.activeCampaignFieldTeletonUrl, campaign?.teletonUrl || "");

  [
    elements.activeCampaignFieldName,
    elements.activeCampaignFieldSemester,
    elements.activeCampaignFieldGoal,
    elements.activeCampaignFieldStart,
    elements.activeCampaignFieldEnd,
    elements.activeCampaignFieldTeletonUrl,
  ].forEach((input) => {
    input.disabled = !isEditable;
  });

  elements.adminCloseCampaignButton.disabled = !isEditable;
  elements.adminSyncTeletonButton.disabled = !isEditable;
  elements.adminRecalculateButton.disabled = !isEditable;
  elements.adminDonationSubmit.disabled = !isEditable;
  elements.activeCampaignSubmit.disabled = !isEditable;
  elements.piggyBankSubmit.disabled = !isEditable;
  elements.evidenceSubmit.disabled = !isEditable;
  elements.evidenceFile.disabled = !isEditable;
  elements.newCampaignSubmit.disabled = !isAdminReady();
}

function renderAdminAuth() {
  const isLoggedIn = Boolean(state.user);
  const isAdmin = isAdminReady();
  const sessionLabel = isLoggedIn
    ? `Sesión: ${state.user.email || state.user.uid}`
    : "Sin sesión iniciada.";
  const roleLabel = !isLoggedIn
    ? "Inicia sesión con un usuario autenticado y habilitado como admin."
    : isAdmin
      ? "Rol validado como admin en user_roles/{uid}."
      : "Usuario autenticado sin rol admin habilitado.";

  elements.adminLayout.style.gridTemplateColumns = "1fr";
  elements.adminLayout.style.gap = "0.875rem";
  elements.adminLayout.style.maxWidth = isAdmin ? "" : "560px";
  elements.adminLayout.style.margin = isAdmin ? "" : "0 auto";

  elements.adminAuthCard.style.display = isAdmin ? "none" : "";
  elements.adminFallbackCard.style.display = "none";
  elements.adminTabNav.style.display = isAdmin ? "" : "none";
  elements.adminMain.style.display = isAdmin ? "" : "none";
  elements.adminWorkspace.hidden = !isAdmin;
  elements.adminSessionBar.hidden = !isAdmin;
  elements.adminAccessWarning.classList.toggle("hidden", !isLoggedIn || isAdmin);

  elements.adminLoginButton.classList.toggle("hidden", isLoggedIn);
  elements.adminLogoutButton.classList.toggle("hidden", !isLoggedIn);
  elements.adminSessionCopy.textContent = sessionLabel;
  elements.adminRoleCopy.textContent = roleLabel;
  elements.adminActiveSessionCopy.textContent = sessionLabel;
  elements.adminActiveRoleCopy.textContent = roleLabel;
}

function renderAdminWorkspace() {
  renderAdminAuth();
  if (!isAdminReady()) {
    return;
  }

  renderAdminTabs();
  renderAdminSummary();
  renderAdminDonationOptions();
  renderAdminPiggyBanks();
  renderAdminCampaignPicker();
  renderAdminEvidence();
  renderAdminCampaignForm();
  elements.adminCloseCopy.textContent = state.activeCampaign
    ? `Cerrar ${state.activeCampaign.name} congelará su resumen y liberará la home para el estado institucional.`
    : "No hay campaña activa para cerrar.";
}

function renderRouteChrome() {
  renderRouteViews();
  updateSeoForRoute();

  const routeHash = String(globalThis.location.hash || "").replace(/^#/, "");
  const definitions = getCurrentSectionDefinitions();
  if (definitions.some((item) => item.id === routeHash)) {
    state.activeSectionId = routeHash;
  } else if (!definitions.some((item) => item.id === state.activeSectionId)) {
    state.activeSectionId = definitions[0]?.id || "contact";
  }

  updateCurrentSectionLink();
  renderSiteMenu();
  observeCurrentSections();
}

function renderAll() {
  renderHero();
  renderActiveCampaignSection();
  renderCounter();
  renderPiggyBanks();
  renderLeaderboard();
  renderTransparency();
  renderHistory();
  renderDonationNotice();
  renderRouteChrome();
  renderAdminWorkspace();
}

function closeDonationNoticeModal() {
  elements.donationNoticeModal.classList.add("pointer-events-none", "opacity-0");
  elements.donationNoticeModal.hidden = true;
  elements.donationNoticeModal.setAttribute("aria-hidden", "true");
}

function openDonationNoticeModal() {
  renderDonationNotice();
  elements.donationNoticeModal.hidden = false;
  elements.donationNoticeModal.classList.remove("pointer-events-none", "opacity-0");
  elements.donationNoticeModal.setAttribute("aria-hidden", "false");
  elements.donationNoticeClose.focus();
}

function closeAdminModal() {
  elements.adminModal.classList.add("pointer-events-none", "opacity-0");
  elements.adminModal.hidden = true;
  elements.adminModal.setAttribute("aria-hidden", "true");
}

function openAdminModal() {
  renderAdminWorkspace();
  elements.adminModal.hidden = false;
  elements.adminModal.classList.remove("pointer-events-none", "opacity-0");
  elements.adminModal.setAttribute("aria-hidden", "false");
  if (isAdminReady()) {
    elements.adminPanel.focus();
  } else {
    elements.adminEmail.focus();
  }
}

function clearActiveCampaignSubscriptions() {
  state.activeCampaignUnsubscribers.forEach((unsubscribe) => unsubscribe());
  state.activeCampaignUnsubscribers = [];
}

function subscribeToActiveCampaignData() {
  clearActiveCampaignSubscriptions();
  state.activeTotals = { ...EMPTY_TOTALS };
  state.activePiggyBanks = [];
  state.topDonors = [];
  state.anonymousSummary = {
    totalAmount: 0,
    donationCount: 0,
  };
  state.activeEvidence = [];

  if (!state.activeCampaignId || !db) {
    renderAll();
    return;
  }

  renderAll();

  state.activeCampaignUnsubscribers.push(
    onSnapshot(
      doc(db, `campaigns/${state.activeCampaignId}/totals/global`),
      (snapshot) => {
        state.activeTotals = normalizeTotals(snapshot.exists() ? snapshot.data() : EMPTY_TOTALS);
        renderAll();
      },
      (error) => {
        console.error("Active campaign totals listener failed.", error);
        showStatus("No fue posible escuchar los totales de la campaña activa.", "error");
      }
    )
  );

  state.activeCampaignUnsubscribers.push(
    onSnapshot(
      collection(db, `campaigns/${state.activeCampaignId}/piggy_banks`),
      (snapshot) => {
        state.activePiggyBanks = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: repairVisibleText(String(data.name || "").trim()),
            location: repairVisibleText(String(data.location || "").trim()),
            status: String(data.status || "inactive"),
            accepts: Array.isArray(data.accepts)
              ? data.accepts.map((value) => repairVisibleText(String(value || "").trim())).filter(Boolean)
              : [],
            notes: repairVisibleText(String(data.notes || "").trim()),
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
          };
        });
        renderAll();
      },
      (error) => {
        console.error("Piggy banks listener failed.", error);
        showStatus("No fue posible escuchar las alcancías activas.", "error");
      }
    )
  );

  state.activeCampaignUnsubscribers.push(
    onSnapshot(
      collection(db, `campaigns/${state.activeCampaignId}/donor_totals`),
      (snapshot) => {
        const donors = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            displayName:
              repairVisibleText(String(data.displayName || "Anonimo").trim()) || "Anonimo",
            totalAmount: roundCurrency(data.totalAmount),
            donationCount: Number(data.donationCount) || 0,
          };
        });

        const anonymous = donors.find((item) => normalizeDonorId(item.displayName) === "anonimo");
        state.anonymousSummary = anonymous
          ? {
              totalAmount: anonymous.totalAmount,
              donationCount: anonymous.donationCount,
            }
          : {
              totalAmount: 0,
              donationCount: 0,
            };
        state.topDonors = donors
          .filter((item) => normalizeDonorId(item.displayName) !== "anonimo")
          .sort((left, right) => {
            if (right.totalAmount !== left.totalAmount) {
              return right.totalAmount - left.totalAmount;
            }

            return left.displayName.localeCompare(right.displayName, "es-MX");
          })
          .slice(0, 10);
        renderAll();
      },
      (error) => {
        console.error("Donor totals listener failed.", error);
        showStatus("No fue posible actualizar el ranking público.", "error");
      }
    )
  );

  state.activeCampaignUnsubscribers.push(
    onSnapshot(
      collection(db, `campaigns/${state.activeCampaignId}/evidence`),
      (snapshot) => {
        state.activeEvidence = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            title: repairVisibleText(String(data.title || "").trim()),
            kind: String(data.kind || "other"),
            publicUrl: String(data.publicUrl || "").trim(),
            assetType: String(data.assetType || "").trim(),
            fileName: String(data.fileName || "").trim(),
            mimeType: String(data.mimeType || "").trim(),
            storagePath: String(data.storagePath || "").trim(),
            description: repairVisibleText(String(data.description || "").trim()),
            amount: data.amount == null ? null : roundCurrency(data.amount),
            recordedAt: data.recordedAt || null,
            createdAt: data.createdAt || null,
          };
        });
        renderAll();
      },
      (error) => {
        console.error("Evidence listener failed.", error);
        showStatus("No fue posible escuchar las evidencias públicas.", "error");
      }
    )
  );
}

function normalizeCampaignDocument(documentSnapshot) {
  const data = documentSnapshot.data();
  const profile =
    data.campaignProfile && typeof data.campaignProfile === "object" ? data.campaignProfile : {};

  return {
    id: documentSnapshot.id,
    name: repairVisibleText(String(data.name || "").trim()),
    semesterLabel: repairVisibleText(String(data.semesterLabel || "").trim()),
    status: String(data.status || "draft"),
    campaignType: String(data.campaignType || profile.campaignType || "").trim(),
    subtitle: repairVisibleText(String(data.subtitle || profile.subtitle || "").trim()),
    beneficiary: repairVisibleText(String(data.beneficiary || profile.beneficiary || "").trim()),
    publicStateLabel: repairVisibleText(
      String(data.publicStateLabel || profile.publicStateLabel || "").trim()
    ),
    publicPrimaryText: repairVisibleText(
      String(data.publicPrimaryText || profile.publicPrimaryText || "").trim()
    ),
    proposedVenue: repairVisibleText(String(data.proposedVenue || profile.proposedVenue || "").trim()),
    modality: repairVisibleText(String(data.modality || profile.modality || "").trim()),
    category: repairVisibleText(String(data.category || profile.category || "").trim()),
    competitionFormat: repairVisibleText(String(
      data.competitionFormat || data.format || profile.competitionFormat || profile.format || ""
    ).trim()),
    maxTeams: Number(data.maxTeams ?? profile.maxTeams) || 0,
    durationLabel: repairVisibleText(String(data.durationLabel || profile.durationLabel || "").trim()),
    dateLabel: repairVisibleText(String(data.dateLabel || profile.dateLabel || "").trim()),
    teamCostTotal: roundCurrency(data.teamCostTotal ?? profile.teamCostTotal),
    donationAmount: roundCurrency(data.donationAmount ?? profile.donationAmount),
    refereeFee: roundCurrency(data.refereeFee ?? profile.refereeFee),
    companies: normalizeCompanies(data.companies ?? profile.companies),
    transparencyNotes: normalizeStringArray(data.transparencyNotes ?? profile.transparencyNotes),
    rules: normalizeStringArray(data.rules ?? profile.rules),
    goalAmount: roundCurrency(data.goalAmount),
    startAt: data.startAt || null,
    endAt: data.endAt || null,
    closedAt: data.closedAt || null,
    teletonUrl: String(data.teletonUrl || "").trim(),
    summary: {
      totalAmount: roundCurrency(data.summary?.totalAmount),
      physicalAmount: roundCurrency(data.summary?.physicalAmount),
      digitalAmount: roundCurrency(data.summary?.digitalAmount),
      recyclingAmount: roundCurrency(data.summary?.recyclingAmount),
      donationCount: Number(data.summary?.donationCount) || 0,
    },
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function subscribeToRoleDocument(user) {
  if (state.userRoleUnsubscribe) {
    state.userRoleUnsubscribe();
    state.userRoleUnsubscribe = null;
  }

  if (!user || !db) {
    state.userRole = null;
    renderAll();
    return;
  }

  state.userRoleUnsubscribe = onSnapshot(
    doc(db, `user_roles/${user.uid}`),
    (snapshot) => {
      state.userRole = snapshot.exists() ? snapshot.data() : null;
      renderAll();
    },
    (error) => {
      console.error("User role listener failed.", error);
      state.userRole = null;
      renderAll();
    }
  );
}

function subscribeToBaseData() {
  state.baseUnsubscribers.push(
    onSnapshot(
      doc(db, "settings/activeCampaign"),
      (snapshot) => {
        const nextCampaignId = snapshot.exists() ? String(snapshot.get("campaignId") || "") : "";
        if (nextCampaignId !== state.activeCampaignId) {
          state.activeCampaignId = nextCampaignId;
          subscribeToActiveCampaignData();
        } else {
          state.activeCampaignId = nextCampaignId;
        }

        state.activeCampaign = state.allCampaigns.find((item) => item.id === state.activeCampaignId) || null;
        renderAll();
      },
      (error) => {
        console.error("Active campaign settings listener failed.", error);
        showStatus("No fue posible cargar la campaña activa.", "error");
      }
    )
  );

  state.baseUnsubscribers.push(
    onSnapshot(
      collection(db, "campaigns"),
      (snapshot) => {
        state.allCampaigns = snapshot.docs.map(normalizeCampaignDocument);
        state.activeCampaign =
          state.allCampaigns.find((item) => item.id === state.activeCampaignId) || null;
        renderAll();
      },
      (error) => {
        console.error("Campaigns collection listener failed.", error);
        showStatus("No fue posible cargar el historial de campañas.", "error");
      }
    )
  );

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    subscribeToRoleDocument(user);
    renderAll();
  });
}

function ensureFirebaseReady() {
  if (!isFirebaseConfigured || !db || !auth) {
    throw new Error("Configura Firebase Auth y Firestore antes de usar la plataforma.");
  }
}

function ensureAdminSession() {
  ensureFirebaseReady();
  if (!state.user) {
    throw new Error("Inicia sesión con Firebase Auth para usar el panel admin.");
  }

  if (!isAdminReady()) {
    throw new Error("Este usuario no tiene rol admin habilitado.");
  }
}

function normalizeAcceptsField(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

async function recalculateCampaignAggregatesClient(campaignId) {
  const campaignRef = doc(db, `campaigns/${campaignId}`);
  const totalsRef = doc(db, `campaigns/${campaignId}/totals/global`);
  const donorTotalsRef = collection(db, `campaigns/${campaignId}/donor_totals`);
  const donationsRef = collection(db, `campaigns/${campaignId}/donations`);

  const [campaignSnapshot, totalsSnapshot, donorTotalsSnapshot, donationsSnapshot] =
    await Promise.all([
      getDoc(campaignRef),
      getDoc(totalsRef),
      getDocs(donorTotalsRef),
      getDocs(donationsRef),
    ]);

  if (!campaignSnapshot.exists()) {
    throw new Error("La campaña seleccionada ya no existe.");
  }

  const currentTotals = totalsSnapshot.exists()
    ? computeTotalsSnapshot(totalsSnapshot.data())
    : createEmptyTotalsDocument(String(campaignSnapshot.get("teletonUrl") || "").trim());

  const nextBaseTotals = {
    physicalAmount: 0,
    recyclingAmount: 0,
    manualDigitalAmount: 0,
    syncedDigitalAmount: roundCurrency(currentTotals.syncedDigitalAmount),
    donationCount: 0,
    syncStatus: currentTotals.syncStatus,
    syncError: currentTotals.syncError,
    syncSource: currentTotals.syncSource,
    teletonUrl: String(campaignSnapshot.get("teletonUrl") || currentTotals.teletonUrl || "").trim(),
    lastSuccessfulSyncAt: currentTotals.lastSuccessfulSyncAt,
  };

  const donationDocuments = donationsSnapshot.docs.map((documentSnapshot) => {
    const data = documentSnapshot.data();
    const sourceType = normalizeDonationSourceType(data.sourceType);
    const amount = roundCurrency(data.amount);

    if (sourceType === "digital") {
      nextBaseTotals.manualDigitalAmount = roundCurrency(
        nextBaseTotals.manualDigitalAmount + amount
      );
    } else if (sourceType === "recycling") {
      nextBaseTotals.recyclingAmount = roundCurrency(nextBaseTotals.recyclingAmount + amount);
    } else {
      nextBaseTotals.physicalAmount = roundCurrency(nextBaseTotals.physicalAmount + amount);
    }

    nextBaseTotals.donationCount += 1;

    return {
      donorId: String(data.donorId || "").trim(),
      name: data.name,
      amount,
      createdAt: data.createdAt || new Date(),
    };
  });

  const donorMap = buildDonorTotalsFromDonations(donationDocuments);
  const computedTotals = computeTotalsSnapshot(nextBaseTotals);
  const batch = writeBatch(db);

  donorTotalsSnapshot.forEach((documentSnapshot) => {
    batch.delete(documentSnapshot.ref);
  });

  donorMap.forEach((donorData, donorId) => {
    batch.set(doc(db, `campaigns/${campaignId}/donor_totals/${donorId}`), {
      displayName: donorData.displayName,
      totalAmount: donorData.totalAmount,
      donationCount: donorData.donationCount,
      lastDonationAt: donorData.lastDonationAt,
    });
  });

  batch.set(
    totalsRef,
    buildTotalsWritePayload(computedTotals, {
      syncStatus: currentTotals.syncStatus,
      syncError: currentTotals.syncError,
      syncSource: currentTotals.syncSource,
      teletonUrl: nextBaseTotals.teletonUrl,
      lastSuccessfulSyncAt: currentTotals.lastSuccessfulSyncAt,
    }),
    { merge: true }
  );
  batch.set(
    campaignRef,
    {
      summary: buildSummaryFromTotals(computedTotals),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
  return computedTotals;
}

async function activateCampaignClient(campaignId) {
  const settingsRef = doc(db, "settings/activeCampaign");
  const targetCampaignRef = doc(db, `campaigns/${campaignId}`);

  await runTransaction(db, async (transaction) => {
    const [settingsSnapshot, targetCampaignSnapshot] = await Promise.all([
      transaction.get(settingsRef),
      transaction.get(targetCampaignRef),
    ]);

    if (!targetCampaignSnapshot.exists()) {
      throw new Error("La campaña seleccionada no existe.");
    }

    if (String(targetCampaignSnapshot.get("status") || "") === "closed") {
      throw new Error("Las campañas cerradas no se pueden reactivar.");
    }

    const previousActiveCampaignId = settingsSnapshot.exists()
      ? String(settingsSnapshot.get("campaignId") || "").trim()
      : "";

    if (previousActiveCampaignId && previousActiveCampaignId !== campaignId) {
      const previousCampaignRef = doc(db, `campaigns/${previousActiveCampaignId}`);
      const previousCampaignSnapshot = await transaction.get(previousCampaignRef);
      if (
        previousCampaignSnapshot.exists() &&
        String(previousCampaignSnapshot.get("status") || "") !== "closed"
      ) {
        transaction.set(
          previousCampaignRef,
          {
            status: "draft",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    transaction.set(
      targetCampaignRef,
      {
        status: "active",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    transaction.set(
      settingsRef,
      {
        campaignId,
        updatedAt: serverTimestamp(),
        updatedByUid: state.user.uid,
        updatedByEmail: state.user.email || "",
      },
      { merge: true }
    );
  });
}

async function createCampaignClient(payload) {
  const campaignRef = doc(collection(db, "campaigns"));
  const emptyTotals = createEmptyTotalsDocument(payload.teletonUrl);
  const batch = writeBatch(db);

  batch.set(campaignRef, {
    name: payload.name,
    semesterLabel: payload.semesterLabel,
    status: "draft",
    goalAmount: payload.goalAmount,
    startAt: payload.startAt,
    endAt: payload.endAt,
    closedAt: null,
    teletonUrl: payload.teletonUrl,
    summary: buildSummaryFromTotals(emptyTotals),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: state.user.uid,
    createdByEmail: state.user.email || "",
  });
  batch.set(
    doc(db, `campaigns/${campaignRef.id}/totals/global`),
    buildTotalsWritePayload(emptyTotals, {
      syncStatus: "idle",
      syncError: "",
      syncSource: "",
      teletonUrl: payload.teletonUrl,
      lastSuccessfulSyncAt: null,
    }),
    { merge: true }
  );

  await batch.commit();
  return campaignRef.id;
}

async function closeCampaignClient(campaignId) {
  const computedTotals = await recalculateCampaignAggregatesClient(campaignId);
  const batch = writeBatch(db);

  batch.set(
    doc(db, `campaigns/${campaignId}`),
    {
      status: "closed",
      closedAt: serverTimestamp(),
      summary: buildSummaryFromTotals(computedTotals),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (state.activeCampaignId === campaignId) {
    batch.set(
      doc(db, "settings/activeCampaign"),
      {
        campaignId: null,
        updatedAt: serverTimestamp(),
        updatedByUid: state.user.uid,
        updatedByEmail: state.user.email || "",
      },
      { merge: true }
    );
  }

  await batch.commit();
  return computedTotals;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  setMessage(elements.adminAuthMessage, "");

  try {
    ensureFirebaseReady();
    elements.adminLoginButton.disabled = true;
    elements.adminLoginButton.textContent = "Entrando...";
    await signInWithEmailAndPassword(
      auth,
      String(elements.adminEmail.value || "").trim(),
      String(elements.adminPassword.value || "")
    );
    setMessage(elements.adminAuthMessage, "Sesion iniciada correctamente.", "success");
    elements.adminPassword.value = "";
  } catch (error) {
    console.error("Admin sign-in failed.", error);
    setMessage(
      elements.adminAuthMessage,
      error.message || "No fue posible iniciar sesión.",
      "error"
    );
  } finally {
    elements.adminLoginButton.disabled = false;
    elements.adminLoginButton.textContent = "Iniciar sesión";
  }
}

async function handleLogout() {
  try {
    ensureFirebaseReady();
    await signOut(auth);
    setMessage(elements.adminAuthMessage, "Sesion cerrada.", "info");
  } catch (error) {
    console.error("Admin sign-out failed.", error);
    setMessage(elements.adminAuthMessage, "No fue posible cerrar sesión.", "error");
  }
}

async function handleDonationSubmit(event) {
  event.preventDefault();
  setMessage(elements.adminDonationMessage, "");

  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("Activa una campaña antes de registrar donaciones.");
    }

    const name = String(elements.adminDonationName.value || "").trim().slice(0, 80);
    const amount = roundCurrency(elements.adminDonationAmount.value);
    const sourceType = String(elements.adminDonationSourceType.value || "").trim();
    const piggyBankId = String(elements.adminDonationPiggyBank.value || "").trim();

    if (!name) {
      throw new Error("Ingresa el nombre visible de la donación.");
    }

    if (!["physical", "digital", "recycling"].includes(sourceType)) {
      throw new Error("Selecciona una fuente válida para la donación.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Ingresa un monto válido mayor a 0.");
    }

    elements.adminDonationSubmit.disabled = true;
    elements.adminDonationSubmit.textContent = "Registrando...";
    await addDoc(collection(db, `campaigns/${state.activeCampaignId}/donations`), {
      name,
      donorId: normalizeDonorId(name),
      amount,
      sourceType,
      piggyBankId: piggyBankId || null,
      enteredByUid: state.user.uid,
      enteredByEmail: state.user.email || "",
      createdAt: serverTimestamp(),
    });
    await recalculateCampaignAggregatesClient(state.activeCampaignId);

    elements.adminDonationForm.reset();
    renderAdminDonationOptions();
    setMessage(elements.adminDonationMessage, "Donación registrada con éxito.", "success");
    showStatus("La donación ya fue enviada a la campaña activa.", "success");
  } catch (error) {
    console.error("Unable to add campaign donation.", error);
    setMessage(
      elements.adminDonationMessage,
      error.message || "No fue posible registrar la donación.",
      "error"
    );
  } finally {
    elements.adminDonationSubmit.disabled = false;
    elements.adminDonationSubmit.textContent = "Confirmar donación";
  }
}

async function handlePiggyBankCreate(event) {
  event.preventDefault();
  setMessage(elements.piggyBankMessage, "");

  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("Activa una campaña antes de registrar alcancías.");
    }

    const payload = {
      name: String(elements.piggyBankName.value || "").trim().slice(0, 120),
      location: String(elements.piggyBankLocation.value || "").trim().slice(0, 180),
      status: String(elements.piggyBankStatus.value || "active"),
      accepts: normalizeAcceptsField(elements.piggyBankAccepts.value),
      notes: String(elements.piggyBankNotes.value || "").trim().slice(0, 240),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!payload.name) {
      throw new Error("Ingresa el nombre de la alcancía.");
    }

    await addDoc(collection(db, `campaigns/${state.activeCampaignId}/piggy_banks`), payload);
    elements.piggyBankForm.reset();
    elements.piggyBankStatus.value = "active";
    setMessage(elements.piggyBankMessage, "Alcancía guardada correctamente.", "success");
  } catch (error) {
    console.error("Unable to create piggy bank.", error);
    setMessage(
      elements.piggyBankMessage,
      error.message || "No fue posible guardar la alcancía.",
      "error"
    );
  }
}

async function handlePiggyBankAction(event) {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }

  const card = event.target.closest("[data-piggy-bank-id]");
  if (!card) {
    return;
  }

  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("No hay una campaña activa para editar alcancías.");
    }

    const piggyBankRef = doc(
      db,
      `campaigns/${state.activeCampaignId}/piggy_banks/${card.dataset.piggyBankId}`
    );

    if (action === "retire-piggy-bank") {
      await updateDoc(piggyBankRef, {
        status: "retired",
        updatedAt: serverTimestamp(),
      });
      setMessage(elements.piggyBankMessage, "La alcancía se marcó como retirada.", "success");
      return;
    }

    if (action === "save-piggy-bank") {
      const name = String(card.querySelector('[data-field="name"]').value || "").trim().slice(0, 120);
      const location = String(card.querySelector('[data-field="location"]').value || "")
        .trim()
        .slice(0, 180);
      const status = String(card.querySelector('[data-field="status"]').value || "active").trim();
      const accepts = normalizeAcceptsField(card.querySelector('[data-field="accepts"]').value);
      const notes = String(card.querySelector('[data-field="notes"]').value || "").trim().slice(0, 240);

      if (!name) {
        throw new Error("El nombre de la alcancía no puede quedar vacío.");
      }

      await updateDoc(piggyBankRef, {
        name,
        location,
        status,
        accepts,
        notes,
        updatedAt: serverTimestamp(),
      });
      setMessage(elements.piggyBankMessage, "Cambios de alcancía guardados.", "success");
    }
  } catch (error) {
    console.error("Piggy bank action failed.", error);
    setMessage(
      elements.piggyBankMessage,
      error.message || "No fue posible guardar los cambios de la alcancía.",
      "error"
    );
  }
}

async function handleActiveCampaignSave(event) {
  event.preventDefault();
  setMessage(elements.activeCampaignMessage, "");

  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("No hay una campaña activa para actualizar.");
    }

    const payload = {
      name: String(elements.activeCampaignFieldName.value || "").trim().slice(0, 120),
      semesterLabel: String(elements.activeCampaignFieldSemester.value || "").trim().slice(0, 80),
      goalAmount: roundCurrency(elements.activeCampaignFieldGoal.value),
      startAt: parseDateTimeLocal(elements.activeCampaignFieldStart.value, "inicio"),
      endAt: parseDateTimeLocal(elements.activeCampaignFieldEnd.value, "cierre"),
      teletonUrl: String(elements.activeCampaignFieldTeletonUrl.value || "").trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    };

    if (!payload.name || !payload.semesterLabel) {
      throw new Error("Nombre y semestre son obligatorios.");
    }

    if (!Number.isFinite(payload.goalAmount) || payload.goalAmount <= 0) {
      throw new Error("La meta debe ser un monto mayor a 0.");
    }

    if (payload.endAt.getTime() <= payload.startAt.getTime()) {
      throw new Error("La fecha de cierre debe ser posterior a la de inicio.");
    }

    const batch = writeBatch(db);
    batch.set(doc(db, `campaigns/${state.activeCampaignId}`), payload, { merge: true });
    batch.set(
      doc(db, `campaigns/${state.activeCampaignId}/totals/global`),
      {
        teletonUrl: payload.teletonUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
    setMessage(elements.activeCampaignMessage, "Campaña activa actualizada.", "success");
  } catch (error) {
    console.error("Active campaign update failed.", error);
    setMessage(
      elements.activeCampaignMessage,
      error.message || "No fue posible guardar la campaña activa.",
      "error"
    );
  }
}

async function handleEvidenceCreate(event) {
  event.preventDefault();
  setMessage(elements.evidenceMessage, "");
  let uploadedStoragePath = "";

  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("Activa una campaña antes de registrar evidencias.");
    }

    const title = String(elements.evidenceTitle.value || "").trim().slice(0, 120);
    const kind = String(elements.evidenceKind.value || "other").trim();
    const providedUrl = normalizeEvidenceUrl(elements.evidenceUrl.value || "");
    const evidenceFile = elements.evidenceFile.files?.[0] || null;
    const description = String(elements.evidenceDescription.value || "").trim().slice(0, 240);
    const amountValue = String(elements.evidenceAmount.value || "").trim();
    const recordedAt = parseDateTimeLocal(elements.evidenceRecordedAt.value, "fecha de evidencia");
    const amount = amountValue ? roundCurrency(amountValue) : null;

    if (!title) {
      throw new Error("El título es obligatorio.");
    }

    if (!providedUrl && !evidenceFile) {
      throw new Error("Sube una foto o pega una URL pública para la evidencia.");
    }

    elements.evidenceSubmit.disabled = true;
    elements.evidenceSubmit.textContent = evidenceFile ? "Subiendo foto..." : "Guardando...";

    const uploadMeta = evidenceFile
      ? await uploadEvidenceImage(state.activeCampaignId, evidenceFile)
      : {
          assetType: looksLikeImageUrl(providedUrl) ? "image" : "link",
          fileName: "",
          mimeType: "",
          publicUrl: providedUrl,
          storagePath: "",
        };
    uploadedStoragePath = uploadMeta.storagePath;

    await addDoc(collection(db, `campaigns/${state.activeCampaignId}/evidence`), {
      title,
      kind,
      publicUrl: uploadMeta.publicUrl,
      assetType: uploadMeta.assetType,
      fileName: uploadMeta.fileName,
      mimeType: uploadMeta.mimeType,
      storagePath: uploadMeta.storagePath,
      description,
      amount,
      recordedAt,
      createdAt: serverTimestamp(),
    });

    elements.evidenceForm.reset();
    setMessage(elements.evidenceMessage, "Evidencia guardada correctamente.", "success");
  } catch (error) {
    if (uploadedStoragePath && storage) {
      try {
        await deleteObject(storageRef(storage, uploadedStoragePath));
      } catch (cleanupError) {
        console.error("Evidence upload cleanup failed.", cleanupError);
      }
    }

    console.error("Unable to create evidence.", error);
    setMessage(
      elements.evidenceMessage,
      mapStorageError(error, "No fue posible guardar la evidencia."),
      "error"
    );
  } finally {
    elements.evidenceSubmit.disabled = false;
    elements.evidenceSubmit.textContent = "Guardar evidencia";
  }
}

async function handleEvidenceAction(event) {
  if (event.target.dataset.action !== "delete-evidence") {
    return;
  }

  const card = event.target.closest("[data-evidence-id]");
  if (!card) {
    return;
  }

  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("No hay una campaña activa para editar evidencias.");
    }

    const evidenceItem = state.activeEvidence.find((item) => item.id === card.dataset.evidenceId);
    if (!evidenceItem) {
      throw new Error("No se encontró la evidencia seleccionada.");
    }

    if (evidenceItem.storagePath && storage) {
      try {
        await deleteObject(storageRef(storage, evidenceItem.storagePath));
      } catch (error) {
        if (error?.code !== "storage/object-not-found") {
          throw error;
        }
      }
    }

    await deleteDoc(doc(db, `campaigns/${state.activeCampaignId}/evidence/${card.dataset.evidenceId}`));
    setMessage(elements.evidenceMessage, "Evidencia eliminada.", "success");
  } catch (error) {
    console.error("Evidence delete failed.", error);
    setMessage(
      elements.evidenceMessage,
      mapStorageError(error, "No fue posible eliminar la evidencia."),
      "error"
    );
  }
}

async function handleCampaignPickerAction(event) {
  if (event.target.dataset.action !== "activate-campaign") {
    return;
  }

  const button = event.target;

  try {
    ensureAdminSession();
    const campaignId = String(button.dataset.campaignId || "").trim();
    if (!campaignId) {
      throw new Error("No se encontró el identificador de la campaña.");
    }

    button.disabled = true;
    button.textContent = "Activando...";
    await activateCampaignClient(campaignId);
    showStatus("La campaña seleccionada ya fue activada.", "success");
  } catch (error) {
    console.error("Campaign activation failed.", error);
    setMessage(
      elements.activeCampaignMessage,
      error.message || "No fue posible activar la campaña seleccionada.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Activar";
  }
}

async function handleSyncTeleton() {
  try {
    ensureAdminSession();
    elements.adminSyncTeletonButton.disabled = true;
    elements.adminSyncTeletonButton.textContent = "Mostrando...";
    setMessage(
      elements.activeCampaignMessage,
      "En modo gratuito, el seguimiento de Teletón corre desde GitHub Actions cada 30 minutos cuando la campaña activa tiene URL configurada.",
      "info"
    );
  } catch (error) {
    console.error("Teleton sync failed.", error);
    setMessage(
      elements.activeCampaignMessage,
      error.message || "No fue posible mostrar el estado de Teletón.",
      "error"
    );
  } finally {
    elements.adminSyncTeletonButton.disabled = !isAdminReady() || !state.activeCampaignId;
    elements.adminSyncTeletonButton.textContent = "Estado de Teletón";
  }
}

async function handleRecalculateTotals() {
  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("No hay una campaña activa para recalcular.");
    }
    elements.adminRecalculateButton.disabled = true;
    elements.adminRecalculateButton.textContent = "Recalculando...";
    await recalculateCampaignAggregatesClient(state.activeCampaignId);
    showStatus("Los agregados de la campaña fueron recalculados.", "success");
  } catch (error) {
    console.error("Recalculate totals failed.", error);
    setMessage(
      elements.activeCampaignMessage,
      error.message || "No fue posible recalcular la campaña.",
      "error"
    );
  } finally {
    elements.adminRecalculateButton.disabled = !isAdminReady() || !state.activeCampaignId;
    elements.adminRecalculateButton.textContent = "Recalcular totales";
  }
}

async function handleCloseCampaign() {
  try {
    ensureAdminSession();
    if (!state.activeCampaignId) {
      throw new Error("No hay una campaña activa para cerrar.");
    }

    elements.adminCloseCampaignButton.disabled = true;
    elements.adminCloseCampaignButton.textContent = "Cerrando...";
    await closeCampaignClient(state.activeCampaignId);
    setMessage(elements.adminCloseMessage, "Campaña cerrada correctamente.", "success");
    showStatus("La campaña actual fue cerrada y pasó al historial.", "success");
  } catch (error) {
    console.error("Close campaign failed.", error);
    setMessage(
      elements.adminCloseMessage,
      error.message || "No fue posible cerrar la campaña.",
      "error"
    );
  } finally {
    elements.adminCloseCampaignButton.disabled = !isAdminReady() || !state.activeCampaignId;
    elements.adminCloseCampaignButton.textContent = "Cerrar campaña actual";
  }
}

async function handleNewCampaignCreate(event) {
  event.preventDefault();
  setMessage(elements.newCampaignMessage, "");

  try {
    ensureAdminSession();
    const payload = {
      name: String(elements.newCampaignName.value || "").trim().slice(0, 120),
      semesterLabel: String(elements.newCampaignSemester.value || "").trim().slice(0, 80),
      goalAmount: roundCurrency(elements.newCampaignGoal.value),
      teletonUrl: String(elements.newCampaignTeletonUrl.value || "").trim().slice(0, 500),
      startAt: parseDateTimeLocal(elements.newCampaignStart.value, "inicio"),
      endAt: parseDateTimeLocal(elements.newCampaignEnd.value, "cierre"),
    };

    if (!payload.name || !payload.semesterLabel) {
      throw new Error("Nombre y semestre son obligatorios.");
    }

    if (!Number.isFinite(payload.goalAmount) || payload.goalAmount <= 0) {
      throw new Error("La meta debe ser un monto mayor a 0.");
    }

    if (payload.endAt.getTime() <= payload.startAt.getTime()) {
      throw new Error("La fecha de cierre debe ser posterior a la de inicio.");
    }

    elements.newCampaignSubmit.disabled = true;
    elements.newCampaignSubmit.textContent = "Creando...";
    const campaignId = await createCampaignClient(payload);
    elements.newCampaignForm.reset();
    setMessage(
      elements.newCampaignMessage,
      `Campaña creada en borrador: ${campaignId}.`,
      "success"
    );
  } catch (error) {
    console.error("Create campaign failed.", error);
    setMessage(
      elements.newCampaignMessage,
      error.message || "No fue posible crear la nueva campaña.",
      "error"
    );
  } finally {
    elements.newCampaignSubmit.disabled = false;
    elements.newCampaignSubmit.textContent = "Crear campaña en borrador";
  }
}

function bindUi() {
  document.addEventListener("click", (event) => {
    const routeLink = event.target.closest("a[data-route]");
    if (routeLink) {
      const href = routeLink.getAttribute("href") || "/";
      const url = new URL(href, globalThis.location.origin);
      if (url.origin === globalThis.location.origin) {
        event.preventDefault();
        closeSiteMenu();
        navigateTo(url.pathname, url.hash.replace(/^#/, ""));
      }
      return;
    }

    const menuLink = event.target.closest("[data-menu-link]");
    if (menuLink) {
      closeSiteMenu();
    }
  });

  document.querySelectorAll("[data-open-donation-notice]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openDonationNoticeModal();
    });
  });

  document.querySelectorAll("[data-open-admin-modal]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openAdminModal();
    });
  });

  elements.navMenuButton.addEventListener("click", () => {
    if (elements.siteMenu.getAttribute("aria-hidden") === "false") {
      closeSiteMenu();
      return;
    }

    openSiteMenu();
  });
  elements.siteMenuBackdrop.addEventListener("click", closeSiteMenu);
  elements.siteMenuCloseButton.addEventListener("click", closeSiteMenu);

  elements.donationNoticeClose.addEventListener("click", closeDonationNoticeModal);
  elements.donationNoticeCloseButton.addEventListener("click", closeDonationNoticeModal);
  elements.donationNoticeBackdrop.addEventListener("click", closeDonationNoticeModal);
  elements.donationNoticePanel.addEventListener("click", (event) => event.stopPropagation());

  elements.adminCloseCampaignButton.addEventListener("click", handleCloseCampaign);
  elements.adminBackdrop.addEventListener("click", closeAdminModal);
  elements.adminPanel.addEventListener("click", (event) => event.stopPropagation());
  elements.adminModalCloseButton.addEventListener("click", closeAdminModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.adminModal.getAttribute("aria-hidden") === "false") {
      closeAdminModal();
    }

    if (
      event.key === "Escape" &&
      elements.donationNoticeModal.getAttribute("aria-hidden") === "false"
    ) {
      closeDonationNoticeModal();
    }

    if (event.key === "Escape" && elements.siteMenu.getAttribute("aria-hidden") === "false") {
      closeSiteMenu();
    }
  });

  elements.adminTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.adminTab = button.dataset.tab;
      renderAdminTabs();
    });
  });

  elements.adminAuthForm.addEventListener("submit", handleAuthSubmit);
  elements.adminLogoutButton.addEventListener("click", handleLogout);
  elements.adminActiveLogoutButton.addEventListener("click", handleLogout);
  elements.adminDonationForm.addEventListener("submit", handleDonationSubmit);
  elements.piggyBankForm.addEventListener("submit", handlePiggyBankCreate);
  elements.adminPiggyBanksList.addEventListener("click", handlePiggyBankAction);
  elements.activeCampaignForm.addEventListener("submit", handleActiveCampaignSave);
  elements.evidenceForm.addEventListener("submit", handleEvidenceCreate);
  elements.adminEvidenceList.addEventListener("click", handleEvidenceAction);
  elements.adminCampaignPicker.addEventListener("click", handleCampaignPickerAction);
  elements.adminSyncTeletonButton.addEventListener("click", handleSyncTeleton);
  elements.adminRecalculateButton.addEventListener("click", handleRecalculateTotals);
  elements.newCampaignForm.addEventListener("submit", handleNewCampaignCreate);
  globalThis.addEventListener("popstate", () => {
    state.route = getRouteFromLocation();
    renderAll();
    const hash = String(globalThis.location.hash || "").replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => scrollToHash(hash, false));
    }
  });
}

async function bootstrap() {
  state.route = getRouteFromLocation();
  bindUi();
  renderAll();
  const initialHash = String(globalThis.location.hash || "").replace(/^#/, "");
  if (initialHash) {
    requestAnimationFrame(() => scrollToHash(initialHash, false));
  }

  if (!isFirebaseConfigured || !db || !auth) {
    showStatus(
      "Configura Firebase Auth y Firestore antes de usar la plataforma.",
      "error"
    );
    return;
  }

  showStatus("Firebase conectado. Cargando plataforma...", "info");

  try {
    subscribeToBaseData();
    clearStatus();
  } catch (error) {
    console.error("Bootstrap failed.", error);
    showStatus("No fue posible iniciar la plataforma.", "error");
  }
}

bootstrap();
