import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { useMedStore } from '../Store/medStore';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';

const FREE_LIMIT = 3;

export default function MedListScreen({ navigation }: any) {
  const { medications, fetchMedications, deleteMedication, updateMedication, loading } = useMedStore();
  const { user, userData } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { activeProfileId, profiles } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const isPremium = userData?.isPremium;
  const medsEverAdded = userData?.medsEverAdded ?? 0;
  // Límite PERMANENTE: no importa si eliminó, el contador nunca baja
  const canAdd = isPremium || medsEverAdded < FREE_LIMIT;
  const canEdit = isPremium || medsEverAdded < FREE_LIMIT;

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  useEffect(() => {
    if (user && activeProfileId) {
      fetchMedications(user.uid, activeProfileId);
    }
  }, [user, activeProfileId]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Eliminar medicamento',
      `¿Seguro que deseas eliminar "${name}"? También se cancelarán sus notificaciones.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMedication(id) },
      ]
    );
  };

  const handleRestock = async (item: any) => {
    Alert.prompt(
      '💊 Reabastecer stock',
      `¿Cuántas unidades agregas a ${item.name}?`,
      async (value) => {
        const units = parseInt(value || '0');
        if (isNaN(units) || units <= 0) return;
        const newStock = item.stock + units;
        await updateMedication(item.id, { stock: newStock });

        // Cancelar chequeo diario si ya no hay stock bajo
        const updatedMeds = medications.map(m =>
          m.id === item.id ? { ...m, stock: newStock } : m
        );
        const lowStock = updatedMeds.filter(m => m.stock > 0 && m.stock <= m.stockAlert)
          .map(m => ({ name: m.name, stock: m.stock }));
        const { scheduleDailyStockCheck } = await import('../Services/notifications');
        await scheduleDailyStockCheck(lowStock);

        Alert.alert('✅ Stock actualizado', `${item.name} ahora tiene ${newStock} unidades`);
      },
      'plain-text',
      '',
      'numeric'
    );
  };

  const handleAdd = () => {
    if (!canAdd) {
      Alert.alert(
        '⭐ Límite alcanzado',
        'Ya usaste tus 3 medicamentos gratuitos. Eliminar uno no libera el límite.\n\nActualiza a Premium para medicamentos ilimitados.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: '⭐ Ver Premium', onPress: () => navigation.getParent()?.navigate('Subscription') },
        ]
      );
      return;
    }
    navigation.getParent()?.navigate('AddMedication');
  };

  const handleEdit = (item: any) => {
    if (!isPremium && !canEdit) {
      Alert.alert(
        '⭐ Función Premium',
        'Editar medicamentos después del límite gratuito requiere Premium.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: '⭐ Ver Premium', onPress: () => navigation.getParent()?.navigate('Subscription') },
        ]
      );
      return;
    }
    navigation.navigate('AddMedication', { medication: item });
  };

  const getDaysRemaining = (item: any) => {
    if (!item.durationDays || item.durationDays === 0) return null;
    const start = item.startDate ? new Date(item.startDate) : new Date(item.createdAt);
    const end = new Date(start);
    end.setDate(start.getDate() + item.durationDays);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getIntervalLabel = (hours: number) => {
    const labels: Record<number, string> = {
      4: 'Cada 4 horas',
      8: 'Cada 8 horas',
      12: 'Cada 12 horas',
      24: 'Una vez al día',
    };
    return labels[hours] || `Cada ${hours}h`;
  };

  if (loading && medications.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Medicamentos</Text>
          {activeProfile && (
            <Text style={[styles.headerProfile, { color: activeProfile.color }]}>
              {activeProfile.emoji} {activeProfile.name}
            </Text>
          )}
        </View>
        {!isPremium && (
          <Text style={[styles.headerCounter, { color: canAdd ? theme.textMuted : theme.error }]}>
            {medsEverAdded}/{FREE_LIMIT} usados
          </Text>
        )}
      </View>

      {/* Banner de stock bajo */}
      {medications.some(m => m.stock > 0 && m.stock <= m.stockAlert) && (
        <View style={[styles.stockBanner, { backgroundColor: '#FFF3E0' }]}>
          <Text style={styles.stockBannerText}>
            ⚠️ {medications.filter(m => m.stock > 0 && m.stock <= m.stockAlert).length} medicamento(s) con stock bajo
          </Text>
        </View>
      )}

      <FlatList
        data={medications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💊</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin medicamentos</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {activeProfile
                ? `Agrega medicamentos para ${activeProfile.name}`
                : 'Agrega tu primer medicamento'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderLeftColor: item.color, shadowColor: theme.shadow }]}>
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                {(item as any).photoUri ? (
                  <Image
                    source={{ uri: (item as any).photoUri }}
                    style={styles.emojiContainer}
                  />
                ) : (
                  <View style={[styles.emojiContainer, { backgroundColor: item.color + '20' }]}>
                    <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                  </View>
                )}
                <View>
                  <Text style={[styles.medName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.medGramaje, { color: item.color }]}>{item.gramaje}</Text>
                  <Text style={[styles.medInterval, { color: theme.textSecondary }]}>
                    {getIntervalLabel(item.intervalHours)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => handleEdit(item)}
                >
                  <Text style={{ fontSize: 16 }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#FFEBEE' }]}
                  onPress={() => handleDelete(item.id, item.name)}
                >
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
              <View style={styles.footerItem}>
                <Text style={[styles.footerLabel, { color: theme.textMuted }]}>Stock</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.footerValue, {
                    color: item.stock === 0 ? theme.error : item.stock <= item.stockAlert ? theme.warning : theme.text,
                    fontWeight: item.stock <= item.stockAlert ? '700' : '400',
                  }]}>
                    {item.stock === 0 ? '🚨 Agotado' : item.stock <= item.stockAlert ? `⚠️ ${item.stock}` : `${item.stock}`} {item.stock > 0 ? 'uds' : ''}
                  </Text>
                  <TouchableOpacity
                    style={[styles.restockBtn, { backgroundColor: item.stock <= item.stockAlert ? '#E65100' : theme.primary }]}
                    onPress={() => handleRestock(item)}
                  >
                    <Text style={styles.restockBtnText}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.footerItem}>
                <Text style={[styles.footerLabel, { color: theme.textMuted }]}>Notificaciones</Text>
                <Text style={[styles.footerValue, { color: item.notificationsEnabled ? theme.success : theme.textMuted }]}>
                  {item.notificationsEnabled ? '🔔 Activas' : '🔕 Desactivadas'}
                </Text>
              </View>
            </View>

            {item.instructions ? (
              <Text style={[styles.instructions, { color: theme.textSecondary, borderTopColor: theme.border }]}>
                📝 {item.instructions}
              </Text>
            ) : null}
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: canAdd ? (activeProfile?.color || theme.primary) : '#9E9E9E' }]}
        onPress={handleAdd}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 56, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerProfile: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  headerCounter: { fontSize: 13 },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  empty: { alignItems: 'center', padding: 48, marginTop: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  card: {
    borderRadius: 16, borderLeftWidth: 5, overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 14,
  },
  cardLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  emojiContainer: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  medName: { fontSize: 17, fontWeight: '700' },
  medGramaje: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  medInterval: { fontSize: 13, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderTopWidth: 1, paddingVertical: 10,
  },
  footerItem: { alignItems: 'center' },
  footerLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  footerValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  instructions: {
    fontSize: 13, padding: 12, paddingTop: 10,
    borderTopWidth: 1, lineHeight: 18,
  },
  fab: {
    position: 'absolute', bottom: 30, right: 20,
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  daysFinished: { fontSize: 11, color: '#388E3C', marginTop: 2, fontWeight: '600' },
  daysWarning: { fontSize: 11, color: '#E65100', marginTop: 2, fontWeight: '600' },
  daysNormal: { fontSize: 11, marginTop: 2 },
  stockBanner: {
    marginHorizontal: 16, marginBottom: 8,
    padding: 10, borderRadius: 10,
  },
  stockBannerText: { color: '#E65100', fontWeight: '700', fontSize: 13 },
  restockBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  restockBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});