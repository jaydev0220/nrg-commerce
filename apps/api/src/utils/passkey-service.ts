import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from '@simplewebauthn/server';

import type { AuthStaffRecord, PasskeyCredentialRecord } from '../types/auth.js';

type PasskeyServiceConfig = {
	rpId: string;
	rpName: string;
	origin: string;
};

type AuthenticatorTransport =
	| 'ble'
	| 'cable'
	| 'hybrid'
	| 'internal'
	| 'nfc'
	| 'smart-card'
	| 'usb';

const supportedTransports = new Set<AuthenticatorTransport>([
	'ble',
	'cable',
	'hybrid',
	'internal',
	'nfc',
	'smart-card',
	'usb'
]);

function normalizeTransports(transports: string[]): AuthenticatorTransport[] {
	return transports.filter((transport): transport is AuthenticatorTransport =>
		supportedTransports.has(transport as AuthenticatorTransport)
	);
}

function normalizeBinary(value: Uint8Array): Uint8Array<ArrayBuffer> {
	return value.slice();
}

export function createPasskeyService(config: PasskeyServiceConfig) {
	return {
		async beginRegistration(
			staff: AuthStaffRecord,
			credentials: PasskeyCredentialRecord[]
		): Promise<PublicKeyCredentialCreationOptionsJSON> {
			return generateRegistrationOptions({
				rpName: config.rpName,
				rpID: config.rpId,
				userName: staff.email,
				userID: Buffer.from(staff.id),
				userDisplayName: staff.name,
				authenticatorSelection: {
					residentKey: 'required',
					userVerification: 'required'
				},
				excludeCredentials: credentials.map((credential) => ({
					id: credential.credentialId,
					transports: normalizeTransports(credential.transports)
				}))
			});
		},

		async finishRegistration(challenge: string, credential: RegistrationResponseJSON) {
			return verifyRegistrationResponse({
				response: credential,
				expectedChallenge: challenge,
				expectedOrigin: config.origin,
				expectedRPID: config.rpId
			});
		},

		async beginAuthentication(
			credentials: PasskeyCredentialRecord[],
			requireUserVerification: 'required' | 'preferred' | 'discouraged'
		): Promise<PublicKeyCredentialRequestOptionsJSON> {
			return generateAuthenticationOptions({
				rpID: config.rpId,
				...(credentials.length > 0
					? {
							allowCredentials: credentials.map((credential) => ({
								id: credential.credentialId,
								transports: normalizeTransports(credential.transports)
							}))
						}
					: {}),
				userVerification: requireUserVerification
			});
		},

		async finishAuthentication(
			challenge: string,
			credential: AuthenticationResponseJSON,
			storedCredential: PasskeyCredentialRecord,
			requireUserVerification: boolean
		) {
			return verifyAuthenticationResponse({
				response: credential,
				expectedChallenge: challenge,
				expectedOrigin: config.origin,
				expectedRPID: config.rpId,
				requireUserVerification,
				credential: {
					id: storedCredential.credentialId,
					publicKey: normalizeBinary(storedCredential.publicKey),
					counter: storedCredential.counter,
					transports: normalizeTransports(storedCredential.transports)
				}
			});
		}
	};
}

export type PasskeyService = ReturnType<typeof createPasskeyService>;
