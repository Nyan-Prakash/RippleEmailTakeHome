import { describe, it, expect } from "vitest";
import { deriveThemeFromBrandContext } from "../deriveTheme";
import type { BrandContext } from "../../schemas/brand";

describe("Light Background Enforcement", () => {
  it("should force dark background to light (#FFFFFF)", () => {
    const darkBrandContext: BrandContext = {
      brand: {
        name: "Dark Brand",
        website: "https://example.com",
        logoUrl: "",
        colors: {
          primary: "#FF0000",
          background: "#000000", // Dark background
          text: "#FFFFFF",
        },
        fonts: {
          heading: "Arial",
          body: "Arial",
        },
        voiceHints: [],
        snippets: {},
      },
      catalog: [],
      trust: {},
    };

    const result = deriveThemeFromBrandContext(darkBrandContext);

    // Background should be forced to white
    expect(result.palette.bg).toBe("#FFFFFF");
  });

  it("should keep light background as is", () => {
    const lightBrandContext: BrandContext = {
      brand: {
        name: "Light Brand",
        website: "https://example.com",
        logoUrl: "",
        colors: {
          primary: "#0000FF",
          background: "#F5F5F5", // Light background
          text: "#111111",
        },
        fonts: {
          heading: "Arial",
          body: "Arial",
        },
        voiceHints: [],
        snippets: {},
      },
      catalog: [],
      trust: {},
    };

    const result = deriveThemeFromBrandContext(lightBrandContext);

    // Background should remain as the light color
    expect(result.palette.bg).toBe("#F5F5F5");
  });

  it("should force medium gray background to light", () => {
    const mediumBrandContext: BrandContext = {
      brand: {
        name: "Medium Brand",
        website: "https://example.com",
        logoUrl: "",
        colors: {
          primary: "#FF0000",
          background: "#808080", // Medium gray (luminance = 0.5)
          text: "#111111",
        },
        fonts: {
          heading: "Arial",
          body: "Arial",
        },
        voiceHints: [],
        snippets: {},
      },
      catalog: [],
      trust: {},
    };

    const result = deriveThemeFromBrandContext(mediumBrandContext);

    // Background should be forced to white (luminance <= 0.5 triggers the safeguard)
    expect(result.palette.bg).toBe("#FFFFFF");
  });
});
