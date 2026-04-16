import admin from "firebase-admin";

const TELETON_DONATION_URL =
  "https://www.alcanciadigitalteleton.mx/pagos/0/12689/reciclando-goles-toros-para-el-teletn.html";
const DOCUMENT_PATH = "campaign_sync/global";
const dryRun = process.argv.includes("--dry-run");
const serviceAccountRaw =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_RECICLANDO_GOLES ||
  "";

function parseTeletonAmount(html) {
  const amountMatch = html.match(/<span class="detallePesos">\$<\/span>\s*([\d,]+(?:\.\d{1,2})?)\s+recaudados/i);

  if (!amountMatch) {
    throw new Error("No se pudo extraer el monto de Teletón desde el HTML.");
  }

  const normalizedAmount = amountMatch[1].replace(/,/g, "");
  const parsedAmount = Number(normalizedAmount);

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error("El monto extraido de Teletón no es valido.");
  }

  return Number(parsedAmount.toFixed(2));
}

async function fetchTeletonAmount() {
  const response = await fetch(TELETON_DONATION_URL, {
    headers: {
      "user-agent": "reciclando-goles-github-sync/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`La pagina de Teletón respondió con ${response.status}.`);
  }

  const html = await response.text();
  return parseTeletonAmount(html);
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

async function main() {
  const externalTeletonAmount = await fetchTeletonAmount();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          externalTeletonAmount,
          teletonPageUrl: TELETON_DONATION_URL,
        },
        null,
        2
      )
    );
    return;
  }

  const db = initializeFirebase();
  await db.doc(DOCUMENT_PATH).set(
    {
      externalTeletonAmount,
      teletonPageUrl: TELETON_DONATION_URL,
      updatedBy: "system:github-actions",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSuccessfulSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      syncStatus: "success",
      syncProvider: "github-actions",
    },
    { merge: true }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "write",
        externalTeletonAmount,
        documentPath: DOCUMENT_PATH,
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
