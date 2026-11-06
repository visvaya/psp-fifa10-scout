// Reports tools pinned by hand in the security workflow (Dependabot does not see them) that have a
// newer release.
// Usage: node scripts/check-pinned-tools.ts   (optional GH_TOKEN raises the GitHub API rate limit)
// Exit codes: 0 all current, 1 outdated or unreadable pins, 2 network or API failure.
import { readFileSync } from "node:fs";

interface PinRule {
  readonly name: string;
  readonly pattern: RegExp;
  /** Where the newest version is read from. */
  readonly source: { readonly kind: "github"; readonly repo: string } | { readonly kind: "pypi" };
  readonly howToBump: string;
}

interface PinnedTool {
  readonly rule: PinRule;
  readonly pinned: string;
}

export const SECURITY_WORKFLOW = ".github/workflows/security.yml";

export const PIN_RULES: readonly PinRule[] = [
  {
    name: "gitleaks",
    pattern: /^\s*GITLEAKS_VERSION:\s*(\d+\.\d+\.\d+)/m,
    source: { kind: "github", repo: "gitleaks/gitleaks" },
    howToBump:
      "update GITLEAKS_VERSION and GITLEAKS_SHA256 (linux_x64 entry of the checksums file)",
  },
  {
    name: "actionlint",
    pattern: /^\s*ACTIONLINT_VERSION:\s*(\d+\.\d+\.\d+)/m,
    source: { kind: "github", repo: "rhysd/actionlint" },
    howToBump:
      "update ACTIONLINT_VERSION and ACTIONLINT_SHA256 (linux_amd64 entry of the checksums file)",
  },
  {
    name: "zizmor",
    pattern: /^\s*ZIZMOR_VERSION:\s*(\d+\.\d+\.\d+)/m,
    source: { kind: "pypi" },
    howToBump: "update ZIZMOR_VERSION and ZIZMOR_SHA256 (manylinux x86_64 wheel on PyPI)",
  },
];

const parseVersion = (version: string): readonly number[] | undefined => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match === null ? undefined : match.slice(1).map(Number);
};

export const isNewerVersion = (candidate: string, current: string): boolean => {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (a === undefined || b === undefined) return false;
  const diff = a.map((part, index) => part - (b[index] ?? 0)).find((value) => value !== 0);
  return diff !== undefined && diff > 0;
};

export const extractPins = (
  workflow: string,
  rules: readonly PinRule[] = PIN_RULES,
): { readonly pins: readonly PinnedTool[]; readonly missing: readonly string[] } => {
  const found = rules.map((rule) => ({ rule, pinned: rule.pattern.exec(workflow)?.[1] }));
  return {
    pins: found.flatMap(({ rule, pinned }) => (pinned === undefined ? [] : [{ rule, pinned }])),
    missing: found.filter(({ pinned }) => pinned === undefined).map(({ rule }) => rule.name),
  };
};

export const formatReport = (
  pins: readonly PinnedTool[],
  latest: ReadonlyMap<string, string>,
  missing: readonly string[],
): { readonly exitCode: number; readonly text: string } => {
  // A version format the check cannot read would otherwise pass as "not newer" forever.
  const problemOf = (pin: PinnedTool, newest: string): string | null => {
    if (parseVersion(newest) === undefined) return "cannot read the latest version";
    return isNewerVersion(newest, pin.pinned) ? `OUTDATED, ${pin.rule.howToBump}` : null;
  };
  const statuses = pins.map((pin) => {
    const newest = latest.get(pin.rule.name) ?? "unknown";
    return { pin, newest, problem: problemOf(pin, newest) };
  });
  const lines = [
    ...statuses.map(
      ({ pin, newest, problem }) =>
        `${pin.rule.name}: pinned ${pin.pinned}, latest ${newest}: ${problem ?? "ok"}`,
    ),
    ...missing.map((name) => `${name}: pin not found in ${SECURITY_WORKFLOW}, update PIN_RULES`),
  ];
  const failed = statuses.some(({ problem }) => problem !== null) || missing.length > 0;
  const exitCode = failed ? 1 : 0;
  return { exitCode, text: `${lines.join("\n")}\n` };
};

/* v8 ignore start -- network and process glue */
const fetchJson = async (url: string, headers: Record<string, string>): Promise<unknown> => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)} for ${url}`);
  return response.json();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringField = (body: unknown, ...keys: readonly string[]): string | undefined => {
  const value = keys.reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), body);
  return typeof value === "string" ? value : undefined;
};

const fetchLatest = async (rule: PinRule): Promise<string> => {
  if (rule.source.kind === "pypi") {
    const body = await fetchJson(`https://pypi.org/pypi/${rule.name}/json`, {});
    const version = stringField(body, "info", "version");
    if (version === undefined) throw new Error(`no version for ${rule.name} on PyPI`);
    return version;
  }
  const token = process.env["GH_TOKEN"];
  const body = await fetchJson(`https://api.github.com/repos/${rule.source.repo}/releases/latest`, {
    accept: "application/vnd.github+json",
    "user-agent": "pinned-tools-check",
    ...(token === undefined || token === "" ? {} : { authorization: `Bearer ${token}` }),
  });
  const tag = stringField(body, "tag_name");
  if (tag === undefined) throw new Error(`no tag_name for ${rule.source.repo}`);
  return tag.replace(/^v/, "");
};

const main = async (): Promise<number> => {
  const { pins, missing } = extractPins(readFileSync(SECURITY_WORKFLOW, "utf8"));
  try {
    const entries = await Promise.all(
      pins.map(async (pin) => [pin.rule.name, await fetchLatest(pin.rule)] as const),
    );
    const report = formatReport(pins, new Map(entries), missing);
    process.stdout.write(report.text);
    return report.exitCode;
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
};

if (import.meta.main) {
  process.exitCode = await main();
}
/* v8 ignore stop */
