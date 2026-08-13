export type BannerTone = 'error' | 'notice' | 'success';

const BANNER_CLASS = 'banner';

/**
 * Banners are prepended to the page and nothing used to take them away, so a
 * failed save's red banner stayed on screen through every later successful
 * one, and notices from documents that were closed long ago stacked above the
 * toolbar. Every document open and every save clears the previous round first,
 * which makes what is on screen describe the last thing that happened.
 */
export function clearBanners(root: HTMLElement): void {
  for (const banner of root.querySelectorAll(`.${BANNER_CLASS}`)) {
    banner.remove();
  }
}

/**
 * `dismissAfterMs` is for confirmations that stop being true shortly after
 * they are shown -- "saved" being the only one. Errors and notices are left
 * until something clears them.
 */
export function showBanner(
  root: HTMLElement,
  message: string,
  tone: BannerTone,
  dismissAfterMs?: number,
): void {
  const banner = document.createElement('div');
  banner.className = `${BANNER_CLASS} ${BANNER_CLASS}-${tone}`;
  banner.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  banner.textContent = message;
  root.prepend(banner);
  if (dismissAfterMs !== undefined) {
    setTimeout(() => banner.remove(), dismissAfterMs);
  }
}

export function showLoading(root: HTMLElement, message: string): () => void {
  const element = document.createElement('div');
  element.className = 'loading';
  element.setAttribute('role', 'status');
  element.textContent = message;
  root.append(element);
  return () => element.remove();
}
