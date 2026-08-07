import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function findUnpinnedActions(root = '.github/workflows') {
	const failures = [];
	for await (const path of glob(`${root}/**/*.yml`)) {
		const source = await readFile(path, 'utf8');
		for (const [index, line] of source.split('\n').entries()) {
			const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/u);
			if (match && !/@[0-9a-f]{40}$/u.test(match[1])) failures.push(`${path}:${index + 1}`);
		}
	}
	return failures;
}

export function findMutableActionReferences(source) {
	const failures = [];
	for (const [index, line] of source.split('\n').entries()) {
		const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/u);
		if (!match || match[1].startsWith('./') || match[1].includes('@')) {
			if (match && !match[1].startsWith('./') && !/@[0-9a-f]{40}$/u.test(match[1])) {
				const [action, reference] = match[1].split('@');
				failures.push({ action, line: index + 1, reference });
			}
			continue;
		}
	}
	return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const failures = await findUnpinnedActions();
	if (failures.length > 0) throw new Error(`Unpinned GitHub Actions:\n${failures.join('\n')}`);
}
