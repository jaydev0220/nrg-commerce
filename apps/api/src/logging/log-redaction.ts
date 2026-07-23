import type { Prisma } from '@packages/database';

const sensitiveLogKeyPattern =
	/(password|passphrase|secret|token|cookie|authorization|credential|publicKey|userHandle)/i;

const textRedactionPatterns: Array<[RegExp, string]> = [
	[/(^|[\s"'=])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '$1[REDACTED]'],
	[/(authorization\s*[:=]\s*)(?!bearer\s+|basic\s+)[^\s,;]+/gi, '$1[REDACTED]'],
	[/((?:bearer|basic)\s+)[^\s,;]+/gi, '$1[REDACTED]'],
	[/((?:password|passphrase|secret|token|api[_-]?key|cookie)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]'],
	[/(\b(?:postgres(?:ql)?|mysql):\/\/)[^\s:/]+:[^\s@]+@/gi, '$1[REDACTED]:[REDACTED]@']
];
const maximumLogDepth = 12;
const maximumLogCollectionEntries = 100;
const maximumLogStringLength = 10_000;

export function redactSensitiveText(value: string): string {
	return textRedactionPatterns.reduce(
		(redactedValue, [pattern, replacement]) => redactedValue.replace(pattern, replacement),
		value
	);
}

function redactLogValueInternal(
	value: unknown,
	seen: WeakSet<object>,
	depth: number
): Prisma.InputJsonValue | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') {
		return redactSensitiveText(value).slice(0, maximumLogStringLength);
	}
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (depth >= maximumLogDepth) return '[TRUNCATED]';
	if (typeof value === 'object') {
		if (seen.has(value)) return '[CIRCULAR]';
		seen.add(value);
	}
	if (Array.isArray(value)) {
		return value
			.slice(0, maximumLogCollectionEntries)
			.map((item) => redactLogValueInternal(item, seen, depth + 1));
	}
	if (typeof value === 'object') {
		try {
			return Object.fromEntries(
				Object.entries(value)
					.slice(0, maximumLogCollectionEntries)
					.map(([key, nestedValue]) => [
						key.slice(0, 200),
						sensitiveLogKeyPattern.test(key)
							? '[REDACTED]'
							: redactLogValueInternal(nestedValue, seen, depth + 1)
					])
			);
		} catch {
			return '[UNSERIALIZABLE]';
		}
	}

	try {
		return redactSensitiveText(String(value)).slice(0, maximumLogStringLength);
	} catch {
		return '[UNSERIALIZABLE]';
	}
}

export function redactLogValue(value: unknown): Prisma.InputJsonValue | null {
	return redactLogValueInternal(value, new WeakSet(), 0);
}

type SerializedLogError = {
	name: string;
	message: string;
	stack: string | null;
	code: string | null;
	meta: Prisma.InputJsonValue | null;
	cause: SerializedLogError | null;
};

function readErrorProperty(error: object, key: string): unknown {
	return key in error ? Reflect.get(error, key) : undefined;
}

export function serializeLogError(
	error: unknown,
	seen = new Set<unknown>(),
	depth = 0
): SerializedLogError {
	if (depth >= maximumLogDepth) {
		return {
			name: 'TruncatedError',
			message: '[TRUNCATED]',
			stack: null,
			code: null,
			meta: null,
			cause: null
		};
	}
	if (seen.has(error)) {
		return {
			name: 'CircularError',
			message: '[REDACTED]',
			stack: null,
			code: null,
			meta: null,
			cause: null
		};
	}

	seen.add(error);

	if (!(error instanceof Error)) {
		return {
			name: 'UnknownError',
			message: redactSensitiveText(String(error)),
			stack: null,
			code: null,
			meta: null,
			cause: null
		};
	}

	const code = readErrorProperty(error, 'code');
	const meta = readErrorProperty(error, 'meta');
	const cause = readErrorProperty(error, 'cause');

	return {
		name: redactSensitiveText(error.name),
		message: redactSensitiveText(error.message),
		stack: error.stack ? redactSensitiveText(error.stack) : null,
		code: typeof code === 'string' ? redactSensitiveText(code) : null,
		meta: redactLogValue(meta),
		cause: cause === undefined ? null : serializeLogError(cause, seen, depth + 1)
	};
}
