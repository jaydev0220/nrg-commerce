import { lstat, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
	assertNoConfigurationErrors,
	confirmedUrl,
	emailAddress,
	fetchWithTimeout,
	positiveInteger,
	requiredText,
	unconfirmedOrigin
} from './http-operations.mjs';

const BURST_MULTIPLIER = 2;

export function buildRateOffsets(ratePerSecond, durationMs) {
	if (!Number.isInteger(ratePerSecond) || ratePerSecond <= 0 || durationMs <= 0) {
		throw new Error('Rate schedules require a positive integer rate and duration.');
	}
	const count = Math.floor((ratePerSecond * durationMs) / 1000);
	return Array.from({ length: count }, (_, index) => (index * 1000) / ratePerSecond);
}

function requiredInquiryTokenCount(config) {
	return (
		buildRateOffsets(config.inquiryRate, config.durationMs).length +
		buildRateOffsets(config.inquiryRate * BURST_MULTIPLIER, config.burstDurationMs).length
	);
}

async function readPrivateLines(path, expectedCount, dependencies, errors, options) {
	if (!path) return [];
	try {
		const metadata = await dependencies.stat(path);
		if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
			errors.push(`${options.name} must be a regular file with mode 0600.`);
			return [];
		}
		const contents = await dependencies.readFile(path, 'utf8');
		if (Buffer.byteLength(contents, 'utf8') > 4_194_304) {
			errors.push(`${options.name} exceeds the supported size.`);
			return [];
		}
		const values = contents
			.split(/\r?\n/u)
			.map((value) => value.trim())
			.filter(Boolean);
		if (
			values.some(
				(value) => value.length > options.maximum || /[\u0000-\u001f\u007f]/u.test(value)
			) ||
			(options.validate && values.some((value) => !options.validate(value))) ||
			new Set(values).size !== values.length
		) {
			errors.push(`${options.name} must contain unique valid values.`);
			return [];
		}
		if (values.length < expectedCount) {
			errors.push(`${options.name} requires at least ${expectedCount} unique values.`);
			return [];
		}
		return values.slice(0, expectedCount);
	} catch {
		errors.push(`${options.name} could not be read securely.`);
		return [];
	}
}

export async function parseCapacityEnvironment(
	environment,
	dependencies = { readFile, stat: lstat }
) {
	const errors = [];
	const durationSeconds = positiveInteger(environment, 'CAPACITY_DURATION_SECONDS', 60, errors, {
		minimum: 30,
		maximum: 900
	});
	const burstSeconds = positiveInteger(environment, 'CAPACITY_BURST_SECONDS', 10, errors, {
		minimum: 5,
		maximum: 60
	});
	const turnstileTestToken = environment['CAPACITY_TURNSTILE_TEST_TOKEN']?.trim() ?? '';
	let inquiryTokenFile = '';
	if (turnstileTestToken) {
		if (turnstileTestToken.length > 2048 || /[\u0000-\u001f\u007f]/u.test(turnstileTestToken)) {
			errors.push('CAPACITY_TURNSTILE_TEST_TOKEN has an invalid format.');
		}
		if (environment['CAPACITY_CONFIRM_TURNSTILE_TEST_MODE'] !== 'staging-test-secret') {
			errors.push(
				'CAPACITY_CONFIRM_TURNSTILE_TEST_MODE must confirm use of a staging test secret.'
			);
		}
		if (environment['CAPACITY_TURNSTILE_TOKENS_FILE']?.trim()) {
			errors.push('Configure either a Turnstile test token or a token file, not both.');
		}
	} else {
		inquiryTokenFile = requiredText(environment, 'CAPACITY_TURNSTILE_TOKENS_FILE', errors, {
			maximum: 4096
		});
	}
	const config = {
		apiBaseUrl: confirmedUrl(
			environment,
			'CAPACITY_API_BASE_URL',
			'CAPACITY_CONFIRMED_API_ORIGIN',
			errors,
			{ rootOnly: true }
		),
		contactUrl: confirmedUrl(
			environment,
			'CAPACITY_CONTACT_URL',
			'CAPACITY_CONFIRMED_CONTACT_ORIGIN',
			errors,
			{ pathname: '/inquiry' }
		),
		requestOrigin: unconfirmedOrigin(environment, 'CAPACITY_REQUEST_ORIGIN', errors),
		staffCookiesFile: requiredText(environment, 'CAPACITY_STAFF_COOKIES_FILE', errors, {
			maximum: 4096
		}),
		inquiryEmail: emailAddress(environment, 'CAPACITY_INQUIRY_EMAIL', errors),
		inquiryTokenFile,
		turnstileTestToken,
		durationMs: durationSeconds * 1000,
		burstDurationMs: burstSeconds * 1000,
		requestTimeoutMs:
			positiveInteger(environment, 'CAPACITY_REQUEST_TIMEOUT_SECONDS', 10, errors, {
				minimum: 1,
				maximum: 60
			}) * 1000,
		storefrontRate: positiveInteger(environment, 'CAPACITY_STOREFRONT_RATE', 100, errors, {
			minimum: 1,
			maximum: 5000
		}),
		staffConcurrency: positiveInteger(environment, 'CAPACITY_STAFF_CONCURRENCY', 20, errors, {
			minimum: 1,
			maximum: 500
		}),
		staffIntervalMs: positiveInteger(environment, 'CAPACITY_STAFF_INTERVAL_MS', 1000, errors, {
			minimum: 100,
			maximum: 60_000
		}),
		inquiryRate: positiveInteger(environment, 'CAPACITY_INQUIRY_RATE', 5, errors, {
			minimum: 1,
			maximum: 100
		})
	};

	const expectedInquiryTokenCount = requiredInquiryTokenCount(config);
	const [staffCookies, inquiryTokens] = await Promise.all([
		readPrivateLines(config.staffCookiesFile, config.staffConcurrency, dependencies, errors, {
			name: 'CAPACITY_STAFF_COOKIES_FILE',
			maximum: 8192,
			validate: (value) =>
				/^__Host-admin_access_token=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)
		}),
		config.turnstileTestToken
			? Promise.resolve(
					Array.from({ length: expectedInquiryTokenCount }, () => config.turnstileTestToken)
				)
			: readPrivateLines(config.inquiryTokenFile, expectedInquiryTokenCount, dependencies, errors, {
					name: 'CAPACITY_TURNSTILE_TOKENS_FILE',
					maximum: 2048
				})
	]);
	assertNoConfigurationErrors(errors, 'Invalid capacity-test environment');
	return { ...config, staffCookies, inquiryTokens };
}

export function buildCapacityPlan(config) {
	const availabilityThresholds = {
		maxErrorRate: 0.001,
		minRateRatio: 0.95
	};
	return [
		{
			name: 'storefront-steady',
			mode: 'rate',
			ratePerSecond: config.storefrontRate,
			durationMs: config.durationMs,
			thresholds: { ...availabilityThresholds, p95Ms: 500, p99Ms: 1500 }
		},
		{
			name: 'storefront-burst',
			mode: 'rate',
			ratePerSecond: config.storefrontRate * BURST_MULTIPLIER,
			durationMs: config.burstDurationMs,
			thresholds: { ...availabilityThresholds, p95Ms: 500, p99Ms: 1500 }
		},
		{
			name: 'staff-concurrency',
			mode: 'concurrency',
			concurrency: config.staffConcurrency,
			iterationDelayMs: config.staffIntervalMs,
			durationMs: config.durationMs,
			thresholds: { maxErrorRate: 0.001, p95Ms: 750, p99Ms: 1500 }
		},
		{
			name: 'inquiry-steady',
			mode: 'rate',
			ratePerSecond: config.inquiryRate,
			durationMs: config.durationMs,
			thresholds: { ...availabilityThresholds, p95Ms: 750, p99Ms: 1500 }
		},
		{
			name: 'inquiry-burst',
			mode: 'rate',
			ratePerSecond: config.inquiryRate * BURST_MULTIPLIER,
			durationMs: config.burstDurationMs,
			thresholds: { ...availabilityThresholds, p95Ms: 750, p99Ms: 1500 }
		}
	];
}

function percentile(sortedDurations, percentileValue) {
	if (sortedDurations.length === 0) return Number.POSITIVE_INFINITY;
	const index = Math.max(0, Math.ceil(percentileValue * sortedDurations.length) - 1);
	return sortedDurations[index];
}

export function summarizeScenario(scenario, samples, elapsedMs) {
	const sortedDurations = samples
		.map(({ durationMs }) => durationMs)
		.sort((left, right) => left - right);
	const failedCount = samples.filter(({ ok }) => !ok).length;
	const statusCounts = {};
	for (const sample of samples) {
		statusCounts[sample.status ?? 'unknown'] = (statusCounts[sample.status ?? 'unknown'] ?? 0) + 1;
	}
	const errorRate = samples.length === 0 ? 1 : failedCount / samples.length;
	const p95Ms = percentile(sortedDurations, 0.95);
	const p99Ms = percentile(sortedDurations, 0.99);
	const achievedRate = elapsedMs > 0 ? samples.length / (elapsedMs / 1000) : 0;
	const expectedCount =
		scenario.mode === 'rate'
			? buildRateOffsets(scenario.ratePerSecond, scenario.durationMs).length
			: undefined;
	const failures = [];
	if (errorRate > scenario.thresholds.maxErrorRate) failures.push('error rate');
	if (p95Ms > scenario.thresholds.p95Ms) failures.push('p95 latency');
	if (p99Ms > scenario.thresholds.p99Ms) failures.push('p99 latency');
	if (expectedCount !== undefined && samples.length !== expectedCount)
		failures.push('request count');
	if (
		scenario.mode === 'rate' &&
		achievedRate < scenario.ratePerSecond * scenario.thresholds.minRateRatio
	) {
		failures.push('achieved rate');
	}
	return {
		name: scenario.name,
		passed: failures.length === 0,
		failures,
		requestCount: samples.length,
		failedCount,
		statusCounts,
		errorRate,
		p95Ms,
		p99Ms,
		achievedRate
	};
}

async function sampleRequest(request, now) {
	const startedAt = now();
	try {
		const response = await request();
		await response.body?.cancel();
		return { ok: response.ok, status: response.status ?? 'unknown', durationMs: now() - startedAt };
	} catch {
		return { ok: false, status: 'network_error', durationMs: now() - startedAt };
	}
}

async function runRateScenario(scenario, request, dependencies) {
	const startedAt = dependencies.now();
	const pending = new Set();
	const samples = [];
	for (const offset of buildRateOffsets(scenario.ratePerSecond, scenario.durationMs)) {
		const waitMs = startedAt + offset - dependencies.now();
		if (waitMs > 0) await dependencies.sleep(waitMs);
		const pendingRequest = sampleRequest(request, dependencies.now).then((sample) => {
			samples.push(sample);
			pending.delete(pendingRequest);
		});
		pending.add(pendingRequest);
		if (pending.size >= 1000) await Promise.race(pending);
	}
	await Promise.all(pending);
	return summarizeScenario(scenario, samples, dependencies.now() - startedAt);
}

async function runConcurrencyScenario(scenario, request, dependencies) {
	const startedAt = dependencies.now();
	const deadline = startedAt + scenario.durationMs;
	const samples = [];
	await Promise.all(
		Array.from({ length: scenario.concurrency }, async (_, workerIndex) => {
			while (dependencies.now() < deadline) {
				const iterationStartedAt = dependencies.now();
				samples.push(await sampleRequest(() => request(workerIndex), dependencies.now));
				const waitMs = Math.min(
					scenario.iterationDelayMs - (dependencies.now() - iterationStartedAt),
					deadline - dependencies.now()
				);
				if (waitMs > 0) await dependencies.sleep(waitMs);
			}
		})
	);
	return summarizeScenario(scenario, samples, dependencies.now() - startedAt);
}

export function runCapacityScenario(scenario, request, dependencies = {}) {
	const runtime = {
		now: dependencies.now ?? performance.now.bind(performance),
		sleep:
			dependencies.sleep ??
			((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
	};
	if (scenario.mode === 'rate') return runRateScenario(scenario, request, runtime);
	if (scenario.mode === 'concurrency') {
		return runConcurrencyScenario(scenario, request, runtime);
	}
	throw new Error(`Unsupported capacity scenario mode: ${scenario.mode}`);
}

function createRequests(config, fetchImplementation) {
	let inquiryTokenIndex = 0;
	const request = async (url, init, expectedStatus) => {
		const response = await fetchWithTimeout(
			fetchImplementation,
			url,
			init,
			config.requestTimeoutMs
		);
		return {
			ok: response.status === expectedStatus,
			status: response.status,
			body: response.body
		};
	};
	return {
		storefront: () =>
			request(
				`${config.apiBaseUrl}/api/storefront/products?page=1&limit=20`,
				{
					headers: { accept: 'application/json' }
				},
				200
			),
		staff: (workerIndex) =>
			request(
				`${config.apiBaseUrl}/api/management/dashboard?range=days`,
				{
					headers: { accept: 'application/json', cookie: config.staffCookies[workerIndex] }
				},
				200
			),
		inquiry: () => {
			const turnstileToken = config.inquiryTokens[inquiryTokenIndex++];
			if (!turnstileToken) throw new Error('The inquiry token supply was exhausted.');
			return request(
				config.contactUrl,
				{
					method: 'POST',
					headers: {
						accept: 'application/json',
						'content-type': 'application/json',
						origin: config.requestOrigin
					},
					body: JSON.stringify({
						turnstileToken,
						name: 'Capacity Test',
						email: config.inquiryEmail,
						message: 'Automated staging capacity test request.'
					})
				},
				202
			);
		}
	};
}

export async function runCapacityTest(config, dependencies = {}) {
	const runtime = {
		fetch: dependencies.fetch ?? globalThis.fetch,
		now: dependencies.now ?? performance.now.bind(performance),
		sleep:
			dependencies.sleep ??
			((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
	};
	const plan = buildCapacityPlan(config);
	const byName = new Map(plan.map((scenario) => [scenario.name, scenario]));
	const requests = createRequests(config, runtime.fetch);
	const steadyResults = await Promise.all([
		runCapacityScenario(byName.get('storefront-steady'), requests.storefront, runtime),
		runCapacityScenario(byName.get('staff-concurrency'), requests.staff, runtime),
		runCapacityScenario(byName.get('inquiry-steady'), requests.inquiry, runtime)
	]);
	const burstResults = await Promise.all([
		runCapacityScenario(byName.get('storefront-burst'), requests.storefront, runtime),
		runCapacityScenario(byName.get('inquiry-burst'), requests.inquiry, runtime)
	]);
	return [...steadyResults, ...burstResults];
}

export function formatCapacityResult(result) {
	const statuses = Object.entries(result.statusCounts)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([status, count]) => `${status}:${count}`)
		.join(',');
	return [
		result.passed ? 'PASS' : 'FAIL',
		result.name,
		`${result.requestCount} requests`,
		`${(result.errorRate * 100).toFixed(2)}% errors`,
		`p95 ${Math.round(result.p95Ms)} ms`,
		`p99 ${Math.round(result.p99Ms)} ms`,
		`${result.achievedRate.toFixed(1)} req/s`,
		`statuses ${statuses}`,
		...(result.failures.length > 0 ? [`failed ${result.failures.join(', ')}`] : [])
	].join(' | ');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	try {
		const config = await parseCapacityEnvironment(process.env);
		const results = await runCapacityTest(config);
		for (const result of results) process.stdout.write(`${formatCapacityResult(result)}\n`);
		if (results.some(({ passed }) => !passed)) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : 'Capacity test failed.'}\n`);
		process.exitCode = 1;
	}
}
