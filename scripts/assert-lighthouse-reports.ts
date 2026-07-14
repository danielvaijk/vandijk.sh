import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface LighthouseResult {
  audits?: Record<
    string,
    {
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
    if (category.score !== 1) {
      failures.push(`${page}: ${category.title ?? categoryId} category scored ${category.score}.`);
    }
  }

  for (const [auditId, audit] of Object.entries(report.audits ?? {})) {
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
  console.error(["Lighthouse reports are not completely clean:", ...failures].join("\n"));
  process.exit(1);
}

console.log(
  `Lighthouse reports are completely clean (${profilesByPage.size} pages × ${EXPECTED_PROFILES.length} profiles).`,
);
