import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";
import type { EmailSpec } from "@/lib/schemas/emailSpec";

describe("POST /api/email/render", () => {
  it("should return 200 with valid spec", async () => {
    const validSpec: EmailSpec = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [
            {
              type: "logo",
              src: "https://example.com/logo.png",
            },
          ],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            {
              type: "heading",
              text: "Welcome",
            },
            {
              type: "button",
              text: "Click me",
              href: "https://example.com",
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            {
              type: "smallPrint",
              text: "Unsubscribe",
            },
          ],
        },
      ],
    };

    const request = new Request("http://localhost:3000/api/email/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spec: validSpec }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.html).toBeTruthy();
    expect(data.mjml).toBeTruthy();
    expect(data.warnings).toBeDefined();
    expect(data.mjmlErrors).toBeDefined();
    expect(data.html).toContain("Welcome");
  });

  it("should return 400 for invalid input", async () => {
    const request = new Request("http://localhost:3000/api/email/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spec: { invalid: "data" } }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe("INVALID_INPUT");
    expect(data.error.message).toBeTruthy();
  });

  it("should return 400 for missing spec", async () => {
    const request = new Request("http://localhost:3000/api/email/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("should handle rendering warnings gracefully", async () => {
    const specWithWarnings: EmailSpec = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader message",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "feature",
          type: "feature",
          layout: {
            variant: "twoColumn",
          },
          blocks: [
            { type: "heading", text: "Left" },
            { type: "heading", text: "Right" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "button", text: "CTA", href: "https://example.com" },
          ],
        },
      ],
    };

    const request = new Request("http://localhost:3000/api/email/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spec: specWithWarnings }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.html).toBeTruthy();
    expect(data.warnings).toHaveLength(1);
    expect(data.warnings[0].code).toBe("MISSING_COLUMN_SPEC");
  });
});
