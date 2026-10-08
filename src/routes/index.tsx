import { createFileRoute } from "@tanstack/react-router";

import { BusinessAssistant } from "@/components/business-assistant/business-assistant";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marque AI" },
      {
        name: "description",
        content:
          "Draft emails, refine business messages, summarize information, and organize your work in one focused workspace.",
      },
      {
        property: "og:title",
        content: "Marque AI",
      },
      {
        property: "og:description",
        content:
          "Draft emails, refine business messages, summarize information, and organize your work in one focused workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessAssistant,
});
