import { create } from 'zustand';
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, getDocs, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../Services/firebase';

export type FlowLevel = 'light' | 'medium' | 'heavy';
export type Symptom = 'cramps' | 'headache' | 'bloating' | 'mood_swings' | 'fatigue' | 'acne' | 'tender_breasts' | 'nausea';

export const SYMPTOM_CONFIG: Record<Symptom, { label: string; emoji: string }> = {
  cramps:         { label: 'Cólicos',       emoji: '😣' },
  headache:       { label: 'Dolor de cabeza', emoji: '🤕' },
  bloating:       { label: 'Hinchazón',      emoji: '🫃' },
  mood_swings:    { label: 'Cambios de humor', emoji: '😤' },
  fatigue:        { label: 'Fatiga',          emoji: '😴' },
  acne:           { label: 'Acné',            emoji: '😖' },
  tender_breasts: { label: 'Sensibilidad',    emoji: '💗' },
  nausea:         { label: 'Náuseas',         emoji: '🤢' },
};

export interface CycleRecord {
  id: string;
  userId: string;
  profileId: string;
  startDate: Date;
  endDate?: Date;        // undefined = período en curso
  cycleLength?: number;  // días hasta el siguiente inicio
  periodLength?: number; // duración en días
  symptoms: Symptom[];
  flow: FlowLevel;
  notes: string;
}

export interface CyclePrediction {
  nextPeriodStart: Date;
  nextPeriodEnd: Date;
  ovulationDate: Date;
  fertilityWindowStart: Date;
  fertilityWindowEnd: Date;
  avgCycleLength: number;
  avgPeriodLength: number;
}

// ── Lógica de predicción ─────────────────────────────────────────
export function predictNextCycle(records: CycleRecord[]): CyclePrediction | null {
  if (records.length === 0) return null;

  const completed = records.filter(r => r.endDate).slice(0, 6);
  const latest = records[0];

  // Promedios — usa 28/5 como default si no hay suficientes datos
  let avgCycleLength = 28;
  let avgPeriodLength = 5;

  // Con 1+ registro completado podemos calcular duración del período
  if (completed.length >= 1) {
    const periodLengths = completed
      .map(r => r.periodLength)
      .filter((l): l is number => l !== undefined && l > 0);
    if (periodLengths.length > 0) {
      avgPeriodLength = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
    }
  }

  // Con 2+ registros podemos calcular longitud del ciclo real
  if (completed.length >= 2) {
    const cycleLengths = completed
      .map(r => r.cycleLength)
      .filter((l): l is number => l !== undefined && l > 0);
    if (cycleLengths.length > 0) {
      avgCycleLength = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
    }
  } else if (latest.cycleLength && latest.cycleLength > 0) {
    // Con 1 registro que ya tiene cycleLength calculado
    avgCycleLength = latest.cycleLength;
  }

  // Calcular desde el último inicio
  const lastStart = new Date(latest.startDate);
  const nextPeriodStart = new Date(lastStart);
  nextPeriodStart.setDate(nextPeriodStart.getDate() + avgCycleLength);

  // avgPeriodLength - 1 porque el día de inicio ya cuenta como día 1
  const nextPeriodEnd = new Date(nextPeriodStart);
  nextPeriodEnd.setDate(nextPeriodEnd.getDate() + Math.max(avgPeriodLength - 1, 4));

  // Ovulación ≈ 14 días antes del próximo período
  const ovulationDate = new Date(nextPeriodStart);
  ovulationDate.setDate(ovulationDate.getDate() - 14);

  // Ventana fértil: 5 días antes de ovulación + día de ovulación
  const fertilityWindowStart = new Date(ovulationDate);
  fertilityWindowStart.setDate(fertilityWindowStart.getDate() - 5);
  const fertilityWindowEnd = new Date(ovulationDate);
  fertilityWindowEnd.setDate(fertilityWindowEnd.getDate() + 1);

  return {
    nextPeriodStart,
    nextPeriodEnd,
    ovulationDate,
    fertilityWindowStart,
    fertilityWindowEnd,
    avgCycleLength,
    avgPeriodLength,
  };
}

// ── Helpers de fecha ─────────────────────────────────────────────
// isPremium controla si se muestran fertilidad y ovulación
export function getDayStatus(date: Date, records: CycleRecord[], prediction: CyclePrediction | null, isPremium = false): DayStatus {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  // 1. Período real registrado — siempre visible
  for (const r of records) {
    const start = new Date(r.startDate);
    start.setHours(0, 0, 0, 0);
    const end = r.endDate ? new Date(r.endDate) : new Date(start);
    if (!r.endDate) end.setDate(end.getDate() + (r.periodLength || 5));
    end.setHours(0, 0, 0, 0);
    if (d >= start && d <= end) return 'period';
  }

  if (!prediction) return 'normal';

  const nextStart = new Date(prediction.nextPeriodStart);
  nextStart.setHours(0, 0, 0, 0);
  const nextEnd = new Date(prediction.nextPeriodEnd);
  nextEnd.setHours(0, 0, 0, 0);

  // 2. Período predicho — visible para todos (gratis y premium)
  if (d >= nextStart && d <= nextEnd) return 'predicted_period';

  // 3. Fertilidad y ovulación — solo Premium
  if (isPremium) {
    const fertStart = new Date(prediction.fertilityWindowStart);
    fertStart.setHours(0, 0, 0, 0);
    const fertEnd = new Date(prediction.fertilityWindowEnd);
    fertEnd.setHours(0, 0, 0, 0);
    const ovulation = new Date(prediction.ovulationDate);
    ovulation.setHours(0, 0, 0, 0);

    if (d.getTime() === ovulation.getTime()) return 'ovulation';
    if (d >= fertStart && d <= fertEnd) return 'fertile';
  }

  return 'normal';
}

export type DayStatus = 'period' | 'fertile' | 'ovulation' | 'predicted_period' | 'normal';

export const DAY_STATUS_CONFIG: Record<DayStatus, { color: string; label: string }> = {
  period:           { color: '#E53935', label: 'Período' },
  fertile:          { color: '#43A047', label: 'Fértil' },
  ovulation:        { color: '#8E24AA', label: 'Ovulación' },
  predicted_period: { color: '#EF9A9A', label: 'Período estimado' },
  normal:           { color: 'transparent', label: '' },
};

// ── Store ────────────────────────────────────────────────────────
interface CycleState {
  records: CycleRecord[];
  loading: boolean;
  error: string | null;
  fetchRecords: (userId: string, profileId: string) => Promise<void>;
  startPeriod: (userId: string, profileId: string, flow: FlowLevel, notes: string) => Promise<void>;
  endPeriod: (recordId: string, endDate: Date) => Promise<void>;
  addSymptoms: (recordId: string, symptoms: Symptom[]) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useCycleStore = create<CycleState>((set, get) => ({
  records: [],
  loading: false,
  error: null,

  fetchRecords: async (userId, profileId) => {
    if (!profileId) { set({ records: [] }); return; }
    set({ loading: true });
    try {
      const snap = await getDocs(query(
        collection(db, 'cycleRecords'),
        where('userId', '==', userId),
        where('profileId', '==', profileId),
        orderBy('startDate', 'desc'),
      ));
      const records: CycleRecord[] = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          startDate: data.startDate?.toDate?.() || new Date(data.startDate),
          endDate: data.endDate?.toDate?.() || undefined,
        } as CycleRecord;
      });
      set({ records, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Error al cargar', loading: false });
    }
  },

  startPeriod: async (userId, profileId, flow, notes) => {
    set({ loading: true });
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      // Calcular cycleLength del registro anterior
      const records = get().records;
      if (records.length > 0 && records[0].startDate) {
        const prevStart = new Date(records[0].startDate);
        const diffDays = Math.round((startDate.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          await updateDoc(doc(db, 'cycleRecords', records[0].id), { cycleLength: diffDays });
          set(state => ({
            records: state.records.map((r, i) => i === 0 ? { ...r, cycleLength: diffDays } : r),
          }));
        }
      }

      const newRecord: Omit<CycleRecord, 'id'> = {
        userId, profileId, startDate, flow, notes, symptoms: [],
      };
      const ref = await addDoc(collection(db, 'cycleRecords'), {
        ...newRecord,
        startDate: Timestamp.fromDate(startDate),
      });
      set(state => ({ records: [{ ...newRecord, id: ref.id }, ...state.records], loading: false }));
    } catch (e: any) {
      set({ error: e?.message || 'Error al registrar', loading: false });
    }
  },

  endPeriod: async (recordId, endDate) => {
    try {
      const records = get().records;
      const record = records.find(r => r.id === recordId);
      if (!record) return;
      const periodLength = Math.round(
        (endDate.getTime() - new Date(record.startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      await updateDoc(doc(db, 'cycleRecords', recordId), {
        endDate: Timestamp.fromDate(endDate),
        periodLength,
      });
      set(state => ({
        records: state.records.map(r =>
          r.id === recordId ? { ...r, endDate, periodLength } : r
        ),
      }));
    } catch (e: any) {
      set(state => ({ ...state, error: e?.message || 'Error al actualizar' }));
    }
  },

  addSymptoms: async (recordId, symptoms) => {
    try {
      await updateDoc(doc(db, 'cycleRecords', recordId), { symptoms });
      set(state => ({
        records: state.records.map(r => r.id === recordId ? { ...r, symptoms } : r),
      }));
    } catch (e: any) {
      set(state => ({ ...state, error: e?.message }));
    }
  },

  deleteRecord: async (id) => {
    try {
      await deleteDoc(doc(db, 'cycleRecords', id));
      set(state => ({ records: state.records.filter(r => r.id !== id) }));
    } catch (e: any) {
      set(state => ({ ...state, error: e?.message }));
    }
  },

  clearError: () => set({ error: null }),
}));