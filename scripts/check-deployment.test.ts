import { describe, expect, it } from "vitest";
import { findDeploymentProblems, headersForAllPaths } from "./check-deployment.ts";
import type { Expected, Served } from "./check-deployment.ts";

const SITE = "https://app.example.dev/";
const HEADERS_FILE = `# comment
/*
  Content-Security-Policy: default-src 'self'
  X-Content-Type-Options: nosniff

/manifest.webmanifest
  Content-Type: application/manifest+json
`;

const EXPECTED: Expected = {
  siteUrl: SITE,
  serviceWorker: "worker v1",
  precache: [
    { url: "./", sha256: "aa" },
    { url: "./assets/app.js", sha256: "bb" },
  ],
  headers: { "content-security-policy": "default-src 'self'" },
  robotsTxt: `User-agent: *\nAllow: /\nDisallow: /private/\n\nSitemap: ${SITE}sitemap.xml\n`,
  sitemapXml: `<urlset><url><loc>${SITE}</loc></url></urlset>`,
};

const PAGE = `<html><head><link rel="canonical" href="${SITE}" /></head></html>`;

const SERVED: Served = {
  serviceWorker: { body: "worker v1", cacheControl: "public, max-age=0, must-revalidate" },
  startPage: { headers: { "content-security-policy": "default-src 'self'" }, html: PAGE },
  files: new Map([
    ["./", { status: 200, sha256: "aa" }],
    ["./assets/app.js", { status: 200, sha256: "bb" }],
  ]),
  missingAssetStatus: 404,
};

describe("headersForAllPaths", () => {
  it("reads the /* block with lower-case names and skips comments and other paths", () => {
    expect(headersForAllPaths(HEADERS_FILE)).toEqual({
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
    });
  });

  it("is empty without a /* block", () => {
    expect(headersForAllPaths("/x\n  A: b\n")).toEqual({});
  });
});

describe("findDeploymentProblems", () => {
  it("accepts the release as built", () => {
    expect(findDeploymentProblems(EXPECTED, SERVED)).toEqual([]);
  });

  it("names another release when the worker differs", () => {
    const served = { ...SERVED, serviceWorker: { ...SERVED.serviceWorker, body: "worker v0" } };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "sw.js differs from the build: another release is served",
    ]);
  });

  it("names a kept file that is missing or changed", () => {
    const served = {
      ...SERVED,
      files: new Map([
        ["./", { status: 200, sha256: "zz" }],
        ["./assets/app.js", { status: 404, sha256: "bb" }],
      ]),
    };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "./: SHA-256 zz, built aa",
      "./assets/app.js: HTTP 404",
    ]);
  });

  it("names a header that is missing or different", () => {
    const served = { ...SERVED, startPage: { headers: {}, html: PAGE } };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "header content-security-policy: (missing), expected default-src 'self'",
    ]);
  });

  it("requires the worker to be revalidated on every visit", () => {
    const served = {
      ...SERVED,
      serviceWorker: { body: "worker v1", cacheControl: "public, max-age=14400" },
    };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "sw.js Cache-Control public, max-age=14400 lets browsers skip updates",
    ]);
  });

  it("guards indexing: robots directives and the canonical address", () => {
    const html = `<html><head><meta name="robots" content="noindex" /><link rel="canonical" href="https://other.example/" /></head></html>`;
    const served = {
      ...SERVED,
      startPage: { headers: { ...SERVED.startPage.headers, "x-robots-tag": "noindex" }, html },
    };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "start page X-Robots-Tag noindex blocks indexing",
      "start page meta robots noindex blocks indexing",
      `canonical https://other.example/, expected ${SITE}`,
    ]);
  });

  it("reads robots none, which means noindex too, in the header and the meta", () => {
    const html = `<html><head><meta name="robots" content="none" />${PAGE}</head></html>`;
    const served = {
      ...SERVED,
      startPage: { headers: { ...SERVED.startPage.headers, "x-robots-tag": "none" }, html },
    };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "start page X-Robots-Tag none blocks indexing",
      "start page meta robots none blocks indexing",
    ]);
  });

  it("reads the robots meta whatever the order of its attributes", () => {
    const html = `<html><head><meta content="noindex" name="robots">${PAGE}</head></html>`;
    const served = { ...SERVED, startPage: { ...SERVED.startPage, html } };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([
      "start page meta robots noindex blocks indexing",
    ]);
  });

  it("does not read max-image-preview:none as a block on indexing", () => {
    const html = `<html><head><meta name="robots" content="max-image-preview:none" />${PAGE}</head></html>`;
    const headers = { ...SERVED.startPage.headers, "x-robots-tag": "max-image-preview: none" };
    const served = { ...SERVED, startPage: { headers, html } };
    expect(findDeploymentProblems(EXPECTED, served)).toEqual([]);
  });

  it("treats Disallow: /* like Disallow: /", () => {
    const expected = { ...EXPECTED, robotsTxt: "User-agent: *\nDisallow: /*\n" };
    expect(findDeploymentProblems(expected, SERVED)).toEqual([
      "robots.txt disallows the whole site",
    ]);
  });

  it("guards robots.txt and the sitemap", () => {
    const expected = {
      ...EXPECTED,
      robotsTxt: "User-agent: *\nDisallow: /\n",
      sitemapXml: "<urlset><url><loc>https://other.example/</loc></url></urlset>",
    };
    expect(findDeploymentProblems(expected, SERVED)).toEqual([
      "robots.txt disallows the whole site",
      `sitemap.xml does not list ${SITE}`,
    ]);
  });

  it("requires a missing asset to be a 404, not the start page", () => {
    expect(findDeploymentProblems(EXPECTED, { ...SERVED, missingAssetStatus: 200 })).toEqual([
      "a missing asset answers HTTP 200, expected 404",
    ]);
  });
});
