import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, type NodeSDKConfiguration } from '@opentelemetry/sdk-node';

import type { AppConfig } from './config/app-config.js';

type TelemetrySdk = {
	start(): void;
	shutdown(): Promise<void>;
};

type ObservabilityDependencies = {
	createSdk?: (configuration: Partial<NodeSDKConfiguration>) => TelemetrySdk;
};

export type ObservabilityRuntime = {
	shutdown(): Promise<void>;
};

const redactedQueryParameters = [
	'access_token',
	'code',
	'credential',
	'password',
	'refresh_token',
	'secret',
	'sig',
	'Signature',
	'token',
	'AWSAccessKeyId',
	'X-Amz-Credential',
	'X-Amz-Security-Token',
	'X-Amz-Signature',
	'X-Goog-Signature'
];

function isHealthRequest(request: { url?: string }): boolean {
	const path = request.url?.split('?', 1)[0];
	return path === '/health/liveness' || path === '/health/readiness';
}

export function resolveOtlpSignalUrl(endpoint: string, signal: 'metrics' | 'traces'): string {
	const url = new URL(endpoint);
	url.pathname = `${url.pathname.replace(/\/+$/u, '')}/v1/${signal}`;
	return url.toString();
}

export function startObservability(
	config: AppConfig,
	dependencies: ObservabilityDependencies = {}
): ObservabilityRuntime {
	if (!config.otelExporterOtlpEndpoint) {
		return { shutdown: async () => undefined };
	}

	const createSdk = dependencies.createSdk ?? ((configuration) => new NodeSDK(configuration));
	const sdk = createSdk({
		serviceName: config.otelServiceName,
		traceExporter: new OTLPTraceExporter({
			url: resolveOtlpSignalUrl(config.otelExporterOtlpEndpoint, 'traces')
		}),
		metricReaders: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter({
					url: resolveOtlpSignalUrl(config.otelExporterOtlpEndpoint, 'metrics')
				}),
				exportIntervalMillis: config.otelMetricExportIntervalMs
			})
		],
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-dns': { enabled: false },
				'@opentelemetry/instrumentation-fs': { enabled: false },
				'@opentelemetry/instrumentation-http': {
					ignoreIncomingRequestHook: isHealthRequest,
					redactedQueryParams: redactedQueryParameters
				}
			})
		]
	});

	sdk.start();
	return { shutdown: () => sdk.shutdown() };
}
