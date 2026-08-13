import { describe, expect, it } from 'vitest';
import { formatPageTotal, parsePageInput } from '../../src/ui/page-nav';

const PAGE_COUNT = 20;

describe('parsePageInput', () => {
  it('accepts a page inside the document', () => {
    expect(parsePageInput('7', PAGE_COUNT)).toBe(7);
  });

  it('accepts both ends of the range', () => {
    expect(parsePageInput('1', PAGE_COUNT)).toBe(1);
    expect(parsePageInput('20', PAGE_COUNT)).toBe(20);
  });

  it('tolerates whitespace around the number', () => {
    expect(parsePageInput(' 7 ', PAGE_COUNT)).toBe(7);
    expect(parsePageInput('\t12\n', PAGE_COUNT)).toBe(12);
  });

  it('reads leading zeros as the number they spell', () => {
    expect(parsePageInput('007', PAGE_COUNT)).toBe(7);
  });

  it.each(['0', '-1', '-20'])('rejects %s, which is not a page', (raw) => {
    expect(parsePageInput(raw, PAGE_COUNT)).toBeNull();
  });

  it('rejects a page past the end rather than clamping to the last one', () => {
    // Clamping would scroll somewhere the reader did not ask for. Null means
    // "put the box back to where the document actually is" and move nothing.
    expect(parsePageInput('21', PAGE_COUNT)).toBeNull();
    expect(parsePageInput('999', PAGE_COUNT)).toBeNull();
    expect(parsePageInput('999999999999999999999', PAGE_COUNT)).toBeNull();
  });

  it.each(['', ' ', '\t', '\n  '])('rejects the empty entry %j', (raw) => {
    expect(parsePageInput(raw, PAGE_COUNT)).toBeNull();
  });

  it.each(['abc', '5a', 'a5', '1e2', '0x5', '+5', '1,2', 'Infinity', 'NaN', '٧'])(
    'rejects the non-numeric entry %s',
    (raw) => {
      expect(parsePageInput(raw, PAGE_COUNT)).toBeNull();
    },
  );

  it.each(['3.5', '3.0', '.5', '3.'])('rejects the decimal entry %s', (raw) => {
    // pdf.js throws "Invalid page number." on a non-integer currentPageNumber,
    // so a decimal has to be stopped here rather than rounded on the way in.
    expect(parsePageInput(raw, PAGE_COUNT)).toBeNull();
  });

  it('rejects everything while no document is open', () => {
    for (const raw of ['1', '0', '7']) {
      expect(parsePageInput(raw, 0)).toBeNull();
    }
  });

  it('returns an integer for every entry it accepts', () => {
    for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber += 1) {
      const parsed = parsePageInput(String(pageNumber), PAGE_COUNT);
      expect(Number.isInteger(parsed)).toBe(true);
      expect(parsed).toBe(pageNumber);
    }
  });

  it('never throws, whatever is typed into the box', () => {
    for (const raw of ['', '-', '.', 'e', '???', '9'.repeat(400), '1 2', '\0']) {
      expect(() => parsePageInput(raw, PAGE_COUNT)).not.toThrow();
    }
  });
});

describe('formatPageTotal', () => {
  it('names the total the way the toolbar shows it', () => {
    expect(formatPageTotal(20)).toBe('of 20');
    expect(formatPageTotal(1)).toBe('of 1');
    expect(formatPageTotal(1000)).toBe('of 1000');
  });

  it('reports zero pages rather than an empty label when nothing is open', () => {
    expect(formatPageTotal(0)).toBe('of 0');
  });
});
