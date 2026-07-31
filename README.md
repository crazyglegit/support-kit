# Support Kit

An installable, self-hosted customer-support kit for existing applications.

This repository is currently in its foundation phase. It contains the monorepo,
package boundaries, shared development tooling, and a minimal Next.js example;
customer-support functionality has not been implemented yet.

## Requirements

- Node.js 22 or newer
- pnpm 10.14.0

## Development

```bash
npm install --global pnpm@10.14.0
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

See [`docs/MASTER_BLUEPRINT.md`](docs/MASTER_BLUEPRINT.md) for the product and
engineering architecture.
