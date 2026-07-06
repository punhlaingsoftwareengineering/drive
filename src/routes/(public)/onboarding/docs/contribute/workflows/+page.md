# Workflows

## Development server

```bash
pnpm dev
```

Runs Vite + SvelteKit in dev mode with HMR on port 1025. Sign in through the normal UI to exercise private routes.

## Typecheck

```bash
pnpm check
```

Runs `svelte-kit sync` and `svelte-check` against `tsconfig.json`. Use this before pushing; CI should enforce the same bar.

## Tests

```bash
pnpm test
```

Runs unit tests (`vitest`) and e2e tests (`playwright`) as defined in `package.json`. For a quicker loop:

```bash
pnpm test:unit
pnpm test:e2e
```

## Lint and format

```bash
pnpm lint
pnpm format
```

Keep Prettier and ESLint clean so reviews focus on behavior, not style drift.
