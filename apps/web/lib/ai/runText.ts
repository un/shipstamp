import { generateText } from "ai";

import { toAiSdkModel, type ModelSpec } from "./providers";

export type RunTextInput = {
  spec: ModelSpec;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

export type RunTextResult = {
  text: string;
};

export async function runText(input: RunTextInput): Promise<RunTextResult> {
  const model = toAiSdkModel(input.spec);
  const { text } = await generateText({
    model,
    prompt: input.prompt,
    ...(typeof input.maxTokens === "number" ? { maxOutputTokens: input.maxTokens } : {}),
    temperature: input.temperature
  });
  return { text };
}
