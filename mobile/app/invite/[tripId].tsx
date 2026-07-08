import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

export default function InviteMembersScreen() {
  const { tripId } = useLocalSearchParams();
  const currentUser = useAuthStore((state) => state.user);

  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [sending, setSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const inviteLink = `https://trekriderz.app/join/${tripId}`;

  const searchUser = async () => {
    if (!searchEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSearching(true);
    setFoundUser(null);

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('email', searchEmail.trim().toLowerCase())
        .limit(1);

      if (error) throw error;

      if (users && users.length > 0) {
        const profile = users[0];

        const { data: existingMember } = await supabase
          .from('trip_members')
          .select('id')
          .eq('trip_id', tripId)
          .eq('user_id', profile.id)
          .single();

        if (existingMember) {
          Alert.alert('Already Member', 'This user is already a member of this trip');
          return;
        }

        setFoundUser({
          id: profile.id,
          email: profile.email,
          user_metadata: { full_name: profile.full_name },
        });
      } else {
        Alert.alert('User Not Found', 'No user found with this email address. They need to sign up first.');
      }
    } catch (error: any) {
      console.error('Error searching user:', error);
      Alert.alert('Error', 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const sendInvite = async () => {
    if (!foundUser) return;

    setSending(true);

    try {
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert([
          {
            trip_id: tripId,
            user_id: foundUser.id,
            role: 'member',
            status: 'invited',
          },
        ]);

      if (memberError) throw memberError;

      const { data: trip } = await supabase
        .from('trips')
        .select('title')
        .eq('id', tripId)
        .single();

      await supabase
        .from('notifications')
        .insert([
          {
            user_id: foundUser.id,
            type: 'trip_invite',
            title: 'Trip Invitation',
            message: `${(currentUser as any)?.full_name || 'Someone'} invited you to join "${trip?.title}"`,
            related_id: tripId,
            metadata: { trip_id: tripId },
          },
        ]);

      Alert.alert(
        'Invitation Sent!',
        `Invitation sent to ${foundUser.user_metadata?.full_name || foundUser.email}`,
        [
          {
            text: 'Invite Another',
            onPress: () => {
              setSearchEmail('');
              setFoundUser(null);
            },
          },
          {
            text: 'Done',
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error sending invite:', error);
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    Clipboard.setString(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareViaWhatsApp = async () => {
    try {
      const message = `Join my trip on TrekRiderz! Click to join: ${inviteLink}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await import('react-native').then(({ Linking }) => Linking.canOpenURL(whatsappUrl));
      if (canOpen) {
        await import('react-native').then(({ Linking }) => Linking.openURL(whatsappUrl));
      } else {
        handleShareLink();
      }
    } catch {
      handleShareLink();
    }
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Join my trip on TrekRiderz! ${inviteLink}`,
        title: 'Join my TrekRiderz trip',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Members</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Invite Link Section */}
        <View style={styles.linkCard}>
          <Text style={styles.linkCardTitle}>Shareable Invite Link</Text>
          <Text style={styles.linkCardSubtitle}>
            Share this link with anyone to let them join your trip
          </Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
            <TouchableOpacity onPress={copyLink} style={styles.copyBtn}>
              <Ionicons
                name={linkCopied ? 'checkmark' : 'copy-outline'}
                size={20}
                color={linkCopied ? '#8CC63F' : 'rgba(255,255,255,0.6)'}
              />
            </TouchableOpacity>
          </View>
          {linkCopied && (
            <Text style={styles.copiedText}>Link copied!</Text>
          )}

          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={shareViaWhatsApp}>
              <Text style={styles.shareBtnIcon}>💬</Text>
              <Text style={styles.shareBtnText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareLink}>
              <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or invite by email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Instruction */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionIcon}>👥</Text>
          <Text style={styles.instructionText}>
            Search for friends by email and add them directly to your trip
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchSection}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="friend@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchEmail}
              onChangeText={(t) => {
                setSearchEmail(t);
                if (foundUser) setFoundUser(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.searchButton, searching && styles.searchButtonDisabled]}
              onPress={searchUser}
              disabled={searching}
            >
              {searching
                ? <ActivityIndicator color="#080C14" size="small" />
                : <Text style={styles.searchButtonText}>Search</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Found User Card */}
        {foundUser && (
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {foundUser.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                  foundUser.email.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {foundUser.user_metadata?.full_name || 'User'}
              </Text>
              <Text style={styles.userEmail}>{foundUser.email}</Text>
            </View>
            <TouchableOpacity
              style={[styles.inviteButton, sending && styles.inviteButtonDisabled]}
              onPress={sendInvite}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#080C14" />
                : <Text style={styles.inviteButtonText}>Invite</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    padding: 4,
    width: 36,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  linkCard: {
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.25)',
    marginBottom: 24,
  },
  linkCardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  linkCardSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  linkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    flex: 1,
  },
  copyBtn: {
    padding: 2,
  },
  copiedText: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'right',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  shareBtnIcon: {
    fontSize: 18,
  },
  shareBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  instructionIcon: {
    fontSize: 24,
  },
  instructionText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  searchSection: {
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 14,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchButton: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#080C14',
    fontSize: 15,
    fontWeight: '700',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8CC63F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#080C14',
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 2,
  },
  inviteButton: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  inviteButtonDisabled: {
    opacity: 0.6,
  },
  inviteButtonText: {
    color: '#080C14',
    fontWeight: '700',
    fontSize: 14,
  },
});
