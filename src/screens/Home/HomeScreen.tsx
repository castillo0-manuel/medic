import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, StatusBar, Image,
} from 'react-native';
import { useMedStore } from '../Store/medStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { scheduleDailyStockCheck } from '../Services/notifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HomeScreen({ navigation }: any) {
  const { medications, fetchMedications, logDose, fetchHistory, history } = useMedStore();
  const { user, userData } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { profiles, activeProfileId, setActiveProfile, fetchProfiles } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [refreshing, setRefreshing] = useState(false);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  // 1. Cargar perfiles al montar
  useEffect(() => {
    if (user) fetchProfiles(user.uid);
  }, [user]);

  // 2. Cargar medicamentos e historial cuando cambia el perfil activo
  useEffect(() => {
    if (user && activeProfileId) {
      fetchMedications(user.uid, activeProfileId);
      fetchHistory(user.uid, activeProfileId);
    }
  }, [user, activeProfileId]);

  // 3. Programar chequeo diario de stock bajo
  useEffect(() => {
    if (medications.length > 0) {
      const lowStock = medications
        .filter(m => m.stock > 0 && m.stock <= m.stockAlert)
        .map(m => ({ name: m.name, stock: m.stock }));
      scheduleDailyStockCheck(lowStock);
    }
  }, [medications]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) {
      await fetchProfiles(user.uid);
      if (activeProfileId) {
        await fetchMedications(user.uid, activeProfileId);
        await fetchHistory(user.uid, activeProfileId);
      }
    }
    setRefreshing(false);
  };

  const todayDoses = history.filter(h => {
    const today = new Date();
    const doseDate = new Date(h.scheduledAt);
    return doseDate.toDateString() === today.toDateString();
  });

  const adherencePercent = todayDoses.length > 0
    ? Math.round((todayDoses.filter(d => d.taken).length / todayDoses.length) * 100)
    : 0;

  // Calcular racha de días consecutivos tomando medicamentos
  const calcStreak = () => {
    const takenDays = new Set(
      history
        .filter(h => h.taken)
        .map(h => new Date(h.scheduledAt).toDateString())
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (takenDays.has(d.toDateString())) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };
  const streak = calcStreak();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Buenos días';
    if (hour < 18) return '🌤️ Buenas tardes';
    return '🌙 Buenas noches';
  };

  const getNextDose = () => {
    if (medications.length === 0) return null;
    const med = medications[0];
    const nextTime = new Date();
    nextTime.setHours(nextTime.getHours() + med.intervalHours);
    return { med, nextTime };
  };

  const nextDose = getNextDose();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: activeProfile?.color || theme.primary }]}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{userData?.displayName || 'Usuario'} 👋</Text>
            <Text style={styles.date}>
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </Text>
            {streak > 0 && (
              <View style={styles.streakChip}>
                <Text style={styles.streakText}>🔥 {streak} día{streak !== 1 ? 's' : ''} de racha</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Selector de perfil familiar */}
        {profiles.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.profileSelector}
            contentContainerStyle={styles.profileSelectorContent}
          >
            {profiles.map(profile => (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileChip,
                  {
                    backgroundColor: activeProfileId === profile.id ? profile.color : theme.surface,
                    borderColor: activeProfileId === profile.id ? profile.color : theme.border,
                  },
                ]}
                onPress={() => setActiveProfile(profile.id)}
              >
                <Text style={{ fontSize: 16 }}>{profile.emoji}</Text>
                <Text style={[
                  styles.profileChipText,
                  { color: activeProfileId === profile.id ? '#fff' : theme.text },
                ]}>
                  {profile.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Adherencia del día */}
        <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
          <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>
            Adherencia de hoy
            {activeProfile && profiles.length > 1 && (
              <Text style={{ color: activeProfile.color }}> · {activeProfile.name}</Text>
            )}
          </Text>
          <View style={styles.statsRow}>
            <Text style={[styles.statsPercent, { color: activeProfile?.color || theme.primary }]}>
              {adherencePercent}%
            </Text>
            <View style={styles.statsBar}>
              <View style={[styles.statsBarFill, {
                width: `${adherencePercent}%`,
                backgroundColor: activeProfile?.color || theme.primary,
              }]} />
            </View>
          </View>
          <Text style={[styles.statsDetail, { color: theme.textMuted }]}>
            {todayDoses.filter(d => d.taken).length} de {todayDoses.length} dosis tomadas
          </Text>
        </View>

        {/* Próxima dosis */}
        {nextDose && (
          <View style={[styles.nextDoseCard, { backgroundColor: activeProfile?.color || theme.primaryLight }]}>
            <Text style={styles.nextDoseLabel}>⏰ Próxima dosis</Text>
            <Text style={styles.nextDoseName}>{nextDose.med.emoji} {nextDose.med.name}</Text>
            <Text style={styles.nextDoseTime}>
              {format(nextDose.nextTime, 'HH:mm')} — {nextDose.med.gramaje}
            </Text>
          </View>
        )}

        {/* Medicamentos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Medicamentos ({medications.length})
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Medications')}>
              <Text style={[styles.sectionLink, { color: activeProfile?.color || theme.primary }]}>Ver todos →</Text>
            </TouchableOpacity>
          </View>

          {medications.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
              <Text style={styles.emptyEmoji}>💊</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin medicamentos</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Agrega el primer medicamento para comenzar
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: activeProfile?.color || theme.primary }]}
                onPress={() => navigation.navigate('Medications')}
              >
                <Text style={styles.emptyButtonText}>+ Agregar medicamento</Text>
              </TouchableOpacity>
            </View>
          ) : (
            medications.slice(0, 3).map(med => (
              <TouchableOpacity
                key={med.id}
                style={[styles.medCard, { backgroundColor: theme.surface, borderLeftColor: med.color, shadowColor: theme.shadow }]}
                onPress={() => navigation.navigate('Medications')}
              >
                <View style={styles.medCardLeft}>
                  {(med as any).photoUri ? (
                    <Image source={{ uri: (med as any).photoUri }} style={styles.medEmoji} />
                  ) : (
                    <View style={[styles.medEmoji, { backgroundColor: med.color + '20' }]}>
                      <Text style={{ fontSize: 24 }}>{med.emoji}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={[styles.medName, { color: theme.text }]}>{med.name}</Text>
                    <Text style={[styles.medDetail, { color: theme.textSecondary }]}>
                      {med.gramaje} · Cada {med.intervalHours}h
                    </Text>
                    {med.stock <= med.stockAlert && (
                      <Text style={styles.stockWarning}>⚠️ Stock bajo: {med.stock} restantes</Text>
                    )}
                    {(() => {
                      const dur = (med as any).durationDays;
                      if (!dur || dur === 0) return null;
                      const start = med.startDate ? new Date(med.startDate) : new Date();
                      const end = new Date(start);
                      end.setDate(start.getDate() + dur);
                      const diff = Math.ceil((end.getTime() - Date.now()) / 86400000);
                      if (diff <= 0) return <Text style={{ fontSize: 11, color: '#388E3C', marginTop: 2 }}>✅ Tratamiento completado</Text>;
                      if (diff <= 3) return <Text style={{ fontSize: 11, color: '#E65100', marginTop: 2 }}>⏳ {diff}d restantes</Text>;
                      return null;
                    })()}
                  </View>
                </View>
                <View style={styles.medCardActions}>
                  <TouchableOpacity
                    style={[styles.doseButton, { backgroundColor: theme.success }]}
                    onPress={() => logDose(med.id, user!.uid, activeProfileId || '', true)}
                  >
                    <Text style={styles.doseButtonText}>✓ Tomé</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.doseButtonSkip, { borderColor: theme.border }]}
                    onPress={() => logDose(med.id, user!.uid, activeProfileId || '', false)}
                  >
                    <Text style={[styles.doseButtonSkipText, { color: theme.textSecondary }]}>Omitir</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Premium banner */}
        {!userData?.isPremium && medications.length >= 3 && (
          <TouchableOpacity
            style={[styles.premiumBanner, { backgroundColor: theme.primaryDark }]}
            onPress={() => navigation.getParent()?.navigate('Subscription')}
          >
            <Text style={styles.premiumEmoji}>⭐</Text>
            <View>
              <Text style={styles.premiumTitle}>Desbloquea Premium</Text>
              <Text style={styles.premiumSubtitle}>Medicamentos ilimitados y más</Text>
            </View>
            <Text style={styles.premiumArrow}>→</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* MediBot FAB */}
      <TouchableOpacity
        style={[styles.chatFab, { backgroundColor: theme.primary }]}
        onPress={() => navigation.getParent()?.navigate('Chatbot')}
        activeOpacity={0.85}
      >
        <Text style={styles.chatFabText}>🤖</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 24, paddingTop: 56,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  userName: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },
  date: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  settingsIcon: { fontSize: 26, marginTop: 8 },
  streakChip: {
    marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start',
  },
  streakText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  profileSelector: { marginTop: 12 },
  profileSelectorContent: { paddingHorizontal: 16, gap: 8 },
  profileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  profileChipText: { fontSize: 13, fontWeight: '600' },
  statsCard: {
    margin: 16, marginTop: 16, borderRadius: 16, padding: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statsTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  statsPercent: { fontSize: 28, fontWeight: '800', width: 64 },
  statsBar: { flex: 1, height: 8, backgroundColor: '#E0E0E0', borderRadius: 4 },
  statsBarFill: { height: 8, borderRadius: 4 },
  statsDetail: { fontSize: 12, marginTop: 4 },
  nextDoseCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 16 },
  nextDoseLabel: { color: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '600' },
  nextDoseName: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  nextDoseTime: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionLink: { fontSize: 14, fontWeight: '600' },
  emptyCard: {
    borderRadius: 16, padding: 32, alignItems: 'center',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  medCard: {
    borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  medCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  medEmoji: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 15, fontWeight: '700' },
  medDetail: { fontSize: 13, marginTop: 2 },
  stockWarning: { fontSize: 11, color: '#F57C00', marginTop: 2 },
  medCardActions: { gap: 6 },
  doseButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  doseButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  doseButtonSkip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  doseButtonSkipText: { fontSize: 13, fontWeight: '600' },
  premiumBanner: {
    margin: 16, borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  premiumEmoji: { fontSize: 32 },
  premiumTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  premiumSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  premiumArrow: { color: '#fff', fontSize: 20, marginLeft: 'auto' },
  chatFab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  chatFabText: { fontSize: 26 },
});