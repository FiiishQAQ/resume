import "server-only";

import { ChatOpenAI } from "@langchain/openai";

export function getChatModel() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    timeout: 60_000,
    modelKwargs: {
      extraBody: {
          thinking: { type: 'disabled' }
      },
      thinking: { type: 'disabled' },
      enable_thinking: false
    }
  });
}
