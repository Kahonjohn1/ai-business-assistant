import { describe, expect, it } from "vitest";

import { ApiAssistProvider, type AssistApiCall } from "./api-assist-provider";
import type { AssistApiRequest } from "./types";

const VALID_INPUT = {
  prompt: "Write a reply",
  context: "",
  taskType: "Write an Email",
  tone: "Professional",
} as const;

function fakeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiAssistProvider", () => {
  it("sends an AssistApiRequest and returns the response string", async () => {
    let received: AssistApiRequest | undefined;
    const callApi: AssistApiCall = async (payload) => {
      received = payload;
      return fakeResponse(200, { response: "Draft reply here" });
    };
    const provider = new ApiAssistProvider(callApi);
    const file = new File(["x"], "notes.txt", { type: "text/plain" });

    const result = await provider.generate({
      ...VALID_INPUT,
      files: [file],
    });

    expect(result).toBe("Draft reply here");
    expect(received).toMatchObject({
      prompt: "Write a reply",
      context: "",
      taskType: "Write an Email",
      tone: "Professional",
      attachments: [{ name: "notes.txt", size: 1, type: "text/plain" }],
    });
  });

  it("omits attachments when no files are attached", async () => {
    let received: AssistApiRequest | undefined;
    const callApi: AssistApiCall = async (payload) => {
      received = payload;
      return fakeResponse(200, { response: "ok" });
    };
    const provider = new ApiAssistProvider(callApi);

    await provider.generate({ ...VALID_INPUT, files: [] });

    expect(received?.attachments).toBeUndefined();
  });

  it("throws the server error message for a 400 response", async () => {
    const callApi: AssistApiCall = async () =>
      fakeResponse(400, { error: "Prompt is required and must not be empty." });
    const provider = new ApiAssistProvider(callApi);

    await expect(provider.generate({ ...VALID_INPUT, files: [] })).rejects.toThrow(
      "Prompt is required and must not be empty.",
    );
  });

  it("throws a generic error for a non-JSON failure body", async () => {
    const callApi: AssistApiCall = async () => new Response("boom", { status: 500 });
    const provider = new ApiAssistProvider(callApi);

    await expect(provider.generate({ ...VALID_INPUT, files: [] })).rejects.toThrow(
      "Something went wrong. Please try again.",
    );
  });

  it("throws a generic error for an unexpected success payload", async () => {
    const callApi: AssistApiCall = async () => fakeResponse(200, { unexpected: true });
    const provider = new ApiAssistProvider(callApi);

    await expect(provider.generate({ ...VALID_INPUT, files: [] })).rejects.toThrow(
      "The assistant returned an unexpected response.",
    );
  });
});
