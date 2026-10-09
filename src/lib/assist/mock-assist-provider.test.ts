import { describe, expect, it } from "vitest";

import { buildMockAssistResponse, MockAssistProvider } from "./mock-assist-provider";
import type { AssistRequest } from "./types";

const VALID_INPUT = {
  prompt: "Write a reply",
  context: "",
  taskType: "Write an Email",
  tone: "Professional",
} as const;

describe("MockAssistProvider", () => {
  it("generates a response via buildMockAssistResponse with expected structure", () => {
    const result = buildMockAssistResponse(VALID_INPUT);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("MockAssistProvider.generate returns a response and includes useful content", async () => {
    const provider = new MockAssistProvider();
    const request: AssistRequest = { ...VALID_INPUT, files: [] };
    const result = await provider.generate(request);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Should include the task type context
    expect(result).toContain(VALID_INPUT.taskType);
  });

  it("builds appropriate email response for delay/order scenarios", () => {
    const result = buildMockAssistResponse({
      prompt: "The order is delayed",
      context: "Order #123 was due by Friday",
      taskType: "Write an Email",
      tone: "Formal",
    });
    expect(typeof result).toBe("string");
    expect(result.toLowerCase()).toMatch(/delay|order/);
    expect(result).toContain("[Client Name]");
    expect(result).toContain("[Your Name]");
  });

  it("includes context when provided for summarize task", () => {
    const context = "Budget review notes from Q4 meeting";
    const result = buildMockAssistResponse({
      prompt: "Summarize the key points",
      context,
      taskType: "Summarize Information",
      tone: "Professional",
    });
    expect(result).toContain("Summarize Information");
    expect(result).toContain(context);
  });

  it("handles organize task with structured output", () => {
    const result = buildMockAssistResponse({
      prompt: "Plan the event",
      context: "Attendees: 10 people, Date: next Friday",
      taskType: "Organize Information",
      tone: "Friendly",
    });
    expect(result).toContain("Organize Information");
    expect(result).toContain("Objective");
    expect(result).toContain("Key details");
    expect(result).toContain("Next steps");
  });

  it("adjusts tone for friendly vs formal", () => {
    const friendly = buildMockAssistResponse({
      prompt: "Follow up",
      context: "",
      taskType: "Write an Email",
      tone: "Friendly",
    });
    const formal = buildMockAssistResponse({
      prompt: "Follow up",
      context: "",
      taskType: "Write an Email",
      tone: "Formal",
    });
    expect(friendly).not.toEqual(formal);
  });
});
