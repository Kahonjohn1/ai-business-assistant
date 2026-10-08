export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "xlsx", "txt", "png", "jpg", "jpeg"] as const;

export function validateFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return "That file type isn’t supported. Add a PDF, DOCX, XLSX, TXT, PNG, or JPG file.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "This file is larger than 20 MB. Choose a smaller file to continue.";
  }
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
