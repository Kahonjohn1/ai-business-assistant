import type { AssistProvider } from "./assist-provider";
import { ApiAssistProvider } from "./api-assist-provider";
import { MockAssistProvider } from "./mock-assist-provider";

export const assistProvider: AssistProvider = new ApiAssistProvider();

export const mockAssistProvider: AssistProvider = new MockAssistProvider();

export type { AssistProvider } from "./assist-provider";
export type { AssistApiAttachment, AssistApiRequest, AssistRequest, TaskType, Tone } from "./types";
export { TASK_TYPES, TONES } from "./types";
