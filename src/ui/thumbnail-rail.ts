export const THUMBNAIL_WIDTH = 150;

export interface ThumbnailRailOptions {
  pageCount: number;
  renderPage(pageNumber: number, canvas: HTMLCanvasElement): Promise<void>;
  onSelect(pageNumber: number): void;
}

export interface ThumbnailRail {
  destroy(): void;
  /**
   * Marks the page being read and brings its thumbnail into the rail's view.
   * Out-of-range numbers are ignored: the rail is rebuilt per document, and a
   * stale event arriving mid-swap must not throw.
   */
  setCurrentPage(pageNumber: number): void;
}

/**
 * Renders a thumbnail canvas the moment it nears the visible rail and
 * releases it the moment it scrolls back out.
 *
 * Setting canvas.width/height to 0 is not a redundant tidy-up -- it is the
 * only prompt way to free a canvas's backing store. Chrome does not reclaim
 * it from GC alone on any useful timescale, so without this line a long
 * scroll session would leak one full-size bitmap per page visited.
 */
function handleIntersections(
  entries: IntersectionObserverEntry[],
  rendered: Set<HTMLCanvasElement>,
  renderPage: ThumbnailRailOptions['renderPage'],
): void {
  for (const entry of entries) {
    // Safe: every element this observer ever sees is a canvas this
    // module created and passed to observer.observe() below.
    const canvas = entry.target as HTMLCanvasElement;
    const pageNumber = Number(canvas.dataset.page);
    if (entry.isIntersecting && !rendered.has(canvas)) {
      rendered.add(canvas);
      void renderPage(pageNumber, canvas);
    } else if (!entry.isIntersecting && rendered.has(canvas)) {
      rendered.delete(canvas);
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/** One page's button, with the canvas the observer watches handed back. */
function createThumbItem(
  pageNumber: number,
  onSelect: (pageNumber: number) => void,
): { item: HTMLButtonElement; canvas: HTMLCanvasElement } {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'thumb';
  item.addEventListener('click', () => onSelect(pageNumber));

  const canvas = document.createElement('canvas');
  canvas.dataset.page = String(pageNumber);
  canvas.width = 0;
  canvas.height = 0;

  const label = document.createElement('span');
  label.textContent = String(pageNumber);

  item.append(canvas, label);
  return { item, canvas };
}

/**
 * Moves the mark, in the accessibility tree as well as in CSS: the styling is
 * an outline and a bolder label, and neither of those reaches a screen reader.
 *
 * 'nearest' is the whole point of the scroll: it does nothing when the
 * thumbnail is already visible, so it neither fights a reader scrolling the
 * rail by hand nor jerks the rail on every click. 'center' and 'smooth' would
 * do both.
 */
function markCurrent(item: HTMLButtonElement, previous: HTMLButtonElement | null): void {
  previous?.removeAttribute('aria-current');
  item.setAttribute('aria-current', 'page');
  item.scrollIntoView({ block: 'nearest' });
}

/**
 * Builds one button+canvas+label per page but renders nothing eagerly: a
 * 1000-page scanned book would otherwise allocate a full-size canvas per
 * page before the user ever scrolls to most of them. See
 * handleIntersections for the render/release policy (rootMargin gives a
 * scroll-ahead buffer before a thumbnail becomes visible).
 */
export function createThumbnailRail(
  root: HTMLElement,
  options: ThumbnailRailOptions,
): ThumbnailRail {
  root.replaceChildren();
  const rendered = new Set<HTMLCanvasElement>();
  const items: HTMLButtonElement[] = [];
  let current: HTMLButtonElement | null = null;

  const observer = new IntersectionObserver(
    (entries) => handleIntersections(entries, rendered, options.renderPage),
    { root, rootMargin: '400px' },
  );

  for (let pageNumber = 1; pageNumber <= options.pageCount; pageNumber += 1) {
    const { item, canvas } = createThumbItem(pageNumber, options.onSelect);
    root.append(item);
    items.push(item);
    observer.observe(canvas);
  }

  return {
    setCurrentPage(pageNumber) {
      const item = items[pageNumber - 1];
      if (!item || item === current) {
        return;
      }
      markCurrent(item, current);
      current = item;
    },
    destroy() {
      observer.disconnect();
      root.replaceChildren();
      items.length = 0;
      current = null;
    },
  };
}
