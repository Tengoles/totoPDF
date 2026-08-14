import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';
import { t } from '../../src/core/i18n';

type Entry = { message: string; placeholders?: Record<string, { content: string }> };

const CATALOGUE: Record<string, Entry> = en;

describe('the English catalogue', () => {
  it('declares every placeholder its messages reference', () => {
    for (const [key, entry] of Object.entries(CATALOGUE)) {
      const referenced = [...entry.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((match) =>
        (match[1] ?? '').toLowerCase(),
      );
      const declared = Object.keys(entry.placeholders ?? {});
      for (const name of referenced) {
        expect(declared, `${key} references $${name}$`).toContain(name);
      }
    }
  });

  it('declares placeholder names in lowercase', () => {
    for (const [key, entry] of Object.entries(CATALOGUE)) {
      for (const name of Object.keys(entry.placeholders ?? {})) {
        expect(name, `${key} placeholder`).toBe(name.toLowerCase());
      }
    }
  });

  it('has no empty message', () => {
    for (const [key, entry] of Object.entries(CATALOGUE)) {
      expect(entry.message, key).not.toBe('');
    }
  });

  it('keeps palette display names parseable by pdf.js', () => {
    // Serialized into pdf.js's `name=#RRGGBB,...` string, which it splits on
    // ',' then '='. A name containing either breaks its parser.
    const names = ['paletteYellow', 'paletteGreen', 'paletteBlue', 'palettePink', 'paletteOrange'];
    for (const key of names) {
      expect(CATALOGUE[key]?.message).toMatch(/^[A-Za-z0-9 _-]+$/);
    }
  });

  it('keeps the highlight tool name out of the swatch title', () => {
    // palette.ts: the e2e specs locate the Highlight button by accessible
    // name and Playwright matches by substring.
    expect(CATALOGUE.swatchTitle?.message).not.toContain('Highlight');
  });
});

describe('t', () => {
  it('returns a message with no placeholders verbatim', () => {
    expect(t('toolbarSave')).toBe('Save');
  });

  it('substitutes positional arguments', () => {
    expect(t('pageTotal', '42')).toBe('of 42');
  });

  it('substitutes more than one argument in order', () => {
    expect(t('textSizeTitle', '8', '96')).toBe('Font size of text in a text box, 8 to 96.');
  });

  it('does not re-scan a substituted value for placeholders', () => {
    // A PDF whose text contains a '$NAME$' sequence must not be re-expanded.
    expect(t('railEntry', '3', '$PAGE$')).toBe('p.3  $PAGE$');
  });

  it('leaves a placeholder in place when no argument is supplied', () => {
    expect(t('pageTotal')).toBe('of ');
  });
});

describe('the Spanish catalogue', () => {
  const spanish: Record<string, Entry> = es;

  it('has exactly the English key set', () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(CATALOGUE).sort());
  });

  it('declares the same placeholder names at the same argument indices as English', () => {
    // Comparing key sets alone would pass a Spanish entry that declared the
    // same placeholder names as English but mapped them to swapped $N$
    // indices -- e.g. url at $2$ and status at $1$ -- silently reordering
    // t()'s positional arguments in the rendered string.
    const contents = (entry?: Entry): Record<string, string> =>
      Object.fromEntries(
        Object.entries(entry?.placeholders ?? {}).map(([name, placeholder]) => [
          name,
          placeholder.content,
        ]),
      );
    for (const [key, entry] of Object.entries(CATALOGUE)) {
      expect(contents(spanish[key]), key).toEqual(contents(entry));
    }
  });

  it('declares every placeholder its messages reference', () => {
    for (const [key, entry] of Object.entries(spanish)) {
      const referenced = [...entry.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((match) =>
        (match[1] ?? '').toLowerCase(),
      );
      for (const name of referenced) {
        expect(Object.keys(entry.placeholders ?? {}), `${key} references $${name}$`).toContain(name);
      }
    }
  });

  it('has no empty message', () => {
    for (const [key, entry] of Object.entries(spanish)) {
      expect(entry.message, key).not.toBe('');
    }
  });

  it('keeps palette display names parseable by pdf.js', () => {
    const names = ['paletteYellow', 'paletteGreen', 'paletteBlue', 'palettePink', 'paletteOrange'];
    for (const key of names) {
      expect(spanish[key]?.message, key).toMatch(/^[A-Za-z0-9 _-]+$/);
    }
  });

  it('keeps the highlight tool name out of the swatch title', () => {
    expect(spanish.swatchTitle?.message).not.toContain('Resaltar');
  });
});

describe('conformance with chrome.i18n that the node fallback does not itself enforce', () => {
  // substitute() in src/core/i18n.ts takes a placeholder's argument index from
  // `content.slice(1)`, which only works if content is exactly $1..$9; Chrome
  // permits arbitrary content (a constant, or "$1 (example)") and would
  // render it correctly where our fallback would not. Separately, Chrome
  // treats $$ as an escape for a literal $, which our fallback does not
  // implement. Neither is reachable through today's catalogues, but nothing
  // stops a future entry from doing either and only breaking under vitest.
  const catalogues: ReadonlyArray<[string, Record<string, Entry>]> = [
    ['en', CATALOGUE],
    ['es', es],
  ];

  it('gives every placeholder a content of exactly $1 through $9', () => {
    for (const [locale, catalogue] of catalogues) {
      for (const [key, entry] of Object.entries(catalogue)) {
        for (const [name, placeholder] of Object.entries(entry.placeholders ?? {})) {
          expect(placeholder.content, `${locale}.${key}.${name}`).toMatch(/^\$[1-9]$/);
        }
      }
    }
  });

  it('uses every $ in a message as part of a $NAME$ placeholder pair', () => {
    for (const [locale, catalogue] of catalogues) {
      for (const [key, entry] of Object.entries(catalogue)) {
        const withoutPlaceholders = entry.message.replace(/\$[A-Za-z0-9_]+\$/g, '');
        expect(withoutPlaceholders, `${locale}.${key}`).not.toContain('$');
      }
    }
  });
});
