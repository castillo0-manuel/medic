import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { register, loading, error, clearError } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleRegister = async () => {
    setLocalError('');
    clearError();

    if (!name.trim() || !email.trim() || !password.trim()) {
      setLocalError('Por favor completa todos los campos');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    await register(email.trim(), password, name.trim());
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.emoji}>🌿</Text>
          <Text style={[styles.title, { color: theme.primary }]}>Crear cuenta</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Empieza a cuidar tu salud hoy
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
          {displayError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {[
            { label: 'Nombre completo', value: name, setter: setName, placeholder: 'Tu nombre', type: 'default' },
            { label: 'Correo electrónico', value: email, setter: setEmail, placeholder: 'tu@correo.com', type: 'email-address' },
          ].map((field) => (
            <View key={field.label}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{field.label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
                placeholder={field.placeholder}
                placeholderTextColor={theme.textMuted}
                value={field.value}
                onChangeText={field.setter}
                keyboardType={field.type as any}
                autoCapitalize={field.type === 'email-address' ? 'none' : 'words'}
                autoCorrect={false}
              />
            </View>
          ))}

          <Text style={[styles.label, { color: theme.textSecondary }]}>Contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Confirmar contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="Repite tu contraseña"
            placeholderTextColor={theme.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Crear cuenta gratis</Text>
            )}
          </TouchableOpacity>

          {/* Free tier info */}
          <View style={[styles.freeInfo, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.freeInfoText, { color: theme.textSecondary }]}>
              ✅ Gratis: hasta 3 medicamentos{'\n'}
              ⭐ Premium: medicamentos ilimitados
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.loginLink, { color: theme.primary }]}>
              ← Volver al inicio de sesión
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  emoji: { fontSize: 52, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  card: {
    borderRadius: 20, padding: 24,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  errorBox: {
    backgroundColor: '#FFEBEE', padding: 12,
    borderRadius: 10, marginBottom: 16,
  },
  errorText: { color: '#C62828', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    fontSize: 15, marginBottom: 4,
  },
  button: {
    padding: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 20,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  freeInfo: {
    padding: 14, borderRadius: 12, marginTop: 16,
  },
  freeInfoText: { fontSize: 13, lineHeight: 22 },
  loginLink: {
    textAlign: 'center', marginTop: 16,
    fontSize: 14, fontWeight: '600',
  },
});
