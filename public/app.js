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

const state = {
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
  baseUnsubscribers: [],
  activeCampaignUnsubscribers: [],
  userRoleUnsubscribe: null,
};

const elements = {
  appStatus: document.getElementById("app-status"),
  heroCampaignState: document.getElementById("hero-campaign-state"),
  heroCampaignCopy: document.getElementById("hero-campaign-copy"),
  heroCampaignName: document.getElementById("hero-campaign-name"),
  heroCampaignMeta: document.getElementById("hero-campaign-meta"),
  heroPrimaryButton: document.getElementById("hero-primary-button"),
  activeCampaignName: document.getElementById("active-campaign-name"),
  activeCampaignStatus: document.getElementById("active-campaign-status"),
  activeCampaignSemester: document.getElementById("active-campaign-semester"),
  activeCampaignDates: document.getElementById("active-campaign-dates"),
  activeCampaignGoal: document.getElementById("active-campaign-goal"),
  activeCampaignCopy: document.getElementById("active-campaign-copy"),
  activeCampaignTotal: document.getElementById("active-campaign-total"),
  activeCampaignTeletonLink: document.getElementById("active-campaign-teleton-link"),
  activeCampaignSupportButton: document.getElementById("active-campaign-support-button"),
  activeCampaignTransparencyCount: document.getElementById("active-campaign-transparency-count"),
  historyCount: document.getElementById("history-count"),
  counterStageCopy: document.getElementById("counter-stage-copy"),
  counterBreakdownCopy: document.getElementById("counter-breakdown-copy"),
  counterTotal: document.getElementById("counter-total"),
  counterGoal: document.getElementById("counter-goal"),
  counterPercent: document.getElementById("counter-percent"),
  counterRemaining: document.getElementById("counter-remaining"),
  counterFill: document.getElementById("counter-fill"),
  breakdownPhysical: document.getElementById("breakdown-physical"),
  breakdownDigital: document.getElementById("breakdown-digital"),
  breakdownRecycling: document.getElementById("breakdown-recycling"),
  counterDonationCount: document.getElementById("counter-donation-count"),
  counterCountdownValue: document.getElementById("counter-countdown-value"),
  counterCountdownLabel: document.getElementById("counter-countdown-label"),
  counterSyncStatus: document.getElementById("counter-sync-status"),
  piggyBanksList: document.getElementById("piggy-banks-list"),
  piggyBanksEmpty: document.getElementById("piggy-banks-empty"),
  generalDonationsCard: document.getElementById("general-donations-card"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardEmpty: document.getElementById("leaderboard-empty"),
  transparencySyncStatus: document.getElementById("transparency-sync-status"),
  transparencySyncCopy: document.getElementById("transparency-sync-copy"),
  transparencyTotalAmount: document.getElementById("transparency-total-amount"),
  transparencyDigitalAmount: document.getElementById("transparency-digital-amount"),
  transparencyLastSync: document.getElementById("transparency-last-sync"),
  transparencyEvidenceCount: document.getElementById("transparency-evidence-count"),
  transparencyEvidenceList: document.getElementById("transparency-evidence-list"),
  transparencyEvidenceEmpty: document.getElementById("transparency-evidence-empty"),
  historyCampaignsList: document.getElementById("history-campaigns-list"),
  historyEmpty: document.getElementById("history-empty"),
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
};

function formatCurrency(value) {
  return MXN_FORMATTER.format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    elements.heroPrimaryButton.disabled = false;
    document.title = "Reciclando Goles";
    return;
  }

  elements.heroCampaignState.textContent = humanizeCampaignStatus(campaign.status);
  elements.heroCampaignCopy.textContent = `${campaign.name} (${campaign.semesterLabel || "Sin semestre"}) reúne la meta pública, las fechas oficiales y las rutas de apoyo de esta edición.`;
  elements.heroCampaignName.textContent = campaign.name;
  elements.heroCampaignMeta.textContent =
    campaign.status === "active"
      ? `Cierre programado: ${formatDate(campaign.endAt)}`
      : "Esta campaña ya cerró y permanece en el historial institucional.";
  elements.heroPrimaryButton.disabled = false;
  document.title = `${campaign.name} | Reciclando Goles`;
}

function setLinkState(linkElement, url, label) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    linkElement.classList.add("hidden");
    linkElement.removeAttribute("href");
    return;
  }

  linkElement.classList.remove("hidden");
  linkElement.href = safeUrl;
  linkElement.textContent = label;
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
    elements.activeCampaignGoal.textContent = formatCurrency(0);
    elements.activeCampaignCopy.textContent =
      "Reciclando Goles sigue funcionando como plataforma institucional mientras prepara la siguiente campaña.";
    elements.activeCampaignTotal.textContent = formatCurrency(0);
    setLinkState(elements.activeCampaignTeletonLink, "", "");
    elements.activeCampaignSupportButton.disabled = false;
    return;
  }

  elements.activeCampaignName.textContent = campaign.name;
  elements.activeCampaignStatus.textContent = humanizeCampaignStatus(campaign.status);
  elements.activeCampaignSemester.textContent = campaign.semesterLabel || "Semestre no definido";
  elements.activeCampaignDates.textContent = formatDateRange(campaign.startAt, campaign.endAt);
  elements.activeCampaignGoal.textContent = formatCurrency(campaign.goalAmount);
  elements.activeCampaignCopy.textContent =
    campaign.status === "active"
      ? "Consulta aquí la meta vigente, las fechas oficiales y las formas públicas de apoyo de esta edición."
      : "Esta campaña ya cerró, pero su información permanece como parte del historial institucional.";
  elements.activeCampaignTotal.textContent = formatCurrency(totals.totalAmount);
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

  elements.counterTotal.textContent = formatCurrency(totalAmount);
  elements.counterGoal.textContent = formatCurrency(goalAmount);
  elements.breakdownPhysical.textContent = formatCurrency(totals.physicalAmount);
  elements.breakdownDigital.textContent = formatCurrency(totals.digitalAmount);
  elements.breakdownRecycling.textContent = formatCurrency(totals.recyclingAmount);
  elements.counterDonationCount.textContent = String(totals.donationCount);
  elements.counterBreakdownCopy.textContent = `Físico: ${formatCurrency(
    totals.physicalAmount
  )} · Digital: ${formatCurrency(totals.digitalAmount)} · Reciclaje: ${formatCurrency(
    totals.recyclingAmount
  )}`;
  elements.counterFill.style.width = `${percent}%`;
  elements.counterSyncStatus.textContent =
    humanizeSyncStatus(totals.syncStatus);

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
  const piggyBanks = getPublicPiggyBanks();
  elements.piggyBanksList.innerHTML = "";
  elements.piggyBanksEmpty.hidden = piggyBanks.length > 0;

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
                    item.description || "Sin descripcion adicional."
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

function renderAll() {
  renderHero();
  renderActiveCampaignSection();
  renderCounter();
  renderPiggyBanks();
  renderLeaderboard();
  renderTransparency();
  renderHistory();
  renderDonationNotice();
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
            name: String(data.name || "").trim(),
            location: String(data.location || "").trim(),
            status: String(data.status || "inactive"),
            accepts: Array.isArray(data.accepts)
              ? data.accepts.map((value) => String(value || "").trim()).filter(Boolean)
              : [],
            notes: String(data.notes || "").trim(),
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
            displayName: String(data.displayName || "Anonimo").trim() || "Anonimo",
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
        showStatus("No fue posible actualizar el ranking publico.", "error");
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
            title: String(data.title || "").trim(),
            kind: String(data.kind || "other"),
            publicUrl: String(data.publicUrl || "").trim(),
            assetType: String(data.assetType || "").trim(),
            fileName: String(data.fileName || "").trim(),
            mimeType: String(data.mimeType || "").trim(),
            storagePath: String(data.storagePath || "").trim(),
            description: String(data.description || "").trim(),
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
  return {
    id: documentSnapshot.id,
    name: String(data.name || "").trim(),
    semesterLabel: String(data.semesterLabel || "").trim(),
    status: String(data.status || "draft"),
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
}

async function bootstrap() {
  bindUi();
  renderAll();

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
