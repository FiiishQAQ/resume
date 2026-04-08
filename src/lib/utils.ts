import { randomUUID } from "node:crypto";

export function createId() {
  return randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function textToMarkdownList(title: string, items: string[]) {
  return [`## ${title}`, ...items.map((item) => `- ${item}`)].join("\n");
}

export function splitIntoParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function excerpt(text: string, length = 220) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= length) {
    return trimmed;
  }

  return `${trimmed.slice(0, length - 1)}…`;
}
