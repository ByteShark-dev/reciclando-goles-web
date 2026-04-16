import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAnalytics,
  isSupported as analyticsSupported,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const adminEmail = "tiburonangel0@gmail.com";
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAYpd28K3BvpA7kVuTq5o8-7Pdm1gRuUus",
  authDomain: "reciclando-goles.firebaseapp.com",
  projectId: "reciclando-goles",
  storageBucket: "reciclando-goles.firebasestorage.app",
  messagingSenderId: "122329485463",
  appId: "1:122329485463:web:54cc15cda39ff109ecd9d2",
  measurementId: "G-JFJV07HMHX",
};

const firebaseConfig =
  globalThis.__RECICLANDO_GOLES_FIREBASE_CONFIG__ ?? defaultFirebaseConfig;

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const isFirebaseConfigured = requiredKeys.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === "string" && value.trim() !== "";
});

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
let analytics = null;

if (db && ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)) {
  connectFirestoreEmulator(db, "127.0.0.1", 8088);
}

if (app) {
  analyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn("Firebase Analytics could not be initialized.", error);
    });
}

export { adminEmail, analytics, app, auth, db, firebaseConfig, isFirebaseConfigured };
