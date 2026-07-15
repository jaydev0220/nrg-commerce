import type { ImageService } from './image.service.js';

type ImageRetentionPrunerDependencies = {
	imageService: Pick<ImageService, 'pruneExpiredAssets'>;
	intervalMs?: number;
	runOnStart?: boolean;
	onError?: (error: unknown) => void;
};

type ImageRetentionPruner = {
	stop(): void;
};

const defaultPruneIntervalMs = 60 * 60 * 1000;

export function startImageRetentionPruner(
	dependencies: ImageRetentionPrunerDependencies
): ImageRetentionPruner {
	const intervalMs = dependencies.intervalMs ?? defaultPruneIntervalMs;
	const onError = dependencies.onError ?? ((error) => console.error(error));
	const prune = () => {
		void dependencies.imageService.pruneExpiredAssets().catch(onError);
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
