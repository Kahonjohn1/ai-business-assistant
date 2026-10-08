import { TASK_TYPES, TONES } from "./types";
import type { AssistApiRequest, AttachmentMetadata, TaskType, Tone } from "./types";

export type AssistApiPayload = { ok: true; value: AssistApiRequest } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAttachments(
  value: unknown,
): { ok: true; attachments: AttachmentMetadata[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, attachments: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Attachments must be an array." };
  }
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry["name"] !== "string" ||
      typeof entry["size"] !== "number" ||
      typeof entry["type"] !== "string"
    ) {
      return {
        ok: false,
        error: "Each attachment must include a string name, numeric size, and string type.",
      };
    }
  }
  return { ok: true, attachments: value as AttachmentMetadata[] };
}

export function parseAssistApiRequest(value: unknown): AssistApiPayload {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const { prompt, context = "", taskType, tone, attachments } = value;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, error: "Prompt is required and must not be empty." };
  }
  if (typeof context !== "string") {
    return { ok: false, error: "Context must be a string." };
  }
  if (typeof taskType !== "string" || !TASK_TYPES.includes(taskType as TaskType)) {
    return { ok: false, error: "TaskType is invalid." };
  }
  if (typeof tone !== "string" || !TONES.includes(tone as Tone)) {
    return { ok: false, error: "Tone is invalid." };
  }

  const parsedAttachments = parseAttachments(attachments);
  if (!parsedAttachments.ok) {
    return { ok: false, error: parsedAttachments.error };
  }

  return {
    ok: true,
    value: {
      prompt,
      context,
      taskType: taskType as TaskType,
      tone: tone as Tone,
      attachments: parsedAttachments.attachments,
    },
  };
}
