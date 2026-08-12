import { describe, expect, it, vi } from 'vitest';
import { loadFromOrigin, parseViewerQuery } from '../../src/core/document-source';

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
