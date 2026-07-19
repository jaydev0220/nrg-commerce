import { z } from 'zod';

const optionalText = (maximum: number) =>
	z
		.string()
		.trim()
		.max(maximum)
		.transform((value) => value || undefined)
		.optional();

const baseRequestSchema = z
	.object({
		turnstileToken: z.string().trim().min(1).max(2048),
		name: z.string().trim().min(1).max(120),
		email: z.email().max(254),
		company: optionalText(160),
		phone: optionalText(40),
		message: z.string().trim().min(1).max(5000)
	})
	.strict();

export const contactRequestSchema = baseRequestSchema.extend({
	inquiryType: optionalText(120),
	productInterest: optionalText(200)
});

export const inquiryRequestSchema = baseRequestSchema.extend({
	skuCode: optionalText(100)
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;
export type InquiryRequest = z.infer<typeof inquiryRequestSchema>;
