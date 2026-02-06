import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultLocalAgentCommand, getLocalAgentConfig, saveLocalAgentConfig } from "../src/cliConfig";
import { probeLocalAgentCommand } from "../src/localAgent";

let prevXdg: string | undefined;
let tempXdg = "";

beforeEach(() => {
  prevXdg = process.env.XDG_CONFIG_HOME;
  tempXdg = mkdtempSync(join(tmpdir(), "gitpreflight-local-agent-"));
  process.env.XDG_CONFIG_HOME = tempXdg;
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  rmSync(tempXdg, { recursive: true, force: true });
});

describe("local-agent config", () => {
  it("saves and loads local-agent command from config file", () => {
    saveLocalAgentConfig({ provider: "opencode", command: "opencode run" });

    const loaded = getLocalAgentConfig();
    expect(loaded).toEqual({ provider: "opencode", command: "opencode run" });

    const raw = readFileSync(join(tempXdg, "gitpreflight", "config.json"), "utf8");
    expect(raw).toContain("\"localAgent\"");
    expect(raw).toContain("\"command\": \"opencode run\"");
  });

  it("maps provider defaults", () => {
    expect(getDefaultLocalAgentCommand("codex")).toBe("codex");
    expect(getDefaultLocalAgentCommand("claude")).toBe("claude");
    expect(getDefaultLocalAgentCommand("opencode")).toBe("opencode run");
  });
});

describe("local-agent probe", () => {
  it("passes when command exits zero and writes output", () => {
    const result = probeLocalAgentCommand({
      command: `node -e "process.stdin.on('data',()=>{}); process.stdout.write('alive\\n')"`,
      cwd: process.cwd(),
      timeoutMs: 5_000
    });
    expect(result.ok).toBeTrue();
  });

  it("fails when command writes no output", () => {
    const result = probeLocalAgentCommand({
      command: `node -e "process.stdin.on('data',()=>{}); process.exit(0)"`,
      cwd: process.cwd(),
      timeoutMs: 5_000
    });
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe("empty_output");
  });
});
