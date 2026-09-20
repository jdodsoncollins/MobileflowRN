import { useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import { cryptoRandomId } from '../../domain/actions/mobileflowAction';
import { WebflowAPIClientImpl } from '../../services/api/webflowAPIClient';
import { bundledOAuthConfig } from '../../services/auth';
import {
  createExpoAuthSessionOpener,
  createPlatformTokenStore,
  WebflowAuthService,
} from '../../services/auth';
import { useReducedMotion } from '../../design-system/useReducedMotion';
import { preparePickedPhoto } from './photoAsset';

/**
 * Photo → Asset: real picker + live multipart upload.
 * Activity records real success or failure only.
 */
export function PhotoAssetUploadSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { selectedSite, appendActivity } = useApp();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const reduceMotion = useReducedMotion();

  const pickAndUpload = async () => {
    if (!selectedSite) {
      setError('Select a connected site first.');
      return;
    }
    setError(null);
    setStatus(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const photo = preparePickedPhoto(asset);
      // Reuse same token store as the app session
      const store = createPlatformTokenStore();
      const auth = new WebflowAuthService({
        store,
        config: bundledOAuthConfig,
        openAuthSession: createExpoAuthSessionOpener(),
      });
      await auth.hydrate();
      const api = new WebflowAPIClientImpl({
        tokenProvider: async () => {
          try {
            return await auth.accessToken();
          } catch {
            return null;
          }
        },
      });
      const uploaded = await api.uploadAsset(
        selectedSite.id,
        photo.fileName,
        photo.data,
        photo.contentType,
      );
      setStatus(`Uploaded ${uploaded.fileName}`);
      AccessibilityInfo.announceForAccessibility(`Uploaded ${uploaded.fileName}`);
      try {
        await appendActivity({
          id: cryptoRandomId(),
          timestamp: new Date().toISOString(),
          siteName: selectedSite.name,
          title: 'Upload Asset',
          summary: `Uploaded ${uploaded.fileName}`,
          source: 'manual',
          risk: 'low',
          status: 'completed',
        });
      } catch {
        setError('The upload succeeded, but Activity could not be saved to device storage.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      await appendActivity({
        id: cryptoRandomId(),
        timestamp: new Date().toISOString(),
        siteName: selectedSite.name,
        title: 'Upload Asset',
        summary: `Failed: ${message}`,
        source: 'manual',
        risk: 'low',
        status: 'failed',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close photo upload"
          >
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Photo → Asset</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.body}>
          <Text style={styles.bodyText}>
            Upload from the camera roll to the selected site’s Webflow assets.
            The upload preserves the selected file's verified image type.
            HEIC and HEIF require export to a supported format first. Success
            is recorded only after a real API upload.
          </Text>
          {!selectedSite ? (
            <Text style={styles.error}>Connect and select a site first.</Text>
          ) : (
            <Text style={styles.site}>Site: {selectedSite.name}</Text>
          )}
          {status ? <Text style={styles.ok} accessibilityLiveRegion="polite">{status}</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Pressable
            style={[styles.primary, uploading && styles.disabled]}
            disabled={uploading || !selectedSite}
            onPress={() => void pickAndUpload()}
            accessibilityRole="button"
            accessibilityLabel="Choose photo"
            accessibilityHint="Opens your photo library and uploads your selection to Webflow"
            accessibilityState={{ disabled: uploading || !selectedSite, busy: uploading }}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Choose photo</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  link: { color: colors.accent, fontWeight: '600', width: 48 },
  headerButton: { minWidth: 48, minHeight: 44, justifyContent: 'center' },
  body: { padding: spacing.lg },
  bodyText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  site: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, marginTop: spacing.sm, lineHeight: 20 },
  ok: { color: colors.success, marginTop: spacing.sm, fontWeight: '600' },
});
