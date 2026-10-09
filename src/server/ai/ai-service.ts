import { GoogleGenAI } from "@google/genai";

import type { AssistApiRequest } from "@/lib/assist/types";
import { buildAttachmentParts } from "./ai-content";
import type { AiContentPart } from "./ai-content";
import { buildAiMessages } from "./ai-prompt";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
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
  generateContentFallback?: AiGenerateContent;
}

export class AiServiceConfigurationError extends Error {}
export class AiServiceError extends Error {}

export interface AiConfig {
  apiKey: string | undefined;
  model: string;
  fallbackModel: string;
}

const PERMANENT_ERROR_CODES = new Set([400, 401, 403, 404, 413, 422]);

function getErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const maybe = error as { status?: number; code?: number; httpStatus?: number };
  const code = maybe.status ?? maybe.code ?? maybe.httpStatus;
  if (typeof code === "number" && Number.isFinite(code)) return code;
  if (typeof code === "string") {
    const parsed = parseInt(code, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function isTemporaryFailure(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === undefined) {
    // Don't fallback on unknown errors to avoid masking issues; follow requirement "temporary 429, 500, 502, 503, 504"
    return false;
  }
  if (PERMANENT_ERROR_CODES.has(code)) return false;
  return code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
}

export function getAiConfig(): AiConfig {
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  const model = process.env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL;
  const fallbackModel =
    process.env["GEMINI_FALLBACK_MODEL"]?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL;
  return { apiKey, model, fallbackModel };
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
  const { apiKey, model, fallbackModel } = getAiConfig();
  if (!apiKey) {
    throw new AiServiceConfigurationError("AI service is not configured.");
  }

  const { systemInstruction, userMessage } = buildAiMessages(request);
  const contents: AiContentPart[] = [
    { text: userMessage },
    ...buildAttachmentParts(request.attachments),
  ];
  const generateContent = dependencies.generateContent ?? createDefaultGenerateContent(apiKey);
  const generateContentFallback =
    dependencies.generateContentFallback ?? createDefaultGenerateContent(apiKey);

  let result: AiGenerateContentResult;
  try {
    result = await generateContent({
      model,
      contents,
      systemInstruction,
    });
  } catch (error) {
    if (isTemporaryFailure(error)) {
      try {
        console.warn(
          "Gemini primary request failed with temporary error; attempting fallback model",
        );
        result = await generateContentFallback({
          model: fallbackModel,
          contents,
          systemInstruction,
        });
      } catch (fallbackError) {
        console.error("Gemini fallback request failed:", fallbackError);
        throw new AiServiceError("Gemini request failed.");
      }
    } else {
      console.error("Gemini request failed:", error);
      throw new AiServiceError("Gemini request failed.");
    }
  }

  const text = result.text?.trim();
  if (!text) {
    throw new AiServiceError("Gemini returned an empty response.");
  }

  return text;
}
