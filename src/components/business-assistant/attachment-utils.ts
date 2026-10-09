import {
  ACCEPTED_EXTENSIONS,
  getFileExtension,
  isSupportedExtension,
  MAX_FILE_SIZE,
  SUPPORTED_FORMATS_LABEL,
} from "@/lib/assist/attachments";

export { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE };

export function validateFile(file: File) {
  const extension = getFileExtension(file.name);
  if (!isSupportedExtension(extension)) {
    return `That file type isn’t supported. Add a ${SUPPORTED_FORMATS_LABEL} file.`;
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
