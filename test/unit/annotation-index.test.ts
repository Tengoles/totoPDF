import { describe, expect, it } from 'vitest';
import {
  buildPersistedRailItems,
  buildRailItems,
  mergeRailItems,
} from '../../src/core/annotation-index';

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

/**
 * Captured from a live session: a document annotated in totoPDF, saved, and
 * reopened, then dumped with
 * `JSON.stringify(await (await pdfDocument.getPage(1)).getAnnotations())`
 * (pdfjs-dist@6.2.108 -- see .superpowers/sdd/task-21-report.md).
 *
 * The field names are nothing like the editor serialization above: the id is
 * a PDF object reference (`11R`), the kind is a `subtype` string rather than a
 * numeric `annotationType`, the colour is a Uint8ClampedArray rather than a
 * plain number array, and a free text box keeps its colour under
 * `defaultAppearanceData.fontColor` with `color` left null. A persisted
 * highlight does carry text, in `overlaidText`, which no editor entry ever has.
 */
const persistedHighlight = {
  annotationType: 9,
  annotationFlags: 4,
  color: Uint8ClampedArray.from([255, 241, 118]),
  backgroundColor: null,
  borderColor: null,
  rotation: 0,
  contentsObj: { str: '', dir: 'ltr' },
  hasAppearance: true,
  id: '11R',
  modificationDate: null,
  rect: [59.302800715, 696.3263972998, 387.0900047421, 713.7503972054],
  subtype: 'Highlight',
  isEditable: true,
  structParent: -1,
  titleObj: { str: '', dir: 'ltr' },
  creationDate: 'D:20260813204934',
  popupRef: null,
  opacity: 1,
  quadPoints: { 0: 59.9748, 1: 712.889, 2: 386.435, 3: 712.889, 4: 59.9748, 5: 697.191, 6: 386.435, 7: 697.191 },
  overlaidText: 'A fixed point of a function is a value mapped to itself.',
};

const persistedFreeText = {
  annotationType: 3,
  annotationFlags: 4,
  color: null,
  contentsObj: { str: 'check this claim', dir: 'ltr' },
  hasAppearance: true,
  id: '13R',
  rect: [88.4364073427, 542.8306381119, 194.0585664336, 568.5646853147],
  subtype: 'FreeText',
  isEditable: true,
  titleObj: { str: '', dir: 'ltr' },
  creationDate: 'D:20260813204934',
  popupRef: null,
  defaultAppearanceData: {
    fontSize: 14,
    fontName: 'Helv',
    fontColor: Uint8ClampedArray.from([212, 46, 46]),
  },
  textPosition: [0, 11.734052951524973],
  textContent: ['check this claim'],
};

describe('buildPersistedRailItems', () => {
  it('maps a persisted highlight, taking its excerpt from overlaidText', () => {
    expect(buildPersistedRailItems(1, [persistedHighlight])).toEqual([
      {
        id: '11R',
        pageNumber: 1,
        kind: 'highlight',
        color: '#fff176',
        excerpt: 'A fixed point of a function is a value mapped to itself.',
      },
    ]);
  });

  it('maps a persisted text box, taking its colour from defaultAppearanceData', () => {
    expect(buildPersistedRailItems(3, [persistedFreeText])).toEqual([
      {
        id: '13R',
        pageNumber: 3,
        kind: 'textbox',
        color: '#d42e2e',
        excerpt: 'check this claim',
      },
    ]);
  });

  it('ignores subtypes outside the two supported tools', () => {
    const others = [
      { subtype: 'Text', id: '20R', contentsObj: { str: 'a sticky note' } },
      { subtype: 'Link', id: '21R' },
      { subtype: 'Popup', id: '22R' },
      { subtype: 'Widget', id: '23R' },
    ];
    expect(buildPersistedRailItems(1, others)).toEqual([]);
  });

  it('ignores an entry with no id, which nothing could be de-duplicated against', () => {
    expect(buildPersistedRailItems(1, [{ subtype: 'Highlight' }])).toEqual([]);
  });

  it('returns an empty list when the page has no annotations at all', () => {
    expect(buildPersistedRailItems(1, [])).toEqual([]);
    expect(buildPersistedRailItems(1, null)).toEqual([]);
    expect(buildPersistedRailItems(1, undefined)).toEqual([]);
  });

  it('truncates a long persisted excerpt', () => {
    const long = { subtype: 'Highlight', id: '9R', overlaidText: 'a'.repeat(200) };
    expect(buildPersistedRailItems(1, [long])[0]?.excerpt.length).toBeLessThanOrEqual(80);
  });
});

/** The editor's entry for a pre-existing annotation it has recoloured. */
const editedHighlight = {
  map: new Map<string, Record<string, unknown>>([
    [
      'pdfjs_internal_editor_0',
      { annotationType: 9, pageIndex: 0, color: [100, 181, 246], id: '11R' },
    ],
  ]),
  hash: 'edited',
  transfer: [],
};

/** What HighlightEditor.serializeDeleted() produces: no annotationType at all. */
const deletedHighlight = {
  map: new Map<string, Record<string, unknown>>([
    ['pdfjs_internal_editor_0', { id: '11R', deleted: true, pageIndex: 0, popupRef: '' }],
  ]),
  hash: 'deleted',
  transfer: [],
};

describe('mergeRailItems', () => {
  it('lists the document’s saved annotations when nothing was edited this session', () => {
    const persisted = [
      ...buildPersistedRailItems(1, [persistedHighlight]),
      ...buildPersistedRailItems(3, [persistedFreeText]),
    ];
    expect(mergeRailItems(persisted, null).map((item) => item.id)).toEqual(['11R', '13R']);
  });

  it('lists an annotation present in both sources exactly once, showing the edit', () => {
    const persisted = buildPersistedRailItems(1, [persistedHighlight]);
    const merged = mergeRailItems(persisted, editedHighlight);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('11R');
    // The editor entry wins: it is the version on screen.
    expect(merged[0]?.color).toBe('#64b5f6');
  });

  it('keeps the saved excerpt when the editor entry has no text of its own', () => {
    const persisted = buildPersistedRailItems(1, [persistedHighlight]);
    expect(mergeRailItems(persisted, editedHighlight)[0]?.excerpt).toBe(
      'A fixed point of a function is a value mapped to itself.',
    );
  });

  it('drops an annotation deleted this session, which is still in the saved file', () => {
    const persisted = buildPersistedRailItems(1, [persistedHighlight]);
    expect(mergeRailItems(persisted, deletedHighlight)).toEqual([]);
  });

  it('orders by page across both sources', () => {
    const persisted = [
      ...buildPersistedRailItems(5, [persistedHighlight]),
      ...buildPersistedRailItems(2, [persistedFreeText]),
    ];
    const sessionItem = {
      map: new Map<string, Record<string, unknown>>([
        ['pdfjs_internal_editor_7', { annotationType: 9, pageIndex: 3, color: [0, 0, 0], id: null }],
      ]),
    };
    expect(mergeRailItems(persisted, sessionItem).map((item) => item.pageNumber)).toEqual([2, 4, 5]);
  });

  it('keeps a brand-new annotation, which no saved page can claim', () => {
    expect(mergeRailItems([], storage).map((item) => item.id)).toEqual([
      'pdfjs_internal_editor_0',
      'pdfjs_internal_editor_1',
    ]);
  });
});
