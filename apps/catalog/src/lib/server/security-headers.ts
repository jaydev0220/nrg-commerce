const SECURITY_HEADERS = {
	'Content-Security-Policy': "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY'
} as const;

export function applySecurityHeaders(response: Response): Response {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (name === 'Content-Security-Policy' && response.headers.has(name)) {
			continue;
		}

		response.headers.set(name, value);
	}

	return response;
}
