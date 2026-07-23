# Agent Instructions

## Project Structure

```
project-root/
|-- apps/
|   |-- api/                                  # Backend API server
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
|   |-- contact-worker/
|   |   |-- src/
|   |   |-- tests/
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   |-- tsconfig.json
|   |   `-- wrangler.jsonc
|   |-- admin/                                # Management page for staff
|   |   |-- src/
|   |   |   |-- lib/
|   |   |   |   |-- api/
|   |   |   |   |   |-- client.ts
|   |   |   |   |   `-- admin-api.ts
|   |   |   |   |-- components/
|   |   |   |   |   |-- dashboard/
|   |   |   |   |   |-- orders/
|   |   |   |   |   |-- products/
|   |   |   |   |   |-- businesses/
|   |   |   |   |   |-- logs/
|   |   |   |   |   |-- settings/
|   |   |   |   |   `-- shared/
|   |   |   |   |-- filter-navigation.ts
|   |   |   |   |-- labels.ts
|   |   |   |   |-- order-validation.ts
|   |   |   |   `-- passkey.ts
|   |   |   |-- routes/
|   |   |   |   |-- login/
|   |   |   |   |   |-- setup/
|   |   |   |   |   |   `-- +page.svelte
|   |   |   |   |   |-- verify/
|   |   |   |   |   |   `-- +page.svelte
|   |   |   |   |   `-- +page.svelte
|   |   |   |   |-- orders/
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.ts
|   |   |   |   |-- products/
|   |   |   |   |   |-- [productId]/
|   |   |   |   |   |   |-- +page.svelte
|   |   |   |   |   |   `-- +page.ts
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.ts
|   |   |   |   |-- businesses/
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.ts
|   |   |   |   |-- staff/
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.ts
|   |   |   |   |-- logs/
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.ts
|   |   |   |   |-- settings/
|   |   |   |   |   |-- +page.svelte
|   |   |   |   |   `-- +page.ts
|   |   |   |   |-- +page.svelte
|   |   |   |   |-- +layout.svelte
|   |   |   |   |-- +layout.ts
|   |   |   |   |-- +page.ts
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
|   |-- catalog/                              # Product catalog page
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
|   `-- landing/                              # Landing page
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
|   |-- eslint-config/                        # Shared ESLint config
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   `-- svelte.js
|   |-- prettier-config/                      # Shared Prettier config
|   |   |-- package.json
|   |   `-- prettier.config.js
|   |-- tsconfig/                             # Shared TypeScript config
|   |   |-- package.json
|   |   |-- base.json
|   |   |-- node.json
|   |   `-- svelte.json
|   |-- database/                             # Database module
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
|   |-- schemas/                              # Zod schemas for API data validation
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
|   |-- styles/                               # Shared CSS styles for web apps
|   |   |-- shared.css
|   |   `-- package.json
|   |-- components/                           # Shared web app UI components
|   |   |-- src/
|   |   |   `-- lib/
|   |   |       |-- Logo.svelte
|   |   |       |-- LanguageSwitcher.svelte
|   |   |       |-- ThemeSwitcher.svelte
|   |   |       |-- SocialIcon.svelte
|   |   |       |-- Navbar.svelte
|   |   |       |-- Footer.svelte
|   |   |       |-- index.ts
|   |   |       `-- types.ts
|   |   |-- package.json
|   |   |-- eslint.config.js
|   |   |-- prettier.config.js
|   |   |-- tsconfig.json
|   |   `-- vite.config.ts
|   `-- seo/                                  # SEO helper functions for web apps
|       |-- src/
|       |   `-- index.ts
|       |-- package.json
|       |-- eslint.config.js
|       |-- prettier.config.js
|       `-- tsconfig.json
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
pnpm test:coverage
pnpm test:e2e
```
