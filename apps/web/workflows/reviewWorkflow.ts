import type { Finding, ReviewResult } from "@gitpreflight/core";
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
  promptAppend?: string;
};

export type ReviewWorkflowOutput = {
  status: "PASS" | "FAIL" | "UNCHECKED";
  findings: Finding[];
  modelRuns?: Array<{ model: string; ok: boolean; latencyMs?: number; findingsCount: number }>;
};

export async function reviewWorkflow(input: ReviewWorkflowInput): Promise<ReviewWorkflowOutput> {
  "use workflow";

  // v0 scaffold: one model for free tier, three models for paid tier.
  const specs: ModelSpec[] = input.planTier === "paid" ? defaultPaidTierModels() : [defaultFreeTierModel()];

  const prompt =
    "Return ONLY JSON with shape: {\"findings\":[{\"path\":string,\"severity\":\"note\"|\"minor\"|\"major\",\"title\":string,\"message\":string,\"line\"?:number,\"suggestion\"?:string}]}\n\n" +
    (input.promptAppend && input.promptAppend.trim().length > 0
      ? `Additional instructions (append-only):\n${input.promptAppend.trim()}\n\n`
      : "") +
    "Staged patch:\n" +
    input.stagedPatch;

  const perModel: Array<{ model: string; ok: boolean; latencyMs?: number; findings: Finding[] }> = [];

  for (const spec of specs) {
    // Keep this workflow alive even in local dev with no API keys.
    try {
      const t0 = Date.now();
      const { text } = await runText({ spec, prompt, temperature: 0.2, maxTokens: 1200 });
      const latencyMs = Date.now() - t0;
      const model = `${spec.provider}/${spec.model}`;
      const findings = normalizeModelOutputToFindings(model, text);
      perModel.push({ model, ok: true, latencyMs, findings });
    } catch {
      // Local/dev without keys: treat as unchecked and allow the API route to decide.
      const model = `${spec.provider}/${spec.model}`;
      perModel.push({
        model,
        ok: false,
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

  const findings = mergeFindings(perModel.map((m) => ({ modelName: m.model, findings: m.findings })));
  const status: ReviewResult["status"] = findings.some((f) => f.severity !== "note") ? "FAIL" : "PASS";
  return {
    status,
    findings,
    modelRuns: perModel.map((m) => ({
      model: m.model,
      ok: m.ok,
      latencyMs: m.latencyMs,
      findingsCount: m.findings.length
    }))
  };
}
