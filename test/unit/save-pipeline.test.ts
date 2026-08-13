import { describe, expect, it } from 'vitest';
import { assertIncrementalPrefix, buildSavedBytes } from '../../src/core/save-pipeline';

const original = new Uint8Array([1, 2, 3, 4]);

describe('assertIncrementalPrefix', () => {
  it('accepts a saved file that appends to the original', () => {
    expect(() =>
      assertIncrementalPrefix(original, new Uint8Array([1, 2, 3, 4, 9, 9])),
    ).not.toThrow();
  });

  it('rejects a saved file shorter than the original', () => {
    expect(() => assertIncrementalPrefix(original, new Uint8Array([1, 2, 3]))).toThrow(
      'shorter than the original',
    );
  });

  it('rejects a saved file that rewrote existing bytes', () => {
    expect(() => assertIncrementalPrefix(original, new Uint8Array([1, 2, 9, 4, 5]))).toThrow(
      'byte 2',
    );
  });
});

describe('buildSavedBytes', () => {
  it('returns the saved bytes and the original length', async () => {
    const source = {
      getData: async () => original,
      saveDocument: async () => new Uint8Array([1, 2, 3, 4, 7]),
    };
    const result = await buildSavedBytes(source);
    expect(result.originalLength).toBe(4);
    expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4, 7]);
  });

  it('refuses to return bytes that violate the invariant', async () => {
    const source = {
      getData: async () => original,
      saveDocument: async () => new Uint8Array([9, 9, 9, 9, 9]),
    };
    await expect(buildSavedBytes(source)).rejects.toThrow('byte 0');
  });
});
