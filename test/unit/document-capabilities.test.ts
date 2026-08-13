import { describe, expect, it } from 'vitest';
import { assessDocument } from '../../src/core/document-capabilities';

describe('assessDocument', () => {
  it('allows everything on a normal text document', () => {
    expect(assessDocument({ encryptFilterName: null, firstPageHasText: true })).toEqual({
      canSave: true,
      canHighlight: true,
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

  it('disables highlighting when there is no text layer', () => {
    const result = assessDocument({ encryptFilterName: null, firstPageHasText: false });
    expect(result.canHighlight).toBe(false);
    expect(result.canSave).toBe(true);
    expect(result.reasons).toContain(
      'This PDF has no selectable text, so highlighting is unavailable. Text boxes still work.',
    );
  });

  it('reports both problems at once', () => {
    expect(
      assessDocument({ encryptFilterName: 'Standard', firstPageHasText: false }).reasons,
    ).toHaveLength(2);
  });
});
