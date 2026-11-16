// js/firebase-config.js
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Konfigurácia projektu AtelierInak (Auth + Firestore na bezplatnom Spark pláne)
const firebaseConfig = {
  apiKey: "AIzaSyC3UENytEXoSa-rnEVdXcv8PajTNM5hh2Y",
  authDomain: "atelierinak.firebaseapp.com",
  projectId: "atelierinak",
  storageBucket: "atelierinak.firebasestorage.app",
  messagingSenderId: "1067081841089"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = null;
