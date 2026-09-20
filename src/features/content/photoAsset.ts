export interface UploadablePhoto {
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
}

const EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function preparePickedPhoto(asset: {
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}): UploadablePhoto {
  if (!asset.base64) throw new Error('Could not read image bytes.');
  const reportedType = asset.mimeType?.toLowerCase() ?? null;
  if (
    reportedType === 'image/heic' ||
    reportedType === 'image/heif' ||
    /\.(heic|heif)$/i.test(asset.fileName ?? '')
  ) {
    throw new Error(
      'HEIC and HEIF uploads are not supported. Export the photo as JPEG, PNG, WebP, GIF, or AVIF and choose it again.',
    );
  }
  if (!reportedType || !(reportedType in EXTENSIONS)) {
    throw new Error(
      'The picker did not return a supported image MIME type. Choose a JPEG, PNG, WebP, GIF, or AVIF image.',
    );
  }

  const data = base64ToArrayBuffer(asset.base64);
  const detectedType = detectImageType(new Uint8Array(data));
  if (detectedType !== reportedType) {
    throw new Error(
      `The selected image bytes do not match the reported ${reportedType} type. Export the image again and retry.`,
    );
  }
  const stem =
    asset.fileName?.replace(/\.[^.]+$/, '').trim() || `mobileflow-${Date.now()}`;
  return {
    fileName: `${stem}.${EXTENSIONS[detectedType]}`,
    contentType: detectedType,
    data,
  };
}

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  const ascii = String.fromCharCode(...bytes.slice(0, 12));
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'image/gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii.slice(8, 12))) {
    return 'image/avif';
  }
  return null;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
