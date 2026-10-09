import { describe, expect, it } from "vitest";

import { createZip } from "@/test/zip";
import { DocumentExtractionError, extractDocxText, extractXlsxText } from "./document-text";

const DOCX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>
<w:p><w:r><w:t>Second &amp; line</w:t></w:r></w:p>
</w:body></w:document>`;

const SHARED_STRINGS = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Name</t></si><si><t>Alice</t></si></sst>`;

const SHEET = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>
<row><c><v>42</v></c></row>
</sheetData></worksheet>`;

describe("extractDocxText", () => {
  it("extracts paragraph text from a stored (uncompressed) DOCX", () => {
    const docx = createZip([{ name: "word/document.xml", content: DOCX_XML }]);
    expect(extractDocxText(docx)).toBe("Hello world\nSecond & line");
  });

  it("extracts paragraph text from a deflated DOCX", () => {
    const docx = createZip([{ name: "word/document.xml", content: DOCX_XML }], true);
    expect(extractDocxText(docx)).toBe("Hello world\nSecond & line");
  });

  it("throws for an archive without a document body", () => {
    const docx = createZip([{ name: "[Content_Types].xml", content: "<Types/>" }]);
    expect(() => extractDocxText(docx)).toThrow(DocumentExtractionError);
  });

  it("throws for a non-archive buffer", () => {
    expect(() => extractDocxText(Buffer.from("not a zip at all"))).toThrow(DocumentExtractionError);
  });
});

describe("extractXlsxText", () => {
  it("extracts shared strings and literal cell values", () => {
    const xlsx = createZip(
      [
        { name: "xl/sharedStrings.xml", content: SHARED_STRINGS },
        { name: "xl/worksheets/sheet1.xml", content: SHEET },
      ],
      true,
    );
    expect(extractXlsxText(xlsx)).toBe("Sheet 1:\nName\tAlice\n42");
  });

  it("throws when there are no sheets", () => {
    const xlsx = createZip([{ name: "xl/workbook.xml", content: "<workbook/>" }]);
    expect(() => extractXlsxText(xlsx)).toThrow(DocumentExtractionError);
  });
});
