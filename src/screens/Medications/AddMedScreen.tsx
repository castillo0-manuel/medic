import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Switch, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMedStore, MEDICATION_COLORS, MEDICATION_EMOJIS } from '../Store/medStore';
import type { Medication } from '../Store/medStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';

const INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: 'Cada 4h', value: 4 },
  { label: 'Cada 8h', value: 8 },
  { label: 'Cada 12h', value: 12 },
  { label: '1 vez/día', value: 24 },
  { label: '1 vez/semana', value: 168 },
];

export default function AddMedScreen({ navigation, route }: any) {
  const editingMed: Medication | undefined = route.params?.medication;
  const isEditing = !!editingMed;

  const [name, setName] = useState(editingMed?.name || '');
  const [gramaje, setGramaje] = useState(editingMed?.gramaje || '');
  const [intervalHours, setIntervalHours] = useState<number>(editingMed?.intervalHours || 8);
  const [instructions, setInstructions] = useState(editingMed?.instructions || '');
  const [stock, setStock] = useState(editingMed?.stock?.toString() || '30');
  const [stockAlert, setStockAlert] = useState(editingMed?.stockAlert?.toString() || '5');
  const [emoji, setEmoji] = useState(editingMed?.emoji || '💊');
  const [color, setColor] = useState(editingMed?.color || MEDICATION_COLORS[0]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    editingMed?.notificationsEnabled !== undefined ? editingMed.notificationsEnabled : true
  );
  const [photoUri, setPhotoUri] = useState<string>((editingMed as any)?.photoUri || '');
  const [durationDays, setDurationDays] = useState(
    editingMed?.durationDays?.toString() || '0'
  );

  const { addMedication, updateMedication, loading } = useMedStore();
  const { user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { activeProfileId, profiles } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const handlePickPhoto = async () => {
    Alert.alert('Foto del medicamento', '¿Cómo quieres agregar la foto?', [
      {
        text: '📷 Tomar foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar la foto');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
          }
        },
      },
      {
        text: '🖼️ Elegir de galería',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'El nombre del medicamento es obligatorio');
      return;
    }
    if (!gramaje.trim()) {
      Alert.alert('Campo requerido', 'El gramaje/dosis es obligatorio');
      return;
    }

    const medData = {
      userId: user!.uid,
      profileId: activeProfileId || '',
      name: name.trim(),
      gramaje: gramaje.trim(),
      intervalHours,
      durationDays: parseInt(durationDays) || 0,
      instructions: instructions.trim(),
      stock: parseInt(stock) || 30,
      stockAlert: parseInt(stockAlert) || 5,
      emoji,
      color,
      notificationsEnabled,
      photoUri,
      startDate: new Date(),
    };

    if (isEditing) {
      await updateMedication(editingMed!.id, medData);
    } else {
      await addMedication(medData);
    }

    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.primary }]}>← Cancelar</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {isEditing ? 'Editar' : 'Nuevo'} Medicamento
          </Text>
          {activeProfile && (
            <Text style={[styles.headerProfile, { color: activeProfile.color }]}>
              {activeProfile.emoji} {activeProfile.name}
            </Text>
          )}
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Preview Card */}
        <View style={[styles.previewCard, { backgroundColor: color + '15', borderColor: color }]}>
          {/* Foto o emoji */}
          <TouchableOpacity onPress={handlePickPhoto}>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <View style={[styles.photoEditBadge, { backgroundColor: color }]}>
                  <Text style={{ fontSize: 12 }}>✏️</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: color + '25', borderColor: color }]}>
                <Text style={{ fontSize: 32 }}>{emoji}</Text>
                <Text style={[styles.photoPlaceholderText, { color: color }]}>+ Foto</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewName, { color: theme.text }]}>{name || 'Nombre del medicamento'}</Text>
            <Text style={[styles.previewDetail, { color: color }]}>{gramaje || 'Gramaje/dosis'}</Text>
            <Text style={[styles.previewInterval, { color: theme.textSecondary }]}>
              Cada {intervalHours} horas
            </Text>
          </View>
        </View>

        {/* Foto del medicamento */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Foto del medicamento</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Agrega una foto para identificarlo fácilmente
          </Text>
          <View style={styles.photoRow}>
            <TouchableOpacity
              style={[styles.photoButton, { borderColor: color, backgroundColor: color + '10' }]}
              onPress={handlePickPhoto}
            >
              <Text style={{ fontSize: 24 }}>📷</Text>
              <Text style={[styles.photoButtonText, { color: color }]}>
                {photoUri ? 'Cambiar foto' : 'Tomar / Elegir foto'}
              </Text>
            </TouchableOpacity>
            {photoUri ? (
              <View style={styles.photoThumbContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotoUri('')}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* Emoji selector */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Ícono</Text>
          <View style={styles.emojiGrid}>
            {MEDICATION_EMOJIS.map((e: string) => (
              <TouchableOpacity
                key={e}
                style={[
                  styles.emojiOption,
                  emoji === e && { backgroundColor: color + '30', borderColor: color, borderWidth: 2 },
                ]}
                onPress={() => setEmoji(e)}
              >
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color selector */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Color</Text>
          <View style={styles.colorGrid}>
            {MEDICATION_COLORS.map((c: string) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorOption,
                  { backgroundColor: c },
                  color === c && styles.colorSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && <Text style={styles.colorCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Basic Info */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Información básica</Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Nombre del medicamento *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="Ej: Paracetamol, Omeprazol..."
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Gramaje / Dosis *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="Ej: 500mg, 20mg, 1 tableta..."
            placeholderTextColor={theme.textMuted}
            value={gramaje}
            onChangeText={setGramaje}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Instrucciones del doctor</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="Ej: Tomar con comida, en ayunas..."
            placeholderTextColor={theme.textMuted}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Frequency */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Frecuencia</Text>
          <View style={styles.intervalGrid}>
            {INTERVAL_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.intervalOption,
                  { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
                  intervalHours === opt.value && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => setIntervalHours(opt.value)}
              >
                <Text style={[
                  styles.intervalLabel,
                  { color: theme.textSecondary },
                  intervalHours === opt.value && { color: '#fff', fontWeight: '700' },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stock */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Control de stock</Text>
          <View style={styles.stockRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Unidades disponibles</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
                placeholder="30"
                placeholderTextColor={theme.textMuted}
                value={stock}
                onChangeText={setStock}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Alerta cuando queden</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
                placeholder="5"
                placeholderTextColor={theme.textMuted}
                value={stockAlert}
                onChangeText={setStockAlert}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Duración del tratamiento */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Duración del tratamiento</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            ¿Por cuántos días debes tomarlo? (0 = indefinido)
          </Text>
          <View style={styles.durationRow}>
            {[0, 3, 5, 7, 10, 14, 30].map(d => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.durationChip,
                  { borderColor: theme.border, backgroundColor: theme.surfaceVariant },
                  parseInt(durationDays) === d && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => setDurationDays(d.toString())}
              >
                <Text style={[
                  styles.durationChipText,
                  { color: theme.textSecondary },
                  parseInt(durationDays) === d && { color: '#fff', fontWeight: '700' },
                ]}>
                  {d === 0 ? '∞' : `${d}d`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border, marginTop: 10 }]}
            placeholder="O escribe los días manualmente"
            placeholderTextColor={theme.textMuted}
            value={durationDays === '0' ? '' : durationDays}
            onChangeText={v => setDurationDays(v || '0')}
            keyboardType="numeric"
          />
          {parseInt(durationDays) > 0 && (
            <View style={[styles.durationInfo, { backgroundColor: color + '15' }]}>
              <Text style={[styles.durationInfoText, { color: color }]}>
                📅 Tratamiento hasta el {(() => {
                  const end = new Date();
                  end.setDate(end.getDate() + parseInt(durationDays));
                  return end.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
                })()}
              </Text>
            </View>
          )}
        </View>

        {/* Notifications */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.notifRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Notificaciones</Text>
              <Text style={[styles.notifSubtitle, { color: theme.textSecondary }]}>
                Recordatorio cada {intervalHours} horas
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: theme.border, true: color }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveMainButton, { backgroundColor: color }, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveMainButtonText}>
            {loading ? 'Guardando...' : isEditing ? '✓ Guardar cambios' : '+ Agregar medicamento'}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 56, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerProfile: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  backButton: { fontSize: 15, fontWeight: '600' },
  saveButton: { fontSize: 15, fontWeight: '700' },
  scroll: { padding: 16, gap: 12 },
  previewCard: {
    borderRadius: 16, borderWidth: 2, padding: 20,
    flexDirection: 'row', gap: 16, alignItems: 'center',
  },
  photoPreviewContainer: { position: 'relative' },
  photoPreview: { width: 64, height: 64, borderRadius: 32 },
  photoEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  photoPlaceholderText: { fontSize: 10, fontWeight: '700' },
  previewName: { fontSize: 18, fontWeight: '700' },
  previewDetail: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  previewInterval: { fontSize: 13, marginTop: 2 },
  section: { borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, marginBottom: 12 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  photoButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  photoButtonText: { fontSize: 14, fontWeight: '600' },
  photoThumbContainer: { position: 'relative' },
  photoThumb: { width: 56, height: 56, borderRadius: 12 },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#F44336',
    alignItems: 'center', justifyContent: 'center',
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorOption: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  colorCheck: { color: '#fff', fontWeight: '900', fontSize: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15 },
  textArea: { height: 90, textAlignVertical: 'top' },
  intervalGrid: { flexDirection: 'row', gap: 8 },
  intervalOption: {
    flex: 1, padding: 12, borderRadius: 12,
    alignItems: 'center', borderWidth: 1.5,
  },
  intervalLabel: { fontSize: 13, fontWeight: '600' },
  stockRow: { flexDirection: 'row' },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifSubtitle: { fontSize: 13, marginTop: 2 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  durationChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
  },
  durationChipText: { fontSize: 13, fontWeight: '600' },
  durationInfo: {
    marginTop: 10, padding: 12, borderRadius: 12,
  },
  durationInfoText: { fontSize: 13, fontWeight: '600' },
  saveMainButton: {
    padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  saveMainButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});