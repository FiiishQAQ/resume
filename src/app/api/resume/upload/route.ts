import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

import { createResumeVersion, replaceSegments } from "@/lib/db/queries";
import { pagesToSegments } from "@/lib/resume/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workerPath = resolvePdfWorkerPath();

if (workerPath) {
  PDFParse.setWorker(pathToFileURL(workerPath).href);
}

function resolvePdfWorkerPath() {
  const directCandidate = join(process.cwd(), "node_modules", "pdf-parse", "dist", "pdf-parse", "cjs", "pdf.worker.mjs");
  if (existsSync(directCandidate)) {
    return directCandidate;
  }

  const pnpmDir = join(process.cwd(), "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) {
    return null;
  }

  const matchedDir = readdirSync(pnpmDir).find((entry) => entry.startsWith("pdf-parse@"));
  if (!matchedDir) {
    return null;
  }

  const nestedCandidate = join(
    pnpmDir,
    matchedDir,
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "cjs",
    "pdf.worker.mjs",
  );

  return existsSync(nestedCandidate) ? nestedCandidate : null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "请上传 PDF 文件。" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadsDir = join(process.cwd(), "data", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const targetPath = join(uploadsDir, `${Date.now()}-${file.name}`);
  await writeFile(targetPath, buffer);

  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  if (!result.text.trim()) {
    return NextResponse.json({ error: "未能从 PDF 中提取到文本，请上传可复制文本的 PDF。" }, { status: 400 });
  }

  const version = createResumeVersion({
    sourceKind: "pdf",
    fileName: file.name,
    rawText: result.text,
  });

  replaceSegments(version.id, pagesToSegments(result.pages));

  return NextResponse.json({ ok: true, versionId: version.id });
}
