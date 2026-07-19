import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authHelpers } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { AppColors } from '@/constants/theme';
import Wordmark from '@/components/ui/Wordmark';

const GREEN = AppColors.primary;
const BG = AppColors.background;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await authHelpers.signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message);
      return;
    }
    if (data.user) {
      setUser(data.user);
      router.replace('/(tabs)');
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background-2.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(8,12,20,0.55)', 'rgba(8,12,20,0.88)', 'rgba(8,12,20,1)']}
        locations={[0, 0.45, 0.85]}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kbView}
          >
            {/* Logo / Hero */}
            <View style={styles.hero}>
              <Wordmark size="lg" tagline />
              <Text style={styles.heroHeadline}>Welcome back,{'\n'}Adventurer 🏔️</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              {/* Email */}
              <View style={styles.fieldRow}>
                <Ionicons name="mail-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#6B7280"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password */}
              <View style={styles.fieldRow}>
                <Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor="#6B7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Forgot */}
              <TouchableOpacity onPress={() => router.push('/forgot-password' as any)} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.btnText}>LOG IN</Text>}
              </TouchableOpacity>

              {/* Sign Up */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                  <Text style={styles.footerLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Legal */}
              <View style={styles.legalRow}>
                <TouchableOpacity onPress={() => router.push('/legal/privacy-policy' as any)}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.legalDot}> · </Text>
                <TouchableOpacity onPress={() => router.push('/legal/terms-of-service' as any)}>
                  <Text style={styles.legalLink}>Terms of Service</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1 },
  safe: { flex: 1 },
  kbView: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 32 },

  hero: { marginBottom: 36, paddingHorizontal: 4, gap: 16 },
  heroHeadline: { color: '#FFF', fontSize: 30, fontWeight: '900', lineHeight: 38 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
  },
  eyeBtn: { padding: 4 },

  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { color: GREEN, fontSize: 13, fontWeight: '600' },

  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: BG, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },

  footerRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  footerText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  footerLink: { color: GREEN, fontSize: 14, fontWeight: '700' },

  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  legalLink: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  legalDot: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },
});
