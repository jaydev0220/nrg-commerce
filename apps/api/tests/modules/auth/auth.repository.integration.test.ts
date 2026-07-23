import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { createDatabaseClient } from '@packages/database';
import { Pool } from 'pg';

import { createPrismaAuthRepository } from '../../../src/modules/auth/auth.repository.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];

test(
	'auth repository atomically locks failed passwords and consumes TOTP steps once',
	{ skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured.' },
	async () => {
		const pool = new Pool({ connectionString: databaseUrl, max: 5 });
		const database = createDatabaseClient({ pool });
		const repository = createPrismaAuthRepository(database);
		let expiredSessionId: string | undefined;
		let firstExpiredTokenId: string | undefined;
		let secondExpiredTokenId: string | undefined;
		const staff = await database.staff.create({
			data: {
				email: `auth-integration-${randomUUID()}@example.com`,
				name: 'Auth integration',
				status: 'active'
			}
		});

		try {
			const attemptedAt = new Date('2026-07-21T00:00:00.000Z');
			const policy = {
				windowMilliseconds: 15 * 60 * 1000,
				maxAttempts: 5,
				blockMilliseconds: 15 * 60 * 1000
			};
			await Promise.all(
				Array.from({ length: 5 }, () =>
					repository.recordFailedPasswordAttempt(staff.id, attemptedAt, policy)
				)
			);

			const lockedStaff = await database.staff.findUniqueOrThrow({
				where: { id: staff.id }
			});
			assert.equal(lockedStaff.failedAuthCount, 5);
			assert.ok(lockedStaff.authBlockedUntil);
			assert.equal(await repository.clearFailedPasswordAttempts(staff.id, attemptedAt), false);
			assert.equal(
				await repository.clearFailedPasswordAttempts(
					staff.id,
					new Date(lockedStaff.authBlockedUntil.getTime() + 1)
				),
				true
			);

			await database.totpCredential.create({
				data: {
					staffId: staff.id,
					secretEncrypted: 'encrypted-secret',
					digits: 6,
					period: 30,
					verifiedAt: attemptedAt
				}
			});
			const consumed = await Promise.all([
				repository.consumeTotpTimeStep(staff.id, 42n, attemptedAt),
				repository.consumeTotpTimeStep(staff.id, 42n, attemptedAt)
			]);
			assert.deepEqual(consumed.toSorted(), [false, true]);

			const credential = await database.totpCredential.findFirstOrThrow({
				where: { staffId: staff.id, deletedAt: null }
			});
			assert.equal(credential.lastUsedTimeStep, 42n);
			assert.equal(await repository.consumeTotpTimeStep(staff.id, 41n, attemptedAt), false);

			const passkey = await database.passkeyCredential.create({
				data: {
					staffId: staff.id,
					credentialId: randomUUID(),
					publicKey: new Uint8Array([1, 2, 3]),
					verifiedAt: attemptedAt
				}
			});
			const removalResults = await Promise.all([
				repository.deleteTotpCredential(staff.id),
				repository.deletePasskeyCredential(staff.id, passkey.id)
			]);
			assert.deepEqual(removalResults.toSorted(), ['mfa_required', 'removed']);

			const activeTotpCount = await database.totpCredential.count({
				where: { staffId: staff.id, deletedAt: null, verifiedAt: { not: null } }
			});
			const activePasskeyCount = await database.passkeyCredential.count({
				where: { staffId: staff.id, deletedAt: null, verifiedAt: { not: null } }
			});
			assert.equal(activeTotpCount + activePasskeyCount, 1);
			const mfaStaff = await database.staff.findUniqueOrThrow({ where: { id: staff.id } });
			assert.equal(
				mfaStaff.preferredMfaMethod,
				activePasskeyCount === 1 ? 'passkey' : 'authenticator'
			);

			const replayCredential = await database.passkeyCredential.create({
				data: {
					staffId: staff.id,
					credentialId: randomUUID(),
					publicKey: new Uint8Array([4, 5, 6]),
					counter: 0,
					verifiedAt: attemptedAt
				}
			});
			const passkeyUsedAt = new Date('2026-07-21T00:00:01.000Z');
			const passkeyConsumptionResults = await Promise.all([
				repository.consumePasskeyAuthentication({
					credentialId: replayCredential.credentialId,
					expectedCounter: 0,
					expectedLastUsedAt: null,
					counter: 0,
					lastUsedAt: passkeyUsedAt
				}),
				repository.consumePasskeyAuthentication({
					credentialId: replayCredential.credentialId,
					expectedCounter: 0,
					expectedLastUsedAt: null,
					counter: 0,
					lastUsedAt: passkeyUsedAt
				})
			]);
			assert.deepEqual(passkeyConsumptionResults.toSorted(), [false, true]);
			const consumedPasskey = await database.passkeyCredential.findUniqueOrThrow({
				where: { id: replayCredential.id }
			});
			assert.equal(consumedPasskey.lastUsedAt?.toISOString(), passkeyUsedAt.toISOString());

			expiredSessionId = randomUUID();
			firstExpiredTokenId = randomUUID();
			secondExpiredTokenId = randomUUID();
			const authenticatedAt = new Date('1969-01-01T00:00:00.000Z');
			const expiresAt = new Date('1969-01-02T00:00:00.000Z');
			await database.authSession.create({
				data: {
					id: expiredSessionId,
					staffId: staff.id,
					authenticatedAt,
					expiresAt,
					refreshTokens: {
						create: {
							id: firstExpiredTokenId,
							jwtId: randomUUID(),
							tokenHash: randomUUID(),
							issuedAt: authenticatedAt,
							expiresAt
						}
					}
				}
			});
			await database.refreshToken.create({
				data: {
					id: secondExpiredTokenId,
					sessionId: expiredSessionId,
					jwtId: randomUUID(),
					tokenHash: randomUUID(),
					previousTokenId: firstExpiredTokenId,
					issuedAt: authenticatedAt,
					expiresAt
				}
			});

			assert.equal(await repository.pruneExpiredSessions(new Date('1970-01-01T00:00:00.000Z')), 1);
			assert.equal(
				await database.refreshToken.count({ where: { sessionId: expiredSessionId } }),
				0
			);
		} finally {
			if (secondExpiredTokenId) {
				await database.refreshToken.deleteMany({ where: { id: secondExpiredTokenId } });
			}
			if (firstExpiredTokenId) {
				await database.refreshToken.deleteMany({ where: { id: firstExpiredTokenId } });
			}
			if (expiredSessionId) {
				await database.authSession.deleteMany({ where: { id: expiredSessionId } });
			}
			await database.staff.delete({ where: { id: staff.id } });
			await database.$disconnect();
			await pool.end();
		}
	}
);
