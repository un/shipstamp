import type { Finding } from "@gitpreflight/core";

import { ModelOutputSchema } from "./modelSchemas";

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function normalizeModelOutputToFindings(modelName: string, rawText: string): Finding[] {
  const json = extractJsonObject(rawText);
  if (!json) {
    return [
      {
        path: "package.json",
        severity: "major",
        title: "Model output invalid",
        message: `Model ${modelName} did not return JSON.`,
        agreement: { agreed: 0, total: 0 }
      }
    ];
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch {
    return [
      {
        path: "package.json",
        severity: "major",
        title: "Model output invalid",
        message: `Model ${modelName} returned invalid JSON.`,
        agreement: { agreed: 0, total: 0 }
      }
    ];
  }

  const validated = ModelOutputSchema.safeParse(parsedJson);
  if (!validated.success) {
    return [
      {
        path: "package.json",
        severity: "major",
        title: "Model output invalid",
        message: `Model ${modelName} returned JSON that did not match the expected schema.`,
        agreement: { agreed: 0, total: 0 }
      }
    ];
  }

  return validated.data.findings.map((f) => ({
    path: f.path,
    severity: f.severity,
    title: f.title,
    message: f.message,
    line: f.line,
    hunk: f.hunk,
    suggestion: f.suggestion,
    agreement: { agreed: 0, total: 0 }
  }));
}
