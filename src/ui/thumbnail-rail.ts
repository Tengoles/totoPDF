export const THUMBNAIL_WIDTH = 150;

export interface ThumbnailRailOptions {
  pageCount: number;
  renderPage(pageNumber: number, canvas: HTMLCanvasElement): Promise<void>;
  onSelect(pageNumber: number): void;
}

/**
 * Builds one button+canvas+label per page but renders nothing eagerly: a
 * 1000-page scanned book would otherwise allocate a full-size canvas per
 * page before the user ever scrolls to most of them. An IntersectionObserver
 * renders a canvas only once it nears the visible rail (rootMargin gives a
 * scroll-ahead buffer) and releases it the moment it scrolls back out.
 *
 * Setting canvas.width/height to 0 is not a redundant tidy-up -- it is the
 * only prompt way to free a canvas's backing store. Chrome does not reclaim
 * it from GC alone on any useful timescale, so without this line a long
 * scroll session would leak one full-size bitmap per page visited.
 */
export function createThumbnailRail(
  root: HTMLElement,
  options: ThumbnailRailOptions,
): { destroy(): void } {
  root.replaceChildren();
  const rendered = new Set<HTMLCanvasElement>();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // Safe: every element this observer ever sees is a canvas this
        // module created and passed to observer.observe() below.
        const canvas = entry.target as HTMLCanvasElement;
        const pageNumber = Number(canvas.dataset.page);
        if (entry.isIntersecting && !rendered.has(canvas)) {
          rendered.add(canvas);
          void options.renderPage(pageNumber, canvas);
        } else if (!entry.isIntersecting && rendered.has(canvas)) {
          rendered.delete(canvas);
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    },
    { root, rootMargin: '400px' },
  );

  for (let pageNumber = 1; pageNumber <= options.pageCount; pageNumber += 1) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'thumb';
    item.addEventListener('click', () => options.onSelect(pageNumber));

    const canvas = document.createElement('canvas');
    canvas.dataset.page = String(pageNumber);
    canvas.width = 0;
    canvas.height = 0;

    const label = document.createElement('span');
    label.textContent = String(pageNumber);

    item.append(canvas, label);
    root.append(item);
    observer.observe(canvas);
  }

  return {
    destroy() {
      observer.disconnect();
      root.replaceChildren();
    },
  };
}
