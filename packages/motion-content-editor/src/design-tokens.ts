// @def.boundary motion-content-editor-system
import {
  MOTION_EDITOR_THEME_STORAGE_KEY,
  readMotionEditorPref,
  writeMotionEditorPref,
} from "./prefs-store.js";

export { MOTION_EDITOR_THEME_STORAGE_KEY } from "./prefs-store.js";

export type MotionEditorThemeName = "dark" | "light";

export interface MotionEditorThemeTokens {
  readonly color: {
    readonly surface: {
      readonly page: string;
      readonly canvas: string;
      readonly pane: string;
      readonly paneAlt: string;
      readonly section: string;
      readonly input: string;
      readonly toolbar: string;
      readonly stage: string;
      readonly stageGlow: string;
      readonly card: string;
      readonly overlay: string;
      readonly track: string;
    };
    readonly text: {
      readonly primary: string;
      readonly secondary: string;
      readonly muted: string;
      readonly subtle: string;
      readonly inverse: string;
      readonly accent: string;
    };
    readonly accent: {
      readonly primary: string;
      readonly contrast: string;
      readonly soft: string;
      readonly info: string;
      readonly success: string;
      readonly transition: string;
    };
    readonly border: {
      readonly default: string;
      readonly muted: string;
      readonly strong: string;
      readonly accent: string;
      readonly info: string;
      readonly success: string;
      readonly warning: string;
      readonly danger: string;
    };
    readonly state: {
      readonly info: string;
      readonly success: string;
      readonly warning: string;
      readonly danger: string;
      readonly neutral: string;
    };
  };
  readonly typography: {
    readonly fontFamily: {
      readonly base: string;
      readonly display: string;
      readonly mono: string;
    };
    readonly fontSize: {
      readonly xs: string;
      readonly sm: string;
      readonly md: string;
      readonly lg: string;
      readonly xl: string;
      readonly "2xl": string;
      readonly hero: string;
    };
    readonly fontWeight: {
      readonly regular: string;
      readonly medium: string;
      readonly semibold: string;
      readonly bold: string;
    };
    readonly lineHeight: {
      readonly tight: string;
      readonly snug: string;
      readonly normal: string;
      readonly relaxed: string;
      readonly spacious: string;
    };
  };
  readonly spacing: {
    readonly 0: string;
    readonly 1: string;
    readonly 2: string;
    readonly 3: string;
    readonly 4: string;
    readonly 5: string;
    readonly 6: string;
    readonly 7: string;
    readonly 8: string;
    readonly 9: string;
    readonly 10: string;
    readonly 12: string;
  };
  readonly radius: {
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
    readonly pill: string;
  };
  readonly shadow: {
    readonly elevation1: string;
    readonly elevation2: string;
    readonly elevation3: string;
  };
}

const MONO_STACK = '"JetBrains Mono", "Fira Code", "SF Mono", monospace';

export const DEFAULT_MOTION_EDITOR_THEME: MotionEditorThemeName = "dark";

export const MOTION_EDITOR_THEMES = {
  dark: {
    color: {
      surface: {
        page: "#0c1016",
        canvas: "#10141b",
        pane: "#131922",
        paneAlt: "#18202b",
        section: "rgba(255,255,255,0.04)",
        input: "#0c1117",
        toolbar: "rgba(0,0,0,0.18)",
        stage: "linear-gradient(180deg,#171d26 0%,#0f141a 100%)",
        stageGlow: "radial-gradient(circle at 20% 0%, rgba(240,143,32,0.14), transparent 32%)",
        card: "rgba(255,255,255,0.05)",
        overlay: "rgba(8,12,18,0.84)",
        track: "rgba(255,255,255,0.04)",
      },
      text: {
        primary: "#eef3f8",
        secondary: "#d5deea",
        muted: "#9fb3c8",
        subtle: "#8fa6bc",
        inverse: "#10141b",
        accent: "#f7fbff",
      },
      accent: {
        primary: "#f08f20",
        contrast: "#111820",
        soft: "rgba(240,143,32,0.08)",
        info: "#89b2ff",
        success: "#8bdfb2",
        transition: "#e8a8ff",
      },
      border: {
        default: "rgba(255,255,255,0.08)",
        muted: "rgba(255,255,255,0.05)",
        strong: "rgba(255,255,255,0.12)",
        accent: "rgba(240,143,32,0.4)",
        info: "rgba(92,146,255,0.42)",
        success: "rgba(122,214,160,0.42)",
        warning: "rgba(240,143,32,0.48)",
        danger: "rgba(255,97,97,0.32)",
      },
      state: {
        info: "#4bb7ff",
        success: "#7ad6a0",
        warning: "#f08f20",
        danger: "#ff6c6c",
        neutral: "#9ba7b7",
      },
    },
    typography: {
      fontFamily: {
        base: MONO_STACK,
        display: MONO_STACK,
        mono: MONO_STACK,
      },
      fontSize: {
        xs: "11px",
        sm: "12px",
        md: "13px",
        lg: "17px",
        xl: "20px",
        "2xl": "24px",
        hero: "68px",
      },
      fontWeight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: {
        tight: "1",
        snug: "1.2",
        normal: "1.55",
        relaxed: "1.6",
        spacious: "1.7",
      },
    },
    spacing: {
      0: "0px",
      1: "4px",
      2: "8px",
      3: "12px",
      4: "16px",
      5: "20px",
      6: "24px",
      7: "28px",
      8: "32px",
      9: "36px",
      10: "40px",
      12: "48px",
    },
    radius: {
      sm: "12px",
      md: "16px",
      lg: "20px",
      pill: "999px",
    },
    shadow: {
      elevation1: "0 10px 24px rgba(0,0,0,0.16)",
      elevation2: "0 18px 32px rgba(0,0,0,0.18)",
      elevation3: "0 24px 44px rgba(0,0,0,0.26)",
    },
  },
  light: {
    color: {
      surface: {
        page: "#f4f7fb",
        canvas: "#fbfdff",
        pane: "#f5f8fc",
        paneAlt: "#eef3f8",
        section: "rgba(16,20,27,0.04)",
        input: "#ffffff",
        toolbar: "rgba(255,255,255,0.9)",
        stage: "linear-gradient(180deg,#ffffff 0%,#edf3fb 100%)",
        stageGlow: "radial-gradient(circle at 20% 0%, rgba(240,143,32,0.18), transparent 34%)",
        card: "rgba(255,255,255,0.9)",
        overlay: "rgba(255,255,255,0.88)",
        track: "rgba(16,20,27,0.06)",
      },
      text: {
        primary: "#10141b",
        secondary: "#24303e",
        muted: "#516173",
        subtle: "#667789",
        inverse: "#f7fbff",
        accent: "#0c1117",
      },
      accent: {
        primary: "#d97706",
        contrast: "#fff9ef",
        soft: "rgba(217,119,6,0.12)",
        info: "#2f6fe4",
        success: "#1f8f59",
        transition: "#9b4fd0",
      },
      border: {
        default: "rgba(16,20,27,0.12)",
        muted: "rgba(16,20,27,0.08)",
        strong: "rgba(16,20,27,0.16)",
        accent: "rgba(217,119,6,0.36)",
        info: "rgba(47,111,228,0.36)",
        success: "rgba(31,143,89,0.36)",
        warning: "rgba(217,119,6,0.42)",
        danger: "rgba(220,76,76,0.28)",
      },
      state: {
        info: "#2563eb",
        success: "#15803d",
        warning: "#d97706",
        danger: "#dc2626",
        neutral: "#64748b",
      },
    },
    typography: {
      fontFamily: {
        base: MONO_STACK,
        display: MONO_STACK,
        mono: MONO_STACK,
      },
      fontSize: {
        xs: "11px",
        sm: "12px",
        md: "13px",
        lg: "17px",
        xl: "20px",
        "2xl": "24px",
        hero: "68px",
      },
      fontWeight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: {
        tight: "1",
        snug: "1.2",
        normal: "1.55",
        relaxed: "1.6",
        spacious: "1.7",
      },
    },
    spacing: {
      0: "0px",
      1: "4px",
      2: "8px",
      3: "12px",
      4: "16px",
      5: "20px",
      6: "24px",
      7: "28px",
      8: "32px",
      9: "36px",
      10: "40px",
      12: "48px",
    },
    radius: {
      sm: "12px",
      md: "16px",
      lg: "20px",
      pill: "999px",
    },
    shadow: {
      elevation1: "0 10px 24px rgba(15,23,42,0.08)",
      elevation2: "0 18px 32px rgba(15,23,42,0.12)",
      elevation3: "0 24px 44px rgba(15,23,42,0.16)",
    },
  },
} satisfies Record<MotionEditorThemeName, MotionEditorThemeTokens>;

function isMotionEditorThemeName(value: unknown): value is MotionEditorThemeName {
  return value === "dark" || value === "light";
}

function toMotionEditorCssVariables(
  tokens: MotionEditorThemeTokens,
): Record<`--mce-${string}`, string> {
  return {
    "--mce-color-surface-page": tokens.color.surface.page,
    "--mce-color-surface-canvas": tokens.color.surface.canvas,
    "--mce-color-surface-pane": tokens.color.surface.pane,
    "--mce-color-surface-pane-alt": tokens.color.surface.paneAlt,
    "--mce-color-surface-section": tokens.color.surface.section,
    "--mce-color-surface-input": tokens.color.surface.input,
    "--mce-color-surface-toolbar": tokens.color.surface.toolbar,
    "--mce-color-surface-stage": tokens.color.surface.stage,
    "--mce-color-surface-stage-glow": tokens.color.surface.stageGlow,
    "--mce-color-surface-card": tokens.color.surface.card,
    "--mce-color-surface-overlay": tokens.color.surface.overlay,
    "--mce-color-surface-track": tokens.color.surface.track,
    "--mce-color-text-primary": tokens.color.text.primary,
    "--mce-color-text-secondary": tokens.color.text.secondary,
    "--mce-color-text-muted": tokens.color.text.muted,
    "--mce-color-text-subtle": tokens.color.text.subtle,
    "--mce-color-text-inverse": tokens.color.text.inverse,
    "--mce-color-text-accent": tokens.color.text.accent,
    "--mce-color-accent-primary": tokens.color.accent.primary,
    "--mce-color-accent-contrast": tokens.color.accent.contrast,
    "--mce-color-accent-soft": tokens.color.accent.soft,
    "--mce-color-accent-info": tokens.color.accent.info,
    "--mce-color-accent-success": tokens.color.accent.success,
    "--mce-color-accent-transition": tokens.color.accent.transition,
    "--mce-color-border-default": tokens.color.border.default,
    "--mce-color-border-muted": tokens.color.border.muted,
    "--mce-color-border-strong": tokens.color.border.strong,
    "--mce-color-border-accent": tokens.color.border.accent,
    "--mce-color-border-info": tokens.color.border.info,
    "--mce-color-border-success": tokens.color.border.success,
    "--mce-color-border-warning": tokens.color.border.warning,
    "--mce-color-border-danger": tokens.color.border.danger,
    "--mce-color-state-info": tokens.color.state.info,
    "--mce-color-state-success": tokens.color.state.success,
    "--mce-color-state-warning": tokens.color.state.warning,
    "--mce-color-state-danger": tokens.color.state.danger,
    "--mce-color-state-neutral": tokens.color.state.neutral,
    "--mce-font-family-base": tokens.typography.fontFamily.base,
    "--mce-font-family-display": tokens.typography.fontFamily.display,
    "--mce-font-family-mono": tokens.typography.fontFamily.mono,
    "--mce-font-size-xs": tokens.typography.fontSize.xs,
    "--mce-font-size-sm": tokens.typography.fontSize.sm,
    "--mce-font-size-md": tokens.typography.fontSize.md,
    "--mce-font-size-lg": tokens.typography.fontSize.lg,
    "--mce-font-size-xl": tokens.typography.fontSize.xl,
    "--mce-font-size-2xl": tokens.typography.fontSize["2xl"],
    "--mce-font-size-hero": tokens.typography.fontSize.hero,
    "--mce-font-weight-regular": tokens.typography.fontWeight.regular,
    "--mce-font-weight-medium": tokens.typography.fontWeight.medium,
    "--mce-font-weight-semibold": tokens.typography.fontWeight.semibold,
    "--mce-font-weight-bold": tokens.typography.fontWeight.bold,
    "--mce-line-height-tight": tokens.typography.lineHeight.tight,
    "--mce-line-height-snug": tokens.typography.lineHeight.snug,
    "--mce-line-height-normal": tokens.typography.lineHeight.normal,
    "--mce-line-height-relaxed": tokens.typography.lineHeight.relaxed,
    "--mce-line-height-spacious": tokens.typography.lineHeight.spacious,
    "--mce-space-0": tokens.spacing[0],
    "--mce-space-1": tokens.spacing[1],
    "--mce-space-2": tokens.spacing[2],
    "--mce-space-3": tokens.spacing[3],
    "--mce-space-4": tokens.spacing[4],
    "--mce-space-5": tokens.spacing[5],
    "--mce-space-6": tokens.spacing[6],
    "--mce-space-7": tokens.spacing[7],
    "--mce-space-8": tokens.spacing[8],
    "--mce-space-9": tokens.spacing[9],
    "--mce-space-10": tokens.spacing[10],
    "--mce-space-12": tokens.spacing[12],
    "--mce-radius-sm": tokens.radius.sm,
    "--mce-radius-md": tokens.radius.md,
    "--mce-radius-lg": tokens.radius.lg,
    "--mce-radius-pill": tokens.radius.pill,
    "--mce-shadow-elevation-1": tokens.shadow.elevation1,
    "--mce-shadow-elevation-2": tokens.shadow.elevation2,
    "--mce-shadow-elevation-3": tokens.shadow.elevation3,
  };
}

export function resolveMotionEditorTheme(
  theme: MotionEditorThemeName | MotionEditorThemeTokens,
): MotionEditorThemeTokens {
  return typeof theme === "string" ? MOTION_EDITOR_THEMES[theme] : theme;
}

export function readStoredMotionEditorTheme(
  fallback: MotionEditorThemeName = DEFAULT_MOTION_EDITOR_THEME,
): MotionEditorThemeName {
  if (typeof document !== "undefined") {
    const appliedTheme = document.documentElement.dataset["motionEditorTheme"];
    if (isMotionEditorThemeName(appliedTheme)) {
      fallback = appliedTheme;
    }
  }

  const storedTheme = readMotionEditorPref(MOTION_EDITOR_THEME_STORAGE_KEY);
  return isMotionEditorThemeName(storedTheme) ? storedTheme : fallback;
}

export function writeStoredMotionEditorTheme(theme: MotionEditorThemeName): void {
  writeMotionEditorPref(MOTION_EDITOR_THEME_STORAGE_KEY, theme);
}

export function applyMotionEditorTheme(
  theme: MotionEditorThemeName | MotionEditorThemeTokens = DEFAULT_MOTION_EDITOR_THEME,
): MotionEditorThemeTokens {
  const resolvedTheme = resolveMotionEditorTheme(theme);

  if (typeof document === "undefined") {
    return resolvedTheme;
  }

  const root = document.documentElement;
  const variables = toMotionEditorCssVariables(resolvedTheme);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }

  const themeName = typeof theme === "string" ? theme : "custom";
  root.dataset["motionEditorTheme"] = themeName;
  root.style.colorScheme = themeName === "light" ? "light" : "dark";
  root.classList.remove("mce-dark", "mce-light");
  if (themeName === "dark" || themeName === "light") {
    root.classList.add(`mce-${themeName}`);
  }

  return resolvedTheme;
}
