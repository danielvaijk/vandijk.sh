import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface LighthouseResult {
  audits?: Record<
    string,
    {
      details?: {
        items?: unknown[];
        longestChain?: { duration?: number };
      };
      metricSavings?: Record<string, number | undefined>;
      score?: number | null;
      scoreDisplayMode?: string;
      title?: string;
    }
  >;
  categories?: Record<string, { score?: number | null; title?: string }>;
  configSettings?: { formFactor?: string };
  finalUrl?: string;
  runWarnings?: unknown[];
  runtimeError?: unknown;
}

const REPORT_DIRECTORY = ".lighthouseci";
const EXPECTED_PROFILES = ["mobile", "desktop"] as const;
const NON_SCORED_MODES = new Set(["informative", "manual", "notApplicable"]);
const ACTIONABLE_INFORMATIONAL_AUDITS = new Set(["csp-xss", "origin-isolation"]);
const NETWORK_DEPENDENCY_INSIGHT = "network-dependency-tree-insight";
const CATEGORY_MINIMUM_SCORES: Record<string, number> = {
  accessibility: 1,
  "best-practices": 1,
  performance: 0.99,
  seo: 1,
};
// These continuous lab metrics are already represented by the category's
// exact 100 score. A healthy green metric can have an individual score such
// as 0.98, so treating it as a warning would make the gate both misleading
// and needlessly sensitive to normal Lighthouse variance.
const CATEGORY_METRIC_AUDITS = new Set([
  "cumulative-layout-shift",
  "first-contentful-paint",
  "first-meaningful-paint",
  "interaction-to-next-paint",
  "interactive",
  "largest-contentful-paint",
  "max-potential-fid",
  "speed-index",
  "total-blocking-time",
]);

const reportFiles = (await readdir(REPORT_DIRECTORY))
  .filter((fileName): boolean => /^lhr-\d+\.json$/u.test(fileName))
  .sort();

if (reportFiles.length === 0) {
  throw new Error(`No Lighthouse JSON reports found in ${REPORT_DIRECTORY}.`);
}

const failures: string[] = [];
const diagnostics: string[] = [];
const profilesByPage = new Map<string, Set<string>>();

for (const reportFile of reportFiles) {
  const reportPath = join(REPORT_DIRECTORY, reportFile);
  const report = JSON.parse(await readFile(reportPath, "utf8")) as LighthouseResult;
  const pageUrl = report.finalUrl ?? reportFile;
  const profile = report.configSettings?.formFactor ?? "unknown";
  let pageId = pageUrl;

  try {
    const url = new URL(pageUrl);
    pageId = `${url.pathname}${url.search}`;
  } catch {
    // Keep the report filename or malformed URL as its stable identifier.
  }

  const seenProfiles = profilesByPage.get(pageId) ?? new Set<string>();

  if (seenProfiles.has(profile)) {
    failures.push(`${pageId}: found multiple ${profile} reports.`);
  }

  seenProfiles.add(profile);
  profilesByPage.set(pageId, seenProfiles);

  const page = `[${profile}] ${pageUrl}`;

  if (report.runtimeError !== undefined) {
    failures.push(`${page}: runtime error: ${JSON.stringify(report.runtimeError)}`);
  }

  for (const warning of report.runWarnings ?? []) {
    failures.push(`${page}: run warning: ${JSON.stringify(warning)}`);
  }

  for (const [categoryId, category] of Object.entries(report.categories ?? {})) {
    const minimumScore = CATEGORY_MINIMUM_SCORES[categoryId] ?? 1;
    if (typeof category.score !== "number" || category.score < minimumScore) {
      failures.push(
        `${page}: ${category.title ?? categoryId} category scored ${category.score}; expected at least ${minimumScore}.`,
      );
    }
  }

  for (const [auditId, audit] of Object.entries(report.audits ?? {})) {
    if (auditId.endsWith("-insight") && audit.scoreDisplayMode !== "notApplicable") {
      for (const [metric, savings] of Object.entries(audit.metricSavings ?? {})) {
        if (typeof savings === "number" && savings > 0) {
          failures.push(
            `${page}: ${audit.title ?? auditId} estimates ${Math.round(savings)} ${metric === "CLS" ? "CLS" : "ms"} of avoidable ${metric}.`,
          );
        }
      }
    }

    if (auditId === NETWORK_DEPENDENCY_INSIGHT) {
      const lcpSavings = audit.metricSavings?.LCP;
      const duration = audit.details?.longestChain?.duration;
      diagnostics.push(
        `${page}: ${audit.title ?? auditId}: longest chain ${typeof duration === "number" ? `${Math.round(duration)} ms` : "unknown"}, estimated LCP savings ${typeof lcpSavings === "number" ? `${Math.round(lcpSavings)} ms` : "unknown"}.`,
      );
      if (typeof lcpSavings !== "number") {
        failures.push(`${page}: ${audit.title ?? auditId} did not report estimated LCP savings.`);
      }
      continue;
    }

    if (ACTIONABLE_INFORMATIONAL_AUDITS.has(auditId)) {
      const findings = audit.details?.items ?? [];
      if (findings.length > 0) {
        failures.push(
          `${page}: ${audit.title ?? auditId} reported ${findings.length} finding(s): ${JSON.stringify(findings)}`,
        );
      }
      continue;
    }

    if (CATEGORY_METRIC_AUDITS.has(auditId) || NON_SCORED_MODES.has(audit.scoreDisplayMode ?? "")) {
      continue;
    }

    if (audit.score !== 1) {
      failures.push(`${page}: ${audit.title ?? auditId} audit scored ${audit.score}.`);
    }
  }
}

for (const [page, profiles] of profilesByPage) {
  for (const expectedProfile of EXPECTED_PROFILES) {
    if (!profiles.has(expectedProfile)) {
      failures.push(`${page}: missing ${expectedProfile} report.`);
    }
  }
}

if (failures.length > 0) {
  console.error(["Lighthouse report gate failed:", ...failures].join("\n"));
  process.exit(1);
}

console.log(
  `Lighthouse report gate passed (${profilesByPage.size} pages × ${EXPECTED_PROFILES.length} profiles).`,
);
console.log(["Lighthouse diagnostic insights:", ...diagnostics].join("\n"));
