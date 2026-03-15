import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, StatusBar, Image,
} from 'react-native';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { cancelAllNotifications } from '../Services/notifications';

export default function SettingsScreen({ navigation }: any) {
  const { logout, deleteAccount, userData, loading } = useAuthStore();
  const { isDarkMode, notificationsEnabled, toggleDarkMode, toggleNotifications } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      Alert.alert(
        'Desactivar notificaciones',
        '¿Seguro que quieres desactivar todos los recordatorios?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desactivar',
            style: 'destructive',
            onPress: async () => {
              await cancelAllNotifications();
              toggleNotifications();
            },
          },
        ]
      );
    } else {
      toggleNotifications();
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Eliminar cuenta',
      'Esta acción es irreversible. Se eliminarán todos tus datos y medicamentos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar cuenta',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '¿Estás seguro?',
              'No podrás recuperar tu cuenta ni tus datos.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sí, eliminar', style: 'destructive', onPress: deleteAccount },
              ]
            );
          },
        },
      ]
    );
  };

  const SettingRow = ({
    emoji, title, subtitle, right, onPress, danger = false
  }: {
    emoji: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.settingEmoji, { backgroundColor: danger ? '#FFEBEE' : theme.surfaceVariant }]}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: danger ? theme.error : theme.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>}
      </View>
      {right || (onPress && !danger ? <Text style={[styles.settingArrow, { color: theme.textMuted }]}>›</Text> : null)}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Ajustes</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.primary }]}
          onPress={() => navigation.getParent()?.navigate('EditProfile')}
          activeOpacity={0.85}
        >
          {(userData as any)?.photoUri ? (
            <Image
              source={{ uri: (userData as any).photoUri }}
              style={styles.avatarCircle}
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 32 }}>
                {userData?.displayName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{userData?.displayName || 'Usuario'}</Text>
            <Text style={styles.profileEmail}>{userData?.email}</Text>
            <View style={[styles.planBadge, {
              backgroundColor: userData?.isPremium ? '#FFD700' : 'rgba(255,255,255,0.25)'
            }]}>
              <Text style={[styles.planText, { color: userData?.isPremium ? '#1A1A1A' : '#fff' }]}>
                {userData?.isPremium ? '⭐ Premium' : '🆓 Gratis'}
              </Text>
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* Apariencia */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APARIENCIA</Text>

          <SettingRow
            emoji={isDarkMode ? '🌙' : '☀️'}
            title="Modo oscuro"
            subtitle={isDarkMode ? 'Activado' : 'Desactivado'}
            right={
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Notificaciones */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>NOTIFICACIONES</Text>

          <SettingRow
            emoji="🔔"
            title="Recordatorios"
            subtitle={notificationsEnabled ? 'Activados' : 'Desactivados'}
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Suscripción */}
        {!userData?.isPremium && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREMIUM</Text>
            <SettingRow
              emoji="⭐"
              title="Actualizar a Premium"
              subtitle="Medicamentos ilimitados y más funciones"
              onPress={() => navigation.getParent()?.navigate('Subscription')}
            />
          </View>
        )}

        {/* Cuenta */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CUENTA</Text>

          <SettingRow
            emoji="🤖"
            title="MediBot"
            subtitle="Asistente de salud con IA"
            onPress={() => navigation.getParent()?.navigate('Chatbot')}
          />
          <SettingRow
            emoji="📄"
            title="Exportar historial"
            subtitle="Genera un PDF para tu médico"
            onPress={() => navigation.getParent()?.navigate('ExportHistory')}
          />
          <SettingRow
            emoji="🚪"
            title="Cerrar sesión"
            subtitle="Salir de tu cuenta"
            onPress={handleLogout}
          />
          <SettingRow
            emoji="🗑️"
            title="Eliminar cuenta"
            subtitle="Acción permanente e irreversible"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoEmoji}>💊</Text>
          <Text style={[styles.appInfoName, { color: theme.textSecondary }]}>MediReminder</Text>
          <Text style={[styles.appInfoVersion, { color: theme.textMuted }]}>Versión 1.0.0</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 20, paddingTop: 56,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  profileCard: {
    margin: 16, borderRadius: 20, padding: 20,
    flexDirection: 'row', gap: 16, alignItems: 'center',
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  planBadge: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start',
  },
  planText: { fontSize: 12, fontWeight: '700' },
  section: { borderRadius: 16, marginHorizontal: 16, marginBottom: 12, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  settingEmoji: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  settingArrow: { fontSize: 22 },
  appInfo: { alignItems: 'center', padding: 24 },
  appInfoEmoji: { fontSize: 36, marginBottom: 6 },
  appInfoName: { fontSize: 14, fontWeight: '600' },
  appInfoVersion: { fontSize: 12, marginTop: 2 },
});