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
  finalUrl?: string;
  runWarnings?: unknown[];
  runtimeError?: unknown;
}

const REPORT_DIRECTORY = ".lighthouseci";
const NON_SCORED_MODES = new Set(["informative", "manual", "notApplicable"]);

const reportFiles = (await readdir(REPORT_DIRECTORY))
  .filter((fileName): boolean => /^lhr-\d+\.json$/u.test(fileName))
  .sort();

if (reportFiles.length === 0) {
  throw new Error(`No Lighthouse JSON reports found in ${REPORT_DIRECTORY}.`);
}

const failures: string[] = [];

for (const reportFile of reportFiles) {
  const reportPath = join(REPORT_DIRECTORY, reportFile);
  const report = JSON.parse(await readFile(reportPath, "utf8")) as LighthouseResult;
  const page = report.finalUrl ?? reportFile;

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
    if (NON_SCORED_MODES.has(audit.scoreDisplayMode ?? "")) {
      continue;
    }

    if (audit.score !== 1) {
      failures.push(`${page}: ${audit.title ?? auditId} audit scored ${audit.score}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(["Lighthouse reports are not completely clean:", ...failures].join("\n"));
  process.exit(1);
}

console.log(`Lighthouse reports are completely clean (${reportFiles.length} pages).`);
