import type { ContactRequest, InquiryRequest } from './schemas.js';

type FormRequest = ContactRequest | InquiryRequest;

export type EmailConfig = {
	senderEmail: string;
	recipientEmail: string;
};

export type OutgoingEmail = Parameters<SendEmail['send']>[0];

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function sanitizeSubjectValue(value: string): string {
	return value
		.replace(/[\r\n]+/g, ' ')
		.trim()
		.slice(0, 60);
}

function requestEntries(
	kind: 'contact' | 'inquiry',
	request: FormRequest
): Array<[string, string]> {
	const entries: Array<[string, string | undefined]> = [
		['Name', request.name],
		['Email', request.email],
		['Company', request.company],
		['Phone', request.phone]
	];

	if (kind === 'contact') {
		const contact = request as ContactRequest;
		entries.push(
			['Inquiry type', contact.inquiryType],
			['Product interest', contact.productInterest]
		);
	} else {
		entries.push(['Product SKU', (request as InquiryRequest).skuCode]);
	}

	entries.push(['Message', request.message]);
	return entries.filter((entry): entry is [string, string] => Boolean(entry[1]));
}

export function buildRequestEmail(
	kind: 'contact' | 'inquiry',
	request: FormRequest,
	config: EmailConfig
): OutgoingEmail {
	const entries = requestEntries(kind, request);
	const sku = kind === 'inquiry' ? (request as InquiryRequest).skuCode : undefined;
	const skuSuffix = sku ? ` - ${sanitizeSubjectValue(sku)}` : '';
	const subject = `${kind === 'contact' ? 'New website contact request' : 'New product inquiry'}${skuSuffix}`;
	const text = entries.map(([label, value]) => `${label}:\n${value}`).join('\n\n');
	const htmlRows = entries
		.map(
			([label, value]) =>
				`<tr><th align="left" valign="top" style="padding:8px 16px 8px 0">${escapeHtml(label)}</th><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
		)
		.join('');

	return {
		to: config.recipientEmail,
		from: { email: config.senderEmail, name: 'NRG GLASS Website' },
		replyTo: request.email,
		subject,
		text,
		html: `<h1>${kind === 'contact' ? 'Website contact request' : 'Product inquiry'}</h1><table>${htmlRows}</table>`
	};
}
