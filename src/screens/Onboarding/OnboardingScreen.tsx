import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export const ONBOARDING_KEY = 'onboarding_completed';

const SLIDES = [
  {
    id: '1',
    emoji: '💊',
    title: 'Nunca olvides\ntu medicamento',
    subtitle: 'MediReminder te recuerda cuándo tomar cada medicamento con notificaciones inteligentes.',
    bg: '#2E7D32',
    accent: '#4CAF50',
  },
  {
    id: '2',
    emoji: '🔥',
    title: 'Construye\nbuenos hábitos',
    subtitle: 'Mantén tu racha de días consecutivos y ve tu adherencia mejorar con el tiempo.',
    bg: '#E65100',
    accent: '#FF9800',
  },
  {
    id: '3',
    emoji: '👨‍👩‍👧',
    title: 'Cuida a\ntoda tu familia',
    subtitle: 'Crea perfiles para cada familiar y gestiona sus medicamentos desde un solo lugar.',
    bg: '#1565C0',
    accent: '#42A5F5',
  },
  {
    id: '4',
    emoji: '📅',
    title: 'Historial\ncompleto',
    subtitle: 'Revisa en el calendario qué días tomaste tus medicamentos y comparte el reporte con tu médico.',
    bg: '#6A1B9A',
    accent: '#AB47BC',
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
      setActiveIndex(activeIndex + 1);
    } else {
      handleDone();
    }
  };

  const handleSkip = () => handleDone();

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  };

  const currentSlide = SLIDES[activeIndex];

  return (
    <View style={[styles.container, { backgroundColor: currentSlide.bg }]}>

      {/* Skip button */}
      {activeIndex < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Omitir</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { backgroundColor: item.bg }]}>
            {/* Big emoji */}
            <View style={[styles.emojiContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>

            {/* Decorative circles */}
            <View style={[styles.circle1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
            <View style={[styles.circle2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

            {/* Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={styles.bottomBar}>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity }]}
              />
            );
          })}
        </View>

        {/* Next / Start button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: '#fff' }]}
          onPress={handleNext}
        >
          <Text style={[styles.nextBtnText, { color: currentSlide.bg }]}>
            {activeIndex === SLIDES.length - 1 ? '¡Empezar! 🚀' : 'Siguiente →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute', top: 56, right: 24, zIndex: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
  },
  skipText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  slide: {
    width, height,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  circle1: {
    position: 'absolute', width: 350, height: 350, borderRadius: 175,
    top: -80, right: -80,
  },
  circle2: {
    position: 'absolute', width: 250, height: 250, borderRadius: 125,
    bottom: 120, left: -60,
  },
  emojiContainer: {
    width: 160, height: 160, borderRadius: 80,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 48,
  },
  emoji: { fontSize: 80 },
  textContainer: { alignItems: 'center', gap: 16 },
  title: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    textAlign: 'center', lineHeight: 42,
  },
  subtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 24, maxWidth: 300,
  },
  bottomBar: {
    position: 'absolute', bottom: 48, left: 0, right: 0,
    paddingHorizontal: 32, alignItems: 'center', gap: 24,
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  nextBtn: {
    width: '100%', paddingVertical: 18,
    borderRadius: 18, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  nextBtnText: { fontSize: 17, fontWeight: '800' },
});
