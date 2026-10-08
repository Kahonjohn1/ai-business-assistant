import type { AssistProvider } from "./assist-provider";
import type { AssistRequest, Tone } from "./types";

const MOCK_DELAY_MS = 1050;

export type MockInput = Pick<AssistRequest, "prompt" | "context" | "taskType" | "tone">;

function createEmailResponse(tone: Tone, context: string) {
  const greeting = tone === "Formal" ? "Dear [Client Name]," : "Hello [Client Name],";
  const close = tone === "Friendly" ? "Warm regards," : "Best regards,";
  const orderInfo = context
    .match(/(?:ready|delivery|arrival|by)\s+(?:by\s+)?([\w ,/-]+)/i)?.[1]
    ?.trim();
  const timing = orderInfo
    ? `We currently expect it to be ready by ${orderInfo}.`
    : "Our team is working to have it ready as soon as possible.";

  return `${greeting}\n\nThank you for your patience, and I’m sorry for the delay with your order. ${timing}\n\nWe understand the inconvenience this may cause and appreciate your understanding. We’ll keep you updated if anything changes.\n\n${close}\n[Your Name]`;
}

export function buildMockAssistResponse(input: MockInput): string {
  if (
    /delay|late|order|shipment|delivery/i.test(input.prompt) &&
    input.taskType === "Write an Email"
  ) {
    return createEmailResponse(input.tone, input.context);
  }

  const title = input.taskType === "Other" ? "Here’s a polished draft" : `${input.taskType}:`;
  const userContext = input.context.trim();
  const contextLine = userContext ? `\n\nAdditional details considered: ${userContext}` : "";

  if (input.taskType === "Summarize Information") {
    return `${title}\n\n• Main point: ${input.prompt.trim()}\n• Suggested next step: confirm the key details with the relevant team.\n• Follow-up: share any decisions and owners with everyone involved.${contextLine}`;
  }

  if (input.taskType === "Organize Information") {
    return `${title}\n\nObjective\n${input.prompt.trim()}\n\nKey details\n${userContext || "Add the relevant dates, people, and requirements here."}\n\nNext steps\n1. Confirm the details and owner.\n2. Agree on a timeline.\n3. Share an update with the people involved.`;
  }

  const opening = input.tone === "Friendly" ? "Hi there," : "Hello,";
  const closing =
    input.tone === "Formal"
      ? "Sincerely,"
      : input.tone === "Friendly"
        ? "Thanks,"
        : "Kind regards,";
  const request = input.prompt.trim().replace(/[.!?]+$/, "");
  const detail = userContext ? `\n\nFor reference, ${userContext}` : "";
  const signature = input.taskType === "Write an Email" ? `\n\n${closing}\n[Your Name]` : "";

  return `${title}\n\n${opening}\n\nI’m reaching out regarding ${request.charAt(0).toLowerCase()}${request.slice(1)}. Please let me know if you have any questions or would like to discuss this further.${detail}${signature}`;
}

export class MockAssistProvider implements AssistProvider {
  async generate(input: AssistRequest): Promise<string> {
    await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_DELAY_MS));
    return buildMockAssistResponse(input);
  }
}
