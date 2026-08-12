/**
 * pdf.js defaults to maxCanvasPixels = 2**25 (~134 MB per canvas). Its page
 * buffer holds up to max(10, 2 * visible + 1) pages and is a private field
 * with no public setter, so per-canvas caps are the only memory lever.
 */
export const MAX_CANVAS_PIXELS = 2 ** 22;
export const MAX_CANVAS_DIM = 4096;
export const PAGE_BUFFER_UPPER_BOUND = 10;
export const MEMORY_BUDGET_BYTES = 400 * 1024 * 1024;

const BYTES_PER_PIXEL = 4;

export function canvasBytesUpperBound(maxCanvasPixels: number, bufferedPages: number): number {
  return maxCanvasPixels * BYTES_PER_PIXEL * bufferedPages;
}
