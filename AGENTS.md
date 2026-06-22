# Agent Instructions

## Project Structure

```
project-root/
|-- apps/
|   |-- api/
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |-- routes/
|   |   |   |-- modules/
|   |   |   |-- middlewares/
|   |   |   |-- health/
|   |   |   |-- errors/
|   |   |   |-- types/
|   |   |   |-- utils/
|   |   |   |-- app.ts
|   |   |   `-- index.ts
|   |   |-- tests/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   `-- tsconfig.json
|   |-- admin/
|   |   |-- src/
|   |   |   |-- lib/
|   |   |   |-- routes/
|   |   |   |   |-- +layout.svelte
|   |   |   |   `-- layout.css
|   |   |   |-- app.html
|   |   |   |-- app.d.ts
|   |   |   `-- svelte.d.ts
|   |   |-- static/
|   |   |-- e2e/
|   |   |-- tests/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   |-- playwright.config.ts
|   |   |-- tsconfig.json
|   |   `-- vite.config.ts
|   |-- catalog/
|   |   |-- src/
|   |   |   |-- lib/
|   |   |   |   |-- components/
|   |   |   |   |-- catalog/
|   |   |   |   `-- server/
|   |   |   |-- routes/
|   |   |   |   |-- [productSlug]/
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.server.ts
|   |   |   |   |-- +page.svelte
|   |   |   |   |-- +page.server.ts
|   |   |   |   |-- +layout.svelte
|   |   |   |   `-- layout.css
|   |   |   |-- hooks.ts
|   |   |   |-- hooks.server.ts
|   |   |   |-- app.html
|   |   |   |-- app.d.ts
|   |   |   `-- svelte.d.ts
|   |   |-- static/
|   |   |-- messages/
|   |   |   |-- en.json
|   |   |   `-- zh-tw.json
|   |   |-- project.inlang/
|   |   |-- e2e/
|   |   |-- tests/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   |-- playwright.config.ts
|   |   |-- tsconfig.json
|   |   |-- vite.config.ts
|   |   `-- wrangler.jsonc
|   `-- landing/
|       |-- src/
|       |   |-- lib/
|       |   |   |-- components/
|       |   |   |-- state/
|       |   |   |-- seo/
|       |   |   |-- utils/
|       |   |   `-- data/
|       |   |-- routes/
|       |   |   |-- about/
|       |   |   |   |-- +page.svelte
|       |   |   |   `-- +page.ts
|       |   |   |-- contact/
|       |   |   |   |-- +page.svelte
|       |   |   |   `-- +page.ts
|       |   |   |-- +page.svelte
|       |   |   |-- +page.ts
|       |   |   |-- +layout.svelte
|       |   |   `-- layout.css
|       |   |-- hooks.ts
|       |   |-- hooks.server.ts
|       |   |-- app.html
|       |   `-- app.d.ts
|       |-- static/
|       |-- messages/
|       |   |-- en.json
|       |   `-- zh-tw.json
|       |-- project.inlang/
|       |-- package.json
|       |-- eslint.config.js
|       |-- prettier.config.js
|       |-- tsconfig.json
|       `-- vite.config.ts
|-- packages/
|   |-- eslint-config/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   `-- svelte.js
|   |-- prettier-config/
|   |   |-- package.json
|   |   `-- prettier.config.js
|   |-- tsconfig/
|   |   |-- package.json
|   |   |-- base.json
|   |   |-- node.json
|   |   `-- svelte.json
|   |-- database/
|   |   |-- prisma/
|   |   |   |-- migrations/
|   |   |   |-- generated/
|   |   |   |-- schema.prisma
|   |   |   `-- seed.ts
|   |   |-- src/
|   |   |   |-- client.ts
|   |   |   |-- access-control.ts
|   |   |   `-- index.ts
|   |   |-- tests/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   |-- tsconfig.json
|   |   `-- prisma.config.ts
|   |-- schemas/
|   |   |-- src/
|   |   |   |-- common.ts
|   |   |   |-- auth.ts
|   |   |   |-- staff.ts
|   |   |   |-- products.ts
|   |   |   `-- index.ts
|   |   |-- tests/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   `-- tsconfig.json
|   `-- components/
|       |-- src/
|       |   `-- lib/
|       |       |-- Logo.svelte
|       |       |-- LanguageSwitcher.svelte
|       |       |-- ThemeSwitcher.svelte
|       |       |-- SocialIcon.svelte
|       |       |-- Navbar.svelte
|       |       |-- Footer.svelte
|       |       |-- index.ts
|       |       `-- types.ts
|       |-- package.json
|       |-- eslint.config.js
|       |-- prettier.config.js
|       |-- tsconfig.json
|       `-- vite.config.ts
|-- .gitignore
|-- .prettierignore
|-- package.json
`-- pnpm-workspace.yaml
```

Keep test files the same structure as src.

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
- **Deployment:** GitHub Pages via `@sveltejs/adapter-static`

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

## Breaking Changes

The project is still under active development. Do not preserve backward compatibility when it would compromise code quality, maintainability, performance, or architectural clarity. Make breaking changes when they improve the program overall, and update all affected code, tests, and schemas accordingly.

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
```
