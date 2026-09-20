/**
 * PKCE + OAuth state helpers (mirrors iOS Support/OAuthSecurity.swift).
 *
 * Prefer Web Crypto when present (web / modern runtimes). Fall back to
 * expo-crypto on React Native Hermes, which does not always expose
 * globalThis.crypto.getRandomValues / subtle.
 */

import * as ExpoCrypto from 'expo-crypto';

const URL_SAFE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export interface PKCEPair {
  verifier: string;
  challenge: string;
}

export function generateState(length = 32): string {
  return randomURLSafeString(length);
}

export async function generatePKCEPair(): Promise<PKCEPair> {
  const verifier = randomURLSafeString(64);
  const challenge = await s256Challenge(verifier);
  return { verifier, challenge };
}

export async function s256Challenge(verifier: string): Promise<string> {
  const digest = await sha256Bytes(verifier);
  return base64UrlEncode(digest);
}

function randomURLSafeString(length: number): string {
  const bytes = new Uint8Array(length);
  fillSecureRandom(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += URL_SAFE[bytes[i]! % URL_SAFE.length];
  }
  return out;
}

function asArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function fillSecureRandom(bytes: Uint8Array): void {
  const view = asArrayBufferView(bytes);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(view);
    bytes.set(view);
    return;
  }
  if (typeof ExpoCrypto.getRandomValues === 'function') {
    ExpoCrypto.getRandomValues(view);
    bytes.set(view);
    return;
  }
  throw new Error(
    'Cryptographically secure randomness is required for OAuth',
  );
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = asArrayBufferView(new TextEncoder().encode(input));

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }

  if (typeof ExpoCrypto.digest === 'function') {
    const hash = await ExpoCrypto.digest(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      data,
    );
    return new Uint8Array(hash);
  }

  throw new Error('Web Crypto SHA-256 is required for PKCE');
}

function base64UrlEncode(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  let b64 = '';
  let i = 0;
  while (i < binary.length) {
    const a = binary.charCodeAt(i++);
    const b = i < binary.length ? binary.charCodeAt(i++) : Number.NaN;
    const c = i < binary.length ? binary.charCodeAt(i++) : Number.NaN;
    const bitmap =
      (a << 16) |
      ((Number.isNaN(b) ? 0 : b) << 8) |
      (Number.isNaN(c) ? 0 : c);
    b64 +=
      chars.charAt((bitmap >> 18) & 63) +
      chars.charAt((bitmap >> 12) & 63) +
      (Number.isNaN(b) ? '=' : chars.charAt((bitmap >> 6) & 63)) +
      (Number.isNaN(c) ? '=' : chars.charAt(bitmap & 63));
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
