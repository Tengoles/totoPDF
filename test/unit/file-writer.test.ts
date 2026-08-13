import { describe, expect, it, vi } from 'vitest';
import { writeBytes } from '../../src/core/file-writer';

function handleWith(permission: PermissionState, requested: PermissionState = permission) {
  const write = vi.fn();
  const close = vi.fn();
  const handle = {
    queryPermission: vi.fn().mockResolvedValue(permission),
    requestPermission: vi.fn().mockResolvedValue(requested),
    createWritable: vi.fn().mockResolvedValue({ write, close }),
  } as unknown as FileSystemFileHandle;
  return { handle, write, close };
}

describe('writeBytes', () => {
  it('writes and closes when permission is already granted', async () => {
    const { handle, write, close } = handleWith('granted');
    await expect(writeBytes(handle, new Uint8Array([1]))).resolves.toEqual({ kind: 'written' });
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('requests permission when it is only prompt-level', async () => {
    const { handle, close } = handleWith('prompt', 'granted');
    await expect(writeBytes(handle, new Uint8Array([1]))).resolves.toEqual({ kind: 'written' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('reports denial without attempting a write', async () => {
    const { handle, write } = handleWith('prompt', 'denied');
    await expect(writeBytes(handle, new Uint8Array([1]))).resolves.toEqual({
      kind: 'permission-denied',
    });
    expect(write).not.toHaveBeenCalled();
  });
});
