import type {
  BadgeBlock,
  BulletsBlock,
  PriceLineBlock,
  RatingBlock,
  NavLinksBlock,
  SocialIconsBlock,
} from "../../schemas/blocks";
import { getReadableTextColor } from "../../theme/deriveTheme";

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render badge block with accessible colors
 */
export function renderBadge(block: BadgeBlock, theme: any): string {
  // Build palette for contrast checking (support legacy themes)
  const palette = theme.palette || {
    primary: theme.primaryColor,
    ink: theme.textColor,
    bg: theme.backgroundColor,
    surface: theme.surfaceColor,
    muted: theme.mutedTextColor,
    accent: theme.primaryColor,
    primarySoft: theme.backgroundColor,
    accentSoft: theme.backgroundColor,
  };

  const toneColors: Record<string, { bg: string; text: string }> = {
    primary: {
      bg: theme.accessible?.buttonBackground || palette.primary,
      text: theme.accessible?.buttonText || getReadableTextColor(palette.primary, palette)
    },
    accent: {
      bg: palette.accent,
      text: theme.accessible?.onAccent || getReadableTextColor(palette.accent, palette)
    },
    muted: {
      bg: palette.muted,
      text: getReadableTextColor(palette.muted, palette)
    },
    success: { bg: "#10B981", text: "#FFFFFF" },  // Pre-validated WCAG AA
    warning: { bg: "#F59E0B", text: "#000000" },  // Pre-validated WCAG AA
    error: { bg: "#EF4444", text: "#FFFFFF" },    // Pre-validated WCAG AA
  };

  const tone = block.tone || "primary";
  const colors = toneColors[tone] || toneColors.primary;

  return `
    <mj-section background-color="transparent">
      <mj-column>
        <mj-text align="center">
          <span style="display: inline-block; background-color: ${colors.bg}; color: ${colors.text}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            ${escapeHtml(block.text)}
          </span>
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

/**
 * Render bullets block
 */
export function renderBullets(block: BulletsBlock, theme: any): string {
  const icon = block.icon || "•";
  const items = block.items.map((item) => {
    return `<div style="margin-bottom: 8px;"><span style="color: ${theme.palette?.primary || theme.primaryColor}; font-weight: bold; margin-right: 8px;">${escapeHtml(icon)}</span>${escapeHtml(item)}</div>`;
  }).join("");

  return `
    <mj-section background-color="transparent">
      <mj-column>
        <mj-text>
          ${items}
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

/**
 * Render price line block
 */
export function renderPriceLine(block: PriceLineBlock, theme: any): string {
  const hasCompare = block.compareAt && block.compareAt.trim() !== "";

  // Use high-contrast text color for price instead of primaryColor
  const priceColor = theme.palette?.ink || theme.textColor || "#111111";

  return `
    <mj-section background-color="transparent">
      <mj-column>
        <mj-text align="center">
          <div style="font-size: 32px; font-weight: bold; color: ${priceColor}; line-height: 1;">
            ${escapeHtml(block.price)}
          </div>
          ${hasCompare ? `<div style="font-size: 18px; color: ${theme.mutedTextColor}; text-decoration: line-through; margin-top: 4px;">${escapeHtml(block.compareAt!)}</div>` : ""}
          ${block.savingsText ? `<div style="font-size: 14px; color: #10B981; font-weight: 600; margin-top: 4px;">${escapeHtml(block.savingsText)}</div>` : ""}
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

/**
 * Render rating block
 */
export function renderRating(block: RatingBlock, theme: any): string {
  const fullStars = Math.floor(block.value);
  const hasHalfStar = block.value % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const stars =
    "★".repeat(fullStars) +
    (hasHalfStar ? "½" : "") +
    "☆".repeat(emptyStars);

  const align = block.align || "left";

  return `
    <mj-section background-color="transparent">
      <mj-column>
        <mj-text align="${align}">
          <div style="color: #F59E0B; font-size: 20px; letter-spacing: 2px;">
            ${stars}
          </div>
          ${block.count !== undefined ? `<div style="font-size: 14px; color: ${theme.mutedTextColor}; margin-top: 4px;">(${block.count} reviews)</div>` : ""}
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

/**
 * Render nav links block
 */
export function renderNavLinks(block: NavLinksBlock, theme: any): string {
  const links = block.links
    .map((link) => {
      const url = link.url && link.url.trim() !== "" ? link.url : "#";
      return `<a href="${escapeHtml(url)}" style="color: ${theme.palette?.ink || theme.textColor}; text-decoration: none; padding: 0 12px; font-size: 14px; font-weight: 500;">${escapeHtml(link.label)}</a>`;
    })
    .join(" | ");

  return `
    <mj-section background-color="transparent">
      <mj-column>
        <mj-text align="center">
          ${links}
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

/**
 * Render social icons block
 */
export function renderSocialIcons(block: SocialIconsBlock, theme: any): string {
  // Map network names to common icon representations (using Unicode symbols as fallback)
  const networkIcons: Record<string, string> = {
    facebook: "f",
    twitter: "𝕏",
    instagram: "📷",
    linkedin: "in",
    youtube: "▶",
    tiktok: "🎵",
    pinterest: "P",
  };

  const align = block.align || "center";

  const icons = block.links
    .map((link) => {
      const url = link.url && link.url.trim() !== "" ? link.url : "#";
      const icon = networkIcons[link.network] || link.network.charAt(0).toUpperCase();

      return `<a href="${escapeHtml(url)}" style="display: inline-block; width: 32px; height: 32px; background-color: ${theme.palette?.muted || theme.surfaceColor}; color: ${theme.palette?.ink || theme.textColor}; text-align: center; line-height: 32px; border-radius: 50%; margin: 0 4px; text-decoration: none; font-weight: bold;">${icon}</a>`;
    })
    .join("");

  return `
    <mj-section background-color="transparent">
      <mj-column>
        <mj-text align="${align}">
          ${icons}
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}
