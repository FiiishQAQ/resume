import type { AnalysisResult, AnalysisSummary, SegmentRecord, SkillProfile, SuggestionPayload } from "@/lib/types";
import { clampScore, excerpt } from "@/lib/utils";

const knownSkills: Array<{ name: string; category: string; keywords: string[] }> = [
  { name: "Next.js", category: "Frontend", keywords: ["next.js", "nextjs", "app router"] },
  { name: "React", category: "Frontend", keywords: ["react", "hooks", "jsx"] },
  { name: "TypeScript", category: "Language", keywords: ["typescript", "ts", "类型"] },
  { name: "Node.js", category: "Backend", keywords: ["node", "node.js", "express", "nest"] },
  { name: "LangGraph", category: "AI Engineering", keywords: ["langgraph", "agent", "workflow"] },
  { name: "LangChain", category: "AI Engineering", keywords: ["langchain", "retrieval", "prompt"] },
  { name: "SQL", category: "Data", keywords: ["sql", "mysql", "postgres", "sqlite"] },
  { name: "Python", category: "Language", keywords: ["python", "fastapi", "pandas"] },
  { name: "LLM", category: "AI Engineering", keywords: ["llm", "gpt", "rag", "embedding"] },
  { name: "Product Thinking", category: "Soft Skill", keywords: ["增长", "转化", "产品", "业务"] },
];

function deriveProjects(segments: SegmentRecord[]) {
  return segments
    .filter((segment) => /项目|experience|project/i.test(segment.sectionLabel) || /项目|系统|平台|产品/i.test(segment.content))
    .slice(0, 4)
    .map((segment) => excerpt(segment.content, 80));
}

export function mockResumeAnalysis(resumeText: string, segments: SegmentRecord[]): AnalysisResult {
  const lowered = resumeText.toLowerCase();
  const projects = deriveProjects(segments);

  const skills: SkillProfile[] = knownSkills
    .filter((skill) => skill.keywords.some((keyword) => lowered.includes(keyword)))
    .slice(0, 8)
    .map((skill, index) => ({
      name: skill.name,
      category: skill.category,
      level: index < 2 ? "advanced" : index < 5 ? "working" : "foundation",
      evidence: excerpt(segments[index]?.content || resumeText, 120),
      projectNames: projects.slice(0, Math.max(1, Math.min(projects.length, 2))),
      confidence: 0.6 + Math.max(0, (6 - index) * 0.05),
      interviewFocus: `验证 ${skill.name} 是否真的在项目中承担了关键设计或落地职责。`,
    }));

  const paddedSkills: SkillProfile[] =
    skills.length > 0
      ? skills
      : [
          {
            name: "通用工程能力",
            category: "Engineering",
            level: "working",
            evidence: excerpt(resumeText, 120),
            projectNames: projects,
            confidence: 0.55,
            interviewFocus: "追问项目中的关键决策、权衡和指标结果。",
          },
        ];

  const summary: AnalysisSummary = {
    headline: "当前简历具备一定技术覆盖，但项目支撑和量化表达仍需要加强。",
    strengths: [
      "简历里已经出现明确的技术关键词，便于快速建立技术画像。",
      "存在项目经历片段，可作为面试深挖的入口。",
      "如果继续补齐量化结果，整体可信度会明显提升。",
    ],
    weaknesses: [
      "部分技能缺少对应项目证据，容易被面试官判定为关键词堆砌。",
      "项目结果和业务影响表达偏弱，难支撑更高评分。",
      "软素质能力更多停留在暗示层，没有形成清晰故事线。",
    ],
    opportunities: [
      "把技能和项目职责一一绑定，突出你真正主导的部分。",
      "补充技术决策、性能优化、指标提升等结果描述。",
      "提前准备项目追问的因果链回答，减少面试中的停顿。",
    ],
    interviewPlan: paddedSkills.map((skill) => `${skill.name}: ${skill.interviewFocus}`),
    skillCoverage: clampScore(paddedSkills.length * 11, 30, 92),
    projectAlignment: clampScore(projects.length * 18, 25, 90),
  };

  return {
    baselineScore: clampScore((summary.skillCoverage + summary.projectAlignment) / 2 + 4),
    summary,
    skills: paddedSkills,
  };
}

export function mockImprovementPayload(resumeText: string, analysis: AnalysisResult): SuggestionPayload {
  return {
    overview: "先把“做过什么”改成“为什么做、你负责什么、结果如何”。这会同时提升简历辨识度和模拟面试得分。",
    suggestions: analysis.skills.slice(0, 4).map((skill, index) => ({
      title: `强化 ${skill.name} 的项目支撑`,
      problem: `当前对 ${skill.name} 的描述更像标签，缺少可验证的职责和结果。`,
      recommendation:
        index === 0
          ? "补充你在项目中的角色、关键方案、取舍依据和量化结果。"
          : "把该技能放到具体项目 bullet 中，用“场景-动作-结果”结构重写。",
      resumeEvidence: skill.evidence,
      interviewerAngle: `把面试官引向你最熟悉的 ${skill.name} 场景，例如：为什么选这个方案、上线后指标怎么变化。`,
    })),
  };
}
