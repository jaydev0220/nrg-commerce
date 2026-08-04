import { spawn } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const port = process.env.MOCK_API_PORT?.trim() || '3000';
const scenario = process.env.MOCK_API_SCENARIO?.trim();
const apiOrigin = `http://127.0.0.1:${port}`;
const children = new Set();
let shuttingDown = false;

function start(name, args, env = process.env) {
	const child = spawn(pnpm, args, {
		stdio: 'inherit',
		env: { ...env },
		windowsHide: false
	});
	children.add(child);
	child.once('error', (error) => {
		console.error(`${name} failed to start:`, error);
		shutdown(1);
	});
	child.once('exit', (code, signal) => {
		children.delete(child);
		if (shuttingDown) return;
		if (signal) console.error(`${name} exited from signal ${signal}.`);
		else console.error(`${name} exited with code ${code ?? 1}.`);
		shutdown(code ?? 1);
	});
	return child;
}

function shutdown(exitCode = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	process.exitCode = exitCode;
	for (const child of children) {
		if (!child.killed) child.kill('SIGTERM');
	}
}

const mockArgs = ['--filter', '@tools/mock-api', 'dev'];
if (scenario) mockArgs.push('--scenario', scenario);
start('mock-api', mockArgs, process.env);

const frontendEnvironment = {
	...process.env,
	PUBLIC_API_BASE_URL: apiOrigin
};
start('admin', ['--filter', '@apps/admin', 'dev'], frontendEnvironment);
start('catalog', ['--filter', '@apps/catalog', 'dev'], frontendEnvironment);

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
