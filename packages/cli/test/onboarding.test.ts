import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markOnboardingNoticeShown, shouldShowOnboardingNotice } from "../src/onboarding";
import type { InstallStatus } from "../src/scopedInstall";

function makeStatus(effectiveScope: InstallStatus["effectiveScope"]): InstallStatus {
  return {
    global: { installed: false, hooksPath: null, managedHooksPath: "/tmp/hooks" },
    local: { installed: false, hooksPath: null, managedHooksPath: null },
    repo: { installed: false },
    effectiveScope
  };
}

let tempXdg = "";
let prevXdg: string | undefined;

beforeEach(() => {
  prevXdg = process.env.XDG_CONFIG_HOME;
  tempXdg = mkdtempSync(join(tmpdir(), "gitpreflight-test-"));
  process.env.XDG_CONFIG_HOME = tempXdg;
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  rmSync(tempXdg, { recursive: true, force: true });
});

describe("shouldShowOnboardingNotice", () => {
  it("shows notice for normal command when unconfigured", () => {
    const show = shouldShowOnboardingNotice({
      cmd: "review",
      inCi: false,
      inHook: false,
      status: makeStatus(null)
    });
    expect(show).toBeTrue();
  });

  it("does not show when already configured", () => {
    const show = shouldShowOnboardingNotice({
      cmd: "review",
      inCi: false,
      inHook: false,
      status: makeStatus("local")
    });
    expect(show).toBeFalse();
  });

  it("does not show in hook/ci or quiet commands", () => {
    expect(
      shouldShowOnboardingNotice({
        cmd: "review",
        inCi: true,
        inHook: false,
        status: makeStatus(null)
      })
    ).toBeFalse();

    expect(
      shouldShowOnboardingNotice({
        cmd: "review",
        inCi: false,
        inHook: true,
        status: makeStatus(null)
      })
    ).toBeFalse();

    expect(
      shouldShowOnboardingNotice({
        cmd: "install",
        inCi: false,
        inHook: false,
        status: makeStatus(null)
      })
    ).toBeFalse();
  });

  it("does not show after marker is written", () => {
    markOnboardingNoticeShown();
    const show = shouldShowOnboardingNotice({
      cmd: "review",
      inCi: false,
      inHook: false,
      status: makeStatus(null)
    });
    expect(show).toBeFalse();
  });
});
