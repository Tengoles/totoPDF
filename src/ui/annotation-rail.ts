import type { RailItem } from '../core/annotation-index';

/**
 * Renders the page-ordered list of highlights and text boxes. Pure DOM
 * (replaceChildren + rebuild), so it has no state of its own: the caller
 * re-renders on every annotationeditorstateschanged event with a fresh item
 * list, the same pattern the toolbar and journal already use.
 */
export function renderAnnotationRail(
  root: HTMLElement,
  items: RailItem[],
  onJump: (item: RailItem) => void,
): void {
  root.replaceChildren();

  const heading = document.createElement('h2');
  heading.textContent = `Annotations (${items.length})`;
  root.append(heading);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'rail-empty';
    empty.textContent = 'Highlights and text boxes you add will be listed here.';
    root.append(empty);
    return;
  }

  const list = document.createElement('ul');
  for (const item of items) {
    const entry = document.createElement('li');
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.style.borderLeftColor = item.color;
    jump.textContent = `p.${item.pageNumber}  ${item.excerpt || item.kind}`;
    jump.addEventListener('click', () => onJump(item));
    entry.append(jump);
    list.append(entry);
  }
  root.append(list);
}
