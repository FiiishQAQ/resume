import { NextResponse } from "next/server";
import { z } from "zod";

import { createResumeVersion, getLatestVersion, replaceSegments } from "@/lib/db/queries";
import { textToSegments } from "@/lib/resume/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  rawText: z.string().min(40),
});

export async function POST(request: Request) {
  const body = await request.json();
  const payload = payloadSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "简历文本过短，请补充后再保存。" }, { status: 400 });
  }

  const latestVersion = getLatestVersion();

  const version = createResumeVersion({
    sourceKind: "editor",
    fileName: null,
    rawText: payload.data.rawText,
    parentVersionId: latestVersion?.id ?? null,
  });

  replaceSegments(version.id, textToSegments(payload.data.rawText));

  return NextResponse.json({ ok: true, versionId: version.id });
}
