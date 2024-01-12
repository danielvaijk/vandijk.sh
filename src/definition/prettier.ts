import { readFile } from "node:fs/promises";

const prettierConfigContents = await readFile(".prettierrc", { encoding: "utf-8" });
const prettierConfigJson = JSON.parse(prettierConfigContents);

export const PRETTIER_CONFIG = prettierConfigJson;
