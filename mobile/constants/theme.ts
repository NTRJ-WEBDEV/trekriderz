import { Colors } from './Colors';

// Colors.light and Colors.dark are already identical values (a fixed dark
// palette wearing a light/dark costume) — this re-exports that single
// source of truth rather than declaring a third copy, and adds the
// spacing/radius/typography tokens the app has never had a shared source
// for. New/redesigned screens should import from here instead of
// redeclaring local BG/CARD/GREEN constants.
export const AppColors = Colors.dark;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const Typography = {
  title: { fontSize: 20, fontWeight: '800' as const },
  subtitle: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.4 },
};
