import { describe, expect, it } from 'vitest';
import { assessDocument } from '../../src/core/document-capabilities';

describe('assessDocument', () => {
  it('highlights by text selection on a normal text document', () => {
    expect(assessDocument({ encryptFilterName: null, firstPageHasText: true })).toEqual({
      canSave: true,
      highlightMode: 'text',
      reasons: [],
    });
  });

  it('refuses to save an encrypted document', () => {
    const result = assessDocument({ encryptFilterName: 'Standard', firstPageHasText: true });
    expect(result.canSave).toBe(false);
    expect(result.reasons).toContain(
      'This PDF is encrypted. totoPDF can display it but cannot save changes to it.',
    );
  });

  // The scanned-document case. Highlighting is not withdrawn, it changes
  // shape: there are no words to anchor to, so the user draws the region.
  it('highlights by drawing when there is no text layer', () => {
    const result = assessDocument({ encryptFilterName: null, firstPageHasText: false });
    expect(result.highlightMode).toBe('free');
    expect(result.canSave).toBe(true);
  });

  it('says how to highlight a document with no text layer', () => {
    const result = assessDocument({ encryptFilterName: null, firstPageHasText: false });
    expect(result.reasons).toContain(
      'This PDF has no selectable text. Hold and drag across the page to draw a highlight.',
    );
  });

  it('reports both facts at once', () => {
    expect(
      assessDocument({ encryptFilterName: 'Standard', firstPageHasText: false }).reasons,
    ).toHaveLength(2);
  });
});
