import { rateLimit } from 'express-rate-limit';

import type { AppConfig } from '../config/app-config.js';

export function createGlobalRateLimiter(config: AppConfig) {
	return rateLimit({
		windowMs: config.rateLimitWindowMs,
		limit: config.rateLimitMax,
		standardHeaders: true,
		legacyHeaders: false
	});
}

export function createAuthRateLimiter(config: AppConfig) {
	return rateLimit({
		windowMs: config.rateLimitWindowMs,
		limit: config.authRateLimitMax,
		standardHeaders: true,
		legacyHeaders: false
	});
}
