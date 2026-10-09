import { describe, expect, it } from "vitest";

import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/assist/attachments";
import { formatFileSize, validateFile } from "./attachment-utils";

describe("validateFile", () => {
  it("accepts every advertised extension", () => {
    for (const extension of ACCEPTED_EXTENSIONS) {
      const file = new File(["data"], `notes.${extension}`, { type: "" });
      expect(validateFile(file)).toBeNull();
    }
  });

  it("rejects unsupported file types", () => {
    const file = new File(["data"], "script.exe", { type: "application/octet-stream" });
    expect(validateFile(file)).toContain("isn’t supported");
  });

  it("rejects files larger than 20 MB", () => {
    const file = new File(["data"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: MAX_FILE_SIZE + 1 });
    expect(validateFile(file)).toContain("larger than 20 MB");
  });
});

describe("formatFileSize", () => {
  it("formats kilobytes and megabytes", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
