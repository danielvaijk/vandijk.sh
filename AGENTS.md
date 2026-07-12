# Repository Guidelines

## Tooling

- Use Bun for package management and scripts.
- Use Oxfmt for formatting: `bun run fmt`.
- Use Oxlint for linting: `bun run lint`.
- Keep Vite for bundling. Qwik City currently depends on Vite 5, so do not swap in `rolldown-vite` unless Qwik supports it.

## Setup

- Run `bun install` after cloning.
- `preinstall` runs `git config core.hooksPath scripts/hooks` to register the custom hook directory.
- The pre-commit hook is `scripts/hooks/pre-commit` and is a Bun TypeScript script.
- The commit message hook is `scripts/hooks/commit-msg` and is a Bun TypeScript script.

## Checks

- Before finishing changes, run the smallest relevant checks.
- For broad changes, run `bun run build`.
- The pre-commit hook runs:
  - `bun run build`
  - `bun run lint`
  - `bun run test`
- Commit message format is validated in `scripts/hooks/commit-msg` using Conventional Commit format without components (`type: summary`, e.g. `feat: ...`)

## Blog Articles

- Blog article pages live under `src/routes/blog/<article-slug>/index.mdx`.
- Article images live under `public/blog/<article-slug>`.
- `src/media/articles.json` is generated for the blog index and ignored.
