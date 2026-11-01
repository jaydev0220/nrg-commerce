import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_CDN_BASE_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_CTA_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_FACEBOOK_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_LINE_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_SITE_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_COOKIE_DOMAIN: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_CONTACT_WORKER_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_TURNSTILE_SITE_KEY: { public: true, static: true, schema: (value) => value ?? '' }
});
