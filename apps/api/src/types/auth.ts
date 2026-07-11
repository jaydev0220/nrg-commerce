import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from '@simplewebauthn/server';
import type {
	MfaMethod,
	PasskeyDeviceType,
	PermissionKey,
	RoleKey,
	StaffStatus
} from '@packages/database';

export type AuthRoleRecord = {
	id: string;
	key: RoleKey;
	name: string;
	permissions: PermissionKey[];
};

export type AuthStaffRecord = {
	id: string;
	email: string;
	name: string;
	status: StaffStatus;
	passwordHash: string | null;
	mfaRequired: boolean;
	preferredMfaMethod: MfaMethod | null;
	lastLoginAt: Date | null;
	roles: AuthRoleRecord[];
	totpCredentialCount: number;
	passkeyCredentialCount: number;
};

export type TotpCredentialRecord = {
	staffId: string;
	secretEncrypted: string;
	digits: number;
	period: number;
	verifiedAt: Date | null;
};

export type PasskeyCredentialRecord = {
	id: string;
	staffId: string;
	credentialId: string;
	publicKey: Uint8Array;
	userHandle: string | null;
	counter: number;
	transports: string[];
	aaguid: string | null;
	deviceType: PasskeyDeviceType | null;
	backedUp: boolean | null;
	nickname: string | null;
	verifiedAt: Date | null;
	lastUsedAt: Date | null;
};

export type AuthSessionRecord = {
	id: string;
	staffId: string;
	userAgent: string | null;
	ipAddress: string | null;
	authenticatedAt: Date;
	lastSeenAt: Date | null;
	expiresAt: Date;
	revokedAt: Date | null;
};

export type RefreshTokenRecord = {
	id: string;
	sessionId: string;
	staffId: string;
	jwtId: string;
	tokenHash: string;
	expiresAt: Date;
	consumedAt: Date | null;
	revokedAt: Date | null;
	staff: AuthStaffRecord;
};

export type AccessTokenPayload = {
	sub: string;
	sid: string;
	jti: string;
	roles: RoleKey[];
	permissions: PermissionKey[];
	mfa: MfaMethod[];
	primaryFactor: 'password' | 'passkey';
};

export type RefreshTokenPayload = {
	sub: string;
	sid: string;
	jti: string;
	mfa: MfaMethod[];
	primaryFactor: 'password' | 'passkey';
};

export type PendingAuthPayload = {
	staffId: string;
	primaryFactor: 'password' | 'passkey';
	requiredMfaMethod: MfaMethod;
};

export type CeremonyTokenPurpose =
	| 'mfa_setup'
	| 'totp_setup'
	| 'passkey_registration'
	| 'passkey_login'
	| 'passkey_mfa';

export type MfaSetupTokenPayload = {
	purpose: 'mfa_setup';
	staffId: string;
	primaryFactor: 'password' | 'passkey';
};

export type TotpSetupTokenPayload = {
	purpose: 'totp_setup';
	staffId: string;
	secret: string;
	label: string;
	digits: number;
	period: number;
};

export type PasskeyRegistrationTokenPayload = {
	purpose: 'passkey_registration';
	staffId: string;
	challenge: string;
	nickname: string | null;
	primaryFactor?: 'password' | 'passkey';
};

export type PasskeyAuthenticationTokenPayload = {
	purpose: 'passkey_login' | 'passkey_mfa';
	staffId: string;
	challenge: string;
	primaryFactor: 'password' | 'passkey';
};

export type AuthenticatedStaffContext = {
	staffId: string;
	sessionId: string;
	roles: RoleKey[];
	permissions: PermissionKey[];
	mfa: MfaMethod[];
	primaryFactor: 'password' | 'passkey';
	staff: AuthStaffRecord;
};

export type AuthSuccessResult = {
	status: 'authenticated';
	accessToken: string;
	refreshToken: string;
	session: AuthSessionRecord;
	staff: AuthStaffRecord;
};

export type AuthMfaChallengeResult = {
	status: 'mfa_required';
	method: MfaMethod;
	pendingToken: string;
};

export type AuthMfaSetupRequiredResult = {
	status: 'mfa_setup_required';
	setupToken: string;
	availableMethods: MfaMethod[];
	staffId: string;
};

export type PasskeyOptionsResult = {
	ceremonyToken: string;
	options: PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON;
};

export type TOTPSetupResult = {
	setupToken: string;
	secret: string;
	otpauthUrl: string;
	digits: number;
	period: number;
};

export type PasskeyRegistrationInput = {
	ceremonyToken: string;
	credential: RegistrationResponseJSON;
};

export type PasskeyAuthenticationInput = {
	ceremonyToken: string;
	credential: AuthenticationResponseJSON;
	userAgent: string | null;
	ipAddress: string | null;
};
