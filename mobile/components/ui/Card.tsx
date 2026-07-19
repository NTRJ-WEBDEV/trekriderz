import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { AppColors, Radius, Spacing } from '@/constants/theme';

// One rounded-container primitive instead of every screen picking its own
// borderRadius (10–26px were all in concurrent use) and card opacity.
interface CardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
}

export default function Card({ padded = true, elevated = false, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[styles.base, padded && styles.padded, elevated && styles.elevated, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  padded: { padding: Spacing.lg },
  elevated: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
