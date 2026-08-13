import { describe, expect, it, vi } from 'vitest';
import { loadFromFile, loadFromOrigin, parseViewerQuery } from '../../src/core/document-source';

/** Minimal Response double: only the two members loadFromOrigin touches. */
function okFetch(body: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  }) as unknown as typeof fetch;
}

describe('parseViewerQuery', () => {
  it('classifies a file URL as local', () => {
    expect(parseViewerQuery('?src=file:///C:/books/a.pdf')).toEqual({
      kind: 'local',
      url: 'file:///C:/books/a.pdf',
    });
  });

  it('classifies an https URL as remote', () => {
    expect(parseViewerQuery('?src=https://example.com/a.pdf')).toEqual({
      kind: 'remote',
      url: 'https://example.com/a.pdf',
    });
  });

  it('decodes percent-encoded sources', () => {
    expect(parseViewerQuery('?src=file%3A%2F%2F%2FC%3A%2Fa%20b.pdf')).toEqual({
      kind: 'local',
      url: 'file:///C:/a b.pdf',
    });
  });

  it('returns null when no source is present', () => {
    expect(parseViewerQuery('')).toBeNull();
  });

  it('rejects schemes we do not handle', () => {
    expect(parseViewerQuery('?src=javascript:alert(1)')).toBeNull();
  });

  it('preserves a literal plus sign in a path', () => {
    expect(parseViewerQuery('?src=file:///C:/books/a+b.pdf')).toEqual({
      kind: 'local',
      url: 'file:///C:/books/a+b.pdf',
    });
  });

  it('returns null rather than throwing on malformed percent-encoding', () => {
    expect(parseViewerQuery('?src=%zz')).toBeNull();
  });

  it('ignores a src= sequence nested inside another parameter value', () => {
    expect(parseViewerQuery('?redirect=https://evil.test?src=https://evil.test/x.pdf')).toBeNull();
  });

  it('ignores a parameter whose name merely ends with src', () => {
    expect(parseViewerQuery('?notsrc=https://example.com/a.pdf')).toBeNull();
  });

  it('finds src when it is not the first parameter', () => {
    expect(parseViewerQuery('?a=1&src=https://example.com/a.pdf')).toEqual({
      kind: 'remote',
      url: 'https://example.com/a.pdf',
    });
  });
});

describe('file name derivation', () => {
  it('falls back to a default for a bare origin with no path', async () => {
    const loaded = await loadFromOrigin(
      { kind: 'remote', url: 'https://example.com' },
      okFetch('abc'),
    );
    expect(loaded.fileName).toBe('document.pdf');
  });

  it('falls back to a default for a URL ending in a slash', async () => {
    const loaded = await loadFromOrigin(
      { kind: 'remote', url: 'https://example.com/papers/' },
      okFetch('abc'),
    );
    expect(loaded.fileName).toBe('document.pdf');
  });

  it('keeps a literal percent sign in a file name instead of throwing', async () => {
    const loaded = await loadFromOrigin(
      { kind: 'remote', url: 'https://example.com/100%discount.pdf' },
      okFetch('abc'),
    );
    expect(loaded.fileName).toBe('100%discount.pdf');
  });

  it('strips query and fragment from the file name', async () => {
    const loaded = await loadFromOrigin(
      { kind: 'remote', url: 'https://example.com/a.pdf?v=2#page=3' },
      okFetch('abc'),
    );
    expect(loaded.fileName).toBe('a.pdf');
  });
});

describe('loadFromFile', () => {
  it('hashes a dropped file and records its name and origin', async () => {
    const file = new File([new TextEncoder().encode('abc')], 'dropped.pdf', {
      type: 'application/pdf',
    });
    const loaded = await loadFromFile(file);

    expect(loaded.fileName).toBe('dropped.pdf');
    expect(loaded.origin).toEqual({ kind: 'dropped', fileName: 'dropped.pdf' });
    expect(loaded.identity).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('loadFromOrigin', () => {
  it('fetches bytes, hashes them, and derives a file name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('abc').buffer,
    } as unknown as Response);

    const loaded = await loadFromOrigin(
      { kind: 'remote', url: 'https://example.com/papers/attention.pdf' },
      fetchImpl as unknown as typeof fetch,
    );

    expect(loaded.fileName).toBe('attention.pdf');
    expect(loaded.identity).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('throws a readable error when the fetch fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    await expect(
      loadFromOrigin(
        { kind: 'remote', url: 'https://example.com/missing.pdf' },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Could not load https://example.com/missing.pdf (HTTP 404)');
  });
});
