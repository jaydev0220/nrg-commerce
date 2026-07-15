import assert from 'node:assert/strict';
import test from 'node:test';

import { readAppConfig } from '../../src/config/app-config.js';

test('development config supports the admin preview and Vite origins', () => {
	const config = readAppConfig({ NODE_ENV: 'development' });

	assert.equal(config.cookieSecure, false);
	assert.equal(config.cookieSameSite, 'lax');
	assert.equal(config.logLevel, 'debug');
	assert.deepEqual(config.corsOrigins, ['http://localhost:4173', 'http://localhost:5173']);
});

test('production config defaults to cross-origin secure cookies', () => {
	const config = readAppConfig({ NODE_ENV: 'production' });

	assert.equal(config.cookieSecure, true);
	assert.equal(config.cookieSameSite, 'none');
	assert.equal(config.logLevel, 'info');
});

test('configured log levels are accepted', () => {
	assert.equal(readAppConfig({ LOG_LEVEL: 'warn' }).logLevel, 'warn');
});

test('session config provides sliding and absolute lifetime defaults', () => {
	const config = readAppConfig({});

	assert.equal(config.sessionTtlSeconds, 604_800);
	assert.equal(config.sessionAbsoluteTtlSeconds, 2_592_000);
	assert.equal(
		readAppConfig({ SESSION_ABSOLUTE_TTL_SECONDS: '1209600' }).sessionAbsoluteTtlSeconds,
		1_209_600
	);
});

test('storefront cache configuration has bounded defaults and accepts positive integers', () => {
	const defaults = readAppConfig({});
	assert.equal(defaults.storefrontCacheTtlSeconds, 60);
	assert.equal(defaults.storefrontCacheMaxEntries, 500);

	const configured = readAppConfig({
		STOREFRONT_CACHE_TTL_SECONDS: '30',
		STOREFRONT_CACHE_MAX_ENTRIES: '25'
	});
	assert.equal(configured.storefrontCacheTtlSeconds, 30);
	assert.equal(configured.storefrontCacheMaxEntries, 25);
	assert.equal(readAppConfig({ STOREFRONT_CACHE_TTL_SECONDS: '0' }).storefrontCacheTtlSeconds, 60);
});

test('unsupported log levels fail configuration loading', () => {
	assert.throws(
		() => readAppConfig({ LOG_LEVEL: 'verbose' }),
		/LOG_LEVEL must be one of debug, info, warn, error, or fatal/
	);
});

test('SameSite none cookies require the Secure attribute', () => {
	assert.throws(
		() =>
			readAppConfig({
				COOKIE_SECURE: 'false',
				COOKIE_SAME_SITE: 'none'
			}),
		/COOKIE_SECURE must be true/
	);
});
