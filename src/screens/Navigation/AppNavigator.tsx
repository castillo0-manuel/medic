import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from '../Services/firebase';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { useMedStore } from '../Store/medStore';
import { lightTheme, darkTheme } from '../Theme/colors';

import LoginScreen from '../Auth/LoginScreen';
import RegisterScreen from '../Auth/RegisterScreen';
import HomeScreen from '../Home/HomeScreen';
import MedListScreen from '../Medications/MedListScreen';
import AddMedScreen from '../Medications/AddMedScreen';
import HistoryScreen from '../History/HistoryScreen';
import SettingsScreen from '../Settings/SettingsScreen';
import SubscriptionScreen from '../Settings/SubscriptionScreen';
import FamilyScreen from '../Family/FamilyScreen';
import AddProfileScreen from '../Family/AddProfileScreen';
import OnboardingScreen, { ONBOARDING_KEY } from '../Onboarding/OnboardingScreen';
import EditProfileScreen from '../Settings/EditProfileScreen';
import ExportHistoryScreen from '../Settings/ExportHistoryScreen';
import VitalsScreen from '../Vitals/VitalsScreen';
import AddVitalScreen from '../Vitals/AddVitalScreen';
import ChatbotScreen from '../Chatbot/ChatbotScreen';
import AlarmScreen from '../Alarm/AlarmScreen';
import CycleScreen from '../Cycle/CycleScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const { profiles, activeProfileId } = useFamilyStore();
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Inicio', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>🏠</Text> }} />
      <Tab.Screen name="Medications" component={MedListScreen} options={{ tabBarLabel: 'Medicamentos', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>💊</Text> }} />
      <Tab.Screen name="Family" component={FamilyScreen} options={{ tabBarLabel: 'Familia', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>👨‍👩‍👧</Text> }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'Historial', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>📋</Text> }} />
      <Tab.Screen name="Vitals" component={VitalsScreen} options={{ tabBarLabel: 'Salud', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>🩺</Text> }} />
      {activeProfile?.gender === 'female' && (
        <Tab.Screen name="Cycle" component={CycleScreen} options={{ tabBarLabel: 'Ciclo', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>🩸</Text> }} />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Ajustes', tabBarIcon: ({ focused }) => <Text style={{ fontSize: focused ? 24 : 20 }}>⚙️</Text> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ navigationRef }: { navigationRef?: any }) {
  const { setUser, fetchUserData, loadCachedUserData, user } = useAuthStore();
  const { loadCachedProfile, fetchProfiles } = useFamilyStore();
  const { fetchMedications, fetchHistory } = useMedStore();
  const { loadSettings, isDarkMode } = useSettingsStore();
  const activeProfileId = useFamilyStore(s => s.activeProfileId);
  const theme = isDarkMode ? darkTheme : lightTheme;

  // SOLO Firebase decide si hay sesión — esperamos su respuesta siempre
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Recargar meds cuando cambia el perfil activo
  useEffect(() => {
    if (user && activeProfileId) {
      fetchMedications(user.uid, activeProfileId);
      fetchHistory(user.uid, activeProfileId);
    }
  }, [activeProfileId]);

  useEffect(() => {
    loadSettings();
    loadCachedUserData();
    loadCachedProfile();

    // Leer onboarding
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
    });

    // Firebase es la única fuente de verdad para la sesión
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Cargar datos en paralelo
        await Promise.all([
          fetchUserData(firebaseUser.uid),
          fetchProfiles(firebaseUser.uid),
        ]);
        const activeId = useFamilyStore.getState().activeProfileId;
        if (activeId) {
          await Promise.all([
            fetchMedications(firebaseUser.uid, activeId),
            fetchHistory(firebaseUser.uid, activeId),
          ]);
        }
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // Esperar a Firebase Y onboarding antes de mostrar cualquier cosa
  if (initializing || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>💊</Text>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (!onboardingDone) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: 'modal', ...TransitionPresets.ModalSlideFromBottomIOS }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="AddMedication" component={AddMedScreen} options={{ presentation: 'modal', ...TransitionPresets.ModalSlideFromBottomIOS }} />
            <Stack.Screen name="AddProfile" component={AddProfileScreen} options={{ presentation: 'modal', ...TransitionPresets.ModalSlideFromBottomIOS }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ presentation: 'modal', ...TransitionPresets.ModalSlideFromBottomIOS }} />
            <Stack.Screen name="Chatbot" component={ChatbotScreen} options={{ presentation: 'modal', ...TransitionPresets.ModalSlideFromBottomIOS }} />
            <Stack.Screen name="AddVital" component={AddVitalScreen} options={{ presentation: 'modal', ...TransitionPresets.ModalSlideFromBottomIOS }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }} />
            <Stack.Screen name="ExportHistory" component={ExportHistoryScreen} options={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }} />
            <Stack.Screen name="Alarm" component={AlarmScreen} options={{ headerShown: false, presentation: 'modal', ...TransitionPresets.ModalFadeTransition, gestureEnabled: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}