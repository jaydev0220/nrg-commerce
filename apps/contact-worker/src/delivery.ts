import {
	contactRequestSchema,
	inquiryRequestSchema,
	z,
	type ContactRequest,
	type InquiryRequest
} from '@packages/schemas';

import { buildRequestEmail, type EmailConfig, type OutgoingEmail } from './email.js';

type ContactPayload = Omit<ContactRequest, 'turnstileToken'>;
type InquiryPayload = Omit<InquiryRequest, 'turnstileToken'>;

export type QueuedDelivery =
	| {
			version: 1;
			kind: 'contact';
			requestId: string;
			submittedAt: string;
			request: ContactPayload;
	  }
	| {
			version: 1;
			kind: 'inquiry';
			requestId: string;
			submittedAt: string;
			request: InquiryPayload;
	  };

const queuedDeliverySchema = z.discriminatedUnion('kind', [
	z
		.object({
			version: z.literal(1),
			kind: z.literal('contact'),
			requestId: z.uuid(),
			submittedAt: z.iso.datetime(),
			request: contactRequestSchema.omit({ turnstileToken: true })
		})
		.strict(),
	z
		.object({
			version: z.literal(1),
			kind: z.literal('inquiry'),
			requestId: z.uuid(),
			submittedAt: z.iso.datetime(),
			request: inquiryRequestSchema.omit({ turnstileToken: true })
		})
		.strict()
]);

export type DeliveryLogEntry = {
	event: 'contact_delivery';
	requestId: string;
	messageId: string;
	attempts: number;
	outcome: 'DELIVERED' | 'DELIVERY_FAILED' | 'INVALID_MESSAGE';
};

export type DeliveryMessage = {
	readonly id: string;
	readonly body: unknown;
	readonly attempts: number;
	ack(): void;
	retry(): void;
};

export type DeliveryDependencies = {
	sendEmail(message: OutgoingEmail): Promise<void>;
	log(entry: DeliveryLogEntry): void;
};

export function createQueuedDelivery(
	kind: 'contact',
	request: ContactRequest,
	requestId: string,
	submittedAt: Date
): QueuedDelivery;
export function createQueuedDelivery(
	kind: 'inquiry',
	request: InquiryRequest,
	requestId: string,
	submittedAt: Date
): QueuedDelivery;
export function createQueuedDelivery(
	kind: 'contact' | 'inquiry',
	request: ContactRequest | InquiryRequest,
	requestId: string,
	submittedAt: Date
): QueuedDelivery;
export function createQueuedDelivery(
	kind: 'contact' | 'inquiry',
	request: ContactRequest | InquiryRequest,
	requestId: string,
	submittedAt: Date
): QueuedDelivery {
	const { turnstileToken, ...payload } = request;
	void turnstileToken;

	if (kind === 'contact') {
		return {
			version: 1,
			kind,
			requestId,
			submittedAt: submittedAt.toISOString(),
			request: payload as ContactPayload
		};
	}

	return {
		version: 1,
		kind,
		requestId,
		submittedAt: submittedAt.toISOString(),
		request: payload as InquiryPayload
	};
}

export async function deliverQueuedMessage(
	message: DeliveryMessage,
	config: EmailConfig,
	dependencies: DeliveryDependencies
): Promise<void> {
	const parsed = queuedDeliverySchema.safeParse(message.body);
	if (!parsed.success) {
		message.retry();
		dependencies.log({
			event: 'contact_delivery',
			requestId: 'unknown',
			messageId: message.id,
			attempts: message.attempts,
			outcome: 'INVALID_MESSAGE'
		});
		return;
	}

	try {
		await dependencies.sendEmail(buildRequestEmail(parsed.data.kind, parsed.data.request, config));
		message.ack();
		dependencies.log({
			event: 'contact_delivery',
			requestId: parsed.data.requestId,
			messageId: message.id,
			attempts: message.attempts,
			outcome: 'DELIVERED'
		});
	} catch {
		message.retry();
		dependencies.log({
			event: 'contact_delivery',
			requestId: parsed.data.requestId,
			messageId: message.id,
			attempts: message.attempts,
			outcome: 'DELIVERY_FAILED'
		});
	}
}
