import { useEffect, useState } from "react";
import {
  Check,
  Clipboard,
  Copy,
  FileText,
  LoaderCircle,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ResponseStatus = "empty" | "loading" | "success" | "error";

interface ResponsePanelProps {
  status: ResponseStatus;
  response: string;
  onClear: () => void;
  errorMessage?: string;
}

export function ResponsePanel({ status, response, onClear, errorMessage }: ResponsePanelProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-labelledby="response-title"
      className="flex min-h-[34rem] flex-col border border-border bg-card panel-shadow lg:sticky lg:top-24"
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-sm bg-accent text-accent-foreground">
            <WandSparkles aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 id="response-title" className="text-base font-semibold text-foreground">
              AI Response
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Your draft will appear here</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Preview mode
        </span>
      </header>

      <div className="flex flex-1 flex-col px-5 py-6 sm:px-6">
        {status === "empty" && (
          <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
            <div className="relative mb-5 flex size-16 items-center justify-center border border-border bg-muted">
              <FileText aria-hidden="true" className="size-7 text-muted-foreground" />
              <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles aria-hidden="true" className="size-3.5" />
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Ready when you are.</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Enter a request and provide any relevant context to generate a useful business
              response.
            </p>
          </div>
        )}

        {status === "loading" && (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center py-14 text-center"
          >
            <span className="mb-5 flex size-14 items-center justify-center border border-border bg-muted text-primary">
              <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
            </span>
            <h3 className="text-base font-semibold text-foreground">Generating your response...</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Putting together a clear, thoughtful draft.
            </p>
          </div>
        )}

        {status === "error" && (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center py-14 text-center"
          >
            <span className="mb-4 flex size-12 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <h3 className="text-base font-semibold text-foreground">
              We couldn’t create a response.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMessage || "Something went wrong. Please try again."}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-1 flex-col">
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{response}</p>
          </div>
        )}
      </div>

      {status === "success" && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">Review your draft before sharing.</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
              Clear
            </Button>
            <Button type="button" variant="default" size="sm" onClick={() => void copyResponse()}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy Response"}
            </Button>
          </div>
        </footer>
      )}
      {status !== "success" && status !== "loading" && (
        <footer className="flex items-center gap-2 border-t border-border px-5 py-3.5 text-xs text-muted-foreground sm:px-6">
          <Clipboard aria-hidden="true" className="size-3.5" />
          Your finished draft will be ready to copy here.
        </footer>
      )}
    </section>
  );
}
