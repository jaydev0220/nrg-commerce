import type { DatabaseClient, PermissionKey, RoleKey } from '@packages/database';

import type {
	AuthSessionRecord,
	AuthStaffRecord,
	PasskeyCredentialRecord,
	RefreshTokenRecord,
	TotpCredentialRecord
} from '../../types/auth.js';

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

function mapRoleKey(value: string): RoleKey {
	if (value === 'catalog-manager' || value === 'staff-manager') {
		return value;
	}

	return 'admin';
}

function mapPermissionKey(value: string): PermissionKey {
	return value as PermissionKey;
}

function mapAuthStaffRecord(staff: {
	id: string;
	email: string;
	name: string;
	status: 'active' | 'inactive' | 'suspended';
	passwordHash: string | null;
	preferredMfaMethod: 'authenticator' | 'passkey' | null;
	lastLoginAt: Date | null;
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
		roles: staff.roles.map(({ role }) => ({
			id: role.id,
			key: mapRoleKey(role.key),
			name: role.name,
			permissions: role.rolePermissions.map(({ permission }) => mapPermissionKey(permission.key))
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

		async findTotpCredential(staffId: string): Promise<TotpCredentialRecord | null> {
			const credentials = await database.$queryRaw<
				Array<{
					staffId: string;
					secretEncrypted: string;
					digits: number;
					period: number;
					verifiedAt: Date | null;
				}>
			>`SELECT "staffId", "secretEncrypted", "digits", "period", "verifiedAt"
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
				verifiedAt: credential.verifiedAt
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
					CURRENT_TIMESTAMP,
					CURRENT_TIMESTAMP
				)
			`;
		},

		async deleteTotpCredential(staffId: string): Promise<void> {
			await database.$executeRaw`
				UPDATE "TotpCredential"
				SET "deletedAt" = CURRENT_TIMESTAMP,
					"updatedAt" = CURRENT_TIMESTAMP
				WHERE "staffId" = ${staffId} AND "deletedAt" IS NULL
			`;
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

		async updatePasskeyCredentialCounter(
			credentialId: string,
			counter: number,
			lastUsedAt: Date
		): Promise<void> {
			await database.passkeyCredential.update({
				where: {
					credentialId
				},
				data: {
					counter,
					lastUsedAt,
					verifiedAt: lastUsedAt
				}
			});
		},

		async listPasskeyCredentials(staffId: string): Promise<PasskeyCredentialRecord[]> {
			const credentials = await database.passkeyCredential.findMany({
				where: {
					staffId,
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
					credentialId
				}
			});

			return credential && !credential.deletedAt ? mapPasskeyRecord(credential) : null;
		},

		async findPasskeyCredentialById(
			staffId: string,
			passkeyId: string
		): Promise<PasskeyCredentialRecord | null> {
			const credential = await database.passkeyCredential.findFirst({
				where: {
					id: passkeyId,
					staffId,
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

		async deletePasskeyCredential(staffId: string, passkeyId: string): Promise<boolean> {
			const result = await database.passkeyCredential.updateMany({
				where: {
					id: passkeyId,
					staffId,
					deletedAt: null
				},
				data: {
					deletedAt: new Date(),
					updatedAt: new Date()
				}
			});

			return result.count > 0;
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
