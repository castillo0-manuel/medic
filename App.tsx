import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/screens/Navigation/AppNavigator';
import { useSettingsStore } from './src/screens/Store/settingsStore';
import {
  setupNotificationHandler,
  setupNotificationCategories,
  registerForPushNotifications,
  handleNotificationReceived,
  removePendingDose,
} from './src/screens/Services/notifications';

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

// Llamar ANTES de cualquier componente
setupNotificationHandler();

export default function App() {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const { isDarkMode } = useSettingsStore();

  useEffect(() => {
    registerForPushNotifications();
    setupNotificationCategories();

    // Notificación recibida con app ABIERTA → abrir AlarmScreen
    notificationListener.current = Notifications.addNotificationReceivedListener(
      async (notification) => {
        await handleNotificationReceived(notification);
        const data = notification.request.content.data as any;
        if (data?.medicationId && data?.type !== 'stock') {
          // Navegar a pantalla de alarma
          navigationRef.current?.navigate('Alarm', {
            medicationId: data.medicationId,
            medicationName: data.medicationName,
            gramaje: data.gramaje,
            emoji: data.emoji,
            color: data.color,
            photoUri: data.photoUri,
          });
        }
      }
    );

    // Usuario tocó la notificación o usó botón de acción
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data as any;
        const actionId = response.actionIdentifier;

        if (!data?.medicationId) return;

        if (actionId === 'CONFIRM') {
          // Confirmó desde la barra de notificaciones
          await removePendingDose(data.medicationId);
        } else if (actionId === 'SKIP') {
          // Omitió desde la barra de notificaciones
          await removePendingDose(data.medicationId);
        } else {
          // Tocó la notificación → abrir AlarmScreen
          navigationRef.current?.navigate('Alarm', {
            medicationId: data.medicationId,
            medicationName: data.medicationName,
            gramaje: data.gramaje,
            emoji: data.emoji,
            color: data.color,
            photoUri: data.photoUri,
          });
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
      <AppNavigator navigationRef={navigationRef} />
    </SafeAreaProvider>
  );
}