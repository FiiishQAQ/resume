import { NextResponse } from "next/server";

import { getLatestVersion, getSegmentsByVersion, saveAnalysisRun, saveEvolutionSnapshot } from "@/lib/db/queries";
import { analyzeResume } from "@/lib/resume/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const version = getLatestVersion();
  if (!version) {
    return NextResponse.json({ error: "还没有简历版本，请先上传简历。" }, { status: 400 });
  }

  const segments = getSegmentsByVersion(version.id);
  const analysis = await analyzeResume(version.rawText, segments);
  const analysisRunId = saveAnalysisRun(version.id, analysis);

  saveEvolutionSnapshot({
    resumeVersionId: version.id,
    analysisRunId,
    totalScore: analysis.baselineScore,
    baselineScore: analysis.baselineScore,
    skillCoverage: analysis.summary.skillCoverage,
    projectAlignment: analysis.summary.projectAlignment,
    communicationScore: analysis.baselineScore - 4,
  });

  return NextResponse.json({ ok: true, analysisRunId });
}
