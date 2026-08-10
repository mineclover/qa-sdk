void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const request = message as { readonly type?: unknown; readonly tabId?: unknown };
  if (request.type === 'browser-layout-inspector.capture-visible-tab') {
    chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
      const error = chrome.runtime.lastError?.message;
      sendResponse(error ? { ok: false, error } : { ok: true, dataUrl });
    });
    return true;
  }
  if (request.type !== 'browser-layout-inspector.ensure-content-script' || typeof request.tabId !== 'number') return;
  chrome.scripting.executeScript(
    { target: { tabId: request.tabId }, files: ['content.js'] },
    () => {
      const error = chrome.runtime.lastError?.message;
      sendResponse(error ? { ok: false, error } : { ok: true });
    },
  );
  return true;
});
