import type { Theme, Section } from "../../schemas/emailSpec";
import { resolveBackgroundToken, resolveTextColorToken } from "../../theme/deriveTheme";

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
 */
export function resolveSectionTextColor(section: Section, theme: Theme): string {
  const token = section.style?.text;

  if (!token) {
    return theme.textColor;
  }

  // If palette exists, use it
  if (theme.palette) {
    return resolveTextColorToken(token, theme.palette);
  }

  // Legacy fallback
  return resolveTextColorToken(token, undefined, {
    textColor: theme.textColor,
    backgroundColor: theme.backgroundColor,
  });
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
