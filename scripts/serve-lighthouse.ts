import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gzip as gzipCallback } from "node:zlib";

import { applyCloudflareHeaders, parseCloudflareHeaders } from "./cloudflare-headers";

const DIST_DIRECTORY = resolve("dist");
const HEADERS_PATH = join(DIST_DIRECTORY, "_headers");
const HOST = process.env.LIGHTHOUSE_HOST ?? "127.0.0.1";
const portArgument = process.argv.find((argument): boolean => argument.startsWith("--port="));
const PORT = Number.parseInt(
  portArgument?.slice("--port=".length) ?? process.env.LIGHTHOUSE_PORT ?? "4173",
  10,
);
const DEFAULT_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const MINIMUM_GZIP_SIZE = 48;
const gzip = promisify(gzipCallback);
const gzipCache = new Map<string, Uint8Array>();
const COMPRESSIBLE_CONTENT_TYPES = new Set([
  "application/font",
  "application/font-sfnt",
  "application/graphql+json",
  "application/javascript",
  "application/ld+json",
  "application/manifest+json",
  "application/otf",
  "application/rss+xml",
  "application/ttf",
  "application/vnd.api+json",
  "application/vnd.ms-fontobject",
  "application/wasm",
  "application/xhtml+xml",
  "application/xml",
  "application/x-font-woff",
  "application/x-httpd-cgi",
  "application/x-javascript",
  "application/x-opentype",
  "application/x-otf",
  "application/x-perl",
  "application/x-protobuf",
  "application/x-ttf",
  "application/x-truetype",
  "font/otf",
  "font/ttf",
  "font/woff",
  "image/svg+xml",
  "image/vnd.microsoft.icon",
  "image/x-icon",
  "multipart/bag",
  "multipart/mixed",
  "text/css",
  "text/html",
  "text/javascript",
  "text/js",
  "text/plain",
  "text/richtext",
  "text/x-component",
  "text/x-java-source",
  "text/x-markdown",
  "text/x-script",
  "text/xml",
]);
const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/x-markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

if (!Number.isSafeInteger(PORT) || PORT <= 0 || PORT > 65_535) {
  throw new Error(`Invalid LIGHTHOUSE_PORT '${process.env.LIGHTHOUSE_PORT ?? ""}'.`);
}

function getContentType(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function isCompressible(contentType: string): boolean {
  return COMPRESSIBLE_CONTENT_TYPES.has(contentType.split(";", 1)[0].trim().toLowerCase());
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveRequestPath(pathname: string): Promise<{ path: string; status: number }> {
  const decodedPath = decodeURIComponent(pathname);
  let candidate = resolve(DIST_DIRECTORY, `.${decodedPath}`);

  if (candidate !== DIST_DIRECTORY && !candidate.startsWith(`${DIST_DIRECTORY}${sep}`)) {
    return { path: join(DIST_DIRECTORY, "404.html"), status: 404 };
  }
  if (await isDirectory(candidate)) {
    candidate = join(candidate, "index.html");
  }
  if (await isFile(candidate)) {
    return { path: candidate, status: 200 };
  }
  if (extname(candidate).length === 0 && (await isFile(`${candidate}.html`))) {
    return { path: `${candidate}.html`, status: 200 };
  }

  return { path: join(DIST_DIRECTORY, "404.html"), status: 404 };
}

function writeHeaders(response: ServerResponse, headers: Headers): void {
  for (const [name, value] of headers) {
    response.setHeader(name, value);
  }
}

const headerRules = parseCloudflareHeaders(await readFile(HEADERS_PATH, "utf8"));

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? HOST}`);
  const { path, status } = await resolveRequestPath(requestUrl.pathname);
  let body = new Uint8Array(await readFile(path));
  const contentType = getContentType(path);
  const headers = applyCloudflareHeaders(headerRules, requestUrl.pathname, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": DEFAULT_CACHE_CONTROL,
    "Content-Type": contentType,
    ETag: `"${createHash("sha256").update(body).digest("hex")}"`,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
  });

  if (
    request.headers["accept-encoding"]?.includes("gzip") &&
    body.byteLength >= MINIMUM_GZIP_SIZE &&
    isCompressible(headers.get("Content-Type") ?? contentType)
  ) {
    let compressed = gzipCache.get(path);
    if (!compressed) {
      compressed = new Uint8Array(await gzip(body));
      gzipCache.set(path, compressed);
    }
    if (compressed.byteLength < body.byteLength) {
      body = compressed;
      headers.set("Content-Encoding", "gzip");
      headers.set("Vary", "Accept-Encoding");
    }
  }

  headers.set("Content-Length", body.byteLength.toString());
  writeHeaders(response, headers);
  response.writeHead(status);
  response.end(request.method === "HEAD" ? undefined : body);
}

const server = createServer((request, response): void => {
  void handleRequest(request, response).catch((error: unknown): void => {
    console.error(error);
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    response.end("Internal Server Error");
  });
});

server.listen(PORT, HOST, (): void => {
  console.log(`Lighthouse server ready at http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, (): void => {
    server.close((): void => process.exit(0));
  });
}
