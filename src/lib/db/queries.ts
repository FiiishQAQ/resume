import "server-only";

import { db } from "@/lib/db/database";
import type {
  AnalysisResult,
  AnalysisRun,
  DashboardState,
  EvolutionSnapshot,
  ImprovementRecord,
  InterviewMessage,
  InterviewSession,
  InterviewState,
  ResumeVersion,
  Scorecard,
  SegmentRecord,
  SkillProfile,
  SuggestionPayload,
} from "@/lib/types";
import { createId, nowIso, safeJsonParse, textToMarkdownList } from "@/lib/utils";

type Row = Record<string, unknown>;

function latest<T extends Row>(sql: string, ...params: unknown[]) {
  const row = db.prepare(sql).get(...params) as T | undefined;
  return row ?? null;
}

function all<T extends Row>(sql: string, ...params: unknown[]) {
  return (db.prepare(sql).all(...params) as T[]) ?? [];
}

function mapResumeVersion(row: Row | null): ResumeVersion | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    sourceKind: String(row.source_kind) as ResumeVersion["sourceKind"],
    fileName: row.file_name ? String(row.file_name) : null,
    rawText: String(row.raw_text),
    createdAt: String(row.created_at),
    parentVersionId: row.parent_version_id ? String(row.parent_version_id) : null,
  };
}

function mapAnalysisRun(row: Row | null): AnalysisRun | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    resumeVersionId: String(row.resume_version_id),
    status: String(row.status),
    baselineScore: Number(row.baseline_score),
    summary: safeJsonParse(String(row.summary_json), {
      headline: "",
      strengths: [],
      weaknesses: [],
      opportunities: [],
      interviewPlan: [],
      skillCoverage: 0,
      projectAlignment: 0,
    }),
    strengthsMarkdown: String(row.strengths_markdown),
    weaknessesMarkdown: String(row.weaknesses_markdown),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSkillProfiles(rows: Row[]): SkillProfile[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    level: String(row.level) as SkillProfile["level"],
    evidence: String(row.evidence),
    projectNames: safeJsonParse(String(row.project_names_json), []),
    confidence: Number(row.confidence),
    interviewFocus: String(row.interview_focus),
  }));
}

function mapSegments(rows: Row[]): SegmentRecord[] {
  return rows.map((row) => ({
    id: String(row.id),
    resumeVersionId: String(row.resume_version_id),
    pageNumber: Number(row.page_number),
    sectionLabel: String(row.section_label),
    content: String(row.content),
  }));
}

function mapSession(row: Row | null): InterviewSession | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    resumeVersionId: String(row.resume_version_id),
    analysisRunId: String(row.analysis_run_id),
    status: String(row.status) as InterviewSession["status"],
    currentQuestionIndex: Number(row.current_question_index),
    coverage: safeJsonParse<InterviewState>(String(row.coverage_json), {
      questions: [],
      assessments: [],
    }),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMessages(rows: Row[]): InterviewMessage[] {
  return rows.map((row) => ({
    id: String(row.id),
    sessionId: String(row.session_id),
    role: String(row.role) as InterviewMessage["role"],
    content: String(row.content),
    metadata: safeJsonParse(String(row.metadata_json), {}),
    createdAt: String(row.created_at),
  }));
}

function mapScorecard(row: Row | null): Scorecard | null {
  if (!row) {
    return null;
  }

  return {
    totalScore: Number(row.total_score),
    technicalScore: Number(row.technical_score),
    projectScore: Number(row.project_score),
    communicationScore: Number(row.communication_score),
    behavioralScore: Number(row.behavioral_score),
    rationale: String(row.rationale_markdown),
  };
}

function mapImprovement(row: Row | null): ImprovementRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    resumeVersionId: String(row.resume_version_id),
    analysisRunId: String(row.analysis_run_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    overview: String(row.overview),
    suggestions: safeJsonParse<SuggestionPayload["suggestions"]>(String(row.suggestions_json), []),
    rewrittenResume: row.rewritten_resume ? String(row.rewritten_resume) : null,
    createdAt: String(row.created_at),
  };
}

function mapEvolution(rows: Row[]): EvolutionSnapshot[] {
  return rows.map((row) => ({
    id: String(row.id),
    resumeVersionId: String(row.resume_version_id),
    analysisRunId: String(row.analysis_run_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    totalScore: Number(row.total_score),
    baselineScore: Number(row.baseline_score),
    skillCoverage: Number(row.skill_coverage),
    projectAlignment: Number(row.project_alignment),
    communicationScore: Number(row.communication_score),
    createdAt: String(row.created_at),
  }));
}

export function createResumeVersion(input: {
  sourceKind: ResumeVersion["sourceKind"];
  fileName: string | null;
  rawText: string;
  parentVersionId?: string | null;
}) {
  const id = createId();
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO resume_versions (id, source_kind, file_name, raw_text, parent_version_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.sourceKind, input.fileName, input.rawText, input.parentVersionId ?? null, createdAt);

  return { id, createdAt };
}

export function replaceSegments(resumeVersionId: string, segments: Array<Omit<SegmentRecord, "id" | "resumeVersionId">>) {
  db.prepare(`DELETE FROM resume_segments WHERE resume_version_id = ?`).run(resumeVersionId);

  const statement = db.prepare(
    `INSERT INTO resume_segments (id, resume_version_id, page_number, section_label, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const segment of segments) {
    statement.run(createId(), resumeVersionId, segment.pageNumber, segment.sectionLabel, segment.content, nowIso());
  }
}

export function saveAnalysisRun(resumeVersionId: string, result: AnalysisResult) {
  const id = createId();
  const timestamp = nowIso();

  db.prepare(
    `INSERT INTO analysis_runs (
      id, resume_version_id, status, baseline_score, summary_json,
      strengths_markdown, weaknesses_markdown, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    resumeVersionId,
    "completed",
    result.baselineScore,
    JSON.stringify(result.summary),
    textToMarkdownList("Strengths", result.summary.strengths),
    textToMarkdownList("Weaknesses", result.summary.weaknesses),
    timestamp,
    timestamp,
  );

  const statement = db.prepare(
    `INSERT INTO skill_profiles (
      id, analysis_run_id, name, category, level, evidence,
      project_names_json, confidence, interview_focus, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const skill of result.skills) {
    statement.run(
      createId(),
      id,
      skill.name,
      skill.category,
      skill.level,
      skill.evidence,
      JSON.stringify(skill.projectNames),
      skill.confidence,
      skill.interviewFocus,
      timestamp,
    );
  }

  return id;
}

export function saveInterviewSession(input: {
  resumeVersionId: string;
  analysisRunId: string;
  coverage: InterviewState;
  firstQuestion: string;
}) {
  const id = createId();
  const timestamp = nowIso();

  db.prepare(
    `INSERT INTO interview_sessions (
      id, resume_version_id, analysis_run_id, status,
      current_question_index, coverage_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.resumeVersionId, input.analysisRunId, "active", 0, JSON.stringify(input.coverage), timestamp, timestamp);

  db.prepare(
    `INSERT INTO interview_messages (id, session_id, role, content, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(createId(), id, "assistant", input.firstQuestion, JSON.stringify({ kind: "question" }), timestamp);

  return id;
}

export function appendInterviewMessage(
  sessionId: string,
  role: InterviewMessage["role"],
  content: string,
  metadata: Record<string, unknown> = {},
) {
  db.prepare(
    `INSERT INTO interview_messages (id, session_id, role, content, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(createId(), sessionId, role, content, JSON.stringify(metadata), nowIso());
}

export function updateInterviewSession(sessionId: string, update: {
  currentQuestionIndex: number;
  status: InterviewSession["status"];
  coverage: InterviewState;
}) {
  db.prepare(
    `UPDATE interview_sessions
     SET current_question_index = ?, status = ?, coverage_json = ?, updated_at = ?
     WHERE id = ?`,
  ).run(update.currentQuestionIndex, update.status, JSON.stringify(update.coverage), nowIso(), sessionId);
}

export function saveScorecard(sessionId: string, scorecard: Scorecard) {
  db.prepare(
    `INSERT INTO scorecards (
      id, session_id, total_score, technical_score, project_score,
      communication_score, behavioral_score, rationale_markdown, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    createId(),
    sessionId,
    scorecard.totalScore,
    scorecard.technicalScore,
    scorecard.projectScore,
    scorecard.communicationScore,
    scorecard.behavioralScore,
    scorecard.rationale,
    nowIso(),
  );
}

export function saveImprovement(input: {
  resumeVersionId: string;
  analysisRunId: string;
  sessionId?: string | null;
  payload: SuggestionPayload;
  rewrittenResume?: string | null;
}) {
  db.prepare(
    `INSERT INTO improvement_suggestions (
      id, resume_version_id, analysis_run_id, session_id, overview,
      suggestions_json, rewritten_resume, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    createId(),
    input.resumeVersionId,
    input.analysisRunId,
    input.sessionId ?? null,
    input.payload.overview,
    JSON.stringify(input.payload.suggestions),
    input.rewrittenResume ?? null,
    nowIso(),
  );
}

export function saveEvolutionSnapshot(input: {
  resumeVersionId: string;
  analysisRunId: string;
  sessionId?: string | null;
  totalScore: number;
  baselineScore: number;
  skillCoverage: number;
  projectAlignment: number;
  communicationScore: number;
}) {
  db.prepare(
    `INSERT INTO evolution_snapshots (
      id, resume_version_id, analysis_run_id, session_id, total_score,
      baseline_score, skill_coverage, project_alignment, communication_score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    createId(),
    input.resumeVersionId,
    input.analysisRunId,
    input.sessionId ?? null,
    input.totalScore,
    input.baselineScore,
    input.skillCoverage,
    input.projectAlignment,
    input.communicationScore,
    nowIso(),
  );
}

export function getLatestVersion() {
  return mapResumeVersion(latest<Row>(`SELECT * FROM resume_versions ORDER BY created_at DESC LIMIT 1`));
}

export function getSegmentsByVersion(resumeVersionId: string) {
  return mapSegments(all<Row>(`SELECT * FROM resume_segments WHERE resume_version_id = ? ORDER BY page_number ASC, created_at ASC`, resumeVersionId));
}

export function getLatestAnalysisByVersion(resumeVersionId: string) {
  return mapAnalysisRun(latest<Row>(`SELECT * FROM analysis_runs WHERE resume_version_id = ? ORDER BY created_at DESC LIMIT 1`, resumeVersionId));
}

export function getSkillsByAnalysis(analysisRunId: string) {
  return mapSkillProfiles(all<Row>(`SELECT * FROM skill_profiles WHERE analysis_run_id = ? ORDER BY confidence DESC, name ASC`, analysisRunId));
}

export function getLatestSessionByVersion(resumeVersionId: string) {
  return mapSession(latest<Row>(`SELECT * FROM interview_sessions WHERE resume_version_id = ? ORDER BY created_at DESC LIMIT 1`, resumeVersionId));
}

export function getMessagesBySession(sessionId: string) {
  return mapMessages(all<Row>(`SELECT * FROM interview_messages WHERE session_id = ? ORDER BY created_at ASC`, sessionId));
}

export function getScorecardBySession(sessionId: string) {
  return mapScorecard(latest<Row>(`SELECT * FROM scorecards WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`, sessionId));
}

export function getLatestImprovementByVersion(resumeVersionId: string) {
  return mapImprovement(latest<Row>(`SELECT * FROM improvement_suggestions WHERE resume_version_id = ? ORDER BY created_at DESC LIMIT 1`, resumeVersionId));
}

export function getEvolutionSnapshots() {
  return mapEvolution(all<Row>(`SELECT * FROM evolution_snapshots ORDER BY created_at ASC`));
}

export function getDashboardState(): DashboardState {
  const latestVersion = getLatestVersion();

  if (!latestVersion) {
    return {
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
      latestVersion: null,
      latestAnalysis: null,
      latestSkills: [],
      latestSegments: [],
      latestSession: null,
      latestMessages: [],
      latestScorecard: null,
      latestImprovement: null,
      evolution: [],
    };
  }

  const latestAnalysis = getLatestAnalysisByVersion(latestVersion.id);
  const latestSkills = latestAnalysis ? getSkillsByAnalysis(latestAnalysis.id) : [];
  const latestSegments = getSegmentsByVersion(latestVersion.id);
  const latestSession = getLatestSessionByVersion(latestVersion.id);
  const latestMessages = latestSession ? getMessagesBySession(latestSession.id) : [];
  const latestScorecard = latestSession ? getScorecardBySession(latestSession.id) : null;
  const latestImprovement = getLatestImprovementByVersion(latestVersion.id);
  const evolution = getEvolutionSnapshots();

  return {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    latestVersion,
    latestAnalysis,
    latestSkills,
    latestSegments,
    latestSession,
    latestMessages,
    latestScorecard,
    latestImprovement,
    evolution,
  };
}
