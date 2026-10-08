import type { AssistProvider } from "./assist-provider";
import type { AssistApiRequest, AssistRequest } from "./types";

const ASSIST_ENDPOINT = "/api/assist";

export type AssistApiCall = (payload: AssistApiRequest) => Promise<Response>;

async function postAssistApi(payload: AssistApiRequest): Promise<Response> {
  return fetch(ASSIST_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function toAttachmentMetadata(file: File) {
  return { name: file.name, size: file.size, type: file.type };
}

export class ApiAssistProvider implements AssistProvider {
  constructor(private readonly callApi: AssistApiCall = postAssistApi) {}

  async generate(input: AssistRequest): Promise<string> {
    const payload: AssistApiRequest = {
      prompt: input.prompt,
      context: input.context,
      taskType: input.taskType,
      tone: input.tone,
    };
    if (input.files.length > 0) {
      payload.attachments = input.files.map(toAttachmentMetadata);
    }

    const response = await this.callApi(payload);
    return (await this.parseResponse(response)).response;
  }

  private async parseResponse(response: Response): Promise<{ response: string }> {
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
    const body: unknown = await response.json().catch(() => null);
    if (
      body === null ||
      typeof body !== "object" ||
      !("response" in body) ||
      typeof (body as { response?: unknown }).response !== "string"
    ) {
      throw new Error("The assistant returned an unexpected response.");
    }
    return { response: (body as { response: string }).response };
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error?: unknown }).error === "string"
      ) {
        return (body as { error: string }).error;
      }
    } catch {
      // Non-JSON failure body; fall through to the generic message.
    }
    return "Something went wrong. Please try again.";
  }
}
