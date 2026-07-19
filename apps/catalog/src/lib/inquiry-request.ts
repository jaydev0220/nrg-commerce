export type InquiryRequestPayload = {
	turnstileToken: string;
	name: string;
	email: string;
	company?: string;
	phone?: string;
	skuCode?: string;
	message: string;
};

export async function submitInquiryRequest(
	workerUrl: string,
	payload: InquiryRequestPayload
): Promise<void> {
	if (!workerUrl.trim()) throw new Error('Contact Worker URL is not configured.');
	const endpoint = new URL('inquiry', `${workerUrl.replace(/\/+$/, '')}/`);
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`Inquiry request failed with status ${response.status}.`);
}
