import { EDITOR_TYPE } from './annotation-bridge';

export interface RailItem {
  id: string;
  pageNumber: number;
  kind: 'highlight' | 'textbox';
  color: string;
  excerpt: string;
}

const MAX_EXCERPT = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEditorMap(value: unknown): value is Map<string, unknown> {
  return value instanceof Map;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readColor(record: Record<string, unknown>): string {
  const value = record.color;
  if (!isNumberArray(value) || value.length < 3) {
    return '#000000';
  }
  return `#${value
    .slice(0, 3)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function truncate(text: string): string {
  return text.length > MAX_EXCERPT ? `${text.slice(0, MAX_EXCERPT - 1)}…` : text;
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
function toRailItem(id: string, raw: unknown): RailItem | null {
  if (!isRecord(raw)) {
    return null;
  }
  const kind = kindOf(readNumber(raw, 'annotationType'));
  if (!kind) {
    return null;
  }
  return {
    id,
    pageNumber: (readNumber(raw, 'pageIndex') ?? 0) + 1,
    kind,
    color: readColor(raw),
    excerpt: truncate(readString(raw, 'value') ?? ''),
  };
}

/**
 * Accepts the same shape as `pdfDocument.annotationStorage.serializable`: an
 * object whose `.map` is a real Map of editor id to serialized editor data,
 * or `null` when nothing has been annotated yet. That wrapper -- not a bare
 * Map -- is what main.ts actually has in hand; see serializeAnnotationState
 * in src/viewer/main.ts, which unwraps the identical shape for the journal.
 */
export function buildRailItems(serializable: unknown): RailItem[] {
  if (!isRecord(serializable) || !isEditorMap(serializable.map)) {
    return [];
  }

  const items: RailItem[] = [];
  for (const [id, raw] of serializable.map) {
    const item = toRailItem(id, raw);
    if (item) {
      items.push(item);
    }
  }
  return items.sort((a, b) => a.pageNumber - b.pageNumber);
}
