export const FILE_PDF_RULE_ID = 1;

/**
 * declarativeNetRequest cannot percent-encode a captured group, so the raw file
 * URL is substituted verbatim. The condition therefore refuses to match paths
 * containing '&' or '#', which would be truncated by the redirect. Those open
 * in Chrome's viewer, from where the toolbar action -- which does encode, via
 * viewerUrlFor -- hands them to totoPDF intact.
 */
export function buildFilePdfRule(viewerUrl: string): chrome.declarativeNetRequest.Rule {
  return {
    id: FILE_PDF_RULE_ID,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      redirect: { regexSubstitution: `${viewerUrl}?src=\\1` },
    },
    condition: {
      regexFilter: '^(file:///[^&#]*\\.pdf)$',
      isUrlFilterCaseSensitive: false,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  };
}

export function viewerUrlFor(pdfUrl: string, viewerBase: string): string {
  return `${viewerBase}?src=${encodeURIComponent(pdfUrl)}`;
}

export async function installInterception(): Promise<void> {
  const viewerUrl = chrome.runtime.getURL('viewer.html');
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [FILE_PDF_RULE_ID],
    addRules: [buildFilePdfRule(viewerUrl)],
  });
}

export const ESCAPE_RULE_ID = 2;
const ESCAPE_WINDOW_MS = 10_000;

/** Lets one navigation through to Chrome's native viewer, then re-arms. */
export async function allowNativeViewerOnce(url: string): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ESCAPE_RULE_ID],
    addRules: [
      {
        id: ESCAPE_RULE_ID,
        priority: 2,
        action: { type: 'allow' as chrome.declarativeNetRequest.RuleActionType },
        condition: {
          urlFilter: url,
          resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
        },
      },
    ],
  });
  setTimeout(() => {
    void chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ESCAPE_RULE_ID] });
  }, ESCAPE_WINDOW_MS);
}
