import { GoogleGenAI } from "@google/genai";

import type { AssistApiRequest } from "@/lib/assist/types";
import { buildAttachmentParts } from "./ai-content";
import type { AiContentPart } from "./ai-content";
import { buildAiMessages } from "./ai-prompt";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export interface AiGenerateInput {
  model: string;
  contents: AiContentPart[];
  systemInstruction: string;
}

export interface AiGenerateContentResult {
  text?: string | null;
}

export type AiGenerateContent = (input: AiGenerateInput) => Promise<AiGenerateContentResult>;

export interface AiServiceDependencies {
  generateContent?: AiGenerateContent;
}

export class AiServiceConfigurationError extends Error {}
export class AiServiceError extends Error {}

export interface AiConfig {
  apiKey: string | undefined;
  model: string;
}

export function getAiConfig(): AiConfig {
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  const model = process.env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL;
  return { apiKey, model };
}

function createDefaultGenerateContent(apiKey: string): AiGenerateContent {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, contents, systemInstruction }) => {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction },
    });
    return { text: response.text ?? null };
  };
}

export async function generateAiResponse(
  request: AssistApiRequest,
  dependencies: AiServiceDependencies = {},
): Promise<string> {
  const { apiKey, model } = getAiConfig();
  if (!apiKey) {
    throw new AiServiceConfigurationError("AI service is not configured.");
  }

  const { systemInstruction, userMessage } = buildAiMessages(request);
  const contents: AiContentPart[] = [
    { text: userMessage },
    ...buildAttachmentParts(request.attachments),
  ];
  const generateContent = dependencies.generateContent ?? createDefaultGenerateContent(apiKey);

  let result: AiGenerateContentResult;
  try {
    result = await generateContent({
      model,
      contents,
      systemInstruction,
    });
  } catch (error) {
    console.error("Gemini request failed:", error);
    throw new AiServiceError("Gemini request failed.");
  }

  const text = result.text?.trim();
  if (!text) {
    throw new AiServiceError("Gemini returned an empty response.");
  }

  return text;
}
