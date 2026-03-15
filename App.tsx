import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/screens/Navigation/AppNavigator';
import { useSettingsStore } from './src/screens/Store/settingsStore';
import {
  setupNotificationHandler,
  registerForPushNotifications,
  handleNotificationReceived,
  removePendingDose,
} from './src/screens/Services/notifications';

// Llamar ANTES de cualquier componente
setupNotificationHandler();

export default function App() {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const { isDarkMode } = useSettingsStore();

  useEffect(() => {
    registerForPushNotifications();

    // Notificación recibida con app ABIERTA → activar sistema de alarma
    notificationListener.current = Notifications.addNotificationReceivedListener(
      async (notification) => {
        await handleNotificationReceived(notification);
      }
    );

    // Usuario tocó la notificación → marcar como confirmado (cancela alarmas)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data as any;
        if (data?.medicationId) {
          // Cancelar alarmas pendientes de este medicamento
          await removePendingDose(data.medicationId);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}