import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error, clearError } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos');
      return;
    }
    await login(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>💊</Text>
          <Text style={[styles.title, { color: theme.primary }]}>MediReminder</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Nunca olvides tu medicamento
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Iniciar Sesión</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.errorClose}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.textSecondary }]}>Correo electrónico</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
            placeholder="tu@correo.com"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.eyeButton, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.registerLinkText, { color: theme.textSecondary }]}>
              ¿No tienes cuenta?{' '}
              <Text style={{ color: theme.primary, fontWeight: '700' }}>Regístrate</Text>
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
  header: { alignItems: 'center', marginBottom: 32 },
  emoji: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitle: { fontSize: 15, marginTop: 4 },
  card: {
    borderRadius: 20, padding: 24,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  errorBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  errorText: { color: '#C62828', flex: 1, fontSize: 13 },
  errorClose: { color: '#C62828', fontSize: 16, marginLeft: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    fontSize: 15, marginBottom: 4,
  },
  passwordContainer: { flexDirection: 'row', gap: 8 },
  passwordInput: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    padding: 14, fontSize: 15,
  },
  eyeButton: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  loginButton: {
    padding: 16, borderRadius: 14, alignItems: 'center',
    marginTop: 24, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  buttonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  registerLink: { alignItems: 'center', marginTop: 16 },
  registerLinkText: { fontSize: 14 },
});
