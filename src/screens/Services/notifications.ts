import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'pending_doses';
const MAX_REPEATS = 6;
const REPEAT_SECONDS = 300; // 5 minutos

// ── Tipos ────────────────────────────────────────────────────────
interface PendingDose {
  medicationId: string;
  medicationName: string;
  gramaje: string;
  emoji?: string;
  color?: string;
  photoUri?: string;
}

// ── Handler (debe estar fuera de componentes) ────────────────────
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ── Categorías de notificación (botones de acción) ───────────────
export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
    {
      identifier: 'CONFIRM',
      buttonTitle: '✅ Confirmar',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'SKIP',
      buttonTitle: '⏭️ Omitir',
      options: { isDestructive: true, isAuthenticationRequired: false },
    },
  ]);
  await Notifications.setNotificationCategoryAsync('MEDICATION_ALARM', [
    {
      identifier: 'CONFIRM',
      buttonTitle: '✅ Confirmar',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'SKIP',
      buttonTitle: '⏭️ Omitir',
      options: { isDestructive: true, isAuthenticationRequired: false },
    },
  ]);
}

// ── Canales Android ──────────────────────────────────────────────
async function setupAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('medicamentos', {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
  });
  await Notifications.setNotificationChannelAsync('alarma', {
    name: 'Alarma Medicamento',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#F44336',
    bypassDnd: true,
  });
}

// ── Permisos ─────────────────────────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  await setupAndroidChannels();
  return 'granted';
}

// ── Pending doses (AsyncStorage) ─────────────────────────────────
async function getPending(): Promise<PendingDose[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function savePending(doses: PendingDose[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(doses));
}

async function addPending(
  medicationId: string, medicationName: string, gramaje: string,
  emoji?: string, color?: string, photoUri?: string
) {
  const list = await getPending();
  if (list.some(p => p.medicationId === medicationId)) return;
  list.push({ medicationId, medicationName, gramaje, emoji, color, photoUri });
  await savePending(list);
}

export async function removePendingDose(medicationId: string): Promise<void> {
  const list = await getPending();
  await savePending(list.filter(p => p.medicationId !== medicationId));
  await cancelAlarmNotifications(medicationId);
}

// ── Programar recordatorio principal ─────────────────────────────
export async function scheduleMedicationNotification(
  medicationId: string,
  medicationName: string,
  gramaje: string,
  intervalHours: number,
  _startDate: Date,
  emoji?: string,
  color?: string,
  photoUri?: string,
): Promise<void> {
  await cancelMedicationNotifications(medicationId);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${emoji || '💊'} Hora de tu medicamento`,
      body: `Tomar ${medicationName} ${gramaje}`,
      data: { medicationId, medicationName, gramaje, type: 'reminder', emoji, color, photoUri },
      sound: true,
      categoryIdentifier: 'MEDICATION_REMINDER',
      ...(Platform.OS === 'android' ? { channelId: 'medicamentos' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalHours * 3600,
      repeats: true,
    },
  });
}

// ── Programar alarma de repetición ───────────────────────────────
export async function scheduleAlarmRepeat(
  medicationId: string,
  medicationName: string,
  gramaje: string,
  repeatNum: number,
  emoji?: string,
  color?: string,
  photoUri?: string,
): Promise<void> {
  if (repeatNum >= MAX_REPEATS) {
    await removePendingDose(medicationId);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ Pendiente (${repeatNum + 1}/${MAX_REPEATS})`,
      body: `Sin confirmar: ${medicationName} ${gramaje}`,
      data: { medicationId, medicationName, gramaje, type: 'alarm', repeatNum, emoji, color, photoUri },
      sound: true,
      categoryIdentifier: 'MEDICATION_ALARM',
      ...(Platform.OS === 'android' ? { channelId: 'alarma' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: REPEAT_SECONDS,
      repeats: false,
    },
  });
}

// ── Manejar notificación recibida ─────────────────────────────────
export async function handleNotificationReceived(
  notification: Notifications.Notification
): Promise<void> {
  const data = notification.request.content.data as Record<string, any>;
  if (!data?.medicationId) return;

  const { medicationId, medicationName, gramaje, type, repeatNum } = data;

  const { emoji, color, photoUri } = data;

  if (type === 'reminder') {
    await addPending(medicationId, medicationName, gramaje, emoji, color, photoUri);
    await scheduleAlarmRepeat(medicationId, medicationName, gramaje, 0, emoji, color, photoUri);
  } else if (type === 'alarm') {
    const list = await getPending();
    if (list.some(p => p.medicationId === medicationId)) {
      await scheduleAlarmRepeat(medicationId, medicationName, gramaje, (repeatNum ?? 0) + 1, emoji, color, photoUri);
    }
  }
}

// ── Cancelar alarmas de un medicamento ───────────────────────────
async function cancelAlarmNotifications(medicationId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const d = n.content.data as Record<string, any>;
    if (d?.medicationId === medicationId && d?.type === 'alarm') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ── Cancelar todas las notificaciones de un medicamento ──────────
export async function cancelMedicationNotifications(medicationId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const d = n.content.data as Record<string, any>;
    if (d?.medicationId === medicationId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await removePendingDose(medicationId);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(PENDING_KEY);
}

// ── Notificación de stock bajo ────────────────────────────────────
export async function notifyLowStock(medName: string, stock: number, unit: string = 'unidades'): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Stock bajo',
      body: `${medName} tiene solo ${stock} ${unit} restantes. ¡Es momento de reabastecer!`,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'medicamentos' } : {}),
    },
    trigger: null, // inmediata
  });
}

// Notificación diaria a las 9am si hay stock bajo
export async function scheduleDailyStockCheck(lowStockMeds: { name: string; stock: number }[]): Promise<void> {
  // Cancela la anterior si existe
  await Notifications.cancelScheduledNotificationAsync('daily-stock-check').catch(() => {});

  if (lowStockMeds.length === 0) return;

  const names = lowStockMeds.map(m => `${m.name} (${m.stock})`).join(', ');
  const body = lowStockMeds.length === 1
    ? `${lowStockMeds[0].name} tiene solo ${lowStockMeds[0].stock} unidades`
    : `${lowStockMeds.length} medicamentos con stock bajo: ${names}`;

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-stock-check',
    content: {
      title: '💊 Revisa tu inventario',
      body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'medicamentos' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}