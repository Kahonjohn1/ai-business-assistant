import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assistProvider, TASK_TYPES, TONES, type TaskType, type Tone } from "@/lib/assist";
import { AttachmentUploader } from "./attachment-uploader";
import { ResponsePanel } from "./response-panel";
import { ThemeToggle } from "@/components/theme-toggle";

export function BusinessAssistant() {
  const [request, setRequest] = useState("");
  const [context, setContext] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("Write an Email");
  const [tone, setTone] = useState<Tone>("Professional");
  const [files, setFiles] = useState<File[]>([]);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<"empty" | "loading" | "success" | "error">("empty");
  const [requestError, setRequestError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const generateResponse = async () => {
    if (!request.trim()) {
      setRequestError("Please enter a request before generating a response.");
      return;
    }

    setRequestError("");
    setErrorMessage("");
    setResponse("");
    setStatus("loading");
    try {
      const result = await assistProvider.generate({
        prompt: request,
        context,
        taskType,
        tone,
        files,
      });
      setResponse(result);
      setStatus("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
      setStatus("error");
    }
  };

  const clearResponse = () => {
    setResponse("");
    setErrorMessage("");
    setStatus("empty");
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <BriefcaseBusiness aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground sm:text-base">Welcome</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                What are we working on today?
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 border-l border-border pl-5 text-xs text-muted-foreground md:flex">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Workspace ready
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-7 lg:px-10">
        <section className="relative overflow-hidden border-b border-border py-8 sm:py-10">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] subtle-grid opacity-50 lg:block"
            aria-hidden="true"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-4" />
              <span>Start with a request</span>
              <ArrowDown aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline">Review your draft</span>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 pt-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-6">
          <section
            aria-labelledby="request-panel-title"
            className="border border-border bg-card panel-shadow"
          >
            <header className="border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <h2 id="request-panel-title" className="text-base font-semibold text-foreground">
                    How can I help?
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Describe what you’d like to get done.
                  </p>
                </div>
              </div>
            </header>

            <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="business-request">Your request</Label>
                  <span className="text-xs text-muted-foreground">Required</span>
                </div>
                <Textarea
                  id="business-request"
                  value={request}
                  onChange={(event) => {
                    setRequest(event.target.value);
                    if (event.target.value.trim()) setRequestError("");
                  }}
                  placeholder="Describe what you need help with..."
                  aria-invalid={Boolean(requestError)}
                  aria-describedby={requestError ? "request-error" : "request-hint"}
                  className="min-h-36 resize-y rounded-sm bg-background px-3.5 py-3 text-sm leading-6 shadow-none placeholder:text-muted-foreground/80"
                />
                {requestError ? (
                  <p
                    id="request-error"
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    {requestError}
                  </p>
                ) : (
                  <p id="request-hint" className="text-xs leading-5 text-muted-foreground">
                    Tell the assistant what you want to create, rewrite, summarize, or organize.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="task-type">Task Type</Label>
                  <Select
                    value={taskType}
                    onValueChange={(value) => setTaskType(value as TaskType)}
                  >
                    <SelectTrigger
                      id="task-type"
                      className="h-10 rounded-sm bg-background shadow-none"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_TYPES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={(value) => setTone(value as Tone)}>
                    <SelectTrigger id="tone" className="h-10 rounded-sm bg-background shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="business-context">Additional Context</Label>
                  <span className="border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    Optional
                  </span>
                </div>
                <Textarea
                  id="business-context"
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="Add any information the assistant should consider..."
                  className="min-h-24 resize-y rounded-sm bg-background px-3.5 py-3 text-sm leading-6 shadow-none placeholder:text-muted-foreground/80"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Add relevant names, dates, customer information, product details, or instructions.
                </p>
              </div>

              <AttachmentUploader files={files} onFilesChange={setFiles} />

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                  Review and personalize your response before sending it.
                </p>
                <Button
                  type="button"
                  size="lg"
                  disabled={status === "loading"}
                  onClick={() => void generateResponse()}
                  className="h-11 w-full rounded-sm px-5 sm:w-auto"
                >
                  {status === "loading" ? (
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                      aria-hidden="true"
                    />
                  ) : (
                    <Sparkles aria-hidden="true" />
                  )}
                  {status === "loading" ? "Generating..." : "Generate Response"}
                  {status !== "loading" && <ArrowRight aria-hidden="true" className="size-4" />}
                </Button>
              </div>
            </div>
          </section>

          <ResponsePanel
            status={status}
            response={response}
            onClear={clearResponse}
            errorMessage={errorMessage}
          />
        </div>

        <footer className="flex flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            AI Business Assistance <span className="px-1.5 text-border">/</span> Make every message
            count.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-3.5 text-emerald-600" /> Your drafts stay in
            this workspace.
          </p>
        </footer>
      </div>
    </main>
  );
}
