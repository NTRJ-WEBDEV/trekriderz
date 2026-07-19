import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

// Collapses the five button "roles" found scattered across the app (pill
// accent CTA, outlined decline/danger, filled solid, ghost/tinted, icon
// link) into one component driven by `variant`, instead of each screen
// redeclaring its own TouchableOpacity + styles per button.
export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends TouchableOpacityProps {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  label, variant = 'primary', size = 'md', icon, loading, fullWidth, disabled, style, ...rest
}: ButtonProps) {
  const isSmall = size === 'sm';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyles[variant],
        isSmall && styles.small,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#080C14' : AppColors.text} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={isSmall ? 15 : 17}
              color={textStyles[variant].color}
              style={label ? { marginRight: 6 } : undefined}
            />
          )}
          {label && <Text style={[styles.text, textStyles[variant], isSmall && styles.textSmall]}>{label}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    borderRadius: Radius.pill,
  },
  small: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: { fontSize: 14, fontWeight: '700' },
  textSmall: { fontSize: 12.5 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: AppColors.primary },
  outline: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  ghost: { backgroundColor: 'rgba(140,198,63,0.1)', borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)' },
  danger: { backgroundColor: AppColors.danger },
});

const textStyles = StyleSheet.create({
  primary: { color: '#080C14' },
  outline: { color: '#EF4444' },
  ghost: { color: AppColors.primary },
  danger: { color: '#FFF' },
});
