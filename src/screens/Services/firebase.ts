import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 🔴 REEMPLAZA con tus credenciales de Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCqxediGYg6SfMn-xxXZEPgIHeV7XlBgNQ",
  authDomain: "medireminder-116be.firebaseapp.com",
  projectId: "medireminder-116be",
  storageBucket: "medireminder-116be.firebasestorage.app",
  messagingSenderId: "668792880976",
  appId: "1:668792880976:web:5b88a3a5e73568e4d0f655",
  measurementId: "G-M9GT7MWCFV"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
