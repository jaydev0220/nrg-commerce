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

export function redactSensitiveText(value: string): string {
	return textRedactionPatterns.reduce(
		(redactedValue, [pattern, replacement]) => redactedValue.replace(pattern, replacement),
		value
	);
}

export function redactLogValue(value: unknown): Prisma.InputJsonValue | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') return redactSensitiveText(value);
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, nestedValue]) => [
				key,
				sensitiveLogKeyPattern.test(key) ? '[REDACTED]' : redactLogValue(nestedValue)
			])
		);
	}

	return String(value);
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

export function serializeLogError(error: unknown, seen = new Set<unknown>()): SerializedLogError {
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
		cause: cause === undefined ? null : serializeLogError(cause, seen)
	};
}
