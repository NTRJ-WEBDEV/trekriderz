import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import MemberCard from '@/components/MemberCard';

export default function TripMembersScreen() {
  const { tripId } = useLocalSearchParams();
  const currentUser = useAuthStore((state) => state.user);

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [tripId]);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          id,
          role,
          status,
          user_id,
          users:user_id (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('trip_id', tripId);

      if (error) throw error;

      const transformedMembers = data.map((member: any) => ({
        id: member.id,
        full_name: member.users.full_name,
        email: member.users.email,
        avatar_url: member.users.avatar_url,
        role: member.role,
        status: member.status,
        userId: member.user_id,
      }));

      setMembers(transformedMembers);

      const currentMember = transformedMembers.find(m => m.userId === currentUser?.id);
      setIsOrganizer(currentMember?.role === 'organizer');

    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load trip members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const removeMember = async (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('trip_members')
                .delete()
                .eq('id', memberId);

              if (error) throw error;

              setMembers(prev => prev.filter(m => m.id !== memberId));
              Alert.alert('Success', 'Member removed successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#8CC63F" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const confirmedMembers = members.filter(m => m.status === 'accepted');
  const pendingMembers = members.filter(m => m.status === 'invited' || m.status === 'pending');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Members</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push(`/chat/${tripId}` as any)}
            style={styles.actionBtn}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#8CC63F" />
          </TouchableOpacity>
          {isOrganizer && (
            <TouchableOpacity
              onPress={() => router.push(`/invite/${tripId}` as any)}
              style={styles.actionBtn}
            >
              <Ionicons name="person-add-outline" size={24} color="#8CC63F" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadMembers} tintColor="#8CC63F" />
        }
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{confirmedMembers.length}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingMembers.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Confirmed members */}
        <Text style={styles.sectionTitle}>
          Confirmed Members ({confirmedMembers.length})
        </Text>
        {confirmedMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            showRemove={isOrganizer} onRemove={() => removeMember(member.id)}
          />
        ))}

        {/* Pending invites */}
        {pendingMembers.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Pending Invites ({pendingMembers.length})
            </Text>
            {pendingMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                showRemove={isOrganizer} onRemove={() => removeMember(member.id)}
              />
            ))}
          </>
        )}

        {members.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Members Yet</Text>
            <Text style={styles.emptySubtitle}>
              Invite friends to join your trip adventure
            </Text>
            {isOrganizer && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => router.push(`/invite/${tripId}` as any)}
              >
                <Ionicons name="person-add" size={18} color="#080C14" />
                <Text style={styles.inviteButtonText}>Invite Members</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {isOrganizer && members.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.inviteFloatButton}
            onPress={() => router.push(`/invite/${tripId}` as any)}
          >
            <Ionicons name="person-add" size={20} color="#080C14" />
            <Text style={styles.inviteFloatText}>Invite More Members</Text>
          </TouchableOpacity>
        </View>
      )}
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
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    color: '#8CC63F',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  inviteButtonText: {
    color: '#080C14',
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  inviteFloatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8CC63F',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  inviteFloatText: {
    color: '#080C14',
    fontWeight: '700',
    fontSize: 16,
  },
});
