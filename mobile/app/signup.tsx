import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authHelpers } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (!agreedToTerms || !agreedToPrivacy) {
      Alert.alert('Agreement Required', 'Please read and agree to both the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    const { data, error } = await authHelpers.signUp(email.trim(), password, fullName.trim());
    setLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off — user is instantly signed in
      setUser(data.session.user);
      router.replace('/(tabs)');
    } else {
      // Email confirmation is on — ask user to verify first
      Alert.alert(
        'Account Created! 🎉',
        'Check your email to verify your account, then log in.',
        [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
      );
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
        colors={['rgba(8,12,20,0.4)', 'rgba(8,12,20,0.82)', 'rgba(8,12,20,1)']}
        locations={[0, 0.35, 0.7]}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kbView}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hero */}
              <View style={styles.hero}>
                <View style={styles.logoRow}>
                  <Ionicons name="triangle" size={20} color={GREEN} />
                  <Text style={styles.logoText}>TREK<Text style={styles.logoGreen}>RIDERZ</Text></Text>
                </View>
                <Text style={styles.heroSub}>TREK. TRAVEL. CONNECT.</Text>
                <Text style={styles.heroHeadline}>Join the{'\n'}Community 🚀</Text>
              </View>

              {/* Card */}
              <View style={styles.card}>

                {/* Full Name */}
                <View style={styles.fieldRow}>
                  <Ionicons name="person-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#6B7280"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

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
                    placeholder="Password (min 6 chars)"
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

                {/* Confirm Password */}
                <View style={styles.fieldRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#6B7280"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>

                {/* Terms Agreement */}
                <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedToTerms(!agreedToTerms)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreedToTerms && styles.checkboxOn]}>
                    {agreedToTerms && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                  <Text style={styles.checkText}>
                    I agree to the{' '}
                    <Text style={styles.checkLink} onPress={() => router.push('/legal/terms-of-service' as any)}>
                      Terms of Service
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Privacy Agreement */}
                <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedToPrivacy(!agreedToPrivacy)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreedToPrivacy && styles.checkboxOn]}>
                    {agreedToPrivacy && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                  <Text style={styles.checkText}>
                    I have read the{' '}
                    <Text style={styles.checkLink} onPress={() => router.push('/legal/privacy-policy' as any)}>
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Create Account */}
                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleSignup}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={BG} />
                    : <Text style={styles.btnText}>CREATE ACCOUNT</Text>}
                </TouchableOpacity>

                {/* Login Link */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/login')}>
                    <Text style={styles.footerLink}>Log In</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
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
  kbView: { flex: 1 },

  hero: { marginTop: 48, marginBottom: 28, paddingHorizontal: 28 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  logoText: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  logoGreen: { color: GREEN },
  heroSub: { color: GREEN, fontSize: 11, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  heroHeadline: { color: '#FFF', fontSize: 30, fontWeight: '900', lineHeight: 38 },

  card: {
    marginHorizontal: 24,
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

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 20,
  },
  checkLink: {
    color: GREEN,
    fontWeight: '600',
  },

  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: BG, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },

  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  footerLink: { color: GREEN, fontSize: 14, fontWeight: '700' },
});
