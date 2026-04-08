import { NextResponse } from "next/server";

import { getLatestAnalysisByVersion, getLatestVersion, getSkillsByAnalysis, saveInterviewSession } from "@/lib/db/queries";
import { generateInterviewPlan } from "@/lib/interview/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const version = getLatestVersion();
  if (!version) {
    return NextResponse.json({ error: "请先上传并分析简历。" }, { status: 400 });
  }

  const analysis = getLatestAnalysisByVersion(version.id);
  if (!analysis) {
    return NextResponse.json({ error: "请先运行简历分析。" }, { status: 400 });
  }

  const skills = getSkillsByAnalysis(analysis.id);
  const coverage = await generateInterviewPlan(skills, analysis);
  const firstQuestion = coverage.questions[0];

  if (!firstQuestion) {
    return NextResponse.json({ error: "未生成有效面试题。" }, { status: 400 });
  }

  const sessionId = saveInterviewSession({
    resumeVersionId: version.id,
    analysisRunId: analysis.id,
    coverage,
    firstQuestion: firstQuestion.question,
  });

  return NextResponse.json({ ok: true, sessionId });
}
