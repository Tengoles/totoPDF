/**
 * Dismiss behaviour shared by every toolbar popover. Extracted from palette.ts
 * when the zoom menu needed the same thing: two menus with two copies of this
 * is two chances for one of them to leak a listener or eat an Escape.
 */
export interface PopoverDismissTargets {
  /** The positioning context, and the boundary an outside click is measured against. */
  wrapper: HTMLElement;
  popover: HTMLElement;
  trigger: HTMLElement;
  close(): void;
  /**
   * Both listeners land on `document`, which outlives the toolbar's elements,
   * so the caller has to hand over a signal that is aborted when the toolbar is
   * rebuilt -- otherwise every document open leaves another pair running.
   */
  signal: AbortSignal;
}

/** Escape and a click anywhere outside the menu both shut it. */
export function bindPopoverDismiss({
  wrapper,
  popover,
  trigger,
  close,
  signal,
}: PopoverDismissTargets): void {
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || popover.hidden) {
        return;
      }
      // document precedes window in the bubble path, so stopping here is what
      // keeps this Escape from also disarming the highlight tool. Escape with
      // the popover shut still reaches the bridge untouched.
      event.stopPropagation();
      close();
      trigger.focus();
    },
    { signal },
  );

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!popover.hidden && event.target instanceof Node && !wrapper.contains(event.target)) {
        close();
      }
    },
    { signal },
  );
}
