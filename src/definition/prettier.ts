import type { Options } from "prettier";

import prettierConfig from ".prettierrc.json";

// The only reason we need to do this rather than import the JSON file directly
// everywhere is because there's a mismatch between what's expected by the format
// function options parameter and the JSON contents (the enum definition for the
// "trailingComma" property, basically).
export const PRETTIER_CONFIG = prettierConfig as Options;
