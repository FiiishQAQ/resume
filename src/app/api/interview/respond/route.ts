import { NextResponse } from "next/server";
import { z } from "zod";

import {
  appendInterviewMessage,
  getLatestAnalysisByVersion,
  getLatestSessionByVersion,
  getLatestVersion,
  getScorecardBySession,
  saveEvolutionSnapshot,
  saveScorecard,
  updateInterviewSession,
} from "@/lib/db/queries";
import { assessInterviewAnswer, finalizeScorecard } from "@/lib/interview/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  answer: z.string().min(10),
});

export async function POST(request: Request) {
  const body = await request.json();
  const payload = payloadSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "回答内容太短，请至少写一句完整陈述。" }, { status: 400 });
  }

  const version = getLatestVersion();
  if (!version) {
    return NextResponse.json({ error: "请先上传简历。" }, { status: 400 });
  }

  const session = getLatestSessionByVersion(version.id);
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "当前没有进行中的面试会话。" }, { status: 400 });
  }

  const analysis = getLatestAnalysisByVersion(version.id);
  if (!analysis) {
    return NextResponse.json({ error: "缺少简历分析结果。" }, { status: 400 });
  }

  const currentQuestion = session.coverage.questions[session.currentQuestionIndex];
  if (!currentQuestion) {
    return NextResponse.json({ error: "当前问题不存在。" }, { status: 400 });
  }

  appendInterviewMessage(session.id, "user", payload.data.answer, {
    questionId: currentQuestion.id,
  });

  const assessment = await assessInterviewAnswer({
    question: currentQuestion,
    answer: payload.data.answer,
    analysisHeadline: analysis.summary.headline,
  });

  const nextIndex = session.currentQuestionIndex + 1;
  const updatedCoverage = {
    ...session.coverage,
    assessments: [...session.coverage.assessments, assessment],
  };

  const nextQuestion = updatedCoverage.questions[nextIndex];

  if (nextQuestion) {
    appendInterviewMessage(session.id, "assistant", nextQuestion.question, {
      questionId: nextQuestion.id,
      followUp: assessment.followUpSignal,
    });

    updateInterviewSession(session.id, {
      currentQuestionIndex: nextIndex,
      status: "active",
      coverage: updatedCoverage,
    });

    return NextResponse.json({ ok: true, done: false });
  }

  const scorecard = await finalizeScorecard({
    analysis,
    assessments: updatedCoverage.assessments,
  });

  appendInterviewMessage(
    session.id,
    "assistant",
    `这轮模拟面试结束。你的总分是 ${scorecard.totalScore}，技术深度 ${scorecard.technicalScore}，项目支撑 ${scorecard.projectScore}。`,
    { kind: "summary" },
  );

  updateInterviewSession(session.id, {
    currentQuestionIndex: nextIndex,
    status: "completed",
    coverage: updatedCoverage,
  });

  saveScorecard(session.id, scorecard);

  if (!getScorecardBySession(session.id)) {
    return NextResponse.json({ error: "评分保存失败。" }, { status: 500 });
  }

  saveEvolutionSnapshot({
    resumeVersionId: version.id,
    analysisRunId: analysis.id,
    sessionId: session.id,
    totalScore: scorecard.totalScore,
    baselineScore: analysis.baselineScore,
    skillCoverage: analysis.summary.skillCoverage,
    projectAlignment: analysis.summary.projectAlignment,
    communicationScore: scorecard.communicationScore,
  });

  return NextResponse.json({ ok: true, done: true });
}
