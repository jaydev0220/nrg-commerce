import js from '@eslint/js';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import path from 'node:path';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '..', '..', '.gitignore');

export const sharedConfig = defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	prettier,
	{
		rules: {
			'no-undef': 'off'
		}
	}
);

export const nodeConfig = defineConfig(sharedConfig, {
	languageOptions: {
		globals: {
			...globals.node
		}
	}
});

export default nodeConfig;
