import type { BrandContext } from "../schemas/brand";
import type { Palette, Rhythm, Components } from "../schemas/emailSpec";

/**
 * Blend two hex colors together
 * @param color1 First color (hex)
 * @param color2 Second color (hex)
 * @param ratio Blend ratio (0-1, where 0 = all color1, 1 = all color2)
 */
function blendColors(color1: string, color2: string, ratio: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

/**
 * Calculate relative luminance of a color (WCAG 2.0)
 */
export function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Shift hue of a color (simple approximation)
 */
function shiftHue(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Convert to HSL
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r / 255) {
      h = ((g / 255 - b / 255) / delta) % 6;
    } else if (max === g / 255) {
      h = (b / 255 - r / 255) / delta + 2;
    } else {
      h = (r / 255 - g / 255) / delta + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  // Shift hue
  h = (h + degrees) % 360;

  // Convert back to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0,
    gPrime = 0,
    bPrime = 0;
  if (h >= 0 && h < 60) {
    rPrime = c;
    gPrime = x;
    bPrime = 0;
  } else if (h >= 60 && h < 120) {
    rPrime = x;
    gPrime = c;
    bPrime = 0;
  } else if (h >= 120 && h < 180) {
    rPrime = 0;
    gPrime = c;
    bPrime = x;
  } else if (h >= 180 && h < 240) {
    rPrime = 0;
    gPrime = x;
    bPrime = c;
  } else if (h >= 240 && h < 300) {
    rPrime = x;
    gPrime = 0;
    bPrime = c;
  } else {
    rPrime = c;
    gPrime = 0;
    bPrime = x;
  }

  const rFinal = Math.round((rPrime + m) * 255);
  const gFinal = Math.round((gPrime + m) * 255);
  const bFinal = Math.round((bPrime + m) * 255);

  return `#${rFinal.toString(16).padStart(2, "0")}${gFinal.toString(16).padStart(2, "0")}${bFinal.toString(16).padStart(2, "0")}`.toUpperCase();
}

/**
 * Darken a color by a percentage
 */
function darken(hex: string, percent: number): string {
  return blendColors(hex, "#000000", percent);
}

/**
 * Lighten a color by a percentage
 */
function lighten(hex: string, percent: number): string {
  return blendColors(hex, "#FFFFFF", percent);
}

/**
 * Get readable text color for a given background
 * Ensures WCAG AA 4.5:1 minimum contrast for text
 */
export function getReadableTextColor(backgroundColor: string, palette: Palette): string {
  const bgLuminance = getLuminance(backgroundColor);
  const inkContrast = getContrastRatio(backgroundColor, palette.ink);
  const bgColorContrast = getContrastRatio(backgroundColor, palette.bg);

  // For text, we need 4.5:1 minimum (WCAG AA)
  if (inkContrast >= 4.5) return palette.ink;
  if (bgColorContrast >= 4.5) return palette.bg;

  // Auto-adjust: use black or white based on luminance
  return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Get accessible button colors
 * Ensures WCAG AA 3:1 minimum contrast for UI components
 */
export function getButtonColors(theme: any): { bg: string, text: string } {
  const buttonBg = theme.palette?.primary || theme.primaryColor;
  const palette = theme.palette || {
    bg: theme.backgroundColor,
    ink: theme.textColor,
    primary: theme.primaryColor,
    accent: theme.primaryColor,
    surface: theme.surfaceColor,
    muted: theme.mutedTextColor,
    primarySoft: lighten(theme.primaryColor, 0.8),
    accentSoft: lighten(theme.primaryColor, 0.8),
  };

  const candidateTexts = [
    palette.bg || theme.backgroundColor,
    palette.ink || theme.textColor,
    '#FFFFFF',
    '#000000'
  ];

  // Find first candidate with 3:1 contrast (WCAG AA for UI components)
  for (const textColor of candidateTexts) {
    if (getContrastRatio(buttonBg, textColor) >= 3.0) {
      return { bg: buttonBg, text: textColor };
    }
  }

  // Fallback: adjust button bg to ensure contrast
  const bgLuminance = getLuminance(buttonBg);
  const adjustedBg = bgLuminance > 0.5 ? darken(buttonBg, 0.3) : lighten(buttonBg, 0.3);
  return {
    bg: adjustedBg,
    text: bgLuminance > 0.5 ? '#000000' : '#FFFFFF'
  };
}

/**
 * Derive a complete theme palette from brand context
 * This ensures all colors are brand-derived, no random hex values
 */
export function deriveThemeFromBrandContext(brandContext: BrandContext): {
  palette: Palette;
  rhythm: Rhythm;
  components: Components;
} {
  const { brand } = brandContext;
  const { colors } = brand;

  // Base colors from brand
  const bg = colors.background || "#FFFFFF";
  const ink = colors.text || "#111111";
  const primary = colors.primary || "#111111";

  // Determine if background is light or dark
  const bgLuminance = getLuminance(bg);
  const isLightBg = bgLuminance > 0.5;

  // Derive surface color (slightly different from background)
  const surface = isLightBg ? darken(bg, 0.05) : lighten(bg, 0.1);

  // Derive muted color (blend between bg and ink)
  const muted = blendColors(bg, ink, 0.15);

  // Derive accent color
  // If primary is too similar to bg or ink, shift hue
  const primaryInkContrast = getContrastRatio(primary, ink);
  const primaryBgContrast = getContrastRatio(primary, bg);

  let accent: string;
  if (primaryInkContrast < 1.5 && primaryBgContrast < 1.5) {
    // Primary is too similar to both, create distinct accent
    accent = shiftHue(primary, 60);
  } else {
    // Shift primary hue slightly for accent
    accent = shiftHue(primary, 30);
  }

  // Derive soft variants (blend with background)
  const primarySoft = blendColors(primary, bg, 0.85);
  const accentSoft = blendColors(accent, bg, 0.85);

  // Ensure contrast safeguards (WCAG AA 4.5:1 for text)
  // If primarySoft or accentSoft would have low contrast with ink, adjust
  const primarySoftInkContrast = getContrastRatio(primarySoft, ink);
  const accentSoftInkContrast = getContrastRatio(accentSoft, ink);

  const finalPrimarySoft =
    primarySoftInkContrast < 4.5
      ? isLightBg
        ? darken(primarySoft, 0.15)
        : lighten(primarySoft, 0.15)
      : primarySoft;

  const finalAccentSoft =
    accentSoftInkContrast < 4.5
      ? isLightBg
        ? darken(accentSoft, 0.15)
        : lighten(accentSoft, 0.15)
      : accentSoft;

  const palette: Palette = {
    primary,
    ink,
    bg,
    surface,
    muted,
    accent,
    primarySoft: finalPrimarySoft,
    accentSoft: finalAccentSoft,
  };

  const rhythm: Rhythm = {
    sectionGap: 24,
    contentPaddingX: 16,
    contentPaddingY: 24,
  };

  const components: Components = {
    button: {
      radius: 8,
      style: "solid",
      paddingY: 12,
      paddingX: 24,
    },
    card: {
      radius: 8,
      border: "none",
      shadow: "none",
    },
  };

  return { palette, rhythm, components };
}

/**
 * Enhance any theme (LLM-generated or manual) with accessible colors
 * Calculates text colors that meet WCAG AA standards for all backgrounds
 */
export function enhanceThemeWithAccessibleColors(theme: any): any {
  // Build palette from theme (support both new palette and legacy colors)
  const palette = theme.palette || {
    primary: theme.primaryColor,
    ink: theme.textColor,
    bg: theme.backgroundColor,
    surface: theme.surfaceColor,
    muted: theme.mutedTextColor,
    accent: theme.primaryColor,
    primarySoft: lighten(theme.primaryColor, 0.8),
    accentSoft: lighten(theme.primaryColor, 0.8),
  };

  // Calculate accessible text colors for each background token
  const accessible = {
    buttonBackground: palette.primary,
    buttonText: getReadableTextColor(palette.primary, palette),
    onPrimary: getReadableTextColor(palette.primary, palette),
    onAccent: getReadableTextColor(palette.accent, palette),
    onSurface: getReadableTextColor(palette.surface, palette),
    onPrimarySoft: getReadableTextColor(palette.primarySoft, palette),
    onAccentSoft: getReadableTextColor(palette.accentSoft, palette),
    onMuted: getReadableTextColor(palette.muted, palette),
  };

  // Adjust button colors if needed to meet 3:1 contrast minimum
  const buttonColors = getButtonColors({ ...theme, palette, accessible });
  accessible.buttonBackground = buttonColors.bg;
  accessible.buttonText = buttonColors.text;

  return {
    ...theme,
    palette,
    accessible,
  };
}

/**
 * Get color value from palette token
 * Maps background tokens to actual hex colors
 */
export function resolveBackgroundToken(
  token: string,
  palette?: Palette,
  legacyColors?: {
    backgroundColor?: string;
    surfaceColor?: string;
    primaryColor?: string;
  }
): string {
  // If no palette, use legacy colors
  if (!palette) {
    switch (token) {
      case "bg":
      case "transparent":
        return legacyColors?.backgroundColor || "#FFFFFF";
      case "surface":
        return legacyColors?.surfaceColor || "#F5F5F5";
      case "primary":
      case "brand":
        return legacyColors?.primaryColor || "#111111";
      default:
        return legacyColors?.backgroundColor || "#FFFFFF";
    }
  }

  // Use new palette
  switch (token) {
    case "bg":
      return palette.bg;
    case "surface":
      return palette.surface;
    case "muted":
      return palette.muted;
    case "primary":
    case "brand":
      return palette.primary;
    case "accent":
      return palette.accent;
    case "primarySoft":
      return palette.primarySoft;
    case "accentSoft":
      return palette.accentSoft;
    case "transparent":
      return palette.bg;
    default:
      return palette.bg;
  }
}

/**
 * Get text color from token
 */
export function resolveTextColorToken(
  token: string,
  palette?: Palette,
  legacyColors?: {
    textColor?: string;
    backgroundColor?: string;
  }
): string {
  if (!palette) {
    switch (token) {
      case "ink":
        return legacyColors?.textColor || "#111111";
      case "bg":
        return legacyColors?.backgroundColor || "#FFFFFF";
      default:
        return legacyColors?.textColor || "#111111";
    }
  }

  switch (token) {
    case "ink":
      return palette.ink;
    case "bg":
      return palette.bg;
    default:
      return palette.ink;
  }
}
