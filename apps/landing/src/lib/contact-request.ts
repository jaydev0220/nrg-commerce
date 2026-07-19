import type { ContactRequest } from '@packages/schemas';

export type ContactRequestPayload = ContactRequest;

export async function submitContactRequest(
	workerUrl: string,
	payload: ContactRequestPayload
): Promise<void> {
	if (!workerUrl.trim()) throw new Error('Contact Worker URL is not configured.');
	const endpoint = new URL('contact', `${workerUrl.replace(/\/+$/, '')}/`);
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`Contact request failed with status ${response.status}.`);
}
