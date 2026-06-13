import { basename, extname } from 'node:path';

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppError } from '../errors/app-error.js';

type R2ObjectStorageConfig = {
	accountId: string;
	bucketName: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicBaseUrl: string;
	assetKeyPrefix: string;
	uploadUrlTtlSeconds: number;
};

type S3ClientLike = {
	send(command: HeadObjectCommand): Promise<{ ContentType?: string } | undefined>;
};

type SignUrl = (
	client: S3ClientLike,
	command: PutObjectCommand,
	options: {
		expiresIn: number;
	}
) => Promise<string>;

type ObjectStorageDependencies = {
	s3Client?: S3ClientLike;
	signUrl?: SignUrl;
	now?: () => Date;
	createId?: () => string;
};

type ImageUploadRequest = {
	fileName: string;
	contentType: string;
};

type UploadedImageAsset = {
	assetKey: string;
	imageUrl: string;
	contentType: string | null;
};

function trimTrailingSlash(value: string): string {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

function sanitizeFileExtension(fileName: string): string {
	const extension = extname(basename(fileName)).toLowerCase();
	return extension.replace(/[^a-z0-9.]/g, '');
}

function buildSkuAssetPrefix(assetKeyPrefix: string, skuId: string): string {
	return `${assetKeyPrefix.replace(/^\/+|\/+$/g, '')}/${skuId}`;
}

function buildPublicUrl(publicBaseUrl: string, assetKey: string): string {
	return `${trimTrailingSlash(publicBaseUrl)}/${assetKey}`;
}

function isNotFoundError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const candidate = error as {
		name?: string;
		$metadata?: {
			httpStatusCode?: number;
		};
	};

	return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}

export function createR2ObjectStorage(
	config: R2ObjectStorageConfig,
	dependencies: ObjectStorageDependencies = {}
) {
	const s3Client =
		dependencies.s3Client ??
		new S3Client({
			region: 'auto',
			endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			}
		});
	const signUrl =
		dependencies.signUrl ??
		((client, command, options) => getSignedUrl(client as S3Client, command, options));
	const now = dependencies.now ?? (() => new Date());
	const createId = dependencies.createId ?? (() => crypto.randomUUID());

	return {
		async createImageUploadTarget(skuId: string, input: ImageUploadRequest) {
			const assetKeyPrefix = buildSkuAssetPrefix(config.assetKeyPrefix, skuId);
			const assetKey = `${assetKeyPrefix}/${createId()}${sanitizeFileExtension(input.fileName)}`;
			const uploadUrl = await signUrl(
				s3Client,
				new PutObjectCommand({
					Bucket: config.bucketName,
					Key: assetKey,
					ContentType: input.contentType
				}),
				{
					expiresIn: config.uploadUrlTtlSeconds
				}
			);

			return {
				method: 'PUT' as const,
				assetKey,
				imageUrl: buildPublicUrl(config.publicBaseUrl, assetKey),
				uploadUrl,
				headers: {
					'Content-Type': input.contentType
				},
				expiresAt: new Date(now().getTime() + config.uploadUrlTtlSeconds * 1000).toISOString()
			};
		},

		async assertImageAssetExists(
			skuId: string,
			input: { assetKey: string }
		): Promise<UploadedImageAsset> {
			const assetKeyPrefix = `${buildSkuAssetPrefix(config.assetKeyPrefix, skuId)}/`;

			if (!input.assetKey.startsWith(assetKeyPrefix)) {
				throw new AppError(
					422,
					'INVALID_IMAGE_ASSET_KEY',
					'The uploaded image asset key must belong to the target product SKU.'
				);
			}

			try {
				const object = await s3Client.send(
					new HeadObjectCommand({
						Bucket: config.bucketName,
						Key: input.assetKey
					})
				);
				const contentType = object?.ContentType ?? null;

				if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
					throw new AppError(
						422,
						'INVALID_IMAGE_ASSET',
						'The uploaded asset is not a valid image object.'
					);
				}

				return {
					assetKey: input.assetKey,
					imageUrl: buildPublicUrl(config.publicBaseUrl, input.assetKey),
					contentType
				};
			} catch (error) {
				if (error instanceof AppError) {
					throw error;
				}

				if (isNotFoundError(error)) {
					throw new AppError(
						422,
						'IMAGE_ASSET_NOT_FOUND',
						'The referenced uploaded image asset could not be found.'
					);
				}

				throw error;
			}
		}
	};
}

export type ImageObjectStorage = ReturnType<typeof createR2ObjectStorage>;
