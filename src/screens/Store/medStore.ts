import { create } from 'zustand';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, where, orderBy, Timestamp, increment,
} from 'firebase/firestore';
import { db } from '../Services/firebase';
import { useAuthStore } from './authStore';
import {
  scheduleMedicationNotification,
  cancelMedicationNotifications,
  removePendingDose,
  notifyLowStock,
  scheduleDailyStockCheck,
} from '../Services/notifications';

export interface Medication {
  id: string;
  userId: string;
  profileId: string;
  name: string;
  gramaje: string;
  intervalHours: number;
  durationDays: number;   // 0 = indefinido
  instructions: string;
  stock: number;
  stockAlert: number;
  emoji: string;
  color: string;
  notificationsEnabled: boolean;
  startDate: Date;
  createdAt: Date;
}

export interface DoseHistory {
  id: string;
  medicationId: string;
  userId: string;
  profileId: string;
  taken: boolean;
  scheduledAt: Date;
  takenAt?: Date;
}

interface MedState {
  medications: Medication[];
  history: DoseHistory[];
  loading: boolean;
  error: string | null;
  // profileId es REQUERIDO — nunca trae meds sin saber el perfil
  fetchMedications: (userId: string, profileId: string) => Promise<void>;
  addMedication: (med: Omit<Medication, 'id' | 'createdAt'>) => Promise<void>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  logDose: (medicationId: string, userId: string, profileId: string, taken: boolean) => Promise<void>;
  fetchHistory: (userId: string, profileId?: string) => Promise<void>;
  clearError: () => void;
}

export const MEDICATION_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#3949AB',
  '#1E88E5', '#00ACC1', '#00897B', '#43A047',
  '#F4511E', '#FB8C00',
];

export const MEDICATION_EMOJIS = [
  '💊', '💉', '🩺', '🌿', '⚕️', '🔴', '🟡', '🟢', '🔵', '🟣',
];

export const useMedStore = create<MedState>((set, get) => ({
  medications: [],
  history: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchMedications: async (userId, profileId) => {
    // Nunca hacer fetch sin profileId — evita mezclar perfiles
    if (!profileId) {
      set({ medications: [] });
      return;
    }

    set({ loading: true });
    try {
      const q = query(
        collection(db, 'medications'),
        where('userId', '==', userId),
        where('profileId', '==', profileId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const meds = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startDate: d.data().startDate?.toDate(),
        createdAt: d.data().createdAt?.toDate(),
      })) as Medication[];

      // Filtro extra en cliente por si acaso
      const filtered = meds.filter(m => m.profileId === profileId);
      set({ medications: filtered, loading: false });
    } catch (e) {
      set({ error: 'Error al cargar medicamentos', loading: false });
    }
  },

  addMedication: async (med) => {
    set({ loading: true });
    try {
      if (!med.profileId) {
        set({ error: 'No hay un perfil activo. Selecciona un perfil primero.', loading: false });
        return;
      }

      const docRef = await addDoc(collection(db, 'medications'), {
        ...med,
        profileId: med.profileId,
        startDate: Timestamp.fromDate(med.startDate),
        createdAt: Timestamp.fromDate(new Date()),
      });

      if (med.notificationsEnabled) {
        await scheduleMedicationNotification(
          docRef.id, med.name, med.gramaje,
          med.intervalHours, med.startDate
        );
      }

      // Incrementar contador permanente en Firestore
      await updateDoc(doc(db, 'users', med.userId), {
        medsEverAdded: increment(1),
      });

      // Actualizar contador en memoria para que la UI reaccione inmediatamente
      useAuthStore.getState().incrementMedsCounter();

      const newMed: Medication = { ...med, id: docRef.id, createdAt: new Date() };
      set(state => ({ medications: [newMed, ...state.medications], loading: false }));
    } catch (e: any) {
      console.error('Error al agregar medicamento:', e);
      set({ error: `Error: ${e?.message || 'No se pudo guardar'}`, loading: false });
    }
  },

  updateMedication: async (id, updates) => {
    set({ loading: true });
    try {
      await updateDoc(doc(db, 'medications', id), updates);
      const meds = get().medications.map(m => m.id === id ? { ...m, ...updates } : m);
      set({ medications: meds, loading: false });

      const updated = meds.find(m => m.id === id);
      if (updated) {
        await cancelMedicationNotifications(id);
        if (updated.notificationsEnabled) {
          await scheduleMedicationNotification(
            id, updated.name, updated.gramaje,
            updated.intervalHours, updated.startDate
          );
        }
      }
    } catch (e) {
      set({ error: 'Error al actualizar', loading: false });
    }
  },

  deleteMedication: async (id) => {
    set({ loading: true });
    try {
      await deleteDoc(doc(db, 'medications', id));
      await cancelMedicationNotifications(id);
      set(state => ({
        medications: state.medications.filter(m => m.id !== id),
        loading: false,
      }));
    } catch (e) {
      set({ error: 'Error al eliminar', loading: false });
    }
  },

  logDose: async (medicationId, userId, profileId, taken) => {
    try {
      const dose: Omit<DoseHistory, 'id'> = {
        medicationId, userId, profileId, taken,
        scheduledAt: new Date(),
        takenAt: taken ? new Date() : undefined,
      };
      await addDoc(collection(db, 'doseHistory'), {
        ...dose,
        scheduledAt: Timestamp.fromDate(dose.scheduledAt),
        takenAt: dose.takenAt ? Timestamp.fromDate(dose.takenAt) : null,
      });

      if (taken) {
        // Cancelar alarmas pendientes
        await removePendingDose(medicationId);

        // Descontar stock si el med tiene stock registrado
        const state = get();
        const med = state.medications.find(m => m.id === medicationId);
        if (med && med.stock > 0) {
          const newStock = med.stock - 1;
          const medRef = doc(db, 'medications', medicationId);
          await updateDoc(medRef, { stock: newStock });

          // Actualizar en memoria
          set(s => ({
            medications: s.medications.map(m =>
              m.id === medicationId ? { ...m, stock: newStock } : m
            ),
          }));

          // Notificar si bajó al límite de alerta o menos
          if (newStock <= med.stockAlert && newStock > 0) {
            await notifyLowStock(med.name, newStock);
          }

          // Reagendar chequeo diario con todos los meds en stock bajo
          const updatedMeds = get().medications;
          const lowStock = updatedMeds
            .filter(m => m.stock > 0 && m.stock <= m.stockAlert)
            .map(m => ({ name: m.name, stock: m.id === medicationId ? newStock : m.stock }));
          await scheduleDailyStockCheck(lowStock);
        }
      }

      set(state => ({ history: [{ ...dose, id: Date.now().toString() }, ...state.history] }));
    } catch (e) {
      console.error('Error logging dose', e);
    }
  },

  fetchHistory: async (userId, profileId) => {
    try {
      const q = profileId
        ? query(
            collection(db, 'doseHistory'),
            where('userId', '==', userId),
            where('profileId', '==', profileId),
            orderBy('scheduledAt', 'desc')
          )
        : query(
            collection(db, 'doseHistory'),
            where('userId', '==', userId),
            orderBy('scheduledAt', 'desc')
          );
      const snapshot = await getDocs(q);
      const hist = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        takenAt: d.data().takenAt?.toDate(),
      })) as DoseHistory[];
      // Filtro extra en cliente
      const filtered = profileId
        ? hist.filter(h => h.profileId === profileId)
        : hist;
      set({ history: filtered });
    } catch (e) {
      console.error('Error fetching history', e);
    }
  },
}));