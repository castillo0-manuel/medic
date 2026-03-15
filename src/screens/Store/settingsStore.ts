import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  isDarkMode: boolean;
  notificationsEnabled: boolean;
  language: 'es' | 'en';
  toggleDarkMode: () => void;
  toggleNotifications: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isDarkMode: false,
  notificationsEnabled: true,
  language: 'es',

  toggleDarkMode: () => {
    set(state => ({ isDarkMode: !state.isDarkMode }));
    get().saveSettings();
  },

  toggleNotifications: () => {
    set(state => ({ notificationsEnabled: !state.notificationsEnabled }));
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem('@medireminder_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        set(parsed);
      }
    } catch (e) {
      console.log('Error loading settings');
    }
  },

  saveSettings: async () => {
    try {
      const { isDarkMode, notificationsEnabled, language } = get();
      await AsyncStorage.setItem(
        '@medireminder_settings',
        JSON.stringify({ isDarkMode, notificationsEnabled, language })
      );
    } catch (e) {
      console.log('Error saving settings');
    }
  },
}));
