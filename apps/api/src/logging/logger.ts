import pino, { type DestinationStream } from 'pino';
import type { LogLevel } from '@packages/database';
import { isSpanContextValid, trace } from '@opentelemetry/api';

export type ApiLogger = {
	debug(metadata: Record<string, unknown>, message: string): void;
	info(metadata: Record<string, unknown>, message: string): void;
	warn(metadata: Record<string, unknown>, message: string): void;
	error(metadata: Record<string, unknown>, message: string): void;
	fatal(metadata: Record<string, unknown>, message: string): void;
};

type TraceMetadata = {
	traceId: string;
	spanId: string;
};

function getActiveTraceMetadata(): TraceMetadata | undefined {
	const spanContext = trace.getActiveSpan()?.spanContext();
	if (!spanContext || !isSpanContextValid(spanContext)) return undefined;

	return {
		traceId: spanContext.traceId,
		spanId: spanContext.spanId
	};
}

export function createApiLogger(options: {
	level: LogLevel;
	destination?: DestinationStream;
	getTraceMetadata?: () => TraceMetadata | undefined;
}): ApiLogger {
	return pino(
		{
			level: options.level,
			base: undefined,
			mixin: () => (options.getTraceMetadata ?? getActiveTraceMetadata)() ?? {},
			serializers: {
				err: pino.stdSerializers.err
			}
		},
		options.destination
	) as ApiLogger;
}
