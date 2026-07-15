import pino, { type DestinationStream } from 'pino';
import type { LogLevel } from '@packages/database';

export type ApiLogger = {
	debug(metadata: Record<string, unknown>, message: string): void;
	info(metadata: Record<string, unknown>, message: string): void;
	warn(metadata: Record<string, unknown>, message: string): void;
	error(metadata: Record<string, unknown>, message: string): void;
	fatal(metadata: Record<string, unknown>, message: string): void;
};

export function createApiLogger(options: {
	level: LogLevel;
	destination?: DestinationStream;
}): ApiLogger {
	return pino(
		{
			level: options.level,
			base: undefined,
			serializers: {
				err: pino.stdSerializers.err
			}
		},
		options.destination
	) as ApiLogger;
}
