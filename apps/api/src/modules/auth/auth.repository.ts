import type { DatabaseClient } from '@packages/database';

import type {
	AuthSessionRecord,
	AuthStaffRecord,
	PasskeyCredentialRecord,
	RefreshTokenRecord,
	TotpCredentialRecord
} from '../../types/auth.js';
import { parsePermissionKey, parseRoleKey } from '../../utils/access-control.js';

type CreateSessionInput = {
	sessionId: string;
	staffId: string;
	userAgent: string | null;
	ipAddress: string | null;
	authenticatedAt: Date;
	expiresAt: Date;
	refreshTokenId: string;
	refreshJwtId: string;
	refreshTokenHash: string;
	refreshExpiresAt: Date;
};

type ReplaceRefreshTokenInput = {
	currentTokenHash: string;
	newTokenId: string;
	newJwtId: string;
	newTokenHash: string;
	newExpiresAt: Date;
	usedAt: Date;
	sessionExpiresAt: Date;
	sessionLastSeenAt: Date;
};

function normalizeBinary(value: Uint8Array): Uint8Array<ArrayBuffer> {
	return value.slice();
}

function mapAuthStaffRecord(staff: {
	id: string;
	email: string;
	name: string;
	status: 'active' | 'inactive' | 'suspended';
	passwordHash: string | null;
	preferredMfaMethod: 'authenticator' | 'passkey' | null;
	lastLoginAt: Date | null;
	failedAuthCount: number;
	failedAuthWindowStartedAt: Date | null;
	authBlockedUntil: Date | null;
	roles: Array<{
		role: {
			id: string;
			key: string;
			name: string;
			rolePermissions: Array<{ permission: { key: string } }>;
		};
	}>;
	totpCredentials: Array<{ id: string }>;
	passkeyCredentials: Array<{ id: string }>;
}): AuthStaffRecord {
	return {
		id: staff.id,
		email: staff.email,
		name: staff.name,
		status: staff.status,
		passwordHash: staff.passwordHash,
		preferredMfaMethod: staff.preferredMfaMethod,
		lastLoginAt: staff.lastLoginAt,
		failedAuthCount: staff.failedAuthCount,
		failedAuthWindowStartedAt: staff.failedAuthWindowStartedAt,
		authBlockedUntil: staff.authBlockedUntil,
		roles: staff.roles.map(({ role }) => ({
			id: role.id,
			key: parseRoleKey(role.key),
			name: role.name,
			permissions: role.rolePermissions.map(({ permission }) => parsePermissionKey(permission.key))
		})),
		totpCredentialCount: staff.totpCredentials.length,
		passkeyCredentialCount: staff.passkeyCredentials.length
	};
}

function mapSessionRecord(session: {
	id: string;
	staffId: string;
	userAgent: string | null;
	ipAddress: string | null;
	authenticatedAt: Date;
	lastSeenAt: Date | null;
	expiresAt: Date;
	revokedAt: Date | null;
}): AuthSessionRecord {
	return {
		id: session.id,
		staffId: session.staffId,
		userAgent: session.userAgent,
		ipAddress: session.ipAddress,
		authenticatedAt: session.authenticatedAt,
		lastSeenAt: session.lastSeenAt,
		expiresAt: session.expiresAt,
		revokedAt: session.revokedAt
	};
}

function mapPasskeyRecord(credential: {
	id: string;
	staffId: string;
	credentialId: string;
	publicKey: Uint8Array;
	userHandle: string | null;
	counter: number;
	transports: string[];
	aaguid: string | null;
	deviceType: 'singleDevice' | 'multiDevice' | null;
	backedUp: boolean | null;
	nickname: string | null;
	verifiedAt: Date | null;
	lastUsedAt: Date | null;
}): PasskeyCredentialRecord {
	return {
		id: credential.id,
		staffId: credential.staffId,
		credentialId: credential.credentialId,
		publicKey: normalizeBinary(credential.publicKey),
		userHandle: credential.userHandle,
		counter: credential.counter,
		transports: credential.transports,
		aaguid: credential.aaguid,
		deviceType: credential.deviceType,
		backedUp: credential.backedUp,
		nickname: credential.nickname,
		verifiedAt: credential.verifiedAt,
		lastUsedAt: credential.lastUsedAt
	};
}

export type AuthRepository = ReturnType<typeof createPrismaAuthRepository>;

export function createPrismaAuthRepository(database: DatabaseClient) {
	const authStaffInclude = {
		roles: {
			include: {
				role: {
					include: {
						rolePermissions: {
							include: {
								permission: true
							}
						}
					}
				}
			}
		},
		totpCredentials: {
			where: {
				deletedAt: null,
				verifiedAt: {
					not: null
				}
			},
			select: {
				id: true
			}
		},
		passkeyCredentials: {
			where: {
				deletedAt: null,
				verifiedAt: {
					not: null
				}
			},
			select: {
				id: true
			}
		}
	} as const;

	return {
		async findStaffByEmail(email: string): Promise<AuthStaffRecord | null> {
			const staff = await database.staff.findFirst({
				where: {
					email,
					deletedAt: null
				},
				include: authStaffInclude
			});

			return staff ? mapAuthStaffRecord(staff) : null;
		},

		async findStaffById(staffId: string): Promise<AuthStaffRecord | null> {
			const staff = await database.staff.findFirst({
				where: {
					id: staffId,
					deletedAt: null
				},
				include: authStaffInclude
			});

			return staff ? mapAuthStaffRecord(staff) : null;
		},

		async recordFailedPasswordAttempt(
			staffId: string,
			attemptedAt: Date,
			options: {
				windowMilliseconds: number;
				maxAttempts: number;
				blockMilliseconds: number;
			}
		): Promise<{ authBlockedUntil: Date | null }> {
			const rows = await database.$queryRaw<Array<{ authBlockedUntil: Date | null }>>`
				WITH current_attempt AS (
					SELECT
						"id",
						CASE
							WHEN "failedAuthWindowStartedAt" IS NULL
								OR "failedAuthWindowStartedAt" <= CAST(${attemptedAt} AS timestamptz)
									- (CAST(${options.windowMilliseconds} AS double precision) * INTERVAL '1 millisecond')
							THEN 1
							ELSE "failedAuthCount" + 1
						END AS next_count,
						CASE
							WHEN "failedAuthWindowStartedAt" IS NULL
								OR "failedAuthWindowStartedAt" <= CAST(${attemptedAt} AS timestamptz)
									- (CAST(${options.windowMilliseconds} AS double precision) * INTERVAL '1 millisecond')
							THEN CAST(${attemptedAt} AS timestamptz)
							ELSE "failedAuthWindowStartedAt"
						END AS next_window_started_at
					FROM "Staff"
					WHERE "id" = ${staffId}
					FOR UPDATE
				)
				UPDATE "Staff" AS staff
				SET
					"failedAuthCount" = current_attempt.next_count,
					"failedAuthWindowStartedAt" = current_attempt.next_window_started_at,
					"authBlockedUntil" = CASE
						WHEN current_attempt.next_count >= CAST(${options.maxAttempts} AS integer)
						THEN CAST(${attemptedAt} AS timestamptz)
							+ (CAST(${options.blockMilliseconds} AS double precision) * INTERVAL '1 millisecond')
						ELSE NULL
					END,
					"updatedAt" = CURRENT_TIMESTAMP
				FROM current_attempt
				WHERE staff."id" = current_attempt."id"
				RETURNING staff."authBlockedUntil"
			`;

			return rows[0] ?? { authBlockedUntil: null };
		},

		async clearFailedPasswordAttempts(staffId: string, authenticatedAt: Date): Promise<boolean> {
			const result = await database.staff.updateMany({
				where: {
					id: staffId,
					OR: [{ authBlockedUntil: null }, { authBlockedUntil: { lte: authenticatedAt } }]
				},
				data: {
					failedAuthCount: 0,
					failedAuthWindowStartedAt: null,
					authBlockedUntil: null
				}
			});

			return result.count === 1;
		},

		async findSessionById(sessionId: string) {
			const session = await database.authSession.findFirst({
				where: {
					id: sessionId
				},
				include: {
					staff: {
						include: authStaffInclude
					}
				}
			});

			if (!session) {
				return null;
			}

			return {
				session: mapSessionRecord(session),
				staff: mapAuthStaffRecord(session.staff)
			};
		},

		async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
			const session = await database.$transaction(async (transaction) => {
				const createdSession = await transaction.authSession.create({
					data: {
						id: input.sessionId,
						staffId: input.staffId,
						userAgent: input.userAgent,
						ipAddress: input.ipAddress,
						authenticatedAt: input.authenticatedAt,
						expiresAt: input.expiresAt,
						refreshTokens: {
							create: {
								id: input.refreshTokenId,
								jwtId: input.refreshJwtId,
								tokenHash: input.refreshTokenHash,
								expiresAt: input.refreshExpiresAt
							}
						}
					}
				});

				await transaction.staff.update({
					where: {
						id: input.staffId
					},
					data: {
						lastLoginAt: input.authenticatedAt
					}
				});

				return createdSession;
			});

			return mapSessionRecord(session);
		},

		async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
			const token = await database.refreshToken.findUnique({
				where: {
					tokenHash
				},
				include: {
					session: true
				}
			});

			if (!token) {
				return null;
			}

			const staff = await this.findStaffById(token.session.staffId);

			if (!staff) {
				return null;
			}

			return {
				id: token.id,
				sessionId: token.sessionId,
				staffId: token.session.staffId,
				jwtId: token.jwtId,
				tokenHash: token.tokenHash,
				expiresAt: token.expiresAt,
				consumedAt: token.consumedAt,
				revokedAt: token.revokedAt,
				session: mapSessionRecord(token.session),
				staff
			};
		},

		async replaceRefreshToken(input: ReplaceRefreshTokenInput): Promise<boolean> {
			return database.$transaction(async (transaction) => {
				const currentToken = await transaction.refreshToken.findUnique({
					where: { tokenHash: input.currentTokenHash }
				});

				if (!currentToken) return false;

				const claimedToken = await transaction.refreshToken.updateMany({
					where: {
						id: currentToken.id,
						consumedAt: null,
						revokedAt: null,
						expiresAt: { gt: input.usedAt }
					},
					data: {
						lastUsedAt: input.usedAt,
						consumedAt: input.usedAt
					}
				});

				if (claimedToken.count !== 1) return false;

				await transaction.authSession.update({
					where: { id: currentToken.sessionId },
					data: {
						lastSeenAt: input.sessionLastSeenAt,
						expiresAt: input.sessionExpiresAt
					}
				});
				await transaction.refreshToken.create({
					data: {
						id: input.newTokenId,
						sessionId: currentToken.sessionId,
						jwtId: input.newJwtId,
						tokenHash: input.newTokenHash,
						previousTokenId: currentToken.id,
						expiresAt: input.newExpiresAt
					}
				});

				return true;
			});
		},

		async revokeSession(sessionId: string): Promise<void> {
			await database.authSession.updateMany({
				where: {
					id: sessionId,
					revokedAt: null
				},
				data: {
					revokedAt: new Date()
				}
			});

			await database.refreshToken.updateMany({
				where: {
					sessionId,
					revokedAt: null
				},
				data: {
					revokedAt: new Date()
				}
			});
		},

		async revokeSessionForStaff(sessionId: string, staffId: string): Promise<boolean> {
			const session = await database.authSession.findFirst({
				where: {
					id: sessionId,
					staffId
				}
			});

			if (!session) {
				return false;
			}

			await this.revokeSession(sessionId);
			return true;
		},

		async listSessions(staffId: string): Promise<AuthSessionRecord[]> {
			const sessions = await database.authSession.findMany({
				where: {
					staffId
				},
				orderBy: {
					authenticatedAt: 'desc'
				}
			});

			return sessions.map(mapSessionRecord);
		},

		async pruneExpiredSessions(cutoff: Date): Promise<number> {
			const result = await database.authSession.deleteMany({
				where: {
					OR: [{ expiresAt: { lte: cutoff } }, { revokedAt: { lte: cutoff } }]
				}
			});

			return result.count;
		},

		async findTotpCredential(staffId: string): Promise<TotpCredentialRecord | null> {
			const credentials = await database.$queryRaw<
				Array<{
					staffId: string;
					secretEncrypted: string;
					digits: number;
					period: number;
					verifiedAt: Date | null;
					lastUsedAt: Date | null;
					lastUsedTimeStep: bigint | null;
				}>
			>`SELECT "staffId", "secretEncrypted", "digits", "period", "verifiedAt", "lastUsedAt", "lastUsedTimeStep"
				FROM "TotpCredential"
				WHERE "staffId" = ${staffId} AND "deletedAt" IS NULL
				ORDER BY "createdAt" DESC
				LIMIT 1`;
			const credential = credentials[0] ?? null;

			if (!credential) {
				return null;
			}

			return {
				staffId: credential.staffId,
				secretEncrypted: credential.secretEncrypted,
				digits: credential.digits,
				period: credential.period,
				verifiedAt: credential.verifiedAt,
				lastUsedAt: credential.lastUsedAt,
				lastUsedTimeStep: credential.lastUsedTimeStep
			};
		},

		async updateMfaPreference(
			staffId: string,
			preferences: { preferredMfaMethod: 'authenticator' | 'passkey' | null }
		): Promise<void> {
			await database.staff.update({
				where: {
					id: staffId
				},
				data: {
					preferredMfaMethod: preferences.preferredMfaMethod
				}
			});
		},

		async upsertTotpCredential(input: {
			staffId: string;
			secretEncrypted: string;
			digits: number;
			period: number;
			verifiedAt: Date;
			lastUsedAt: Date;
			lastUsedTimeStep: bigint;
		}): Promise<void> {
			const existingCredentials = await database.$queryRaw<Array<{ id: string }>>`
				SELECT "id"
				FROM "TotpCredential"
				WHERE "staffId" = ${input.staffId} AND "deletedAt" IS NULL
				ORDER BY "createdAt" DESC
				LIMIT 1
			`;
			const existingCredential = existingCredentials[0] ?? null;

			if (existingCredential) {
				await database.$executeRaw`
					UPDATE "TotpCredential"
					SET "secretEncrypted" = ${input.secretEncrypted},
						"digits" = ${input.digits},
						"period" = ${input.period},
						"verifiedAt" = ${input.verifiedAt},
						"lastUsedAt" = ${input.lastUsedAt},
						"lastUsedTimeStep" = ${input.lastUsedTimeStep},
						"deletedAt" = NULL,
						"updatedAt" = CURRENT_TIMESTAMP
					WHERE "id" = ${existingCredential.id}
				`;
				return;
			}

			await database.$executeRaw`
				INSERT INTO "TotpCredential" (
					"id",
					"staffId",
					"secretEncrypted",
					"digits",
					"period",
					"verifiedAt",
					"lastUsedAt",
					"lastUsedTimeStep",
					"createdAt",
					"updatedAt"
				)
				VALUES (
					${crypto.randomUUID()},
					${input.staffId},
					${input.secretEncrypted},
					${input.digits},
					${input.period},
					${input.verifiedAt},
					${input.lastUsedAt},
					${input.lastUsedTimeStep},
					CURRENT_TIMESTAMP,
					CURRENT_TIMESTAMP
				)
			`;
		},

		async consumeTotpTimeStep(staffId: string, timeStep: bigint, usedAt: Date): Promise<boolean> {
			const count = await database.$executeRaw`
				UPDATE "TotpCredential"
				SET
					"lastUsedAt" = ${usedAt},
					"lastUsedTimeStep" = ${timeStep},
					"updatedAt" = CURRENT_TIMESTAMP
				WHERE "staffId" = ${staffId}
					AND "deletedAt" IS NULL
					AND "verifiedAt" IS NOT NULL
					AND ("lastUsedTimeStep" IS NULL OR "lastUsedTimeStep" < ${timeStep})
			`;

			return count === 1;
		},

		async deleteTotpCredential(staffId: string): Promise<'removed' | 'not_found' | 'mfa_required'> {
			return database.$transaction(async (transaction) => {
				const staff = await transaction.$queryRaw<Array<{ id: string }>>`
					SELECT "id"
					FROM "Staff"
					WHERE "id" = ${staffId}
					FOR UPDATE
				`;
				if (staff.length === 0) return 'not_found';

				const activeTotpCount = await transaction.totpCredential.count({
					where: { staffId, deletedAt: null, verifiedAt: { not: null } }
				});
				if (activeTotpCount === 0) return 'not_found';

				const activePasskeyCount = await transaction.passkeyCredential.count({
					where: { staffId, deletedAt: null, verifiedAt: { not: null } }
				});
				if (activePasskeyCount === 0) return 'mfa_required';

				await transaction.totpCredential.updateMany({
					where: { staffId, deletedAt: null },
					data: { deletedAt: new Date() }
				});
				await transaction.staff.update({
					where: { id: staffId },
					data: { preferredMfaMethod: 'passkey' }
				});
				return 'removed';
			});
		},

		async createPasskeyCredential(
			input: Omit<PasskeyCredentialRecord, 'id' | 'lastUsedAt' | 'verifiedAt'>
		): Promise<PasskeyCredentialRecord> {
			const credential = await database.passkeyCredential.create({
				data: {
					staffId: input.staffId,
					credentialId: input.credentialId,
					publicKey: normalizeBinary(input.publicKey),
					userHandle: input.userHandle,
					counter: input.counter,
					transports: input.transports,
					aaguid: input.aaguid,
					deviceType: input.deviceType,
					backedUp: input.backedUp,
					nickname: input.nickname,
					verifiedAt: new Date()
				}
			});

			return mapPasskeyRecord(credential);
		},

		async consumePasskeyAuthentication(input: {
			credentialId: string;
			expectedCounter: number;
			expectedLastUsedAt: Date | null;
			counter: number;
			lastUsedAt: Date;
		}): Promise<boolean> {
			if (input.counter < input.expectedCounter) return false;

			const result = await database.passkeyCredential.updateMany({
				where: {
					credentialId: input.credentialId,
					counter: input.expectedCounter,
					lastUsedAt: input.expectedLastUsedAt,
					verifiedAt: { not: null },
					deletedAt: null
				},
				data: {
					counter: input.counter,
					lastUsedAt: input.lastUsedAt
				}
			});

			return result.count === 1;
		},

		async listPasskeyCredentials(staffId: string): Promise<PasskeyCredentialRecord[]> {
			const credentials = await database.passkeyCredential.findMany({
				where: {
					staffId,
					verifiedAt: { not: null },
					deletedAt: null
				},
				orderBy: {
					createdAt: 'asc'
				}
			});

			return credentials.map(mapPasskeyRecord);
		},

		async findPasskeyCredentialByCredentialId(
			credentialId: string
		): Promise<PasskeyCredentialRecord | null> {
			const credential = await database.passkeyCredential.findUnique({
				where: {
					credentialId,
					verifiedAt: { not: null },
					deletedAt: null
				}
			});

			return credential ? mapPasskeyRecord(credential) : null;
		},

		async findPasskeyCredentialById(
			staffId: string,
			passkeyId: string
		): Promise<PasskeyCredentialRecord | null> {
			const credential = await database.passkeyCredential.findFirst({
				where: {
					id: passkeyId,
					staffId,
					verifiedAt: { not: null },
					deletedAt: null
				}
			});

			return credential ? mapPasskeyRecord(credential) : null;
		},

		async updatePasskeyCredentialNickname(
			staffId: string,
			passkeyId: string,
			nickname: string
		): Promise<PasskeyCredentialRecord | null> {
			const result = await database.passkeyCredential.updateMany({
				where: {
					id: passkeyId,
					staffId,
					deletedAt: null
				},
				data: { nickname }
			});

			if (result.count === 0) return null;
			return this.findPasskeyCredentialById(staffId, passkeyId);
		},

		async deletePasskeyCredential(
			staffId: string,
			passkeyId: string
		): Promise<'removed' | 'not_found' | 'mfa_required'> {
			return database.$transaction(async (transaction) => {
				const staff = await transaction.$queryRaw<Array<{ id: string }>>`
					SELECT "id"
					FROM "Staff"
					WHERE "id" = ${staffId}
					FOR UPDATE
				`;
				if (staff.length === 0) return 'not_found';

				const credential = await transaction.passkeyCredential.findFirst({
					where: {
						id: passkeyId,
						staffId,
						deletedAt: null,
						verifiedAt: { not: null }
					},
					select: { id: true }
				});
				if (!credential) return 'not_found';

				const activeTotpCount = await transaction.totpCredential.count({
					where: { staffId, deletedAt: null, verifiedAt: { not: null } }
				});
				const activePasskeyCount = await transaction.passkeyCredential.count({
					where: { staffId, deletedAt: null, verifiedAt: { not: null } }
				});
				if (activeTotpCount === 0 && activePasskeyCount === 1) return 'mfa_required';

				await transaction.passkeyCredential.update({
					where: { id: credential.id },
					data: { deletedAt: new Date() }
				});
				await transaction.staff.update({
					where: { id: staffId },
					data: {
						preferredMfaMethod:
							activePasskeyCount > 1 ? 'passkey' : activeTotpCount > 0 ? 'authenticator' : null
					}
				});
				return 'removed';
			});
		},

		async updatePasswordHash(staffId: string, passwordHash: string): Promise<void> {
			await database.staff.update({
				where: {
					id: staffId
				},
				data: {
					passwordHash
				}
			});
		}
	};
}
