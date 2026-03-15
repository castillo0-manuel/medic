import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
});

export const db = getFirestore(app);
export default app;