import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Swiper from 'react-native-swiper';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'slide1',
    title: 'Plan Perfect Treks',
    description: 'Custom routes and checklists tailored to your adventure level and budget',
    icon: 'map-outline',
  },
  {
    key: 'slide2',
    title: 'Discover Trails & Guides',
    description: 'Find verified homestays and expert local guides near you',
    icon: 'compass-outline',
  },
  {
    key: 'slide3',
    title: 'Connect & Share',
    description: 'Share stories, join group expeditions, and stay connected',
    icon: 'people-outline',
  },
];

const GREEN = '#8CC63F';
const BG = '#080C14';

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef<Swiper>(null);

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    router.replace('/login');
  };

  const handleSkip = () => {
    router.replace('/login');
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background-1.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(8,12,20,0.5)', 'rgba(8,12,20,0.85)', 'rgba(8,12,20,0.98)']}
        locations={[0, 0.45, 0.9]}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.container}>
          {/* Skip Button */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <Swiper
            ref={swiperRef}
            style={styles.wrapper}
            onIndexChanged={setCurrentIndex}
            loop={false}
            dot={<View style={styles.dot} />}
            activeDot={<View style={styles.activeDot} />}
            paginationStyle={styles.pagination}
          >
            {slides.map((slide) => (
              <View key={slide.key} style={styles.slide}>
                {/* Icon Container */}
                <View style={styles.iconContainer}>
                  <Ionicons name={slide.icon as any} size={72} color={GREEN} />
                </View>

                {/* Title */}
                <Text style={styles.title}>{slide.title}</Text>

                {/* Description */}
                <Text style={styles.description}>{slide.description}</Text>
              </View>
            ))}
          </Swiper>

          {/* Bottom Button */}
          <View style={styles.bottomContainer}>
            {currentIndex === slides.length - 1 ? (
              <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => swiperRef.current?.scrollBy(1)}
              >
                <Text style={styles.nextText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1 },
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '700',
  },
  wrapper: {},
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(140, 198, 63, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(140, 198, 63, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#B8BCC8',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    bottom: 120,
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: GREEN,
    width: 24,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomContainer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: GREEN,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: BG,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nextButton: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  nextText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
