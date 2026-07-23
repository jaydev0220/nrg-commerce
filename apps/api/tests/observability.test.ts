import assert from 'node:assert/strict';
import test from 'node:test';

import { readAppConfig } from '../src/config/app-config.js';
import { resolveOtlpSignalUrl, startObservability } from '../src/observability.js';

test('builds OTLP signal URLs from a base endpoint', () => {
	assert.equal(
		resolveOtlpSignalUrl('https://telemetry.example.com/collector/', 'traces'),
		'https://telemetry.example.com/collector/v1/traces'
	);
	assert.equal(
		resolveOtlpSignalUrl('http://collector.internal:4318', 'metrics'),
		'http://collector.internal:4318/v1/metrics'
	);
});

test('does not initialize an SDK when telemetry export is disabled', async () => {
	let factoryCalls = 0;
	const runtime = startObservability(readAppConfig({}), {
		createSdk: () => {
			factoryCalls += 1;
			throw new Error('SDK must not be created');
		}
	});

	await runtime.shutdown();
	assert.equal(factoryCalls, 0);
});

test('starts and shuts down the configured telemetry SDK once', async () => {
	let startCalls = 0;
	let shutdownCalls = 0;
	let configuration: Record<string, unknown> | undefined;
	const config = readAppConfig({
		OTEL_EXPORTER_OTLP_ENDPOINT: 'https://telemetry.example.com',
		OTEL_SERVICE_NAME: 'test-api',
		OTEL_METRIC_EXPORT_INTERVAL_MS: '5000'
	});
	const runtime = startObservability(config, {
		createSdk: (value) => {
			configuration = value;
			return {
				start: () => {
					startCalls += 1;
				},
				shutdown: async () => {
					shutdownCalls += 1;
				}
			};
		}
	});

	assert.equal(startCalls, 1);
	assert.equal(configuration?.['serviceName'], 'test-api');
	assert.ok(Array.isArray(configuration?.['instrumentations']));
	assert.ok(Array.isArray(configuration?.['metricReaders']));

	await runtime.shutdown();
	assert.equal(shutdownCalls, 1);
});
