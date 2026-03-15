import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { VITAL_CONFIG, VitalType } from '../Store/vitalStore';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../Services/firebase';

type RangeKey = '7' | '30' | '90';

const RANGES: { key: RangeKey; label: string; emoji: string }[] = [
  { key: '7',  label: 'Última semana',   emoji: '📅' },
  { key: '30', label: 'Último mes',      emoji: '🗓️' },
  { key: '90', label: 'Últimos 3 meses', emoji: '📊' },
];

export default function ExportHistoryScreen({ navigation }: any) {
  const { userData, user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { profiles, activeProfileId } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [selectedRange, setSelectedRange] = useState<RangeKey>('30');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(activeProfileId || '');
  const [generating, setGenerating] = useState(false);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  const handleExport = async () => {
    if (!user || !selectedProfileId) {
      Alert.alert('Error', 'Selecciona un perfil primero');
      return;
    }
    setGenerating(true);
    try {
      const days = parseInt(selectedRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const rangeLabel = RANGES.find(r => r.key === selectedRange)?.label || '';
      const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

      // ── Medicamentos ──────────────────────────────────────────────
      const [historySnap, medsSnap, vitalsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'doseHistory'),
          where('userId', '==', user.uid),
          where('profileId', '==', selectedProfileId),
          orderBy('scheduledAt', 'desc')
        )),
        getDocs(query(
          collection(db, 'medications'),
          where('userId', '==', user.uid),
          where('profileId', '==', selectedProfileId)
        )),
        getDocs(query(
          collection(db, 'vitalRecords'),
          where('userId', '==', user.uid),
          where('profileId', '==', selectedProfileId),
          orderBy('recordedAt', 'desc')
        )),
      ]);

      const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const meds = medsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const allVitals = vitalsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, recordedAt: data.recordedAt?.toDate?.() || new Date() };
      }) as any[];

      // Filtrar por rango
      const filtered = history.filter(h => {
        const date = h.scheduledAt?.toDate?.() || new Date(h.scheduledAt);
        return date >= startDate;
      });
      const filteredVitals = allVitals.filter(v => new Date(v.recordedAt) >= startDate);

      // Stats adherencia
      const total = filtered.length;
      const taken = filtered.filter(h => h.taken).length;
      const adherence = total > 0 ? Math.round((taken / total) * 100) : 0;
      const adherenceColor = adherence >= 80 ? '#2E7D32' : adherence >= 50 ? '#E65100' : '#C62828';

      // Agrupar dosis por medicamento
      const byMed: Record<string, { name: string; gramaje: string; taken: number; missed: number }> = {};
      for (const h of filtered) {
        if (!byMed[h.medicationId]) {
          const med = meds.find((m: any) => m.id === h.medicationId);
          byMed[h.medicationId] = { name: med?.name || 'Desconocido', gramaje: med?.gramaje || '', taken: 0, missed: 0 };
        }
        if (h.taken) byMed[h.medicationId].taken++;
        else byMed[h.medicationId].missed++;
      }

      // Agrupar signos vitales por tipo — último valor y promedio
      const vitalTypes = Object.keys(VITAL_CONFIG) as VitalType[];
      const vitalSummary = vitalTypes.map(type => {
        const typeRecords = filteredVitals.filter((v: any) => v.type === type);
        if (typeRecords.length === 0) return null;
        const cfg = VITAL_CONFIG[type];
        const latest = typeRecords[0];
        const latestVal = type === 'blood_pressure'
          ? `${latest.systolic}/${latest.diastolic}`
          : `${latest.value}`;

        // Promedio
        const avg = type === 'blood_pressure'
          ? `${Math.round(typeRecords.reduce((s: number, r: any) => s + (r.systolic || 0), 0) / typeRecords.length)}/${Math.round(typeRecords.reduce((s: number, r: any) => s + (r.diastolic || 0), 0) / typeRecords.length)}`
          : `${(typeRecords.reduce((s: number, r: any) => s + r.value, 0) / typeRecords.length).toFixed(1)}`;

        // Estado del último valor
        const checkVal = type === 'blood_pressure' ? (latest.systolic ?? 0) : latest.value;
        const statusColor = checkVal < cfg.normalRange.min ? '#1565C0'
          : checkVal > cfg.normalRange.max ? '#C62828'
          : '#2E7D32';

        return { type, cfg, latestVal, avg, count: typeRecords.length, statusColor };
      }).filter(Boolean);

      // ── HTML del PDF ──────────────────────────────────────────────
      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1A1A1A; background: #fff; font-size: 14px; }

    .header { background: linear-gradient(135deg, #1B5E20, #4CAF50); color: white; padding: 36px 40px; }
    .header h1 { font-size: 26px; font-weight: 900; }
    .header p { opacity: 0.85; margin-top: 5px; font-size: 13px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 14px; border-radius: 20px; font-size: 12px; margin-top: 10px; }

    .content { padding: 28px 32px; }

    .section-title {
      font-size: 11px; font-weight: 800; color: #666;
      text-transform: uppercase; letter-spacing: 1px;
      margin: 28px 0 14px; padding-bottom: 8px;
      border-bottom: 2px solid #eee;
    }

    .stats-row { display: flex; gap: 12px; margin-bottom: 8px; }
    .stat-card { flex: 1; border-radius: 14px; padding: 18px; text-align: center; }
    .stat-number { font-size: 32px; font-weight: 900; }
    .stat-label { font-size: 11px; color: #777; margin-top: 4px; font-weight: 700; text-transform: uppercase; }
    .bar-bg { background: #eee; border-radius: 8px; height: 10px; margin-top: 10px; overflow: hidden; }
    .bar-fill { height: 10px; border-radius: 8px; background: ${adherenceColor}; width: ${adherence}%; }

    .row { display: flex; align-items: center; padding: 13px 16px; border-radius: 10px; margin-bottom: 8px; background: #F8F9FA; }
    .row-name { font-size: 14px; font-weight: 600; flex: 1; }
    .row-sub { font-size: 12px; color: #888; margin-top: 2px; }
    .pill { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-left: 6px; }
    .pill-green { background: #E8F5E9; color: #2E7D32; }
    .pill-red { background: #FFEBEE; color: #C62828; }
    .pill-blue { background: #E3F2FD; color: #1565C0; }

    .vital-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .vital-card {
      width: calc(33% - 7px); border-radius: 12px; padding: 14px;
      border-left: 4px solid;
    }
    .vital-emoji { font-size: 22px; margin-bottom: 6px; }
    .vital-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .vital-value { font-size: 20px; font-weight: 900; }
    .vital-unit { font-size: 11px; color: #888; }
    .vital-avg { font-size: 11px; color: #888; margin-top: 4px; }
    .vital-count { font-size: 10px; color: #aaa; margin-top: 2px; }

    .no-data { text-align: center; color: #bbb; padding: 24px; font-size: 13px; background: #fafafa; border-radius: 10px; }

    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 11px; text-align: center; line-height: 1.8; }
  </style>
</head>
<body>

  <div class="header">
    <h1>📋 Reporte de Salud</h1>
    <p>Paciente: <strong>${userData?.displayName || 'Usuario'}</strong></p>
    <p>Perfil: <strong>${selectedProfile?.name || ''}</strong></p>
    <div class="badge">📅 ${rangeLabel} · Generado el ${today}</div>
  </div>

  <div class="content">

    <!-- ADHERENCIA -->
    <div class="section-title">💊 Adherencia a medicamentos</div>

    ${total === 0 ? '<div class="no-data">Sin registros de dosis en este período</div>' : `
    <div class="stats-row">
      <div class="stat-card" style="background:${adherenceColor}12;">
        <div class="stat-number" style="color:${adherenceColor};">${adherence}%</div>
        <div class="stat-label">Adherencia</div>
        <div class="bar-bg"><div class="bar-fill"></div></div>
      </div>
      <div class="stat-card" style="background:#E8F5E9;">
        <div class="stat-number" style="color:#2E7D32;">${taken}</div>
        <div class="stat-label">Tomadas</div>
      </div>
      <div class="stat-card" style="background:#FFEBEE;">
        <div class="stat-number" style="color:#C62828;">${total - taken}</div>
        <div class="stat-label">Omitidas</div>
      </div>
    </div>
    `}

    <!-- DETALLE POR MED -->
    <div class="section-title">📊 Detalle por medicamento</div>
    ${Object.values(byMed).length === 0
      ? '<div class="no-data">Sin registros en este período</div>'
      : Object.values(byMed).map(m => `
        <div class="row">
          <div style="flex:1">
            <div class="row-name">${m.name}</div>
            <div class="row-sub">${m.gramaje}</div>
          </div>
          <span class="pill pill-green">✓ ${m.taken}</span>
          <span class="pill pill-red">✗ ${m.missed}</span>
        </div>
      `).join('')
    }

    <!-- MEDICAMENTOS ACTIVOS -->
    <div class="section-title">💊 Medicamentos activos</div>
    ${meds.length === 0
      ? '<div class="no-data">Sin medicamentos registrados</div>'
      : meds.map((m: any) => `
        <div class="row">
          <span style="font-size:20px;margin-right:10px;">${m.emoji || '💊'}</span>
          <div style="flex:1">
            <div class="row-name">${m.name} <span style="color:#888;font-weight:400;">${m.gramaje}</span></div>
            <div class="row-sub">Cada ${m.intervalHours === 168 ? '7 días' : m.intervalHours + 'h'}${m.durationDays ? ` · ${m.durationDays} días de tratamiento` : ''}</div>
          </div>
        </div>
      `).join('')
    }

    <!-- SIGNOS VITALES -->
    <div class="section-title">🩺 Signos vitales</div>
    ${vitalSummary.length === 0
      ? '<div class="no-data">Sin registros de signos vitales en este período</div>'
      : `<div class="vital-grid">
          ${vitalSummary.map((v: any) => `
            <div class="vital-card" style="border-color:${v.statusColor};background:${v.statusColor}10;">
              <div class="vital-emoji">${v.cfg.emoji}</div>
              <div class="vital-label">${v.cfg.label}</div>
              <div class="vital-value" style="color:${v.statusColor};">
                ${v.latestVal}
                <span class="vital-unit">${v.cfg.unit}</span>
              </div>
              <div class="vital-avg">Promedio: ${v.avg} ${v.cfg.unit}</div>
              <div class="vital-count">${v.count} registro${v.count !== 1 ? 's' : ''}</div>
            </div>
          `).join('')}
        </div>`
    }

    <div class="footer">
      Generado por MediReminder · ${today}<br>
      Este reporte es solo informativo y no reemplaza la consulta médica.<br>
      Comparte este documento con tu médico tratante.
    </div>

  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir reporte de salud',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF generado', `Guardado en:\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>← Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Exportar reporte</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>

        {/* Preview card */}
        <View style={[styles.previewCard, { backgroundColor: theme.primary }]}>
          <Text style={styles.previewEmoji}>📋</Text>
          <Text style={styles.previewTitle}>Reporte de Salud PDF</Text>
          <Text style={styles.previewSub}>
            Adherencia · Medicamentos · Signos vitales
          </Text>
        </View>

        {/* Seleccionar perfil */}
        {profiles.length > 1 && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PERFIL</Text>
            <View style={styles.chipsRow}>
              {profiles.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surfaceVariant },
                    selectedProfileId === p.id && { backgroundColor: p.color, borderColor: p.color }]}
                  onPress={() => setSelectedProfileId(p.id)}
                >
                  <Text style={[styles.chipText, { color: theme.textSecondary },
                    selectedProfileId === p.id && { color: '#fff' }]}>
                    {p.emoji} {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Rango */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PERÍODO</Text>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeRow, { borderBottomColor: theme.border },
                selectedRange === r.key && { backgroundColor: theme.primary + '10' }]}
              onPress={() => setSelectedRange(r.key)}
            >
              <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
              <Text style={[styles.rangeLabel, { color: theme.text }]}>{r.label}</Text>
              <View style={[styles.radio, { borderColor: selectedRange === r.key ? theme.primary : theme.border }]}>
                {selectedRange === r.key && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contenido del PDF */}
        <View style={[styles.contentBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.contentTitle, { color: theme.textSecondary }]}>EL PDF INCLUIRÁ</Text>
          {[
            '💊 Porcentaje de adherencia a medicamentos',
            '📊 Dosis tomadas vs omitidas por medicamento',
            '📋 Lista de medicamentos activos',
            '🩺 Últimos valores de signos vitales',
            '📈 Promedios del período seleccionado',
          ].map((item, i) => (
            <Text key={i} style={[styles.contentItem, { color: theme.textSecondary }]}>{item}</Text>
          ))}
        </View>

        {/* Botón */}
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: generating ? theme.textMuted : theme.primary }]}
          onPress={handleExport}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.generateBtnText}>📄 Generar y compartir PDF</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: { fontSize: 15, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  previewCard: { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
  previewEmoji: { fontSize: 48, marginBottom: 10 },
  previewTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  previewSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },
  section: { borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, padding: 16, paddingBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '600' },
  rangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  contentBox: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
  contentTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  contentItem: { fontSize: 13, lineHeight: 26 },
  generateBtn: {
    borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});