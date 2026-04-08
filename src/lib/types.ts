export type SegmentRecord = {
  id: string;
  resumeVersionId: string;
  pageNumber: number;
  sectionLabel: string;
  content: string;
};

export type SkillProfile = {
  id?: string;
  name: string;
  category: string;
  level: "foundation" | "working" | "advanced" | "expert";
  evidence: string;
  projectNames: string[];
  confidence: number;
  interviewFocus: string;
};

export type AnalysisSummary = {
  headline: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  interviewPlan: string[];
  skillCoverage: number;
  projectAlignment: number;
};

export type AnalysisResult = {
  baselineScore: number;
  summary: AnalysisSummary;
  skills: SkillProfile[];
};

export type InterviewQuestion = {
  id: string;
  skill: string;
  focus: string;
  question: string;
  targetProject?: string;
};

export type InterviewAssessment = {
  questionId: string;
  skill: string;
  score: number;
  strengths: string[];
  risks: string[];
  followUpSignal: string;
};

export type InterviewState = {
  questions: InterviewQuestion[];
  assessments: InterviewAssessment[];
};

export type Scorecard = {
  totalScore: number;
  technicalScore: number;
  projectScore: number;
  communicationScore: number;
  behavioralScore: number;
  rationale: string;
};

export type SuggestionItem = {
  title: string;
  problem: string;
  recommendation: string;
  resumeEvidence: string;
  interviewerAngle: string;
};

export type SuggestionPayload = {
  overview: string;
  suggestions: SuggestionItem[];
};

export type ResumeVersion = {
  id: string;
  sourceKind: "pdf" | "editor";
  fileName: string | null;
  rawText: string;
  createdAt: string;
  parentVersionId: string | null;
};

export type AnalysisRun = {
  id: string;
  resumeVersionId: string;
  status: string;
  baselineScore: number;
  summary: AnalysisSummary;
  strengthsMarkdown: string;
  weaknessesMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

export type InterviewSession = {
  id: string;
  resumeVersionId: string;
  analysisRunId: string;
  status: "queued" | "active" | "completed";
  currentQuestionIndex: number;
  coverage: InterviewState;
  createdAt: string;
  updatedAt: string;
};

export type InterviewMessage = {
  id: string;
  sessionId: string;
  role: "assistant" | "user" | "system";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ImprovementRecord = {
  id: string;
  resumeVersionId: string;
  analysisRunId: string;
  sessionId: string | null;
  overview: string;
  suggestions: SuggestionItem[];
  rewrittenResume: string | null;
  createdAt: string;
};

export type EvolutionSnapshot = {
  id: string;
  resumeVersionId: string;
  analysisRunId: string;
  sessionId: string | null;
  totalScore: number;
  baselineScore: number;
  skillCoverage: number;
  projectAlignment: number;
  communicationScore: number;
  createdAt: string;
};

export type DashboardState = {
  hasApiKey: boolean;
  latestVersion: ResumeVersion | null;
  latestAnalysis: AnalysisRun | null;
  latestSkills: SkillProfile[];
  latestSegments: SegmentRecord[];
  latestSession: InterviewSession | null;
  latestMessages: InterviewMessage[];
  latestScorecard: Scorecard | null;
  latestImprovement: ImprovementRecord | null;
  evolution: EvolutionSnapshot[];
};
