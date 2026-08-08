import { access, glob, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const frontendContracts = {
	admin: { requiresIndex: true },
	catalog: { requiresIndex: false },
	landing: { requiresIndex: true }
};

const runtimeSecretPattern =
	/(ACCESS_TOKEN_SECRET|REFRESH_TOKEN_SECRET|TURNSTILE_SECRET_KEY|DATABASE_URL)/u;

async function fileExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function verifyFrontendArtifact(
	app,
	root = fileURLToPath(new URL('../../', import.meta.url))
) {
	const contract = frontendContracts[app];
	if (!contract) throw new Error(`Unsupported frontend app: ${app}`);

	const artifactDirectory = join(root, 'apps', app, '.svelte-kit', 'cloudflare');
	const requiredFiles = ['_worker.js', '_headers'];
	if (contract.requiresIndex) requiredFiles.push('index.html');

	const failures = [];
	if (!(await fileExists(artifactDirectory))) {
		failures.push(`artifact directory is missing: ${artifactDirectory}`);
	} else {
		for (const relativePath of requiredFiles) {
			if (!(await fileExists(join(artifactDirectory, relativePath)))) {
				failures.push(`required file is missing: ${relativePath}`);
			}
		}

		const files = new Set();
		for (const pattern of ['**/*.js', '**/*.html']) {
			for await (const relativePath of glob(pattern, { cwd: artifactDirectory })) {
				files.add(relativePath);
			}
		}
		for (const relativePath of files) {
			const source = await readFile(join(artifactDirectory, relativePath), 'utf8');
			const match = source.match(runtimeSecretPattern);
			if (match) {
				failures.push(`runtime secret pattern ${match[1]} found in ${relativePath}`);
			}
		}
	}

	if (failures.length > 0) {
		throw new Error(`Frontend artifact validation failed for ${app}:\n- ${failures.join('\n- ')}`);
	}

	process.stdout.write(`Frontend artifact for ${app} is valid (${artifactDirectory}).\n`);
	return { app, artifactDirectory };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await verifyFrontendArtifact(process.argv[2]);
}
