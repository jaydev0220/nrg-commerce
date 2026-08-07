import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function writeReleaseManifest(path, values = process.env) {
	const manifest = {
		commit: values.GITHUB_SHA ?? '',
		image: values.API_IMAGE_DIGEST ?? '',
		terraformWorkspace: 'nrg-commerce-production',
		terraformRun: values.TF_RUN_ID ?? '',
		workerVersions: JSON.parse(values.WORKER_VERSIONS_JSON ?? '{}'),
		apiRevision: values.API_REVISION ?? '',
		migrations: values.MIGRATION_ID ?? '',
		startedAt: values.RELEASE_STARTED_AT ?? new Date().toISOString(),
		completedAt: new Date().toISOString(),
		outcome: values.RELEASE_OUTCOME ?? 'success'
	};
	await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
	await writeReleaseManifest(process.argv[2]);
