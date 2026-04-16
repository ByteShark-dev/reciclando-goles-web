import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { db, isFirebaseConfigured } from "./firebase.js";

const INITIAL_GOAL_AMOUNT = 10000;
const GOAL_STEP_AMOUNT = 5000;
const CAMPAIGN_END_TARGET = new Date("2026-05-11T23:59:00-06:00");
const TELETON_DONATION_URL =
  "https://www.alcanciadigitalteleton.mx/pagos/0/12689/reciclando-goles-toros-para-el-teletn.html";
const ADMIN_CODE_LENGTH = 24;
const ADMIN_GATE_SESSION_KEY = "reciclando-goles-admin-gate";
const ADMIN_ACCESS_NAME_SESSION_KEY = "reciclando-goles-admin-name";
const ADMIN_ACCESS_CODE_HASH = "18beed41db9cbaab69bc592d3cd33317110d0775f63e68837f1dbb5e5f4f31ec";
const MXN_FORMATTER = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const state = {
  leaderboardView: "aggregate",
  topDonors: [],
  topDonations: [],
  generalDonations: {
    totalAmount: 0,
    donationCount: 0,
  },
  localDonationTotal: 0,
  localDonationCount: 0,
  externalTeletonAmount: 0,
  serverAggregateAvailable: false,
  serverStatsAvailable: false,
  adminGateUnlocked: readAdminGateState(),
  adminAccessName: readAdminAccessName(),
};

const elements = {
  appStatus: document.getElementById("app-status"),
  goalStageCopy: document.getElementById("goal-stage-copy"),
  progressBreakdown: document.getElementById("progress-breakdown"),
  progressRaised: document.getElementById("progress-raised"),
  progressGoal: document.getElementById("progress-goal"),
  progressPercent: document.getElementById("progress-percent"),
  progressRemaining: document.getElementById("progress-remaining"),
  progressFill: document.getElementById("progress-fill"),
  donorCount: document.getElementById("donor-count"),
  campaignCountdownValue: document.getElementById("campaign-countdown-value"),
  campaignCountdownLabel: document.getElementById("campaign-countdown-label"),
  leaderboardTitle: document.getElementById("leaderboard-title"),
  leaderboardSubtitle: document.getElementById("leaderboard-subtitle"),
  generalDonationsCard: document.getElementById("general-donations-card"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardToggle: document.getElementById("leaderboard-toggle"),
  donationNoticeModal: document.getElementById("donation-notice-modal"),
  donationNoticeBackdrop: document.getElementById("donation-notice-backdrop"),
  donationNoticePanel: document.getElementById("donation-notice-panel"),
  donationNoticeClose: document.getElementById("close-donation-notice-modal"),
  donationNoticeCloseButton: document.getElementById("close-donation-notice-button"),
  donationModal: document.getElementById("donation-modal"),
  modalBackdrop: document.getElementById("modal-backdrop"),
  modalPanel: document.getElementById("donation-modal-panel"),
  modalClose: document.getElementById("close-donation-modal"),
  codePanel: document.getElementById("admin-code-panel"),
  accessNameInput: document.getElementById("admin-access-name"),
  codeInput: document.getElementById("admin-code-input"),
  codeMessage: document.getElementById("admin-code-message"),
  codeSubmitButton: document.getElementById("admin-code-submit"),
  authPanel: document.getElementById("admin-auth-panel"),
  authCopy: document.getElementById("admin-auth-copy"),
  signOutButton: document.getElementById("admin-sign-out-button"),
  teletonSyncPanel: document.getElementById("teleton-sync-panel"),
  teletonExternalAmount: document.getElementById("teleton-external-amount"),
  teletonSyncMessage: document.getElementById("teleton-sync-message"),
  teletonSyncButton: document.getElementById("teleton-sync-button"),
  donationForm: document.getElementById("donation-form"),
  donationName: document.getElementById("donation-name"),
  donationAmount: document.getElementById("donation-amount"),
  formMessage: document.getElementById("form-message"),
  submitButton: document.getElementById("submit-donation"),
};

function formatCurrency(amount) {
  return MXN_FORMATTER.format(Number(amount) || 0);
}

function readAdminGateState() {
  try {
    return window.sessionStorage.getItem(ADMIN_GATE_SESSION_KEY) === "granted";
  } catch (error) {
    console.warn("Admin gate session could not be read.", error);
    return false;
  }
}

function persistAdminGateState(isUnlocked) {
  try {
    if (isUnlocked) {
      window.sessionStorage.setItem(ADMIN_GATE_SESSION_KEY, "granted");
      return;
    }

    window.sessionStorage.removeItem(ADMIN_GATE_SESSION_KEY);
  } catch (error) {
    console.warn("Admin gate session could not be updated.", error);
  }
}

function readAdminAccessName() {
  try {
    return window.sessionStorage.getItem(ADMIN_ACCESS_NAME_SESSION_KEY) ?? "";
  } catch (error) {
    console.warn("Admin access name could not be read.", error);
    return "";
  }
}

function persistAdminAccessName(value) {
  try {
    if (value) {
      window.sessionStorage.setItem(ADMIN_ACCESS_NAME_SESSION_KEY, value);
      return;
    }

    window.sessionStorage.removeItem(ADMIN_ACCESS_NAME_SESSION_KEY);
  } catch (error) {
    console.warn("Admin access name could not be updated.", error);
  }
}

function displayName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "Anonimo";
}

function normalizedDonorName(value) {
  return displayName(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isAnonymousDonor(value) {
  return normalizedDonorName(value) === "anonimo";
}

function normalizeAccessName(value) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeAccessCode(value) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, ADMIN_CODE_LENGTH) : "";
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

function summarizeGeneralDonations(donations) {
  return donations.reduce(
    (summary, donation) => {
      if (!isAnonymousDonor(donation.name ?? donation.displayName)) {
        return summary;
      }

      summary.totalAmount += Number(donation.amount ?? donation.totalAmount) || 0;
      summary.donationCount += Number(donation.donationCount) || 1;
      return summary;
    },
    {
      totalAmount: 0,
      donationCount: 0,
    }
  );
}

function aggregateTopDonors(donations, topLimit = 10, { excludeAnonymous = true } = {}) {
  const donorMap = new Map();

  donations.forEach((donation) => {
    const name = displayName(donation.name);

    if (excludeAnonymous && isAnonymousDonor(name)) {
      return;
    }

    const key = name.trim().toLowerCase();
    const current = donorMap.get(key) ?? {
      displayName: name,
      totalAmount: 0,
      donationCount: 0,
    };

    current.totalAmount += Number(donation.amount) || 0;
    current.donationCount += 1;
    donorMap.set(key, current);
  });

  return Array.from(donorMap.values())
    .sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }

      return left.displayName.localeCompare(right.displayName, "es-MX");
    })
    .slice(0, topLimit);
}

function renderGeneralDonationsCard() {
  if (!elements.generalDonationsCard) {
    return;
  }

  const shouldShow =
    state.leaderboardView === "aggregate" && Number(state.generalDonations.donationCount) > 0;

  elements.generalDonationsCard.innerHTML = "";
  elements.generalDonationsCard.hidden = !shouldShow;
  elements.generalDonationsCard.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    return;
  }

  const card = document.createElement("article");
  card.className =
    "rounded-[2rem] border border-secondary/20 bg-gradient-to-r from-secondary-container/35 to-white p-6 shadow-sm";

  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-wrap items-center justify-between gap-6";

  const left = document.createElement("div");
  left.className = "space-y-2";

  const eyebrow = document.createElement("p");
  eyebrow.className = "text-xs font-black uppercase tracking-[0.3em] text-secondary";
  eyebrow.textContent = "Donaciones generales";

  const heading = document.createElement("h3");
  heading.className = "font-headline text-3xl font-black tracking-tight text-on-surface";
  heading.textContent = "Aportes de personas anonimas";

  const copy = document.createElement("p");
  copy.className = "text-sm text-on-surface-variant";
  copy.textContent = `${state.generalDonations.donationCount} donacion${
    state.generalDonations.donationCount === 1 ? "" : "es"
  } sumadas fuera del ranking por nombre.`;

  left.append(eyebrow, heading, copy);

  const right = document.createElement("div");
  right.className = "min-w-[180px] text-left sm:text-right";

  const amount = document.createElement("p");
  amount.className = "text-3xl font-black text-primary";
  amount.textContent = formatCurrency(state.generalDonations.totalAmount);

  const count = document.createElement("p");
  count.className = "text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant";
  count.textContent = `${state.generalDonations.donationCount} donacion${
    state.generalDonations.donationCount === 1 ? "" : "es"
  }`;

  right.append(amount, count);
  wrapper.append(left, right);
  card.append(wrapper);
  elements.generalDonationsCard.append(card);
}

function showStatus(message, tone = "info") {
  if (!elements.appStatus) {
    return;
  }

  const tones = {
    info: "border-secondary/20 bg-secondary-container/40 text-on-surface",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };

  elements.appStatus.className = `mx-auto mb-8 max-w-5xl rounded-2xl border px-4 py-3 text-sm font-medium ${tones[tone] ?? tones.info}`;
  elements.appStatus.textContent = message;
  elements.appStatus.hidden = false;
}

function clearStatus() {
  if (!elements.appStatus) {
    return;
  }

  elements.appStatus.hidden = true;
  elements.appStatus.textContent = "";
}

function setTeletonSyncMessage(message, tone = "info") {
  if (!elements.teletonSyncMessage) {
    return;
  }

  const tones = {
    error: "text-red-700",
    success: "text-emerald-700",
    info: "text-on-surface-variant",
  };

  elements.teletonSyncMessage.className = `mt-3 min-h-6 text-sm font-medium ${tones[tone] ?? tones.info}`;
  elements.teletonSyncMessage.textContent = message;
}

function formatCountdownUnit(value, singular, plural) {
  const safeValue = Math.max(Number(value) || 0, 0);
  return `${safeValue} ${safeValue === 1 ? singular : plural}`;
}

function updateCampaignCountdown() {
  if (!elements.campaignCountdownValue || !elements.campaignCountdownLabel) {
    return;
  }

  const now = new Date();
  const remainingMs = CAMPAIGN_END_TARGET.getTime() - now.getTime();

  if (remainingMs <= 0) {
    elements.campaignCountdownValue.textContent = "En curso";
    elements.campaignCountdownLabel.textContent = "Fecha estimada alcanzada";
    return;
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (remainingMs >= dayMs) {
    const days = Math.ceil(remainingMs / dayMs);
    elements.campaignCountdownValue.textContent = formatCountdownUnit(days, "dia", "dias");
    elements.campaignCountdownLabel.textContent = "Cierre estimado al 11 de mayo";
    return;
  }

  if (remainingMs >= hourMs) {
    const hours = Math.ceil(remainingMs / hourMs);
    elements.campaignCountdownValue.textContent = formatCountdownUnit(hours, "hora", "horas");
    elements.campaignCountdownLabel.textContent = "Restantes para el cierre estimado";
    return;
  }

  const minutes = Math.max(Math.ceil(remainingMs / minuteMs), 1);
  elements.campaignCountdownValue.textContent = formatCountdownUnit(minutes, "minuto", "minutos");
  elements.campaignCountdownLabel.textContent = "Ultimos minutos del cierre estimado";
}

function startCampaignCountdown() {
  updateCampaignCountdown();
  window.setInterval(updateCampaignCountdown, 30 * 1000);
}

function syncProgressFromState() {
  const combinedTotal = state.localDonationTotal + state.externalTeletonAmount;
  updateProgress(combinedTotal, state.localDonationCount);

  if (elements.progressBreakdown) {
    elements.progressBreakdown.textContent = `Presencial: ${formatCurrency(
      state.localDonationTotal
    )} · Teletón en línea: ${formatCurrency(state.externalTeletonAmount)}`;
  }
}

function validateExternalAmount(amount) {
  const normalizedAmount = typeof amount === "string" ? amount.trim() : String(amount);
  const parsedAmount = Number(normalizedAmount);

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new Error("Usa un monto valido con maximo dos decimales.");
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error("Ingresa un monto valido mayor o igual a 0.");
  }

  return Number(parsedAmount.toFixed(2));
}

function getGoalState(totalAmount) {
  const safeTotal = Number(totalAmount) || 0;
  if (safeTotal < INITIAL_GOAL_AMOUNT) {
    return {
      completedGoals: 0,
      currentGoal: INITIAL_GOAL_AMOUNT,
      currentGoalNumber: 1,
      percentage: safeTotal > 0 ? Math.min((safeTotal / INITIAL_GOAL_AMOUNT) * 100, 100) : 0,
      remaining: Math.max(INITIAL_GOAL_AMOUNT - safeTotal, 0),
      stageLabel: "Meta 1 en curso",
    };
  }

  const completedGoals = 1 + Math.floor((safeTotal - INITIAL_GOAL_AMOUNT) / GOAL_STEP_AMOUNT);
  const currentGoal = INITIAL_GOAL_AMOUNT + completedGoals * GOAL_STEP_AMOUNT;
  const stageStart = INITIAL_GOAL_AMOUNT + (completedGoals - 1) * GOAL_STEP_AMOUNT;
  const stageProgress = safeTotal - stageStart;

  return {
    completedGoals,
    currentGoal,
    currentGoalNumber: completedGoals + 1,
    percentage: Math.min((stageProgress / GOAL_STEP_AMOUNT) * 100, 100),
    remaining: Math.max(currentGoal - safeTotal, 0),
    stageLabel: `Meta ${completedGoals} completada${completedGoals === 1 ? "" : "s"}`,
  };
}

function updateProgress(totalAmount, donationCount) {
  const safeTotal = Number(totalAmount) || 0;
  const safeCount = Number(donationCount) || 0;
  const goalState = getGoalState(safeTotal);
  const progressLabel =
    goalState.completedGoals > 0
      ? `${goalState.stageLabel} · ${Math.round(goalState.percentage)}% de meta ${goalState.currentGoalNumber}`
      : `${Math.round(goalState.percentage)}% completado`;
  const remainingLabel =
    goalState.completedGoals > 0
      ? `Faltan ${formatCurrency(goalState.remaining)} para la meta ${goalState.currentGoalNumber}`
      : `Faltan ${formatCurrency(goalState.remaining)}`;

  elements.progressRaised.textContent = formatCurrency(safeTotal);
  elements.progressGoal.textContent = formatCurrency(goalState.currentGoal);
  elements.progressPercent.textContent = progressLabel;
  elements.progressRemaining.textContent = remainingLabel;
  elements.progressFill.style.width = `${goalState.percentage}%`;
  elements.donorCount.textContent = safeCount.toString();
  elements.goalStageCopy.textContent =
    goalState.completedGoals > 0
      ? `${goalState.stageLabel}. Meta ${goalState.currentGoalNumber} en curso.`
      : goalState.stageLabel;
}

function buildLeaderboardRow({ rank, title, subtitle, amount, accent = false }) {
  const row = document.createElement("article");
  row.className = accent
    ? "group flex flex-wrap items-center justify-between gap-6 rounded-[2rem] border-l-8 border-secondary bg-white p-6 shadow-md transition-transform duration-300 hover:scale-[1.01]"
    : "group flex flex-wrap items-center justify-between gap-6 rounded-[2rem] bg-white p-6 shadow-sm transition-colors duration-300 hover:bg-surface-container-low";

  const left = document.createElement("div");
  left.className = "flex items-center gap-5";

  const badge = document.createElement("div");
  badge.className = accent
    ? "flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-xl font-black text-secondary shadow-lg"
    : "flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-highest text-xl font-black text-zinc-600";
  badge.textContent = String(rank);

  const text = document.createElement("div");
  const heading = document.createElement("h3");
  heading.className = "text-lg font-bold text-on-surface";
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.className = "text-sm text-on-surface-variant";
  copy.textContent = subtitle;

  text.append(heading, copy);
  left.append(badge, text);

  const right = document.createElement("div");
  right.className = "text-right";

  const amountNode = document.createElement("p");
  amountNode.className = accent
    ? "text-2xl font-black text-primary"
    : "text-2xl font-black text-on-surface";
  amountNode.textContent = formatCurrency(amount);

  const place = document.createElement("p");
  place.className = accent
    ? "text-xs font-bold uppercase tracking-[0.25em] text-secondary"
    : "text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant";
  place.textContent = `${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} place`;

  right.append(amountNode, place);
  row.append(left, right);
  return row;
}

function renderLeaderboard() {
  renderGeneralDonationsCard();
  elements.leaderboardList.innerHTML = "";

  const items = state.leaderboardView === "aggregate" ? state.topDonors : state.topDonations;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className =
      "rounded-[2rem] border border-dashed border-outline-variant bg-white px-6 py-10 text-center text-on-surface-variant";
    empty.textContent =
      state.leaderboardView === "aggregate" && state.generalDonations.donationCount > 0
        ? "Las donaciones con nombre visible apareceran aqui."
        : "Todavia no hay donaciones registradas. Se la primera persona en sumar al marcador.";
    elements.leaderboardList.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const rank = index + 1;
    const accent = rank === 1;

    if (state.leaderboardView === "aggregate") {
      elements.leaderboardList.append(
        buildLeaderboardRow({
          rank,
          title: displayName(item.displayName),
          subtitle: `${item.donationCount} donacion${item.donationCount === 1 ? "" : "es"} acumulada${item.donationCount === 1 ? "" : "s"}`,
          amount: item.totalAmount,
          accent,
        })
      );
      return;
    }

    elements.leaderboardList.append(
      buildLeaderboardRow({
        rank,
        title: displayName(item.name),
        subtitle: "Donacion individual destacada",
        amount: item.amount,
        accent,
      })
    );
  });
}

function updateLeaderboardCopy() {
  if (state.leaderboardView === "aggregate") {
    elements.leaderboardTitle.textContent = "Muro de Campeones";
    elements.leaderboardSubtitle.textContent =
      "Ranking acumulado por nombre con los mayores aportadores.";
    elements.leaderboardToggle.textContent = "Ver lista completa de donaciones";
    return;
  }

  elements.leaderboardTitle.textContent = "Lista completa de donaciones top";
  elements.leaderboardSubtitle.textContent =
    'Vista por donaciones individuales ordenadas con orderBy("amount", "desc").';
  elements.leaderboardToggle.textContent = "Volver al ranking por donador";
}

function syncLeaderboardView() {
  updateLeaderboardCopy();
  renderLeaderboard();
}

function openDonationNoticeModal() {
  elements.donationNoticeModal.hidden = false;
  elements.donationNoticeModal.classList.remove("pointer-events-none", "opacity-0");
  elements.donationNoticeModal.setAttribute("aria-hidden", "false");
  elements.donationNoticeClose.focus();
}

function closeDonationNoticeModal() {
  elements.donationNoticeModal.classList.add("pointer-events-none", "opacity-0");
  elements.donationNoticeModal.setAttribute("aria-hidden", "true");
  elements.donationNoticeModal.hidden = true;
}

function openAdminModal() {
  updateAdminUi();
  elements.donationModal.hidden = false;
  elements.donationModal.classList.remove("pointer-events-none", "opacity-0");
  elements.donationModal.setAttribute("aria-hidden", "false");

  if (state.adminGateUnlocked) {
    elements.donationName.focus();
    return;
  }

  elements.accessNameInput.focus();
}

function closeAdminModal() {
  elements.donationModal.classList.add("pointer-events-none", "opacity-0");
  elements.donationModal.setAttribute("aria-hidden", "true");
  elements.donationModal.hidden = true;
  elements.donationForm.reset();
  elements.accessNameInput.value = state.adminGateUnlocked ? state.adminAccessName : "";
  elements.codeInput.value = "";
  setCodeMessage("");
  elements.formMessage.textContent = "";
}

function setCodeMessage(message, tone = "error") {
  const tones = {
    error: "text-red-700",
    success: "text-emerald-700",
    info: "text-on-surface-variant",
  };

  elements.codeMessage.className = `mt-3 min-h-6 text-sm font-medium ${tones[tone] ?? tones.info}`;
  elements.codeMessage.textContent = message;
}

function setFormMessage(message, tone = "error") {
  const tones = {
    error: "text-red-700",
    success: "text-emerald-700",
    info: "text-on-surface-variant",
  };

  elements.formMessage.className = `min-h-6 text-sm font-medium ${tones[tone] ?? tones.info}`;
  elements.formMessage.textContent = message;
}

function validateDonationPayload(name, amount) {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const normalizedAmount = typeof amount === "string" ? amount.trim() : String(amount);
  const parsedAmount = Number(normalizedAmount);

  if (!trimmedName) {
    throw new Error("Ingresa tu nombre para registrar la donacion.");
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Ingresa un monto valido mayor a 0.");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new Error("Usa un monto con maximo dos decimales.");
  }

  return {
    name: trimmedName.slice(0, 80),
    amount: Number(parsedAmount.toFixed(2)),
  };
}

async function addDonation(name, amount) {
  if (!db) {
    throw new Error("Firebase no esta configurado.");
  }

  if (!state.adminGateUnlocked) {
    throw new Error("Primero valida tu clave privada de administrador.");
  }

  const payload = validateDonationPayload(name, amount);
  const donationRef = await addDoc(collection(db, "donations"), {
    name: payload.name,
    amount: payload.amount,
    enteredBy: state.adminAccessName,
    accessCodeHash: ADMIN_ACCESS_CODE_HASH,
    createdAt: serverTimestamp(),
  });

  await createAdminAuditLog("donation_created", payload.name, payload.amount);

  return { id: donationRef.id };
}

async function getExternalTeletonAmount() {
  if (!db) {
    return 0;
  }

  const syncSnapshot = await getDoc(doc(db, "campaign_sync", "global"));
  if (!syncSnapshot.exists()) {
    return 0;
  }

  return Number(syncSnapshot.get("externalTeletonAmount")) || 0;
}

async function getLocalDonationSummary() {
  if (!db) {
    return {
      totalAmount: 0,
      donationCount: 0,
    };
  }

  const donationsSnapshot = await getDocs(collection(db, "donations"));
  return donationsSnapshot.docs.reduce(
    (summary, item) => {
      summary.totalAmount += Number(item.data().amount) || 0;
      summary.donationCount += 1;
      return summary;
    },
    {
      totalAmount: 0,
      donationCount: 0,
    }
  );
}

async function getTotal() {
  if (!db) {
    return 0;
  }

  const [localSummary, externalAmount] = await Promise.all([
    getLocalDonationSummary(),
    getExternalTeletonAmount(),
  ]);
  return localSummary.totalAmount + externalAmount;
}

async function getTopDonors(topLimit = 10) {
  if (!db) {
    return [];
  }

  const donorsQuery = query(
    collection(db, "donor_totals"),
    orderBy("totalAmount", "desc"),
    limit(topLimit + 1)
  );
  const snapshot = await getDocs(donorsQuery);

  const donors = snapshot.docs.map((item) => ({
    id: item.id,
    displayName: displayName(item.data().displayName),
    totalAmount: Number(item.data().totalAmount) || 0,
    donationCount: Number(item.data().donationCount) || 0,
  }));

  state.generalDonations = summarizeGeneralDonations(donors);

  if (donors.length > 0) {
    return donors.filter((item) => !isAnonymousDonor(item.displayName)).slice(0, topLimit);
  }

  const donationsSnapshot = await getDocs(collection(db, "donations"));
  const donations = donationsSnapshot.docs.map((item) => ({
    name: displayName(item.data().name),
    amount: Number(item.data().amount) || 0,
  }));
  state.generalDonations = summarizeGeneralDonations(donations);
  return aggregateTopDonors(donations, topLimit);
}

async function getTopDonations(topLimit = 10) {
  if (!db) {
    return [];
  }

  const donationsQuery = query(
    collection(db, "donations"),
    orderBy("amount", "desc"),
    limit(topLimit)
  );
  const snapshot = await getDocs(donationsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    name: displayName(item.data().name),
    amount: Number(item.data().amount) || 0,
    createdAt: item.data().createdAt ?? null,
  }));
}

function unlockAdminGate(accessName) {
  state.adminGateUnlocked = true;
  state.adminAccessName = accessName;
  persistAdminGateState(true);
  persistAdminAccessName(accessName);
  updateAdminUi();
}

function lockAdminGate() {
  state.adminGateUnlocked = false;
  state.adminAccessName = "";
  persistAdminGateState(false);
  persistAdminAccessName("");
  updateAdminUi();
}

async function createAdminAuditLog(action, donationName = "", donationAmount = 0) {
  if (!db || !state.adminAccessName) {
    return;
  }

  try {
    await addDoc(collection(db, "admin_access_logs"), {
      accessName: state.adminAccessName,
      action,
      donationName: donationName.slice(0, 80),
      donationAmount: Number(donationAmount) || 0,
      accessCodeHash: ADMIN_ACCESS_CODE_HASH,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Admin audit log could not be stored.", error);
  }
}

async function saveExternalTeletonAmount(amount) {
  if (!db) {
    throw new Error("Firebase no esta configurado.");
  }

  if (!state.adminGateUnlocked) {
    throw new Error("Primero valida tu clave privada de administrador.");
  }

  const validatedAmount = validateExternalAmount(amount);
  await setDoc(
    doc(db, "campaign_sync", "global"),
    {
      externalTeletonAmount: validatedAmount,
      updatedBy: state.adminAccessName,
      updatedAt: serverTimestamp(),
      accessCodeHash: ADMIN_ACCESS_CODE_HASH,
      teletonPageUrl: TELETON_DONATION_URL,
    },
    { merge: true }
  );

  await createAdminAuditLog("teleton_amount_updated", "Teleton en linea", validatedAmount);
  return validatedAmount;
}

async function handleAdminCodeSubmit() {
  const accessName = normalizeAccessName(elements.accessNameInput.value);
  const normalizedCode = normalizeAccessCode(elements.codeInput.value);
  elements.accessNameInput.value = accessName;
  elements.codeInput.value = normalizedCode;

  if (!accessName || accessName.length < 2) {
    setCodeMessage("Ingresa el nombre de quien esta accediendo.", "error");
    return;
  }

  if (normalizedCode.length !== ADMIN_CODE_LENGTH) {
    setCodeMessage("Ingresa una clave numerica de 24 digitos.", "error");
    return;
  }

  elements.codeSubmitButton.disabled = true;
  elements.codeSubmitButton.textContent = "Validando...";

  try {
    const codeHash = await sha256(normalizedCode);

    if (codeHash !== ADMIN_ACCESS_CODE_HASH) {
      setCodeMessage("La clave no coincide.", "error");
      return;
    }

    unlockAdminGate(accessName);
    await createAdminAuditLog("access_granted");
    setCodeMessage("Clave validada. Acceso habilitado.", "success");
    setFormMessage("");
    showStatus(`Acceso admin habilitado para ${accessName}.`, "success");
  } catch (error) {
    console.error("Admin code validation failed.", error);
    setCodeMessage("No fue posible validar la clave en este navegador.", "error");
  } finally {
    elements.codeSubmitButton.disabled = false;
    elements.codeSubmitButton.textContent = "Validar clave";
  }
}

async function hydrateFallbackTotals() {
  const donationsSnapshot = await getDocs(collection(db, "donations"));
  const donations = donationsSnapshot.docs.map((item) => ({
    name: displayName(item.data().name),
    amount: Number(item.data().amount) || 0,
  }));
  state.localDonationTotal = donations.reduce((sum, item) => sum + item.amount, 0);
  state.localDonationCount = donations.length;
  syncProgressFromState();
  state.generalDonations = summarizeGeneralDonations(donations);

  if (!state.serverAggregateAvailable) {
    state.topDonors = aggregateTopDonors(donations);
    if (state.leaderboardView === "aggregate") {
      renderLeaderboard();
    }
  }
}

function subscribeToRealtimeUpdates() {
  const statsRef = doc(db, "stats", "global");
  const campaignSyncRef = doc(db, "campaign_sync", "global");
  const donationsCollectionRef = collection(db, "donations");
  const generalDonationsRef = doc(db, "donor_totals", "anonimo");
  const donorTotalsQuery = query(
    collection(db, "donor_totals"),
    orderBy("totalAmount", "desc"),
    limit(11)
  );
  const topDonationsQuery = query(
    donationsCollectionRef,
    orderBy("amount", "desc"),
    limit(10)
  );

  onSnapshot(
    statsRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        state.serverStatsAvailable = false;
        await hydrateFallbackTotals();
        return;
      }

      state.serverStatsAvailable = true;
      const data = snapshot.data();
      state.localDonationTotal = Number(data.totalAmount) || 0;
      state.localDonationCount = Number(data.donationCount) || 0;
      syncProgressFromState();
    },
    (error) => {
      console.error("Stats listener failed.", error);
      showStatus("No fue posible escuchar los cambios del total en tiempo real.", "error");
    }
  );

  onSnapshot(
    campaignSyncRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        state.externalTeletonAmount = 0;
        if (elements.teletonExternalAmount && !document.activeElement?.isSameNode(elements.teletonExternalAmount)) {
          elements.teletonExternalAmount.value = "0";
        }
        syncProgressFromState();
        return;
      }

      state.externalTeletonAmount = Number(snapshot.get("externalTeletonAmount")) || 0;
      if (elements.teletonExternalAmount && !document.activeElement?.isSameNode(elements.teletonExternalAmount)) {
        elements.teletonExternalAmount.value = state.externalTeletonAmount.toString();
      }
      syncProgressFromState();
    },
    (error) => {
      console.error("Campaign sync listener failed.", error);
      showStatus("No fue posible actualizar el monto digital de Teletón.", "error");
    }
  );

  onSnapshot(
    donationsCollectionRef,
    (snapshot) => {
      const allDonations = snapshot.docs.map((item) => ({
        id: item.id,
        name: displayName(item.data().name),
        amount: Number(item.data().amount) || 0,
        createdAt: item.data().createdAt ?? null,
      }));

      state.generalDonations = summarizeGeneralDonations(allDonations);

      if (!state.serverStatsAvailable) {
        state.localDonationTotal = allDonations.reduce((sum, item) => sum + item.amount, 0);
        state.localDonationCount = allDonations.length;
        syncProgressFromState();
      }

      if (!state.serverAggregateAvailable) {
        state.topDonors = aggregateTopDonors(allDonations);
        if (state.leaderboardView === "aggregate") {
          renderLeaderboard();
        }
      }
    },
    (error) => {
      console.error("Donations listener failed.", error);
      showStatus("No fue posible escuchar las donaciones en tiempo real.", "error");
    }
  );

  onSnapshot(
    generalDonationsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        if (state.serverAggregateAvailable) {
          state.generalDonations = {
            totalAmount: 0,
            donationCount: 0,
          };
          renderLeaderboard();
        }
        return;
      }

      state.generalDonations = {
        totalAmount: Number(snapshot.get("totalAmount")) || 0,
        donationCount: Number(snapshot.get("donationCount")) || 0,
      };

      if (state.leaderboardView === "aggregate") {
        renderLeaderboard();
      }
    },
    (error) => {
      console.error("General donations listener failed.", error);
    }
  );

  onSnapshot(
    donorTotalsQuery,
    (snapshot) => {
      state.serverAggregateAvailable = snapshot.docs.length > 0;
      const donorTotals = snapshot.docs.map((item) => ({
        id: item.id,
        displayName: displayName(item.data().displayName),
        totalAmount: Number(item.data().totalAmount) || 0,
        donationCount: Number(item.data().donationCount) || 0,
      }));

      if (state.serverAggregateAvailable) {
        state.generalDonations = summarizeGeneralDonations(donorTotals);
        state.topDonors = donorTotals
          .filter((item) => !isAnonymousDonor(item.displayName))
          .slice(0, 10);
      }

      if (state.leaderboardView === "aggregate") {
        renderLeaderboard();
      }
    },
    (error) => {
      console.error("Donor totals listener failed.", error);
      showStatus("No fue posible actualizar el ranking agregado.", "error");
    }
  );

  onSnapshot(
    topDonationsQuery,
    (snapshot) => {
      state.topDonations = snapshot.docs.map((item) => ({
        id: item.id,
        name: displayName(item.data().name),
        amount: Number(item.data().amount) || 0,
        createdAt: item.data().createdAt ?? null,
      }));

      if (!state.serverAggregateAvailable) {
        state.topDonors = aggregateTopDonors(state.topDonations);
      }

      if (state.leaderboardView === "individual") {
        renderLeaderboard();
      } else if (!state.serverAggregateAvailable) {
        renderLeaderboard();
      }
    },
    (error) => {
      console.error("Top donations listener failed.", error);
      showStatus("No fue posible actualizar la lista de donaciones top.", "error");
    }
  );
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

  elements.modalClose.addEventListener("click", (event) => {
    event.preventDefault();
    closeAdminModal();
  });
  elements.modalBackdrop.addEventListener("click", closeAdminModal);
  elements.modalPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  elements.donationNoticeClose.addEventListener("click", closeDonationNoticeModal);
  elements.donationNoticeCloseButton.addEventListener("click", closeDonationNoticeModal);
  elements.donationNoticeBackdrop.addEventListener("click", closeDonationNoticeModal);
  elements.donationNoticePanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.donationModal.getAttribute("aria-hidden") === "false") {
      closeAdminModal();
    }

    if (
      event.key === "Escape" &&
      elements.donationNoticeModal.getAttribute("aria-hidden") === "false"
    ) {
      closeDonationNoticeModal();
    }
  });

  elements.codeInput.addEventListener("input", () => {
    elements.codeInput.value = normalizeAccessCode(elements.codeInput.value);
    setCodeMessage("");
  });
  elements.accessNameInput.addEventListener("input", () => {
    elements.accessNameInput.value = normalizeAccessName(elements.accessNameInput.value);
    setCodeMessage("");
  });
  elements.accessNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdminCodeSubmit();
    }
  });
  elements.codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdminCodeSubmit();
    }
  });
  elements.codeSubmitButton.addEventListener("click", handleAdminCodeSubmit);
  elements.signOutButton.addEventListener("click", handleAccessReset);
  elements.teletonSyncButton.addEventListener("click", async () => {
    try {
      elements.teletonSyncButton.disabled = true;
      elements.teletonSyncButton.textContent = "Guardando...";
      const savedAmount = await saveExternalTeletonAmount(elements.teletonExternalAmount.value);
      elements.teletonExternalAmount.value = savedAmount.toString();
      setTeletonSyncMessage("Monto de Teletón actualizado correctamente.", "success");
      showStatus("La barra ya incorpora el monto digital de Teletón.", "success");
    } catch (error) {
      console.error("Unable to save Teletón amount.", error);
      setTeletonSyncMessage(error.message || "No fue posible guardar el monto de Teletón.", "error");
    } finally {
      elements.teletonSyncButton.disabled = false;
      elements.teletonSyncButton.textContent = "Guardar monto Teletón";
    }
  });

  elements.leaderboardToggle.addEventListener("click", () => {
    state.leaderboardView = state.leaderboardView === "aggregate" ? "individual" : "aggregate";
    syncLeaderboardView();
  });

  elements.donationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormMessage("");

    try {
      elements.submitButton.disabled = true;
      elements.submitButton.textContent = "Registrando...";
      await addDonation(elements.donationName.value, elements.donationAmount.value);
      setFormMessage("Donacion registrada con exito. Gracias por apoyar.", "success");
      showStatus("La donacion se registro y el tablero se actualizara en tiempo real.", "success");
      window.setTimeout(closeAdminModal, 900);
    } catch (error) {
      console.error("Unable to add donation.", error);
      setFormMessage(error.message || "No fue posible registrar la donacion.", "error");
    } finally {
      elements.submitButton.disabled = false;
      elements.submitButton.textContent = "Confirmar donacion";
    }
  });
}

function updateAdminUi() {
  if (state.adminGateUnlocked) {
    elements.accessNameInput.value = state.adminAccessName;
    elements.codePanel.classList.add("hidden");
    elements.authPanel.classList.remove("hidden");
    elements.teletonSyncPanel.classList.remove("hidden");
    elements.donationForm.classList.remove("hidden");
    elements.signOutButton.classList.remove("hidden");
    elements.authCopy.textContent = `Acceso autorizado para: ${state.adminAccessName}.`;
    return;
  }

  elements.donationForm.classList.add("hidden");
  elements.accessNameInput.value = state.adminAccessName;
  elements.codePanel.classList.remove("hidden");
  elements.authPanel.classList.add("hidden");
  elements.teletonSyncPanel.classList.add("hidden");
  elements.signOutButton.classList.add("hidden");
  elements.authCopy.textContent = "Ingresa tu nombre y la clave para habilitar el acceso.";
}

async function handleAccessReset() {
  lockAdminGate();
  closeAdminModal();
  showStatus("Acceso de administrador cerrado.", "info");
}

async function bootstrap() {
  bindUi();
  startCampaignCountdown();

  if (state.adminGateUnlocked && !state.adminAccessName) {
    lockAdminGate();
  }

  updateAdminUi();
  syncLeaderboardView();
  syncProgressFromState();
  elements.donationModal.hidden = true;
  elements.donationNoticeModal.hidden = true;

  if (!isFirebaseConfigured || !db) {
    showStatus(
      "Configura tus credenciales en public/firebase.js o define window.__RECICLANDO_GOLES_FIREBASE_CONFIG__ antes de usar la app.",
      "error"
    );
    return;
  }

  showStatus("Firebase conectado. Escuchando cambios en tiempo real...", "info");

  try {
    const [topDonors, topDonations, localSummary, externalTeletonAmount] = await Promise.all([
      getTopDonors(),
      getTopDonations(),
      getLocalDonationSummary(),
      getExternalTeletonAmount(),
    ]);
    state.topDonors = topDonors;
    state.topDonations = topDonations;
    state.localDonationTotal = localSummary.totalAmount;
    state.localDonationCount = localSummary.donationCount;
    state.externalTeletonAmount = externalTeletonAmount;
    if (elements.teletonExternalAmount) {
      elements.teletonExternalAmount.value = externalTeletonAmount.toString();
    }
    syncProgressFromState();
    renderLeaderboard();
    clearStatus();
  } catch (error) {
    console.error("Initial data load failed.", error);
    showStatus("No fue posible cargar el tablero inicial.", "error");
  }

  subscribeToRealtimeUpdates();
}

bootstrap();

export { addDonation, getTotal, getTopDonors, getTopDonations };
