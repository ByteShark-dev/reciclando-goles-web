import admin from "firebase-admin";

const dryRun = process.argv.includes("--dry-run");
const serviceAccountRaw =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_RECICLANDO_GOLES ||
  "";

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function parseTeletonAmount(html) {
  const amountMatch = String(html || "").match(
    /<span class="detallePesos">\$<\/span>\s*([\d,]+(?:\.\d{1,2})?)\s+recaudados/i
  );

  if (!amountMatch) {
    throw new Error("No se pudo extraer el monto de Teleton desde el HTML.");
  }

  const parsedAmount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error("El monto extraido de Teleton no es valido.");
  }

  return roundCurrency(parsedAmount);
}

async function fetchTeletonAmount(teletonUrl) {
  const response = await fetch(teletonUrl, {
    headers: {
      "user-agent": "reciclando-goles-github-sync/2.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`La pagina de Teleton respondio con ${response.status}.`);
  }

  return parseTeletonAmount(await response.text());
}

function initializeFirebase() {
  if (!serviceAccountRaw) {
    throw new Error(
      "Falta FIREBASE_SERVICE_ACCOUNT_JSON en el entorno. Configuralo como GitHub Secret."
    );
  }

  const serviceAccount = JSON.parse(serviceAccountRaw);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
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

function buildSummaryFromTotals(totals) {
  return {
    totalAmount: roundCurrency(totals.totalAmount),
    physicalAmount: roundCurrency(totals.physicalAmount),
    digitalAmount: roundCurrency(totals.digitalAmount),
    recyclingAmount: roundCurrency(totals.recyclingAmount),
    donationCount: Number(totals.donationCount) || 0,
  };
}

async function main() {
  const db = initializeFirebase();
  const activeCampaignSnapshot = await db.doc("settings/activeCampaign").get();
  const activeCampaignId = activeCampaignSnapshot.exists
    ? String(activeCampaignSnapshot.get("campaignId") || "")
    : "";

  if (!activeCampaignId) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "no-active-campaign",
        },
        null,
        2
      )
    );
    return;
  }

  const campaignRef = db.doc(`campaigns/${activeCampaignId}`);
  const campaignSnapshot = await campaignRef.get();
  if (!campaignSnapshot.exists) {
    throw new Error(`La campaña activa ${activeCampaignId} no existe.`);
  }

  const teletonUrl = String(campaignSnapshot.get("teletonUrl") || "").trim();
  if (!teletonUrl) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "no-teleton-url",
          campaignId: activeCampaignId,
        },
        null,
        2
      )
    );
    return;
  }

  const externalTeletonAmount = await fetchTeletonAmount(teletonUrl);
  const totalsRef = db.doc(`campaigns/${activeCampaignId}/totals/global`);
  const totalsSnapshot = await totalsRef.get();
  const currentTotals = computeTotalsSnapshot(totalsSnapshot.exists ? totalsSnapshot.data() : {});
  const nextTotals = computeTotalsSnapshot({
    ...currentTotals,
    syncedDigitalAmount: externalTeletonAmount,
  });

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          campaignId: activeCampaignId,
          externalTeletonAmount,
          teletonUrl,
          totals: nextTotals,
        },
        null,
        2
      )
    );
    return;
  }

  const batch = db.batch();
  batch.set(
    totalsRef,
    {
      ...nextTotals,
      syncStatus: "success",
      syncError: admin.firestore.FieldValue.delete(),
      syncSource: "system:github-actions",
      teletonUrl,
      lastSuccessfulSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    campaignRef,
    {
      summary: buildSummaryFromTotals(nextTotals),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "write",
        campaignId: activeCampaignId,
        externalTeletonAmount,
        teletonUrl,
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
