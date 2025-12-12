import { describe, it, expect } from "vitest";
import { EmailSpecSchema } from "../emailSpec";
import emailSpecSaleExample from "../../../spec/examples/emailSpec.sale.example.json";
import emailSpecLaunchExample from "../../../spec/examples/emailSpec.launch.example.json";

describe("EmailSpec Schema", () => {
  it("validates the sale example fixture", () => {
    const result = EmailSpecSchema.safeParse(emailSpecSaleExample);
    expect(result.success).toBe(true);
  });

  it("validates the launch example fixture", () => {
    const result = EmailSpecSchema.safeParse(emailSpecLaunchExample);
    expect(result.success).toBe(true);
  });

  it("applies theme defaults", () => {
    const minimal = {
      meta: {
        subject: "Test Subject Line",
        preheader: "Test preheader text here",
      },
      sections: [
        {
          id: "test-1",
          type: "header",
          blocks: [],
        },
      ],
    };

    const result = EmailSpecSchema.parse(minimal);

    expect(result.theme.containerWidth).toBe(600);
    expect(result.theme.backgroundColor).toBe("#FFFFFF");
    expect(result.theme.primaryColor).toBe("#111111");
    expect(result.theme.button.radius).toBe(8);
    expect(result.theme.button.style).toBe("solid");
  });

  it("clamps containerWidth to valid range", () => {
    const tooSmall = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 400, // Too small (min 480)
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(tooSmall);
    expect(result.success).toBe(false);
  });

  it("validates subject length constraints", () => {
    const tooShort = {
      meta: {
        subject: "Hi",
        preheader: "Valid preheader text",
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(tooShort);
    expect(result.success).toBe(false);
  });

  it("validates button radius range", () => {
    const validRadius = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        button: {
          radius: 12,
          style: "solid",
        },
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(validRadius);
    expect(result.success).toBe(true);
  });

  it("rejects button radius outside range", () => {
    const invalidRadius = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        button: {
          radius: 30, // Max 24
          style: "solid",
        },
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(invalidRadius);
    expect(result.success).toBe(false);
  });

  it("validates section padding constraints", () => {
    const validPadding = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "header",
          blocks: [],
          style: {
            paddingX: 32,
            paddingY: 24,
          },
        },
      ],
    };

    const result = EmailSpecSchema.safeParse(validPadding);
    expect(result.success).toBe(true);
  });

  it("requires at least one section", () => {
    const noSections = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [],
    };

    const result = EmailSpecSchema.safeParse(noSections);
    expect(result.success).toBe(false);
  });

  it("validates hex colors in theme", () => {
    const validColors = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        backgroundColor: "#FFFFFF",
        textColor: "#000000",
        primaryColor: "#FF6B35",
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(validColors);
    expect(result.success).toBe(true);
  });
});
