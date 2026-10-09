export const TASK_TYPES = [
  "Write an Email",
  "Write a Business Message",
  "Rewrite Text",
  "Summarize Information",
  "Create a Business Response",
  "Organize Information",
  "Other",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TONES = ["Professional", "Friendly", "Formal", "Concise", "Polite"] as const;

export type Tone = (typeof TONES)[number];

export interface AssistRequest {
  prompt: string;
  context: string;
  taskType: TaskType;
  tone: Tone;
  files: File[];
}

/**
 * An attachment travelling to the server. `data` holds the base64-encoded file
 * contents so the AI can analyze the actual document or image, not just its
 * metadata. `size` is the decoded byte length.
 */
export interface AssistApiAttachment {
  name: string;
  size: number;
  type: string;
  data: string;
}

export interface AssistApiRequest {
  prompt: string;
  context: string;
  taskType: TaskType;
  tone: Tone;
  attachments?: AssistApiAttachment[];
}
