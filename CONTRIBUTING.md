# Contributing

Read `AGENTS.md` and `docs/MASTER_BLUEPRINT.md` before making changes.

Install dependencies with `pnpm install`, then run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use a Changeset for changes to a publishable package's public API or behavior.
