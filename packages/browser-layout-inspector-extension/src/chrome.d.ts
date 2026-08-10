interface ChromeLastError {
  readonly message?: string;
}

interface ChromeMessageEvent {
  addListener(listener: (message: unknown, sender: { readonly tab?: { readonly id?: number } }, sendResponse: (response: unknown) => void) => boolean | void): void;
}

interface ChromeApi {
  readonly runtime: {
    readonly lastError?: ChromeLastError;
    readonly onMessage: ChromeMessageEvent;
    sendMessage(message: unknown, callback?: (response: unknown) => void): void;
  };
  readonly tabs: {
    query(queryInfo: { readonly active: boolean; readonly currentWindow: boolean }, callback: (tabs: readonly { readonly id?: number }[]) => void): void;
    sendMessage(tabId: number, message: unknown, callback: (response: unknown) => void): void;
    captureVisibleTab(windowId: number | undefined, options: { readonly format: 'png' | 'jpeg'; readonly quality?: number }, callback: (dataUrl: string) => void): void;
  };
  readonly scripting: {
    executeScript(options: { readonly target: { readonly tabId: number }; readonly files: readonly string[] }, callback: () => void): void;
  };
  readonly sidePanel: {
    setPanelBehavior(options: { readonly openPanelOnActionClick: boolean }): Promise<void>;
  };
}

declare const chrome: ChromeApi;
