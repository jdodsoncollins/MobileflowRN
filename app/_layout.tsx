import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/shell/AppContext';
import { colors } from '../src/design-system/theme';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.backgroundElevated,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

const sheet = {
  presentation: 'formSheet' as const,
  headerShown: false,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.backgroundElevated },
  sheetGrabberVisible: true,
};

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: colors.text }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="sites" options={{ ...sheet, sheetAllowedDetents: [0.7, 1] }} />
          <Stack.Screen name="command" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="publish" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="health" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="seo" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        </Stack>
      </ThemeProvider>
    </AppProvider>
  );
}
