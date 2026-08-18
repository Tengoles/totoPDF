import { EDITOR_TYPE } from './annotation-bridge';

export interface RailItem {
  id: string;
  pageNumber: number;
  kind: 'highlight' | 'textbox';
  color: string;
  excerpt: string;
}

const MAX_EXCERPT = 80;
const FALLBACK_COLOR = '#000000';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEditorMap(value: unknown): value is Map<string, unknown> {
  return value instanceof Map;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return isUnknownArray(value) && value.every((item) => typeof item === 'number');
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * The two sources disagree about how a colour is carried: a serialized editor
 * uses a plain number array, while `getAnnotations()` returns a
 * Uint8ClampedArray, for which Array.isArray is false. Both are read here so
 * neither source silently falls back to black.
 */
function toChannels(value: unknown): number[] | null {
  if (value instanceof Uint8ClampedArray || value instanceof Uint8Array) {
    return Array.from(value);
  }
  return isNumberArray(value) ? value : null;
}

function hexChannel(channel: number): string {
  return Math.min(255, Math.max(0, Math.round(channel))).toString(16).padStart(2, '0');
}

function formatColor(channels: number[] | null): string {
  if (!channels || channels.length < 3) {
    return FALLBACK_COLOR;
  }
  return `#${channels.slice(0, 3).map(hexChannel).join('')}`;
}

function truncate(text: string): string {
  return text.length > MAX_EXCERPT ? `${text.slice(0, MAX_EXCERPT - 1)}…` : text;
}

function byPageNumber(items: RailItem[]): RailItem[] {
  // Array.prototype.sort is stable, so items on one page keep the order they
  // were merged in: the document's own annotations before this session's.
  return items.sort((a, b) => a.pageNumber - b.pageNumber);
}

function kindOf(annotationType: number | undefined): RailItem['kind'] | null {
  if (annotationType === EDITOR_TYPE.HIGHLIGHT) {
    return 'highlight';
  }
  if (annotationType === EDITOR_TYPE.FREETEXT) {
    return 'textbox';
  }
  return null;
}

/**
 * pdf.js's serialized editors are internal and version-pinned (verified
 * against pdfjs-dist@6.2.108 by capturing a live session -- see
 * .superpowers/sdd/task-15-report.md), so every field is read defensively.
 * Only the free-text editor ever carries user text, in its `value` field.
 * HighlightEditor.serialize() has no text field at all, only geometry
 * (quadPoints/outlines), so a highlight's excerpt is always empty; the rail
 * falls back to showing the item's kind when the excerpt is blank.
 */
function toRailItem(id: string, raw: Record<string, unknown>): RailItem | null {
  const kind = kindOf(readNumber(raw, 'annotationType'));
  if (!kind) {
    return null;
  }
  return {
    id,
    pageNumber: (readNumber(raw, 'pageIndex') ?? 0) + 1,
    kind,
    color: formatColor(toChannels(raw.color)),
    excerpt: truncate(readString(raw, 'value') ?? ''),
  };
}

export interface EditorEntries {
  items: RailItem[];
  /**
   * Ids of annotations already in the file that this session has taken over,
   * whether by editing or deleting them. Both cases carry the annotation's own
   * id (`11R`, an object reference) in the entry's `id` field, which is the
   * only thing tying an editor entry to the `getAnnotations()` entry it
   * supersedes -- the storage key is always `pdfjs_internal_editor_N`.
   */
  claimedIds: Set<string>;
}

/**
 * Accepts the same shape as `pdfDocument.annotationStorage.serializable`: an
 * object whose `.map` is a real Map of editor id to serialized editor data,
 * or `null` when nothing has been annotated yet. That wrapper -- not a bare
 * Map -- is what main.ts actually has in hand; see serializeAnnotationState
 * in src/viewer/main.ts, which unwraps the identical shape for the journal.
 *
 * A deletion produces an entry with no `annotationType` (see
 * AnnotationEditor.serializeDeleted), so it yields no item while still
 * claiming its id -- which is exactly what removes it from the rail.
 */
export function buildEditorEntries(serializable: unknown): EditorEntries {
  const items: RailItem[] = [];
  const claimedIds = new Set<string>();
  if (!isRecord(serializable) || !isEditorMap(serializable.map)) {
    return { items, claimedIds };
  }

  for (const [key, raw] of serializable.map) {
    if (!isRecord(raw)) {
      continue;
    }
    const annotationId = readString(raw, 'id');
    if (annotationId) {
      claimedIds.add(annotationId);
    }
    const item = toRailItem(annotationId ?? key, raw);
    if (item) {
      items.push(item);
    }
  }
  return { items, claimedIds };
}

/** The editor-storage half on its own, unchanged since Task 15. */
export function buildRailItems(serializable: unknown): RailItem[] {
  return byPageNumber(buildEditorEntries(serializable).items);
}

/**
 * A highlight is not always a `/Highlight`. Text selection produces one, but
 * the drag-to-draw kind -- the only kind a page with no text layer can carry
 * -- is written by pdf.js as an `/Ink` annotation whose intent is
 * `/InkHighlight` (verified by saving one with pdfjs-dist@6.2.108 and reading
 * the file back through `getAnnotations()`). Matching on subtype alone
 * therefore drops every highlight made on a scanned page the moment it is
 * reopened.
 *
 * The intent, not the subtype, is what makes it ours: totoPDF has no drawing
 * tool, so a plain `/Ink` came from another program and is not this rail's to
 * list.
 */
function persistedKind(raw: Record<string, unknown>): RailItem['kind'] | null {
  const subtype = readString(raw, 'subtype');
  if (subtype === 'Highlight') {
    return 'highlight';
  }
  if (subtype === 'Ink') {
    return readString(raw, 'it') === 'InkHighlight' ? 'highlight' : null;
  }
  if (subtype === 'FreeText') {
    return 'textbox';
  }
  return null;
}

/** A text box keeps its colour in the default appearance; `color` is null. */
function persistedColor(raw: Record<string, unknown>): string {
  const direct = toChannels(raw.color);
  if (direct) {
    return formatColor(direct);
  }
  const appearance = raw.defaultAppearanceData;
  return formatColor(isRecord(appearance) ? toChannels(appearance.fontColor) : null);
}

/**
 * A persisted highlight carries the words it covers in `overlaidText`, which
 * the editor serialization never has -- so a reopened document's rail is more
 * readable than the one the annotations were made in. A text box carries its
 * words in `contentsObj.str`.
 */
function persistedExcerpt(raw: Record<string, unknown>): string {
  const overlaid = readString(raw, 'overlaidText');
  if (overlaid) {
    return truncate(overlaid);
  }
  const contents = raw.contentsObj;
  return truncate((isRecord(contents) ? readString(contents, 'str') : undefined) ?? '');
}

/**
 * Maps one page's `pdfPage.getAnnotations()` result. Its fields are not the
 * editor serialization above: the kind is a `subtype` string, the id is a PDF
 * object reference, and there is no page index -- the page is only knowable
 * from which page was asked. Captured from a live pdfjs-dist@6.2.108 session;
 * the dump is in .superpowers/sdd/task-21-report.md.
 *
 * An entry with no id is dropped: it could not be de-duplicated against an
 * editor entry, so listing it would risk showing the same annotation twice.
 */
export function buildPersistedRailItems(pageNumber: number, annotations: unknown): RailItem[] {
  if (!isUnknownArray(annotations)) {
    return [];
  }
  const items: RailItem[] = [];
  for (const raw of annotations) {
    if (!isRecord(raw)) {
      continue;
    }
    const kind = persistedKind(raw);
    const id = readString(raw, 'id');
    if (!kind || !id) {
      continue;
    }
    items.push({ id, pageNumber, kind, color: persistedColor(raw), excerpt: persistedExcerpt(raw) });
  }
  return items;
}

/**
 * The rail's real contents: what is saved in the file, plus what this session
 * has added, with anything in both listed once. The editor entry wins, because
 * it is the version on screen -- a recoloured highlight should show its new
 * colour, and a deleted one should not be listed at all.
 *
 * Its excerpt is the exception. An editor entry for a highlight has no text
 * field at all, so letting it win outright turned "p.1 A fixed point of a
 * function..." back into "p.1 highlight" the moment the user recoloured it.
 * The words come from the saved annotation, which recolouring does not change.
 */
export function mergeRailItems(persisted: readonly RailItem[], serializable: unknown): RailItem[] {
  const { items, claimedIds } = buildEditorEntries(serializable);
  const savedById = new Map(persisted.map((item) => [item.id, item]));
  const edited = items.map((item) =>
    item.excerpt ? item : { ...item, excerpt: savedById.get(item.id)?.excerpt ?? '' },
  );
  const unclaimed = persisted.filter((item) => !claimedIds.has(item.id));
  return byPageNumber([...unclaimed, ...edited]);
}
