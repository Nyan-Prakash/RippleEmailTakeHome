import type { Theme, Section } from "../../schemas/emailSpec";
import { resolveBackgroundToken, resolveTextColorToken, getReadableTextColor, getContrastRatio } from "../../theme/deriveTheme";

/**
 * Resolve section background color from token or legacy value
 */
export function resolveSectionBackground(section: Section, theme: Theme): string {
  const token = section.style?.background;

  if (!token) {
    return theme.backgroundColor;
  }

  // If palette exists, use it
  if (theme.palette) {
    return resolveBackgroundToken(token, theme.palette);
  }

  // Legacy fallback
  return resolveBackgroundToken(token, undefined, {
    backgroundColor: theme.backgroundColor,
    surfaceColor: theme.surfaceColor,
    primaryColor: theme.primaryColor,
  });
}

/**
 * Resolve section text color from token or legacy value
 * Uses accessible colors when available to ensure WCAG AA compliance
 */
export function resolveSectionTextColor(section: Section, theme: any): string {
  const bgToken = section.style?.background || 'bg';

  // If theme has accessible colors, use them for automatic contrast
  if (theme.accessible) {
    const accessibleTextMap: Record<string, string> = {
      // Legacy tokens
      bg: theme.palette?.ink || theme.textColor,
      surface: theme.accessible.onSurface,
      muted: theme.accessible.onMuted || theme.palette?.ink || theme.textColor,
      primary: theme.accessible.onPrimary,
      accent: theme.accessible.onAccent,
      primarySoft: theme.accessible.onPrimarySoft,
      accentSoft: theme.accessible.onAccentSoft,
      transparent: theme.palette?.ink || theme.textColor,
      brand: theme.accessible.onPrimary,
      image: theme.palette?.bg || theme.backgroundColor,
      // v2 tokens
      base: theme.palette?.ink || theme.textColor,
      alt: theme.accessible.onAlt || theme.palette?.ink || theme.textColor,
      brandTint: theme.accessible.onBrandTint || theme.palette?.ink || theme.textColor,
      brandSolid: theme.accessible.onBrandSolid || theme.accessible.onPrimary || theme.backgroundColor,
    };

    const textColor = accessibleTextMap[bgToken] || theme.textColor;

    // Safety check: verify the text color actually contrasts with the background
    // This prevents black-on-black or white-on-white issues
    if (theme.palette) {
      const bgColor = resolveSectionBackground(section, theme);
      const contrast = getContrastRatio(bgColor, textColor);

      // If contrast is too low (less than 4.5:1 for text), recalculate
      if (contrast < 4.5) {
        return getReadableTextColor(bgColor, theme.palette);
      }
    }

    return textColor;
  }

  // If explicit text token is provided, use it
  const token = section.style?.text;
  if (token) {
    if (theme.palette) {
      return resolveTextColorToken(token, theme.palette);
    }
    return resolveTextColorToken(token, undefined, {
      textColor: theme.textColor,
      backgroundColor: theme.backgroundColor,
    });
  }

  // Fallback: calculate readable color based on background
  if (theme.palette) {
    const bgColor = resolveSectionBackground(section, theme);
    return getReadableTextColor(bgColor, theme.palette);
  }

  return theme.textColor;
}

/**
 * Get section padding values
 */
export function getSectionPadding(section: Section, theme: Theme): {
  paddingX: number;
  paddingY: number;
} {
  const defaultPaddingX = theme.rhythm?.contentPaddingX ?? 16;
  const defaultPaddingY = theme.rhythm?.contentPaddingY ?? 24;

  return {
    paddingX: section.style?.paddingX ?? defaultPaddingX,
    paddingY: section.style?.paddingY ?? defaultPaddingY,
  };
}

/**
 * Check if section should use card container
 */
export function shouldUseCardContainer(section: Section): boolean {
  return section.style?.container === "card";
}

/**
 * Get divider position for section
 */
export function getDividerPosition(section: Section): "none" | "top" | "bottom" | "both" {
  return section.style?.divider || "none";
}

/**
 * Render card container styles
 */
export function getCardStyles(theme: Theme): {
  radius: number;
  border: string;
  shadow: string;
} {
  const cardConfig = theme.components?.card;

  const radius = cardConfig?.radius ?? 8;
  const borderStyle = cardConfig?.border ?? "none";
  const shadowStyle = cardConfig?.shadow ?? "none";

  return {
    radius,
    border: borderStyle === "hairline" ? "1px solid #e0e0e0" : "none",
    shadow: shadowStyle === "soft" ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
  };
}
