import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Cross-platform design tokens aligned with:
 * - Apple HIG + Liquid Glass (navigation chrome floats above content)
 * - Material Design 3 / Material You (tonal surfaces, FAB, nav indicators)
 *
 * Liquid Glass belongs on the *navigation layer* only (tab bar, toolbars, FAB).
 * Content uses opaque tonal surfaces (M3) / grouped backgrounds (HIG).
 */

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/** Semantic color system (light). Product purple = brand primary. */
export const colors = {
  // Canvas (content layer — not glass)
  background: isIOS ? '#F2F2F7' : '#F7F5FA', // iOS systemGrouped / M3 surface
  backgroundElevated: isIOS ? '#FFFFFF' : '#FFFBFE',
  surface: '#FFFFFF',
  surfaceMuted: isIOS ? '#E5E5EA' : '#E7E0EC',
  surfaceVariant: isIOS ? '#F2F2F7' : '#E8DEF8',
  surfaceContainer: isIOS ? '#FFFFFF' : '#F3EDF7',

  // Ink
  text: isIOS ? '#000000' : '#1C1B1F',
  textSecondary: isIOS ? '#3C3C43' : '#49454F',
  textTertiary: isIOS ? '#636366' : '#625D66',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  // Brand / primary (Material primary + iOS accent-friendly)
  accent: '#5B4CFF',
  accentSoft: isIOS ? 'rgba(91, 76, 255, 0.12)' : '#E8DEF8',
  accentContainer: '#E8E0FF',
  onAccentContainer: '#1A0066',

  // FAB (M3 primary container / brand)
  fab: '#5B4CFF',
  fabPressed: '#4636E0',
  fabOn: '#FFFFFF',

  // Semantic
  danger: isIOS ? '#D70015' : '#B3261E',
  dangerSoft: isIOS ? 'rgba(255, 59, 48, 0.12)' : '#F9DEDC',
  warning: isIOS ? '#8A4F00' : '#6B4A00',
  warningSoft: isIOS ? 'rgba(255, 149, 0, 0.14)' : '#FFE08A',
  success: isIOS ? '#248A3D' : '#146C2E',
  successSoft: isIOS ? 'rgba(52, 199, 89, 0.14)' : '#C4EED0',

  // Chrome
  border: isIOS ? 'rgba(60, 60, 67, 0.12)' : '#CAC4D0',
  separator: isIOS ? 'rgba(60, 60, 67, 0.18)' : '#CAC4D0',
  tabInactive: isIOS ? '#636366' : '#3F3B43',
  tabActive: '#5B4CFF',
  pill: isIOS ? 'rgba(120, 120, 128, 0.12)' : '#E8DEF8',
  pillActive: '#FFFFFF',

  // Liquid Glass simulation (navigation layer)
  glassFill: isIOS ? 'rgba(255, 255, 255, 0.62)' : 'rgba(255, 251, 254, 0.92)',
  glassFillStrong: isIOS ? 'rgba(255, 255, 255, 0.78)' : 'rgba(255, 251, 254, 0.98)',
  glassBorder: isIOS ? 'rgba(255, 255, 255, 0.55)' : 'rgba(121, 116, 126, 0.2)',
  glassHighlight: 'rgba(255, 255, 255, 0.85)',
  scrim: 'rgba(0, 0, 0, 0.32)',
} as const;

/** 8pt grid (HIG + Material). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/**
 * Corner radii:
 * - iOS Liquid Glass: continuous large radii on chrome capsules
 * - M3: 12/16/28 for cards/FAB/nav
 */
export const radii = {
  sm: 8,
  md: isIOS ? 12 : 12,
  lg: isIOS ? 16 : 16,
  xl: isIOS ? 22 : 20,
  xxl: 28,
  pill: 999,
  fab: isIOS ? 28 : 16, // iOS rounder; M3 FAB often 16 in M3 shapes
  card: isIOS ? 16 : 16,
  sheet: isIOS ? 16 : 28,
} as const;

/** Minimum touch targets: 44pt HIG / 48dp Material — use 48 for both. */
export const touch = {
  min: 48,
  icon: 44,
} as const;

export const typography = {
  largeTitle: {
    fontSize: isIOS ? 34 : 32,
    fontWeight: '700' as const,
    letterSpacing: isIOS ? 0.37 : 0,
    lineHeight: isIOS ? 41 : 40,
    color: colors.text,
  } satisfies TextStyle,
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: colors.text,
  } satisfies TextStyle,
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    color: colors.text,
  } satisfies TextStyle,
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 25,
    color: colors.text,
  } satisfies TextStyle,
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.text,
  } satisfies TextStyle,
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 21,
    color: colors.text,
  } satisfies TextStyle,
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: colors.textSecondary,
  } satisfies TextStyle,
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: colors.textTertiary,
  } satisfies TextStyle,
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: colors.textSecondary,
  } satisfies TextStyle,
} as const;

/** Elevation — soft shadows for floating chrome (Liquid Glass / M3). */
export const elevation = {
  none: {} as ViewStyle,
  low: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 1 },
    default: {},
  })!,
  mid: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 3 },
    default: {},
  })!,
  high: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 6 },
    default: {},
  })!,
} as const;

/** Content padding so lists clear floating tab bar + FAB. */
export const layout = {
  screenPadding: spacing.lg,
  tabBarHeight: 64,
  tabBarMargin: spacing.lg,
  fabSize: 56,
  contentBottomInset: 120,
  sectionGap: spacing.lg,
} as const;
