import { describe, it, expect } from "vitest";
import { validateFile } from "@/lib/storage";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob(["x".repeat(Math.min(sizeBytes, 1))], { type });
  return new File([blob], name, { type });
}

describe("validateFile", () => {
  it("accepts a small PDF", () => {
    const f = makeFile("resume.pdf", "application/pdf", 1024);
    expect(validateFile(f)).toBeNull();
  });

  it("accepts a PNG image", () => {
    const f = makeFile("photo.png", "image/png", 512 * 1024);
    expect(validateFile(f)).toBeNull();
  });

  it("accepts a DOCX file", () => {
    const f = makeFile(
      "doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      200 * 1024,
    );
    expect(validateFile(f)).toBeNull();
  });

  it("rejects a file over 10 MB", () => {
    const oversized = {
      name: "huge.pdf",
      type: "application/pdf",
      size: 11 * 1024 * 1024,
    } as File;
    expect(validateFile(oversized)).toMatch(/too large/i);
  });

  it("rejects an unsupported mime type", () => {
    const f = makeFile("malware.exe", "application/x-msdownload", 100);
    expect(validateFile(f)).toMatch(/not supported/i);
  });

  it("rejects an HTML file", () => {
    const f = makeFile("page.html", "text/html", 200);
    expect(validateFile(f)).toMatch(/not supported/i);
  });
});
