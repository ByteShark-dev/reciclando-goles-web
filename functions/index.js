const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.firestore();
const REGION = "us-central1";
const DONATION_SOURCES = new Set(["physical", "digital", "recycling"]);

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

function toDisplayName(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed.slice(0, 80) : "Anonimo";
}

function createEmptyTotals() {
  return {
    physicalAmount: 0,
    recyclingAmount: 0,
    manualDigitalAmount: 0,
    syncedDigitalAmount: 0,
    digitalAmount: 0,
    totalAmount: 0,
    donationCount: 0,
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

function computeTotalsSnapshot(baseTotals = {}) {
  const physicalAmount = roundCurrency(baseTotals.physicalAmount);
  const recyclingAmount = roundCurrency(baseTotals.recyclingAmount);
  const manualDigitalAmount = roundCurrency(baseTotals.manualDigitalAmount);
  const syncedDigitalAmount = roundCurrency(baseTotals.syncedDigitalAmount);
  const digitalAmount = roundCurrency(manualDigitalAmount + syncedDigitalAmount);
  const totalAmount = roundCurrency(physicalAmount + recyclingAmount + digitalAmount);

  return {
    physicalAmount,
    recyclingAmount,
    manualDigitalAmount,
    syncedDigitalAmount,
    digitalAmount,
    totalAmount,
    donationCount: Number(baseTotals.donationCount) || 0,
  };
}

function parseTeletonAmount(html) {
  const amountMatch = String(html || "").match(
    /<span class="detallePesos">\$<\/span>\s*([\d,]+(?:\.\d{1,2})?)\s+recaudados/i
  );

  if (!amountMatch) {
    throw new Error("Teleton amount could not be parsed from the campaign page.");
  }

  const parsedAmount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error("Teleton amount is invalid after parsing.");
  }

  return roundCurrency(parsedAmount);
}

async function fetchTeletonCampaignAmount(teletonUrl) {
  const response = await fetch(teletonUrl, {
    headers: {
      "user-agent": "ReciclandoGolesCampaignSync/2.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Teleton page request failed with status ${response.status}.`);
  }

  return parseTeletonAmount(await response.text());
}

function getSettingsRef() {
  return db.doc("settings/activeCampaign");
}

function getCampaignRef(campaignId) {
  return db.doc(`campaigns/${campaignId}`);
}

function getCampaignTotalsRef(campaignId) {
  return db.doc(`campaigns/${campaignId}/totals/global`);
}

function getCampaignSubcollection(campaignId, name) {
  return db.collection(`campaigns/${campaignId}/${name}`);
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function requireString(value, fieldName, maxLength = 200) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }

  return normalized.slice(0, maxLength);
}

function optionalString(value, maxLength = 300) {
  return String(value || "").trim().slice(0, maxLength);
}

function requirePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a positive number.`);
  }

  return roundCurrency(parsed);
}

function parseDateInput(value, fieldName) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a valid date.`);
  }

  return admin.firestore.Timestamp.fromDate(parsedDate);
}

function validateUrl(value, fieldName, { required = false } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    if (required) {
      throw new HttpsError("invalid-argument", `${fieldName} is required.`);
    }

    return "";
  }

  try {
    const url = new URL(trimmed);
    return url.toString().slice(0, 500);
  } catch (error) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a valid URL.`);
  }
}

async function assertAdminRequest(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const roleSnapshot = await db.doc(`user_roles/${uid}`).get();
  if (!roleSnapshot.exists) {
    throw new HttpsError("permission-denied", "No admin role found for this user.");
  }

  const role = roleSnapshot.data() || {};
  if (role.role !== "admin" || role.enabled !== true) {
    throw new HttpsError("permission-denied", "This user cannot access admin actions.");
  }

  return {
    uid,
    email: request.auth.token?.email || role.email || "",
  };
}

async function assertAdminHttpRequest(request) {
  const authorizationHeader = String(request.get("authorization") || "");
  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Missing bearer token.");
  }

  const decodedToken = await admin.auth().verifyIdToken(authorizationHeader.slice(7));
  const roleSnapshot = await db.doc(`user_roles/${decodedToken.uid}`).get();
  if (!roleSnapshot.exists) {
    throw new HttpsError("permission-denied", "No admin role found for this user.");
  }

  const role = roleSnapshot.data() || {};
  if (role.role !== "admin" || role.enabled !== true) {
    throw new HttpsError("permission-denied", "This user cannot access admin actions.");
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || role.email || "",
  };
}

function parseCampaignPayload(rawData) {
  const data = asPlainObject(rawData);
  const name = requireString(data.name, "name", 120);
  const semesterLabel = requireString(data.semesterLabel, "semesterLabel", 80);
  const goalAmount = requirePositiveNumber(data.goalAmount, "goalAmount");
  const startAt = parseDateInput(data.startAt, "startAt");
  const endAt = parseDateInput(data.endAt, "endAt");
  const teletonUrl = validateUrl(data.teletonUrl, "teletonUrl");

  if (endAt.toMillis() <= startAt.toMillis()) {
    throw new HttpsError("invalid-argument", "endAt must be after startAt.");
  }

  return {
    name,
    semesterLabel,
    goalAmount,
    startAt,
    endAt,
    teletonUrl,
  };
}

async function getActiveCampaignContext() {
  const settingsSnapshot = await getSettingsRef().get();
  const activeCampaignId = settingsSnapshot.exists ? String(settingsSnapshot.get("campaignId") || "") : "";

  if (!activeCampaignId) {
    return null;
  }

  const campaignSnapshot = await getCampaignRef(activeCampaignId).get();
  if (!campaignSnapshot.exists) {
    return null;
  }

  return {
    campaignId: activeCampaignId,
    campaignSnapshot,
  };
}

async function markTeletonSyncError(campaignId, teletonUrl, source, error) {
  const totalsRef = getCampaignTotalsRef(campaignId);
  await totalsRef.set(
    {
      syncStatus: "error",
      syncError: String(error.message || error).slice(0, 500),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      teletonUrl,
      syncSource: source,
    },
    { merge: true }
  );
}

async function applyTeletonSyncToCampaign(campaignId, teletonUrl, source) {
  const externalTeletonAmount = await fetchTeletonCampaignAmount(teletonUrl);
  const campaignRef = getCampaignRef(campaignId);
  const totalsRef = getCampaignTotalsRef(campaignId);

  await db.runTransaction(async (transaction) => {
    const totalsSnapshot = await transaction.get(totalsRef);
    const currentTotals = computeTotalsSnapshot(totalsSnapshot.exists ? totalsSnapshot.data() : createEmptyTotals());
    const nextTotals = computeTotalsSnapshot({
      ...currentTotals,
      syncedDigitalAmount: externalTeletonAmount,
    });

    transaction.set(
      totalsRef,
      {
        ...nextTotals,
        syncStatus: "success",
        syncError: admin.firestore.FieldValue.delete(),
        syncSource: source,
        teletonUrl,
        lastSuccessfulSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      campaignRef,
      {
        summary: buildSummaryFromTotals(nextTotals),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  logger.info("Teleton campaign amount synced.", {
    campaignId,
    source,
    externalTeletonAmount,
  });

  return externalTeletonAmount;
}

async function recalculateCampaignTotalsInternal(campaignId) {
  const campaignRef = getCampaignRef(campaignId);
  const totalsRef = getCampaignTotalsRef(campaignId);
  const donationsSnapshot = await getCampaignSubcollection(campaignId, "donations").get();
  const donorTotalsSnapshot = await getCampaignSubcollection(campaignId, "donor_totals").get();
  const existingTotalsSnapshot = await totalsRef.get();
  const existingTotals = existingTotalsSnapshot.exists
    ? asPlainObject(existingTotalsSnapshot.data())
    : createEmptyTotals();

  const donorMap = new Map();
  const totals = {
    physicalAmount: 0,
    recyclingAmount: 0,
    manualDigitalAmount: 0,
    syncedDigitalAmount: roundCurrency(existingTotals.syncedDigitalAmount),
    donationCount: 0,
  };

  donationsSnapshot.forEach((documentSnapshot) => {
    const donation = asPlainObject(documentSnapshot.data());
    const amount = roundCurrency(donation.amount);
    const sourceType = DONATION_SOURCES.has(donation.sourceType) ? donation.sourceType : "physical";
    const displayName = toDisplayName(donation.name);
    const donorId = optionalString(donation.donorId, 120) || normalizeDonorId(displayName);
    const donorEntry = donorMap.get(donorId) || {
      displayName,
      totalAmount: 0,
      donationCount: 0,
      lastDonationAt: donation.createdAt || admin.firestore.Timestamp.now(),
    };

    donorEntry.displayName = displayName;
    donorEntry.totalAmount = roundCurrency(donorEntry.totalAmount + amount);
    donorEntry.donationCount += 1;
    donorEntry.lastDonationAt = donation.createdAt || donorEntry.lastDonationAt;
    donorMap.set(donorId, donorEntry);

    if (sourceType === "digital") {
      totals.manualDigitalAmount = roundCurrency(totals.manualDigitalAmount + amount);
    } else if (sourceType === "recycling") {
      totals.recyclingAmount = roundCurrency(totals.recyclingAmount + amount);
    } else {
      totals.physicalAmount = roundCurrency(totals.physicalAmount + amount);
    }

    totals.donationCount += 1;
  });

  const computedTotals = computeTotalsSnapshot(totals);
  const syncStatus = optionalString(existingTotals.syncStatus, 40) || "idle";
  const writer = db.bulkWriter();

  writer.set(
    totalsRef,
    {
      ...computedTotals,
      syncStatus,
      syncSource: optionalString(existingTotals.syncSource, 80),
      teletonUrl: optionalString(existingTotals.teletonUrl, 500),
      ...(existingTotals.lastSuccessfulSyncAt
        ? { lastSuccessfulSyncAt: existingTotals.lastSuccessfulSyncAt }
        : {}),
      ...(syncStatus === "error" && existingTotals.syncError
        ? { syncError: optionalString(existingTotals.syncError, 500) }
        : { syncError: admin.firestore.FieldValue.delete() }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  writer.set(
    campaignRef,
    {
      summary: buildSummaryFromTotals(computedTotals),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const activeDonorIds = new Set(donorMap.keys());
  donorTotalsSnapshot.forEach((documentSnapshot) => {
    if (!activeDonorIds.has(documentSnapshot.id)) {
      writer.delete(documentSnapshot.ref);
    }
  });

  donorMap.forEach((donorData, donorId) => {
    writer.set(
      db.doc(`campaigns/${campaignId}/donor_totals/${donorId}`),
      {
        displayName: donorData.displayName,
        totalAmount: donorData.totalAmount,
        donationCount: donorData.donationCount,
        lastDonationAt: donorData.lastDonationAt,
      },
      { merge: true }
    );
  });

  await writer.close();

  logger.info("Campaign totals recalculated.", {
    campaignId,
    donationCount: computedTotals.donationCount,
    totalAmount: computedTotals.totalAmount,
  });

  return computedTotals;
}

exports.onCampaignDonationCreate = onDocumentCreated(
  {
    document: "campaigns/{campaignId}/donations/{donationId}",
    region: REGION,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("Donation trigger fired without snapshot data.", { params: event.params });
      return;
    }

    const donation = asPlainObject(snapshot.data());
    const name = toDisplayName(donation.name);
    const amount = roundCurrency(donation.amount);
    const sourceType = DONATION_SOURCES.has(donation.sourceType) ? donation.sourceType : "";

    if (!sourceType || amount <= 0) {
      logger.error("Donation payload is invalid.", {
        campaignId: event.params.campaignId,
        donationId: event.params.donationId,
        donation,
      });
      return;
    }

    const donorId = optionalString(donation.donorId, 120) || normalizeDonorId(name);
    const campaignId = event.params.campaignId;
    const donorRef = db.doc(`campaigns/${campaignId}/donor_totals/${donorId}`);
    const totalsRef = getCampaignTotalsRef(campaignId);
    const campaignRef = getCampaignRef(campaignId);

    await db.runTransaction(async (transaction) => {
      const donorSnapshot = await transaction.get(donorRef);
      const totalsSnapshot = await transaction.get(totalsRef);
      const currentTotals = computeTotalsSnapshot(
        totalsSnapshot.exists ? totalsSnapshot.data() : createEmptyTotals()
      );

      const nextTotals = {
        ...currentTotals,
        donationCount: currentTotals.donationCount + 1,
      };

      if (sourceType === "digital") {
        nextTotals.manualDigitalAmount = roundCurrency(currentTotals.manualDigitalAmount + amount);
      } else if (sourceType === "recycling") {
        nextTotals.recyclingAmount = roundCurrency(currentTotals.recyclingAmount + amount);
      } else {
        nextTotals.physicalAmount = roundCurrency(currentTotals.physicalAmount + amount);
      }

      const computedTotals = computeTotalsSnapshot(nextTotals);
      const currentDonor = donorSnapshot.exists ? donorSnapshot.data() : {};

      transaction.set(
        donorRef,
        {
          displayName: name,
          totalAmount: roundCurrency((Number(currentDonor.totalAmount) || 0) + amount),
          donationCount: (Number(currentDonor.donationCount) || 0) + 1,
          lastDonationAt: donation.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        totalsRef,
        {
          ...computedTotals,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        campaignRef,
        {
          summary: buildSummaryFromTotals(computedTotals),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    logger.info("Donation aggregates updated.", {
      campaignId,
      donationId: event.params.donationId,
      donorId,
      amount,
      sourceType,
    });
  }
);

exports.adminCreateCampaign = onCall({ region: REGION }, async (request) => {
  const adminContext = await assertAdminRequest(request);
  const payload = parseCampaignPayload(request.data);
  const campaignRef = db.collection("campaigns").doc();
  const totalsRef = campaignRef.collection("totals").doc("global");

  await campaignRef.set({
    name: payload.name,
    semesterLabel: payload.semesterLabel,
    status: "draft",
    goalAmount: payload.goalAmount,
    startAt: payload.startAt,
    endAt: payload.endAt,
    closedAt: null,
    teletonUrl: payload.teletonUrl,
    summary: buildSummaryFromTotals(createEmptyTotals()),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByUid: adminContext.uid,
    createdByEmail: adminContext.email,
  });

  await totalsRef.set({
    ...createEmptyTotals(),
    syncStatus: "idle",
    syncSource: "",
    teletonUrl: payload.teletonUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    campaignId: campaignRef.id,
  };
});

exports.adminSetActiveCampaign = onCall({ region: REGION }, async (request) => {
  const adminContext = await assertAdminRequest(request);
  const campaignId = requireString(asPlainObject(request.data).campaignId, "campaignId", 120);
  const settingsRef = getSettingsRef();
  const targetCampaignRef = getCampaignRef(campaignId);

  await db.runTransaction(async (transaction) => {
    const [settingsSnapshot, targetCampaignSnapshot] = await Promise.all([
      transaction.get(settingsRef),
      transaction.get(targetCampaignRef),
    ]);

    if (!targetCampaignSnapshot.exists) {
      throw new HttpsError("not-found", "Campaign not found.");
    }

    const targetCampaign = asPlainObject(targetCampaignSnapshot.data());
    if (targetCampaign.status === "closed") {
      throw new HttpsError("failed-precondition", "Closed campaigns cannot be activated.");
    }

    const previousActiveCampaignId = settingsSnapshot.exists
      ? optionalString(settingsSnapshot.get("campaignId"), 120)
      : "";

    if (previousActiveCampaignId && previousActiveCampaignId !== campaignId) {
      const previousCampaignRef = getCampaignRef(previousActiveCampaignId);
      const previousCampaignSnapshot = await transaction.get(previousCampaignRef);
      if (previousCampaignSnapshot.exists && previousCampaignSnapshot.get("status") !== "closed") {
        transaction.set(
          previousCampaignRef,
          {
            status: "draft",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    transaction.set(
      targetCampaignRef,
      {
        status: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      settingsRef,
      {
        campaignId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: adminContext.uid,
        updatedByEmail: adminContext.email,
      },
      { merge: true }
    );
  });

  return {
    ok: true,
    campaignId,
  };
});

exports.adminCloseCampaign = onCall({ region: REGION }, async (request) => {
  const adminContext = await assertAdminRequest(request);
  const campaignId = requireString(asPlainObject(request.data).campaignId, "campaignId", 120);
  const computedTotals = await recalculateCampaignTotalsInternal(campaignId);
  const campaignRef = getCampaignRef(campaignId);
  const settingsRef = getSettingsRef();

  await db.runTransaction(async (transaction) => {
    const [campaignSnapshot, settingsSnapshot] = await Promise.all([
      transaction.get(campaignRef),
      transaction.get(settingsRef),
    ]);

    if (!campaignSnapshot.exists) {
      throw new HttpsError("not-found", "Campaign not found.");
    }

    transaction.set(
      campaignRef,
      {
        status: "closed",
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        summary: buildSummaryFromTotals(computedTotals),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (settingsSnapshot.exists && settingsSnapshot.get("campaignId") === campaignId) {
      transaction.set(
        settingsRef,
        {
          campaignId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: adminContext.uid,
          updatedByEmail: adminContext.email,
        },
        { merge: true }
      );
    }
  });

  return {
    ok: true,
    campaignId,
    summary: buildSummaryFromTotals(computedTotals),
  };
});

exports.adminRecalculateCampaignTotals = onCall({ region: REGION }, async (request) => {
  await assertAdminRequest(request);
  const data = asPlainObject(request.data);
  const requestedCampaignId = optionalString(data.campaignId, 120);
  let campaignId = requestedCampaignId;

  if (!campaignId) {
    const activeCampaign = await getActiveCampaignContext();
    if (!activeCampaign) {
      throw new HttpsError("failed-precondition", "There is no active campaign to recalculate.");
    }

    campaignId = activeCampaign.campaignId;
  }

  const computedTotals = await recalculateCampaignTotalsInternal(campaignId);
  return {
    ok: true,
    campaignId,
    totals: computedTotals,
  };
});

exports.adminSyncActiveCampaignTeleton = onCall({ region: REGION }, async (request) => {
  await assertAdminRequest(request);
  const activeCampaign = await getActiveCampaignContext();

  if (!activeCampaign) {
    throw new HttpsError("failed-precondition", "There is no active campaign.");
  }

  const teletonUrl = optionalString(activeCampaign.campaignSnapshot.get("teletonUrl"), 500);
  if (!teletonUrl) {
    throw new HttpsError("failed-precondition", "The active campaign has no Teleton URL configured.");
  }

  try {
    const externalTeletonAmount = await applyTeletonSyncToCampaign(
      activeCampaign.campaignId,
      teletonUrl,
      "system:callable"
    );

    return {
      ok: true,
      campaignId: activeCampaign.campaignId,
      externalTeletonAmount,
      teletonUrl,
    };
  } catch (error) {
    await markTeletonSyncError(activeCampaign.campaignId, teletonUrl, "system:callable", error);
    throw new HttpsError("internal", error.message || "Teleton sync failed.");
  }
});

exports.syncTeletonCampaignAmount = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Mexico_City",
    region: REGION,
  },
  async () => {
    const activeCampaign = await getActiveCampaignContext();
    if (!activeCampaign) {
      logger.info("Teleton sync skipped because there is no active campaign.");
      return;
    }

    const teletonUrl = optionalString(activeCampaign.campaignSnapshot.get("teletonUrl"), 500);
    if (!teletonUrl) {
      logger.info("Teleton sync skipped because the active campaign has no URL.", {
        campaignId: activeCampaign.campaignId,
      });
      return;
    }

    try {
      await applyTeletonSyncToCampaign(activeCampaign.campaignId, teletonUrl, "system:scheduler");
    } catch (error) {
      logger.error("Scheduled Teleton sync failed.", error);
      await markTeletonSyncError(activeCampaign.campaignId, teletonUrl, "system:scheduler", error);
    }
  }
);

exports.syncTeletonCampaignAmountHttp = onRequest({ cors: true, region: REGION }, async (request, response) => {
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  if (request.method !== "POST" && request.method !== "GET") {
    response.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  try {
    await assertAdminHttpRequest(request);
  } catch (error) {
    response.status(error.code === "permission-denied" ? 403 : 401).json({
      ok: false,
      error: error.message,
    });
    return;
  }

  const activeCampaign = await getActiveCampaignContext();
  if (!activeCampaign) {
    response.status(200).json({ ok: true, skipped: true, reason: "no-active-campaign" });
    return;
  }

  const teletonUrl = optionalString(activeCampaign.campaignSnapshot.get("teletonUrl"), 500);
  if (!teletonUrl) {
    response.status(200).json({ ok: true, skipped: true, reason: "no-teleton-url" });
    return;
  }

  try {
    const externalTeletonAmount = await applyTeletonSyncToCampaign(
      activeCampaign.campaignId,
      teletonUrl,
      "system:http"
    );

    response.status(200).json({
      ok: true,
      campaignId: activeCampaign.campaignId,
      externalTeletonAmount,
      teletonUrl,
    });
  } catch (error) {
    await markTeletonSyncError(activeCampaign.campaignId, teletonUrl, "system:http", error);
    response.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

exports.createPayment = onRequest({ cors: true, region: REGION }, async (request, response) => {
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  response.status(501).json({
    error: "MercadoPago is not enabled in this release.",
    nextStep: "Add MercadoPago credentials and replace this placeholder handler.",
  });
});
