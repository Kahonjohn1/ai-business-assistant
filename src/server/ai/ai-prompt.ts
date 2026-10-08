export const AI_ASSISTANT_SYSTEM_ROLE =
  "You are an AI Business Assistant that helps users with everyday business communication and productivity tasks.";

export interface AiPromptInput {
  prompt: string;
  context: string;
  taskType: string;
  tone: string;
}

export interface AiPrompt {
  systemInstruction: string;
  userMessage: string;
}

export function buildAiMessages(request: AiPromptInput): AiPrompt {
  const context = request.context.trim();
  const contextText = context ? `\n\nAdditional context:\n${context}` : "";

  const systemInstruction = [
    AI_ASSISTANT_SYSTEM_ROLE,
    "",
    `Task type: ${request.taskType}`,
    `Tone: ${request.tone}`,
    "",
    "Use the additional context when relevant.",
  ].join("\n");

  const userMessage = [`User request:\n${request.prompt.trim()}`, contextText]
    .filter((part) => part.length > 0)
    .join("\n");

  return { systemInstruction, userMessage };
}
