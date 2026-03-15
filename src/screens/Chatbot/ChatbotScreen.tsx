import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, StatusBar,
  ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../Store/authStore';
import { useSettingsStore } from '../Store/settingsStore';
import { useMedStore } from '../Store/medStore';
import { useVitalStore, VITAL_CONFIG } from '../Store/vitalStore';
import { useFamilyStore } from '../Store/familyStore';
import { lightTheme, darkTheme } from '../Theme/colors';

// ── Tipos ────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: NavAction[];
}

interface NavAction {
  label: string;
  screen: string;
  params?: any;
}

// ── Sugerencias rápidas ──────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  '¿Cómo agrego un medicamento?',
  '¿Cómo va mi adherencia?',
  '¿Qué es la presión arterial alta?',
  'Muéstrame mis signos vitales',
  '¿Cuál es el rango normal de glucosa?',
  '¿Cómo exporto mi reporte?',
];

// ── Construir contexto del usuario para el sistema ───────────────
function buildSystemPrompt(userData: any, medications: any[], vitals: any[], history: any[], activeProfile: any) {
  const taken = history.filter(h => h.taken).length;
  const total = history.length;
  const adherence = total > 0 ? Math.round((taken / total) * 100) : null;

  // Últimos vitales por tipo
  const latestVitals: Record<string, string> = {};
  for (const v of vitals) {
    if (!latestVitals[v.type]) {
      latestVitals[v.type] = v.type === 'blood_pressure'
        ? `${v.systolic}/${v.diastolic} mmHg`
        : `${v.value} ${VITAL_CONFIG[v.type as keyof typeof VITAL_CONFIG]?.unit || ''}`;
    }
  }

  return `Eres MediBot, el asistente de salud de MediReminder. Eres amable, empático y profesional.

DATOS DEL USUARIO:
- Nombre: ${userData?.displayName || 'Usuario'}
- Perfil activo: ${activeProfile?.name || 'Principal'} (${activeProfile?.relation || 'Yo'})
- Plan: ${userData?.isPremium ? 'Premium' : 'Gratuito'}

MEDICAMENTOS ACTUALES (${medications.length}):
${medications.length === 0 ? '- Sin medicamentos registrados' :
  medications.map(m => `- ${m.name} ${m.gramaje} cada ${m.intervalHours === 168 ? '7 días' : m.intervalHours + 'h'}${m.durationDays ? ` por ${m.durationDays} días` : ''}`).join('\n')}

ADHERENCIA (últimas dosis registradas):
${adherence !== null ? `- ${adherence}% (${taken} tomadas de ${total} programadas)` : '- Sin historial registrado'}

ÚLTIMOS SIGNOS VITALES:
${Object.keys(latestVitals).length === 0 ? '- Sin registros de signos vitales' :
  Object.entries(latestVitals).map(([type, val]) => `- ${VITAL_CONFIG[type as keyof typeof VITAL_CONFIG]?.label || type}: ${val}`).join('\n')}

PANTALLAS DE LA APP (para navegación):
- Home: pantalla principal con medicamentos del día
- Medications: lista y gestión de medicamentos
- AddMedication: formulario para agregar medicamento
- History: historial con calendario
- Vitals: signos vitales y gráficas
- AddVital: registrar un signo vital
- Family: perfiles familiares
- Settings: ajustes, editar perfil, exportar PDF
- ExportHistory: generar reporte PDF

REGLAS:
1. Responde SIEMPRE en español, de forma clara y concisa (máx 3 párrafos)
2. Si el usuario pregunta sobre sus datos, usa la información real proporcionada arriba
3. Para información médica, da información general útil pero SIEMPRE indica que consulte a su médico para diagnósticos
4. Si puedes ayudar navegando a una pantalla, incluye al final del JSON de acciones
5. NUNCA diagnostiques enfermedades ni recetes medicamentos específicos
6. Si preguntan cómo hacer algo en la app, da instrucciones paso a paso

FORMATO DE RESPUESTA:
Responde en texto normal. Si quieres sugerir navegar a una pantalla, agrega al final exactamente este formato:
[ACTIONS:{"actions":[{"label":"Ir a Medicamentos","screen":"Medications"},{"label":"Agregar medicamento","screen":"AddMedication"}]}]

Solo incluye ACTIONS cuando sea verdaderamente útil para el usuario.`;
}

// ── Componente principal ─────────────────────────────────────────
export default function ChatbotScreen({ navigation }: any) {
  const { userData } = useAuthStore();
  const { isDarkMode } = useSettingsStore();
  const { medications, history } = useMedStore();
  const { records: vitals } = useVitalStore();
  const { profiles, activeProfileId } = useFamilyStore();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `¡Hola ${userData?.displayName?.split(' ')[0] || ''}! 👋 Soy MediBot, tu asistente de salud.\n\nPuedo ayudarte con información sobre tus medicamentos, signos vitales, o guiarte dentro de la app. ¿En qué te puedo ayudar?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Parsear acciones de navegación del mensaje
  const parseActions = (text: string): { content: string; actions?: NavAction[] } => {
    const actionMatch = text.match(/\[ACTIONS:({.*?})\]/s);
    if (!actionMatch) return { content: text };
    try {
      const parsed = JSON.parse(actionMatch[1]);
      const content = text.replace(/\[ACTIONS:.*?\]/s, '').trim();
      return { content, actions: parsed.actions };
    } catch {
      return { content: text.replace(/\[ACTIONS:.*?\]/s, '').trim() };
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setShowSuggestions(false);
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Construir historial para la API (sin el mensaje de bienvenida)
      const apiHistory = messages
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }));

      // 🔧 Reemplaza esta URL con la de tu backend en Railway
      const BACKEND_URL = 'https://medireminder-backend-production.up.railway.app';

      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildSystemPrompt(userData, medications, vitals, history, activeProfile),
          messages: [
            ...apiHistory,
            { role: 'user', content: text.trim() },
          ],
        }),
      });

      const data = await response.json();
      const rawContent = data.content?.[0]?.text || 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.';
      const { content, actions } = parseActions(rawContent);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date(),
        actions,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg = e?.message?.includes('Network')
        ? 'Sin conexión a internet. Verifica tu red e intenta de nuevo.'
        : `Error de conexión con el servidor. Asegúrate de que el backend esté activo. (${e?.message || 'desconocido'})`;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errMsg,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavAction = (action: NavAction) => {
    // Rutas del Stack
    const stackRoutes = ['AddMedication', 'AddVital', 'ExportHistory', 'EditProfile', 'Subscription', 'AddProfile'];
    if (stackRoutes.includes(action.screen)) {
      navigation.navigate(action.screen, action.params);
    } else {
      // Rutas del Tab
      navigation.navigate('Main', { screen: action.screen });
    }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={{ fontSize: 14 }}>🤖</Text>
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: theme.primary }]
            : [styles.bubbleBot, { backgroundColor: theme.surface, borderColor: theme.border }],
        ]}>
          <Text style={[styles.bubbleText, { color: isUser ? '#fff' : theme.text }]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(255,255,255,0.6)' : theme.textMuted }]}>
            {formatTime(item.timestamp)}
          </Text>

          {/* Botones de navegación */}
          {item.actions && item.actions.length > 0 && (
            <View style={styles.actionsRow}>
              {item.actions.map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.actionBtn, { backgroundColor: theme.primary + '18', borderColor: theme.primary }]}
                  onPress={() => handleNavAction(action)}
                >
                  <Text style={[styles.actionBtnText, { color: theme.primary }]}>
                    → {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: theme.primary }]}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>MediBot</Text>
            <Text style={[styles.headerSub, { color: theme.success }]}>● En línea</Text>
          </View>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={[styles.msgRow]}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleBot, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.typingDots}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={[styles.dot, { backgroundColor: theme.textMuted }]} />
                  ))}
                </View>
              </View>
            </View>
          ) : null
        }
      />

      {/* Sugerencias rápidas */}
      {showSuggestions && (
        <View style={styles.suggestionsWrapper}>
          <FlatList
            data={QUICK_SUGGESTIONS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.suggestionsRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => sendMessage(item)}
              >
                <Text style={[styles.suggestionText, { color: theme.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? theme.primary : theme.border }]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { fontSize: 15, fontWeight: '500', width: 60 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, fontWeight: '600' },
  messagesList: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%', borderRadius: 18, padding: 12, borderWidth: 1,
  },
  bubbleUser: { borderRadius: 18, borderTopRightRadius: 4, borderWidth: 0 },
  bubbleBot: { borderTopLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  typingDots: { flexDirection: 'row', gap: 4, padding: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, opacity: 0.5 },
  suggestionsWrapper: { paddingVertical: 8 },
  suggestionsRow: { paddingHorizontal: 12, gap: 8 },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  suggestionText: { fontSize: 13 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});