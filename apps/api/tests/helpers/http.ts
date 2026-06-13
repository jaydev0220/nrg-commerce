import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Application } from 'express';

function resolveServer(target: Server | Application): Server {
	if (
		typeof (target as Server).address === 'function' &&
		typeof (target as Server).close === 'function'
	) {
		return target as Server;
	}

	return createServer(target as Parameters<typeof createServer>[0]);
}

export async function withServer<T>(
	target: Server | Application,
	run: (baseUrl: string) => Promise<T>
): Promise<T> {
	const server = resolveServer(target);

	await new Promise<void>((resolve) => server.listen(0, resolve));

	const address = server.address() as AddressInfo;
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		return await run(baseUrl);
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}
}
