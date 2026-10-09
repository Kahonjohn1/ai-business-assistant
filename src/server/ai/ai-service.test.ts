import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssistApiRequest } from "@/lib/assist/types";
import { AssistAttachmentError } from "./ai-content";
import { buildAiMessages } from "./ai-prompt";
import { AiServiceConfigurationError, AiServiceError, generateAiResponse } from "./ai-service";
import type { AiGenerateContent, AiGenerateInput } from "./ai-service";

const REQUEST: AssistApiRequest = {
  prompt: "Write a follow-up email to our client",
  context: "The order is ready for delivery.",
  taskType: "Write an Email",
  tone: "Professional",
};

function textOf(input: AiGenerateInput | undefined): string {
  return (input?.contents ?? [])
    .filter((part): part is { text: string } => "text" in part)
    .map((part) => part.text)
    .join("\n");
}

describe("buildAiMessages", () => {
  it("separates system instructions from the user request", () => {
    const { systemInstruction, userMessage } = buildAiMessages(REQUEST);

    expect(systemInstruction).toContain("AI Business Assistant that helps users");
    expect(systemInstruction).toContain("Task type: Write an Email");
    expect(systemInstruction).toContain("Tone: Professional");
    expect(systemInstruction).toContain("Use the additional context when relevant.");
    expect(systemInstruction).toContain("untrusted user-provided data");
    expect(systemInstruction).not.toContain(REQUEST.prompt);

    expect(userMessage).toContain("User request:");
    expect(userMessage).toContain("Write a follow-up email to our client");
    expect(userMessage).toContain("Additional context:");
    expect(userMessage).toContain("The order is ready for delivery.");
  });

  it("omits the context section when there is no context", () => {
    const { userMessage } = buildAiMessages({ ...REQUEST, context: "   " });
    expect(userMessage).toContain("User request:");
    expect(userMessage).not.toContain("Additional context:");
  });
});

describe("generateAiResponse", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the request to the AI service and returns the generated text", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "Draft email" }));

    const result = await generateAiResponse(REQUEST, { generateContent });

    expect(result).toBe("Draft email");
    expect(generateContent).toHaveBeenCalledTimes(1);
    const input = generateContent.mock.calls[0]?.[0];
    expect(input?.model).toBe("gemini-flash-latest");
    expect(input?.systemInstruction).toContain("AI Business Assistant");
    expect(textOf(input)).toContain("Write a follow-up email to our client");
    expect(textOf(input)).toContain("The order is ready for delivery.");
  });

  it("sends only the user message when there are no attachments", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "ok" }));

    await generateAiResponse({ ...REQUEST, context: "" }, { generateContent });

    const input = generateContent.mock.calls[0]?.[0];
    expect(input?.contents).toHaveLength(1);
    expect(textOf(input)).not.toContain("Additional context:");
  });

  it("adds image attachment parts to the request contents", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "ok" }));
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    await generateAiResponse(
      {
        ...REQUEST,
        attachments: [
          {
            name: "chart.png",
            size: pngBytes.length,
            type: "image/png",
            data: pngBytes.toString("base64"),
          },
        ],
      },
      { generateContent },
    );

    const input = generateContent.mock.calls[0]?.[0];
    expect(input?.contents).toEqual(
      expect.arrayContaining([
        { inlineData: { mimeType: "image/png", data: pngBytes.toString("base64") } },
      ]),
    );
  });

  it("rejects a malformed document before calling the provider", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "ok" }));

    let error: unknown;
    try {
      await generateAiResponse(
        {
          ...REQUEST,
          attachments: [
            {
              name: "broken.docx",
              size: 4,
              type: "application/octet-stream",
              data: Buffer.from("PK nope").toString("base64"),
            },
          ],
        },
        { generateContent },
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AssistAttachmentError);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("uses GEMINI_MODEL when configured", async () => {
    vi.stubEnv("GEMINI_MODEL", "my-company-model");
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "ok" }));

    await generateAiResponse(REQUEST, { generateContent });

    expect(generateContent.mock.calls[0]?.[0]?.model).toBe("my-company-model");
  });

  it("fails safely when GEMINI_API_KEY is missing and never calls the provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "ok" }));

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceConfigurationError);
    expect((error as Error).message).toBe("AI service is not configured.");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("turns a provider failure into a safe error without leaking details", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw new Error("401 invalid credentials: the real key is sk-...");
    });

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceError);
    expect((error as Error).message).toBe("Gemini request failed.");
    expect((error as Error).message).not.toContain("401");
    expect((error as Error).message).not.toContain("sk-");
  });

  it("rejects an empty Gemini response", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "   " }));

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceError);
    expect((error as Error).message).toBe("Gemini returned an empty response.");
  });

  it("rejects a response with no text", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({}));

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceError);
    expect((error as Error).message).toBe("Gemini returned an empty response.");
  });

  it("primary success does not call fallback", async () => {
    const generateContent = vi.fn<AiGenerateContent>(async () => ({ text: "Primary response" }));
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => ({
      text: "Fallback response",
    }));

    const result = await generateAiResponse(REQUEST, { generateContent, generateContentFallback });

    expect(result).toBe("Primary response");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContentFallback).not.toHaveBeenCalled();
  });

  it("a primary 503 invokes fallback and returns successful response", async () => {
    const error503 = new Error("Service unavailable");
    (error503 as Error & { status?: number }).status = 503;
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw error503;
    });
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => ({ text: "Fallback OK" }));

    const result = await generateAiResponse(REQUEST, { generateContent, generateContentFallback });

    expect(result).toBe("Fallback OK");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContentFallback).toHaveBeenCalledTimes(1);
    const fallbackInput = generateContentFallback.mock.calls[0]?.[0];
    expect(fallbackInput?.model).toBe("gemini-2.5-flash-lite");
  });

  it("a primary 429 invokes fallback", async () => {
    const error429 = new Error("Rate limited");
    (error429 as Error & { status?: number }).status = 429;
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw error429;
    });
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => ({
      text: "Fallback OK 429",
    }));

    const result = await generateAiResponse(REQUEST, { generateContent, generateContentFallback });

    expect(result).toBe("Fallback OK 429");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContentFallback).toHaveBeenCalledTimes(1);
  });

  it("permanent errors do not invoke fallback (401)", async () => {
    const error401 = new Error("Unauthorized");
    (error401 as Error & { status?: number }).status = 401;
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw error401;
    });
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => ({ text: "Fallback" }));

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent, generateContentFallback });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceError);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContentFallback).not.toHaveBeenCalled();
  });

  it("permanent errors do not invoke fallback (400)", async () => {
    const error400 = new Error("Bad request");
    (error400 as Error & { status?: number }).status = 400;
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw error400;
    });
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => ({ text: "Fallback" }));

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent, generateContentFallback });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceError);
    expect(generateContentFallback).not.toHaveBeenCalled();
  });

  it("fallback failure returns a safe error", async () => {
    const error503 = new Error("Service unavailable");
    (error503 as Error & { status?: number }).status = 503;
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw error503;
    });
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => {
      throw new Error("Fallback also failed");
    });

    let error: unknown;
    try {
      await generateAiResponse(REQUEST, { generateContent, generateContentFallback });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AiServiceError);
    expect((error as Error).message).toBe("Gemini request failed.");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContentFallback).toHaveBeenCalledTimes(1);
  });

  it("attachments and additional context are preserved during fallback", async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
    const error503 = new Error("Service unavailable");
    (error503 as Error & { status?: number }).status = 503;
    const generateContent = vi.fn<AiGenerateContent>(async () => {
      throw error503;
    });
    const generateContentFallback = vi.fn<AiGenerateContent>(async () => ({
      text: "Fallback with context",
    }));

    const result = await generateAiResponse(
      {
        ...REQUEST,
        context: "Important context here",
        attachments: [
          {
            name: "chart.png",
            size: pngBytes.length,
            type: "image/png",
            data: pngBytes.toString("base64"),
          },
        ],
      },
      { generateContent, generateContentFallback },
    );

    expect(result).toBe("Fallback with context");
    expect(generateContentFallback).toHaveBeenCalledTimes(1);
    const fallbackInput = generateContentFallback.mock.calls[0]?.[0];
    expect(fallbackInput?.contents.length).toBeGreaterThan(1);
    const joinedText = textOf(fallbackInput).toLowerCase();
    expect(joinedText).toContain("important context here");
  });
});
