# Agent Instructions

## Project Structure

```
project-root/
|-- apps/
|   |-- api/                # Backend API server
|   |-- admin/              # Management page for staff
|   |-- catalog/            # Product catalog page
|   `-- landing/            # Landing page
|-- packages/
|   |-- eslint-config/      # Shared ESLint config
|   |-- prettier-config/    # Shared Prettier config
|   |-- tsconfig/           # Shared TypeScript config
|   |-- database/           # Database module
|   |-- schemas/            # Zod schemas for API data validation
|   |-- styles/             # Shared CSS styles for web apps
|   |-- components/         # Shared web app UI components
|   `-- seo/                # SEO helper functions for web apps
|-- .gitignore
|-- .prettierignore
|-- package.json
`-- pnpm-workspace.yaml
```

## Tech Stack

### Repository-wide

- **Runtime:** Node.js 24
- **Primary Language:** TypeScript 6
- **Linting:** ESLint
- **Formatting:** Prettier
- **Package Manager:** pnpm 11

### Applications

### `apps/landing`

- **Framework:** Svelte 5
- **Styling:** Tailwind CSS 4
- **i18n:** Paraglide JS
- **Deployment:** Cloudflare Workers Static Assets via `@sveltejs/adapter-cloudflare`

#### `apps/admin`

- **Framework:** Svelte 5
- **Styling:** Tailwind CSS 4
- **Testing:** Playwright, Vitest
- **Deployment:** Docker

#### `apps/catalog`

- **Framework:** Svelte 5
- **Styling:** Tailwind CSS 4
- **i18n:** Paraglide JS
- **Testing:** Playwright, Vitest
- **Deployment:** Cloudflare Workers via `@sveltejs/adapter-cloudflare`

#### `apps/api`

- **Framework:** Express 5
- **Testing:** Node.js built-in test runner
- **Deployment:** Docker

### Packages

#### `packages/database`

- **ORM:** Prisma 7
- **Database:** PostgreSQL 18
- **Testing:** Node.js built-in test runner

#### `packages/schemas`

- **Validation library:** Zod 4
- **Testing:** Node.js built-in test runner

### `packages/components`

- **Framework:** Svelte 5

### `packages/seo`

- **Testing:** Node.js built-in test runner

## Verifications

If you are on a task that changes code, you must run the following commands to ensure code quality:

```bash
pnpm format
pnpm lint
pnpm check
```

Run when the change can affect build output:

```bash
pnpm build
```

Run when behavior changes:

```bash
pnpm test
pnpm test:coverage
pnpm test:e2e
```

## Documentation Policy

- Keep documentation intentional, minimal, and directly useful.
- Do not create unnecessary documentation, summaries, implementation notes, reports, changelogs, migration notes, or task-completion files.
- Do not create documentation merely to record or explain work performed during a task.
- Treat existing code, tests, types, schemas, configuration, and version control history as the primary sources of implementation detail.
- Create new documentation only when the user explicitly requests documentation as part of the task.
