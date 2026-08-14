import en from '../i18n/en.json';

/**
 * Every key in the English catalogue, as a union. chrome.i18n.getMessage
 * returns the empty string for a key it does not know and reports it only to
 * the console -- a silently blank button. Typing the key against the
 * catalogue makes that unwritable rather than merely unlikely.
 */
export type MessageKey = keyof typeof en;

interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

const CATALOGUE: Record<string, MessageEntry> = en;

/**
 * chrome.i18n's own substitution, reimplemented for the node test environment.
 * Passing a function to replace() is what keeps a '$1' inside a substituted
 * value -- an excerpt from a PDF, say -- from being expanded a second time.
 */
function substitute(entry: MessageEntry, subs: readonly string[]): string {
  const placeholders = entry.placeholders ?? {};
  return entry.message.replace(/\$([A-Za-z0-9_]+)\$/g, (whole, name: string) => {
    const content = placeholders[name.toLowerCase()]?.content;
    if (content === undefined) {
      return whole;
    }
    return subs[Number(content.slice(1)) - 1] ?? '';
  });
}

/** Undefined under vitest, which runs in node with no extension APIs. */
function i18nApi(): typeof chrome.i18n | undefined {
  return (globalThis as { chrome?: typeof chrome }).chrome?.i18n;
}

/**
 * The one way any string reaches a user. Outside the extension it reads the
 * bundled English catalogue directly, which is what lets the unit specs go on
 * asserting real copy with no chrome mock.
 */
export function t(key: MessageKey, ...subs: string[]): string {
  const api = i18nApi();
  if (api) {
    return api.getMessage(key, subs);
  }
  const entry = CATALOGUE[key];
  // Unreachable: MessageKey is derived from CATALOGUE's own keys.
  return entry ? substitute(entry, subs) : key;
}
