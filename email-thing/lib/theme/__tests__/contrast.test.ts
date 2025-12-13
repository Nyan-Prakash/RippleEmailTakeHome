import { describe, it, expect } from "vitest";
import {
  getLuminance,
  getContrastRatio,
  getReadableTextColor,
  getButtonColors,
  enhanceThemeWithAccessibleColors,
} from "../deriveTheme";

describe("Contrast Utilities", () => {
  describe("getLuminance", () => {
    it("should calculate luminance for black", () => {
      const lum = getLuminance("#000000");
      expect(lum).toBeCloseTo(0, 2);
    });

    it("should calculate luminance for white", () => {
      const lum = getLuminance("#FFFFFF");
      expect(lum).toBeCloseTo(1, 2);
    });

    it("should calculate luminance for mid-gray", () => {
      const lum = getLuminance("#808080");
      expect(lum).toBeGreaterThan(0.2);
      expect(lum).toBeLessThan(0.3);
    });
  });

  describe("getContrastRatio", () => {
    it("should calculate 21:1 contrast for black on white", () => {
      const ratio = getContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("should calculate 1:1 contrast for same colors", () => {
      const ratio = getContrastRatio("#FF0000", "#FF0000");
      expect(ratio).toBe(1);
    });

    it("should meet WCAG AA for text (4.5:1)", () => {
      const ratio = getContrastRatio("#FFFFFF", "#767676");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should meet WCAG AA for UI (3:1)", () => {
      const ratio = getContrastRatio("#FFFFFF", "#949494");
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("getReadableTextColor", () => {
    it("should return ink for light backgrounds", () => {
      const palette = {
        primary: "#2563EB",
        ink: "#111111",
        bg: "#FFFFFF",
        surface: "#F5F5F5",
        muted: "#9CA3AF",
        accent: "#7C3AED",
        primarySoft: "#DBEAFE",
        accentSoft: "#EDE9FE",
      };

      const textColor = getReadableTextColor("#FFFFFF", palette);
      expect(textColor).toBe("#111111"); // ink
    });

    it("should return bg (white) for dark backgrounds", () => {
      const palette = {
        primary: "#2563EB",
        ink: "#111111",
        bg: "#FFFFFF",
        surface: "#F5F5F5",
        muted: "#9CA3AF",
        accent: "#7C3AED",
        primarySoft: "#DBEAFE",
        accentSoft: "#EDE9FE",
      };

      const textColor = getReadableTextColor("#000000", palette);
      expect(textColor).toBe("#FFFFFF"); // bg
    });

    it("should fallback to black/white when palette colors have poor contrast", () => {
      const palette = {
        primary: "#2563EB",
        ink: "#CCCCCC", // Too light for good contrast on white
        bg: "#CCCCCC", // Too light for good contrast on white
        surface: "#F5F5F5",
        muted: "#9CA3AF",
        accent: "#7C3AED",
        primarySoft: "#DBEAFE",
        accentSoft: "#EDE9FE",
      };

      const textColor = getReadableTextColor("#FFFFFF", palette);
      // Should auto-adjust to black since both ink and bg fail 4.5:1 contrast
      expect(textColor).toBe("#000000");

      // Verify the contrast meets WCAG AA
      const ratio = getContrastRatio("#FFFFFF", textColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should ensure 4.5:1 minimum contrast for all text", () => {
      const palette = {
        primary: "#2563EB",
        ink: "#111111",
        bg: "#FFFFFF",
        surface: "#F5F5F5",
        muted: "#9CA3AF",
        accent: "#7C3AED",
        primarySoft: "#DBEAFE",
        accentSoft: "#EDE9FE",
      };

      // Test against various backgrounds
      const backgrounds = ["#FFFFFF", "#000000", "#2563EB", "#F5F5F5", "#DBEAFE"];

      backgrounds.forEach(bgColor => {
        const textColor = getReadableTextColor(bgColor, palette);
        const ratio = getContrastRatio(bgColor, textColor);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  describe("getButtonColors", () => {
    it("should return accessible button colors meeting 3:1 contrast", () => {
      const theme = {
        primaryColor: "#2563EB",
        backgroundColor: "#FFFFFF",
        textColor: "#111111",
        surfaceColor: "#F5F5F5",
        mutedTextColor: "#9CA3AF",
        palette: {
          primary: "#2563EB",
          ink: "#111111",
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          muted: "#9CA3AF",
          accent: "#7C3AED",
          primarySoft: "#DBEAFE",
          accentSoft: "#EDE9FE",
        },
      };

      const { bg, text } = getButtonColors(theme);
      const ratio = getContrastRatio(bg, text);

      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it("should adjust button background if contrast is too low", () => {
      const theme = {
        primaryColor: "#CCCCCC", // Light gray - poor contrast with white
        backgroundColor: "#FFFFFF",
        textColor: "#111111",
        surfaceColor: "#F5F5F5",
        mutedTextColor: "#9CA3AF",
      };

      const { bg, text } = getButtonColors(theme);
      const ratio = getContrastRatio(bg, text);

      expect(ratio).toBeGreaterThanOrEqual(3.0);
      expect(bg).not.toBe("#CCCCCC"); // Should be adjusted
    });

    it("should work with legacy themes (no palette)", () => {
      const theme = {
        primaryColor: "#2563EB",
        backgroundColor: "#FFFFFF",
        textColor: "#111111",
        surfaceColor: "#F5F5F5",
        mutedTextColor: "#9CA3AF",
      };

      const { bg, text } = getButtonColors(theme);
      const ratio = getContrastRatio(bg, text);

      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("enhanceThemeWithAccessibleColors", () => {
    it("should add accessible colors to theme", () => {
      const theme = {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
        palette: {
          primary: "#2563EB",
          ink: "#111111",
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          muted: "#9CA3AF",
          accent: "#7C3AED",
          primarySoft: "#DBEAFE",
          accentSoft: "#EDE9FE",
        },
      };

      const enhanced = enhanceThemeWithAccessibleColors(theme);

      expect(enhanced.accessible).toBeDefined();
      expect(enhanced.accessible.buttonBackground).toBeDefined();
      expect(enhanced.accessible.buttonText).toBeDefined();
      expect(enhanced.accessible.onPrimary).toBeDefined();
      expect(enhanced.accessible.onAccent).toBeDefined();
      expect(enhanced.accessible.onSurface).toBeDefined();
      expect(enhanced.accessible.onPrimarySoft).toBeDefined();
      expect(enhanced.accessible.onAccentSoft).toBeDefined();
    });

    it("should ensure all accessible text colors meet 4.5:1 contrast", () => {
      const theme = {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
        palette: {
          primary: "#2563EB",
          ink: "#111111",
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          muted: "#9CA3AF",
          accent: "#7C3AED",
          primarySoft: "#DBEAFE",
          accentSoft: "#EDE9FE",
        },
      };

      const enhanced = enhanceThemeWithAccessibleColors(theme);

      // Check primary background contrast
      const primaryContrast = getContrastRatio(
        enhanced.palette.primary,
        enhanced.accessible.onPrimary
      );
      expect(primaryContrast).toBeGreaterThanOrEqual(4.5);

      // Check accent background contrast
      const accentContrast = getContrastRatio(
        enhanced.palette.accent,
        enhanced.accessible.onAccent
      );
      expect(accentContrast).toBeGreaterThanOrEqual(4.5);

      // Check surface background contrast
      const surfaceContrast = getContrastRatio(
        enhanced.palette.surface,
        enhanced.accessible.onSurface
      );
      expect(surfaceContrast).toBeGreaterThanOrEqual(4.5);
    });

    it("should ensure button colors meet 3:1 contrast", () => {
      const theme = {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
        palette: {
          primary: "#2563EB",
          ink: "#111111",
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          muted: "#9CA3AF",
          accent: "#7C3AED",
          primarySoft: "#DBEAFE",
          accentSoft: "#EDE9FE",
        },
      };

      const enhanced = enhanceThemeWithAccessibleColors(theme);

      const buttonContrast = getContrastRatio(
        enhanced.accessible.buttonBackground,
        enhanced.accessible.buttonText
      );
      expect(buttonContrast).toBeGreaterThanOrEqual(3.0);
    });

    it("should work with legacy themes (no palette)", () => {
      const theme = {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
      };

      const enhanced = enhanceThemeWithAccessibleColors(theme);

      expect(enhanced.accessible).toBeDefined();
      expect(enhanced.palette).toBeDefined(); // Should create palette from legacy colors

      // Verify button colors meet minimum contrast
      const buttonContrast = getContrastRatio(
        enhanced.accessible.buttonBackground,
        enhanced.accessible.buttonText
      );
      expect(buttonContrast).toBeGreaterThanOrEqual(3.0);
    });
  });
});
