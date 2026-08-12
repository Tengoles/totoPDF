import { describe, expect, it } from 'vitest';
import { computeIdentity } from '../../src/core/identity';

const abc = new TextEncoder().encode('abc');

describe('computeIdentity', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    await expect(computeIdentity(abc)).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is stable across calls', async () => {
    expect(await computeIdentity(abc)).toBe(await computeIdentity(abc));
  });

  it('differs for different bytes', async () => {
    const abd = new TextEncoder().encode('abd');
    expect(await computeIdentity(abc)).not.toBe(await computeIdentity(abd));
  });
});
