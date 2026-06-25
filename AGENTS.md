# Repository Guidelines

## Tooling

- Use Bun for package management and scripts.
- Use Oxfmt for formatting: `bun run fmt`.
- Use Oxlint for linting: `bun run lint`.
- Keep Vite for bundling. Qwik City currently depends on Vite 5, so do not swap in `rolldown-vite` unless Qwik supports it.

## Setup

- Run `bun install` after cloning.
- `preinstall` runs `bun scripts/setup.ts`, which sets `core.hooksPath` to `scripts/hooks`.
- The pre-commit hook is `scripts/hooks/pre-commit` and is a Bun TypeScript script.

## Checks

- Before finishing changes, run the smallest relevant checks.
- For broad changes, run `bun run build`.
- The pre-commit hook runs:
  - `bun run build`
  - `bun run lint`
  - `bun run test`

## Blog Articles

- Blog articles are generated from the wiki article directory.
- Local development prefers `~/wiki/data/technical/blog/posts` when present.
- CI fetches from GitHub repo `WIKI_REPOSITORY` on branch `main`.
- CI requires `WIKI_GITHUB_TOKEN`.
- Generated article files under `src/routes/blog/*` and `src/media/articles.json` are ignored.
