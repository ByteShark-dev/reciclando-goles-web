import admin from "firebase-admin";

const LEGACY_CAMPAIGN_ID = process.env.RECICLANDO_GOLES_LEGACY_CAMPAIGN_ID || "legacy-2026-sem1";
const LEGACY_CAMPAIGN_NAME =
  process.env.RECICLANDO_GOLES_LEGACY_CAMPAIGN_NAME || "Reciclando Goles x Teleton 2026 Semestre 1";
const LEGACY_SEMESTER_LABEL =
  process.env.RECICLANDO_GOLES_LEGACY_SEMESTER_LABEL || "2026 Semestre 1";
const DEFAULT_LEGACY_GOAL_AMOUNT = 10000;
const DEFAULT_EXCLUDED_DONATION_IDS = ["DUytYMokCS9hKxPbDucI", "6tN4tqUDMQZoejigMeEO"];
const LEGACY_EXCLUDED_DONATION_IDS = new Set(
  (
    process.env.RECICLANDO_GOLES_LEGACY_EXCLUDED_DONATION_IDS ||
    DEFAULT_EXCLUDED_DONATION_IDS.join(",")
  )
    .split(",")
    .map((value) => String(value || "").trim())
    .filter(Boolean)
);
const LEGACY_END_AT = new Date("2026-05-11T23:59:00-06:00");
const LEGACY_CREATED_BY_UID = "system:migration";
const LEGACY_CREATED_BY_EMAIL = "legacy-migration@reciclandogoles.local";
const serviceAccountRaw =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_RECICLANDO_GOLES ||
  "";

function initializeFirebase() {
  if (!serviceAccountRaw) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON en el entorno.");
  }

  const serviceAccount = JSON.parse(serviceAccountRaw);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
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

function buildSummary(totals) {
  return {
    totalAmount: roundCurrency(totals.totalAmount),
    physicalAmount: roundCurrency(totals.physicalAmount),
    digitalAmount: roundCurrency(totals.digitalAmount),
    recyclingAmount: roundCurrency(totals.recyclingAmount),
    donationCount: Number(totals.donationCount) || 0,
  };
}

function buildDonorTotalsFromDonations(donations) {
  const donorMap = new Map();

  donations.forEach((donation) => {
    const displayName = String(donation.name || "").trim() || "Anonimo";
    const donorId = normalizeDonorId(displayName);
    const amount = roundCurrency(donation.amount);
    const createdAt = donation.createdAt || admin.firestore.Timestamp.fromDate(LEGACY_END_AT);
    const current = donorMap.get(donorId) || {
      displayName,
      totalAmount: 0,
      donationCount: 0,
      lastDonationAt: createdAt,
    };

    current.totalAmount = roundCurrency(current.totalAmount + amount);
    current.donationCount += 1;

    const currentDate = current.lastDonationAt?.toDate?.() || LEGACY_END_AT;
    const nextDate = createdAt?.toDate?.() || LEGACY_END_AT;
    if (nextDate.getTime() >= currentDate.getTime()) {
      current.lastDonationAt = createdAt;
    }

    donorMap.set(donorId, current);
  });

  return [...donorMap.entries()].map(([id, donor]) => ({ id, ...donor }));
}

async function main() {
  const db = initializeFirebase();
  const legacyCampaignRef = db.doc(`campaigns/${LEGACY_CAMPAIGN_ID}`);
  const donationsSnapshot = await db.collection("donations").get();
  const statsSnapshot = await db.doc("stats/global").get();
  const campaignSyncSnapshot = await db.doc("campaign_sync/global").get();

  const existingCampaignSnapshot = await legacyCampaignRef.get();
  if (existingCampaignSnapshot.exists) {
    throw new Error(
      `La campaña ${LEGACY_CAMPAIGN_ID} ya existe. Usa otro ID o elimina la colisión manualmente.`
    );
  }

  const donations = donationsSnapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
  const excludedDonations = donations.filter((donation) => LEGACY_EXCLUDED_DONATION_IDS.has(donation.id));
  const migratedDonations = donations.filter((donation) => !LEGACY_EXCLUDED_DONATION_IDS.has(donation.id));
  const donorTotals = buildDonorTotalsFromDonations(migratedDonations);

  const earliestDonationDate = migratedDonations
    .map((item) => item.createdAt?.toDate?.())
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const startAt = earliestDonationDate || new Date("2026-01-01T00:00:00-06:00");
  const legacyStats = statsSnapshot.exists ? statsSnapshot.data() : {};
  const legacySync = campaignSyncSnapshot.exists ? campaignSyncSnapshot.data() : {};
  const manualPhysicalAmount =
    migratedDonations.reduce((sum, donation) => sum + roundCurrency(donation.amount), 0) ||
    roundCurrency(legacyStats.totalAmount);
  const syncedDigitalAmount = roundCurrency(legacySync.externalTeletonAmount);
  const totalAmount = roundCurrency(manualPhysicalAmount + syncedDigitalAmount);
  const donationCount = migratedDonations.length || Number(legacyStats.donationCount) || 0;
  const goalAmount = roundCurrency(legacyStats.goalAmount || DEFAULT_LEGACY_GOAL_AMOUNT);

  const writer = db.bulkWriter();
  writer.set(
    legacyCampaignRef,
    {
      name: LEGACY_CAMPAIGN_NAME,
      semesterLabel: LEGACY_SEMESTER_LABEL,
      status: "closed",
      goalAmount,
      startAt: admin.firestore.Timestamp.fromDate(startAt),
      endAt: admin.firestore.Timestamp.fromDate(LEGACY_END_AT),
      closedAt: admin.firestore.Timestamp.fromDate(LEGACY_END_AT),
      teletonUrl: String(legacySync.teletonPageUrl || "").trim(),
      summary: buildSummary({
        totalAmount,
        physicalAmount: manualPhysicalAmount,
        digitalAmount: syncedDigitalAmount,
        recyclingAmount: 0,
        donationCount,
      }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: LEGACY_CREATED_BY_UID,
      createdByEmail: LEGACY_CREATED_BY_EMAIL,
    },
    { merge: true }
  );

  writer.set(
    db.doc(`campaigns/${LEGACY_CAMPAIGN_ID}/totals/global`),
    {
      physicalAmount: manualPhysicalAmount,
      recyclingAmount: 0,
      manualDigitalAmount: 0,
      syncedDigitalAmount,
      digitalAmount: syncedDigitalAmount,
      totalAmount,
      donationCount,
      syncStatus: legacySync.syncStatus || "success",
      syncSource: legacySync.syncProvider || "legacy-migration",
      syncError: legacySync.syncError || admin.firestore.FieldValue.delete(),
      teletonUrl: String(legacySync.teletonPageUrl || "").trim(),
      lastSuccessfulSyncAt:
        legacySync.lastSuccessfulSyncAt || admin.firestore.Timestamp.fromDate(LEGACY_END_AT),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  migratedDonations.forEach((donation) => {
    const name = String(donation.name || "").trim() || "Anonimo";
    const donorId = normalizeDonorId(name);
    writer.set(
      db.doc(`campaigns/${LEGACY_CAMPAIGN_ID}/donations/${donation.id}`),
      {
        name,
        donorId,
        amount: roundCurrency(donation.amount),
        sourceType: "physical",
        piggyBankId: null,
        enteredByUid: LEGACY_CREATED_BY_UID,
        enteredByEmail: LEGACY_CREATED_BY_EMAIL,
        createdAt: donation.createdAt || admin.firestore.Timestamp.fromDate(LEGACY_END_AT),
      },
      { merge: true }
    );
  });

  donorTotals.forEach((donor) => {
    writer.set(
      db.doc(`campaigns/${LEGACY_CAMPAIGN_ID}/donor_totals/${donor.id}`),
      {
        displayName: String(donor.displayName || donor.id || "Anonimo").trim() || "Anonimo",
        totalAmount: roundCurrency(donor.totalAmount),
        donationCount: Number(donor.donationCount) || 0,
        lastDonationAt:
          donor.lastDonationAt ||
          admin.firestore.Timestamp.fromDate(earliestDonationDate || LEGACY_END_AT),
      },
      { merge: true }
    );
  });

  writer.set(
    db.doc("settings/activeCampaign"),
    {
      campaignId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: LEGACY_CREATED_BY_UID,
      updatedByEmail: LEGACY_CREATED_BY_EMAIL,
    },
    { merge: true }
  );

  await writer.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        legacyCampaignId: LEGACY_CAMPAIGN_ID,
        donationCount,
        migratedDonorTotals: donorTotals.length,
        excludedDonationIds: excludedDonations.map((donation) => donation.id),
        excludedDonationTotal: excludedDonations.reduce(
          (sum, donation) => roundCurrency(sum + roundCurrency(donation.amount)),
          0
        ),
        totalAmount,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error.message,
      },
      null,
      2
    )
  );
  process.exit(1);
});
