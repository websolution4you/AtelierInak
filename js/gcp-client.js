// js/gcp-client.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// TODO: TU DOPLŇTE SVOJE ÚDAJE Z FIREBASE CONSOLE (Project Settings -> General -> Your apps -> Web app)
const firebaseConfig = {
  apiKey: "AIzaSyDb04anqAtvSX0cyR1Vj2whBWdOVnftjWM",
  authDomain: "project-800f9b01-ef95-4b9e-853.firebaseapp.com",
  projectId: "project-800f9b01-ef95-4b9e-853",
  storageBucket: "project-800f9b01-ef95-4b9e-853.firebasestorage.app",
  messagingSenderId: "652999054235",
  appId: "1:652999054235:web:63d624bfac1a44ffd9c73e"
};

// Inicializácia Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// TODO: TU DOPLŇTE REÁLNU URL ADRESU VAŠEJ GOOGLE CLOUD FUNCTION PO JEJ NASADENÍ
// Napríklad: 'https://europe-west1-telio-project.cloudfunctions.net/api'
export const API_BASE = 'https://api-652999054235.europe-west1.run.app';



