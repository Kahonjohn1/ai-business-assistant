import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Paperclip, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ACCEPTED_EXTENSIONS, formatFileSize, validateFile } from "./attachment-utils";

interface AttachmentUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (preview) {
    return (
      <img
        src={preview}
        alt={`Preview of ${file.name}`}
        className="size-10 rounded-sm object-cover"
      />
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const Icon = extension === "xlsx" ? FileSpreadsheet : FileText;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

export function AttachmentUploader({ files, onFilesChange }: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const addFiles = (incoming: FileList | File[]) => {
    const accepted: File[] = [];
    let firstError = "";
    Array.from(incoming).forEach((file) => {
      const validation = validateFile(file);
      if (validation) {
        firstError ||= validation;
      } else if (
        !files.some((existing) => existing.name === file.name && existing.size === file.size)
      ) {
        accepted.push(file);
      }
    });
    if (accepted.length) onFilesChange([...files, ...accepted]);
    setError(firstError);
  };

  return (
    <section aria-labelledby="attachments-title" className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="attachments-title" className="text-sm font-semibold text-foreground">
            Attachments
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add documents or images relevant to your request.
          </p>
        </div>
        <Paperclip aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
      </div>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept={ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
        aria-label="Choose attachments"
        onChange={(event) => {
          if (event.currentTarget.files) addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-24 w-full flex-col items-center justify-center gap-2 border border-dashed px-4 py-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragging ? "border-primary bg-accent" : "border-input bg-background hover:border-primary/50 hover:bg-muted/50"}`}
      >
        <span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
          <Upload aria-hidden="true" className="size-4" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Drop files here or click to upload
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, DOCX, XLSX, TXT, PNG, JPG · Up to 20 MB each
        </span>
      </button>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Files are attached for future processing; they are not analyzed yet.
      </p>
      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Selected attachments">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex min-w-0 items-center gap-3 border border-border bg-card p-2.5"
            >
              <FilePreview file={file} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {file.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${file.name}`}
                title="Remove file"
                onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
