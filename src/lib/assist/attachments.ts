/**
 * Shared attachment rules used by both the browser uploader and the server.
 *
 * Only formats listed here are advertised in the UI and accepted by the API.
 * Keep the two in sync by importing from this module rather than hard-coding
 * extensions anywhere else.
 */

/** Maximum size for a single attachment (20 MB). */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Maximum combined size for all attachments on one request (30 MB). */
export const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

/** Maximum number of attachments allowed on one request. */
export const MAX_FILES = 5;

/**
 * Canonical MIME type for each supported extension. Gemini needs the correct
 * IANA MIME type for inline data, so the server derives it from the extension
 * instead of trusting the browser-provided file type.
 */
export const SUPPORTED_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
} as const;

export type SupportedExtension = keyof typeof SUPPORTED_MIME_TYPES;

export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "xlsx", "txt", "png", "jpg", "jpeg"] as const;

/** Value for the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");

/** Human-readable list of supported formats for error messages and copy. */
export const SUPPORTED_FORMATS_LABEL = "PDF, DOCX, XLSX, TXT, PNG, or JPG";

export function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0 || lastDot === name.length - 1) return "";
  return name.slice(lastDot + 1).toLowerCase();
}

export function isSupportedExtension(extension: string): extension is SupportedExtension {
  return extension in SUPPORTED_MIME_TYPES;
}

export function mimeTypeForExtension(extension: string): string | undefined {
  return isSupportedExtension(extension) ? SUPPORTED_MIME_TYPES[extension] : undefined;
}

export function isImageExtension(extension: string): boolean {
  return extension === "png" || extension === "jpg" || extension === "jpeg";
}

/** Strips whitespace/newlines from a base64 string. */
export function normalizeBase64(data: string): string {
  return data.replace(/\s/g, "");
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function isValidBase64(data: string): boolean {
  const clean = normalizeBase64(data);
  if (clean.length === 0) return false;
  if (clean.length % 4 !== 0) return false;
  return BASE64_PATTERN.test(clean);
}

/** Computes the decoded byte length of a base64 string without decoding it. */
export function base64ByteLength(data: string): number {
  const clean = normalizeBase64(data);
  if (clean.length === 0) return 0;
  let padding = 0;
  if (clean.endsWith("==")) padding = 2;
  else if (clean.endsWith("=")) padding = 1;
  return Math.floor((clean.length * 3) / 4) - padding;
}
