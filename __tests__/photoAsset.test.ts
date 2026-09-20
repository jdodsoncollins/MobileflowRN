import { describe, expect, it } from 'vitest';
import { preparePickedPhoto } from '../src/features/content/photoAsset';

function base64(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

describe('preparePickedPhoto', () => {
  it('preserves the verified MIME type and matching extension', () => {
    const photo = preparePickedPhoto({
      base64: base64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      fileName: 'hero.jpeg',
      mimeType: 'image/png',
    });
    expect(photo.fileName).toBe('hero.png');
    expect(photo.contentType).toBe('image/png');
  });

  it('rejects HEIC with an actionable message', () => {
    expect(() => preparePickedPhoto({
      base64: base64([0, 0, 0, 0]),
      fileName: 'IMG_1.HEIC',
      mimeType: 'image/heic',
    })).toThrow(/Export the photo as JPEG/);
  });

  it('never relabels bytes when MIME and signature differ', () => {
    expect(() => preparePickedPhoto({
      base64: base64([0xff, 0xd8, 0xff, 0x00]),
      fileName: 'photo.png',
      mimeType: 'image/png',
    })).toThrow(/do not match/);
  });
});
