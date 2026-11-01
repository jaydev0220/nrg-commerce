import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_CDN_BASE_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_FACEBOOK_URL: { public: true, static: true, schema: (value) => value ?? '' },
	PUBLIC_LINE_URL: { public: true, static: true, schema: (value) => value ?? '' }
});
