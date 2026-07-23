import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { productImageContentTypeValues, productImageMaxFileSize } from '@packages/schemas';
import sharp from 'sharp';

import { AppError } from '../errors/app-error.js';

const maxImagePixels = 40_000_000;
const maxImageDimension = 12_000;
const normalizedContentType = 'image/webp';

type R2ObjectStorageConfig = {
	accountId: string;
	bucketName: string;
	uploadBucketName: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicBaseUrl: string;
	assetKeyPrefix: string;
	uploadUrlTtlSeconds: number;
};

type ObjectBody = {
	transformToByteArray(): Promise<Uint8Array>;
};

type ObjectStorageResponse =
	| {
			ContentType?: string;
			ContentLength?: number;
	  }
	| {
			Body?: ObjectBody;
	  }
	| undefined;

type S3ClientLike = {
	send(
		command: HeadObjectCommand | GetObjectCommand | PutObjectCommand | DeleteObjectCommand
	): Promise<ObjectStorageResponse>;
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
	normalizeImage?: (input: Uint8Array) => Promise<Uint8Array>;
	now?: () => Date;
	createId?: () => string;
};

type ImageUploadRequest = {
	fileName: string;
	contentType: string;
	fileSize: number;
};

type PromotedImageAsset = {
	assetKey: string;
	imageUrl: string;
	contentType: typeof normalizedContentType;
};

const uploadExtensions: Record<(typeof productImageContentTypeValues)[number], string> = {
	'image/avif': '.avif',
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp'
};

function trimTrailingSlash(value: string): string {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildProductAssetPrefix(assetKeyPrefix: string, productId: string): string {
	return `${assetKeyPrefix.replace(/^\/+|\/+$/g, '')}/${productId}`;
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

function invalidImageError(): AppError {
	return new AppError(
		422,
		'INVALID_IMAGE_ASSET',
		'The uploaded asset is not a valid supported image.'
	);
}

export async function normalizeProductImage(input: Uint8Array): Promise<Uint8Array> {
	try {
		const image = sharp(input, {
			animated: false,
			failOn: 'error',
			limitInputPixels: maxImagePixels,
			sequentialRead: true
		});
		const metadata = await image.metadata();
		const width = metadata.width ?? 0;
		const height = metadata.height ?? 0;

		if (
			width <= 0 ||
			height <= 0 ||
			width > maxImageDimension ||
			height > maxImageDimension ||
			width * height > maxImagePixels ||
			(metadata.pages ?? 1) !== 1
		) {
			throw invalidImageError();
		}

		const normalized = await image
			.rotate()
			.webp({ effort: 4, quality: 88, smartSubsample: true })
			.toBuffer();

		if (normalized.byteLength <= 0 || normalized.byteLength > productImageMaxFileSize) {
			throw new AppError(
				422,
				'IMAGE_ASSET_TOO_LARGE',
				'The normalized image exceeds the maximum allowed file size.'
			);
		}

		return normalized;
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw invalidImageError();
	}
}

function validatePendingMetadata(response: ObjectStorageResponse): number {
	const contentType = response && 'ContentType' in response ? response.ContentType : undefined;
	const contentLength =
		response && 'ContentLength' in response ? response.ContentLength : undefined;

	if (
		!contentType ||
		!productImageContentTypeValues.includes(
			contentType as (typeof productImageContentTypeValues)[number]
		)
	) {
		throw invalidImageError();
	}
	if (
		contentLength === undefined ||
		contentLength <= 0 ||
		contentLength > productImageMaxFileSize
	) {
		throw new AppError(
			422,
			'IMAGE_ASSET_TOO_LARGE',
			'The uploaded image exceeds the maximum allowed file size.'
		);
	}

	return contentLength;
}

async function readPendingImage(
	s3Client: S3ClientLike,
	bucketName: string,
	assetKey: string
): Promise<Uint8Array> {
	const contentLength = validatePendingMetadata(
		await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: assetKey }))
	);
	const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: assetKey }));
	const body =
		response && 'Body' in response ? await response.Body?.transformToByteArray() : undefined;

	if (!body || body.byteLength !== contentLength) throw invalidImageError();
	return body;
}

async function writePublicImage(
	s3Client: S3ClientLike,
	bucketName: string,
	assetKey: string,
	body: Uint8Array
): Promise<void> {
	await s3Client.send(
		new PutObjectCommand({
			Bucket: bucketName,
			Key: assetKey,
			Body: body,
			ContentLength: body.byteLength,
			ContentType: normalizedContentType,
			CacheControl: 'public, max-age=31536000, immutable'
		})
	);
}

async function handlePromotionError(
	error: unknown,
	purgeInvalidUpload: () => Promise<void>
): Promise<never> {
	if (
		error instanceof AppError &&
		(error.code === 'INVALID_IMAGE_ASSET' || error.code === 'IMAGE_ASSET_TOO_LARGE')
	) {
		await purgeInvalidUpload().catch(() => undefined);
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

export function createR2ObjectStorage(
	config: R2ObjectStorageConfig,
	dependencies: ObjectStorageDependencies = {}
) {
	const s3Client: S3ClientLike =
		dependencies.s3Client ??
		(new S3Client({
			region: 'auto',
			endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			}
		}) as unknown as S3ClientLike);
	const signUrl =
		dependencies.signUrl ??
		((client, command, options) => getSignedUrl(client as S3Client, command, options));
	const normalizeImage = dependencies.normalizeImage ?? normalizeProductImage;
	const now = dependencies.now ?? (() => new Date());
	const createId = dependencies.createId ?? (() => crypto.randomUUID());

	async function deleteObject(bucketName: string, assetKey: string): Promise<void> {
		try {
			await s3Client.send(
				new DeleteObjectCommand({
					Bucket: bucketName,
					Key: assetKey
				})
			);
		} catch (error) {
			if (!isNotFoundError(error)) throw error;
		}
	}

	return {
		async createImageUploadTarget(productId: string, input: ImageUploadRequest) {
			const contentType = input.contentType as (typeof productImageContentTypeValues)[number];
			const extension = uploadExtensions[contentType];
			const assetKeyPrefix = buildProductAssetPrefix(config.assetKeyPrefix, productId);
			const assetKey = `${assetKeyPrefix}/${createId()}${extension}`;
			const uploadUrl = await signUrl(
				s3Client,
				new PutObjectCommand({
					Bucket: config.uploadBucketName,
					Key: assetKey,
					ContentType: input.contentType,
					ContentLength: input.fileSize
				}),
				{
					expiresIn: config.uploadUrlTtlSeconds
				}
			);

			return {
				method: 'PUT' as const,
				assetKey,
				uploadUrl,
				headers: {
					'Content-Type': input.contentType
				},
				expiresAt: new Date(now().getTime() + config.uploadUrlTtlSeconds * 1000).toISOString()
			};
		},

		async promoteImageAsset(
			productId: string,
			input: { assetKey: string }
		): Promise<PromotedImageAsset> {
			const assetKeyPrefix = `${buildProductAssetPrefix(config.assetKeyPrefix, productId)}/`;

			if (!input.assetKey.startsWith(assetKeyPrefix)) {
				throw new AppError(
					422,
					'INVALID_IMAGE_ASSET_KEY',
					'The uploaded image asset key must belong to the target product.'
				);
			}

			try {
				const body = await readPendingImage(s3Client, config.uploadBucketName, input.assetKey);
				const normalizedBody = await normalizeImage(body);
				const publicAssetKey = `${assetKeyPrefix}${createId()}.webp`;
				await writePublicImage(s3Client, config.bucketName, publicAssetKey, normalizedBody);

				return {
					assetKey: publicAssetKey,
					imageUrl: buildPublicUrl(config.publicBaseUrl, publicAssetKey),
					contentType: normalizedContentType
				};
			} catch (error) {
				return handlePromotionError(error, () =>
					deleteObject(config.uploadBucketName, input.assetKey)
				);
			}
		},

		async deleteImageAsset(assetKey: string): Promise<void> {
			await deleteObject(config.bucketName, assetKey);
		},

		async deleteImageUploadAsset(assetKey: string): Promise<void> {
			await deleteObject(config.uploadBucketName, assetKey);
		}
	};
}

export type ImageObjectStorage = ReturnType<typeof createR2ObjectStorage>;
