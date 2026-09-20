import { describe, expect, it } from 'vitest';
import { md5Hex } from '../src/support/md5';

describe('md5Hex', () => {
  it('matches known digest for empty input', () => {
    // MD5('') = d41d8cd98f00b204e9800998ecf8427e
    expect(md5Hex(new ArrayBuffer(0))).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('matches known digest for "abc"', () => {
    const enc = new TextEncoder();
    const buf = enc.encode('abc').buffer;
    expect(md5Hex(buf)).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
});
