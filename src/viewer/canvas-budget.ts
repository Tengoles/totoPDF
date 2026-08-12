/**
 * pdf.js defaults to maxCanvasPixels = 2**25 (~134 MB per canvas). Its page
 * buffer holds up to max(10, 2 * visible + 1) pages and is a private field
 * with no public setter, so per-canvas caps are the only memory lever.
 */
export const MAX_CANVAS_PIXELS = 2 ** 22;
export const MAX_CANVAS_DIM = 4096;
/**
 * pdf.js sizes its page buffer as max(10, 2 * visible + 1), so 10 is a FLOOR,
 * not a ceiling. The two factors do not multiply into a worst case, though:
 * canvas size scales with zoom, so having more than ~10 pages buffered means
 * each is rendered small, while maxCanvasPixels only binds at high zoom where
 * few pages are visible. Task 18 measures actual canvas bytes; this constant
 * exists to guard the per-canvas cap, not to bound the buffer.
 */
export const PAGE_BUFFER_FLOOR = 10;
export const MEMORY_BUDGET_BYTES = 400 * 1024 * 1024;

const BYTES_PER_PIXEL = 4;

export function canvasBytesUpperBound(maxCanvasPixels: number, bufferedPages: number): number {
  return maxCanvasPixels * BYTES_PER_PIXEL * bufferedPages;
}
