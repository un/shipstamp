import { describe, expect, it } from "bun:test";
import { parsePolicyValue, resolvePolicyFromValues } from "../src/policy";

describe("parsePolicyValue", () => {
  it("parses valid values case-insensitively", () => {
    expect(parsePolicyValue("required")).toBe("required");
    expect(parsePolicyValue("OPTIONAL")).toBe("optional");
    expect(parsePolicyValue(" disabled ")).toBe("disabled");
  });

  it("returns null for invalid values", () => {
    expect(parsePolicyValue(null)).toBeNull();
    expect(parsePolicyValue(undefined)).toBeNull();
    expect(parsePolicyValue("")).toBeNull();
    expect(parsePolicyValue("on")).toBeNull();
  });
});

describe("resolvePolicyFromValues", () => {
  it("prefers repo over local and global", () => {
    const out = resolvePolicyFromValues({
      repoPolicy: "required",
      localPolicy: "disabled",
      globalPolicy: "optional"
    });
    expect(out).toEqual({ policy: "required", source: "repo" });
  });

  it("prefers local over global when no repo policy", () => {
    const out = resolvePolicyFromValues({
      repoPolicy: null,
      localPolicy: "disabled",
      globalPolicy: "required"
    });
    expect(out).toEqual({ policy: "disabled", source: "local" });
  });

  it("defaults to optional when no policy is set", () => {
    const out = resolvePolicyFromValues({
      repoPolicy: null,
      localPolicy: null,
      globalPolicy: null
    });
    expect(out).toEqual({ policy: "optional", source: "default" });
  });
});
