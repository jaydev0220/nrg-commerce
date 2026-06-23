import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';

import type { Application } from 'express';

type RequestOptions = {
	method?: string;
	path: string;
	headers?: Record<string, string>;
	body?: string;
};

type TestResponse = {
	status: number;
	headers: Record<string, string | string[]>;
	text(): string;
	json<T>(): T;
};

class MockSocket extends Duplex {
	remoteAddress = '127.0.0.1';

	override _read(): void {}

	override _write(
		_chunk: Buffer | string,
		_encoding: BufferEncoding,
		callback: (error?: Error | null) => void
	): void {
		callback();
	}

	setTimeout(): this {
		return this;
	}

	setNoDelay(): this {
		return this;
	}

	setKeepAlive(): this {
		return this;
	}

	override destroy(error?: Error): this {
		if (error) {
			this.emit('error', error);
		}

		this.emit('close');
		return this;
	}
}

function toBuffer(value: Buffer | string, encoding?: BufferEncoding): Buffer {
	return Buffer.isBuffer(value) ? value : Buffer.from(value, encoding);
}

function normalizeHeaders(
	headers: RequestOptions['headers'],
	body?: string
): Record<string, string> {
	const normalized = Object.fromEntries(
		Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
	);

	if (body !== undefined && normalized['content-length'] === undefined) {
		normalized['content-length'] = String(Buffer.byteLength(body));
	}

	return normalized;
}

export async function requestApp(
	app: Application,
	{ method = 'GET', path, headers, body }: RequestOptions
): Promise<TestResponse> {
	const socket = new MockSocket();
	const request = new IncomingMessage(socket as unknown as Socket);
	const requestHeaders = normalizeHeaders(headers, body);

	request.method = method;
	request.url = path;
	request.headers = requestHeaders;

	if (body !== undefined) {
		request.push(body);
	}

	request.push(null);

	const response = new ServerResponse(request);
	const bodyChunks: Buffer[] = [];
	const originalWrite = response.write.bind(response) as (
		chunk: Buffer | string,
		encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
		callback?: (error: Error | null | undefined) => void
	) => boolean;
	const originalEnd = response.end.bind(response) as (
		chunk?: Buffer | string,
		encoding?: BufferEncoding | (() => void),
		callback?: () => void
	) => ServerResponse<IncomingMessage>;

	response.write = ((
		chunk: Buffer | string,
		encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
		callback?: (error: Error | null | undefined) => void
	) => {
		bodyChunks.push(toBuffer(chunk, typeof encoding === 'string' ? encoding : undefined));
		return typeof encoding === 'function'
			? originalWrite(chunk, encoding)
			: originalWrite(chunk, encoding, callback);
	}) as ServerResponse['write'];

	response.end = ((
		chunk?: Buffer | string,
		encoding?: BufferEncoding | (() => void),
		callback?: () => void
	) => {
		if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
			bodyChunks.push(toBuffer(chunk, typeof encoding === 'string' ? encoding : undefined));
		}

		return typeof encoding === 'function'
			? originalEnd(chunk, encoding)
			: originalEnd(chunk, encoding, callback);
	}) as ServerResponse['end'];

	response.assignSocket(socket as unknown as Socket);

	await new Promise<void>((resolve, reject) => {
		response.on('finish', resolve);
		response.on('error', reject);
		(
			app as unknown as (
				req: IncomingMessage,
				res: ServerResponse,
				next: (error?: unknown) => void
			) => void
		)(request, response, reject);
	});

	const responseBody = Buffer.concat(bodyChunks).toString('utf8');
	const responseHeaders = Object.fromEntries(
		Object.entries(response.getHeaders()).map(([key, value]) => [
			key,
			Array.isArray(value) ? value.map(String) : String(value)
		])
	);

	return {
		status: response.statusCode,
		headers: responseHeaders,
		text() {
			return responseBody;
		},
		json<T>() {
			return JSON.parse(responseBody) as T;
		}
	};
}
