import { NextResponse } from "next/server";

import {
  getLatestAnalysisByVersion,
  getLatestSessionByVersion,
  getLatestVersion,
  getScorecardBySession,
  getSkillsByAnalysis,
  saveImprovement,
} from "@/lib/db/queries";
import { generateImprovementPayload } from "@/lib/evolution/improvement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const version = getLatestVersion();
  if (!version) {
    return NextResponse.json({ error: "请先上传简历。" }, { status: 400 });
  }

  const analysis = getLatestAnalysisByVersion(version.id);
  if (!analysis) {
    return NextResponse.json({ error: "请先运行简历分析。" }, { status: 400 });
  }

  const session = getLatestSessionByVersion(version.id);
  const scorecard = session ? getScorecardBySession(session.id) : null;
  const skills = getSkillsByAnalysis(analysis.id);
  const payload = await generateImprovementPayload({
    resumeText: version.rawText,
    analysis,
    skills,
    scorecard,
  });

  saveImprovement({
    resumeVersionId: version.id,
    analysisRunId: analysis.id,
    sessionId: session?.id ?? null,
    payload,
    rewrittenResume: version.rawText,
  });

  return NextResponse.json({ ok: true });
}
