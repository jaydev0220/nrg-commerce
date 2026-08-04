import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolDirectory = fileURLToPath(new URL('../../../../tools/mock-api/', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(pnpm, ['exec', 'tsx', 'src/index.ts', '--scenario', 'e2e', '--port', '4174'], {
	cwd: toolDirectory,
	stdio: 'inherit'
});

function shutdown() {
	if (!child.killed) child.kill('SIGTERM');
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
child.once('exit', (code) => {
	process.exitCode = code ?? 1;
});
