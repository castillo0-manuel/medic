import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFamilyStore, PROFILE_RELATIONS, PROFILE_EMOJIS, PROFILE_COLORS, FamilyProfile } from '../Store/familyStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';

export default function AddProfileScreen({ navigation, route }: any) {
  const editingProfile: FamilyProfile | undefined = route.params?.profile;
  const isEditing = !!editingProfile;

  const [name, setName] = useState(editingProfile?.name || '');
  const [relation, setRelation] = useState(editingProfile?.relation || 'Otro');
  const [emoji, setEmoji] = useState(editingProfile?.emoji || '👤');
  const [color, setColor] = useState(editingProfile?.color || PROFILE_COLORS[0]);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(editingProfile?.gender || 'other');
  const [photoUri, setPhotoUri] = useState(editingProfile?.photoUri || '');

  const { addProfile, updateProfile, loading } = useFamilyStore();
  const { user } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'El nombre es obligatorio');
      return;
    }

    const profileData = {
      userId: user!.uid,
      name: name.trim(),
      relation,
      emoji,
      color,
      gender,
      photoUri,
      isMain: editingProfile?.isMain || false,
    };

    if (isEditing) {
      await updateProfile(editingProfile!.id, profileData);
    } else {
      await addProfile(profileData);
    }

    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>← Cancelar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isEditing ? 'Editar' : 'Nuevo'} perfil
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={[styles.avatarImage, { borderColor: color }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: color }]}>
                <Text style={{ fontSize: 48 }}>{emoji}</Text>
              </View>
            )}
            <View style={[styles.cameraButton, { backgroundColor: theme.primary }]}>
              <Text style={{ fontSize: 16 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: theme.textMuted }]}>
            Toca para agregar foto
          </Text>
        </View>

        {/* Name */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Nombre</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="Ej: Mamá, Juan, Abuela Rosa..."
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Relation */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Sexo biológico</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {([
              { key: 'female', label: 'Femenino', emoji: '♀️' },
              { key: 'male',   label: 'Masculino', emoji: '♂️' },
              { key: 'other',  label: 'Otro',      emoji: '⚧️' },
            ] as const).map(g => (
              <TouchableOpacity
                key={g.key}
                style={[{
                  flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5,
                  backgroundColor: gender === g.key ? color : theme.surfaceVariant,
                  borderColor: gender === g.key ? color : theme.border,
                }]}
                onPress={() => setGender(g.key)}
              >
                <Text style={{ fontSize: 22 }}>{g.emoji}</Text>
                <Text style={[{ fontSize: 12, fontWeight: '600', marginTop: 4,
                  color: gender === g.key ? '#fff' : theme.textSecondary }]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Relación</Text>
          <View style={styles.relationGrid}>
            {PROFILE_RELATIONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.relationOption,
                  { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
                  relation === r && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => setRelation(r)}
              >
                <Text style={[
                  styles.relationText,
                  { color: theme.textSecondary },
                  relation === r && { color: '#fff', fontWeight: '700' },
                ]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Emoji */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Ícono</Text>
          <View style={styles.emojiGrid}>
            {PROFILE_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={[
                  styles.emojiOption,
                  emoji === e && { backgroundColor: color + '30', borderColor: color, borderWidth: 2 },
                ]}
                onPress={() => setEmoji(e)}
              >
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Color</Text>
          <View style={styles.colorGrid}>
            {PROFILE_COLORS.map(c => (
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

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: color }, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Guardando...' : isEditing ? '✓ Guardar cambios' : '+ Crear perfil'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  backBtn: { fontSize: 15, fontWeight: '600' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  scroll: { padding: 16, gap: 12 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3,
  },
  cameraButton: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, marginTop: 8 },
  section: { borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1, borderRadius: 12,
    padding: 13, fontSize: 15,
  },
  relationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relationOption: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
  },
  relationText: { fontSize: 13, fontWeight: '600' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorOption: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  colorCheck: { color: '#fff', fontWeight: '900', fontSize: 18 },
  saveButton: {
    padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});