import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { getChatModel } from "@/lib/ai/openai";
import { mockResumeAnalysis } from "@/lib/resume/mock";
import type { AnalysisResult, SegmentRecord, SkillProfile } from "@/lib/types";
import { clampScore, excerpt } from "@/lib/utils";

const extractedSchema = z.object({
  candidateHeadline: z.string(),
  projects: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      evidence: z.string(),
    }),
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      level: z.enum(["foundation", "working", "advanced", "expert"]),
      evidence: z.string(),
    }),
  ),
});

const mappedSkillsSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      level: z.enum(["foundation", "working", "advanced", "expert"]),
      evidence: z.string(),
      projectNames: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      interviewFocus: z.string(),
    }),
  ),
});

const summarySchema = z.object({
  headline: z.string(),
  strengths: z.array(z.string()).min(2).max(5),
  weaknesses: z.array(z.string()).min(2).max(5),
  opportunities: z.array(z.string()).min(2).max(5),
  interviewPlan: z.array(z.string()).min(3).max(8),
  skillCoverage: z.number().min(0).max(100),
  projectAlignment: z.number().min(0).max(100),
});

const AnalysisState = Annotation.Root({
  resumeText: Annotation<string>,
  segments: Annotation<SegmentRecord[]>({
    default: () => [],
    reducer: (_current, update) => update,
  }),
  extracted: Annotation<z.infer<typeof extractedSchema> | null>({
    default: () => null,
    reducer: (_current, update) => update,
  }),
  mappedSkills: Annotation<SkillProfile[]>({
    default: () => [],
    reducer: (_current, update) => update,
  }),
  summary: Annotation<z.infer<typeof summarySchema> | null>({
    default: () => null,
    reducer: (_current, update) => update,
  }),
});

async function extractResumeStructure(state: typeof AnalysisState.State) {
  const model = getChatModel();
  if (!model) {
    const mock = mockResumeAnalysis(state.resumeText, state.segments);
    return {
      extracted: {
        candidateHeadline: mock.summary.headline,
        projects: mock.skills.map((skill, index) => ({
          name: skill.projectNames[0] || `Project ${index + 1}`,
          summary: skill.interviewFocus,
          evidence: skill.evidence,
        })),
        skills: mock.skills.map((skill) => ({
          name: skill.name,
          category: skill.category,
          level: skill.level,
          evidence: skill.evidence,
        })),
      },
    };
  }

  const runnable = model.withStructuredOutput(extractedSchema);
  const prompt = `
你是一名技术招聘顾问。请从下面的简历文本中抽取候选人的技能和项目。
要求：
1. 技能必须尽量映射到真实项目证据，不要凭空扩写。
2. level 只能取 foundation / working / advanced / expert。
3. project evidence 尽量保留原文措辞。

简历文本：
${state.resumeText.slice(0, 12000)}
  `.trim();

  const extracted = await runnable.invoke(prompt);
  return { extracted };
}

async function mapSkillsToProjects(state: typeof AnalysisState.State) {
  const model = getChatModel();
  if (!model || !state.extracted) {
    return { mappedSkills: mockResumeAnalysis(state.resumeText, state.segments).skills };
  }

  const runnable = model.withStructuredOutput(mappedSkillsSchema);
  const prompt = `
请把技能和项目经历绑定起来，并给出面试追问方向。

项目：
${JSON.stringify(state.extracted.projects, null, 2)}

技能：
${JSON.stringify(state.extracted.skills, null, 2)}
  `.trim();

  const mapped = await runnable.invoke(prompt);
  return { mappedSkills: mapped.skills };
}

async function summarizeCandidate(state: typeof AnalysisState.State) {
  const model = getChatModel();
  if (!model) {
    return { summary: mockResumeAnalysis(state.resumeText, state.segments).summary };
  }

  const runnable = model.withStructuredOutput(summarySchema);
  const prompt = `
你是一名负责技术面试设计的招聘顾问。基于下列技能和证据，给出候选人的简历基线分析。
要求：
1. strengths / weaknesses / opportunities 全部必须是中文短句。
2. interviewPlan 用于指导后续模拟面试，覆盖技术深度、项目真实性、沟通表达。
3. 分数是 0-100 的整数。

技能清单：
${JSON.stringify(state.mappedSkills, null, 2)}
  `.trim();

  const summary = await runnable.invoke(prompt);
  return { summary };
}

const analysisGraph = new StateGraph(AnalysisState)
  .addNode("extract_resume", extractResumeStructure)
  .addNode("map_skills", mapSkillsToProjects)
  .addNode("summarize", summarizeCandidate)
  .addEdge(START, "extract_resume")
  .addEdge("extract_resume", "map_skills")
  .addEdge("map_skills", "summarize")
  .addEdge("summarize", END)
  .compile();

export async function analyzeResume(resumeText: string, segments: SegmentRecord[]): Promise<AnalysisResult> {
  try {
    const result = await analysisGraph.invoke({
      resumeText,
      segments,
    });

    if (!result.summary || result.mappedSkills.length === 0) {
      return mockResumeAnalysis(resumeText, segments);
    }

    const baselineScore = clampScore(
      result.summary.skillCoverage * 0.42 + result.summary.projectAlignment * 0.38 + result.mappedSkills.length * 2.5,
    );

    return {
      baselineScore,
      summary: result.summary,
      skills: result.mappedSkills.map((skill) => ({
        ...skill,
        evidence: excerpt(skill.evidence, 160),
      })),
    };
  } catch {
    return mockResumeAnalysis(resumeText, segments);
  }
}
