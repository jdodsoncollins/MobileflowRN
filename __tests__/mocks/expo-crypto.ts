/** Node-backed expo-crypto stub for Vitest. */
import { webcrypto } from 'node:crypto';

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
} as const;

// Node webcrypto typings diverge from DOM BufferSource / ArrayBufferView.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cryptoAny = webcrypto as any;

export function getRandomValues<T extends ArrayBufferView>(typedArray: T): T {
  cryptoAny.getRandomValues(typedArray);
  return typedArray;
}

export async function digest(
  _algorithm: string,
  data: ArrayBuffer | ArrayBufferView,
): Promise<ArrayBuffer> {
  return cryptoAny.subtle.digest('SHA-256', data) as Promise<ArrayBuffer>;
}

export async function digestStringAsync(
  _algorithm: string,
  data: string,
): Promise<string> {
  const buf = (await cryptoAny.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data),
  )) as ArrayBuffer;
  return Buffer.from(buf).toString('hex');
}

export function randomUUID(): string {
  return webcrypto.randomUUID();
}
