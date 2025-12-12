import { describe, it, expect } from "vitest";
import { normalizeUrl, assertPublicHostname } from "../url";
import { ScraperError } from "../errors";

describe("normalizeUrl", () => {
  it("should add https:// to URLs without protocol", () => {
    const url = normalizeUrl("example.com");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("example.com");
  });

  it("should accept http:// and https://", () => {
    const url1 = normalizeUrl("http://example.com");
    expect(url1.protocol).toBe("http:");

    const url2 = normalizeUrl("https://example.com");
    expect(url2.protocol).toBe("https:");
  });

  it("should reject file:// protocol", () => {
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow(ScraperError);
  });

  it("should reject javascript: protocol", () => {
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow(ScraperError);
  });

  it("should strip hash fragments", () => {
    const url = normalizeUrl("https://example.com/page#section");
    expect(url.hash).toBe("");
    expect(url.pathname).toBe("/page");
  });
});

describe("assertPublicHostname", () => {
  it("should block localhost", () => {
    const url = new URL("http://localhost:3000");
    expect(() => assertPublicHostname(url)).toThrow(ScraperError);
  });

  it("should block 127.0.0.1", () => {
    const url = new URL("http://127.0.0.1");
    expect(() => assertPublicHostname(url)).toThrow(ScraperError);
  });

  it("should block 0.0.0.0", () => {
    const url = new URL("http://0.0.0.0");
    expect(() => assertPublicHostname(url)).toThrow(ScraperError);
  });

  it("should block private IP ranges (10.x.x.x)", () => {
    const url = new URL("http://10.0.0.1");
    expect(() => assertPublicHostname(url)).toThrow(ScraperError);
  });

  it("should block private IP ranges (192.168.x.x)", () => {
    const url = new URL("http://192.168.1.1");
    expect(() => assertPublicHostname(url)).toThrow(ScraperError);
  });

  it("should allow public hostnames", () => {
    const url = new URL("https://example.com");
    expect(() => assertPublicHostname(url)).not.toThrow();
  });
});
