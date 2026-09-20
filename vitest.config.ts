import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, '__tests__/setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/domain/**/*.ts',
        'src/services/auth/**/*.ts',
        'src/services/api/**/*.ts',
        'src/services/mcp/**/*.ts',
      ],
      thresholds: {
        lines: 55,
        statements: 55,
        functions: 50,
        branches: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/domain': path.resolve(__dirname, 'src/domain'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/features': path.resolve(__dirname, 'src/features'),
      '@/design-system': path.resolve(__dirname, 'src/design-system'),
      '@/support': path.resolve(__dirname, 'src/support'),
      // Avoid loading React Native / Expo native entry points under Node.
      'react-native': path.resolve(__dirname, '__tests__/mocks/react-native.ts'),
      'expo-web-browser': path.resolve(
        __dirname,
        '__tests__/mocks/expo-web-browser.ts',
      ),
      'expo-crypto': path.resolve(__dirname, '__tests__/mocks/expo-crypto.ts'),
      expo: path.resolve(__dirname, '__tests__/mocks/expo.ts'),
      'expo-ai-kit': path.resolve(__dirname, '__tests__/mocks/expo-ai-kit.ts'),
    },
  },
});
