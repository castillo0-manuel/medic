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
import { lightTheme, darkTheme } from '../Theme/colors';

// Auth Screens
import LoginScreen from '../Auth/LoginScreen';
import RegisterScreen from '../Auth/RegisterScreen';

// Main Screens
import HomeScreen from '../Home/HomeScreen';
import MedListScreen from '../Medications/MedListScreen';
import AddMedScreen from '../Medications/AddMedScreen';
import HistoryScreen from '../History/HistoryScreen';
import SettingsScreen from '../Settings/SettingsScreen';
import SubscriptionScreen from '../Settings/SubscriptionScreen';

// Family Screens
import FamilyScreen from '../Family/FamilyScreen';
import AddProfileScreen from '../Family/AddProfileScreen';

// Onboarding
import OnboardingScreen, { ONBOARDING_KEY } from '../Onboarding/OnboardingScreen';

// Settings extras
import EditProfileScreen from '../Settings/EditProfileScreen';
import ExportHistoryScreen from '../Settings/ExportHistoryScreen';

// Vitals
import VitalsScreen from '../Vitals/VitalsScreen';
import AddVitalScreen from '../Vitals/AddVitalScreen';

// Chatbot
import ChatbotScreen from '../Chatbot/ChatbotScreen';

// Cycle
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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Text style={{ fontSize: focused ? 24 : 20 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Medications"
        component={MedListScreen}
        options={{
          tabBarLabel: 'Medicamentos',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Text style={{ fontSize: focused ? 24 : 20 }}>💊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Family"
        component={FamilyScreen}
        options={{
          tabBarLabel: 'Familia',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Text style={{ fontSize: focused ? 24 : 20 }}>👨‍👩‍👧</Text>
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Historial',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Text style={{ fontSize: focused ? 24 : 20 }}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Vitals"
        component={VitalsScreen}
        options={{
          tabBarLabel: 'Salud',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Text style={{ fontSize: focused ? 24 : 20 }}>🩺</Text>
          ),
        }}
      />
      {activeProfile?.gender === 'female' && (
        <Tab.Screen
          name="Cycle"
          component={CycleScreen}
          options={{
            tabBarLabel: 'Ciclo',
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <Text style={{ fontSize: focused ? 24 : 20 }}>🩸</Text>
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Text style={{ fontSize: focused ? 24 : 20 }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { setUser, fetchUserData } = useAuthStore();
  const { loadSettings, isDarkMode } = useSettingsStore();
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    loadSettings();

    // Verificar si ya completó onboarding
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (val === 'true') setOnboardingDone(true);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchUserData(user.uid);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // Mostrar onboarding solo la primera vez (antes del loading)
  if (!onboardingDone) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>💊</Text>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="AddMedication"
              component={AddMedScreen}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
            <Stack.Screen
              name="AddProfile"
              component={AddProfileScreen}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
            <Stack.Screen
              name="Chatbot"
              component={ChatbotScreen}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
            <Stack.Screen
              name="AddVital"
              component={AddVitalScreen}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }}
            />
            <Stack.Screen
              name="ExportHistory"
              component={ExportHistoryScreen}
              options={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}