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

/**
 * Semantic color system (light).
 * Editorial ink + teal-slate accent — a publishing control plane, not
 * Webflow Designer chrome (no #146EF5, no W mark) and not the default
 * AI purple.
 */
export const colors = {
  // Canvas (content layer — not glass)
  background: isIOS ? '#F3F0EB' : '#F4F1EC',
  backgroundElevated: isIOS ? '#FFFCF8' : '#FFFBFE',
  surface: '#FFFCF8',
  surfaceMuted: isIOS ? '#E7E2DA' : '#E4E0D8',
  surfaceVariant: isIOS ? '#EFEBE4' : '#E8E4DC',
  surfaceContainer: isIOS ? '#FFFCF8' : '#F3EFE8',

  // Ink
  text: '#1A1F24',
  textSecondary: isIOS ? '#3D444C' : '#3F454C',
  textTertiary: isIOS ? '#667078' : '#5F666E',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  // Brand / primary (teal-slate)
  accent: '#1A5355',
  accentSoft: isIOS ? 'rgba(26, 83, 85, 0.12)' : '#DCE8E8',
  accentContainer: '#DCE8E8',
  onAccentContainer: '#0B2A2B',

  // FAB
  fab: '#1A5355',
  fabPressed: '#164648',
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
  tabInactive: isIOS ? '#667078' : '#5F666E',
  tabActive: '#1A5355',
  pill: isIOS ? 'rgba(26, 31, 36, 0.08)' : '#E4E0D8',
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
