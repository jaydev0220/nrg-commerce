import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const immutableReferencePattern = /^[0-9a-f]{40}$/u;
const actionReferencePattern = /^\s*(?:-\s*)?uses:\s*([^\s#]+)@([^\s#]+)/u;

export function findMutableActionReferences(source) {
	const findings = [];

	for (const [index, line] of source.split(/\r?\n/u).entries()) {
		const match = actionReferencePattern.exec(line);
		if (!match || match[1].startsWith('./') || immutableReferencePattern.test(match[2])) continue;

		findings.push({
			action: match[1],
			line: index + 1,
			reference: match[2]
		});
	}

	return findings;
}

export async function verifyActionsPinned(workflowPath) {
	const source = await readFile(workflowPath, 'utf8');
	const findings = findMutableActionReferences(source);
	if (findings.length === 0) return;

	const details = findings
		.map(({ action, line, reference }) => `${workflowPath}:${line} uses ${action}@${reference}`)
		.join('\n');
	throw new Error(`External GitHub Actions must use full commit SHAs:\n${details}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await verifyActionsPinned(process.argv[2] ?? '.github/workflows/ci-deploy.yml');
	process.stdout.write('GitHub Action references are pinned.\n');
}
