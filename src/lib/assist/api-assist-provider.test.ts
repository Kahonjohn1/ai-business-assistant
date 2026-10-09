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
  it("sends the request without attachments when no files are attached", async () => {
    let received: AssistApiRequest | undefined;
    const callApi: AssistApiCall = async (payload) => {
      received = payload;
      return fakeResponse(200, { response: "ok" });
    };
    const provider = new ApiAssistProvider(callApi);

    await provider.generate({ ...VALID_INPUT, files: [] });

    expect(received).toEqual({
      prompt: "Write a reply",
      context: "",
      taskType: "Write an Email",
      tone: "Professional",
    });
    expect(received?.attachments).toBeUndefined();
  });

  it("sends the request with additional context but no attachments", async () => {
    let received: AssistApiRequest | undefined;
    const callApi: AssistApiCall = async (payload) => {
      received = payload;
      return fakeResponse(200, { response: "ok" });
    };
    const provider = new ApiAssistProvider(callApi);

    await provider.generate({ ...VALID_INPUT, context: "Order 42 is delayed.", files: [] });

    expect(received?.context).toBe("Order 42 is delayed.");
    expect(received?.attachments).toBeUndefined();
  });

  it("base64-encodes the actual file contents for a single attachment", async () => {
    let received: AssistApiRequest | undefined;
    const callApi: AssistApiCall = async (payload) => {
      received = payload;
      return fakeResponse(200, { response: "Draft reply here" });
    };
    const provider = new ApiAssistProvider(callApi);
    const file = new File(["x"], "notes.txt", { type: "text/plain" });

    const result = await provider.generate({ ...VALID_INPUT, files: [file] });

    expect(result).toBe("Draft reply here");
    expect(received?.attachments).toEqual([
      { name: "notes.txt", size: 1, type: "text/plain", data: "eA==" },
    ]);
  });

  it("supports multiple attachments", async () => {
    let received: AssistApiRequest | undefined;
    const callApi: AssistApiCall = async (payload) => {
      received = payload;
      return fakeResponse(200, { response: "ok" });
    };
    const provider = new ApiAssistProvider(callApi);
    const text = new File(["hello"], "notes.txt", { type: "text/plain" });
    const image = new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", {
      type: "image/jpeg",
    });

    await provider.generate({ ...VALID_INPUT, files: [text, image] });

    expect(received?.attachments).toHaveLength(2);
    expect(received?.attachments?.[0]?.name).toBe("notes.txt");
    expect(received?.attachments?.[1]?.name).toBe("photo.jpg");
    expect(received?.attachments?.[1]?.data).toBe("/9j/");
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
