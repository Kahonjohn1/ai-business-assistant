import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleAssistApiRequest, isAssistApiRequest } from "./assist";
import type { AiServiceDependencies } from "./ai/ai-service";

const VALID_BODY = {
  prompt: "Write a follow-up email",
  context: "our invoice.",
  taskType: "Write an Email",
  tone: "Professional",
};

function base64(content: string): string {
  return Buffer.from(content, "utf8").toString("base64");
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeDependencies(responseText = "Generated draft"): AiServiceDependencies {
  return {
    generateContent: vi.fn(async () => ({ text: responseText })),
  };
}

describe("isAssistApiRequest", () => {
  it("matches POST requests to /api/assist", () => {
    const request = new Request("http://localhost/api/assist", { method: "POST" });
    expect(isAssistApiRequest(request)).toBe(true);
  });

  it("rejects other methods and paths", () => {
    expect(isAssistApiRequest(new Request("http://localhost/api/assist"))).toBe(false);
    expect(isAssistApiRequest(new Request("http://localhost/api/other", { method: "POST" }))).toBe(
      false,
    );
  });
});

describe("handleAssistApiRequest", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the AI response for a request with context and no attachments", async () => {
    const response = await handleAssistApiRequest(post(VALID_BODY), fakeDependencies());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { response: string };
    expect(body).toEqual({ response: "Generated draft" });
  });

  it("accepts a request with no context and no attachments", async () => {
    const response = await handleAssistApiRequest(
      post({ ...VALID_BODY, context: "" }),
      fakeDependencies(),
    );
    expect(response.status).toBe(200);
  });

  it("accepts a request with attachments but no context", async () => {
    const response = await handleAssistApiRequest(
      post({
        ...VALID_BODY,
        context: "",
        attachments: [{ name: "notes.txt", size: 2, type: "text/plain", data: base64("hi") }],
      }),
      fakeDependencies(),
    );
    expect(response.status).toBe(200);
  });

  it("accepts multiple valid attachments", async () => {
    const response = await handleAssistApiRequest(
      post({
        prompt: "Review these",
        context: "",
        taskType: "Summarize Information",
        tone: "Concise",
        attachments: [
          { name: "notes.txt", size: 2, type: "text/plain", data: base64("hi") },
          { name: "orders.txt", size: 2, type: "text/plain", data: base64("yo") },
        ],
      }),
      fakeDependencies(),
    );
    expect(response.status).toBe(200);
  });

  it("returns 400 when the prompt is missing", async () => {
    const response = await handleAssistApiRequest(
      post({ context: "", taskType: "Write an Email", tone: "Professional" }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Prompt");
  });

  it("returns 400 when the prompt is blank", async () => {
    const response = await handleAssistApiRequest(
      post({ prompt: "   ", taskType: "Write an Email", tone: "Professional" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid task type", async () => {
    const response = await handleAssistApiRequest(
      post({ prompt: "Hello", taskType: "Nonsense", tone: "Professional" }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("TaskType is invalid.");
  });

  it("returns 400 for an invalid tone", async () => {
    const response = await handleAssistApiRequest(
      post({ prompt: "Hello", taskType: "Write an Email", tone: "Nonsense" }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Tone is invalid.");
  });

  it("returns 400 for a non-object body", async () => {
    const response = await handleAssistApiRequest(post("just a string"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Request body must be a JSON object.");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await handleAssistApiRequest(
      new Request("http://localhost/api/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Request body must be valid JSON.");
  });

  it("returns 400 for an unsupported file type", async () => {
    const response = await handleAssistApiRequest(
      post({
        prompt: "Review this",
        context: "",
        taskType: "Summarize Information",
        tone: "Concise",
        attachments: [
          { name: "script.exe", size: 4, type: "application/octet-stream", data: base64("MZ..") },
        ],
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("isn’t a supported file type");
  });

  it("returns 400 for malformed base64 content", async () => {
    const response = await handleAssistApiRequest(
      post({
        prompt: "Review this",
        context: "",
        taskType: "Summarize Information",
        tone: "Concise",
        attachments: [{ name: "notes.txt", size: 4, type: "text/plain", data: "not base64!!" }],
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("could not be read");
  });

  it("returns 400 for invalid attachment metadata", async () => {
    const response = await handleAssistApiRequest(
      post({
        prompt: "Review this",
        context: "",
        taskType: "Summarize Information",
        tone: "Concise",
        attachments: [{ name: "notes.txt", size: "large" }],
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("attachment");
  });

  it("returns 400 with a clear message for a malformed document", async () => {
    const response = await handleAssistApiRequest(
      post({
        prompt: "Summarize this file",
        context: "",
        taskType: "Summarize Information",
        tone: "Concise",
        attachments: [
          {
            name: "broken.docx",
            size: 6,
            type: "application/octet-stream",
            data: base64("PK nope"),
          },
        ],
      }),
      fakeDependencies(),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("broken.docx");
  });

  it("returns 500 with a safe message when the AI provider fails", async () => {
    const dependencies: AiServiceDependencies = {
      generateContent: async () => {
        throw new Error("upstream provider boom");
      },
    };
    const response = await handleAssistApiRequest(post(VALID_BODY), dependencies);
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Unable to generate a response right now." });
  });

  it("returns 500 with a safe message when GEMINI_API_KEY is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await handleAssistApiRequest(post(VALID_BODY));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Unable to generate a response right now." });
  });
});
