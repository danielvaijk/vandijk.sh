import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const DIST_DIRECTORY = resolve("dist");
const HEADERS_TEMPLATE_PATH = resolve("public/_headers");
const HEADERS_OUTPUT_PATH = join(DIST_DIRECTORY, "_headers");
const CSP_PLACEHOLDER = "{{CONTENT_SECURITY_POLICY}}";
const MAX_CLOUDFLARE_HEADER_LINE_LENGTH = 2_000;
const SCRIPT_TAG_PATTERN = /<script\b(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/script>/giu;
const DATA_SCRIPT_TYPES = new Set(["application/json", "application/ld+json", "qwik/json"]);

function createSha256Source(content: string | Uint8Array): string {
  return `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
}

async function findHtmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findHtmlFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path);
    }
  }

  return files;
}

function readAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "iu"));
  return match?.[1] ?? null;
}

function resolveLocalScriptPath(documentPath: string, source: string): string {
  const documentUrl = new URL(
    relative(DIST_DIRECTORY, documentPath).split(sep).join("/"),
    "https://lighthouse.local/",
  );
  const scriptUrl = new URL(source, documentUrl);

  if (scriptUrl.origin !== documentUrl.origin) {
    throw new Error(
      `Cannot create a static integrity hash for cross-origin script '${source}' in ${documentPath}.`,
    );
  }

  const scriptPath = resolve(DIST_DIRECTORY, `.${decodeURIComponent(scriptUrl.pathname)}`);
  if (scriptPath !== DIST_DIRECTORY && !scriptPath.startsWith(`${DIST_DIRECTORY}${sep}`)) {
    throw new Error(`Script '${source}' in ${documentPath} resolves outside ${DIST_DIRECTORY}.`);
  }

  return scriptPath;
}

function addIntegrityAttributes(openingTag: string, integrity: string): string {
  let result = openingTag;

  if (!/\bintegrity\s*=/iu.test(result)) {
    result = result.replace(/>$/u, ` integrity=${JSON.stringify(integrity)}>`);
  }
  if (!/\bcrossorigin(?:\s*=|\s|>)/iu.test(result)) {
    result = result.replace(/>$/u, ' crossorigin="anonymous">');
  }

  return result;
}

async function secureDocument(documentPath: string, scriptSources: Set<string>): Promise<void> {
  const html = await readFile(documentPath, "utf8");
  let transformed = "";
  let previousEnd = 0;

  for (const match of html.matchAll(SCRIPT_TAG_PATTERN)) {
    const matchIndex = match.index;
    const attributes = match.groups?.attributes ?? "";
    const content = match.groups?.content ?? "";
    const openingTagEnd = match[0].indexOf(">") + 1;
    let replacement = match[0];
    const source = readAttribute(attributes, "src");

    if (source !== null) {
      const scriptPath = resolveLocalScriptPath(documentPath, source);
      const integrity = createSha256Source(new Uint8Array(await readFile(scriptPath))).slice(1, -1);
      scriptSources.add(`'${integrity}'`);
      replacement = `${addIntegrityAttributes(match[0].slice(0, openingTagEnd), integrity)}${match[0].slice(openingTagEnd)}`;
    } else {
      const type = readAttribute(attributes, "type")?.trim().toLowerCase();
      if (content.length > 0 && (type === undefined || !DATA_SCRIPT_TYPES.has(type))) {
        scriptSources.add(createSha256Source(content));
      }
    }

    transformed += `${html.slice(previousEnd, matchIndex)}${replacement}`;
    previousEnd = matchIndex + match[0].length;
  }

  transformed += html.slice(previousEnd);
  if (transformed !== html) {
    await writeFile(documentPath, transformed);
  }
}

function createContentSecurityPolicy(scriptSources: Set<string>): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'unsafe-inline' http: https: 'strict-dynamic' 'inline-speculation-rules' ${[...scriptSources].sort().join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
  ].join("; ");
}

function validateHeaders(headers: string): void {
  for (const [index, line] of headers.split(/\r?\n/u).entries()) {
    if (line.length > MAX_CLOUDFLARE_HEADER_LINE_LENGTH) {
      throw new Error(
        `Generated _headers line ${index + 1} is ${line.length} characters; Cloudflare allows ${MAX_CLOUDFLARE_HEADER_LINE_LENGTH}.`,
      );
    }
  }
}

const documents = await findHtmlFiles(DIST_DIRECTORY);
const scriptSources = new Set<string>();

for (const document of documents) {
  await secureDocument(document, scriptSources);
}

if (scriptSources.size === 0) {
  throw new Error(`No executable scripts found in ${DIST_DIRECTORY}.`);
}

const headersTemplate = await readFile(HEADERS_TEMPLATE_PATH, "utf8");
const placeholderCount = headersTemplate.split(CSP_PLACEHOLDER).length - 1;
if (placeholderCount !== 1) {
  throw new Error(
    `Expected exactly one ${CSP_PLACEHOLDER} placeholder in ${HEADERS_TEMPLATE_PATH}, found ${placeholderCount}.`,
  );
}

const headers = headersTemplate.replace(
  CSP_PLACEHOLDER,
  createContentSecurityPolicy(scriptSources),
);
validateHeaders(headers);
await writeFile(HEADERS_OUTPUT_PATH, headers);

console.log(
  `Prepared deployment headers and script integrity (${documents.length} HTML files, ${scriptSources.size} SHA-256 sources).`,
);
