import '../ui/styles.css';
import { type MessageKey, t } from '../core/i18n';

/**
 * Every string is filled in here rather than written into welcome.html, so
 * the page has no language of its own and follows the catalogue like the
 * rest of the UI.
 */
const TEXT: ReadonlyArray<readonly [string, MessageKey]> = [
  ['title', 'welcomeTitle'],
  ['intro', 'welcomeIntro'],
  ['local-heading', 'welcomeLocalHeading'],
  ['local-body', 'welcomeLocalBody'],
  ['open-extensions', 'welcomeOpenExtensionsPage'],
  ['usage-heading', 'welcomeUsageHeading'],
  ['usage-body', 'welcomeUsageBody'],
];

function fill(): void {
  document.documentElement.lang = t('uiLanguage');
  document.title = t('welcomeTitle');
  for (const [id, key] of TEXT) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = t(key);
    }
  }
}

/**
 * A page cannot reach a chrome:// URL through a link -- Chrome blocks the
 * navigation -- but chrome.tabs.create from the page's own script may, and
 * needs no permission to do it. Targeting this extension's own card by id
 * puts the switch on screen rather than leaving the reader to find it.
 */
function bindExtensionsButton(): void {
  const button = document.getElementById('open-extensions');
  button?.addEventListener('click', () => {
    void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });
}

fill();
bindExtensionsButton();
