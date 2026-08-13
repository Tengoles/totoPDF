import { formatPageTotal, type PageController, type PageState, parsePageInput } from './page-nav';

/**
 * The page box and the "of N" beside it. Lives outside toolbar.ts for the same
 * reason zoom-control.ts does -- to keep both files inside the size limit --
 * and takes its teardown signal from the toolbar so every listener here dies
 * with the toolbar that created it.
 */

const INPUT_TITLE = 'Page being shown. Type a page number and press Enter to go to it.';

function createPageInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'page-input';
  input.min = '1';
  input.step = '1';
  input.title = INPUT_TITLE;
  // The box has no visible caption, so it states its own name.
  input.setAttribute('aria-label', 'Page number');
  return input;
}

interface PageBox {
  /** Applies a state read off the viewer, unless the user is mid-entry. */
  sync(state: PageState): void;
  /** Acts on what was typed, then puts the box back in step with the viewer. */
  commit(): void;
  /** Abandons whatever was typed. Navigates nowhere. */
  revert(): void;
  markEditing(): void;
}

/**
 * The box's two pieces of state.
 *
 * `current` is the last state seen from the viewer: what an invalid entry
 * reverts to, and what a typed page number is range-checked against.
 *
 * `editing` is set by the first keystroke and cleared once the entry has been
 * committed or abandoned. Two things depend on it. A pagechanging event
 * arriving while the user is part-way through typing "12" must not overwrite
 * the "1" they have so far -- the single most annoying way to get this control
 * wrong. And a blur must not commit a number the user never touched: focusing
 * the box and then scrolling the document with the wheel would otherwise
 * scroll straight back to where it started on the way out.
 */
function createPageBox(
  pages: PageController,
  input: HTMLInputElement,
  total: HTMLSpanElement,
): PageBox {
  let current = pages.state();
  let editing = false;

  function revert(): void {
    // With no document there is no page to name, so the box stays empty rather
    // than claiming page 1 of 0.
    input.value = current.pageCount > 0 ? String(current.pageNumber) : '';
    editing = false;
  }

  function commit(): void {
    if (!editing) {
      return;
    }
    const pageNumber = parsePageInput(input.value, current.pageCount);
    if (pageNumber !== null) {
      // Dispatches pagechanging synchronously, so `current` is already the new
      // page by the time revert() below reads it.
      pages.goTo(pageNumber);
    }
    // Valid or not, the box ends up showing the page actually being displayed.
    // A typo costs a revert, not a banner.
    revert();
  }

  return {
    sync(state) {
      current = state;
      total.textContent = formatPageTotal(state.pageCount);
      input.max = String(state.pageCount);
      input.disabled = state.pageCount < 1;
      if (editing && document.activeElement === input) {
        return;
      }
      revert();
    },
    commit,
    revert,
    markEditing: () => {
      editing = true;
    },
  };
}

function bindEntry(input: HTMLInputElement, box: PageBox, signal: AbortSignal): void {
  input.addEventListener('input', box.markEditing, { signal });
  input.addEventListener('blur', box.commit, { signal });
  input.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter') {
        box.commit();
        return;
      }
      if (event.key === 'Escape') {
        box.revert();
      }
    },
    { signal },
  );
}

export function createPageNavControls(pages: PageController, signal: AbortSignal): HTMLElement {
  const input = createPageInput();
  const total = document.createElement('span');
  total.className = 'page-total';

  const box = createPageBox(pages, input, total);
  bindEntry(input, box, signal);

  // The box follows pdf.js's own events, so it is right after a scroll, a
  // thumbnail click, or a jump typed into it.
  pages.subscribe(box.sync, signal);
  box.sync(pages.state());

  const group = document.createElement('span');
  group.className = 'page-nav';
  group.append(input, total);
  return group;
}
