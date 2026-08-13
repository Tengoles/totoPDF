import { describe, expect, it } from 'vitest';
import { buildRailItems } from '../../src/core/annotation-index';

/**
 * These entries mirror what a live pdf.js session actually serializes (see
 * .superpowers/sdd/task-15-report.md for the captured dump):
 * `pdfDocument.annotationStorage.serializable` is `{ map, hash, transfer }`,
 * and `HighlightEditor.serialize()` never includes a text field -- only
 * `FreeTextEditor`'s `value` does. The brief's assumed `text` field on a
 * highlight entry does not exist in reality.
 */
const storage = {
  map: new Map<string, Record<string, unknown>>([
    [
      'pdfjs_internal_editor_0',
      {
        annotationType: 9,
        pageIndex: 0,
        rect: [59.3028, 695.772, 386.6616, 713.2752],
        rotation: 0,
        structTreeParentId: null,
        popupRef: '',
        color: [255, 241, 118],
        opacity: 1,
        thickness: 12,
        quadPoints: { 0: 59.97, 1: 712.44, 2: 386.05, 3: 712.44, 4: 59.97, 5: 696.64, 6: 386.05, 7: 696.64 },
        outlines: [[59.3028, 695.772, 59.3028, 713.2752, 386.6616, 713.2752, 386.6616, 695.772]],
        id: null,
      },
    ],
    [
      'pdfjs_internal_editor_1',
      {
        annotationType: 3,
        pageIndex: 2,
        rect: [15.3, 712.945, 91.846, 732.41],
        rotation: 0,
        structTreeParentId: null,
        popupRef: '',
        color: [211, 47, 47],
        fontSize: 10,
        value: 'check this claim',
        id: null,
      },
    ],
  ]),
  hash: 'irrelevant-for-this-test',
  transfer: [],
};

describe('buildRailItems', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(buildRailItems(null)).toEqual([]);
  });

  it('returns an empty list for the empty-storage shape pdf.js actually returns', () => {
    expect(buildRailItems({ map: null, hash: '', transfer: undefined })).toEqual([]);
  });

  it('maps highlights and text boxes to rail items in page order', () => {
    const items = buildRailItems(storage);
    expect(items).toEqual([
      {
        id: 'pdfjs_internal_editor_0',
        pageNumber: 1,
        kind: 'highlight',
        color: '#fff176',
        excerpt: '',
      },
      {
        id: 'pdfjs_internal_editor_1',
        pageNumber: 3,
        kind: 'textbox',
        color: '#d32f2f',
        excerpt: 'check this claim',
      },
    ]);
  });

  it('ignores editor types outside the two supported tools', () => {
    const mixed = { map: new Map([['x', { annotationType: 15, pageIndex: 0 }]]) };
    expect(buildRailItems(mixed)).toEqual([]);
  });

  it('truncates long excerpts', () => {
    const long = {
      map: new Map([['x', { annotationType: 3, pageIndex: 0, color: [0, 0, 0], value: 'a'.repeat(200) }]]),
    };
    expect(buildRailItems(long)[0]?.excerpt.length).toBeLessThanOrEqual(80);
  });
});
