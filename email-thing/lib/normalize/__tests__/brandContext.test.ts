import { describe, it, expect } from "vitest";
import { normalizeBrandContext } from "../brandContext";

describe("normalizeBrandContext", () => {
  it("fills in default values", () => {
    const minimal = {
      brand: {
        name: "Test Brand",
        website: "https://test.com",
      },
    };

    const result = normalizeBrandContext(minimal);

    expect(result.brand.logoUrl).toBe("");
    expect(result.brand.voiceHints).toEqual([]);
    expect(result.catalog).toEqual([]);
    expect(result.trust).toEqual({});
  });

  it("trims whitespace from strings", () => {
    const withWhitespace = {
      brand: {
        name: "  Test Brand  ",
        website: "https://test.com",
        voiceHints: ["  hint 1  ", "  hint 2  "],
      },
    };

    const result = normalizeBrandContext(withWhitespace);

    expect(result.brand.name).toBe("Test Brand");
    expect(result.brand.voiceHints[0]).toBe("hint 1");
    expect(result.brand.voiceHints[1]).toBe("hint 2");
  });

  it("handles voiceHints within valid range", () => {
    const valid = {
      brand: {
        name: "Test",
        website: "https://test.com",
        voiceHints: Array(15).fill("hint"),
      },
    };

    const result = normalizeBrandContext(valid);

    expect(result.brand.voiceHints).toHaveLength(15);
  });

  it("handles headlines within valid range", () => {
    const validHeadlines = {
      brand: {
        name: "Test",
        website: "https://test.com",
        snippets: {
          headlines: Array(40).fill("headline"),
        },
      },
    };

    const result = normalizeBrandContext(validHeadlines);

    expect(result.brand.snippets.headlines).toHaveLength(40);
  });

  it("handles CTAs within valid range", () => {
    const validCtas = {
      brand: {
        name: "Test",
        website: "https://test.com",
        snippets: {
          ctas: Array(40).fill("CTA"),
        },
      },
    };

    const result = normalizeBrandContext(validCtas);

    expect(result.brand.snippets.ctas).toHaveLength(40);
  });

  it("validates and preserves valid hex colors", () => {
    const valid = {
      brand: {
        name: "Test",
        website: "https://test.com",
        colors: {
          primary: "#FF0000",
          background: "#FFFFFF",
          text: "#000000",
        },
      },
    };

    const result = normalizeBrandContext(valid);

    expect(result.brand.colors.primary).toBe("#FF0000");
    expect(result.brand.colors.background).toBe("#FFFFFF");
    expect(result.brand.colors.text).toBe("#000000");
  });
});
