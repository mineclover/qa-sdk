import { PageToolController } from './page-tools.js';
import { inspectRequest, isInspectSelectorRequest, isPageToolRequest, pageToolRequest } from './protocol.js';

const pageTools = new PageToolController(document, (state) => {
  chrome.runtime.sendMessage({ type: 'browser-layout-inspector.state-changed', state });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isInspectSelectorRequest(message)) sendResponse(inspectRequest(message, document));
  else if (isPageToolRequest(message)) sendResponse(pageToolRequest(message, pageTools));
});
