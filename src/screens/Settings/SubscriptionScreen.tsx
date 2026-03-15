import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useSettingsStore } from '../Store/settingsStore';
import { lightTheme, darkTheme } from '../Theme/colors';

const FEATURES_FREE = [
  { emoji: '💊', text: 'Hasta 3 medicamentos' },
  { emoji: '👤', text: 'Hasta 2 perfiles familiares' },
  { emoji: '🔔', text: 'Notificaciones de recordatorio' },
  { emoji: '📋', text: 'Historial de dosis (7 días)' },
  { emoji: '🩺', text: 'Signos vitales básicos' },
  { emoji: '🩸', text: 'Registro básico de ciclo menstrual' },
];

const FEATURES_PREMIUM = [
  { emoji: '💊', text: 'Medicamentos ilimitados' },
  { emoji: '👨‍👩‍👧', text: 'Perfiles familiares ilimitados' },
  { emoji: '📤', text: 'Exportar historial completo en PDF' },
  { emoji: '📊', text: 'Historial completo + estadísticas avanzadas' },
  { emoji: '🩺', text: 'Signos vitales ilimitados con gráficas' },
  { emoji: '🩸', text: 'Ciclo menstrual: fertilidad + síntomas + recordatorios' },
  { emoji: '🤖', text: 'MediBot — asistente de salud con IA' },
  { emoji: '🔔', text: 'Alarma con repetición cada 5 min' },
  { emoji: '💬', text: 'Soporte prioritario' },
];

export default function SubscriptionScreen({ navigation }: any) {
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleSubscribe = (plan: string) => {
    // Aquí integrarías RevenueCat o el proveedor de suscripciones
    Alert.alert(
      '🚧 En construcción',
      `La suscripción ${plan} se integrará con RevenueCat.\n\nPara configurarla, visita: revenuecat.com`,
      [{ text: 'Entendido' }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>← Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Premium</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroEmoji}>⭐</Text>
          <Text style={styles.heroTitle}>MediReminder Premium</Text>
          <Text style={styles.heroSubtitle}>
            Cuida tu salud sin límites
          </Text>
        </View>

        {/* Plans */}
        <View style={styles.plans}>
          {/* Monthly */}
          <TouchableOpacity
            style={[styles.planCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}
            onPress={() => handleSubscribe('mensual')}
          >
            <View style={styles.planHeader}>
              <Text style={[styles.planName, { color: theme.text }]}>Mensual</Text>
              <View style={[styles.planPrice, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.planPriceText, { color: theme.primary }]}>$49</Text>
                <Text style={[styles.planPricePeriod, { color: theme.textMuted }]}>/mes</Text>
              </View>
            </View>
            <Text style={[styles.planDesc, { color: theme.textSecondary }]}>
              Acceso completo, cancela cuando quieras
            </Text>
            <TouchableOpacity
              style={[styles.planButton, { backgroundColor: theme.primary }]}
              onPress={() => handleSubscribe('mensual')}
            >
              <Text style={styles.planButtonText}>Suscribirme mensual</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Annual (best value) */}
          <View style={[styles.bestValueWrapper, { borderColor: '#FFD700' }]}>
            <View style={[styles.bestValueBadge, { backgroundColor: '#FFD700' }]}>
              <Text style={styles.bestValueText}>🔥 MEJOR VALOR</Text>
            </View>
            <TouchableOpacity
              style={[styles.planCard, styles.planCardFeatured, {
                backgroundColor: theme.primaryDark,
                borderColor: 'transparent',
                shadowColor: theme.primary,
              }]}
              onPress={() => handleSubscribe('anual')}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: '#fff' }]}>Anual</Text>
                <View>
                  <Text style={styles.planOriginalPrice}>$588/año</Text>
                  <View style={[styles.planPrice, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={[styles.planPriceText, { color: '#FFD700' }]}>$299</Text>
                    <Text style={[styles.planPricePeriod, { color: 'rgba(255,255,255,0.7)' }]}>/año</Text>
                  </View>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 16 }}>
                Ahorra 49% — equivale a $24.9/mes
              </Text>
              <TouchableOpacity
                style={[styles.planButton, { backgroundColor: '#FFD700' }]}
                onPress={() => handleSubscribe('anual')}
              >
                <Text style={[styles.planButtonText, { color: '#1A1A1A' }]}>Suscribirme anual ⭐</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comparison */}
        <View style={styles.comparison}>
          <View style={[styles.comparisonCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <Text style={[styles.compTitle, { color: theme.text }]}>🆓 Plan Gratuito</Text>
            {FEATURES_FREE.map(f => (
              <View key={f.text} style={styles.featureRow}>
                <Text style={{ fontSize: 18 }}>{f.emoji}</Text>
                <Text style={[styles.featureText, { color: theme.textSecondary }]}>{f.text}</Text>
                <Text style={{ color: theme.success }}>✓</Text>
              </View>
            ))}
          </View>

          <View style={[styles.comparisonCard, { backgroundColor: theme.primaryDark, shadowColor: theme.shadow }]}>
            <Text style={[styles.compTitle, { color: '#FFD700' }]}>⭐ Plan Premium</Text>
            {FEATURES_PREMIUM.map(f => (
              <View key={f.text} style={styles.featureRow}>
                <Text style={{ fontSize: 18 }}>{f.emoji}</Text>
                <Text style={[styles.featureText, { color: 'rgba(255,255,255,0.85)' }]}>{f.text}</Text>
                <Text style={{ color: '#FFD700' }}>✓</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
          La suscripción se renueva automáticamente. Puedes cancelar en cualquier momento desde los ajustes de tu cuenta. Los precios pueden variar por región.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 56, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  backBtn: { fontSize: 15, fontWeight: '600' },
  hero: {
    alignItems: 'center', padding: 32,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroEmoji: { fontSize: 56, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 6 },
  plans: { padding: 16, gap: 16 },
  planCard: {
    borderRadius: 16, padding: 18, borderWidth: 1.5,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  planCardFeatured: { shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  bestValueWrapper: { borderRadius: 18, borderWidth: 2, overflow: 'hidden' },
  bestValueBadge: {
    paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center',
  },
  bestValueText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planName: { fontSize: 20, fontWeight: '800' },
  planOriginalPrice: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textDecorationLine: 'line-through', textAlign: 'right' },
  planPrice: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderRadius: 10, gap: 2 },
  planPriceText: { fontSize: 24, fontWeight: '900' },
  planPricePeriod: { fontSize: 13, marginBottom: 2 },
  planDesc: { fontSize: 13, marginBottom: 16 },
  planButton: {
    padding: 14, borderRadius: 12, alignItems: 'center',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  planButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  comparison: { padding: 16, gap: 12 },
  comparisonCard: {
    borderRadius: 16, padding: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  compTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureText: { flex: 1, fontSize: 14 },
  disclaimer: { fontSize: 11, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },
});