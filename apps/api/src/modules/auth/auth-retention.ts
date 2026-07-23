import type { AuthRepository } from './auth.repository.js';

type AuthSessionRetentionRepository = Pick<AuthRepository, 'pruneExpiredSessions'>;

type AuthSessionRetentionPrunerDependencies = {
	repository: AuthSessionRetentionRepository;
	intervalMs?: number;
	runOnStart?: boolean;
	now?: () => Date;
	onError?: (error: unknown) => void;
};

type AuthSessionRetentionPruner = {
	stop(): void;
};

export const authSessionRetentionDays = 30;

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const defaultPruneIntervalMs = 6 * 60 * 60 * 1000;

export function pruneExpiredAuthSessions(
	repository: AuthSessionRetentionRepository,
	now = new Date()
): Promise<number> {
	const cutoff = new Date(now.getTime() - authSessionRetentionDays * millisecondsPerDay);
	return repository.pruneExpiredSessions(cutoff);
}

export function startAuthSessionRetentionPruner(
	dependencies: AuthSessionRetentionPrunerDependencies
): AuthSessionRetentionPruner {
	const intervalMs = dependencies.intervalMs ?? defaultPruneIntervalMs;
	const now = dependencies.now ?? (() => new Date());
	const onError = dependencies.onError ?? ((error) => console.error(error));
	const prune = () => {
		void pruneExpiredAuthSessions(dependencies.repository, now()).catch(onError);
	};

	if (dependencies.runOnStart ?? true) prune();

	const interval = setInterval(prune, intervalMs);
	interval.unref();

	return {
		stop() {
			clearInterval(interval);
		}
	};
}
