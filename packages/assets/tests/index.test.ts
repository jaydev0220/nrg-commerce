import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssetUrlResolver, SHARED_ASSETS } from '../src/index.js';

test('exports shared branding asset paths', () => {
	assert.deepEqual(SHARED_ASSETS, {
		logoDark: '/logo-dark.svg',
		logoLight: '/logo-light.svg',
		favicon: '/favicon.ico'
	});
});

test('requires a valid HTTPS asset base URL', () => {
	assert.throws(() => createAssetUrlResolver(''), /required/);
	assert.throws(() => createAssetUrlResolver('not a URL'), /valid HTTPS URL/);
	assert.throws(() => createAssetUrlResolver('http://cdn.example.com'), /use HTTPS/);
});

test('normalizes the base as a directory and preserves asset path semantics', () => {
	const assetUrl = createAssetUrlResolver(' https://cdn.example.com/assets ');

	assert.equal(assetUrl('/logo-light.svg'), 'https://cdn.example.com/logo-light.svg');
	assert.equal(
		assetUrl('landing/photo.webp?version=2#preview'),
		'https://cdn.example.com/assets/landing/photo.webp?version=2#preview'
	);
});

test('rejects absolute and protocol-relative asset paths', () => {
	const assetUrl = createAssetUrlResolver('https://cdn.example.com');

	assert.throws(() => assetUrl('https://other.example.com/image.webp'), /must be relative/);
	assert.throws(() => assetUrl(' https://other.example.com/image.webp '), /must be relative/);
	assert.throws(() => assetUrl('//other.example.com/image.webp'), /must be relative/);
	assert.throws(() => assetUrl('data:image/png;base64,abc'), /must be relative/);
});
