// js/firebase-config.js
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// 1. Auth konfigurácia - pôvodný projekt s existujúcim účtom klienta ako [DEFAULT] aplikácia
const authConfig = {
  apiKey: "AIzaSyDb04anqAtvSX0cyR1Vj2whBWdOVnftjWM",
  authDomain: "project-800f9b01-ef95-4b9e-853.firebaseapp.com",
  projectId: "project-800f9b01-ef95-4b9e-853",
  storageBucket: "project-800f9b01-ef95-4b9e-853.firebasestorage.app",
  messagingSenderId: "652999054235"
};

// 2. Databáza Firestore a Storage - bezplatný projekt AtelierInak
const dbConfig = {
  apiKey: "AIzaSyC3UENytEXoSa-rnEVdXcv8PajTNM5hh2Y",
  authDomain: "atelierinak.firebaseapp.com",
  projectId: "atelierinak",
  storageBucket: "atelierinak.firebasestorage.app",
  messagingSenderId: "1067081841089"
};

// Inicializácia: Auth na [DEFAULT] app kvôli 100% spoľahlivej IndexedDB persistencii
const allApps = getApps();
const authApp = allApps.length === 0 ? initializeApp(authConfig) : getApp();
const dbApp = allApps.some(a => a.name === "atelierinak") ? getApp("atelierinak") : initializeApp(dbConfig, "atelierinak");

export const auth = getAuth(authApp);
export const db = getFirestore(dbApp);
export const storage = getStorage(dbApp);
