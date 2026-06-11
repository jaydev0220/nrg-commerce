import { defineConfig } from 'eslint/config';
import svelteConfig from '@packages/eslint-config/svelte';

export default defineConfig(svelteConfig, {
	ignores: ['worker-configuration.d.ts']
});
