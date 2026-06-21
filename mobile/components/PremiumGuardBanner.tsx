import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PremiumGuardBannerProps {
  onContactAdmin?: () => void;
}

export default function PremiumGuardBanner({ onContactAdmin }: PremiumGuardBannerProps) {
  const handleContact = () => {
    if (onContactAdmin) {
      onContactAdmin();
    } else {
      Linking.openURL(
        'mailto:admin@trekriderz.in?subject=Premium Guide Upgrade Request&body=Hi TrekRiderz team, I would like to upgrade my guide account to Premium to host expeditions.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Background glow */}
      <View style={styles.glowCircle} />

      {/* Icon */}
      <View style={styles.iconWrapper}>
        <LinearGradient
          colors={['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.05)']}
          style={styles.iconGradient}
        >
          <Ionicons name="ribbon" size={56} color="#F59E0B" />
        </LinearGradient>
      </View>

      {/* Crown stars decorative */}
      <View style={styles.starsRow}>
        {[0, 1, 2].map((i) => (
          <Ionicons key={i} name="star" size={i === 1 ? 14 : 10} color="rgba(245,158,11,0.4)" />
        ))}
      </View>

      {/* Title */}
      <Text style={styles.title}>Premium Guide Access Required</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Only verified premium guides can host group expeditions on TrekRiderz. Contact the admin team to
        get your premium status activated — it's free for verified guides!
      </Text>

      {/* Perks list */}
      <View style={styles.perks}>
        {[
          { icon: 'map-outline', text: 'Host unlimited guided expeditions' },
          { icon: 'people-outline', text: 'Manage group participants & seats' },
          { icon: 'ribbon-outline', text: 'Premium badge on your profile' },
          { icon: 'trending-up-outline', text: 'Featured in expedition discovery' },
        ].map((perk, i) => (
          <View key={i} style={styles.perkRow}>
            <View style={styles.perkIconWrap}>
              <Ionicons name={perk.icon as any} size={16} color="#F59E0B" />
            </View>
            <Text style={styles.perkText}>{perk.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA Button */}
      <TouchableOpacity style={styles.ctaButton} onPress={handleContact} activeOpacity={0.85}>
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          style={styles.ctaGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="mail-outline" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Request Premium Upgrade</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.note}>
        Our team will review your guide profile and activate premium within 24 hours.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#080C14',
    position: 'relative',
    overflow: 'hidden',
  },
  glowCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(245,158,11,0.04)',
    top: '20%',
    left: '50%',
    marginLeft: -150,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  perks: {
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 32,
    backgroundColor: 'rgba(245,158,11,0.05)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.12)',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  perkIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perkText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  ctaButton: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
