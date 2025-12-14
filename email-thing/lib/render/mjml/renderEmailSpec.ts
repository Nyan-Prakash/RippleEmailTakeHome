import type { EmailSpec, Theme } from "../../schemas/emailSpec";
import type { Section, Layout } from "../../schemas/emailSpec";
import type {
  Block,
  ProductCardBlock,
  BadgeBlock,
  BulletsBlock,
  PriceLineBlock,
  RatingBlock,
  NavLinksBlock,
  SocialIconsBlock,
} from "../../schemas/blocks";
import type { Product } from "../../schemas/brand";
import {
  renderBadge,
  renderBullets,
  renderPriceLine,
  renderRating,
  renderNavLinks,
  renderSocialIcons,
} from "./newBlockRenderers";
import {
  resolveSectionBackground,
  resolveSectionTextColor,
  getSectionPadding,
  shouldUseCardContainer,
  getDividerPosition,
  getCardStyles,
} from "./styleHelpers";
import { getButtonColors } from "../../theme/deriveTheme";

/**
 * Renderer warning (non-fatal issues)
 */
export interface RendererWarning {
  code: string;
  message: string;
  path?: string;
}

/**
 * Render result
 */
export interface RenderResult {
  mjml: string;
  html: string;
  warnings: RendererWarning[];
}

/**
 * MJML compilation result
 */
export interface MjmlCompileResult {
  html: string;
  errors: Array<{ message: string }>;
}

/**
 * Render EmailSpec to MJML string
 * Pure and deterministic - no network calls
 */
export function renderEmailSpecToMjml(
  spec: EmailSpec
): { mjml: string; warnings: RendererWarning[] } {
  const warnings: RendererWarning[] = [];

  // Build catalog lookup
  const catalogLookup = new Map<string, Product>();
  if (spec.catalog?.items) {
    for (const item of spec.catalog.items) {
      catalogLookup.set(item.id, item);
    }
  }

  // Clamp theme values to safe ranges and include new palette/rhythm/components/accessible
  const theme = {
    containerWidth: Math.min(Math.max(spec.theme.containerWidth, 480), 720),
    backgroundColor: spec.theme.backgroundColor,
    surfaceColor: spec.theme.surfaceColor,
    textColor: spec.theme.textColor,
    mutedTextColor: spec.theme.mutedTextColor,
    primaryColor: spec.theme.primaryColor,
    font: spec.theme.font,
    button: {
      radius: Math.min(Math.max(spec.theme.button.radius, 0), 24),
      style: spec.theme.button.style,
      paddingY: spec.theme.button.paddingY,
      paddingX: spec.theme.button.paddingX,
    },
    palette: spec.theme.palette,
    rhythm: spec.theme.rhythm,
    components: spec.theme.components,
    accessible: (spec.theme as any).accessible,  // Accessible colors from enhanceThemeWithAccessibleColors
  };

  // Build MJML document
  const mjml = `
<mjml>
  <mj-head>
    <mj-title>${escapeHtml(spec.meta.subject)}</mj-title>
    <mj-preview>${escapeHtml(spec.meta.preheader)}</mj-preview>
    <mj-attributes>
      <mj-all font-family="${escapeHtml(theme.font.body)}, Arial, sans-serif" />
      <mj-text font-size="16px" line-height="1.5" color="${theme.textColor}" />
      <mj-button background-color="${theme.accessible?.buttonBackground || theme.primaryColor}" color="${theme.accessible?.buttonText || '#FFFFFF'}" border-radius="${theme.button.radius}px" font-weight="bold" />
    </mj-attributes>
    <mj-style>
      .heading { font-family: ${escapeHtml(theme.font.heading)}, Arial, sans-serif; font-weight: bold; line-height: 1.2; }
      .small-print { font-size: 12px; line-height: 1.4; color: ${theme.mutedTextColor}; }
      .product-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; background-color: ${theme.backgroundColor}; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${theme.backgroundColor}" width="${theme.containerWidth}px">
${spec.sections.map((section) => renderSection(section, theme, catalogLookup, warnings)).join("\n")}
  </mj-body>
</mjml>
  `.trim();

  return { mjml, warnings };
}

/**
 * Compile MJML to HTML
 */
export async function compileMjmlToHtml(
  mjml: string
): Promise<MjmlCompileResult> {
  try {
    // Use the regular mjml package for server-side rendering
    const mjml2html = (await import("mjml")).default;

    const result = mjml2html(mjml, {
      validationLevel: "soft",
    });

    return {
      html: result.html,
      errors: result.errors.map((err: any) => ({ message: err.message })),
    };
  } catch (error) {
    console.error("MJML compilation exception:", error);
    return {
      html: "",
      errors: [
        {
          message:
            error instanceof Error ? error.message : "MJML compilation failed",
        },
      ],
    };
  }
}

/**
 * Render a section to MJML
 */
function renderSection(
  section: Section,
  theme: any,
  catalogLookup: Map<string, Product>,
  warnings: RendererWarning[]
): string {
  // Use token resolution for background and text colors
  const bgColor = resolveSectionBackground(section, theme);
  const textColor = resolveSectionTextColor(section, theme);
  const padding = getSectionPadding(section, theme);
  const useCard = shouldUseCardContainer(section);
  const dividerPos = getDividerPosition(section);

  const paddingX = padding.paddingX;
  const paddingY = padding.paddingY;

  // Handle layout
  const layout = section.layout || { variant: "single" };

  let columnsContent = "";

  if (layout.variant === "single") {
    // Single column
    columnsContent = `
    <mj-column>
${section.blocks.map((block) => renderBlock(block, theme, catalogLookup, warnings, section.id, section.type, bgColor, textColor)).join("\n")}
    </mj-column>
    `;
  } else if (layout.variant === "twoColumn") {
    // Two columns
    if (!layout.columns) {
      // Missing columns - use defaults and warn
      warnings.push({
        code: "MISSING_COLUMN_SPEC",
        message: `Section "${section.id}" has twoColumn layout but missing columns specification. Using 50/50 default.`,
        path: `sections.${section.id}.layout`,
      });

      // Split blocks in half
      const midpoint = Math.ceil(section.blocks.length / 2);
      const leftBlocks = section.blocks.slice(0, midpoint);
      const rightBlocks = section.blocks.slice(midpoint);

      columnsContent = `
    <mj-column width="50%">
${leftBlocks.map((block) => renderBlock(block, theme, catalogLookup, warnings, section.id, section.type, bgColor, textColor)).join("\n")}
    </mj-column>
    <mj-column width="50%">
${rightBlocks.map((block) => renderBlock(block, theme, catalogLookup, warnings, section.id, section.type, bgColor, textColor)).join("\n")}
    </mj-column>
      `;
    } else {
      // Render specified columns
      const [col1, col2] = layout.columns;
      columnsContent = `
    <mj-column width="${col1.width}">
${col1.blocks.map((block) => renderBlock(block, theme, catalogLookup, warnings, section.id, section.type, bgColor, textColor)).join("\n")}
    </mj-column>
    <mj-column width="${col2.width}">
${col2.blocks.map((block) => renderBlock(block, theme, catalogLookup, warnings, section.id, section.type, bgColor, textColor)).join("\n")}
    </mj-column>
      `;
    }
  } else if (layout.variant === "grid") {
    // Grid layout
    const numColumns = layout.columns;
    const columnWidth = `${Math.floor(100 / numColumns)}%`;
    const gap = layout.gap;

    if (gap === 0) {
      warnings.push({
        code: "MISSING_GRID_GAP",
        message: `Section "${section.id}" has grid layout but gap is 0. Using 12px default.`,
        path: `sections.${section.id}.layout`,
      });
    }

    // Distribute blocks across columns
    const blocksPerColumn = Math.ceil(section.blocks.length / numColumns);
    const columns: Block[][] = [];
    for (let i = 0; i < numColumns; i++) {
      columns.push(
        section.blocks.slice(i * blocksPerColumn, (i + 1) * blocksPerColumn)
      );
    }

    columnsContent = columns
      .map(
        (columnBlocks) => `
    <mj-column width="${columnWidth}">
${columnBlocks.map((block) => renderBlock(block, theme, catalogLookup, warnings, section.id, section.type, bgColor, textColor)).join("\n")}
    </mj-column>
    `
      )
      .join("\n");
  }

  return `
  <mj-section background-color="${bgColor}" padding-left="${paddingX}px" padding-right="${paddingX}px" padding-top="${paddingY}px" padding-bottom="${paddingY}px">
${columnsContent}
  </mj-section>
  `;
}

/**
 * Render a block to MJML
 */
function renderBlock(
  block: Block,
  theme: any,
  catalogLookup: Map<string, Product>,
  warnings: RendererWarning[],
  sectionId: string,
  sectionType?: string,
  sectionBackground?: string,
  sectionTextColor?: string
): string {
  switch (block.type) {
    case "logo":
      return renderLogoBlock(block, theme, warnings, sectionId);
    case "heading":
      return renderHeadingBlock(block, theme, sectionType, sectionTextColor);
    case "paragraph":
      return renderParagraphBlock(block, theme, sectionTextColor);
    case "image":
      return renderImageBlock(block, theme, warnings, sectionId);
    case "button":
      return renderButtonBlock(block, theme, warnings, sectionId, sectionBackground);
    case "productCard":
      return renderProductCardBlock(
        block,
        theme,
        catalogLookup,
        warnings,
        sectionId,
        sectionBackground
      );
    case "divider":
      return renderDividerBlock(theme);
    case "spacer":
      return renderSpacerBlock(block);
    case "smallPrint":
      return renderSmallPrintBlock(block, theme, sectionTextColor);
    case "badge":
      return renderBadge(block as BadgeBlock, theme);
    case "bullets":
      return renderBullets(block as BulletsBlock, theme);
    case "priceLine":
      return renderPriceLine(block as PriceLineBlock, theme);
    case "rating":
      return renderRating(block as RatingBlock, theme);
    case "navLinks":
      return renderNavLinks(block as NavLinksBlock, theme);
    case "socialIcons":
      return renderSocialIcons(block as SocialIconsBlock, theme);
    default:
      return "";
  }
}

/**
 * Render logo block
 */
function renderLogoBlock(
  block: any,
  theme: any,
  warnings: RendererWarning[],
  sectionId: string
): string {
  const align = block.align || "center";
  const href = block.href || "";

  if (href && !isValidUrl(href)) {
    warnings.push({
      code: "INVALID_LOGO_HREF",
      message: `Logo block in section "${sectionId}" has invalid href. Rendering without link.`,
      path: `sections.${sectionId}.blocks[logo]`,
    });
  }

  if (href && isValidUrl(href)) {
    return `      <mj-image src="${escapeHtml(block.src)}" alt="Logo" href="${escapeHtml(href)}" align="${align}" width="150px" />`;
  } else {
    return `      <mj-image src="${escapeHtml(block.src)}" alt="Logo" align="${align}" width="150px" />`;
  }
}

/**
 * Render heading block
 */
function renderHeadingBlock(block: any, theme: any, sectionType?: string, sectionTextColor?: string): string {
  const align = block.align || "left";
  const level = block.level || 1;  // level is a number: 1, 2, or 3

  // Map heading levels to font sizes
  // Header sections get significantly larger fonts for maximum impact
  const fontSizeMap: Record<number, string> = {
    1: "32px",
    2: "28px",
    3: "24px",
  };

  const headerFontSizeMap: Record<number, string> = {
    1: "48px",  // Much larger and eye-catching for header
    2: "36px",  // Still larger than any other section
    3: "30px",  // Bigger than regular h2
  };

  // Use larger fonts for header sections (header, navHeader, announcementBar)
  const isHeaderSection = sectionType === "header" || sectionType === "navHeader" || sectionType === "announcementBar";
  const fontSize = isHeaderSection
    ? (headerFontSizeMap[level] || "48px")
    : (fontSizeMap[level] || "32px");

  // Add extra bold font-weight for header sections to increase contrast
  const fontWeight = isHeaderSection ? ' font-weight="700"' : ' font-weight="600"';

  // Use section text color if provided, otherwise fall back to theme default
  const colorAttr = sectionTextColor ? ` color="${sectionTextColor}"` : '';

  return `      <mj-text align="${align}" font-size="${fontSize}"${fontWeight}${colorAttr} css-class="heading">${escapeHtml(block.text)}</mj-text>`;
}

/**
 * Render paragraph block
 */
function renderParagraphBlock(block: any, theme: any, sectionTextColor?: string): string {
  const align = block.align || "left";
  const colorAttr = sectionTextColor ? ` color="${sectionTextColor}"` : '';
  return `      <mj-text align="${align}"${colorAttr}>${escapeHtml(block.text)}</mj-text>`;
}

/**
 * Render image block
 */
function renderImageBlock(
  block: any,
  theme: any,
  warnings: RendererWarning[],
  sectionId: string
): string {
  const align = block.align || "center";
  const href = block.href || "";

  if (href && !isValidUrl(href)) {
    warnings.push({
      code: "INVALID_IMAGE_HREF",
      message: `Image block in section "${sectionId}" has invalid href. Rendering without link.`,
      path: `sections.${sectionId}.blocks[image]`,
    });
  }

  if (href && isValidUrl(href)) {
    return `      <mj-image src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" href="${escapeHtml(href)}" align="${align}" />`;
  } else {
    return `      <mj-image src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" align="${align}" />`;
  }
}

/**
 * Render button block
 */
function renderButtonBlock(
  block: any,
  theme: any,
  warnings: RendererWarning[],
  sectionId: string,
  sectionBackground?: string
): string {
  const align = block.align || "center";
  const variant = block.variant || "primary";

  if (!block.href || !isValidUrl(block.href)) {
    warnings.push({
      code: "INVALID_BUTTON_HREF",
      message: `Button block in section "${sectionId}" has invalid or empty href. Rendering as plain text.`,
      path: `sections.${sectionId}.blocks[button]`,
    });
    return `      <mj-text align="${align}">${escapeHtml(block.text)}</mj-text>`;
  }

  // Use pre-calculated accessible button colors for WCAG AA compliance
  // Pass section background to ensure button contrasts with its actual context
  const buttonColors = theme.accessible?.buttonBackground && theme.accessible?.buttonText && !sectionBackground
    ? { bg: theme.accessible.buttonBackground, text: theme.accessible.buttonText }
    : getButtonColors(theme, sectionBackground);  // Calculate with section context

  let bgColor = buttonColors.bg;
  let textColor = buttonColors.text;
  let border = "none";

  // Handle secondary and outline variants
  // For outline buttons, ensure text contrasts with section background, not button background
  if (variant === "secondary" || theme.button.style === "outline") {
    bgColor = "transparent";
    // Use theme's primary text color instead of button bg to ensure readability on any section background
    textColor = theme.textColor || buttonColors.bg;
    border = `2px solid ${buttonColors.bg}`;
  }

  return `      <mj-button href="${escapeHtml(block.href)}" align="${align}" background-color="${bgColor}" color="${textColor}" border="${border}">${escapeHtml(block.text)}</mj-button>`;
}

/**
 * Render product card block
 */
function renderProductCardBlock(
  block: ProductCardBlock,
  theme: any,
  catalogLookup: Map<string, Product>,
  warnings: RendererWarning[],
  sectionId: string,
  sectionBackground?: string
): string {
  const product = catalogLookup.get(block.productRef);

  if (!product) {
    warnings.push({
      code: "PRODUCT_NOT_FOUND",
      message: `Product reference "${block.productRef}" not found in catalog. Rendering fallback.`,
      path: `sections.${sectionId}.blocks[productCard]`,
    });
    return `      <mj-text align="center" color="${theme.mutedTextColor}">Product unavailable</mj-text>`;
  }

  // Build product card with MJML components stacked vertically
  // mj-wrapper can't be used inside mj-column, so we stack components with consistent styling
  const productUrl = product.url || "#";
  
  const parts: string[] = [];
  
  // Add spacer for top padding
  parts.push(`      <mj-spacer height="16px" />`);
  
  // Add image if available
  if (product.image) {
    parts.push(`      <mj-image src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" href="${escapeHtml(productUrl)}" padding="0 16px" border-radius="8px" />`);
  }
  
  // Add product title
  parts.push(`      <mj-text align="center" font-weight="bold" font-size="18px" padding="12px 16px 0 16px">${escapeHtml(product.title)}</mj-text>`);
  
  // Add price if available
  if (product.price) {
    // Use high-contrast text color instead of primaryColor to ensure readability
    const priceColor = theme.textColor || theme.palette?.ink || "#111111";
    parts.push(`      <mj-text align="center" font-weight="bold" font-size="18px" color="${priceColor}" padding="8px 16px 0 16px">${escapeHtml(product.price)}</mj-text>`);
  }
  
  // Add button with section-aware colors
  const buttonColors = getButtonColors(theme, sectionBackground);
  parts.push(`      <mj-button href="${escapeHtml(productUrl)}" align="center" padding="12px 16px" background-color="${buttonColors.bg}" color="${buttonColors.text}">View Product</mj-button>`);

  // Add spacer for bottom padding
  parts.push(`      <mj-spacer height="16px" />`);

  return parts.join("\n");
}

/**
 * Render divider block
 */
function renderDividerBlock(theme: any): string {
  return `      <mj-divider border-color="${theme.mutedTextColor}" border-width="1px" />`;
}

/**
 * Render spacer block
 */
function renderSpacerBlock(block: any): string {
  return `      <mj-spacer height="${block.size}px" />`;
}

/**
 * Render small print block
 */
function renderSmallPrintBlock(block: any, theme: any, sectionTextColor?: string): string {
  const align = block.align || "center";
  const colorAttr = sectionTextColor ? ` color="${sectionTextColor}"` : '';
  return `      <mj-text align="${align}"${colorAttr} css-class="small-print">${escapeHtml(block.text)}</mj-text>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  try {
    new URL(url);
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
}
