import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../Services/firebase';

export default function EditProfileScreen({ navigation }: any) {
  const { userData, user, fetchUserData } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [photoUri, setPhotoUri] = useState((userData as any)?.photoUri || '');
  const [saving, setSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handlePickPhoto = async () => {
    Alert.alert('Foto de perfil', 'Elige una opción', [
      {
        text: '📷 Cámara',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara'); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: '🖼️ Galería',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!displayName.trim()) { Alert.alert('Campo requerido', 'El nombre no puede estar vacío'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user!.uid), { displayName: displayName.trim(), photoUri });
      await updateProfile(auth.currentUser!, { displayName: displayName.trim(), photoURL: photoUri || null });
      await fetchUserData(user!.uid);
      Alert.alert('✅ Guardado', 'Tu perfil fue actualizado', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = () => {
    Alert.alert(
      '🔑 Restablecer contraseña',
      `Se enviará un enlace a:\n${userData?.email}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar enlace',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, userData!.email);
              setResetSent(true);
              Alert.alert('📧 Correo enviado', `Revisa ${userData?.email}. El enlace expira en 1 hora.`);
            } catch {
              Alert.alert('Error', 'No se pudo enviar el correo. Intenta más tarde.');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>← Cancelar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Editar perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={theme.primary} size="small" />
            : <Text style={[styles.saveBtn, { color: theme.primary }]}>Guardar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarInitials}>
                  {displayName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
              <Text style={{ fontSize: 14 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: theme.textMuted }]}>Toca para cambiar tu foto</Text>
          {!!photoUri && (
            <TouchableOpacity onPress={() => setPhotoUri('')} style={{ marginTop: 6 }}>
              <Text style={[{ fontSize: 13, fontWeight: '600' }, { color: theme.error }]}>Quitar foto</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Nombre */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>NOMBRE DE USUARIO</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.textMuted}
            maxLength={40}
            autoCapitalize="words"
          />
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Aparece en tu perfil y en los reportes PDF
          </Text>
        </View>

        {/* Correo (solo lectura) */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>CORREO ELECTRÓNICO</Text>
          <View style={[styles.emailRow, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
            <Text style={[{ fontSize: 15 }, { color: theme.textSecondary }]}>✉️  {userData?.email}</Text>
            <Text style={[{ fontSize: 16 }, { color: theme.textMuted }]}>🔒</Text>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>El correo no se puede modificar</Text>
        </View>

        {/* Contraseña */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>CONTRASEÑA</Text>
          <TouchableOpacity
            style={[styles.resetBtn, {
              backgroundColor: resetSent ? theme.surfaceVariant : theme.primary + '12',
              borderColor: resetSent ? theme.border : theme.primary,
            }]}
            onPress={handleResetPassword}
            disabled={resetSent}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22 }}>{resetSent ? '✅' : '🔑'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resetTitle, { color: resetSent ? theme.textMuted : theme.primary }]}>
                {resetSent ? 'Correo enviado' : 'Restablecer contraseña'}
              </Text>
              <Text style={[styles.resetSub, { color: theme.textMuted }]}>
                {resetSent ? `Revisa tu bandeja de ${userData?.email}` : 'Te enviaremos un enlace por correo'}
              </Text>
            </View>
            {!resetSent && <Text style={[{ fontSize: 22, fontWeight: '300' }, { color: theme.primary }]}>›</Text>}
          </TouchableOpacity>
        </View>

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
  saveBtn: { fontSize: 15, fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginVertical: 28 },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitials: { fontSize: 42, color: '#fff', fontWeight: '700' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarHint: { marginTop: 12, fontSize: 13 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  hint: { fontSize: 12, marginTop: 8 },
  emailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  resetTitle: { fontSize: 15, fontWeight: '600' },
  resetSub: { fontSize: 12, marginTop: 2 },
});
