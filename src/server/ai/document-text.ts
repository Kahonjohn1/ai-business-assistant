import { inflateRawSync } from "node:zlib";

/**
 * Server-only helpers that pull readable text out of Office Open XML files
 * (DOCX/XLSX). Both formats are ZIP archives containing XML; Gemini does not
 * accept them as inline data, so we extract their text ourselves.
 *
 * This is intentionally minimal: it supports the common "deflate" and "store"
 * ZIP entries that Word and Excel produce. Anything it cannot read throws, and
 * the API turns that into a clear 400 rather than sending garbage upstream.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const ZIP64_SENTINEL = 0xffffffff;

/** Caps extracted text so a huge document cannot flood the model context. */
export const MAX_EXTRACTED_CHARS = 100_000;

export class DocumentExtractionError extends Error {}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw new DocumentExtractionError("The file is not a readable Office document.");
  }

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new DocumentExtractionError("The file is not a valid Office document.");
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (compressedSize === ZIP64_SENTINEL || localHeaderOffset === ZIP64_SENTINEL) {
      throw new DocumentExtractionError("The Office document uses an unsupported ZIP64 layout.");
    }

    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER) {
      throw new DocumentExtractionError("The file is not a valid Office document.");
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    entries.set(name, data);

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function collectElementText(xml: string, tag: string): string {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let result = "";
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    result += match[1] ?? "";
  }
  return decodeXmlEntities(result);
}

function truncate(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= MAX_EXTRACTED_CHARS) return normalized;
  return `${normalized.slice(0, MAX_EXTRACTED_CHARS)}\n…[content truncated]`;
}

export function extractDocxText(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const documentXml = entries.get("word/document.xml");
  if (!documentXml) {
    throw new DocumentExtractionError("The Word document has no readable body.");
  }

  const paragraphs = documentXml.toString("utf8").split(/<\/w:p>/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const withBreaks = paragraph
      .replace(/<w:tab(?:\s[^>]*)?\/?>/g, "\t")
      .replace(/<w:br(?:\s[^>]*)?\/?>/g, "\n");
    const text = collectElementText(withBreaks, "w:t")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (text) lines.push(text);
  }

  const result = truncate(lines.join("\n"));
  if (!result) {
    throw new DocumentExtractionError("The Word document has no readable text.");
  }
  return result;
}

function readSharedStrings(xml: Buffer | undefined): string[] {
  if (!xml) return [];
  const content = xml.toString("utf8");
  const pattern = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    values.push(collectElementText(match[1] ?? "", "t"));
  }
  return values;
}

export function extractXlsxText(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const sharedStrings = readSharedStrings(entries.get("xl/sharedStrings.xml"));
  const sheetNames = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort();

  if (sheetNames.length === 0) {
    throw new DocumentExtractionError("The spreadsheet has no readable sheets.");
  }

  const output: string[] = [];
  sheetNames.forEach((name, index) => {
    const xml = entries.get(name);
    if (!xml) return;
    const rows = xml.toString("utf8").split(/<\/row>/);
    const lines: string[] = [];

    for (const row of rows) {
      const cells: string[] = [];
      const cellPattern = /<c(?:\s[^>]*)?>([\s\S]*?)<\/c>/g;
      let cell: RegExpExecArray | null;
      while ((cell = cellPattern.exec(row)) !== null) {
        const cellXml = cell[0];
        const type = cellXml.match(/\bt="([^"]+)"/)?.[1];
        let value = "";
        if (type === "inlineStr") {
          value = collectElementText(cellXml, "t");
        } else {
          const raw = cellXml.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
          const decoded = raw ? decodeXmlEntities(raw) : "";
          value = type === "s" ? (sharedStrings[Number(decoded)] ?? "") : decoded;
        }
        cells.push(value);
      }

      const line = cells.join("\t").trimEnd();
      if (line) lines.push(line);
    }

    if (lines.length > 0) output.push(`Sheet ${index + 1}:\n${lines.join("\n")}`);
  });

  const result = truncate(output.join("\n\n"));
  if (!result) {
    throw new DocumentExtractionError("The spreadsheet has no readable text.");
  }
  return result;
}
