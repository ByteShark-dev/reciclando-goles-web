const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.firestore();
const INITIAL_GOAL_AMOUNT = 10000;
const GOAL_STEP_AMOUNT = 5000;
const TELETON_DONATION_URL =
  "https://www.alcanciadigitalteleton.mx/pagos/0/12689/reciclando-goles-toros-para-el-teletn.html";
const CAMPAIGN_SYNC_REF = db.doc("campaign_sync/global");

function normalizeName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "anonimo";
}

function getCurrentGoalAmount(totalAmount) {
  const safeTotal = Number(totalAmount) || 0;

  if (safeTotal < INITIAL_GOAL_AMOUNT) {
    return INITIAL_GOAL_AMOUNT;
  }

  const completedGoals = 1 + Math.floor((safeTotal - INITIAL_GOAL_AMOUNT) / GOAL_STEP_AMOUNT);
  return INITIAL_GOAL_AMOUNT + completedGoals * GOAL_STEP_AMOUNT;
}

function parseTeletonAmount(html) {
  const amountMatch = html.match(/<span class="detallePesos">\$<\/span>\s*([\d,]+(?:\.\d{1,2})?)\s+recaudados/i);

  if (!amountMatch) {
    throw new Error("Teleton amount could not be parsed from the campaign page.");
  }

  const normalizedAmount = amountMatch[1].replace(/,/g, "");
  const parsedAmount = Number(normalizedAmount);

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error("Teleton amount is invalid after parsing.");
  }

  return Number(parsedAmount.toFixed(2));
}

async function fetchTeletonCampaignAmount() {
  const response = await fetch(TELETON_DONATION_URL, {
    headers: {
      "user-agent": "ReciclandoGolesTeletonSync/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Teleton page request failed with status ${response.status}.`);
  }

  const html = await response.text();
  return parseTeletonAmount(html);
}

async function syncTeletonCampaignAmount(source) {
  const externalTeletonAmount = await fetchTeletonCampaignAmount();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await CAMPAIGN_SYNC_REF.set(
    {
      externalTeletonAmount,
      teletonPageUrl: TELETON_DONATION_URL,
      updatedBy: source,
      updatedAt: now,
      lastSuccessfulSyncAt: now,
      syncStatus: "success",
    },
    { merge: true }
  );

  logger.info("Teleton campaign amount synced.", {
    source,
    externalTeletonAmount,
  });

  return externalTeletonAmount;
}

exports.onDonationCreate = onDocumentCreated("donations/{donationId}", async (event) => {
  const snapshot = event.data;

  if (!snapshot) {
    logger.warn("Donation trigger fired without snapshot data.", { params: event.params });
    return;
  }

  const donation = snapshot.data();
  const name = typeof donation.name === "string" ? donation.name.trim() : "";
  const amount = Number(donation.amount);

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    logger.error("Donation payload is invalid.", {
      donationId: event.params.donationId,
      donation,
    });
    return;
  }

  const normalizedName = normalizeName(name);
  const statsRef = db.doc("stats/global");
  const donorRef = db.doc(`donor_totals/${normalizedName}`);
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    const statsSnapshot = await transaction.get(statsRef);
    const donorSnapshot = await transaction.get(donorRef);

    const currentTotal = statsSnapshot.exists ? Number(statsSnapshot.get("totalAmount")) || 0 : 0;
    const currentDonationCount = statsSnapshot.exists
      ? Number(statsSnapshot.get("donationCount")) || 0
      : 0;
    const currentDonorTotal = donorSnapshot.exists ? Number(donorSnapshot.get("totalAmount")) || 0 : 0;
    const currentDonorCount = donorSnapshot.exists
      ? Number(donorSnapshot.get("donationCount")) || 0
      : 0;

    const nextTotal = currentTotal + amount;

    transaction.set(
      statsRef,
      {
        totalAmount: nextTotal,
        donationCount: currentDonationCount + 1,
        goalAmount: getCurrentGoalAmount(nextTotal),
        updatedAt: now,
      },
      { merge: true }
    );

    transaction.set(
      donorRef,
      {
        displayName: name,
        totalAmount: currentDonorTotal + amount,
        donationCount: currentDonorCount + 1,
        lastDonationAt: now,
      },
      { merge: true }
    );
  });

  logger.info("Donation aggregates updated.", {
    donationId: event.params.donationId,
    normalizedName,
    amount,
  });
});

exports.syncTeletonCampaignAmount = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Mexico_City",
    region: "us-central1",
  },
  async () => {
    try {
      await syncTeletonCampaignAmount("system:scheduler");
    } catch (error) {
      logger.error("Scheduled Teletón sync failed.", error);
      await CAMPAIGN_SYNC_REF.set(
        {
          teletonPageUrl: TELETON_DONATION_URL,
          updatedBy: "system:scheduler",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          syncStatus: "error",
          syncError: error.message,
        },
        { merge: true }
      );
    }
  }
);

exports.syncTeletonCampaignAmountHttp = onRequest({ cors: true, region: "us-central1" }, async (request, response) => {
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  if (request.method !== "POST" && request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const externalTeletonAmount = await syncTeletonCampaignAmount("system:http");
    response.status(200).json({
      ok: true,
      externalTeletonAmount,
      teletonPageUrl: TELETON_DONATION_URL,
    });
  } catch (error) {
    logger.error("Manual Teletón sync failed.", error);
    await CAMPAIGN_SYNC_REF.set(
      {
        teletonPageUrl: TELETON_DONATION_URL,
        updatedBy: "system:http",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        syncStatus: "error",
        syncError: error.message,
      },
      { merge: true }
    );
    response.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

exports.createPayment = onRequest({ cors: true }, async (request, response) => {
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  response.status(501).json({
    error: "MercadoPago is not enabled in this release.",
    nextStep: "Add MercadoPago credentials and replace this placeholder handler.",
  });
});
