import admin from "firebase-admin";

const email = String(process.env.RECICLANDO_GOLES_ADMIN_EMAIL || "").trim();
const password = String(process.env.RECICLANDO_GOLES_ADMIN_PASSWORD || "").trim();
const displayName = String(process.env.RECICLANDO_GOLES_ADMIN_DISPLAY_NAME || "Reciclando Goles Admin").trim();
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
}

async function main() {
  if (!email || !password) {
    throw new Error(
      "Define RECICLANDO_GOLES_ADMIN_EMAIL y RECICLANDO_GOLES_ADMIN_PASSWORD antes de ejecutar el script."
    );
  }

  initializeFirebase();

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
    userRecord = await admin.auth().updateUser(userRecord.uid, {
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }

    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await admin
    .firestore()
    .doc(`user_roles/${userRecord.uid}`)
    .set(
      {
        role: "admin",
        enabled: true,
        email,
        displayName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  console.log(
    JSON.stringify(
      {
        ok: true,
        uid: userRecord.uid,
        email,
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
