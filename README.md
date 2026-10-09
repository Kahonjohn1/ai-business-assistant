# AI Business Assistance

A React and TanStack Start workspace for business communication and productivity assistance.

## Current scope

The app supports business requests, optional additional context, task type and tone selection, and optional document/image attachments. Requests are sent to `POST /api/assist`, which validates them and calls Gemini server-side.

- **Attachments**: PDF, DOCX, XLSX, TXT, PNG, JPG/JPEG. Up to 5 files, 20 MB each, 30 MB total.
- **Analysis**: images and PDFs are sent to Gemini as inline data; DOCX/XLSX text is extracted server-side; TXT is read directly.
- Attachment content is treated as untrusted reference data and cannot override the system instructions.

API credentials live only in environment variables (see `.env.example`). The browser never receives them.

A `MockAssistProvider` remains available (see `src/lib/assist/index.ts`) for tests and offline use.

## Development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```
