import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureGitPreflightConfigDir, getGitPreflightConfigDir, migrateLegacyMacConfigIfNeeded } from "./configPaths";

export type LocalAgentProvider = "codex" | "claude" | "opencode";

export type CliConfig = {
  localAgent?: {
    provider: LocalAgentProvider;
    command: string;
  };
};

const CLI_CONFIG_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "GitPreflight CLI Config",
  type: "object",
  additionalProperties: true,
  properties: {
    localAgent: {
      type: "object",
      additionalProperties: false,
      required: ["provider", "command"],
      properties: {
        provider: {
          type: "string",
          enum: ["codex", "claude", "opencode"]
        },
        command: {
          type: "string",
          minLength: 1
        }
      }
    }
  }
} as const;

function configPath() {
  return join(getGitPreflightConfigDir(), "config.json");
}

function configSchemaPath() {
  return join(getGitPreflightConfigDir(), "config.schema.json");
}

function isProvider(v: unknown): v is LocalAgentProvider {
  return v === "codex" || v === "claude" || v === "opencode";
}

function parseCliConfig(raw: unknown): CliConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as any;
  if (!parsed.localAgent) return {};
  const provider = parsed.localAgent.provider;
  const command = parsed.localAgent.command;
  if (!isProvider(provider)) return null;
  if (typeof command !== "string" || command.trim().length === 0) return null;
  return {
    localAgent: {
      provider,
      command
    }
  };
}

function writeSchemaFile() {
  writeFileSync(configSchemaPath(), `${JSON.stringify(CLI_CONFIG_SCHEMA, null, 2)}\n`, "utf8");
}

export function loadCliConfig(): CliConfig | null {
  migrateLegacyMacConfigIfNeeded();
  try {
    return parseCliConfig(JSON.parse(readFileSync(configPath(), "utf8")));
  } catch {
    return null;
  }
}

export function getLocalAgentConfig(): { provider: LocalAgentProvider; command: string } | null {
  const loaded = loadCliConfig();
  if (!loaded?.localAgent) return null;
  return loaded.localAgent;
}

export function saveLocalAgentConfig(input: { provider: LocalAgentProvider; command: string }) {
  ensureGitPreflightConfigDir();

  let existing: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(readFileSync(configPath(), "utf8"));
    if (parsed && typeof parsed === "object") existing = parsed as Record<string, unknown>;
  } catch {
    existing = {};
  }

  const next: CliConfig & Record<string, unknown> = {
    ...existing,
    localAgent: {
      provider: input.provider,
      command: input.command
    }
  };

  writeFileSync(configPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  writeSchemaFile();

  try {
    chmodSync(configPath(), 0o600);
  } catch {
    // best-effort
  }
}

export function getDefaultLocalAgentCommand(provider: LocalAgentProvider): string {
  if (provider === "codex") return "codex";
  if (provider === "claude") return "claude";
  return "opencode run";
}
