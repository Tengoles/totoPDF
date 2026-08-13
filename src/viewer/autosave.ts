import type { SaveStatus, SaveStatusSource } from '../ui/save-status';
import type { SilentSaveOutcome } from './document-save';

/**
 * Long enough that a burst of highlights, or a text box being typed into,
 * coalesces into one appended revision instead of one per keystroke; short
 * enough that closing the tab a moment after stopping is still safe.
 */
export const AUTOSAVE_DEBOUNCE_MS = 2000;

export interface AutosaveDeps {
  /** The silent save path: never prompts, reports why it declined instead. */
  write(): Promise<SilentSaveOutcome>;
  /** Recomputed from live controller state on every read, never cached. */
  status(): SaveStatus;
  /** Shown once per document. Autosave is off for that document afterwards. */
  reportFailure(error: unknown): void;
}

export interface Autosave extends SaveStatusSource {
  /** A genuine content change: the annotation hash moved, not just a selection. */
  onContentChange(): void;
  /** Drops a pending write. The document it was built for is being replaced. */
  cancel(): void;
  /**
   * A new document: nothing pending, and autosave permitted again. Does not
   * publish, because the caller publishes once for the whole switch whether it
   * succeeded or not.
   */
  rearm(): void;
  /** Re-reads status() and hands it to the toolbar. */
  publish(): void;
}

/**
 * Debounces content changes into at most one write, and owns the two facts the
 * toolbar readout needs: what is happening, and whether autosave is still
 * allowed to happen at all.
 *
 * There is no retry. A write that throws stops autosave for this document and
 * says so once, because the plausible causes -- a revoked grant, a full disk, a
 * removed drive -- are all things a timer cannot fix, and a loop retrying them
 * every two seconds would bury the user in banners while still not saving.
 */
export function createAutosave(deps: AutosaveDeps): Autosave {
  const listeners = new Set<(status: SaveStatus) => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function publish(): void {
    const status = deps.status();
    for (const listener of listeners) {
      listener(status);
    }
  }

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(): void {
    // Resetting the timer, not extending a first one, is what makes a burst
    // collapse: only a genuine pause writes.
    cancel();
    timer = setTimeout(() => void fire(), AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * Fires unconditionally rather than re-checking whether the document is
   * still dirty. A write started earlier can have already reported the
   * document clean while the change that armed this timer came in after its
   * bytes were built, and skipping on that basis would drop exactly the edit
   * this timer exists for.
   */
  async function fire(): Promise<void> {
    timer = null;
    // performSilentSave takes the in-flight latch before its first await, so
    // the readout can say Saving straight away.
    const running = deps.write();
    publish();
    try {
      if ((await running) === 'already-saving') {
        // Another write owns the file, and it may have built its bytes before
        // this change existed. Wait out another debounce rather than drop it.
        // The latch always clears in a finally, so this cannot spin.
        schedule();
      }
    } catch (error) {
      stopped = true;
      deps.reportFailure(error);
    }
    publish();
  }

  return {
    onContentChange() {
      if (!stopped) {
        schedule();
      }
      publish();
    },
    cancel,
    rearm() {
      cancel();
      stopped = false;
    },
    publish,
    state: () => deps.status(),
    subscribe(listener, signal) {
      if (signal.aborted) {
        return;
      }
      listeners.add(listener);
      signal.addEventListener('abort', () => listeners.delete(listener));
    },
  };
}
