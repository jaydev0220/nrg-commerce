export type MockApiConfig = {
	host: string;
	port: number;
	scenario: string;
	publicOrigin: string;
};

type ParsedArguments = {
	host?: string;
	port?: string;
	scenario?: string;
};

function parseArguments(argumentsList: string[]): ParsedArguments {
	const parsed: ParsedArguments = {};
	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		if (!argument) continue;

		const [flag, inlineValue] = argument.split('=', 2);
		if (!['--host', '--port', '--scenario'].includes(flag ?? '')) continue;
		const value = inlineValue ?? argumentsList[index + 1];
		if (!value || value.startsWith('--')) {
			throw new Error(`${flag} requires a value.`);
		}
		if (inlineValue === undefined) index += 1;
		if (flag === '--host') parsed.host = value;
		if (flag === '--port') parsed.port = value;
		if (flag === '--scenario') parsed.scenario = value;
	}
	return parsed;
}

function parsePort(value: string): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error(`Invalid mock API port: ${value}`);
	}
	return port;
}

export function loadConfig(argumentsList = process.argv.slice(2)): MockApiConfig {
	const argumentsConfig = parseArguments(argumentsList);
	const host = argumentsConfig.host ?? process.env['MOCK_API_HOST']?.trim() ?? '127.0.0.1';
	const port = parsePort(argumentsConfig.port ?? process.env['MOCK_API_PORT']?.trim() ?? '3000');
	const scenario =
		argumentsConfig.scenario ?? process.env['MOCK_API_SCENARIO']?.trim() ?? 'default';
	const publicHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
	const publicOrigin =
		process.env['MOCK_API_PUBLIC_ORIGIN']?.trim() ?? `http://${publicHost}:${port}`;

	return { host, port, scenario, publicOrigin };
}
