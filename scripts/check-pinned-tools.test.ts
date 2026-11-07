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

  it("ignores a commented-out pin before the active one", () => {
    const workflow = "# GITLEAKS_VERSION: 8.0.0\n      GITLEAKS_VERSION: 8.30.1";
    expect(extractPins(workflow).pins[0]?.pinned).toBe("8.30.1");
  });

  it("reports a rule whose pin is gone", () => {
    expect(extractPins("GITLEAKS_VERSION: 8.30.1").missing).toEqual(["actionlint", "zizmor"]);
  });
});

/** The latest releases: the pins in formatReport's tests, except where a test says otherwise. */
const latestReleases = (changed: Readonly<Record<string, string>> = {}) =>
  new Map(
    Object.entries({ gitleaks: "8.30.1", actionlint: "1.7.12", zizmor: "1.30.1", ...changed }),
  );

describe("formatReport", () => {
  const { pins } = extractPins(
    "GITLEAKS_VERSION: 8.30.1\nACTIONLINT_VERSION: 1.7.12\nZIZMOR_VERSION: 1.30.1",
  );

  it("passes when every pin is the latest release", () => {
    expect(formatReport(pins, latestReleases(), []).exitCode).toBe(0);
  });

  it("fails and says how to bump an outdated pin", () => {
    const report = formatReport(pins, latestReleases({ gitleaks: "8.31.0" }), []);
    expect(report.exitCode).toBe(1);
    expect(report.text).toContain("gitleaks: pinned 8.30.1, latest 8.31.0: OUTDATED");
  });

  it("fails when the latest version cannot be read, rather than calling the pin current", () => {
    const report = formatReport(pins, latestReleases({ zizmor: "1.33" }), []);
    expect(report.exitCode).toBe(1);
    expect(report.text).toContain(
      "zizmor: pinned 1.30.1, latest 1.33: cannot read the latest version",
    );
  });

  it("fails on a missing pin", () => {
    expect(formatReport([], new Map(), ["zizmor"]).exitCode).toBe(1);
  });
});
