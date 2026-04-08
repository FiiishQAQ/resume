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

const rewriteSchema = z.object({
  rewrittenResume: z.string(),
});

export type ImprovementGenerationResult = {
  payload: SuggestionPayload;
  rewrittenResume: string;
};

export async function generateImprovementPayload(input: {
  resumeText: string;
  analysis: AnalysisRun;
  skills: SkillProfile[];
  scorecard?: Scorecard | null;
}): Promise<ImprovementGenerationResult> {
  const model = getChatModel();
  if (!model) {
    const payload = mockImprovementPayload(input.resumeText, {
      baselineScore: input.analysis.baselineScore,
      summary: input.analysis.summary,
      skills: input.skills,
    });

    return {
      payload,
      rewrittenResume: createMockRewrittenResume(input.resumeText, payload),
    };
  }

  try {
    const suggestionRunnable = model.withStructuredOutput(suggestionSchema);
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

    const payload = await suggestionRunnable.invoke(prompt);
    const rewriteRunnable = model.withStructuredOutput(rewriteSchema);
    const rewritePrompt = `
你是一名资深求职顾问。请基于原简历和优化建议，直接输出一版“可继续人工编辑”的改写简历全文。
要求：
1. 保留候选人原有事实，不要虚构经历、指标或头衔。
2. 优先优化结构、措辞、项目描述、成果表达和技能与项目的绑定。
3. 输出纯简历正文，不要加解释，不要加 markdown code block。
4. 语言与原简历保持一致，原文主要是中文就输出中文简历。

原简历：
${input.resumeText.slice(0, 12000)}

优化建议：
${JSON.stringify(payload, null, 2)}
    `.trim();

    const rewrite = await rewriteRunnable.invoke(rewritePrompt);

    return {
      payload,
      rewrittenResume: rewrite.rewrittenResume.trim(),
    };
  } catch {
    const payload = mockImprovementPayload(input.resumeText, {
      baselineScore: input.analysis.baselineScore,
      summary: input.analysis.summary,
      skills: input.skills,
    });

    return {
      payload,
      rewrittenResume: createMockRewrittenResume(input.resumeText, payload),
    };
  }
}

function createMockRewrittenResume(resumeText: string, payload: SuggestionPayload) {
  const suggestionLines = payload.suggestions.map((item, index) => {
    return `${index + 1}. ${item.title}\n- 重点问题：${item.problem}\n- 改写方向：${item.recommendation}\n- 面试引导：${item.interviewerAngle}`;
  });

  return [
    "【改写草稿】",
    "下面这版是系统根据当前建议生成的可编辑草稿，请继续按真实经历补充量化结果和细节。",
    "",
    resumeText.trim(),
    "",
    "【建议优先改写点】",
    ...suggestionLines,
  ].join("\n");
}
