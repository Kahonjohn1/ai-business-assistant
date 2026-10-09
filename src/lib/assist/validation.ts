import {
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  base64ByteLength,
  getFileExtension,
  isSupportedExtension,
  isValidBase64,
  normalizeBase64,
  SUPPORTED_FORMATS_LABEL,
} from "./attachments";
import { TASK_TYPES, TONES } from "./types";
import type { AssistApiAttachment, AssistApiRequest, TaskType, Tone } from "./types";

export type AssistApiPayload = { ok: true; value: AssistApiRequest } | { ok: false; error: string };

export interface AttachmentLimits {
  maxFiles: number;
  maxFileSize: number;
  maxTotalSize: number;
}

export const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits = {
  maxFiles: MAX_FILES,
  maxFileSize: MAX_FILE_SIZE,
  maxTotalSize: MAX_TOTAL_SIZE,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateAttachments(
  value: unknown,
  limits: AttachmentLimits = DEFAULT_ATTACHMENT_LIMITS,
): { ok: true; attachments: AssistApiAttachment[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, attachments: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Attachments must be an array." };
  }
  if (value.length > limits.maxFiles) {
    return { ok: false, error: `You can attach up to ${limits.maxFiles} files.` };
  }

  const attachments: AssistApiAttachment[] = [];
  let totalSize = 0;

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry["name"] !== "string" ||
      entry["name"].trim().length === 0 ||
      typeof entry["size"] !== "number" ||
      typeof entry["type"] !== "string" ||
      typeof entry["data"] !== "string"
    ) {
      return {
        ok: false,
        error: "Each attachment must include a name, numeric size, type, and base64 content.",
      };
    }

    const name = entry["name"];
    const size = entry["size"];
    const type = entry["type"];
    const data = normalizeBase64(entry["data"]);

    const extension = getFileExtension(name);
    if (!isSupportedExtension(extension)) {
      return {
        ok: false,
        error: `“${name}” isn’t a supported file type. Use ${SUPPORTED_FORMATS_LABEL}.`,
      };
    }

    if (!Number.isFinite(size) || size < 0) {
      return { ok: false, error: `“${name}” has an invalid size.` };
    }

    if (!isValidBase64(data)) {
      return { ok: false, error: `“${name}” could not be read. Please attach the file again.` };
    }

    const decodedSize = base64ByteLength(data);
    if (decodedSize === 0) {
      return { ok: false, error: `“${name}” is empty.` };
    }
    if (decodedSize > limits.maxFileSize) {
      return {
        ok: false,
        error: `“${name}” is larger than ${Math.round(limits.maxFileSize / (1024 * 1024))} MB.`,
      };
    }

    totalSize += decodedSize;
    if (totalSize > limits.maxTotalSize) {
      return {
        ok: false,
        error: `Attachments are larger than the ${Math.round(limits.maxTotalSize / (1024 * 1024))} MB total limit.`,
      };
    }

    attachments.push({ name, size: decodedSize, type, data });
  }

  return { ok: true, attachments };
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

  const parsedAttachments = validateAttachments(attachments);
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
