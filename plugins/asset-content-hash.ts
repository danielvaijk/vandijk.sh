import { createHash } from "node:crypto";

const ASSET_CONTENT_HASH_HEX_LENGTH = 16;
const fullHashesByShortHash = new Map<string, string>();

function createAssetContentHash(content: string | Uint8Array): string {
  const fullHash = createHash("sha256").update(content).digest("hex");
  const shortHash = fullHash.slice(0, ASSET_CONTENT_HASH_HEX_LENGTH);
  const registeredHash = fullHashesByShortHash.get(shortHash);

  if (registeredHash !== undefined && registeredHash !== fullHash) {
    throw new Error(
      `Asset content hash collision for '${shortHash}': '${registeredHash}' and '${fullHash}'.`,
    );
  }

  fullHashesByShortHash.set(shortHash, fullHash);

  return shortHash;
}

export { createAssetContentHash };
