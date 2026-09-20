import type { ExpoConfig } from 'expo/config';

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

const name = env('EXPO_PUBLIC_APP_NAME') || 'Mobileflow';
const slug = env('EXPO_PUBLIC_SLUG') || 'mobileflow';
const scheme = env('EXPO_PUBLIC_SCHEME') || 'mobileflow';
const bundleId = env('EXPO_PUBLIC_BUNDLE_ID') || 'com.example.mobileflowrn';
const androidPackage = env('EXPO_PUBLIC_ANDROID_PACKAGE') || bundleId;
const appleTeamId = env('EXPO_PUBLIC_APPLE_TEAM_ID');
const easProjectId = env('EXPO_PUBLIC_EAS_PROJECT_ID');
const easOwner = env('EXPO_PUBLIC_EAS_OWNER');

const config: ExpoConfig = {
  name,
  slug,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F3F0EB',
  scheme,
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
    ...(appleTeamId ? { appleTeamId } : {}),
    infoPlist: {
      NSAppleIntelligenceUsageDescription:
        'Mobileflow uses on-device Apple Intelligence to draft reviewable Webflow action plans. Plans never invent page IDs and always require your confirmation before execution.',
    },
  },
  android: {
    package: androidPackage,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#F3F0EB',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    productSourceOfTruth: 'https://github.com/jdodsoncollins/MobileflowRN',
    webflowClientId: env('EXPO_PUBLIC_WEBFLOW_CLIENT_ID'),
    oauthRedirectUri:
      env('EXPO_PUBLIC_OAUTH_REDIRECT_URI') || `${scheme}://oauth/callback`,
    tokenProxyUrl: env('EXPO_PUBLIC_TOKEN_PROXY_URL'),
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
  plugins: [
    'expo-router',
    [
      'expo-secure-store',
      {
        faceIDPermission: false,
      },
    ],
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Mobileflow to select photos you choose for upload to your Webflow site.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#F3F0EB',
      },
    ],
    './plugins/withMinIosPodTarget.js',
    [
      'expo-ai-kit',
      {
        llm: true,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '26.4',
        },
        android: {
          minSdkVersion: 35,
        },
      },
    ],
    'expo-font',
  ],
  ...(easOwner ? { owner: easOwner } : {}),
};

export default config;
