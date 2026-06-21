import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MemberCardProps {
  member: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
    role: 'organizer' | 'member';
    status: 'invited' | 'accepted' | 'declined';
  };
  onRemove?: () => void;
  showRemove?: boolean;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, onRemove, showRemove }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#10B981';
      case 'invited':
        return '#F59E0B';
      case 'declined':
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Text style={styles.avatarText}>
              {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(member.status) }]} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {member.full_name || member.email?.split('@')[0]}
        </Text>
        <View style={styles.roleContainer}>
          <Text style={[styles.role, member.role === 'organizer' && styles.organizerRole]}>
            {member.role.toUpperCase()}
          </Text>
          {member.status !== 'accepted' && (
            <Text style={[styles.statusText, { color: getStatusColor(member.status) }]}>
              • {member.status}
            </Text>
          )}
        </View>
      </View>

      {showRemove && member.role !== 'organizer' && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  placeholderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8CC63F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#080C14',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  role: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  organizerRole: {
    color: '#F59E0B',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  removeBtn: {
    padding: 8,
  },
});

export default MemberCard;
