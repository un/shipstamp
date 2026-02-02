import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export type ProviderId = "openai" | "anthropic" | "google";

export type ModelSpec = {
  provider: ProviderId;
  model: string;
};

export function defaultFreeTierModel(): ModelSpec {
  return { provider: "openai", model: "gpt-5" };
}

export function defaultPaidTierModels(): ModelSpec[] {
  return [
    { provider: "openai", model: "gpt-5" },
    { provider: "anthropic", model: "claude-3-7-sonnet-20250219" },
    { provider: "google", model: "gemini-2.5-pro" }
  ];
}

export function toAiSdkModel(spec: ModelSpec) {
  if (spec.provider === "openai") return openai(spec.model);
  if (spec.provider === "anthropic") return anthropic(spec.model);
  return google(spec.model);
}
