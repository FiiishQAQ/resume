import "server-only";

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = join(process.cwd(), "data");
const dbPath = join(dataDir, "resume-lab.sqlite");

mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS resume_versions (
    id TEXT PRIMARY KEY,
    source_kind TEXT NOT NULL,
    file_name TEXT,
    raw_text TEXT NOT NULL,
    parent_version_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resume_segments (
    id TEXT PRIMARY KEY,
    resume_version_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    section_label TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    resume_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    baseline_score INTEGER NOT NULL,
    summary_json TEXT NOT NULL,
    strengths_markdown TEXT NOT NULL,
    weaknesses_markdown TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS skill_profiles (
    id TEXT PRIMARY KEY,
    analysis_run_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL,
    evidence TEXT NOT NULL,
    project_names_json TEXT NOT NULL,
    confidence REAL NOT NULL,
    interview_focus TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY,
    resume_version_id TEXT NOT NULL,
    analysis_run_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_question_index INTEGER NOT NULL,
    coverage_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interview_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scorecards (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    total_score INTEGER NOT NULL,
    technical_score INTEGER NOT NULL,
    project_score INTEGER NOT NULL,
    communication_score INTEGER NOT NULL,
    behavioral_score INTEGER NOT NULL,
    rationale_markdown TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS improvement_suggestions (
    id TEXT PRIMARY KEY,
    resume_version_id TEXT NOT NULL,
    analysis_run_id TEXT NOT NULL,
    session_id TEXT,
    overview TEXT NOT NULL,
    suggestions_json TEXT NOT NULL,
    rewritten_resume TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS evolution_snapshots (
    id TEXT PRIMARY KEY,
    resume_version_id TEXT NOT NULL,
    analysis_run_id TEXT NOT NULL,
    session_id TEXT,
    total_score INTEGER NOT NULL,
    baseline_score INTEGER NOT NULL,
    skill_coverage REAL NOT NULL,
    project_alignment REAL NOT NULL,
    communication_score REAL NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE SET NULL
  );
`);
