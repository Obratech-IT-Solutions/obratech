import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export const db = getFirestore(firebaseApp);

export const auth = getAuth(firebaseApp);

void isSupported().then((supported) => {
  if (supported) {
    getAnalytics(firebaseApp);
  }
});
