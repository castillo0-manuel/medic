import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Dimensions,
} from 'react-native';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import {
  useCycleStore, predictNextCycle, getDayStatus, DAY_STATUS_CONFIG,
  SYMPTOM_CONFIG, Symptom, FlowLevel,
} from '../Store/cycleStore';
import { lightTheme, darkTheme } from '../Theme/colors';

const { width } = Dimensions.get('window');
const DAY_SIZE = (width - 48) / 7;

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const FLOW_OPTIONS: { key: FlowLevel; label: string; emoji: string }[] = [
  { key: 'light',  label: 'Leve',     emoji: '🩸' },
  { key: 'medium', label: 'Moderado', emoji: '🩸🩸' },
  { key: 'heavy',  label: 'Abundante', emoji: '🩸🩸🩸' },
];

export default function CycleScreen({ navigation }: any) {
  const { user, userData } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { profiles, activeProfileId } = useFamilyStore();
  const { records, fetchRecords, startPeriod, endPeriod, deleteRecord, loading } = useCycleStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<FlowLevel>('medium');
  const [showSymptoms, setShowSymptoms] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<Symptom[]>([]);

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const isPremium = userData?.isPremium || false;

  // Período activo (sin endDate)
  const activePeriod = records.find(r => !r.endDate);

  useEffect(() => {
    if (user && activeProfileId) fetchRecords(user.uid, activeProfileId);
  }, [user, activeProfileId]);

  const prediction = useMemo(() => predictNextCycle(records), [records]);

  // Días en el mes actual
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    // Completar última semana
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Días hasta próximo período
  const daysUntilNext = prediction
    ? Math.max(0, Math.round((prediction.nextPeriodStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleStartPeriod = async () => {
    await startPeriod(user!.uid, activeProfileId!, selectedFlow, '');
    setShowStartModal(false);
  };

  const handleEndPeriod = () => {
    if (!activePeriod) return;
    Alert.alert('Fin del período', '¿El período terminó hoy?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          const endDate = new Date();
          endDate.setHours(0, 0, 0, 0);
          await endPeriod(activePeriod.id, endDate);
        }
      },
    ]);
  };

  const toggleSymptom = (s: Symptom) => {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

  const phaseLabel = () => {
    if (activePeriod) return { text: 'Período activo', color: '#E53935', emoji: '🩸' };
    if (!prediction) return { text: 'Sin datos suficientes', color: theme.textMuted, emoji: '📊' };
    const now = today.getTime();
    if (now >= prediction.fertilityWindowStart.getTime() && now <= prediction.fertilityWindowEnd.getTime()) {
      return { text: 'Ventana fértil', color: '#43A047', emoji: '🌿' };
    }
    if (now === prediction.ovulationDate.getTime()) {
      return { text: 'Día de ovulación', color: '#8E24AA', emoji: '🌸' };
    }
    return { text: `Próximo período en ${daysUntilNext} días`, color: theme.primary, emoji: '📅' };
  };

  const phase = phaseLabel();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#E53935' }]}>
        <View>
          <Text style={styles.headerTitle}>Ciclo menstrual</Text>
          <Text style={styles.headerProfile}>
            {activeProfile?.emoji} {activeProfile?.name}
          </Text>
        </View>
        {activePeriod ? (
          <TouchableOpacity style={styles.endBtn} onPress={handleEndPeriod}>
            <Text style={styles.endBtnText}>Marcar fin</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={() => setShowStartModal(true)}>
            <Text style={styles.startBtnText}>+ Iniciar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Fase actual */}
        <View style={[styles.phaseCard, { backgroundColor: phase.color + '15', borderColor: phase.color }]}>
          <Text style={{ fontSize: 36 }}>{phase.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.phaseText, { color: phase.color }]}>{phase.text}</Text>
            {prediction && (
              <Text style={[styles.phaseSub, { color: theme.textMuted }]}>
                Ciclo promedio: {prediction.avgCycleLength} días · Período: {prediction.avgPeriodLength} días
              </Text>
            )}
          </View>
        </View>

        {/* Predicción Premium */}
        {prediction && (
          <View style={[styles.predictionRow, { backgroundColor: theme.surface }]}>
            <View style={styles.predItem}>
              <Text style={styles.predEmoji}>📅</Text>
              <Text style={[styles.predLabel, { color: theme.textMuted }]}>Próximo período</Text>
              <Text style={[styles.predValue, { color: '#E53935' }]}>
                {formatDate(prediction.nextPeriodStart)}
              </Text>
            </View>
            <View style={[styles.predDivider, { backgroundColor: theme.border }]} />
            <View style={styles.predItem}>
              <Text style={styles.predEmoji}>🌿</Text>
              <Text style={[styles.predLabel, { color: theme.textMuted }]}>Ventana fértil</Text>
              {isPremium ? (
                <Text style={[styles.predValue, { color: '#43A047' }]}>
                  {formatDate(prediction.fertilityWindowStart)} – {formatDate(prediction.fertilityWindowEnd)}
                </Text>
              ) : (
                <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Subscription')}>
                  <Text style={[styles.predValue, { color: theme.primary }]}>🔒 Premium</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.predDivider, { backgroundColor: theme.border }]} />
            <View style={styles.predItem}>
              <Text style={styles.predEmoji}>🌸</Text>
              <Text style={[styles.predLabel, { color: theme.textMuted }]}>Ovulación</Text>
              {isPremium ? (
                <Text style={[styles.predValue, { color: '#8E24AA' }]}>
                  {formatDate(prediction.ovulationDate)}
                </Text>
              ) : (
                <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Subscription')}>
                  <Text style={[styles.predValue, { color: theme.primary }]}>🔒 Premium</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Calendario */}
        <View style={[styles.calendarCard, { backgroundColor: theme.surface }]}>
          {/* Nav mes */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => {
              const d = new Date(currentMonth);
              d.setMonth(d.getMonth() - 1);
              setCurrentMonth(d);
            }}>
              <Text style={[styles.monthNavBtn, { color: theme.primary }]}>‹</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.monthTitle, { color: theme.text }]}>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              {/* Botón para saltar al mes de la predicción */}
              {prediction && (() => {
                const predMonth = prediction.nextPeriodStart.getMonth();
                const predYear = prediction.nextPeriodStart.getFullYear();
                const curMonth = currentMonth.getMonth();
                const curYear = currentMonth.getFullYear();
                const isOtherMonth = predMonth !== curMonth || predYear !== curYear;
                if (!isOtherMonth) return null;
                return (
                  <TouchableOpacity onPress={() => setCurrentMonth(new Date(prediction.nextPeriodStart))}>
                    <Text style={{ fontSize: 10, color: '#E53935', fontWeight: '700', marginTop: 2 }}>
                      Ver próximo período →
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
            <TouchableOpacity onPress={() => {
              const d = new Date(currentMonth);
              d.setMonth(d.getMonth() + 1);
              setCurrentMonth(d);
            }}>
              <Text style={[styles.monthNavBtn, { color: theme.primary }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Días de semana */}
          <View style={styles.weekHeader}>
            {DAYS_OF_WEEK.map(d => (
              <Text key={d} style={[styles.weekDay, { color: theme.textMuted }]}>{d}</Text>
            ))}
          </View>

          {/* Grid de días */}
          <View style={styles.daysGrid}>
            {calendarDays.map((date, i) => {
              if (!date) return <View key={`empty-${i}`} style={styles.dayCell} />;
              const status = getDayStatus(date, records, prediction, isPremium);
              const cfg = DAY_STATUS_CONFIG[status];
              const isToday = date.getTime() === today.getTime();
              const hasData = status !== 'normal';

              return (
                <View key={i} style={styles.dayCell}>
                  <View style={[
                    styles.dayInner,
                    hasData && { backgroundColor: cfg.color },
                    isToday && !hasData && { borderWidth: 2, borderColor: '#E53935' },
                  ]}>
                    <Text style={[
                      styles.dayText,
                      { color: hasData ? '#fff' : isToday ? '#E53935' : theme.text },
                      isToday && { fontWeight: '800' },
                    ]}>
                      {date.getDate()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Leyenda */}
          <View style={styles.legend}>
            {[
              { color: '#E53935', label: 'Período' },
              { color: '#EF9A9A', label: 'Estimado' },
              isPremium ? { color: '#43A047', label: 'Fértil' } : null,
              isPremium ? { color: '#8E24AA', label: 'Ovulación' } : null,
            ].filter(Boolean).map((item: any) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Historial de ciclos */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HISTORIAL</Text>
          {records.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Text style={{ fontSize: 48 }}>🩸</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin registros aún</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Toca "+ Iniciar" cuando comience tu período
              </Text>
            </View>
          )}
          {records.map(r => {
            const dur = r.periodLength
              ? `${r.periodLength} días`
              : r.endDate ? `${Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1} días`
              : 'En curso';
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.recordCard, { backgroundColor: theme.surface }]}
                onLongPress={() => Alert.alert('Eliminar', '¿Eliminar este registro?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => deleteRecord(r.id) },
                ])}
              >
                <View style={[styles.recordDot, { backgroundColor: r.endDate ? '#E53935' : '#FF8A80' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recordDate, { color: theme.text }]}>
                    {formatDate(r.startDate)}
                    {r.endDate ? ` → ${formatDate(r.endDate)}` : ' (en curso)'}
                  </Text>
                  <Text style={[styles.recordMeta, { color: theme.textMuted }]}>
                    {dur} · {FLOW_OPTIONS.find(f => f.key === r.flow)?.label || ''}
                    {r.cycleLength ? ` · Ciclo: ${r.cycleLength}d` : ''}
                  </Text>
                  {r.symptoms.length > 0 && (
                    <Text style={[styles.recordSymptoms, { color: theme.textMuted }]}>
                      {r.symptoms.map(s => SYMPTOM_CONFIG[s]?.emoji).join(' ')}
                    </Text>
                  )}
                </View>
                {/* Síntomas solo Premium */}
                {isPremium && (
                  <TouchableOpacity
                    style={[styles.symptomBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      setSelectedSymptoms(r.symptoms);
                      setShowSymptoms(r.id);
                    }}
                  >
                    <Text style={[styles.symptomBtnText, { color: theme.primary }]}>😣</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Mantén presionado un registro para eliminarlo
        </Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal iniciar período */}
      {showStartModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>🩸 Iniciar período</Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Flujo</Text>
            <View style={styles.flowCol}>
              {FLOW_OPTIONS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.flowChip, {
                    backgroundColor: selectedFlow === f.key ? '#E53935' : theme.surfaceVariant,
                    borderColor: selectedFlow === f.key ? '#E53935' : theme.border,
                  }]}
                  onPress={() => setSelectedFlow(f.key)}
                >
                  <View style={styles.flowDots}>
                    {Array.from({ length: f.key === 'light' ? 1 : f.key === 'medium' ? 2 : 3 }).map((_, i) => (
                      <Text key={i} style={{ fontSize: 14 }}>🩸</Text>
                    ))}
                  </View>
                  <Text style={[styles.flowLabel, { color: selectedFlow === f.key ? '#fff' : theme.text }]}>
                    {f.label}
                  </Text>
                  {selectedFlow === f.key && <Text style={{ color: '#fff', marginLeft: 'auto' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowStartModal(false)}
              >
                <Text style={[{ color: theme.textSecondary, fontWeight: '600' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#E53935' }]}
                onPress={handleStartPeriod}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal síntomas (Premium) */}
      {showSymptoms && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>😣 Síntomas</Text>
            <View style={styles.symptomsGrid}>
              {(Object.keys(SYMPTOM_CONFIG) as Symptom[]).map(s => {
                const cfg = SYMPTOM_CONFIG[s];
                const selected = selectedSymptoms.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.symptomChip, {
                      backgroundColor: selected ? '#E53935' : theme.surfaceVariant,
                      borderColor: selected ? '#E53935' : theme.border,
                    }]}
                    onPress={() => toggleSymptom(s)}
                  >
                    <Text>{cfg.emoji}</Text>
                    <Text style={[styles.symptomChipText, { color: selected ? '#fff' : theme.text }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowSymptoms(null)}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#E53935' }]}
                onPress={async () => {
                  const { addSymptoms } = useCycleStore.getState();
                  await addSymptoms(showSymptoms!, selectedSymptoms);
                  setShowSymptoms(null);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerProfile: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  startBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  startBtnText: { color: '#fff', fontWeight: '700' },
  endBtn: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  endBtnText: { color: '#fff', fontWeight: '700' },
  phaseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
  phaseText: { fontSize: 16, fontWeight: '700' },
  phaseSub: { fontSize: 12, marginTop: 3 },
  predictionRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, padding: 16, gap: 8,
  },
  predItem: { flex: 1, alignItems: 'center', gap: 4 },
  predEmoji: { fontSize: 20 },
  predLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  predValue: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  predDivider: { width: 1 },
  calendarCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthNavBtn: { fontSize: 28, fontWeight: '300', paddingHorizontal: 8 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  weekHeader: { flexDirection: 'row', marginBottom: 8 },
  weekDay: { width: DAY_SIZE, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: DAY_SIZE, height: DAY_SIZE, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: DAY_SIZE - 4, height: DAY_SIZE - 4, borderRadius: (DAY_SIZE - 4) / 2, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  emptyState: { borderRadius: 16, padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  recordCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  recordDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  recordDate: { fontSize: 14, fontWeight: '600' },
  recordMeta: { fontSize: 12, marginTop: 2 },
  recordSymptoms: { fontSize: 16, marginTop: 4 },
  symptomBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  symptomBtnText: { fontSize: 18 },
  hint: { textAlign: 'center', fontSize: 11, marginTop: 8 },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  flowCol: { gap: 10 },
  flowChip: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5,
  },
  flowDots: { flexDirection: 'row', gap: 2, width: 52 },
  flowLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  symptomChipText: { fontSize: 12, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  modalConfirmBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
});