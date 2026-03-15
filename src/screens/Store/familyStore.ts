import { create } from 'zustand';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, where, Timestamp, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '../Services/firebase';
import { useAuthStore } from './authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_PROFILE_KEY = 'medireminder_active_profile';

export interface FamilyProfile {
  id: string;
  userId: string;
  name: string;
  relation: string;
  emoji: string;
  color: string;
  photoUri?: string;
  isMain: boolean;
  gender: 'male' | 'female' | 'other';
  createdAt: Date;
}

export const PROFILE_RELATIONS = [
  'Yo', 'Pareja', 'Mamá', 'Papá', 'Hijo/a',
  'Abuelo/a', 'Hermano/a', 'Otro',
];

export const PROFILE_EMOJIS = [
  '👤', '👨', '👩', '👦', '👧', '👴', '👵', '👶',
];

export const PROFILE_COLORS = [
  '#2E7D32', '#1565C0', '#AD1457', '#E65100',
  '#6A1B9A', '#00838F', '#558B2F', '#4E342E',
];

interface FamilyState {
  profiles: FamilyProfile[];
  activeProfileId: string | null;
  loading: boolean;
  error: string | null;
  fetchProfiles: (userId: string) => Promise<void>;
  addProfile: (profile: Omit<FamilyProfile, 'id' | 'createdAt'>) => Promise<void>;
  updateProfile: (id: string, updates: Partial<FamilyProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setActiveProfile: (id: string) => void;
  migrateLegacyMedications: (userId: string, mainProfileId: string) => Promise<void>;
  clearError: () => void;
  loadCachedProfile: () => Promise<void>;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadCachedProfile: async () => {
    try {
      const cached = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
      if (cached) {
        const { activeProfileId, profiles } = JSON.parse(cached);
        set({ activeProfileId, profiles: profiles || [] });
      }
    } catch {}
  },

  fetchProfiles: async (userId) => {
    set({ loading: true });
    try {
      const q = query(
        collection(db, 'familyProfiles'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const profiles = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      })) as FamilyProfile[];

      profiles.sort((a, b) => (a.isMain ? -1 : 1));

      const mainProfile = profiles.find(p => p.isMain) || profiles[0];
      const currentActive = get().activeProfileId;
      const stillExists = profiles.some(p => p.id === currentActive);
      const newActiveId = (currentActive && stillExists)
        ? currentActive
        : (mainProfile?.id || null);

      set({ profiles, loading: false, activeProfileId: newActiveId });
      AsyncStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify({ activeProfileId: newActiveId, profiles })).catch(() => {});

      if (mainProfile) {
        get().migrateLegacyMedications(userId, mainProfile.id);
      }
    } catch (e) {
      set({ error: 'Error al cargar perfiles', loading: false });
    }
  },

  addProfile: async (profile) => {
    set({ loading: true });
    try {
      const docRef = await addDoc(collection(db, 'familyProfiles'), {
        ...profile,
        createdAt: Timestamp.fromDate(new Date()),
      });

      // Incrementar contador permanente
      await updateDoc(doc(db, 'users', profile.userId), {
        profilesEverAdded: increment(1),
      });

      // Actualizar contador en memoria para que la UI reaccione inmediatamente
      useAuthStore.getState().incrementProfilesCounter();

      const newProfile: FamilyProfile = {
        ...profile,
        id: docRef.id,
        createdAt: new Date(),
      };
      set(state => ({ profiles: [...state.profiles, newProfile], loading: false }));
    } catch (e) {
      set({ error: 'Error al agregar perfil', loading: false });
    }
  },

  updateProfile: async (id, updates) => {
    set({ loading: true });
    try {
      await updateDoc(doc(db, 'familyProfiles', id), updates);
      set(state => ({
        profiles: state.profiles.map(p => p.id === id ? { ...p, ...updates } : p),
        loading: false,
      }));
    } catch (e) {
      set({ error: 'Error al actualizar perfil', loading: false });
    }
  },

  deleteProfile: async (id) => {
    set({ loading: true });
    try {
      await deleteDoc(doc(db, 'familyProfiles', id));
      const remaining = get().profiles.filter(p => p.id !== id);
      set({
        profiles: remaining,
        activeProfileId: remaining[0]?.id || null,
        loading: false,
      });
    } catch (e) {
      set({ error: 'Error al eliminar perfil', loading: false });
    }
  },

  setActiveProfile: (id) => {
    set({ activeProfileId: id });
    const { profiles } = get();
    AsyncStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify({ activeProfileId: id, profiles })).catch(() => {});
  },

  migrateLegacyMedications: async (userId, mainProfileId) => {
    try {
      // Traer TODOS los meds del usuario para detectar los que no tienen profileId
      const q = query(
        collection(db, 'medications'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      // Filtrar en cliente: los que no tienen profileId o lo tienen vacío
      const legacy = snapshot.docs.filter(d => {
        const data = d.data();
        return !data.profileId || data.profileId === '';
      });

      if (legacy.length === 0) return;

      const batch = writeBatch(db);
      legacy.forEach(d => {
        batch.update(doc(db, 'medications', d.id), { profileId: mainProfileId });
      });
      await batch.commit();
      console.log(`Migrados ${legacy.length} medicamentos al perfil principal`);
    } catch (e) {
      console.error('Error migrando medicamentos:', e);
    }
  },
}));