import {
  getFileExtension,
  isImageExtension,
  mimeTypeForExtension,
  normalizeBase64,
  SUPPORTED_FORMATS_LABEL,
} from "@/lib/assist/attachments";
import type { AssistApiAttachment } from "@/lib/assist/types";

import { DocumentExtractionError, extractDocxText, extractXlsxText } from "./document-text";

/**
 * Raised when an attachment passes request validation but cannot be turned
 * into model input (wrong signature, corrupt archive, empty body). The
 * `/api/assist` handler maps this to a 400 so the user gets a clear message
 * instead of a generic server error.
 */
export class AssistAttachmentError extends Error {}

/**
 * A minimal, SDK-compatible content part. The Gemini SDK accepts plain objects
 * of this shape, which keeps the service dependency-injectable in tests.
 */
export type AiContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

function hasSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function assertSignature(
  buffer: Buffer,
  signature: number[],
  name: string,
  expected: string,
): void {
  if (!hasSignature(buffer, signature)) {
    throw new AssistAttachmentError(`“${name}” doesn’t look like a valid ${expected} file.`);
  }
}

function wrapExtractedText(label: string, name: string, text: string): AiContentPart {
  return { text: `${label}: ${name}\n<attachment>\n${text}\n</attachment>` };
}

/**
 * Converts validated attachments into Gemini content parts:
 * - images and PDFs are sent as base64 inline data for native analysis
 * - DOCX/XLSX text is extracted from the archive
 * - TXT is decoded directly
 *
 * Extracted/decoded text is wrapped in <attachment> markers so the model can
 * tell user-provided data apart from the system instructions.
 */
export function buildAttachmentParts(
  attachments: AssistApiAttachment[] | undefined,
): AiContentPart[] {
  if (!attachments || attachments.length === 0) return [];

  const parts: AiContentPart[] = [];

  for (const attachment of attachments) {
    const extension = getFileExtension(attachment.name);
    const data = normalizeBase64(attachment.data);
    const buffer = Buffer.from(data, "base64");

    if (buffer.length === 0) {
      throw new AssistAttachmentError(`“${attachment.name}” is empty.`);
    }

    if (extension === "pdf") {
      assertSignature(buffer, PDF_SIGNATURE, attachment.name, "PDF");
      parts.push({
        text: `Attachment (PDF document): ${attachment.name}. Analyze the document contents below.`,
      });
      parts.push({ inlineData: { mimeType: "application/pdf", data } });
      continue;
    }

    if (isImageExtension(extension)) {
      const signature = extension === "png" ? PNG_SIGNATURE : JPEG_SIGNATURE;
      assertSignature(buffer, signature, attachment.name, extension === "png" ? "PNG" : "JPEG");
      const mimeType = mimeTypeForExtension(extension) ?? "image/jpeg";
      parts.push({
        text: `Attachment (image): ${attachment.name}. Analyze the image contents below.`,
      });
      parts.push({ inlineData: { mimeType, data } });
      continue;
    }

    if (extension === "txt") {
      parts.push({ text: `Attachment (text file): ${attachment.name}` });
      parts.push(wrapExtractedText("Contents", attachment.name, buffer.toString("utf8")));
      continue;
    }

    if (extension === "docx" || extension === "xlsx") {
      assertSignature(buffer, ZIP_SIGNATURE, attachment.name, "Office");
      let text: string;
      try {
        text = extension === "docx" ? extractDocxText(buffer) : extractXlsxText(buffer);
      } catch (error) {
        if (error instanceof DocumentExtractionError) {
          throw new AssistAttachmentError(
            `“${attachment.name}” could not be read: ${error.message}`,
          );
        }
        throw error;
      }
      const label =
        extension === "docx" ? "Attachment (Word document)" : "Attachment (spreadsheet)";
      parts.push(wrapExtractedText(label, attachment.name, text));
      continue;
    }

    throw new AssistAttachmentError(
      `“${attachment.name}” isn’t a supported file type. Use ${SUPPORTED_FORMATS_LABEL}.`,
    );
  }

  return parts;
}
