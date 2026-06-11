/**
 * @type {import('prettier').Config}
 */
export const baseConfig = {
	semi: true,
	useTabs: true,
	tabWidth: 2,
	singleQuote: true,
	endOfLine: 'lf',
	trailingComma: 'none',
	printWidth: 100
};

/**
 * @type {import('prettier').Config}
 */
export const svelteConfig = {
	...baseConfig,
	plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
	htmlWhitespaceSensitivity: 'ignore',
	singleAttributePerLine: true,
	svelteAllowShorthand: true,
	svelteIndentScriptAndStyle: true,
	overrides: [
		{
			files: '*.svelte',
			options: {
				parser: 'svelte'
			}
		}
	],
	tailwindStylesheet: './src/routes/layout.css'
};

export default baseConfig;
