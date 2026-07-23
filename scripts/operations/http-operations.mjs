const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;

export function isLoopbackHostname(hostname) {
	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname === '127.0.0.1' ||
		hostname === '[::1]'
	);
}

export function requiredText(environment, name, errors, options = {}) {
	const value = environment[name]?.trim() ?? '';
	const maximum = options.maximum ?? 8192;
	if (!value) {
		errors.push(`${name} is required.`);
		return '';
	}
	if (value.length > maximum || controlCharacterPattern.test(value)) {
		errors.push(`${name} has an invalid format.`);
		return '';
	}
	return value;
}

export function requiredSecret(environment, name, errors, options = {}) {
	const value = environment[name] ?? '';
	const maximum = options.maximum ?? 8192;
	if (!value) {
		errors.push(`${name} is required.`);
		return '';
	}
	if (value.length > maximum || controlCharacterPattern.test(value)) {
		errors.push(`${name} has an invalid format.`);
		return '';
	}
	return value;
}

export function positiveInteger(environment, name, fallback, errors, options = {}) {
	const raw = environment[name]?.trim();
	if (!raw) return fallback;
	if (!/^\d+$/u.test(raw)) {
		errors.push(`${name} must be an integer.`);
		return fallback;
	}
	const value = Number(raw);
	if (
		!Number.isSafeInteger(value) ||
		value < (options.minimum ?? 1) ||
		value > (options.maximum ?? Number.MAX_SAFE_INTEGER)
	) {
		errors.push(`${name} is outside the supported range.`);
		return fallback;
	}
	return value;
}

export function emailAddress(environment, name, errors) {
	const value = requiredText(environment, name, errors, { maximum: 254 }).toLowerCase();
	if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
		errors.push(`${name} must be an email address.`);
		return '';
	}
	return value;
}

export function confirmedUrl(environment, name, confirmationName, errors, options = {}) {
	const value = requiredText(environment, name, errors, { maximum: 2048 });
	if (!value) return '';

	try {
		const url = new URL(value);
		const loopback = isLoopbackHostname(url.hostname);
		const allowedProtocol = url.protocol === 'https:' || (loopback && url.protocol === 'http:');
		if (
			!allowedProtocol ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			(options.rootOnly && url.pathname !== '/') ||
			(options.pathname && url.pathname !== options.pathname)
		) {
			throw new Error('invalid URL');
		}

		if (!loopback) {
			const confirmation = environment[confirmationName]?.trim();
			if (confirmation !== url.origin) {
				errors.push(`${confirmationName} must exactly match the ${name} origin.`);
			}
		}
		return options.rootOnly ? url.origin : url.href.replace(/\/$/u, '');
	} catch {
		errors.push(`${name} must be an HTTPS URL without credentials, query, or fragment.`);
		return '';
	}
}

export function unconfirmedOrigin(environment, name, errors) {
	const value = requiredText(environment, name, errors, { maximum: 2048 });
	if (!value) return '';
	try {
		const url = new URL(value);
		const loopback = isLoopbackHostname(url.hostname);
		if (
			(url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
			url.username ||
			url.password ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		) {
			throw new Error('invalid origin');
		}
		return url.origin;
	} catch {
		errors.push(`${name} must be an HTTPS origin without credentials or a path.`);
		return '';
	}
}

export async function fetchWithTimeout(fetchImplementation, input, init, timeoutMs) {
	return fetchImplementation(input, {
		...init,
		redirect: 'error',
		signal: AbortSignal.timeout(timeoutMs)
	});
}

export async function readBoundedJson(response, maximumBytes = 1_048_576) {
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
		throw new Error('Response body exceeded the verification limit.');
	}
	if (!response.body) throw new Error('Response body was not valid JSON.');

	const reader = response.body.getReader();
	const chunks = [];
	let receivedBytes = 0;
	while (true) {
		const chunk = await reader.read();
		if (chunk.done) break;
		receivedBytes += chunk.value.byteLength;
		if (receivedBytes > maximumBytes) {
			await reader.cancel();
			throw new Error('Response body exceeded the verification limit.');
		}
		chunks.push(chunk.value);
	}
	const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
	try {
		return JSON.parse(text);
	} catch {
		throw new Error('Response body was not valid JSON.');
	}
}

export function assertNoConfigurationErrors(errors, label) {
	if (errors.length > 0) throw new Error(`${label}:\n${errors.join('\n')}`);
}
