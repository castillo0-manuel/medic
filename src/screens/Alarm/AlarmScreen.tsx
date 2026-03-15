import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Animated, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { removePendingDose } from '../Services/notifications';
import { useMedStore } from '../Store/medStore';
import { useAuthStore } from '../Store/authStore';
import { useFamilyStore } from '../Store/familyStore';

const { width, height } = Dimensions.get('window');

export default function AlarmScreen({ navigation, route }: any) {
  const { medicationId, medicationName, gramaje, emoji, color, photoUri } = route.params || {};
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const { logDose, history } = useMedStore();
  const { user } = useAuthStore();
  const { activeProfileId } = useFamilyStore();

  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    // Fade in entrada
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Pulso continuo en el ícono
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleConfirm = async () => {
    // Registrar dosis como tomada
    if (user && activeProfileId && medicationId) {
      const pending = history.find(
        h => h.medicationId === medicationId && !h.taken
      );
      if (pending) {
        await logDose(pending.id, true);
      }
      await removePendingDose(medicationId);
    }
    navigation.goBack();
  };

  const handleSkip = async () => {
    if (medicationId) {
      await removePendingDose(medicationId);
    }
    navigation.goBack();
  };

  const accentColor = color || theme.primary;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={[styles.container, { backgroundColor: accentColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={accentColor} />

      {/* Fondo con círculos decorativos */}
      <View style={[styles.circle1, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={[styles.circle2, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingTop: insets.top + 20 },
        ]}
      >
        {/* Hora */}
        <Text style={styles.timeText}>{timeStr}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>

        {/* Ícono del medicamento */}
        <Animated.View style={[styles.medIconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.medIconBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.medPhoto} />
            ) : (
              <Text style={styles.medEmoji}>{emoji || '💊'}</Text>
            )}
          </View>
        </Animated.View>

        {/* Info del medicamento */}
        <View style={styles.medInfo}>
          <Text style={styles.alarmLabel}>MEDICAMENTO</Text>
          <Text style={styles.medName}>{medicationName || 'Medicamento'}</Text>
          {gramaje ? (
            <Text style={styles.medGramaje}>{gramaje}</Text>
          ) : null}
        </View>

        {/* Instrucciones si existen */}
        <View style={[styles.reminderCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Text style={styles.reminderText}>⏰ Es hora de tomar tu medicamento</Text>
        </View>
      </Animated.View>

      {/* Botones */}
      <Animated.View
        style={[
          styles.buttons,
          { opacity: fadeAnim, paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* Omitir */}
        <TouchableOpacity
          style={[styles.skipBtn, { borderColor: 'rgba(255,255,255,0.5)' }]}
          onPress={handleSkip}
          activeOpacity={0.8}
        >
          <Text style={styles.skipBtnIcon}>⏭️</Text>
          <Text style={styles.skipBtnText}>Omitir</Text>
        </TouchableOpacity>

        {/* Confirmar */}
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: '#fff' }]}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={[styles.confirmBtnIcon]}>✅</Text>
          <Text style={[styles.confirmBtnText, { color: accentColor }]}>Confirmar</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  circle1: {
    position: 'absolute', width: width * 1.4, height: width * 1.4,
    borderRadius: width * 0.7, top: -width * 0.5, left: -width * 0.2,
  },
  circle2: {
    position: 'absolute', width: width * 1.2, height: width * 1.2,
    borderRadius: width * 0.6, bottom: -width * 0.4, right: -width * 0.2,
  },
  content: {
    flex: 1, alignItems: 'center', paddingHorizontal: 32,
  },
  timeText: {
    fontSize: 72, fontWeight: '200', color: '#fff', letterSpacing: -2,
  },
  dateText: {
    fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4,
    textTransform: 'capitalize',
  },
  medIconWrapper: { marginTop: 40, marginBottom: 24 },
  medIconBg: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
  },
  medPhoto: { width: 120, height: 120, borderRadius: 60 },
  medEmoji: { fontSize: 72 },
  medInfo: { alignItems: 'center', gap: 6 },
  alarmLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2,
    color: 'rgba(255,255,255,0.7)',
  },
  medName: {
    fontSize: 32, fontWeight: '800', color: '#fff',
    textAlign: 'center',
  },
  medGramaje: {
    fontSize: 18, color: 'rgba(255,255,255,0.85)', fontWeight: '500',
  },
  reminderCard: {
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 16,
  },
  reminderText: {
    color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row', paddingHorizontal: 24, gap: 16,
  },
  skipBtn: {
    flex: 1, paddingVertical: 18, borderRadius: 20,
    alignItems: 'center', borderWidth: 2, gap: 4,
  },
  skipBtnIcon: { fontSize: 24 },
  skipBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confirmBtn: {
    flex: 2, paddingVertical: 18, borderRadius: 20,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  confirmBtnIcon: { fontSize: 24 },
  confirmBtnText: { fontSize: 18, fontWeight: '800' },
});
