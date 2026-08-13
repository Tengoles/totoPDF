import { describe, expect, it } from 'vitest';
import { FILE_PDF_RULE_ID, buildFilePdfRule, viewerUrlFor } from '../../src/background/interception';

const VIEWER = 'chrome-extension://abcdef/viewer.html';

describe('buildFilePdfRule', () => {
  const rule = buildFilePdfRule(VIEWER);

  it('redirects main frame navigations only', () => {
    expect(rule.condition.resourceTypes).toEqual(['main_frame']);
  });

  it('matches local PDF URLs case-insensitively and captures the whole URL', () => {
    expect(rule.condition.regexFilter).toBe('^(file:///.*\\.pdf)$');
    expect(rule.condition.isUrlFilterCaseSensitive).toBe(false);
    expect(rule.action.redirect?.regexSubstitution).toBe(`${VIEWER}?src=\\1`);
  });

  it('uses the reserved rule id so reinstallation replaces it', () => {
    expect(rule.id).toBe(FILE_PDF_RULE_ID);
  });
});

describe('viewerUrlFor', () => {
  it('percent-encodes the source so query and fragment characters survive', () => {
    expect(viewerUrlFor('https://example.com/a b.pdf?x=1#p2', VIEWER)).toBe(
      `${VIEWER}?src=https%3A%2F%2Fexample.com%2Fa%20b.pdf%3Fx%3D1%23p2`,
    );
  });
});
