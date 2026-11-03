import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PIN_RULES,
  SECURITY_WORKFLOW,
  extractPins,
  formatReport,
  isNewerVersion,
} from "./check-pinned-tools.ts";

describe("isNewerVersion", () => {
  it("compares numerically, part by part", () => {
    expect(isNewerVersion("1.7.13", "1.7.12")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("v8.30.1", "8.30.1")).toBe(false);
    expect(isNewerVersion("8.29.0", "8.30.1")).toBe(false);
  });

  it("treats an unparsable version as not newer", () => {
    expect(isNewerVersion("nightly", "1.0.0")).toBe(false);
  });
});

describe("extractPins", () => {
  it("finds every rule in the real security workflow", () => {
    const { pins, missing } = extractPins(readFileSync(SECURITY_WORKFLOW, "utf8"));
    expect(missing).toEqual([]);
    expect(pins.map((pin) => pin.rule.name)).toEqual(PIN_RULES.map((rule) => rule.name));
  });

  it("reports a rule whose pin is gone", () => {
    expect(extractPins("GITLEAKS_VERSION: 8.30.1").missing).toEqual(["actionlint", "zizmor"]);
  });
});

describe("formatReport", () => {
  const { pins } = extractPins(
    "GITLEAKS_VERSION: 8.30.1\nACTIONLINT_VERSION: 1.7.12\nZIZMOR_VERSION: 1.30.1",
  );

  it("passes when every pin is the latest release", () => {
    const latest = new Map([
      ["gitleaks", "8.30.1"],
      ["actionlint", "1.7.12"],
      ["zizmor", "1.30.1"],
    ]);
    expect(formatReport(pins, latest, []).exitCode).toBe(0);
  });

  it("fails and says how to bump an outdated pin", () => {
    const latest = new Map([
      ["gitleaks", "8.31.0"],
      ["actionlint", "1.7.12"],
      ["zizmor", "1.30.1"],
    ]);
    const report = formatReport(pins, latest, []);
    expect(report.exitCode).toBe(1);
    expect(report.text).toContain("gitleaks: pinned 8.30.1, latest 8.31.0: OUTDATED");
  });

  it("fails on a missing pin", () => {
    expect(formatReport([], new Map(), ["zizmor"]).exitCode).toBe(1);
  });
});
