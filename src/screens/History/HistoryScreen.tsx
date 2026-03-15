import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  StatusBar, TouchableOpacity, ScrollView,
} from 'react-native';
import { useMedStore } from '../Store/medStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { format, isToday, isYesterday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistoryScreen() {
  const { history, fetchHistory, medications } = useMedStore();
  const { user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { activeProfileId, profiles } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const profileColor = activeProfile?.color || theme.primary;

  useEffect(() => {
    if (user && activeProfileId) {
      fetchHistory(user.uid, activeProfileId);
    }
  }, [user, activeProfileId]);

  const getMedName = (id: string) => medications.find(m => m.id === id)?.name || 'Medicamento';
  const getMedEmoji = (id: string) => medications.find(m => m.id === id)?.emoji || '💊';
  const getMedColor = (id: string) => medications.find(m => m.id === id)?.color || profileColor;

  // ── Streak calculation ──────────────────────────────────────────
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

  // ── Stats ──────────────────────────────────────────────────────
  const takenCount = history.filter(h => h.taken).length;
  const totalCount = history.length;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // ── Calendar helpers ───────────────────────────────────────────
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(calendarDate),
    end: endOfMonth(calendarDate),
  });

  const getDayStatus = (day: Date) => {
    const dayHistory = history.filter(h =>
      isSameDay(new Date(h.scheduledAt), day)
    );
    if (dayHistory.length === 0) return 'empty';
    const allTaken = dayHistory.every(h => h.taken);
    const someTaken = dayHistory.some(h => h.taken);
    if (allTaken) return 'full';
    if (someTaken) return 'partial';
    return 'missed';
  };

  const getDayDoses = (day: Date) =>
    history.filter(h => isSameDay(new Date(h.scheduledAt), day));

  const selectedDoses = selectedDay ? getDayDoses(selectedDay) : [];

  const prevMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() - 1);
    setCalendarDate(d);
  };

  const nextMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() + 1);
    setCalendarDate(d);
  };

  // ── Format date header ─────────────────────────────────────────
  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return 'Hoy';
    if (isYesterday(date)) return 'Ayer';
    return format(date, "EEEE d 'de' MMMM", { locale: es });
  };

  // ── List view grouped ──────────────────────────────────────────
  const grouped = history.reduce((acc, item) => {
    const key = new Date(item.scheduledAt).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof history>);

  const sections = Object.entries(grouped).map(([key, items]) => ({
    date: new Date(key),
    items,
    taken: items.filter(i => i.taken).length,
  }));

  const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const firstDayOfMonth = startOfMonth(calendarDate).getDay();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Historial</Text>
          {activeProfile && (
            <Text style={[styles.headerProfile, { color: profileColor }]}>
              {activeProfile.emoji} {activeProfile.name}
            </Text>
          )}
        </View>
        <View style={[styles.viewToggle, { backgroundColor: theme.surfaceVariant }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'calendar' && { backgroundColor: profileColor }]}
            onPress={() => setView('calendar')}
          >
            <Text style={[styles.toggleText, { color: view === 'calendar' ? '#fff' : theme.textMuted }]}>
              📅
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'list' && { backgroundColor: profileColor }]}
            onPress={() => setView('list')}
          >
            <Text style={[styles.toggleText, { color: view === 'list' ? '#fff' : theme.textMuted }]}>
              📋
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Stats row */}
        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: profileColor }]}>{adherence}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Adherencia</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>{takenCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Tomadas</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FF6B35' }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>🔥 Racha</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.error }]}>{totalCount - takenCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Omitidas</Text>
          </View>
        </View>

        {view === 'calendar' ? (
          <>
            {/* Calendar */}
            <View style={[styles.calendarCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>

              {/* Month navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity style={styles.monthNavBtn} onPress={prevMonth}>
                  <Text style={[styles.monthNavArrow, { color: profileColor }]}>‹</Text>
                </TouchableOpacity>
                <Text style={[styles.monthTitle, { color: theme.text }]}>
                  {format(calendarDate, "MMMM yyyy", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
                </Text>
                <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth}>
                  <Text style={[styles.monthNavArrow, { color: profileColor }]}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Weekday headers */}
              <View style={styles.weekRow}>
                {WEEKDAYS.map(d => (
                  <Text key={d} style={[styles.weekDay, { color: theme.textMuted }]}>{d}</Text>
                ))}
              </View>

              {/* Days grid */}
              <View style={styles.daysGrid}>
                {/* Empty cells before first day */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.dayCell} />
                ))}

                {daysInMonth.map(day => {
                  const status = getDayStatus(day);
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const isTodayDay = isToday(day);
                  const isFuture = day > new Date();

                  const dotColor =
                    status === 'full' ? theme.success :
                    status === 'partial' ? '#FF9800' :
                    status === 'missed' ? theme.error :
                    'transparent';

                  return (
                    <TouchableOpacity
                      key={day.toISOString()}
                      style={[
                        styles.dayCell,
                        isSelected && { backgroundColor: profileColor, borderRadius: 20 },
                        isTodayDay && !isSelected && { borderWidth: 1.5, borderColor: profileColor, borderRadius: 20 },
                      ]}
                      onPress={() => setSelectedDay(day)}
                      disabled={isFuture}
                    >
                      <Text style={[
                        styles.dayNumber,
                        { color: isFuture ? theme.textMuted : theme.text },
                        isSelected && { color: '#fff', fontWeight: '700' },
                      ]}>
                        {format(day, 'd')}
                      </Text>
                      {!isFuture && status !== 'empty' && (
                        <View style={[styles.dayDot, { backgroundColor: isSelected ? '#fff' : dotColor }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                {[
                  { color: theme.success, label: 'Completo' },
                  { color: '#FF9800', label: 'Parcial' },
                  { color: theme.error, label: 'Omitido' },
                ].map(item => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendText, { color: theme.textMuted }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Selected day detail */}
            {selectedDay && (
              <View style={styles.dayDetail}>
                <Text style={[styles.dayDetailTitle, { color: theme.text }]}>
                  {formatDateHeader(selectedDay)}
                </Text>

                {selectedDoses.length === 0 ? (
                  <View style={[styles.emptyDay, { backgroundColor: theme.surface }]}>
                    <Text style={{ fontSize: 32 }}>📭</Text>
                    <Text style={[styles.emptyDayText, { color: theme.textSecondary }]}>
                      Sin registros este día
                    </Text>
                  </View>
                ) : (
                  selectedDoses.map(item => (
                    <View
                      key={item.id}
                      style={[styles.historyItem, {
                        backgroundColor: theme.surface,
                        borderLeftColor: getMedColor(item.medicationId),
                        shadowColor: theme.shadow,
                      }]}
                    >
                      <Text style={{ fontSize: 24 }}>{getMedEmoji(item.medicationId)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyName, { color: theme.text }]}>
                          {getMedName(item.medicationId)}
                        </Text>
                        <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                          {format(new Date(item.scheduledAt), 'HH:mm')}
                          {item.takenAt ? ` · Tomado ${format(new Date(item.takenAt), 'HH:mm')}` : ''}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: item.taken ? theme.success + '20' : theme.error + '20' },
                      ]}>
                        <Text style={{ fontSize: 16 }}>{item.taken ? '✅' : '❌'}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        ) : (
          // List view
          <View style={styles.listContainer}>
            {sections.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 56 }}>📋</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin historial</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Marca tus dosis como tomadas para ver tu progreso aquí
                </Text>
              </View>
            ) : (
              sections.map(section => (
                <View key={section.date.toDateString()} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionDate, { color: theme.text }]}>
                      {formatDateHeader(section.date)}
                    </Text>
                    <View style={[styles.sectionBadge, {
                      backgroundColor: section.taken === section.items.length
                        ? theme.success + '20' : '#FF9800' + '20',
                    }]}>
                      <Text style={[styles.sectionBadgeText, {
                        color: section.taken === section.items.length ? theme.success : '#FF9800',
                      }]}>
                        {section.taken}/{section.items.length}
                      </Text>
                    </View>
                  </View>
                  {section.items.map(item => (
                    <View
                      key={item.id}
                      style={[styles.historyItem, {
                        backgroundColor: theme.surface,
                        borderLeftColor: getMedColor(item.medicationId),
                        shadowColor: theme.shadow,
                      }]}
                    >
                      <Text style={{ fontSize: 24 }}>{getMedEmoji(item.medicationId)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyName, { color: theme.text }]}>
                          {getMedName(item.medicationId)}
                        </Text>
                        <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                          {format(new Date(item.scheduledAt), 'HH:mm')}
                          {item.takenAt ? ` · Tomado ${format(new Date(item.takenAt), 'HH:mm')}` : ''}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: item.taken ? theme.success + '20' : theme.error + '20' },
                      ]}>
                        <Text style={{ fontSize: 16 }}>{item.taken ? '✅' : '❌'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 56, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerProfile: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  viewToggle: {
    flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleText: { fontSize: 16 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, marginVertical: 4 },
  calendarCard: {
    margin: 16, borderRadius: 20, padding: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  monthNavBtn: { padding: 8 },
  monthNavArrow: { fontSize: 28, fontWeight: '300' },
  monthTitle: { fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDay: {
    flex: 1, textAlign: 'center', fontSize: 12,
    fontWeight: '600', textTransform: 'uppercase',
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNumber: { fontSize: 14, fontWeight: '500' },
  dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  legend: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 16, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  dayDetail: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  dayDetailTitle: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize', marginBottom: 4 },
  emptyDay: {
    borderRadius: 14, padding: 24, alignItems: 'center', gap: 8,
  },
  emptyDayText: { fontSize: 14 },
  listContainer: { padding: 16, gap: 20 },
  empty: { alignItems: 'center', padding: 48, marginTop: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  sectionDate: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  sectionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sectionBadgeText: { fontSize: 13, fontWeight: '700' },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  historyName: { fontSize: 15, fontWeight: '600' },
  historyTime: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
});