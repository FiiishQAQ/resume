import type { PageTextResult } from "pdf-parse";

import { splitIntoParagraphs } from "@/lib/utils";

export function pagesToSegments(pages: PageTextResult[]) {
  return pages.flatMap((page) =>
    splitIntoParagraphs(page.text).map((content, index) => ({
      pageNumber: page.num,
      sectionLabel: inferSectionLabel(content, index),
      content,
    })),
  );
}

export function textToSegments(rawText: string) {
  return splitIntoParagraphs(rawText).map((content, index) => ({
    pageNumber: 1,
    sectionLabel: inferSectionLabel(content, index),
    content,
  }));
}

function inferSectionLabel(content: string, index: number) {
  if (/技能|skills/i.test(content)) {
    return "Skills";
  }

  if (/项目|project|experience/i.test(content)) {
    return "Projects";
  }

  if (/教育|education/i.test(content)) {
    return "Education";
  }

  return index === 0 ? "Summary" : "General";
}
