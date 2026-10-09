import { parseAssistApiRequest } from "@/lib/assist/validation";
import { AssistAttachmentError } from "./ai/ai-content";
import { generateAiResponse } from "./ai/ai-service";
import type { AiServiceDependencies } from "./ai/ai-service";

export const ASSIST_API_PATH = "/api/assist";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function isAssistApiRequest(request: Request): boolean {
  return request.method === "POST" && new URL(request.url).pathname === ASSIST_API_PATH;
}

export async function handleAssistApiRequest(
  request: Request,
  dependencies: AiServiceDependencies = {},
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON." });
  }

  const parsed = parseAssistApiRequest(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error });
  }

  try {
    const result = await generateAiResponse(parsed.value, dependencies);
    return jsonResponse(200, { response: result });
  } catch (error) {
    if (error instanceof AssistAttachmentError) {
      return jsonResponse(400, { error: error.message });
    }
    console.error("Assist endpoint failed:", error);
    return jsonResponse(500, { error: "Unable to generate a response right now." });
  }
}
