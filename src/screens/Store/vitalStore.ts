import { create } from 'zustand';
import {
  collection, addDoc, deleteDoc,
  doc, getDocs, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../Services/firebase';

export type VitalType = 'blood_pressure' | 'glucose' | 'weight' | 'heart_rate' | 'temperature' | 'oxygen';

export interface VitalRecord {
  id: string;
  userId: string;
  profileId: string;
  type: VitalType;
  // Valores según tipo
  value: number;          // glucosa, peso, FC, temp, oxígeno
  systolic?: number;      // presión sistólica
  diastolic?: number;     // presión diastólica
  unit: string;
  notes: string;
  recordedAt: Date;
}

export const VITAL_CONFIG: Record<VitalType, {
  label: string;
  emoji: string;
  color: string;
  unit: string;
  fields: 'single' | 'blood_pressure';
  normalRange: { min: number; max: number; label: string };
  placeholder: string;
}> = {
  blood_pressure: {
    label: 'Presión arterial',
    emoji: '🩺',
    color: '#C62828',
    unit: 'mmHg',
    fields: 'blood_pressure',
    normalRange: { min: 90, max: 120, label: 'Normal: 90-120 / 60-80' },
    placeholder: '120',
  },
  glucose: {
    label: 'Glucosa',
    emoji: '🩸',
    color: '#E65100',
    unit: 'mg/dL',
    fields: 'single',
    normalRange: { min: 70, max: 100, label: 'Normal en ayunas: 70-100' },
    placeholder: '90',
  },
  weight: {
    label: 'Peso',
    emoji: '⚖️',
    color: '#1565C0',
    unit: 'kg',
    fields: 'single',
    normalRange: { min: 40, max: 150, label: 'Registra tu peso' },
    placeholder: '70',
  },
  heart_rate: {
    label: 'Frecuencia cardíaca',
    emoji: '❤️',
    color: '#AD1457',
    unit: 'bpm',
    fields: 'single',
    normalRange: { min: 60, max: 100, label: 'Normal: 60-100 bpm' },
    placeholder: '75',
  },
  temperature: {
    label: 'Temperatura',
    emoji: '🌡️',
    color: '#F57C00',
    unit: '°C',
    fields: 'single',
    normalRange: { min: 36, max: 37.5, label: 'Normal: 36-37.5°C' },
    placeholder: '36.5',
  },
  oxygen: {
    label: 'Saturación O₂',
    emoji: '💨',
    color: '#1976D2',
    unit: '%',
    fields: 'single',
    normalRange: { min: 95, max: 100, label: 'Normal: 95-100%' },
    placeholder: '98',
  },
};

interface VitalState {
  records: VitalRecord[];
  loading: boolean;
  error: string | null;
  fetchRecords: (userId: string, profileId: string) => Promise<void>;
  addRecord: (record: Omit<VitalRecord, 'id'>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useVitalStore = create<VitalState>((set, get) => ({
  records: [],
  loading: false,
  error: null,

  fetchRecords: async (userId, profileId) => {
    if (!profileId) { set({ records: [] }); return; }
    set({ loading: true });
    try {
      const snap = await getDocs(
        query(
          collection(db, 'vitalRecords'),
          where('userId', '==', userId),
          where('profileId', '==', profileId),
          orderBy('recordedAt', 'desc'),
        )
      );
      const records: VitalRecord[] = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          recordedAt: data.recordedAt?.toDate?.() || new Date(data.recordedAt),
        } as VitalRecord;
      });
      set({ records, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Error al cargar registros', loading: false });
    }
  },

  addRecord: async (record) => {
    set({ loading: true });
    try {
      const docRef = await addDoc(collection(db, 'vitalRecords'), {
        ...record,
        recordedAt: Timestamp.fromDate(record.recordedAt),
      });
      const newRecord: VitalRecord = { ...record, id: docRef.id };
      set(state => ({ records: [newRecord, ...state.records], loading: false }));
    } catch (e: any) {
      set({ error: e?.message || 'Error al guardar', loading: false });
    }
  },

  deleteRecord: async (id) => {
    try {
      await deleteDoc(doc(db, 'vitalRecords', id));
      set(state => ({ records: state.records.filter(r => r.id !== id) }));
    } catch (e: any) {
      set({ error: e?.message || 'Error al eliminar' });
    }
  },

  clearError: () => set({ error: null }),
}));
