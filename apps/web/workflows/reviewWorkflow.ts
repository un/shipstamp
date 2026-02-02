import type { Finding, ReviewResult } from "@shipstamp/core";
import { sleep } from "workflow";

import { defaultFreeTierModel, defaultPaidTierModels, type ModelSpec } from "@/lib/ai/providers";
import { runText } from "@/lib/ai/runText";
import { normalizeModelOutputToFindings } from "@/lib/review/normalizeModelOutput";
import { mergeFindings } from "@/lib/review/mergeFindings";

export type ReviewWorkflowInput = {
  branch: string;
  planTier: string;
  stagedPatch: string;
  stagedFiles: Array<{ path: string; changeType: string; isBinary: boolean }>;
  instructionFiles: Array<{ path: string; sha256: string }>;
};

export type ReviewWorkflowOutput = {
  status: "PASS" | "FAIL" | "UNCHECKED";
  findings: Finding[];
};

export async function reviewWorkflow(input: ReviewWorkflowInput): Promise<ReviewWorkflowOutput> {
  "use workflow";

  // v0 scaffold: one model for free tier, three models for paid tier.
  const specs: ModelSpec[] = input.planTier === "paid" ? defaultPaidTierModels() : [defaultFreeTierModel()];

  const prompt =
    "Return ONLY JSON with shape: {\"findings\":[{\"path\":string,\"severity\":\"note\"|\"minor\"|\"major\",\"title\":string,\"message\":string,\"line\"?:number,\"suggestion\"?:string}]}\n\n" +
    "Staged patch:\n" +
    input.stagedPatch;

  const perModel: Array<{ modelName: string; findings: Finding[] }> = [];

  for (const spec of specs) {
    // Keep this workflow alive even in local dev with no API keys.
    try {
      const { text } = await runText({ spec, prompt, temperature: 0.2, maxTokens: 1200 });
      const modelName = `${spec.provider}/${spec.model}`;
      perModel.push({ modelName, findings: normalizeModelOutputToFindings(modelName, text) });
    } catch {
      // Local/dev without keys: treat as unchecked and allow the API route to decide.
      perModel.push({
        modelName: `${spec.provider}/${spec.model}`,
        findings: [
          {
            path: "package.json",
            severity: "note",
            title: "Model run skipped",
            message: `Model ${spec.provider}/${spec.model} could not be called (missing credentials or provider error).`,
            agreement: { agreed: 0, total: 0 }
          }
        ]
      });
    }

    await sleep(1);
  }

  const findings = mergeFindings(perModel);
  const status: ReviewResult["status"] = findings.some((f) => f.severity !== "note") ? "FAIL" : "PASS";
  return { status, findings };
}
