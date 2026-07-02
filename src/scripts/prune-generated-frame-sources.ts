import { existsSync, readdirSync, rmSync } from "node:fs";
import { extname, join, parse } from "node:path";

const DIST_DIRECTORY = "./dist";
const GENERATED_FRAME_SOURCE_EXTENSIONS = new Set([
  ".avi",
  ".gif",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".webm",
]);

function pruneGeneratedFrameSources(directory: string): void {
  if (!existsSync(directory)) {
    return;
  }

  const entries = readdirSync(directory, { withFileTypes: true });
  const frameSourceNames = new Set(
    entries
      .filter((entry): boolean => entry.isFile() && entry.name.endsWith(".frames"))
      .map((entry): string => parse(entry.name).name),
  );

  for (const entry of entries) {
    const filePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      pruneGeneratedFrameSources(filePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const { name } = parse(entry.name);
    const extension = extname(entry.name).toLowerCase();

    if (!frameSourceNames.has(name) || !GENERATED_FRAME_SOURCE_EXTENSIONS.has(extension)) {
      continue;
    }

    rmSync(filePath);
    console.info(`Removed generated frame source ${filePath}.`);
  }
}

pruneGeneratedFrameSources(DIST_DIRECTORY);
