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
});
