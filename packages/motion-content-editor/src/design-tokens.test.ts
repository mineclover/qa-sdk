import { afterEach, describe, expect, it } from "vitest";
import {
  applyMotionEditorTheme,
  DEFAULT_MOTION_EDITOR_THEME,
  MOTION_EDITOR_THEMES,
  MOTION_EDITOR_THEME_STORAGE_KEY,
  readStoredMotionEditorTheme,
  writeStoredMotionEditorTheme,
} from "./design-tokens.js";
import { readMotionEditorPref } from "./prefs-store.js";
import { ensureMotionEditorStyles, MOTION_EDITOR_CSS } from "./styles.js";

function resetThemeState(): void {
  document.documentElement.removeAttribute("data-motion-editor-theme");
  document.documentElement.style.cssText = "";
  document.documentElement.classList.remove("mce-dark", "mce-light");
  document.getElementById("motion-content-editor-styles")?.remove();
  window.localStorage.clear();
}

describe("motion editor design tokens", () => {
  afterEach(() => {
    resetThemeState();
  });

  it("applies dark and light theme variables to :root", () => {
    applyMotionEditorTheme("dark");

    expect(document.documentElement.dataset["motionEditorTheme"]).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.documentElement.classList.contains("mce-dark")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--mce-color-surface-canvas")).toBe(
      MOTION_EDITOR_THEMES.dark.color.surface.canvas,
    );
    expect(document.documentElement.style.getPropertyValue("--mce-font-family-base")).toBe(
      MOTION_EDITOR_THEMES.dark.typography.fontFamily.base,
    );

    applyMotionEditorTheme("light");

    expect(document.documentElement.dataset["motionEditorTheme"]).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.documentElement.classList.contains("mce-light")).toBe(true);
    expect(document.documentElement.classList.contains("mce-dark")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--mce-color-surface-canvas")).toBe(
      MOTION_EDITOR_THEMES.light.color.surface.canvas,
    );
    expect(document.documentElement.style.getPropertyValue("--mce-color-text-primary")).toBe(
      MOTION_EDITOR_THEMES.light.color.text.primary,
    );
  });

  it("ensures styles and default dark theme are installed once", () => {
    ensureMotionEditorStyles();
    ensureMotionEditorStyles();

    const styleTags = document.querySelectorAll("#motion-content-editor-styles");
    expect(styleTags).toHaveLength(1);
    expect(document.documentElement.dataset["motionEditorTheme"]).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--mce-space-4")).toBe(
      MOTION_EDITOR_THEMES.dark.spacing[4],
    );
  });

  it("ships dense editor typography and selection rules", () => {
    expect(MOTION_EDITOR_CSS).toContain("--mce-density-row-height:22px");
    expect(MOTION_EDITOR_CSS).toContain("font-variant-numeric:tabular-nums");
    expect(MOTION_EDITOR_CSS).toContain(':root[data-motion-editor-theme="dark"] .mce-root{--mce-density-divider:#333333}');
    expect(MOTION_EDITOR_CSS).toContain(':root[data-motion-editor-theme="light"] .mce-root{--mce-density-divider:#dddddd}');
    expect(MOTION_EDITOR_CSS).toContain(".mce-item.is-active{border-color:var(--mce-density-divider);border-left-color:var(--mce-color-accent-primary);background:var(--mce-color-accent-soft);box-shadow:none}");
    expect(MOTION_EDITOR_CSS).toContain(".mce-bar.is-active{border-color:var(--mce-density-divider);border-left-color:var(--mce-color-accent-primary);box-shadow:inset 0 0 0 999px color-mix(in srgb, var(--mce-color-accent-primary) 8%, transparent)}");
  });

  it("reads and writes the stored theme selection", () => {
    expect(readStoredMotionEditorTheme()).toBe(DEFAULT_MOTION_EDITOR_THEME);

    writeStoredMotionEditorTheme("light");

    expect(readMotionEditorPref(MOTION_EDITOR_THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredMotionEditorTheme()).toBe("light");
  });
});
