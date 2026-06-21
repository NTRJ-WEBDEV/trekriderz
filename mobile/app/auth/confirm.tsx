import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type Status = 'loading' | 'success' | 'error';

export default function EmailConfirmScreen() {
  const { access_token, refresh_token, code, error_description } = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    code?: string;
    error_description?: string;
  }>();

  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    processConfirmation();
  }, []);

  const processConfirmation = async () => {
    // Supabase sent an error in the redirect
    if (error_description) {
      setErrorMsg(decodeURIComponent(error_description));
      setStatus('error');
      return;
    }

    try {
      let session = null;

      if (access_token && refresh_token) {
        // OTP / magic-link flow — tokens come directly in the URL
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
        session = data.session;
      } else if (code) {
        // PKCE flow — exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        session = data.session;
      } else {
        // Params missing — check if session already exists (link might have auto-verified)
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (!session) throw new Error('Verification link expired or already used.');
      }

      if (session) {
        setSession(session);
        setUser(session.user);
      }

      setStatus('success');
    } catch (e: any) {
      setErrorMsg(e.message || 'Verification failed. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8CC63F" />
        <Text style={styles.loadingText}>Verifying your email...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={[styles.iconCircle, styles.iconCircleError]}>
            <Ionicons name="close" size={44} color="#EF4444" />
          </View>
          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <Text style={styles.hint}>
            The link may have expired or already been used. Request a new confirmation email from the login screen.
          </Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.btnSecondaryText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={52} color="#8CC63F" />
        </View>

        <Text style={styles.badge}>✅ ACCOUNT VERIFIED</Text>
        <Text style={styles.title}>You're all set!{'\n'}Welcome to TrekRiderz 🏔️</Text>
        <Text style={styles.subtitle}>
          Your email has been confirmed. Start exploring treks, connecting with guides, and planning adventures.
        </Text>

        <View style={styles.features}>
          {[
            { icon: 'compass-outline', text: 'Browse curated treks & expeditions' },
            { icon: 'people-outline', text: 'Connect with a community of travelers' },
            { icon: 'ribbon-outline', text: 'Book verified guides & homestays' },
          ].map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <Ionicons name={f.icon as any} size={18} color="#8CC63F" />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-forward-circle-outline" size={20} color="#000" />
          <Text style={styles.btnText}>Enter the App</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  center: {
    flex: 1, backgroundColor: '#080C14',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },

  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },

  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderWidth: 2, borderColor: 'rgba(140,198,63,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },

  badge: {
    fontSize: 11, fontWeight: '800', color: '#8CC63F',
    letterSpacing: 2, marginBottom: 4,
  },
  title: {
    fontSize: 26, fontWeight: '900', color: '#FFF',
    textAlign: 'center', lineHeight: 34,
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 21,
  },
  hint: {
    fontSize: 13, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', lineHeight: 19, marginTop: -4,
  },

  features: { width: '100%', gap: 12, marginTop: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8CC63F', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 32,
    gap: 8, marginTop: 12, width: '100%',
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
});
