import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const targetNames = ['landing', 'catalog', 'contact'];

const allTargetPaths = [
	'.github/',
	'scripts/ci/',
	'package.json',
	'pnpm-lock.yaml',
	'pnpm-workspace.yaml',
	'.gitignore',
	'.prettierignore',
	'packages/eslint-config/',
	'packages/prettier-config/',
	'packages/tsconfig/'
];

const targetPaths = {
	landing: [
		'apps/landing/',
		'packages/components/',
		'packages/schemas/',
		'packages/seo/',
		'packages/styles/'
	],
	catalog: [
		'apps/catalog/',
		'packages/components/',
		'packages/schemas/',
		'packages/seo/',
		'packages/styles/'
	],
	contact: ['apps/contact-worker/', 'packages/schemas/']
};

function matches(path, patterns) {
	return patterns.some((pattern) => path === pattern || path.startsWith(pattern));
}

export function determineAffectedTargets(paths, manualTarget) {
	if (manualTarget) {
		if (manualTarget !== 'all' && !targetNames.includes(manualTarget)) {
			throw new Error(`Unknown deployment target: ${manualTarget}`);
		}

		return Object.fromEntries(
			targetNames.map((target) => [target, manualTarget === 'all' || manualTarget === target])
		);
	}

	const normalizedPaths = paths.map((path) => path.trim()).filter(Boolean);
	const affectsAll = normalizedPaths.some((path) => matches(path, allTargetPaths));

	return Object.fromEntries(
		targetNames.map((target) => [
			target,
			affectsAll || normalizedPaths.some((path) => matches(path, targetPaths[target]))
		])
	);
}

async function main() {
	const manualTargetIndex = process.argv.indexOf('--manual-target');
	const manualTarget = manualTargetIndex === -1 ? undefined : process.argv[manualTargetIndex + 1];
	const paths = manualTarget ? [] : (await readFile(0, 'utf8')).split(/\r?\n/);
	const targets = determineAffectedTargets(paths, manualTarget);
	const output = `${targetNames.map((target) => `${target}=${targets[target]}`).join('\n')}\n`;

	if (process.env['GITHUB_OUTPUT']) {
		await appendFile(process.env['GITHUB_OUTPUT'], output);
	} else {
		process.stdout.write(output);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await main();
}
