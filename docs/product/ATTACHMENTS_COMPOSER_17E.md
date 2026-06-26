# Attachments Composer Slice 17E

## Source research

OpenAI Help Center references checked on 2026-06-20:

- ChatGPT file uploads support common text, spreadsheet, presentation, and document extensions. OpenAI documents 512 MB per file, 2M tokens for text/document files, roughly 50 MB for CSV/spreadsheets, and 20 MB per image.
- ChatGPT image inputs can be added from the prompt area, dragged into the text area, or pasted from the clipboard. Supported static image types are PNG, JPEG/JPG, and non-animated GIF.
- ChatGPT Enterprise documentation describes file behavior by type: text/document retrieval, spreadsheet/code analysis, native image interpretation, and visual retrieval for PDFs in supported plans.

## Implemented behavior

- Composer `+` opens the native file picker for images, PDFs, text, code, spreadsheets, presentations, documents, archives, and common data formats.
- Files can be dragged into the composer.
- Screenshots/images can be pasted from the clipboard.
- Attachments render as rounded square preview tiles; images use object URL thumbnails and non-image files use typed document tiles.
- Attachment tiles can be removed before send and dragged back out using browser `DownloadURL` metadata when a local object URL exists.
- Sent user messages keep the same attachment previews in the transcript.
- Queued follow-up turns preserve attachment metadata.

## Integration boundary

This slice is UI/BFF-ready only. Raw file bytes remain local to the browser. The BFF forwards sanitized attachment metadata to Hermes and adds an instruction telling Hermes not to claim it read file contents unless future Hermes tools/upload events provide bytes.

This keeps the required path intact:

UI -> Web UI BFF -> Hermes

No browser code calls Hermes directly, no API keys are exposed, and no UI path reads memory/storage internals.

## Remaining mock

- Real upload/storage/ingestion is not implemented.
- There is no verified Hermes file upload endpoint wired yet.
- PDF/text/image contents are not extracted by the Web UI.

## Next slice

Discover and document the real Hermes file/artifact API surface, then add a BFF upload endpoint that streams files to Hermes or a Hermes-approved attachment store without passing binary payloads through chat JSON.
