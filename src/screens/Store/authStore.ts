import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  updateProfile,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, getDoc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from '../Services/firebase';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoUri?: string;
  isPremium: boolean;
  createdAt: Date;
  medsEverAdded: number;
  profilesEverAdded: number;
}

interface AuthState {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setUserData: (data: UserData | null) => void;
  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  fetchUserData: (uid: string) => Promise<void>;
  incrementMedsCounter: () => void;
  incrementProfilesCounter: () => void;
  updateDisplayName: (name: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePhotoUri: (uri: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userData: null,
  loading: false,
  error: null,

  setUser: (user) => set({ user }),
  setUserData: (userData) => set({ userData }),
  updateDisplayName: async (name) => {
    const { user, userData } = get();
    if (!user || !userData) return;
    set({ loading: true });
    try {
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, 'users', user.uid), { displayName: name });
      set({ userData: { ...userData, displayName: name }, loading: false });
    } catch (e: any) {
      set({ error: 'No se pudo actualizar el nombre', loading: false });
    }
  },

  sendPasswordReset: async (email) => {
    set({ loading: true });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ loading: false });
    } catch (e: any) {
      set({ error: 'No se pudo enviar el correo', loading: false });
    }
  },

  updatePhotoUri: async (uri) => {
    const { user, userData } = get();
    if (!user || !userData) return;
    set({ loading: true });
    try {
      await updateDoc(doc(db, 'users', user.uid), { photoUri: uri });
      set({ userData: { ...userData, photoUri: uri }, loading: false });
    } catch (e: any) {
      set({ error: 'No se pudo actualizar la foto', loading: false });
    }
  },

  clearError: () => set({ error: null }),

  register: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });

      const userData: UserData = {
        uid: user.uid,
        email: user.email!,
        displayName: name,
        isPremium: false,
        createdAt: new Date(),
        medsEverAdded: 0,
        profilesEverAdded: 1, // el perfil principal ya cuenta como 1
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // Crear perfil principal automáticamente al registrarse
      await addDoc(collection(db, 'familyProfiles'), {
        userId: user.uid,
        name: name,
        relation: 'Yo',
        emoji: '👤',
        color: '#2E7D32',
        photoUri: '',
        isMain: true,
        createdAt: Timestamp.fromDate(new Date()),
      });

      set({ user, userData, loading: false });
    } catch (error: any) {
      set({ error: getErrorMessage(error.code), loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await get().fetchUserData(user.uid);
      set({ user, loading: false });
    } catch (error: any) {
      set({ error: getErrorMessage(error.code), loading: false });
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, userData: null });
  },

  deleteAccount: async () => {
    const { user } = get();
    if (!user) return;
    set({ loading: true });
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      set({ user: null, userData: null, loading: false });
    } catch (error: any) {
      set({ error: getErrorMessage(error.code), loading: false });
    }
  },

  incrementMedsCounter: () => {
    const { userData } = get();
    if (userData) {
      set({ userData: { ...userData, medsEverAdded: (userData.medsEverAdded ?? 0) + 1 } });
    }
  },

  incrementProfilesCounter: () => {
    const { userData } = get();
    if (userData) {
      set({ userData: { ...userData, profilesEverAdded: (userData.profilesEverAdded ?? 1) + 1 } });
    }
  },

  fetchUserData: async (uid) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Si el usuario no tiene los contadores (cuenta vieja), inicializarlos en Firestore
      const needsUpdate = data.medsEverAdded === undefined || data.profilesEverAdded === undefined;
      if (needsUpdate) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(docRef, {
          medsEverAdded: data.medsEverAdded ?? 0,
          profilesEverAdded: data.profilesEverAdded ?? 1,
        });
        data.medsEverAdded = data.medsEverAdded ?? 0;
        data.profilesEverAdded = data.profilesEverAdded ?? 1;
      }
      set({ userData: data as UserData });
    }
  },
}));

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Este correo ya está registrado',
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/user-not-found': 'No existe una cuenta con este correo',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
    'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
    'auth/invalid-credential': 'Correo o contraseña incorrectos',
  };
  return messages[code] || 'Ocurrió un error. Intenta de nuevo';
}