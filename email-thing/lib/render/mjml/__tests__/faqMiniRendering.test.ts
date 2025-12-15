import { describe, it, expect } from "vitest";
import { renderEmailSpecToMjml } from "../renderEmailSpec";
import type { EmailSpec } from "../../../schemas/emailSpec";

describe("FAQ Mini Section Rendering", () => {
  const baseEmailSpec: EmailSpec = {
    meta: {
      subject: "Test Email",
      preheader: "Test preheader",
    },
    theme: {
      containerWidth: 600,
      backgroundColor: "#FFFFFF",
      textColor: "#333333",
      primaryColor: "#007BFF",
      surfaceColor: "#F9F9F9",
      mutedTextColor: "#666666",
      font: {
        heading: "Arial, sans-serif",
        body: "Arial, sans-serif",
      },
      button: {
        radius: 8,
        style: "solid",
        paddingY: 12,
        paddingX: 24,
      },
      palette: {
        primary: "#007BFF",
        ink: "#333333",
        bg: "#FFFFFF",
        surface: "#F9F9F9",
        muted: "#E5E5E5",
        accent: "#0056B3",
        primarySoft: "#E6F2FF",
        accentSoft: "#CCE5FF",
      },
      rhythm: {
        sectionGap: 24,
        contentPaddingX: 16,
        contentPaddingY: 24,
      },
      components: {
        button: {
          radius: 8,
          style: "solid",
          paddingY: 12,
          paddingX: 24,
        },
        card: {
          radius: 8,
          border: "none",
          shadow: "none",
        },
      },
    },
    sections: [],
    catalog: { items: [] },
  };

  it("should render faqMini section with exactly 3 Q&A pairs", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "What is your return policy?", level: 3 },
            {
              type: "paragraph",
              text: "We offer a 30-day money-back guarantee on all purchases. If you're not completely satisfied, simply contact our support team to initiate a return. We'll process your refund within 5-7 business days.",
            },
            { type: "heading", text: "How long does shipping take?", level: 3 },
            {
              type: "paragraph",
              text: "Standard shipping typically takes 3-5 business days within the continental US. Expedited shipping options are available at checkout for faster delivery. International orders may take 7-14 business days depending on customs processing.",
            },
            { type: "heading", text: "Do you offer customer support?", level: 3 },
            {
              type: "paragraph",
              text: "Yes, our customer support team is available 24/7 via email, phone, and live chat. We pride ourselves on responding to all inquiries within 2 hours during business hours. Our team is here to help with any questions or concerns you may have.",
            },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify section title is present
    expect(mjml).toContain("Frequently Asked Questions");

    // Verify all 3 questions are rendered
    expect(mjml).toContain("What is your return policy?");
    expect(mjml).toContain("How long does shipping take?");
    expect(mjml).toContain("Do you offer customer support?");

    // Verify all 3 answers are rendered
    expect(mjml).toContain("30-day money-back guarantee");
    expect(mjml).toContain("3-5 business days");
    expect(mjml).toContain("available 24/7");

    // Verify numbered circles are present (1, 2, 3)
    expect(mjml).toMatch(/>\s*1\s*</);
    expect(mjml).toMatch(/>\s*2\s*</);
    expect(mjml).toMatch(/>\s*3\s*</);

    // Verify FAQ item structure exists
    expect(mjml).toContain("FAQ Item 1");
    expect(mjml).toContain("FAQ Item 2");
    expect(mjml).toContain("FAQ Item 3");
  });

  it("should use primary color for question number circles", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "Question 1?", level: 3 },
            { type: "paragraph", text: "Answer 1 with details." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify primary color is used for circles
    expect(mjml).toContain("background-color: #007BFF");
  });

  it("should render section title", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "Question?", level: 3 },
            { type: "paragraph", text: "Answer." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify section title is rendered
    expect(mjml).toContain("Frequently Asked Questions");
    expect(mjml).toContain('font-size="24px"');
  });

  it("should add spacing between FAQ items", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "Q1?", level: 3 },
            { type: "paragraph", text: "A1." },
            { type: "heading", text: "Q2?", level: 3 },
            { type: "paragraph", text: "A2." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify spacing is added between items with padding-top
    expect(mjml).toContain('padding-top="24px"');
  });

  it("should handle section background color", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          style: {
            background: "brandTint",
          },
          blocks: [
            { type: "heading", text: "Question?", level: 3 },
            { type: "paragraph", text: "Answer." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should contain FAQ section title
    expect(mjml).toContain("Frequently Asked Questions");
  });

  it("should properly escape HTML in questions and answers", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            {
              type: "heading",
              text: "What about <script> tags & quotes?",
              level: 3,
            },
            {
              type: "paragraph",
              text: 'Answer with "quotes" & <special> characters.',
            },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify HTML is escaped
    expect(mjml).not.toContain("<script>");
    expect(mjml).toContain("&lt;script&gt;");
    expect(mjml).toContain("&amp;");
    expect(mjml).toContain("&quot;");
  });

  it("should handle odd number of blocks gracefully", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "Q1?", level: 3 },
            { type: "paragraph", text: "A1." },
            { type: "heading", text: "Q2?", level: 3 },
            // Missing answer for Q2
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should render Q1 properly
    expect(mjml).toContain("Q1?");
    expect(mjml).toContain("A1.");
    
    // Should not crash on missing answer and still include section title
    expect(mjml).toContain("Frequently Asked Questions");
  });

  it("should use correct text color from section resolution", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          style: {
            background: "brandSolid", // Dark background
          },
          blocks: [
            { type: "heading", text: "Question?", level: 3 },
            { type: "paragraph", text: "Answer." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should contain FAQ structure with proper text color handling (white text on dark background)
    expect(mjml).toContain("Frequently Asked Questions");
    expect(mjml).toContain("Question?");
    expect(mjml).toContain('color="#FFFFFF"'); // White text on dark background
  });

  it("should use single section background for all items", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "Q?", level: 3 },
            { type: "paragraph", text: "A." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify only one section background (no individual card backgrounds)
    const sectionMatches = mjml.match(/<mj-section/g);
    expect(sectionMatches).toHaveLength(1); // Only one section for FAQ
  });

  it("should include proper padding for readability", () => {
    const spec: EmailSpec = {
      ...baseEmailSpec,
      sections: [
        {
          id: "faq-01",
          type: "faqMini",
          blocks: [
            { type: "heading", text: "Q?", level: 3 },
            { type: "paragraph", text: "A." },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Verify proper padding is applied for answer indentation
    expect(mjml).toContain('padding-left="44px"'); // Answer indentation to align with question text
  });
});
