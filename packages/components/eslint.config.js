import baseConfig from '@packages/eslint-config/svelte';

export default [
	...baseConfig,
	{ ignores: ['dist/**'] },
	{
		files: ['src/lib/**/*.svelte'],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
];
