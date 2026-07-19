import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/theme';

interface Props {
  size?: 'sm' | 'lg';
  tagline?: boolean;
}

// Shared "TrekRiderz" lockup — full combined logo (mountain/hiker/compass
// mark + wordmark baked into one transparent image) used by the Feed/
// Adventure headers (sm) and the login/signup heroes (lg, with tagline).
export default function Wordmark({ size = 'sm', tagline = false }: Props) {
  const isLg = size === 'lg';
  return (
    <View style={styles.wrap}>
      <Image
        source={require('@/assets/images/header-logo.png')}
        style={isLg ? styles.logoLg : styles.logo}
        resizeMode="contain"
      />
      {tagline && <Text style={styles.tagline}>TREK. TRAVEL. CONNECT.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  logo: { width: 48, height: 48 },
  logoLg: { width: 110, height: 110 },
  tagline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: AppColors.subtext,
    marginTop: 2,
  },
});
