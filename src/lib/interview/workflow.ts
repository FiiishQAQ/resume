import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { getChatModel } from "@/lib/ai/openai";
import type {
  AnalysisRun,
  InterviewAssessment,
  InterviewQuestion,
  InterviewState,
  Scorecard,
  SkillProfile,
} from "@/lib/types";
import { clampScore, createId } from "@/lib/utils";

const questionPlanSchema = z.object({
  questions: z.array(
    z.object({
      skill: z.string(),
      focus: z.string(),
      question: z.string(),
      targetProject: z.string().optional(),
    }),
  ),
});

const answerAssessmentSchema = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()).min(1).max(3),
  risks: z.array(z.string()).min(1).max(3),
  followUpSignal: z.string(),
});

const scorecardSchema = z.object({
  totalScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  projectScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  behavioralScore: z.number().min(0).max(100),
  rationale: z.string(),
});

const QuestionState = Annotation.Root({
  skills: Annotation<SkillProfile[]>({
    default: () => [],
    reducer: (_current, update) => update,
  }),
  summary: Annotation<string>({
    default: () => "",
    reducer: (_current, update) => update,
  }),
  questions: Annotation<InterviewQuestion[]>({
    default: () => [],
    reducer: (_current, update) => update,
  }),
});

async function buildQuestionPlan(state: typeof QuestionState.State) {
  const model = getChatModel();
  if (!model) {
    return {
      questions: state.skills.slice(0, 5).map((skill, index) => ({
        id: createId(),
        skill: skill.name,
        focus: skill.interviewFocus,
        question:
          index === 0
            ? `请你完整讲一个最能代表你 ${skill.name} 水平的项目，重点说明背景、你的职责、技术方案和结果。`
            : `继续围绕 ${skill.name}，请说一个你亲自做过关键权衡的场景，以及你为什么这样决策。`,
        targetProject: skill.projectNames[0],
      })),
    };
  }

  const runnable = model.withStructuredOutput(questionPlanSchema);
  const prompt = `
你要扮演技术面试官。请基于候选人技能和简历总结，输出 5 个多轮面试问题。
要求：
1. 问题覆盖技术深度、项目真实性、沟通与协作。
2. 每个问题要点名一个技能。
3. 问题必须能追问到“为什么这样做”和“结果如何”。

简历总结：
${state.summary}

技能：
${JSON.stringify(state.skills, null, 2)}
  `.trim();

  const result = await runnable.invoke(prompt);
  return {
    questions: result.questions.slice(0, 5).map((item) => ({
      id: createId(),
      skill: item.skill,
      focus: item.focus,
      question: item.question,
      targetProject: item.targetProject,
    })),
  };
}

const interviewQuestionGraph = new StateGraph(QuestionState)
  .addNode("build_questions", buildQuestionPlan)
  .addEdge(START, "build_questions")
  .addEdge("build_questions", END)
  .compile();

export async function generateInterviewPlan(skills: SkillProfile[], analysis: AnalysisRun): Promise<InterviewState> {
  try {
    const result = await interviewQuestionGraph.invoke({
      skills,
      summary: analysis.summary.headline,
    });

    return {
      questions: result.questions,
      assessments: [],
    };
  } catch (e) {
    console.log(e)
    return {
      questions: skills.slice(0, 5).map((skill, index) => ({
        id: createId(),
        skill: skill.name,
        focus: skill.interviewFocus,
        question:
          index === 0
            ? `请你从头到尾讲一个最能证明你 ${skill.name} 能力的项目。`
            : `在 ${skill.name} 相关工作里，你遇到过最难的问题是什么？你怎么处理的？`,
        targetProject: skill.projectNames[0],
      })),
      assessments: [],
    };
  }
}

export async function assessInterviewAnswer(input: {
  question: InterviewQuestion;
  answer: string;
  analysisHeadline: string;
}): Promise<InterviewAssessment> {
  const model = getChatModel();
  if (!model) {
    return {
      questionId: input.question.id,
      skill: input.question.skill,
      score: clampScore(58 + Math.min(input.answer.length, 600) / 15),
      strengths: ["回答覆盖了背景与动作。", "能看出一定项目参与度。"],
      risks: ["量化结果仍然不足。", "缺少更具体的权衡依据。"],
      followUpSignal: `继续追问 ${input.question.skill} 中的细节和指标变化。`,
    };
  }

  try {
    const runnable = model.withStructuredOutput(answerAssessmentSchema);
    const prompt = `
你是一名严格但专业的技术面试官。请评估下面这道题的回答质量。
候选人简历概述：${input.analysisHeadline}
问题：${input.question.question}
回答：${input.answer}

要求：
1. score 是 0-100。
2. strengths / risks 用中文短句。
3. followUpSignal 给出下一轮追问方向。
    `.trim();

    const result = await runnable.invoke(prompt);
    return {
      questionId: input.question.id,
      skill: input.question.skill,
      score: result.score,
      strengths: result.strengths,
      risks: result.risks,
      followUpSignal: result.followUpSignal,
    };
  } catch {
    return {
      questionId: input.question.id,
      skill: input.question.skill,
      score: clampScore(60 + Math.min(input.answer.length, 500) / 16),
      strengths: ["回答给出了项目情境。"],
      risks: ["尚未充分证明个人主导程度。"],
      followUpSignal: "继续追问你的个人贡献、方案取舍和结果复盘。",
    };
  }
}

export async function finalizeScorecard(input: {
  analysis: AnalysisRun;
  assessments: InterviewAssessment[];
}): Promise<Scorecard> {
  const model = getChatModel();
  const average = input.assessments.length
    ? input.assessments.reduce((sum, item) => sum + item.score, 0) / input.assessments.length
    : input.analysis.baselineScore;

  if (!model) {
    const technicalScore = clampScore(average);
    const projectScore = clampScore(input.analysis.summary.projectAlignment * 0.7 + average * 0.3);
    const communicationScore = clampScore(average - 6);
    const behavioralScore = clampScore(average - 3);
    const totalScore = clampScore(
      technicalScore * 0.4 + projectScore * 0.25 + communicationScore * 0.2 + behavioralScore * 0.15,
    );

    return {
      totalScore,
      technicalScore,
      projectScore,
      communicationScore,
      behavioralScore,
      rationale: [
        "## Interview Scorecard",
        `- 技术深度：${technicalScore}`,
        `- 项目支撑：${projectScore}`,
        `- 表达沟通：${communicationScore}`,
        `- 软素质：${behavioralScore}`,
        "- 结论：候选人具备不错的项目参与度，但高分仍依赖更强的量化复盘和更稳定的表达结构。",
      ].join("\n"),
    };
  }

  try {
    const runnable = model.withStructuredOutput(scorecardSchema);
    const prompt = `
请根据简历基线分析和面试题得分，给出最终面试评分。
简历基线：
${JSON.stringify(input.analysis.summary, null, 2)}

答题评估：
${JSON.stringify(input.assessments, null, 2)}

要求：
1. 分数全部为 0-100。
2. rationale 使用 markdown，给出结论和重点证据。
    `.trim();

    return await runnable.invoke(prompt);
  } catch {
    return {
      totalScore: clampScore(average),
      technicalScore: clampScore(average + 2),
      projectScore: clampScore(average - 1),
      communicationScore: clampScore(average - 4),
      behavioralScore: clampScore(average - 2),
      rationale: "## Interview Scorecard\n- 模型生成失败，已回退到规则化评分。\n- 建议继续补强项目量化结果与表达结构。",
    };
  }
}
