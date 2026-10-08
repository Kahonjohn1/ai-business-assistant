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

export interface AttachmentMetadata {
  name: string;
  size: number;
  type: string;
}

export interface AssistApiRequest {
  prompt: string;
  context: string;
  taskType: TaskType;
  tone: Tone;
  attachments?: AttachmentMetadata[];
}
