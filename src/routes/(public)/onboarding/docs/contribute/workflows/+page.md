# Workflows

## Development server

```bash
deno task dev
```

Runs Vite + SvelteKit in dev mode with HMR on port 1025. Sign in through the normal UI to exercise private routes.

## Typecheck

```bash
deno task check
```

Runs `svelte-kit sync` and `svelte-check` against `tsconfig.json`. Use this before pushing; CI should enforce the same bar.

## Tests

```bash
deno task test
```

Runs unit tests (`vitest`) and e2e tests (`playwright`) as defined in `deno.json`. For a quicker loop:

```bash
deno task test:unit
deno task test:e2e
```

## Lint and format

```bash
deno task lint
deno task format
```

Keep Prettier and ESLint clean so reviews focus on behavior, not style drift.
