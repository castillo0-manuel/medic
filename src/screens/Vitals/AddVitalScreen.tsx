import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useVitalStore, VITAL_CONFIG, VitalType } from '../Store/vitalStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';

export default function AddVitalScreen({ navigation, route }: any) {
  const initialType: VitalType = route.params?.type || 'blood_pressure';
  const { addRecord, loading } = useVitalStore();
  const { user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { activeProfileId } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [selectedType, setSelectedType] = useState<VitalType>(initialType);
  const [value, setValue] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [notes, setNotes] = useState('');

  const config = VITAL_CONFIG[selectedType];
  const TYPES = Object.keys(VITAL_CONFIG) as VitalType[];

  const handleSave = async () => {
    if (!user || !activeProfileId) return;

    if (config.fields === 'blood_pressure') {
      if (!systolic || !diastolic) {
        Alert.alert('Campos requeridos', 'Ingresa sistólica y diastólica');
        return;
      }
      const sys = parseFloat(systolic);
      const dia = parseFloat(diastolic);
      if (isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) {
        Alert.alert('Valor inválido', 'Ingresa números válidos');
        return;
      }
      await addRecord({
        userId: user.uid,
        profileId: activeProfileId,
        type: selectedType,
        value: sys,
        systolic: sys,
        diastolic: dia,
        unit: config.unit,
        notes: notes.trim(),
        recordedAt: new Date(),
      });
    } else {
      if (!value) {
        Alert.alert('Campo requerido', `Ingresa el valor de ${config.label.toLowerCase()}`);
        return;
      }
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        Alert.alert('Valor inválido', 'Ingresa un número válido');
        return;
      }
      await addRecord({
        userId: user.uid,
        profileId: activeProfileId,
        type: selectedType,
        value: num,
        unit: config.unit,
        notes: notes.trim(),
        recordedAt: new Date(),
      });
    }

    navigation.goBack();
  };

  // Mostrar si el valor está dentro del rango normal
  const getValueStatus = () => {
    const checkValue = config.fields === 'blood_pressure' ? parseFloat(systolic) : parseFloat(value);
    if (isNaN(checkValue) || checkValue <= 0) return null;
    if (checkValue < config.normalRange.min) return { label: 'Por debajo de lo normal', color: '#1565C0' };
    if (checkValue > config.normalRange.max) return { label: 'Por encima de lo normal', color: theme.error };
    return { label: 'Dentro del rango normal ✓', color: theme.success };
  };

  const status = getValueStatus();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>← Cancelar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Nuevo registro</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

        {/* Tipo selector */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>TIPO DE MEDICIÓN</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={styles.typeRow}>
            {TYPES.map(type => {
              const cfg = VITAL_CONFIG[type];
              const isSelected = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, {
                    backgroundColor: isSelected ? cfg.color : theme.surface,
                    borderColor: cfg.color,
                  }]}
                  onPress={() => { setSelectedType(type); setValue(''); setSystolic(''); setDiastolic(''); }}
                >
                  <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
                  <Text style={[styles.typeChipText, { color: isSelected ? '#fff' : cfg.color }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Rango normal */}
        <View style={[styles.rangeInfo, { backgroundColor: config.color + '12', borderColor: config.color + '40' }]}>
          <Text style={{ fontSize: 20 }}>{config.emoji}</Text>
          <Text style={[styles.rangeText, { color: config.color }]}>{config.normalRange.label}</Text>
        </View>

        {/* Campos de valor */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>VALOR</Text>

          {config.fields === 'blood_pressure' ? (
            <View style={styles.bpRow}>
              <View style={styles.bpField}>
                <Text style={[styles.bpLabel, { color: theme.textMuted }]}>Sistólica</Text>
                <View style={[styles.bpInput, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}>
                  <TextInput
                    style={[styles.bpInputText, { color: theme.text }]}
                    value={systolic}
                    onChangeText={setSystolic}
                    placeholder={config.placeholder}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={[styles.bpUnit, { color: theme.textMuted }]}>mmHg</Text>
                </View>
              </View>
              <Text style={[styles.bpSeparator, { color: theme.textMuted }]}>/</Text>
              <View style={styles.bpField}>
                <Text style={[styles.bpLabel, { color: theme.textMuted }]}>Diastólica</Text>
                <View style={[styles.bpInput, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}>
                  <TextInput
                    style={[styles.bpInputText, { color: theme.text }]}
                    value={diastolic}
                    onChangeText={setDiastolic}
                    placeholder="80"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={[styles.bpUnit, { color: theme.textMuted }]}>mmHg</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.singleInput, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}>
              <TextInput
                style={[styles.singleInputText, { color: theme.text }]}
                value={value}
                onChangeText={setValue}
                placeholder={config.placeholder}
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                maxLength={6}
                autoFocus
              />
              <Text style={[styles.singleUnit, { color: theme.textMuted }]}>{config.unit}</Text>
            </View>
          )}

          {/* Status indicator */}
          {status && (
            <View style={[styles.statusRow, { backgroundColor: status.color + '12' }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          )}
        </View>

        {/* Notas */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>NOTAS (OPCIONAL)</Text>
          <TextInput
            style={[styles.notesInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: en ayunas, después de ejercicio, con síntomas..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        {/* Fecha/hora */}
        <View style={[styles.dateRow, { backgroundColor: theme.surface }]}>
          <Text style={{ fontSize: 16 }}>🕐</Text>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: loading ? theme.textMuted : config.color }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'Guardando...' : `Guardar ${config.emoji}`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  rangeInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },
  rangeText: { fontSize: 13, fontWeight: '600', flex: 1 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  bpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpField: { flex: 1 },
  bpLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  bpInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14,
  },
  bpInputText: { flex: 1, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  bpUnit: { fontSize: 12 },
  bpSeparator: { fontSize: 36, fontWeight: '300', marginTop: 20 },
  singleInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  singleInputText: { flex: 1, fontSize: 40, fontWeight: '800' },
  singleUnit: { fontSize: 18, fontWeight: '600' },
  statusRow: { marginTop: 10, padding: 10, borderRadius: 10 },
  statusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  notesInput: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, textAlignVertical: 'top', minHeight: 80,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 20,
  },
  dateText: { fontSize: 14 },
  saveBtn: {
    borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
