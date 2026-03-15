import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, StatusBar,
} from 'react-native';
import { useFamilyStore } from '../Store/familyStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../Services/firebase';

const FREE_PROFILE_LIMIT = 1;

export default function FamilyScreen({ navigation }: any) {
  const { profiles, fetchProfiles, deleteProfile, setActiveProfile, activeProfileId } = useFamilyStore();
  const { user, userData } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const isPremium = userData?.isPremium;
  const profilesEverAdded = userData?.profilesEverAdded ?? 1;
  // Límite PERMANENTE: 2 perfiles gratis (incluyendo el principal)
  const FREE_TOTAL = FREE_PROFILE_LIMIT + 1; // = 2
  const canAdd = isPremium || profilesEverAdded < FREE_TOTAL;
  const canEdit = isPremium || profilesEverAdded < FREE_TOTAL;

  useEffect(() => {
    if (user) fetchProfiles(user.uid);
  }, [user]);

  const handleDelete = (id: string, name: string, isMain: boolean) => {
    if (isMain) {
      Alert.alert('No permitido', 'No puedes eliminar el perfil principal');
      return;
    }
    Alert.alert(
      'Eliminar perfil',
      `¿Eliminar el perfil de "${name}"? Sus medicamentos también se eliminarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteProfile(id) },
      ]
    );
  };

  const handleAdd = () => {
    if (!canAdd) {
      Alert.alert(
        '⭐ Límite de perfiles',
        'Ya usaste tus 2 perfiles gratuitos. Eliminar uno no libera el límite.\n\nActualiza a Premium para perfiles ilimitados.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: '⭐ Ver Premium', onPress: () => navigation.getParent()?.navigate('Subscription') },
        ]
      );
      return;
    }
    navigation.getParent()?.navigate('AddProfile');
  };

  const handleEdit = (item: any) => {
    if (!isPremium && !canEdit) {
      Alert.alert(
        '⭐ Función Premium',
        'Editar perfiles después del límite gratuito requiere Premium.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: '⭐ Ver Premium', onPress: () => navigation.getParent()?.navigate('Subscription') },
        ]
      );
      return;
    }
    navigation.getParent()?.navigate('AddProfile', { profile: item });
  };

  const handleCreateMainProfile = async () => {
    if (!user || !userData) return;
    await addDoc(collection(db, 'familyProfiles'), {
      userId: user.uid,
      name: userData.displayName || 'Yo',
      relation: 'Yo',
      emoji: '👤',
      color: '#2E7D32',
      photoUri: '',
      isMain: true,
      createdAt: Timestamp.fromDate(new Date()),
    });
    fetchProfiles(user.uid);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Familia</Text>
        {!isPremium && (
          <Text style={[styles.headerCounter, { color: canAdd ? theme.textMuted : theme.error }]}>
            {profilesEverAdded}/{FREE_TOTAL} usados
          </Text>
        )}
      </View>

      <FlatList
        data={profiles}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>👨‍👩‍👧</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin perfil principal</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Necesitas crear tu perfil principal primero para poder gestionar medicamentos
            </Text>
            <TouchableOpacity
              style={[styles.createMainButton, { backgroundColor: theme.primary }]}
              onPress={handleCreateMainProfile}
            >
              <Text style={styles.createMainButtonText}>👤 Crear mi perfil principal</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          profiles.length > 0 ? (
            <View style={[styles.infoCard, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={{ fontSize: 20 }}>💡</Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Toca un perfil para activarlo. Los medicamentos mostrados cambiarán según el perfil activo.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.surface,
                borderColor: activeProfileId === item.id ? item.color : theme.border,
                borderWidth: activeProfileId === item.id ? 2 : 1,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={() => {
              setActiveProfile(item.id);
              navigation.navigate('Home');
            }}
          >
            <View style={styles.profileLeft}>
              <View style={[styles.profileAvatar, { backgroundColor: item.color }]}>
                <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
              </View>
              <View>
                <View style={styles.profileNameRow}>
                  <Text style={[styles.profileName, { color: theme.text }]}>{item.name}</Text>
                  {item.isMain && (
                    <View style={[styles.mainBadge, { backgroundColor: item.color + '20' }]}>
                      <Text style={[styles.mainBadgeText, { color: item.color }]}>Principal</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.profileRelation, { color: theme.textSecondary }]}>
                  {item.relation}
                </Text>
                {activeProfileId === item.id && (
                  <Text style={[styles.activeLabel, { color: item.color }]}>● Perfil activo</Text>
                )}
              </View>
            </View>

            <View style={styles.profileActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={() => handleEdit(item)}
              >
                <Text style={{ fontSize: 16 }}>✏️</Text>
              </TouchableOpacity>
              {!item.isMain && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
                  onPress={() => handleDelete(item.id, item.name, item.isMain)}
                >
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: canAdd ? theme.primary : '#9E9E9E' }]}
        onPress={handleAdd}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 56, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerCounter: { fontSize: 13 },
  list: { padding: 16, gap: 12, paddingBottom: 160 },
  empty: { alignItems: 'center', padding: 48, marginTop: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  profileCard: {
    borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  profileLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 17, fontWeight: '700' },
  mainBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  mainBadgeText: { fontSize: 11, fontWeight: '700' },
  profileRelation: { fontSize: 13, marginTop: 3 },
  activeLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  profileActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  infoCard: {
    borderRadius: 14, padding: 14,
    flexDirection: 'row', gap: 10, alignItems: 'center',
    marginTop: 8,
  },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
  fab: {
    position: 'absolute', bottom: 30, right: 20,
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  createMainButton: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 14,
  },
  createMainButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});