import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildCapacityPlan,
	buildRateOffsets,
	formatCapacityResult,
	parseCapacityEnvironment,
	runCapacityScenario,
	runCapacityTest,
	summarizeScenario
} from '../../../scripts/operations/verify-capacity.mjs';

const remoteEnvironment = {
	CAPACITY_API_BASE_URL: 'https://api.staging.example.com',
	CAPACITY_CONTACT_URL: 'https://contact.staging.example.com/inquiry',
	CAPACITY_REQUEST_ORIGIN: 'https://catalog.staging.example.com',
	CAPACITY_CONFIRMED_API_ORIGIN: 'https://api.staging.example.com',
	CAPACITY_CONFIRMED_CONTACT_ORIGIN: 'https://contact.staging.example.com',
	CAPACITY_STAFF_COOKIES_FILE: '/run/secrets/staff-cookies.txt',
	CAPACITY_INQUIRY_EMAIL: 'load-test@example.com',
	CAPACITY_TURNSTILE_TOKENS_FILE: '/run/secrets/turnstile.tokens',
	CAPACITY_DURATION_SECONDS: '60',
	CAPACITY_BURST_SECONDS: '10'
};

function tokenFile(count = 400) {
	return Array.from({ length: count }, (_, index) => `turnstile-token-${index}`).join('\n');
}

function cookieFile(count = 20) {
	return Array.from(
		{ length: count },
		(_, index) => `__Host-admin_access_token=header-${index}.payload-${index}.signature-${index}`
	).join('\n');
}

const secureTokenFile = {
	readFile: async (path) => (path.includes('staff-cookies') ? cookieFile() : tokenFile()),
	stat: async () => ({ isFile: () => true, mode: 0o100600 })
};

test('capacity configuration requires explicit confirmation for every remote target', async () => {
	await assert.rejects(
		() =>
			parseCapacityEnvironment(
				{ ...remoteEnvironment, CAPACITY_CONFIRMED_API_ORIGIN: 'https://api.example.com' },
				secureTokenFile
			),
		/CAPACITY_CONFIRMED_API_ORIGIN/u
	);
});

test('capacity configuration loads unique Turnstile tokens from a private file', async () => {
	const config = await parseCapacityEnvironment(remoteEnvironment, secureTokenFile);

	assert.equal(config.apiBaseUrl, 'https://api.staging.example.com');
	assert.equal(config.contactUrl, 'https://contact.staging.example.com/inquiry');
	assert.equal(config.storefrontRate, 100);
	assert.equal(config.staffConcurrency, 20);
	assert.equal(config.inquiryRate, 5);
	assert.equal(config.inquiryTokens.length, 400);
	assert.equal(config.staffCookies.length, 20);
	assert.equal(config.staffIntervalMs, 1000);
});

test('capacity configuration permits an explicitly confirmed staging Turnstile test token', async () => {
	const config = await parseCapacityEnvironment(
		{
			...remoteEnvironment,
			CAPACITY_TURNSTILE_TOKENS_FILE: '',
			CAPACITY_TURNSTILE_TEST_TOKEN: 'XXXX.DUMMY.TOKEN.XXXX',
			CAPACITY_CONFIRM_TURNSTILE_TEST_MODE: 'staging-test-secret'
		},
		{
			readFile: async () => cookieFile(),
			stat: secureTokenFile.stat
		}
	);

	assert.equal(config.inquiryTokens.length, 400);
	assert.equal(new Set(config.inquiryTokens).size, 1);
	assert.equal(config.inquiryTokens[0], 'XXXX.DUMMY.TOKEN.XXXX');

	await assert.rejects(() =>
		parseCapacityEnvironment(
			{
				...remoteEnvironment,
				CAPACITY_TURNSTILE_TOKENS_FILE: '',
				CAPACITY_TURNSTILE_TEST_TOKEN: 'XXXX.DUMMY.TOKEN.XXXX'
			},
			{ readFile: async () => cookieFile(), stat: secureTokenFile.stat }
		)
	);
});

test('capacity configuration rejects reusable, exposed, or insufficient Turnstile tokens', async () => {
	for (const dependencies of [
		{
			readFile: async (path) =>
				path.includes('staff-cookies') ? cookieFile() : 'duplicate\nduplicate\n',
			stat: secureTokenFile.stat
		},
		{
			readFile: secureTokenFile.readFile,
			stat: async (path) => ({
				isFile: () => true,
				mode: path.includes('turnstile') ? 0o100644 : 0o100600
			})
		},
		{
			readFile: async (path) => (path.includes('staff-cookies') ? cookieFile() : tokenFile(399)),
			stat: secureTokenFile.stat
		}
	]) {
		await assert.rejects(() => parseCapacityEnvironment(remoteEnvironment, dependencies));
	}
});

test('capacity errors never include cookie or token values', async () => {
	await assert.rejects(
		() =>
			parseCapacityEnvironment(remoteEnvironment, {
				...secureTokenFile,
				readFile: async (path) =>
					path.includes('staff-cookies') ? 'private-cookie\u0000injected' : tokenFile()
			}),
		(error) => {
			assert.ok(error instanceof Error);
			assert.doesNotMatch(error.message, /private-cookie|turnstile-token/iu);
			return true;
		}
	);
});

test('capacity configuration rejects non-access and compound cookie headers', async () => {
	for (const cookie of [
		'__Host-admin_refresh_token=private-refresh-token',
		'__Host-admin_access_token=access-token; __Host-admin_refresh_token=private-refresh-token'
	]) {
		await assert.rejects(
			() =>
				parseCapacityEnvironment(remoteEnvironment, {
					...secureTokenFile,
					readFile: async (path) =>
						path.includes('staff-cookies')
							? Array.from({ length: 20 }, (_, index) => `${cookie}-${index}`).join('\n')
							: tokenFile()
				}),
			(error) => {
				assert.ok(error instanceof Error);
				assert.match(error.message, /CAPACITY_STAFF_COOKIES_FILE/u);
				assert.doesNotMatch(error.message, /private-refresh-token|access-token/iu);
				return true;
			}
		);
	}
});

test('fixed-rate schedules contain the expected evenly spaced request count', () => {
	assert.deepEqual(buildRateOffsets(5, 1000), [0, 200, 400, 600, 800]);
	assert.equal(buildRateOffsets(200, 10_000).length, 2000);
	assert.throws(() => buildRateOffsets(0, 1000), /positive integer/u);
	assert.throws(() => buildRateOffsets(1, 0), /positive integer/u);
});

test('capacity plan covers steady and burst public traffic plus staff concurrency', async () => {
	const config = await parseCapacityEnvironment(remoteEnvironment, secureTokenFile);
	const plan = buildCapacityPlan(config);

	assert.deepEqual(
		plan.map(({ name, mode }) => [name, mode]),
		[
			['storefront-steady', 'rate'],
			['storefront-burst', 'rate'],
			['staff-concurrency', 'concurrency'],
			['inquiry-steady', 'rate'],
			['inquiry-burst', 'rate']
		]
	);
	assert.equal(plan[0]?.ratePerSecond, 100);
	assert.equal(plan[1]?.ratePerSecond, 200);
	assert.equal(plan[2]?.concurrency, 20);
	assert.equal(plan[2]?.iterationDelayMs, 1000);
	assert.equal(plan[3]?.ratePerSecond, 5);
	assert.equal(plan[4]?.ratePerSecond, 10);
});

test('scenario summaries enforce error, latency, and achieved-rate thresholds', () => {
	const passing = summarizeScenario(
		{
			name: 'storefront-steady',
			mode: 'rate',
			ratePerSecond: 2,
			durationMs: 1000,
			thresholds: { maxErrorRate: 0.01, p95Ms: 500, p99Ms: 1500, minRateRatio: 0.95 }
		},
		[
			{ ok: true, durationMs: 100 },
			{ ok: true, durationMs: 200 }
		],
		1000
	);
	assert.equal(passing.passed, true);

	const failing = summarizeScenario(
		{
			name: 'storefront-steady',
			mode: 'rate',
			ratePerSecond: 2,
			durationMs: 1000,
			thresholds: { maxErrorRate: 0.01, p95Ms: 150, p99Ms: 300, minRateRatio: 0.95 }
		},
		[
			{ ok: true, durationMs: 100 },
			{ ok: false, durationMs: 400 }
		],
		2000
	);
	assert.equal(failing.passed, false);
	assert.ok(failing.failures.length >= 2);
});

test('rate scenarios execute every scheduled request and record failures', async () => {
	let currentTime = 0;
	let requestCount = 0;
	const result = await runCapacityScenario(
		{
			name: 'test-rate',
			mode: 'rate',
			ratePerSecond: 4,
			durationMs: 1000,
			thresholds: { maxErrorRate: 0, p95Ms: 100, p99Ms: 100, minRateRatio: 0 }
		},
		async () => {
			requestCount += 1;
			currentTime += 10;
			return new Response(null, { status: requestCount === 3 ? 500 : 200 });
		},
		{
			now: () => currentTime,
			sleep: async (milliseconds) => {
				currentTime += milliseconds;
			}
		}
	);

	assert.equal(requestCount, 4);
	assert.equal(result.requestCount, 4);
	assert.equal(result.failedCount, 1);
	assert.deepEqual(result.statusCounts, { 200: 3, 500: 1 });
	assert.equal(result.passed, false);
});

test('capacity runner executes steady and burst workloads with distinct staff sessions', async () => {
	const calls = [];
	const config = {
		apiBaseUrl: 'http://127.0.0.1:3000',
		contactUrl: 'http://127.0.0.1:8787/inquiry',
		requestOrigin: 'http://127.0.0.1:4175',
		staffCookies: ['session=one', 'session=two'],
		inquiryEmail: 'load@example.com',
		inquiryTokens: ['token-1', 'token-2', 'token-3'],
		durationMs: 100,
		burstDurationMs: 100,
		requestTimeoutMs: 1000,
		storefrontRate: 10,
		staffConcurrency: 2,
		staffIntervalMs: 50,
		inquiryRate: 10
	};
	const results = await runCapacityTest(config, {
		fetch: async (input, init = {}) => {
			const url = new URL(input);
			calls.push({ url, init });
			return new Response(null, {
				status: url.pathname === '/inquiry' ? 202 : 200
			});
		}
	});

	assert.equal(results.length, 5);
	assert.equal(
		results.every(({ passed }) => passed),
		true
	);
	assert.equal(calls.filter(({ url }) => url.pathname === '/api/storefront/products').length, 3);
	assert.equal(calls.filter(({ url }) => url.pathname === '/inquiry').length, 3);
	const staffCookies = new Set(
		calls
			.filter(({ url }) => url.pathname === '/api/management/dashboard')
			.map(({ init }) => init.headers.cookie)
	);
	assert.deepEqual(staffCookies, new Set(['session=one', 'session=two']));
});

test('capacity scenarios classify network failures and reject unknown modes', async () => {
	let currentTime = 0;
	const failed = await runCapacityScenario(
		{
			name: 'network-failure',
			mode: 'rate',
			ratePerSecond: 1,
			durationMs: 1000,
			thresholds: { maxErrorRate: 0, p95Ms: 100, p99Ms: 100, minRateRatio: 0 }
		},
		async () => {
			currentTime += 5;
			throw new Error('network failed');
		},
		{ now: () => currentTime, sleep: async (milliseconds) => (currentTime += milliseconds) }
	);
	assert.deepEqual(failed.statusCounts, { network_error: 1 });
	assert.equal(failed.passed, false);
	assert.throws(
		() => runCapacityScenario({ mode: 'unsupported' }, async () => new Response()),
		/Unsupported capacity scenario mode/u
	);
});

test('capacity result formatting includes status and failed-threshold diagnostics', () => {
	const line = formatCapacityResult({
		passed: false,
		name: 'storefront-steady',
		requestCount: 2,
		errorRate: 0.5,
		p95Ms: 501,
		p99Ms: 700,
		achievedRate: 1.5,
		statusCounts: { 200: 1, 500: 1 },
		failures: ['error rate', 'p95 latency']
	});

	assert.match(line, /^FAIL \| storefront-steady/u);
	assert.match(line, /statuses 200:1,500:1/u);
	assert.match(line, /failed error rate, p95 latency/u);
});
