import { describe, expect, it, vi } from 'vitest';
import { ensureWritePermission, writeGrantedBytes } from '../../src/core/file-writer';

function handleWith(permission: PermissionState, requested: PermissionState = permission) {
  const write = vi.fn();
  const close = vi.fn();
  const queryPermission = vi.fn().mockResolvedValue(permission);
  const requestPermission = vi.fn().mockResolvedValue(requested);
  const handle = {
    queryPermission,
    requestPermission,
    createWritable: vi.fn().mockResolvedValue({ write, close }),
  } as unknown as FileSystemFileHandle;
  return { handle, write, close, queryPermission, requestPermission };
}

describe('ensureWritePermission', () => {
  it('accepts an already-granted handle without prompting', async () => {
    const { handle, requestPermission } = handleWith('granted');
    await expect(ensureWritePermission(handle)).resolves.toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('prompts when permission is only prompt-level', async () => {
    const { handle, requestPermission } = handleWith('prompt', 'granted');
    await expect(ensureWritePermission(handle)).resolves.toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it('reports denial', async () => {
    const { handle } = handleWith('prompt', 'denied');
    await expect(ensureWritePermission(handle)).resolves.toBe(false);
  });
});

describe('writeGrantedBytes', () => {
  it('stages through a writable and closes it', async () => {
    const { handle, write, close } = handleWith('granted');
    await writeGrantedBytes(handle, new Uint8Array([1]));
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  // The whole point of the split: by the time this runs, the user activation
  // that a permission prompt needs has expired, so it must not try to prompt.
  it('never touches the permission API', async () => {
    const { handle, queryPermission, requestPermission } = handleWith('prompt', 'denied');
    await writeGrantedBytes(handle, new Uint8Array([1]));
    expect(queryPermission).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
