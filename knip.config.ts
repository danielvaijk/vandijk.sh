import type { KnipConfig } from "knip";

const config = {
  $schema: "https://unpkg.com/knip@6/schema.json",
  compilers: {
    css: (source: string) => [...source.matchAll(/(?<=@)import[^;]+/gu)].join("\n"),
    mdx: true,
  },
  entry: [
    "lighthouserc.cjs",
    "src/entry.*.tsx",
    "src/routes/**/*.{tsx,mdx}",
    // Article MDX imports this component through generated renderer code.
    "src/components/article-code-drawer.tsx",
    "scripts/**/*.ts",
    "plugins/**/*.ts",
    "adapters/**/*.ts",
  ],
  paths: {
    "src/*": ["src/*"],
  },
  project: [
    "src/**/*.{ts,tsx,mdx,css}",
    "scripts/**/*.ts",
    "plugins/**/*.ts",
    "adapters/**/*.ts",
    "*.config.ts",
  ],
  rules: {
    // Keep toolchain and ambient-type findings visible without blocking the
    // quick loop; Knip cannot infer all package.json command usage.
    devDependencies: "warn",
  },
} satisfies KnipConfig;

export default config;
