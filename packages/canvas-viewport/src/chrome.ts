export interface CanvasChromeElements {
  shell: HTMLDivElement;
  surfaceHost: HTMLDivElement;
  supportHost: HTMLDivElement;
  hudHost: HTMLDivElement;
  minimapHost: HTMLDivElement;
}

export interface CreateCanvasChromeOptions {
  shellClassName?: string;
  surfaceClassName?: string;
  supportHostClassName?: string;
  hudHostClassName?: string;
  minimapClassName?: string;
}

export function createCanvasChrome(
  options: CreateCanvasChromeOptions = {},
): CanvasChromeElements {
  const shell = document.createElement("div");
  shell.className = joinClasses("cv-shell", options.shellClassName);

  const surfaceHost = document.createElement("div");
  surfaceHost.className = joinClasses("cv-surface", options.surfaceClassName);
  shell.appendChild(surfaceHost);

  const supportHost = document.createElement("div");
  supportHost.className = joinClasses("cv-support-host", options.supportHostClassName);
  shell.appendChild(supportHost);

  const hudHost = document.createElement("div");
  hudHost.className = joinClasses("cv-hud-host", options.hudHostClassName);
  shell.appendChild(hudHost);

  const minimapHost = document.createElement("div");
  minimapHost.className = joinClasses("cv-minimap", options.minimapClassName);
  shell.appendChild(minimapHost);

  return {
    shell,
    surfaceHost,
    supportHost,
    hudHost,
    minimapHost,
  };
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}
