import { describe, expect, it } from 'vitest';
import { FILE_PDF_RULE_ID, buildFilePdfRule, viewerUrlFor } from '../../src/background/interception';
import { parseViewerQuery } from '../../src/core/document-source';

const VIEWER = 'chrome-extension://abcdef/viewer.html';

describe('buildFilePdfRule', () => {
  const rule = buildFilePdfRule(VIEWER);

  it('redirects main frame navigations only', () => {
    expect(rule.condition.resourceTypes).toEqual(['main_frame']);
  });

  it('matches local PDF URLs case-insensitively and captures the whole URL', () => {
    expect(rule.condition.regexFilter).toBe('^(file:///[^&#]*\\.pdf)$');
    expect(rule.condition.isUrlFilterCaseSensitive).toBe(false);
    expect(rule.action.redirect?.regexSubstitution).toBe(`${VIEWER}?src=\\1`);
  });

  it('uses the reserved rule id so reinstallation replaces it', () => {
    expect(rule.id).toBe(FILE_PDF_RULE_ID);
  });

  it('refuses paths containing an ampersand, which the substitution cannot encode', () => {
    const pattern = new RegExp(rule.condition.regexFilter ?? '');
    expect(pattern.test('file:///C:/books/plain.pdf')).toBe(true);
    expect(pattern.test('file:///C:/books/A&B.pdf')).toBe(false);
  });
});

describe('viewerUrlFor', () => {
  it('percent-encodes the source so query and fragment characters survive', () => {
    expect(viewerUrlFor('https://example.com/a b.pdf?x=1#p2', VIEWER)).toBe(
      `${VIEWER}?src=https%3A%2F%2Fexample.com%2Fa%20b.pdf%3Fx%3D1%23p2`,
    );
  });
});

describe('redirect round trip', () => {
  /** Mirrors what declarativeNetRequest's regexSubstitution produces. */
  function redirectedSearch(fileUrl: string): string {
    return new URL(`${VIEWER}?src=${fileUrl}`).search;
  }

  it('round-trips a path whose spaces the browser already encoded', () => {
    expect(parseViewerQuery(redirectedSearch('file:///C:/books/a%20b.pdf'))).toEqual({
      kind: 'local',
      url: 'file:///C:/books/a b.pdf',
    });
  });

  it('round-trips a path containing a literal plus', () => {
    expect(parseViewerQuery(redirectedSearch('file:///C:/books/a+b.pdf'))).toEqual({
      kind: 'local',
      url: 'file:///C:/books/a+b.pdf',
    });
  });

  it('round-trips an ampersand path handed over by viewerUrlFor, which encodes fully', () => {
    const search = new URL(viewerUrlFor('file:///C:/books/A&B.pdf', VIEWER)).search;
    expect(parseViewerQuery(search)).toEqual({
      kind: 'local',
      url: 'file:///C:/books/A&B.pdf',
    });
  });
});
