import "server-only";

import { z } from "zod";

import { getChatModel } from "@/lib/ai/openai";
import { mockImprovementPayload } from "@/lib/resume/mock";
import type { AnalysisRun, Scorecard, SkillProfile, SuggestionPayload } from "@/lib/types";

const suggestionSchema = z.object({
  overview: z.string(),
  suggestions: z.array(
    z.object({
      title: z.string(),
      problem: z.string(),
      recommendation: z.string(),
      resumeEvidence: z.string(),
      interviewerAngle: z.string(),
    }),
  ),
});

export async function generateImprovementPayload(input: {
  resumeText: string;
  analysis: AnalysisRun;
  skills: SkillProfile[];
  scorecard?: Scorecard | null;
}): Promise<SuggestionPayload> {
  const model = getChatModel();
  if (!model) {
    return mockImprovementPayload(input.resumeText, {
      baselineScore: input.analysis.baselineScore,
      summary: input.analysis.summary,
      skills: input.skills,
    });
  }

  try {
    const runnable = model.withStructuredOutput(suggestionSchema);
    const prompt = `
你是一名资深求职顾问。请基于以下信息，为候选人生成简历优化建议。
要求：
1. 建议必须回指到简历证据或缺失点。
2. interviewerAngle 说明如何把面试官引导到强项话题。
3. 输出控制在 4 条建议以内。

简历文本：
${input.resumeText.slice(0, 12000)}

简历分析：
${JSON.stringify(input.analysis.summary, null, 2)}

技能：
${JSON.stringify(input.skills, null, 2)}

面试评分：
${JSON.stringify(input.scorecard, null, 2)}
    `.trim();

    return await runnable.invoke(prompt);
  } catch {
    return mockImprovementPayload(input.resumeText, {
      baselineScore: input.analysis.baselineScore,
      summary: input.analysis.summary,
      skills: input.skills,
    });
  }
}
