export function showBanner(root: HTMLElement, message: string, tone: 'error' | 'notice'): void {
  const banner = document.createElement('div');
  banner.className = `banner banner-${tone}`;
  banner.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  banner.textContent = message;
  root.prepend(banner);
}

export function showLoading(root: HTMLElement, message: string): () => void {
  const element = document.createElement('div');
  element.className = 'loading';
  element.setAttribute('role', 'status');
  element.textContent = message;
  root.append(element);
  return () => element.remove();
}
