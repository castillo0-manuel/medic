import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Dimensions, ActivityIndicator,
} from 'react-native';
import { useVitalStore, VITAL_CONFIG, VitalType, VitalRecord } from '../Store/vitalStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;
const CHART_HEIGHT = 120;

const VITAL_TYPES: VitalType[] = ['blood_pressure', 'glucose', 'weight', 'heart_rate', 'temperature', 'oxygen'];

export default function VitalsScreen({ navigation }: any) {
  const { records, fetchRecords, deleteRecord, loading } = useVitalStore();
  const { user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { activeProfileId, profiles } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [selectedType, setSelectedType] = useState<VitalType>('blood_pressure');

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const config = VITAL_CONFIG[selectedType];

  useEffect(() => {
    if (user && activeProfileId) fetchRecords(user.uid, activeProfileId);
  }, [user, activeProfileId]);

  // Filtrar registros del tipo seleccionado
  const typeRecords = useMemo(() =>
    records.filter(r => r.type === selectedType).slice(0, 30),
    [records, selectedType]
  );

  // Último registro de cada tipo para las cards de resumen
  const latestByType = useMemo(() => {
    const map: Partial<Record<VitalType, VitalRecord>> = {};
    for (const r of records) {
      if (!map[r.type]) map[r.type] = r;
    }
    return map;
  }, [records]);

  const getValueLabel = (r: VitalRecord) => {
    if (r.type === 'blood_pressure') return `${r.systolic}/${r.diastolic}`;
    return `${r.value}`;
  };

  const getStatusColor = (r: VitalRecord): string => {
    const cfg = VITAL_CONFIG[r.type];
    if (r.type === 'blood_pressure') {
      const sys = r.systolic ?? 0;
      if (sys < 90 || sys > 140) return theme.error;
      if (sys > 120) return theme.warning;
      return theme.success;
    }
    if (r.value < cfg.normalRange.min || r.value > cfg.normalRange.max) return theme.error;
    return theme.success;
  };

  // Mini gráfica de línea simple
  const MiniChart = () => {
    if (typeRecords.length < 2) return (
      <View style={[styles.chartEmpty, { backgroundColor: theme.surfaceVariant }]}>
        <Text style={[styles.chartEmptyText, { color: theme.textMuted }]}>
          Agrega al menos 2 registros para ver la gráfica
        </Text>
      </View>
    );

    const values = typeRecords.map(r =>
      selectedType === 'blood_pressure' ? (r.systolic ?? 0) : r.value
    ).reverse();

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const pointSpacing = CHART_WIDTH / (values.length - 1);

    const points = values.map((v, i) => ({
      x: i * pointSpacing,
      y: CHART_HEIGHT - ((v - minVal) / range) * (CHART_HEIGHT - 20) - 10,
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.surfaceVariant }]}>
        <Text style={[styles.chartTitle, { color: theme.textMuted }]}>
          Últimos {values.length} registros · {config.unit}
        </Text>
        {/* Fake SVG using Views */}
        <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
          {points.map((p, i) => (
            <View key={i} style={[styles.chartDot, {
              left: p.x - 4,
              top: p.y - 4,
              backgroundColor: config.color,
            }]} />
          ))}
          {points.slice(1).map((p, i) => {
            const prev = points[i];
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <View key={`line-${i}`} style={[styles.chartLine, {
                left: prev.x,
                top: prev.y,
                width: len,
                backgroundColor: config.color + '60',
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 0',
              }]} />
            );
          })}
          {/* Min/max labels */}
          <Text style={[styles.chartMax, { color: theme.textMuted }]}>{maxVal}{config.unit}</Text>
          <Text style={[styles.chartMin, { color: theme.textMuted }]}>{minVal}{config.unit}</Text>
        </View>
        {selectedType === 'blood_pressure' && (
          <Text style={[styles.chartNote, { color: theme.textMuted }]}>Mostrando sistólica</Text>
        )}
      </View>
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar registro', '¿Seguro que deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteRecord(id) },
    ]);
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Signos vitales</Text>
          {activeProfile && (
            <Text style={[styles.headerProfile, { color: activeProfile.color }]}>
              {activeProfile.emoji} {activeProfile.name}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: config.color }]}
          onPress={() => navigation.getParent()?.navigate('AddVital', { type: selectedType })}
        >
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Resumen cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}>
          {VITAL_TYPES.map(type => {
            const cfg = VITAL_CONFIG[type];
            const latest = latestByType[type];
            return (
              <TouchableOpacity
                key={type}
                style={[styles.summaryCard, {
                  backgroundColor: selectedType === type ? cfg.color : theme.surface,
                  borderColor: cfg.color,
                  borderWidth: selectedType === type ? 0 : 1.5,
                }]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={styles.summaryEmoji}>{cfg.emoji}</Text>
                <Text style={[styles.summaryLabel, { color: selectedType === type ? 'rgba(255,255,255,0.8)' : theme.textMuted }]}>
                  {cfg.label}
                </Text>
                {latest ? (
                  <Text style={[styles.summaryValue, { color: selectedType === type ? '#fff' : cfg.color }]}>
                    {getValueLabel(latest)}
                    <Text style={{ fontSize: 10 }}> {cfg.unit}</Text>
                  </Text>
                ) : (
                  <Text style={[styles.summaryEmpty, { color: selectedType === type ? 'rgba(255,255,255,0.5)' : theme.textMuted }]}>
                    Sin datos
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected type detail */}
        <View style={[styles.detailHeader, { backgroundColor: config.color + '15' }]}>
          <Text style={{ fontSize: 28 }}>{config.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailTitle, { color: config.color }]}>{config.label}</Text>
            <Text style={[styles.detailNormal, { color: theme.textMuted }]}>{config.normalRange.label}</Text>
          </View>
          <Text style={[styles.detailCount, { color: config.color }]}>
            {typeRecords.length} registros
          </Text>
        </View>

        {/* Chart */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <MiniChart />
        </View>

        {/* Records list */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HISTORIAL</Text>

          {loading && <ActivityIndicator color={config.color} style={{ marginTop: 20 }} />}

          {!loading && typeRecords.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Text style={{ fontSize: 48 }}>{config.emoji}</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin registros</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Toca "+ Agregar" para registrar tu {config.label.toLowerCase()}
              </Text>
            </View>
          )}

          {typeRecords.map(record => {
            const statusColor = getStatusColor(record);
            return (
              <TouchableOpacity
                key={record.id}
                style={[styles.recordCard, { backgroundColor: theme.surface, borderLeftColor: statusColor }]}
                onLongPress={() => handleDelete(record.id)}
                activeOpacity={0.8}
              >
                <View style={styles.recordMain}>
                  <Text style={[styles.recordValue, { color: statusColor }]}>
                    {getValueLabel(record)}
                    <Text style={[styles.recordUnit, { color: theme.textMuted }]}> {record.unit}</Text>
                  </Text>
                  <Text style={[styles.recordDate, { color: theme.textMuted }]}>
                    {formatDate(record.recordedAt)}
                  </Text>
                </View>
                {record.notes ? (
                  <Text style={[styles.recordNotes, { color: theme.textSecondary }]} numberOfLines={1}>
                    📝 {record.notes}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.deleteHint, { color: theme.textMuted }]}>
          Mantén presionado un registro para eliminarlo
        </Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerProfile: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  summaryCard: {
    width: 110, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4,
  },
  summaryEmoji: { fontSize: 24 },
  summaryLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  summaryEmpty: { fontSize: 11, fontStyle: 'italic' },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 16,
  },
  detailTitle: { fontSize: 16, fontWeight: '700' },
  detailNormal: { fontSize: 12, marginTop: 2 },
  detailCount: { fontSize: 22, fontWeight: '800' },
  chartContainer: { borderRadius: 16, padding: 16, position: 'relative' },
  chartEmpty: { borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', height: 100 },
  chartEmptyText: { fontSize: 13, textAlign: 'center' },
  chartTitle: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  chartDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  chartLine: { position: 'absolute', height: 2 },
  chartMax: { position: 'absolute', top: 0, right: 0, fontSize: 10 },
  chartMin: { position: 'absolute', bottom: 0, right: 0, fontSize: 10 },
  chartNote: { fontSize: 10, marginTop: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  emptyState: { borderRadius: 16, padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  recordCard: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderLeftWidth: 4,
  },
  recordMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordValue: { fontSize: 22, fontWeight: '800' },
  recordUnit: { fontSize: 13 },
  recordDate: { fontSize: 12 },
  recordNotes: { fontSize: 12, marginTop: 4 },
  deleteHint: { textAlign: 'center', fontSize: 11, marginTop: 8 },
});
