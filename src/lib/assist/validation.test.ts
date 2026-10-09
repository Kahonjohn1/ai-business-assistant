import { describe, expect, it } from "vitest";

import { parseAssistApiRequest, validateAttachments } from "./validation";

function base64(content: string): string {
  return Buffer.from(content, "utf8").toString("base64");
}

const TINY_LIMITS = { maxFiles: 2, maxFileSize: 8, maxTotalSize: 12 };

describe("validateAttachments", () => {
  it("treats missing attachments as an empty list", () => {
    expect(validateAttachments(undefined)).toEqual({ ok: true, attachments: [] });
  });

  it("accepts a well-formed attachment and recomputes its size", () => {
    const result = validateAttachments([
      { name: "notes.txt", size: 999, type: "text/plain", data: base64("hi") },
    ]);

    expect(result).toEqual({
      ok: true,
      attachments: [{ name: "notes.txt", size: 2, type: "text/plain", data: base64("hi") }],
    });
  });

  it("rejects a non-array payload", () => {
    const result = validateAttachments("nope");
    expect(result.ok).toBe(false);
  });

  it("rejects attachments missing content", () => {
    const result = validateAttachments([{ name: "notes.txt", size: 2, type: "text/plain" }]);
    expect(result).toEqual({
      ok: false,
      error: "Each attachment must include a name, numeric size, type, and base64 content.",
    });
  });

  it("rejects unsupported file types", () => {
    const result = validateAttachments([
      { name: "virus.exe", size: 2, type: "application/octet-stream", data: base64("hi") },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("isn’t a supported file type");
  });

  it("rejects malformed base64 content", () => {
    const result = validateAttachments([
      { name: "notes.txt", size: 2, type: "text/plain", data: "not base64!!" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("could not be read");
  });

  it("rejects empty attachments", () => {
    const result = validateAttachments([
      { name: "notes.txt", size: 0, type: "text/plain", data: "" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("enforces the per-file size limit", () => {
    const result = validateAttachments(
      [{ name: "notes.txt", size: 20, type: "text/plain", data: base64("way too long") }],
      TINY_LIMITS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("larger than");
  });

  it("enforces the total size limit across files", () => {
    const result = validateAttachments(
      [
        { name: "a.txt", size: 8, type: "text/plain", data: base64("12345678") },
        { name: "b.txt", size: 8, type: "text/plain", data: base64("12345678") },
      ],
      TINY_LIMITS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("total limit");
  });

  it("enforces the file count limit", () => {
    const result = validateAttachments(
      [
        { name: "a.txt", size: 1, type: "text/plain", data: base64("a") },
        { name: "b.txt", size: 1, type: "text/plain", data: base64("b") },
        { name: "c.txt", size: 1, type: "text/plain", data: base64("c") },
      ],
      TINY_LIMITS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("up to 2 files");
  });
});

describe("parseAssistApiRequest", () => {
  const BASE = { prompt: "Summarize this", taskType: "Summarize Information", tone: "Concise" };

  it("accepts a request with no context and no attachments", () => {
    const result = parseAssistApiRequest(BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.context).toBe("");
      expect(result.value.attachments).toEqual([]);
    }
  });

  it("accepts a request with context and attachments", () => {
    const result = parseAssistApiRequest({
      ...BASE,
      context: "Q3 numbers",
      attachments: [{ name: "report.txt", size: 2, type: "text/plain", data: base64("hi") }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.context).toBe("Q3 numbers");
      expect(result.value.attachments).toHaveLength(1);
    }
  });
});
