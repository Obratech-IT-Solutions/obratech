import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKQJ0uLe_tncYytwxotSPrd0JgZ-bwH-0",
  authDomain: "obratech-9b6d5.firebaseapp.com",
  projectId: "obratech-9b6d5",
  storageBucket: "obratech-9b6d5.firebasestorage.app",
  messagingSenderId: "1006651440111",
  appId: "1:1006651440111:web:33b5e97114c5e0259dd41a",
  measurementId: "G-BP08VQQPKE",
};

export const firebaseApp = initializeApp(firebaseConfig);

/** Long-polling helps some networks / ad blockers that break WebChannel to Firestore. */
let db: Firestore;
try {
  db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(firebaseApp);
}
export { db };

export const auth = getAuth(firebaseApp);

let analyticsInstance: Analytics | null = null;

/** Web-only; returns null in unsupported / blocked (e.g. ad blocker) environments. */
export function getOrInitAnalytics(): Analytics | null {
  if (typeof window === "undefined") return null;
  if (analyticsInstance) return analyticsInstance;
  try {
    analyticsInstance = getAnalytics(firebaseApp);
    return analyticsInstance;
  } catch {
    return null;
  }
}

void isSupported().then((supported) => {
  if (supported) getOrInitAnalytics();
});
