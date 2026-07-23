import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			reporter: ['text'],
			include: ['src/lib/**/*.{js,ts,svelte}'],
			exclude: ['src/**/*.d.ts'],
			thresholds: { lines: 70, branches: 75, functions: 79 }
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					fileParallelism: false,
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['tests/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
