import { describe, it, expect } from "vitest";
import { normalizeEmailSpec } from "../emailSpec";

describe("normalizeEmailSpec", () => {
  const createMinimalSpec = () => ({
    meta: {
      subject: "Test Subject Line",
      preheader: "Test preheader text",
    },
    sections: [
      {
        id: "test-1",
        type: "header" as const,
        blocks: [],
      },
    ],
  });

  it("generates unique section IDs when missing", () => {
    const spec = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "valid-id",
          type: "header" as const,
          blocks: [],
        },
        {
          id: "another-id",
          type: "footer" as const,
          blocks: [],
        },
      ],
    };

    const result = normalizeEmailSpec(spec);

    expect(result.sections[0].id).toBeTruthy();
    expect(result.sections[1].id).toBeTruthy();
    expect(result.sections[0].id).not.toBe(result.sections[1].id);
  });

  it("replaces duplicate section IDs", () => {
    const spec = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "same-id",
          type: "header" as const,
          blocks: [],
        },
        {
          id: "same-id",
          type: "footer" as const,
          blocks: [],
        },
      ],
    };

    const result = normalizeEmailSpec(spec);

    expect(result.sections[0].id).toBe("same-id");
    expect(result.sections[1].id).not.toBe("same-id");
  });

  it("clamps containerWidth to valid range", () => {
    const tooSmall = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 600,
      },
      sections: [{ id: "1", type: "header" as const, blocks: [] }],
    };

    const tooLarge = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 600,
      },
      sections: [{ id: "1", type: "header" as const, blocks: [] }],
    };

    const resultSmall = normalizeEmailSpec(tooSmall);
    const resultLarge = normalizeEmailSpec(tooLarge);

    expect(resultSmall.theme.containerWidth).toBe(600);
    expect(resultLarge.theme.containerWidth).toBe(600);
  });

  it("clamps button radius to valid range", () => {
    const valid = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        button: {
          radius: 12,
          style: "solid" as const,
        },
      },
      sections: [{ id: "1", type: "header" as const, blocks: [] }],
    };

    const result = normalizeEmailSpec(valid);

    expect(result.theme.button.radius).toBe(12);
  });

  it("clamps section padding values", () => {
    const spec = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "header" as const,
          blocks: [],
          style: {
            paddingX: 32,
            paddingY: 24,
          },
        },
      ],
    };

    const result = normalizeEmailSpec(spec);

    expect(result.sections[0].style?.paddingX).toBe(32);
    expect(result.sections[0].style?.paddingY).toBe(24);
  });

  it("preserves valid values", () => {
    const spec = createMinimalSpec();
    spec.sections[0].id = "valid-id";

    const result = normalizeEmailSpec(spec);

    expect(result.sections[0].id).toBe("valid-id");
    expect(result.theme.containerWidth).toBe(600);
    expect(result.theme.button.radius).toBe(8);
  });
});
