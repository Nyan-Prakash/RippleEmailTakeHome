import { describe, it, expect } from "vitest";
import { BrandContextSchema } from "../brand";
import brandContextExample from "../../../spec/examples/brandContext.example.json";

describe("BrandContext Schema", () => {
  it("validates the example fixture", () => {
    const result = BrandContextSchema.safeParse(brandContextExample);
    expect(result.success).toBe(true);
  });

  it("applies default values for missing fields", () => {
    const minimal = {
      brand: {
        name: "Test Brand",
        website: "https://test.com",
      },
    };

    const result = BrandContextSchema.parse(minimal);

    expect(result.brand.name).toBe("Test Brand");
    expect(result.brand.logoUrl).toBe("");
    expect(result.brand.colors).toEqual({
      primary: "#111111",
      background: "#FFFFFF",
      text: "#111111",
    });
    expect(result.brand.fonts).toEqual({
      heading: "Arial",
      body: "Arial",
    });
    expect(result.brand.voiceHints).toEqual([]);
    expect(result.catalog).toEqual([]);
    expect(result.trust).toEqual({});
  });

  it("rejects invalid hex colors", () => {
    const invalid = {
      brand: {
        name: "Test",
        website: "https://test.com",
        colors: {
          primary: "red", // Invalid - not hex
          background: "#FFFFFF",
          text: "#000000",
        },
      },
    };

    const result = BrandContextSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("validates hex colors in #RRGGBB format", () => {
    const valid = {
      brand: {
        name: "Test",
        website: "https://test.com",
        colors: {
          primary: "#FF0000",
          background: "#00FF00",
          text: "#0000FF",
        },
      },
    };

    const result = BrandContextSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates product URLs", () => {
    const validProducts = {
      brand: {
        name: "Test",
        website: "https://test.com",
      },
      catalog: [
        {
          id: "1",
          title: "Product",
          price: "$10",
          image: "https://test.com/img.jpg",
          url: "https://test.com/product",
        },
      ],
    };

    const result = BrandContextSchema.parse(validProducts);
    expect(result.catalog).toHaveLength(1);
  });

  it("rejects products with invalid URLs", () => {
    const invalidProducts = {
      brand: {
        name: "Test",
        website: "https://test.com",
      },
      catalog: [
        {
          id: "1",
          title: "Product",
          price: "$10",
          image: "https://test.com/img.jpg",
          url: "not-a-url",
        },
      ],
    };

    const result = BrandContextSchema.safeParse(invalidProducts);
    expect(result.success).toBe(false);
  });

  it("trims whitespace from strings", () => {
    const withWhitespace = {
      brand: {
        name: "  Test Brand  ",
        website: "https://test.com",
      },
    };

    const result = BrandContextSchema.parse(withWhitespace);
    expect(result.brand.name).toBe("Test Brand");
  });
});
