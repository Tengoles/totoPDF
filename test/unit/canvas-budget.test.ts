import { describe, expect, it } from 'vitest';
import {
  MAX_CANVAS_PIXELS,
  MEMORY_BUDGET_BYTES,
  PAGE_BUFFER_UPPER_BOUND,
  canvasBytesUpperBound,
} from '../../src/viewer/canvas-budget';

describe('canvas budget', () => {
  it('computes four bytes per pixel per buffered page', () => {
    expect(canvasBytesUpperBound(1_000_000, 10)).toBe(40_000_000);
  });

  it('keeps the worst case under the 400 MB budget', () => {
    const worstCase = canvasBytesUpperBound(MAX_CANVAS_PIXELS, PAGE_BUFFER_UPPER_BOUND);
    expect(worstCase).toBeLessThan(MEMORY_BUDGET_BYTES);
  });

  it('would exceed the budget at the pdf.js default cap, which is why we override it', () => {
    expect(canvasBytesUpperBound(2 ** 25, PAGE_BUFFER_UPPER_BOUND)).toBeGreaterThan(
      MEMORY_BUDGET_BYTES,
    );
  });
});
